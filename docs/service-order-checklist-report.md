# Service order checklist report

Data: 2026-07-04

## Resumo

Foi implementada a base completa de checklist operacional por ordem de servico, mantendo o projeto existente e preservando as regras de usuarios, colaboradores e supervisores ja validadas.

Cada item agora suporta responsavel, status, prazo, inicio, conclusao, validacao, fotos, bloqueio, reabertura e historico de eventos. As APIs validam permissao por perfil e tambem o vinculo real com a OS.

## Arquivos criados

- `prisma/migrations/20260704120000_add_service_order_checklist_execution/migration.sql`
- `src/app/api/checklist-templates/route.ts`
- `src/app/api/checklist-templates/[id]/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/assign/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/start/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/validate/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/reopen/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/block/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/unblock/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/photos/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/photos/[photoId]/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/history/route.ts`
- `src/app/api/service-orders/[id]/checklist/reorder/route.ts`
- `src/app/api/service-orders/[id]/checklist/apply-template/route.ts`
- `src/lib/checklist-access.ts`
- `src/lib/storage/types.ts`
- `src/lib/storage/local-provider.ts`
- `src/lib/storage/index.ts`
- `scripts/smoke-checklist.mjs`
- `docs/service-order-checklist-report.md`

## Arquivos alterados

- `package.json`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/app/api/service-orders/[id]/checklist/route.ts`
- `src/app/api/service-orders/[id]/checklist/[itemId]/complete/route.ts`
- `src/components/ServiceOrderDetailView.tsx`
- `src/components/DashboardView.tsx`
- `src/lib/demo-data.ts`
- `src/lib/permissions.ts`
- `src/lib/store.ts`
- `src/lib/types.ts`

## Migration criada

Migration:

- `20260704120000_add_service_order_checklist_execution`

Nome solicitado:

- `add_service_order_checklist_execution`

Ela adiciona:

- campos de execucao em `ServiceOrderChecklistItem`;
- metadados de foto em `ServiceOrderChecklistPhoto`;
- tabela `ServiceOrderChecklistEvent`;
- tabelas `ChecklistTemplate` e `ChecklistTemplateItem`;
- indices e FKs incrementais sem recriar tabelas existentes.

## Models criados ou ajustados

- `ChecklistPhotoType`
- `ChecklistEventType`
- `ServiceOrderChecklistItem`
- `ServiceOrderChecklistPhoto`
- `ServiceOrderChecklistEvent`
- `ChecklistTemplate`
- `ChecklistTemplateItem`
- relacoes novas em `ServiceOrder` e `Employee`

## Endpoints

Checklist da OS:

- `GET /api/service-orders/[id]/checklist`
- `POST /api/service-orders/[id]/checklist`
- `PATCH /api/service-orders/[id]/checklist/[itemId]`
- `DELETE /api/service-orders/[id]/checklist/[itemId]`
- `POST /api/service-orders/[id]/checklist/reorder`
- `POST /api/service-orders/[id]/checklist/apply-template`

Acoes do item:

- `POST /api/service-orders/[id]/checklist/[itemId]/assign`
- `POST /api/service-orders/[id]/checklist/[itemId]/start`
- `POST /api/service-orders/[id]/checklist/[itemId]/complete`
- `POST /api/service-orders/[id]/checklist/[itemId]/validate`
- `POST /api/service-orders/[id]/checklist/[itemId]/reopen`
- `POST /api/service-orders/[id]/checklist/[itemId]/block`
- `POST /api/service-orders/[id]/checklist/[itemId]/unblock`

Fotos e historico:

- `POST /api/service-orders/[id]/checklist/[itemId]/photos`
- `DELETE /api/service-orders/[id]/checklist/[itemId]/photos/[photoId]`
- `GET /api/service-orders/[id]/checklist/[itemId]/history`

Templates:

- `GET /api/checklist-templates`
- `POST /api/checklist-templates`
- `GET /api/checklist-templates/[id]`
- `PATCH /api/checklist-templates/[id]`
- `DELETE /api/checklist-templates/[id]`

## Permissoes

- `OWNER`: cria, edita, reordena, aplica template, atribui, inicia, conclui, valida, reabre, bloqueia e desbloqueia qualquer checklist.
- `GERENTE`: mesmas acoes operacionais do OWNER, exceto regras administrativas ja protegidas em usuarios.
- `SUPERVISOR_OBRA`: opera apenas checklists das OS atribuidas a ele.
- `COLABORADOR`: ve checklist das proprias OS e pode iniciar/concluir apenas item atribuido a ele quando `allowCollaboratorAction` estiver habilitado.
- `ALMOXARIFADO`, `COMERCIAL` e `FINANCEIRO`: nao alteram checklist operacional.

As APIs validam role, escopo da OS, colaborador ativo, colaborador na equipe, item pertencente a OS e payload com Zod.

## Upload

Foi criada a abstracao `src/lib/storage/` com `StorageProvider`, `UploadedFile` e `LocalStorageProvider`.

Nesta etapa, as APIs de checklist persistem somente URL e metadados. Elas rejeitam URL arbitraria externa e aceitam evidencias locais em:

- `/uploads/...`
- `/demo/...`
- `http://localhost:<porta>/uploads/...`

Tipos permitidos:

- JPEG
- PNG
- WebP

Nao ha imagem em base64 no banco.

## Interface

A aba `Checklist` em `/ordens-servico/[id]` agora mostra:

- progresso executado;
- percentual validado;
- itens bloqueados;
- fotos pendentes;
- itens atrasados;
- filtros por status;
- responsavel atribuido;
- executor;
- prazo;
- conclusao;
- fotos;
- acoes permitidas por perfil.

O dashboard do supervisor tambem mostra:

- itens atrasados;
- itens bloqueados;
- itens sem responsavel;
- fotos pendentes;
- botao `Continuar execucao`.

## Testes executados

Comandos:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name add_service_order_checklist_execution
npm run smoke:checklist
npm run smoke:roles
npm run lint
npm run build
```

Resultados:

- `npx prisma format`: passou.
- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npx prisma migrate dev --name add_service_order_checklist_execution`: falhou com `Schema engine error` no MySQL local `localhost:3306`.
- `npm run smoke:checklist`: passou.
- `npm run smoke:roles`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.

## Cobertura do smoke de checklist

Validado:

- OWNER cria template, aplica template, cria item, edita, atribui, inicia, conclui, valida, reabre e ve historico.
- GERENTE cria, edita, atribui, conclui, valida e reabre.
- SUPERVISOR_OBRA ve checklist da propria obra, nao ve outro supervisor, atribui equipe propria, nao atribui fora da equipe, conclui com foto, valida, reabre, bloqueia e desbloqueia.
- COLABORADOR ve checklist da propria obra, nao ve outra obra, nao altera checklist geral, nao valida, nao reabre, inicia e conclui tarefa propria habilitada.
- seguranca contra usuario sem autenticacao, item de outra OS, colaborador fora da equipe, URL de foto invalida, conclusao duplicada, reabertura sem motivo e perfil sem permissao.

## Limitacoes

- As rotas continuam usando o store em memoria, seguindo o padrao atual do projeto. O schema, migration e seed estao prontos para persistencia Prisma real.
- `migrate dev` ainda nao aplica no MySQL local por falha do schema engine.
- O upload binario real ficou preparado via interface, mas esta etapa valida e persiste metadados/URLs locais.
- A tela de checklist cobre a operacao principal, mas ainda pode evoluir para upload com progresso real, drag-and-drop e galeria ampliada.
- O modulo completo de almoxarifado nao foi implementado, conforme escopo.

## Proximos passos

- Corrigir o MySQL local e aplicar as migrations.
- Migrar `src/lib/store.ts` para repositorios Prisma reais.
- Implementar upload binario real usando o `StorageProvider`.
- Integrar materiais, produtos, maquinas e equipamentos as etapas do checklist.
- Adicionar testes E2E visuais com Playwright para desktop, tablet, celular, tema claro e tema escuro.
