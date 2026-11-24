# Reauditoria dos relatórios gerenciais — 24/11/2026

Base anterior: e5d2c7c. Alterações verificadas com fixtures isoladas e provedores simulados; nenhum lançamento de produção foi criado, alterado ou excluído. O objetivo desta entrega é corrigir riscos prioritários, não certificar ausência de falhas.

| ID | Resultado da reauditoria |
|---|---|
| R01 | Reproduzido e corrigido: obras em atraso entram na posição atual mesmo com agenda antiga. |
| R02 | Reproduzido e corrigido: recebimentos e estornos pelas próprias datas; movimentos vinculados a obras antigas incluídos. |
| R03 | Mitigado por arquitetura: saída do modelo restrita à seleção de IDs de achados calculados; números e recomendações vêm do backend. Saída inventada rejeitada em teste simulado. Não é validação semântica de narrativa livre. |
| R04 | Caso reproduzido corrigido: títulos e campos livres recebem projeção e redação, valores estruturados bloqueados por perfil. Redação de texto livre não garante anonimização absoluta. |
| R05 | A IA gerencial recebe somente métricas, contagens e candidatos estruturados, não texto bruto de diário, imagens, nomes ou documentos. Rota antiga de obra gera resumo local sem IA. |
| R06 | Parcial: todas as linhas das seções são percorridas para contagens e regras estruturadas (401/401 no teste), sem amostragem de linhas nessas contagens. Não há processamento semântico integral de relatos em lotes nem análise de arquivos. |
| R07 | Corrigido: filtro completo inclui agenda futura explicitamente. |
| R08 | Corrigido: itens de obras canceladas fora dos indicadores atuais de checklist. |
| R09 | Corrigido para eventos disponíveis: conclusão histórica não desaparece após reabertura. Legado sem evento/autoria não pode ser reconstruído integralmente. |
| R10 | Corrigido para recebimentos/estornos: autoria filtrada; saldo da parcela é contexto, não desempenho atribuível ao gerente. |
| R11 | Mitigado: identificador de solicitação, claim concorrente persistido e replay sem nova chamada; limite por usuário. Clientes antigos sem identificador não têm replay garantido; após perda da resposta, consultar histórico. |
| R12 | Parcial: cap de 1.000 análises por usuário e expiração de marcadores técnicos; sem exclusão automática de relatórios. Arquivamento de longo prazo em armazenamento separado pendente. |
| R13 | Intervalo de datas personalizado validado por backend. |
| R14 | Consolidado por departamento com seções deduplicadas e dados administrativos adicionais; indicadores de unidades diferentes não somados. |
| R15 | Parcial: impressão A4 pelo navegador (salvar em PDF), CSV da página de dados compatível com Excel e Markdown. Não são exportações nativas PDF/XLSX completas. |
| R16 | Formas femininas, relatório geral e pedido de obra atual sem obra selecionada corrigidos; comando usa ID exato quando disponível. Teste de áudio real pendente. |
| R17 | Parcial: projeção preguiçosa da seção solicitada, sem reconstruir as demais linhas a cada paginação; base ainda usa snapshot JSON central, sem benchmark concorrente/índices relacionais. |
| R18 | Parcial: tokens retornados pelo provedor e modelo registrados; não há estimativa de cobrança real nem painel de custo. |
| R19 | Revisão por autor e aprovação/rejeição por outro dono, com identidade, data e motivo auditados; teste de papéis aprovado. |
| R20 | Deve ser verificado no domínio público após deploy e promoção. |

## Testes
- 108 testes automatizados passaram, incluindo três novos cenários de regressão cobrindo múltiplas falhas e atualizações dos testes do relatório e da rota legada.
- TypeScript sem erros após as alterações finais.
- ESLint e npm audit --omit=dev (zero vulnerabilidades) aprovados durante a remediação; repetir lint no estado final.
- Os resultados do provedor são simulados. Não foi realizado teste de carga em produção, teste real com créditos OpenAI, revisão visual em dispositivo móvel, ou comprovação da precisão de transcrição real.

## Decisão de arquitetura
A versão prioriza segurança: a IA ordena achados determinísticos e o backend constrói a narrativa de fatos e plano de ação. O dashboard continua mostrando registros autorizados. Textos livres não são transmitidos para análise semântica externa. Relatórios anteriores de narrativa livre são legados e não equivalem a relatórios homologados. Os indicadores adicionais usam eventos efetivamente disponíveis e explicitam lacunas.

## Próximos passos
Homologar chamada real com dados fictícios, teste de carga e concorrência, ampliar indicadores com histórico de horas/custos e implementar análise semântica em lotes com política de privacidade aprovada, exportação integral nativa, retenção/arquivamento e observabilidade de custo.
