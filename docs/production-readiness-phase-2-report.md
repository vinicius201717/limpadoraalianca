# Production Readiness - Fase 2

Status final: `NOT_READY_FOR_DEPLOYMENT`

## Resumo

A Fase 2 avancou na preparacao da migracao do nucleo operacional para Prisma/MySQL, mas a virada do runtime nao foi aplicada porque a conexao local MySQL esta rejeitando as credenciais configuradas em `.env`.

Para nao quebrar o login atual e nao deixar o sistema inutilizavel, os endpoints continuam usando o armazenamento legado ate a conexao MySQL ser corrigida e a migration poder ser executada com sucesso.

## Diagnostico MySQL

Configuracao encontrada, sem expor senha:

- Provider: `mysql`
- Host: `localhost`
- Porta: `3306`
- Banco: `floor_restoration_manager`
- Usuario: `root`
- Senha: definida na URL
- Query string: `allowPublicKeyRetrieval=true`
- Provider no `schema.prisma`: `mysql`
- Servico Windows encontrado: `MySQL80`
- Status do servico: `Running`
- Porta local em escuta: `3306`
- Processo: `mysqld`
- Docker Desktop: nao acessivel
- `docker compose ps`: sem arquivo compose no projeto

Comandos executados:

```txt
npx prisma validate
npx prisma generate
npx prisma db pull --print
docker ps
docker compose ps
Get-NetTCPConnection
Get-Service
```

Resultados:

- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma db pull --print`: falhou com `P1000`.

Erro Prisma:

```txt
P1000
Authentication failed against database server, the provided database credentials for `root` are not valid.
```

Causa exata identificada:

```txt
O MySQL local existe e responde na porta 3306, mas o usuario/senha configurados em DATABASE_URL nao autenticam.
```

Nenhuma alteracao silenciosa foi feita em `DATABASE_URL`.

## Backup legado

Backup criado antes de qualquer tentativa de importacao:

- Origem: `C:\Users\Vinicius\Desktop\floor-restoration-manager\data\floor-restoration-manager.sqlite`
- Destino: `C:\Users\Vinicius\Desktop\floor-restoration-manager\backups\pre-prisma-core-migration\20260707-214416\floor-restoration-manager.sqlite`
- Tamanho: `143360` bytes
- SHA-256: `00DB4734F0CFECFBFC7F113B2BA59AA985AE9C70DA6DF7A56810BF8155982CCE`

O JSON original em `app_state` nao foi apagado nem alterado durante o diagnostico.

## Estado legado atual

Leitura feita em modo somente leitura:

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

Nao foram encontrados orfaos no nucleo usuarios/colaboradores/OS/equipe/supervisor.

## Schema Prisma

Alteracoes preparadas:

- `User.role` indexado.
- `User.isActive` indexado.
- `ServiceOrder.status` indexado.
- `ServiceOrder.supervisorEmployeeId` indexado.
- `ServiceOrder.scheduledStart` indexado.
- `ServiceOrder.scheduledEnd` indexado.
- `Employee.status` indexado.
- `ServiceOrderEmployee.employeeId` indexado.
- `ServiceOrderEmployee.serviceOrderId` indexado.
- `AuditLog.entity` indexado.
- `AuditLog.entityId` indexado.
- `AuditLog.createdAt` indexado.
- `ServiceOrderEmployee` mantem `@@unique([serviceOrderId, employeeId])`.
- `onDelete` explicitado para relacoes operacionais relevantes.
- Relacao `ServiceOrder.assignedByUserId` modelada com `User`.
- `Employee.roleName` e `Employee.specialty` ficaram opcionais para acomodar registros reais mais simples.

## Repositorios Prisma criados

Foram criados:

- `src/server/repositories/users.repository.ts`
- `src/server/repositories/employees.repository.ts`
- `src/server/repositories/service-orders.repository.ts`
- `src/server/repositories/service-order-team.repository.ts`
- `src/server/repositories/schedule.repository.ts`
- `src/server/repositories/audit-log.repository.ts`

Cobertura preparada:

- Login por Prisma com `bcrypt`.
- Revalidacao server-side de usuario ativo.
- Atualizacao de `lastLoginAt`.
- Usuario publico sem `passwordHash`.
- Criacao e alteracao de usuarios.
- Criacao de colaboradores.
- Promocao para supervisor.
- Promocao de supervisor para gerente.
- Remocao de funcao de supervisor.
- OS com filtro por perfil.
- Equipe da OS com constraint unica.
- Supervisor designado validado por colaborador + usuario ativo + role `SUPERVISOR_OBRA`.
- Agenda derivada de OS Prisma.
- AuditLog relacional com sanitizacao de senha/JWT/cookie.

## Importador criado

Script:

```txt
scripts/import-app-state-to-prisma.ts
```

Comportamento:

- Le o SQLite legado sem alterar.
- Valida contagens e inconsistencias.
- Suporta dry-run por padrao.
- Usa `--apply` para gravar.
- Preserva IDs quando possivel.
- Usa `upsert` para idempotencia.
- Importa por dominio:
  - usuarios/colaboradores;
  - clientes minimos/OS/equipe;
  - AuditLog.

Uso seguro:

```bash
npx tsx scripts/import-app-state-to-prisma.ts
```

Aplicacao depois da conexao corrigida:

```bash
npx tsx scripts/import-app-state-to-prisma.ts --apply
```

## Bloqueio

Migration tentada e nao concluida:

```bash
npx prisma migrate dev --name migrate_core_runtime_to_prisma
```

Motivo:

```txt
Prisma retorna `Schema engine error` no migrate dev.
O teste `db pull --print` retorna P1000 para root em localhost:3306, indicando credenciais invalidas.
```

Nao foi usado:

```bash
npx prisma db push
```

## Proximo passo obrigatorio

Corrigir uma destas opcoes, sem usar banco de producao:

1. Atualizar a senha correta do usuario `root` na `DATABASE_URL`.
2. Criar um usuario MySQL local proprio para o projeto com permissao no banco `floor_restoration_manager`.
3. Ajustar a porta caso o MySQL correto esteja publicado em outra porta.

Depois disso, executar:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name migrate_core_runtime_to_prisma
npx tsx scripts/import-app-state-to-prisma.ts
npx tsx scripts/import-app-state-to-prisma.ts --apply
npm run lint
npm run build
```

So depois desse ciclo passar o runtime deve ser virado dos endpoints centrais para os repositorios Prisma.

## Validacao final executada nesta fase

Passou:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx tsx scripts/import-app-state-to-prisma.ts
npm run lint
npm run build
```

Falhou por conexao MySQL:

```bash
npx prisma db pull --print
npx prisma migrate dev --name migrate_core_runtime_to_prisma
```
