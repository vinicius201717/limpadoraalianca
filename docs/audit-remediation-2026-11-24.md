# Remediação da auditoria — 24/11/2026

## Escopo desta versão
- FIN-01: referências de recebimentos ativas são únicas, inclusive entre parcelas; sem referência, repetição idêntica na mesma parcela é recusada. Despesas e criação de parcelas aceitam identificador de reenvio usado pelo frontend.
- FIN-02: estorno de recebimento altera comprovante vinculado para REVERSED e documento para ARCHIVE. Novos registros não podem baixar o mesmo comprovante estornado.
- FIN-03: formulário envia motivo obrigatório do ajuste e trata falhas de rede.
- FIN-04: despesas administrativas sem obra usam centro de custo e livro próprio; recebimento ainda requer parcela vinculada.
- FIN-05: mesmo valor não equivale a mesma despesa; escolha explícita de nova despesa distinta no painel ou conciliação de lançamento existente.
- FIN-06: link de arquivo no histórico usa rota financeira do comprovante.
- IA: confirmação da baixa vinculada ao usuário, versão da sessão, versão do comprovante, valor e validade de 15 minutos; análise malsucedida permite reprocessamento manual e revisão.
- Estoque: arquivamento preserva vínculos, exclusão em massa bloqueada, custos protegidos por permissão financeira, criação/alteração/arquivamento auditados, código de máquina único.
- Performance: listagem financeira paginada, alvos de conciliação restritos à página, chamadas privadas sem sessão rejeitadas antes de ler o snapshot, contexto financeiro da IA limitado.
- Qualidade: correção ESLint, dependência effect atualizada na cadeia Prisma via override 3.22.5, sem downgrade de Prisma. Testar instalação limpa antes do release.
- PWA: reenvios de texto e comprovante preservam nonce durante a tentativa; alerta de fechamento enquanto gravação/envio em curso. Não há garantia de persistência offline.

## Limites e pendências de homologação
Não foi aplicada migração de produção e não se presume acesso ao backup ou ao painel de credenciais. A API real da OpenAI continua pendente por decisão do responsável. Não se deve executar cargas ou pagamentos fictícios na base real.

### Gate 1 — banco
1. Confirmar provedor real (Supabase/Postgres ou Prisma/MySQL) e disponibilidade de projeto de homologação isolado.
2. Executar backup criptografado com o script existente, manter chave separada e validar restauração em banco vazio.
3. Mapear todas as coleções do app_state e invariantes, inclusive vínculos, ledger, arquivos privados, histórico, auditoria e identificadores externos.
4. Criar tabelas/índices e constraints em homologação: idempotência por usuário/operação, referência de recebimento ativo única, relações com ON DELETE RESTRICT, movimentos de estoque imutáveis.
5. Migrar cópia e comparar contagens, somas monetárias em centavos, saldos, referências, chaves e registros órfãos. Não substituir a base original.
6. Testar concorrência e falhas em cada domínio, definir plano de corte e retorno, aprovar janela de manutenção. Só então migrar em produção.

### Gate 2 — confiabilidade operacional
- Fila durável de envios offline com escopo de conta, expiração e retenção, sem reexecutar automaticamente comandos financeiros antigos.
- Fila de trabalhos IA com tentativas, estados e orçamento por função; reprocessamento automático apenas quando houver worker confiável.
- Notificações de baixa, estorno e pendência; filtros e histórico paginado de todas as áreas.
- MFA para perfis privilegiados, política LGPD, segregação de leitura/aprovação após definir a matriz de negócios.
- Observabilidade: logs sem dados sensíveis, alertas de 5xx/409/429, p95 e p99 por rota e fila, alertas de falha de backup, testes em dispositivos reais.
- Testes de carga 10/25/50/100 clientes em base isolada e tamanho representativo. Medir latências e taxa de conflitos; não extrapolar testes unitários para capacidade real.

### Gate 3 — OpenAI (pendente)
Validar configurações reais, modelos disponíveis, faturamento, leitura de PDF e foto, áudio, falhas, precisão e custos; nenhuma transação real em teste.

### Expansão de produto (não faz parte de correção de bugs)
Ponto, logística, manutenção preventiva, gestão de caixa completa, análise gerencial e indicadores de produtividade. Cada módulo precisa de regras de negócio e critérios de aceitação.
