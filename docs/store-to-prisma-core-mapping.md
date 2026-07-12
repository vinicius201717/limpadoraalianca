# Store to Prisma core mapping

Status: fase preparada, runtime ainda nao migrado por bloqueio de conexao MySQL.

## Arquivos legados

- `src/lib/store.ts`: store operacional em memoria, hidratado por SQLite.
- `src/lib/app-state-db.ts`: camada SQLite local com tabela `app_state`.
- `data/floor-restoration-manager.sqlite`: arquivo local atual.

Backup criado antes de qualquer tentativa de importacao:

- Caminho: `C:\Users\Vinicius\Desktop\floor-restoration-manager\backups\pre-prisma-core-migration\20260707-214416\floor-restoration-manager.sqlite`
- Tamanho: `143360` bytes
- SHA-256: `00DB4734F0CFECFBFC7F113B2BA59AA985AE9C70DA6DF7A56810BF8155982CCE`

## Estado legado lido em modo somente leitura

| Entidade | Quantidade |
| --- | ---: |
| users | 7 |
| employees | 6 |
| customers | 3 |
| serviceOrders | 3 |
| serviceOrderEmployees | 6 |
| serviceOrderChecklistItems | 6 |
| serviceOrderChecklistEvents | 9 |
| materials | 0 |
| equipment | 0 |
| materialRequests | 0 |
| scheduleEvents | 0 |
| auditLogs | 31 |

Inconsistencias encontradas no nucleo migravel:

| Checagem | Resultado |
| --- | ---: |
| OS sem customerId | 0 |
| vinculo de equipe com OS inexistente | 0 |
| vinculo de equipe com colaborador inexistente | 0 |
| colaborador apontando para usuario inexistente | 0 |
| supervisor de OS sem usuario ativo SUPERVISOR_OBRA | 0 |

## Consumidores atuais de store.ts

Consumidores centrais que precisam migrar agora:

- `src/app/api/auth/login/route.ts`
- `src/lib/auth.ts`
- `src/app/api/users/**`
- `src/app/api/employees/**`
- `src/app/api/service-orders/route.ts`
- `src/app/api/service-orders/[id]/route.ts`
- `src/app/api/service-orders/[id]/assign-supervisor/route.ts`
- `src/app/api/service-orders/[id]/employees/route.ts`
- `src/app/api/service-orders/[id]/status/route.ts`
- `src/app/usuarios/**`
- `src/app/colaboradores/**`
- `src/app/ordens-servico/**`
- `src/app/agenda/page.tsx`
- `src/lib/service-order-access.ts`
- `src/lib/service-order-page-data.ts`

Consumidores que podem permanecer temporariamente legados nesta fase:

- `src/app/api/service-orders/[id]/checklist/**`
- `src/app/api/checklist-templates/**`
- `src/app/api/service-orders/[id]/materials/route.ts`
- `src/app/api/service-orders/[id]/equipment/route.ts`
- `src/app/api/service-orders/[id]/material-requests/route.ts`
- `src/app/api/stock/**`
- `src/app/almoxarifado/**`
- `src/app/materiais/page.tsx`
- `src/app/equipamentos/page.tsx`
- `src/app/api/evaluations/**`
- `src/app/api/dashboard/route.ts`, enquanto dashboard ainda soma dados legados nao migrados.

## Funcoes exportadas de store.ts

| Funcao | Classificacao | Observacao |
| --- | --- | --- |
| ensureDatabaseReady | REMOVE_AFTER_VALIDATION | Deve sair do nucleo depois da virada Prisma. |
| queueDatabasePersist | REMOVE_AFTER_VALIDATION | Persistencia SQLite local. |
| flushDatabasePersistence | REMOVE_AFTER_VALIDATION | Persistencia SQLite local. |
| toPublicUser | MIGRATE_NOW | Substituir por select Prisma sem passwordHash. |
| toPublicUsers | MIGRATE_NOW | Substituir por repository de usuarios. |
| findUserByEmail | MIGRATE_NOW | Login Prisma. |
| getSystemUserForSession | MIGRATE_NOW | Sessao deve revalidar usuario no MySQL. |
| findEmployeeByDocument | MIGRATE_NOW | Validacao de colaborador. |
| getActiveOwnerCount | MIGRATE_NOW | Regra de ultimo OWNER. |
| verifyUserCredentials | MIGRATE_NOW | Login com hash no MySQL. |
| listResource | LEGACY_TEMPORARY | Generico usado por modulos nao centrais. |
| findResource | LEGACY_TEMPORARY | Generico usado por modulos nao centrais. |
| createResource | LEGACY_TEMPORARY | Generico usado por modulos nao centrais. |
| updateResource | LEGACY_TEMPORARY | Generico usado por modulos nao centrais. |
| deleteResource | LEGACY_TEMPORARY | Generico usado por modulos nao centrais. |
| getEmployeeByUserId | MIGRATE_NOW | Viculo User -> Employee. |
| getLinkedEmployeeId | MIGRATE_NOW | Escopo de OS. |
| getAccessibleServiceOrders | MIGRATE_NOW | Repositorio Prisma com where por perfil. |
| sanitizeServiceOrderForRole | MIGRATE_NOW | Deve virar select por perfil. |
| canUserAccessOrder | MIGRATE_NOW | Autorizacao Prisma. |
| canUserAccessEmployee | MIGRATE_NOW | Escopo colaborador/supervisor. |
| recordAuditLog | MIGRATE_NOW | AuditLog relacional. |
| createSystemUser | MIGRATE_NOW | Criacao de usuario. |
| changeUserRole | MIGRATE_NOW | Alteracao de perfil. |
| updateUserStatus | MIGRATE_NOW | Ativar/desativar usuario. |
| updateSystemUser | MIGRATE_NOW | Edicao de usuario. |
| createEmployee | MIGRATE_NOW | Criacao de colaborador. |
| grantEmployeeAccess | MIGRATE_NOW | Criacao de login vinculado. |
| promoteEmployeeToSupervisor | MIGRATE_NOW | Promocao atomica. |
| promoteSupervisorToManager | MIGRATE_NOW | Promocao para gerente. |
| removeSupervisorRole | MIGRATE_NOW | Remocao de supervisor. |
| assignSupervisorToServiceOrder | MIGRATE_NOW | Supervisor designado em OS. |
| removeSupervisorFromServiceOrder | MIGRATE_NOW | Remocao de supervisor da OS. |
| createEvaluation | LEGACY_TEMPORARY | Avaliacoes podem ficar temporariamente legadas. |
| recordChecklistEvent | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| getChecklistProgress | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| getChecklistForServiceOrder | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| createChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| updateChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| deleteOrCancelChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| reorderChecklistItems | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| assignChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| startChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| addChecklistPhoto | LEGACY_TEMPORARY | Checklist/fotos ficam temporariamente legados. |
| completeChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| validateChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| reopenChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| blockChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| unblockChecklistItem | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| removeChecklistPhoto | LEGACY_TEMPORARY | Checklist/fotos ficam temporariamente legados. |
| getChecklistItemHistory | LEGACY_TEMPORARY | Checklist fica temporariamente legado. |
| createChecklistTemplate | LEGACY_TEMPORARY | Templates ficam legados nesta fase. |
| updateChecklistTemplate | LEGACY_TEMPORARY | Templates ficam legados nesta fase. |
| deleteChecklistTemplate | LEGACY_TEMPORARY | Templates ficam legados nesta fase. |
| applyChecklistTemplate | LEGACY_TEMPORARY | Templates/checklist ficam legados. |
| createMaterialRequest | LEGACY_TEMPORARY | Estoque fica temporariamente legado. |
| updateServiceOrderMaterial | LEGACY_TEMPORARY | Estoque fica temporariamente legado. |
| createSupervisorEvaluation | LEGACY_TEMPORARY | Avaliacoes podem ficar temporariamente legadas. |
| upsertScheduleEvent | LEGACY_TEMPORARY | Eventos independentes podem permanecer legados ate migracao completa da agenda. |

## Regras de negocio identificadas

- Usuario inativo nao faz login.
- `passwordHash` nunca deve ser serializado.
- OWNER e GERENTE criam colaboradores.
- Somente OWNER cria GERENTE.
- Ninguem cria OWNER pela API comum.
- Nao desativar o ultimo OWNER ativo.
- Gerente nao promove nem cria gerente.
- Promocao para supervisor precisa criar/ativar usuario `SUPERVISOR_OBRA`.
- Supervisor de OS precisa estar vinculado a colaborador com usuario ativo e role `SUPERVISOR_OBRA`.
- Colaborador ve somente OS em que esta vinculado na equipe.
- Supervisor ve somente OS em que e supervisor designado.
- Almoxarifado ve somente OS relevantes para materiais/equipamentos/solicitacoes.
- Financeiro nao deve depender de campos operacionais completos.

## Repositorios Prisma criados

- `src/server/repositories/users.repository.ts`
- `src/server/repositories/employees.repository.ts`
- `src/server/repositories/service-orders.repository.ts`
- `src/server/repositories/service-order-team.repository.ts`
- `src/server/repositories/schedule.repository.ts`
- `src/server/repositories/audit-log.repository.ts`

Esses arquivos concentram queries Prisma e escopo por perfil. A troca dos endpoints para estes repositorios ficou bloqueada pela autenticacao MySQL local invalida.
