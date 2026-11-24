# Remediação de segurança — 24/11/2026

Base auditada: 4cebfb2. As alterações são compatíveis com o snapshot atual (coleção revokedSessions começa vazia). Nenhuma migração destrutiva ou alteração manual de registros reais.

- SEC-01: replay de áudio e mídia exige obra, vínculo e visibilidade atuais; replay de mídia também exige o mesmo arquivo; texto e consolidação consultam a política de visibilidade.
- SEC-02: JWTs novos têm identificador aleatório; logout persiste hash do token revogado até expirar, sem revogar outros dispositivos. A autorização server-side rejeita o token revogado. Não inclui MFA nem painel de dispositivos.
- OP-01: PNG da assinatura validado por estrutura, CRC, descompressão limitada, dimensões do canvas e área de traço. Imagem não comprova identidade ou autoria; aceite continua baseado no código de acompanhamento.
- SEC-03: valores decimais monetários sem símbolo são ocultados também nos títulos; buscas usam projeção autorizada. Filtragem textual não garante proteção de toda forma de dado livre; separar campos financeiros permanece necessário.
- SEC-04: diário do almoxarifado e payload inicial do PWA usam filtro financeiro e de advertências.
- IA-01: barreira determinística adicional para negações explícitas, simulação e perguntas; não é compreensão semântica perfeita. Comandos legítimos podem exigir reformulação.
- 114 testes automatizados aprovados, TypeScript e ESLint aprovados. Provedores externos simulados.

Pendências: migração relacional com backup/restauração verificados, teste de carga, MFA, política CSP completa testada em navegador, autenticação mais forte do aceite do cliente, análise semântica integral dos diários com privacidade, integração OpenAI real, offline transacional, reconciliação de arquivos órfãos, monitoramento e governança das cópias Git. Não alegar homologação total. Não alterar banco real sem plano de migração e recuperação.
