# Aliança Campo — avisos e checklist

## Lembretes
Os horários iniciais em America/Sao_Paulo são 09h andamento, 12h organização de materiais, 15h atualização, 16h conferência de encerramento. Configure FIELD_REMINDER_HOURS (quatro horas inteiras entre 6 e 20). O sistema considera obras ativas atribuídas ao supervisor, não exige dia útil se houver obra programada no fim de semana. Obras em execução que ultrapassaram o prazo continuam recebendo lembretes. Itens bloqueados, prazos de tarefas vencidos e mudanças financeiras também geram avisos conforme o perfil. A central consulta a base a cada 90 segundos enquanto a página estiver visível. Avisos programados são calculados no dia corrente, não constituem comprovação de organização ou presença.

## Push real
O arquivo vercel.json agenda chamadas diárias, uma por hora das 06h às 20h BRT, em UTC, em caminhos distintos para compatibilidade com frequência diária por cron. Em planos com maior precisão pode ser substituído por um cron de 15 minutos; não há garantia de entrega instantânea. A rota fica inativa sem credenciais. A chave VAPID pública é enviada ao navegador; as privadas ficam exclusivamente no servidor. O push tem texto genérico sem nomes, valores ou detalhes privados, e abre a central de avisos ao tocar. As inscrições são limitadas a cinco dispositivos por conta, vinculadas à versão da sessão; desativação remove inscrição, logout no dashboard tenta cancelar no dispositivo; endpoints expirados são removidos. O job agrupa até dez avisos por dispositivo, até 50 dispositivos por execução, com reserva persistente, deduplicação e até três tentativas de envio. Push é best-effort: interrupção entre envio e confirmação pode levar a nova entrega, e o sistema operacional controla a apresentação. O histórico de entrega é limitado a 14 dias; alertas importantes são elegíveis por 24h, lembretes por duas horas.

### Ativação
- O administrador precisa configurar FIELD_VAPID_PUBLIC_KEY, FIELD_VAPID_PRIVATE_KEY, FIELD_VAPID_SUBJECT e CRON_SECRET em Production na Vercel. FIELD_REMINDER_HOURS é opcional.
- Para novas chaves, executar localmente `node scripts/field-push-setup.mjs https://limpadoraalianca.vercel.app` (cria .env.push.local, ignorado pelo Git). Se já houver VAPID/CRON_SECRET, preservar os existentes; não rotacionar sem planejamento.
- A credencial de acesso à Vercel utilizada nesta sessão foi recusada (403) tanto para listar quanto para criar variáveis. Nenhum segredo foi publicado no repositório.
- Redeploy após salvar as variáveis e, em cada dispositivo, abrir o sino e tocar em Ativar notificações no celular; no iOS/iPadOS 16.4+ instalar o PWA na tela inicial primeiro.
- Validar entrega real com dispositivo autorizado; testes locais usam transporte simulado, não enviam mensagens reais.

## Checklist conversacional
A consulta lista itens reais da obra autorizada, em ordem de checklist, com estado e responsáveis. A consulta de pendências exclui itens concluídos e cancelados. O resultado é salvo em uma resposta separada na conversa. Pedidos de consulta comuns em português são tratados localmente, sem depender da API OpenAI. Para linguagem livre adicional e áudio, o fluxo usa classificação e transcrição da OpenAI já integradas ao backend; homologação com credenciais reais permanece pendente. Nunca conclui um item apenas porque o supervisor consultou o checklist.

## Pendências
Teste de push real em Android/iOS e configuração de produção; integração real OpenAI; melhorias estruturais de banco, escala, offline e filas permanecem no plano de auditoria anterior.
