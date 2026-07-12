# Roles and supervisor implementation report

Data: 2026-07-03

## Objetivo

Implementar e endurecer a base de usuarios, colaboradores, perfis de acesso, promocao a supervisor, designacao de supervisor em ordem de servico, restricao de visualizacao por perfil e logs de auditoria.

## Arquivos criados

- `src/app/api/users/[id]/activate/route.ts`
- `src/app/api/users/[id]/deactivate/route.ts`
- `src/app/api/employees/[id]/activate/route.ts`
- `src/app/api/employees/[id]/deactivate/route.ts`
- `src/app/api/employees/[id]/grant-access/route.ts`
- `src/app/api/employees/[id]/remove-supervisor-role/route.ts`
- `src/components/AccessDeniedView.tsx`
- `src/components/NewUserView.tsx`
- `scripts/smoke-roles.mjs`
- `prisma/migrations/20260703010000_add_user_employee_roles_and_service_supervisor/migration.sql`
- `docs/roles-and-supervisor-implementation-report.md`

## Arquivos alterados

- `package.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/users/[id]/change-role/route.ts`
- `src/app/api/employees/route.ts`
- `src/app/api/employees/[id]/route.ts`
- `src/app/api/employees/[id]/promote-to-supervisor/route.ts`
- `src/app/api/service-orders/route.ts`
- `src/app/api/service-orders/[id]/assign-supervisor/route.ts`
- `src/app/usuarios/page.tsx`
- `src/app/usuarios/novo/page.tsx`
- `src/app/usuarios/[id]/page.tsx`
- `src/app/colaboradores/page.tsx`
- `src/app/colaboradores/novo/page.tsx`
- `src/app/colaboradores/[id]/page.tsx`
- `src/components/AppShell.tsx`
- `src/components/DashboardView.tsx`
- `src/components/EmployeeListView.tsx`
- `src/components/NewEmployeeView.tsx`
- `src/components/UserListView.tsx`
- `src/lib/permissions.ts`
- `src/lib/store.ts`
- `src/lib/types.ts`

## Migration criada

Migration: `add_user_employee_roles_and_service_supervisor`

Arquivo:

- `prisma/migrations/20260703010000_add_user_employee_roles_and_service_supervisor/migration.sql`

Alteracoes previstas:

- adiciona `User.lastLoginAt`;
- adiciona `Employee.jobTitle`;
- torna `Employee.document` unico quando informado;
- adiciona `ServiceOrder.assignedSupervisorByUserId`;
- adiciona `ServiceOrder.supervisorAssignedAt`;
- adiciona `AuditLog.ipAddress`.

Observacao: os campos antigos `roleName`, `assignedByUserId` e `assignedAt` foram preservados para compatibilidade com a UI e dados atuais.

## Endpoints criados ou ajustados

Usuarios:

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/[id]`
- `PATCH /api/users/[id]`
- `POST /api/users/[id]/change-role`
- `POST /api/users/[id]/activate`
- `POST /api/users/[id]/deactivate`

Colaboradores:

- `GET /api/employees`
- `POST /api/employees`
- `GET /api/employees/[id]`
- `PATCH /api/employees/[id]`
- `POST /api/employees/[id]/activate`
- `POST /api/employees/[id]/deactivate`
- `POST /api/employees/[id]/grant-access`
- `POST /api/employees/[id]/promote-to-supervisor`
- `POST /api/employees/[id]/remove-supervisor-role`

Ordens de servico:

- `GET /api/service-orders`
- `POST /api/service-orders`
- `POST /api/service-orders/[id]/assign-supervisor`
- `DELETE /api/service-orders/[id]/assign-supervisor`

Autenticacao:

- `POST /api/auth/login` agora autentica contra o store atual, permitindo login de usuarios criados em runtime.

## Permissoes implementadas

Centralizadas em `src/lib/permissions.ts`.

- `OWNER`:
  - cria `GERENTE`;
  - altera usuarios;
  - ativa/desativa usuarios;
  - cria colaboradores;
  - promove supervisores;
  - designa/remove supervisor da OS;
  - ve todas as OS.

- `GERENTE`:
  - cria/edita colaboradores;
  - cria acesso operacional por colaborador;
  - promove colaborador para `SUPERVISOR_OBRA`;
  - designa/remove supervisor da OS;
  - nao cria `GERENTE`;
  - nao promove para `GERENTE`;
  - nao edita `OWNER`.

- `SUPERVISOR_OBRA`:
  - ve somente OS atribuidas ao seu `Employee`;
  - nao cria usuario;
  - nao cria colaborador;
  - nao acessa `/usuarios`;
  - nao acessa a listagem administrativa completa de colaboradores.

- `COLABORADOR`:
  - ve somente OS em que esta vinculado por `ServiceOrderEmployee` ou pelo array legado `employeeIds`;
  - nao acessa usuarios;
  - nao altera roles.

- `ALMOXARIFADO`:
  - ve lista operacional minima de OS;
  - nao recebe receita/despesa na listagem de OS;
  - nao cria colaboradores;
  - nao altera roles.

- `FINANCEIRO`:
  - recebe visao de OS com dados financeiros e campos operacionais minimos.

## Regras de seguranca aplicadas

- `passwordHash` nao retorna em APIs.
- `passwordHash` nao e registrado em `AuditLog`.
- criacao de usuario com e-mail duplicado retorna `409`.
- criacao de colaborador com documento duplicado retorna `409`.
- mudanca para `OWNER` fica bloqueada por padrao.
- usuario nao consegue alterar a propria role.
- nao e permitido desativar o ultimo `OWNER` ativo.
- supervisor de OS precisa ser colaborador ativo com User ativo e role `SUPERVISOR_OBRA`.
- troca/remocao de supervisor da OS registra valores anteriores e novos no audit log.

## Interface

- `/usuarios` virou uma tela administrativa propria para OWNER, com:
  - nome;
  - e-mail;
  - role;
  - status;
  - colaborador vinculado;
  - ultimo acesso;
  - criacao;
  - ativar/desativar;
  - alterar role.

- `/usuarios/novo` agora usa formulario real e chama `POST /api/users`.

- `/colaboradores` agora exibe:
  - indicador de acesso ao sistema;
  - role de acesso;
  - cargo/funcao;
  - botao "Dar acesso";
  - botao "Promover a supervisor";
  - botao "Remover funcao de supervisor".

- `/dashboard` para `SUPERVISOR_OBRA` foi ajustado para mostrar:
  - servico principal;
  - cliente;
  - endereco;
  - inicio;
  - prazo;
  - status;
  - quantidade de colaboradores;
  - progresso de checklist quando existente;
  - outros servicos atribuidos.

## Testes executados

Comandos:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name add_user_employee_roles_and_service_supervisor
npm run smoke:roles
npm run lint
npm run build
```

Resultados:

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate dev --name add_user_employee_roles_and_service_supervisor`: falhou por erro do schema engine ao conectar em MySQL local `localhost:3306`.
- `npm run smoke:roles`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.

Smoke test validou:

- OWNER cria GERENTE.
- OWNER cria colaborador.
- OWNER promove supervisor.
- OWNER designa supervisor.
- GERENTE cria colaborador.
- GERENTE promove supervisor.
- GERENTE designa supervisor.
- GERENTE recebe `403` ao tentar criar GERENTE.
- GERENTE recebe `403` ao tentar alterar alguem para GERENTE.
- GERENTE recebe `403` ao tentar editar OWNER.
- SUPERVISOR_OBRA ve OS atribuidas.
- SUPERVISOR_OBRA nao ve OS de outro supervisor.
- SUPERVISOR_OBRA nao cria colaborador.
- SUPERVISOR_OBRA nao cria usuario.
- SUPERVISOR_OBRA nao acessa API de usuarios.
- SUPERVISOR_OBRA recebe tela de acesso restrito em `/usuarios`.
- COLABORADOR ve proprias OS.
- COLABORADOR nao ve servico alheio.
- COLABORADOR nao acessa usuarios.
- COLABORADOR nao altera roles.
- ALMOXARIFADO ve lista minima de OS.
- ALMOXARIFADO nao recebe financeiro completo.
- ALMOXARIFADO nao cria colaborador.
- ALMOXARIFADO nao altera roles.

## Limitacoes encontradas

- As APIs continuam usando o store em memoria baseado em `src/lib/demo-data.ts`. O schema Prisma e a migration foram preparados, mas os route handlers ainda nao foram migrados para consultas Prisma reais.
- Como o MySQL local nao respondeu adequadamente ao `migrate dev`, a migration nao foi aplicada no banco local nesta execucao.
- Algumas telas existentes ainda leem `demo-data` diretamente para apresentacao visual. As regras criticas foram reforcadas nas APIs e nas paginas administrativas principais.
- O modulo completo de almoxarifado, agenda inteligente e checklist com fotos nao foi expandido nesta etapa, conforme solicitado.

## Proximos passos recomendados

- Subir MySQL local com `DATABASE_URL` valido e rodar `npx prisma migrate dev`.
- Migrar `src/lib/store.ts` para repositorios Prisma reais, mantendo os mesmos contratos de permissao.
- Trocar telas que ainda importam `demo-data` por chamadas API ou Server Components com consultas Prisma.
- Adicionar testes automatizados em runner formal, como Vitest ou Playwright, alem do smoke test HTTP atual.
- Implementar recuperacao/redefinicao de senha real antes de producao.
- Remover fallback `dev-secret` em producao e exigir `JWT_SECRET`.
