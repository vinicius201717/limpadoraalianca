# Production Readiness - Phase 1

Data: 2026-07-07

Status: NOT_READY_FOR_DEPLOYMENT

## Resumo do estado anterior

O sistema ja tinha uma base funcional para demonstracao, com autenticacao por JWT, permissoes por perfil, ordens de servico, checklist, colaboradores, almoxarifado, materiais, equipamentos e dashboard. A auditoria identificou pontos criticos:

- paginas server-side de OS carregavam dados por ID antes de validar o vinculo do usuario;
- `JWT_SECRET` tinha fallback fixo de demonstracao;
- `proxy.ts` aceitava a simples existencia do cookie;
- agenda ainda importava `demo-data` diretamente;
- permissoes comerciais eram genericas e davam poder amplo ao perfil `TECNICO`;
- runtime principal ainda usa `src/lib/store.ts` + SQLite local com JSON unico em `app_state`.

## Vulnerabilidades corrigidas

- Criada autorizacao central para OS em `src/lib/service-order-access.ts`.
- Paginas server-side de OS agora bloqueiam acesso indevido antes de renderizar dados.
- APIs principais de detalhe/status/equipe/checklist/materiais/equipamentos/avaliacoes/fotos/tarefas/solicitacoes usam a autorizacao central ou regras alinhadas.
- `JWT_SECRET ?? "dev-secret"` foi removido.
- Criada validacao central de ambiente em `src/lib/env.ts`.
- Criado helper de token em `src/lib/session-token.ts` com payload tipado e validacao criptografica.
- `proxy.ts` agora valida assinatura/expiracao do JWT e apaga cookie invalido.
- `/api/auth/me` apaga cookie invalido ao retornar `401`.
- Agenda deixou de importar `demo-data` direto no componente e agora recebe dados reais do estado atual no Server Component.
- Permissoes de clientes, leads, vistorias e orcamentos foram separadas por acao.
- `TECNICO` deixou de aprovar/editar orcamentos e de acessar leads/orcamentos pelo handler generico.

## Arquivos alterados/criados nesta fase

- `.env.example`
- `docs/production-readiness-phase-1-report.md`
- `src/app/agenda/page.tsx`
- `src/app/api/auth/me/route.ts`
- `src/app/api/quotes/[id]/approve/route.ts`
- `src/app/api/service-orders/[id]/route.ts`
- `src/app/api/service-orders/[id]/status/route.ts`
- `src/app/api/service-orders/[id]/checklist/route.ts`
- `src/app/api/service-orders/[id]/employees/route.ts`
- `src/app/api/service-orders/[id]/materials/route.ts`
- `src/app/api/service-orders/[id]/equipment/route.ts`
- `src/app/api/service-orders/[id]/evaluations/route.ts`
- `src/app/api/service-orders/[id]/photos/route.ts`
- `src/app/api/service-orders/[id]/tasks/route.ts`
- `src/app/api/service-orders/[id]/material-requests/route.ts`
- `src/app/ordens-servico/[id]/page.tsx`
- `src/app/ordens-servico/[id]/avaliacoes/page.tsx`
- `src/app/ordens-servico/[id]/checklist/page.tsx`
- `src/app/ordens-servico/[id]/equipamentos/page.tsx`
- `src/app/ordens-servico/[id]/equipe/page.tsx`
- `src/app/ordens-servico/[id]/execucao/page.tsx`
- `src/app/ordens-servico/[id]/materiais/page.tsx`
- `src/components/ScheduleView.tsx`
- `src/lib/api-handlers.ts`
- `src/lib/auth.ts`
- `src/lib/checklist-access.ts`
- `src/lib/env.ts`
- `src/lib/permissions.ts`
- `src/lib/service-order-access.ts`
- `src/lib/service-order-page-data.ts`
- `src/lib/session-token.ts`
- `src/lib/store.ts`
- `src/proxy.ts`

## Migrations criadas

Nenhuma migration nova foi criada nesta fase porque o schema Prisma nao foi alterado.

## Tabelas migradas para Prisma

Nenhuma tabela foi migrada para runtime Prisma nesta fase. O schema Prisma ja modela as principais entidades, mas os handlers ainda dependem majoritariamente de `store.ts`.

## Dependencias restantes de `store.ts`

Ainda existem dependencias amplas de `store.ts` em rotas, paginas e helpers. O runtime principal continua usando:

- `src/lib/store.ts`;
- `src/lib/app-state-db.ts`;
- `data/floor-restoration-manager.sqlite`;
- tabela local `app_state` com JSON unico.

Operacoes restantes que persistem via JSON/app_state incluem usuarios, colaboradores, OS, checklist, estoque, agenda, materiais, equipamentos, avaliacoes e logs.

## Dependencias restantes de `demo-data`

Restam imports em:

- `prisma/seed.ts`
- `src/lib/store.ts`
- `src/lib/analytics.ts`
- `src/lib/auth-users.ts`
- `src/lib/module-config.ts`
- `src/components/DashboardView.tsx`
- `src/components/ServiceOrderDetailView.tsx`

Observacao: `ScheduleView.tsx` nao importa mais `demo-data` diretamente.

## Autenticacao

- O segredo JWT agora vem somente de `JWT_SECRET`.
- `SESSION_MAX_AGE` ou `SESSION_MAX_AGE_DAYS` configuram a duracao da sessao.
- O cookie permanece `httpOnly`, `sameSite: lax`, `secure` em producao e `path: /`.
- O proxy valida assinatura/expiracao, mas a autorizacao real continua sendo revalidada no servidor e nas APIs.
- Usuario inativo/removido continua sendo rejeitado em `verifySessionToken`, que consulta o usuario atual no store.

## Permissoes

- OS tem autorizacao central por perfil e vinculo.
- `OWNER`: acesso total.
- `GERENTE`: acesso operacional sem liberar financeiro quando proibido.
- `SUPERVISOR_OBRA`: acesso a OS onde e supervisor designado.
- `COLABORADOR`: acesso a OS vinculada por equipe, mantendo compatibilidade com array legado `employeeIds`.
- `ALMOXARIFADO`: acesso a OS relevante para separacao/entrega/devolucao ou ativa, sem financeiro.
- `FINANCEIRO`: acesso financeiro.
- Comercial/tecnico foram separados nas permissoes de clientes, leads, vistorias e orcamentos.

## Testes e validacoes executadas

Comandos executados:

```bash
npm run lint
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --create-only --name production_readiness_phase_1
npm run build
```

Resultados:

- `npm run lint`: passou.
- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npm run build`: passou.
- `npx prisma migrate dev --create-only --name production_readiness_phase_1`: falhou com `Schema engine error` no MySQL local `localhost:3306`.

Smoke tests nao foram executados nesta fase porque os scripts atuais ainda dependem de estado global/dados preexistentes ou criam registros no banco de demonstracao. Eles precisam ser migrados para banco isolado antes de serem confiaveis para production readiness.

## Limitacoes e riscos ainda existentes

- Runtime principal ainda nao usa Prisma/MySQL como fonte oficial.
- `AppState` JSON ainda existe no schema e no runtime local.
- Nao ha banco de teste isolado com `DATABASE_URL_TEST`.
- Smoke tests ainda nao isolam dados nem limpam com seguranca.
- `migrate dev` continua falhando no MySQL local.
- Algumas telas ainda possuem fallback de dados de demonstracao como props opcionais.
- Upload e fotos ainda nao usam provider de storage de producao.
- Tratamento de erro ainda mistura `{ message }` com o formato novo desejado `{ error: { code, message } }`.
- Logs de auditoria ainda dependem do store e nao estao totalmente estruturados por requestId.

## Proximos passos para deploy

1. Corrigir MySQL local/remoto e aplicar migrations reais.
2. Criar repositorios Prisma por dominio.
3. Migrar primeiro autenticacao, usuarios, colaboradores e OS para Prisma.
4. Migrar checklist, equipe, avaliacoes, agenda e estoque para Prisma com transacoes.
5. Remover runtime baseado em `app_state` JSON.
6. Criar banco de teste isolado e ajustar smoke tests.
7. Padronizar respostas de erro.
8. Trocar fallbacks restantes de `demo-data` por dados reais ou estados vazios.

## Status final

NOT_READY_FOR_DEPLOYMENT

Motivo: ainda existem modulos operacionais gravando no JSON unico de `app_state`, e Prisma/MySQL ainda nao e a fonte oficial do runtime.
