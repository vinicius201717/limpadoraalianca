# User roles and supervisor report

Data: 2026-07-04

## Resumo

O sistema foi reforcado como uma base interna de gestao para restauracao de pisos e limpeza pos-obra, com foco em usuarios, colaboradores, supervisores de obra e visibilidade por perfil.

As regras criticas foram validadas por API:

- nenhum usuario consegue criar outro `OWNER` pela API normal;
- nenhum usuario consegue editar, ativar ou desativar o `OWNER` pelas APIs normais;
- `SUPERVISOR_OBRA` pode operar obras atribuidas, mas nao cria colaboradores nem usuarios;
- `ALMOXARIFADO` e `COLABORADOR` nao recebem dados financeiros de OS;
- usuario inativo perde login novo e sessao antiga;
- supervisor de OS precisa ser colaborador ativo com usuario ativo e role `SUPERVISOR_OBRA`;
- colaborador pode existir como cadastro operacional sem login no sistema.

## Arquivos criados nesta etapa

- `prisma/migrations/20260704090000_add_roles_users_employees_and_service_supervisor/migration.sql`
- `docs/user-roles-and-supervisor-report.md`

## Arquivos alterados nesta etapa

- `prisma/schema.prisma`
- `src/components/DashboardView.tsx`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- `src/lib/store.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/users/[id]/activate/route.ts`
- `src/app/api/users/[id]/deactivate/route.ts`
- `src/app/api/service-orders/[id]/route.ts`
- `scripts/smoke-roles.mjs`

## Migration criada

Migration:

- `20260704090000_add_roles_users_employees_and_service_supervisor`

Alteracoes previstas no banco:

- indice para `ServiceOrder.supervisorEmployeeId`;
- indice para `ServiceOrder.supervisorUserId`;
- indice para `ServiceOrder.assignedSupervisorByUserId`;
- FK de `ServiceOrder.supervisorEmployeeId` para `Employee.id`;
- FK de `ServiceOrder.supervisorUserId` para `User.id`;
- FK de `ServiceOrder.assignedSupervisorByUserId` para `User.id`.

Observacao: a migration anterior `20260703010000_add_user_employee_roles_and_service_supervisor` ja preparava campos como `User.lastLoginAt`, `Employee.jobTitle`, `Employee.document` unico, `ServiceOrder.assignedSupervisorByUserId`, `ServiceOrder.supervisorAssignedAt` e `AuditLog.ipAddress`.

## Models alterados

`User`

- `supervisedServiceOrders`: OS em que o usuario e o supervisor operacional.
- `assignedSupervisorServiceOrders`: OS em que o usuario registrou a designacao do supervisor.

`Employee`

- `supervisedServiceOrders`: OS em que o colaborador esta definido como supervisor principal.

`ServiceOrder`

- `supervisorEmployee`: relacao com o colaborador supervisor.
- `supervisorUser`: relacao com o usuario supervisor.
- `assignedSupervisorBy`: relacao com o usuario que fez a designacao.

## Endpoints reforcados

Usuarios:

- `POST /api/users`
- `PATCH /api/users/[id]`
- `POST /api/users/[id]/activate`
- `POST /api/users/[id]/deactivate`
- `POST /api/users/[id]/change-role`

Ordens de servico:

- `GET /api/service-orders`
- `GET /api/service-orders/[id]`
- `POST /api/service-orders/[id]/assign-supervisor`

Autenticacao:

- `POST /api/auth/login`
- leitura de sessao agora consulta o usuario atual no store e rejeita usuario inativo.

## O que cada perfil faz

`OWNER`

- ve todas as ordens de servico;
- cria `GERENTE` pela API de usuarios;
- cria e edita colaboradores;
- promove colaborador para `SUPERVISOR_OBRA`;
- designa ou remove supervisor da OS;
- acessa financeiro, relatorios e configuracoes;
- nao consegue criar outro `OWNER`;
- nao consegue editar, ativar ou desativar o `OWNER` pelas APIs normais.

`GERENTE`

- ve a operacao completa;
- cria e edita colaboradores;
- cria acesso operacional para colaborador;
- promove colaborador para `SUPERVISOR_OBRA`;
- designa ou remove supervisor da OS;
- acessa financeiro e relatorios operacionais;
- nao cria `GERENTE`;
- nao altera usuario para `GERENTE`;
- nao edita `OWNER`.

`SUPERVISOR_OBRA`

- ve somente as OS atribuidas ao seu usuario ou colaborador vinculado;
- acompanha equipe, checklist, fotos, materiais e prazos da obra;
- pode avaliar colaboradores da obra;
- pode concluir itens de checklist;
- nao cria usuario;
- nao cria colaborador;
- nao acessa a tela administrativa de usuarios.

`ALMOXARIFADO`

- ve uma lista operacional de OS para preparar materiais;
- gerencia materiais, separacao e solicitacoes;
- nao recebe receita ou despesa em lista nem detalhe da OS;
- nao cria colaborador;
- nao altera roles.

`COLABORADOR`

- ve somente OS em que esta escalado;
- acompanha endereco, horario, supervisor e checklist;
- pode avaliar supervisor quando aplicavel;
- nao recebe receita ou despesa em lista nem detalhe da OS;
- nao acessa usuarios;
- nao altera roles.

`FINANCEIRO`

- acessa modulo financeiro;
- pode visualizar dados financeiros de OS;
- recebe campos operacionais reduzidos quando a tela nao precisa de execucao/checklist.

`COMERCIAL`

- perfil preparado para funil comercial, leads, vistorias e orcamentos;
- nao cria colaboradores;
- nao avalia equipe;
- nao altera roles.

`TECNICO`

- perfil operacional mantido no enum para compatibilidade;
- pode ser evoluido para vistoria/execucao tecnica dedicada;
- nao recebe permissao administrativa por padrao.

## Dashboard por perfil

O dashboard agora evita uma tela unica para todos:

- `OWNER` e `GERENTE`: visao executiva com funil, qualidade, equipe e financeiro.
- `SUPERVISOR_OBRA`: obras atribuidas, OS principal, prazo, equipe e progresso de checklist.
- `ALMOXARIFADO`: fila de materiais, OS ativas, solicitacoes extras e separacao sem financeiro.
- `COLABORADOR`: escala propria, proxima obra, checklist pendente e avaliacao pessoal sem financeiro.

## Testes executados

Comandos executados:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name add_roles_users_employees_and_service_supervisor
npm run smoke:roles
npm run lint
npm run build
```

Resultados:

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate dev --name add_roles_users_employees_and_service_supervisor`: falhou no schema engine ao conectar/aplicar no MySQL local `localhost:3306`.
- `npm run smoke:roles`: passou com 45 verificacoes.
- `npm run lint`: passou.
- `npm run build`: passou.

Casos novos validados no smoke:

- OWNER cria e edita um GERENTE criado no teste.
- OWNER lista obras de supervisores diferentes.
- API normal nao cria `OWNER`.
- e-mail duplicado retorna `409`.
- OWNER nao edita `OWNER`.
- OWNER nao desativa o ultimo `OWNER`.
- usuario inativo nao faz login.
- sessao antiga de usuario inativo passa a retornar `401`.
- supervisor sem `Employee` vinculado recebe lista vazia de OS.
- colaborador sem login pode existir como cadastro operacional.
- colaborador sem `createAccess` retorna `user: null`.
- colaborador sem login de supervisor nao pode ser designado supervisor da OS.
- colaborador nao recebe financeiro no detalhe da OS.
- almoxarifado nao recebe financeiro na lista nem no detalhe da OS.

## Limitacoes e problemas encontrados

- As APIs ainda usam o store em memoria baseado em `src/lib/demo-data.ts`; o schema Prisma e as migrations estao preparados, mas os route handlers ainda precisam ser migrados para Prisma real.
- O `migrate dev` nao aplicou no banco local porque o Prisma retornou `Schema engine error` contra o MySQL `localhost:3306`.
- `COMERCIAL` e `TECNICO` estao previstos no modelo de roles, mas ainda nao possuem uma experiencia especifica tao completa quanto OWNER, GERENTE, SUPERVISOR_OBRA, ALMOXARIFADO e COLABORADOR.
- Estoque completo, agenda avancada, fotos reais de checklist e avaliacao colaborador -> supervisor foram mantidos fora deste passo, conforme escopo solicitado.

## Proximos passos recomendados

- Corrigir/confirmar o MySQL local e aplicar as migrations.
- Migrar `src/lib/store.ts` para repositorios Prisma.
- Criar testes persistentes com banco de teste, alem do smoke HTTP atual.
- Evoluir os dashboards especificos de `COMERCIAL`, `FINANCEIRO` e `TECNICO`.
- Adicionar recuperacao de senha e remover o fallback `dev-secret` em producao.
