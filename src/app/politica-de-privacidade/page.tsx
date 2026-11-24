import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade | Aliança Limpeza e Restauração",
  description: "Informações sobre o tratamento de dados no sistema de gestão e no Assistente de Campo da Aliança.",
};

const contactUrl = "https://wa.me/5562991434343?text=" + encodeURIComponent("Olá, quero falar com a Aliança sobre privacidade e meus dados pessoais.");

const sectionStyle = { paddingTop: 18, borderTop: "1px solid #dce5ec", marginTop: 22 } as const;

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f8fc", color: "#14273c", padding: "40px 18px", lineHeight: 1.7 }}>
      <article style={{ maxWidth: 840, margin: "0 auto", padding: "32px clamp(18px, 5vw, 50px)", borderRadius: 16, background: "white", boxShadow: "0 8px 36px #10234212" }}>
        <Link href="/" style={{ color: "#0d6b83", fontWeight: 700 }}>Aliança Limpeza e Restauração</Link>
        <h1 style={{ marginBottom: 8, lineHeight: 1.15 }}>Política de Privacidade</h1>
        <p style={{ color: "#496079" }}>Última atualização: 24 de novembro de 2026</p>
        <p>A Aliança Limpeza e Restauração, localizada na Avenida Bela Vista, 957, Jardim Bela Vista, Goiânia/GO, disponibiliza um site e um sistema de gestão operacional, incluindo a funcionalidade Assistente de Campo. Esta política descreve como essas ferramentas tratam dados pessoais e como solicitar informações, correções ou exclusão.</p>

        <section style={sectionStyle}>
          <h2>1. Dados que podem ser tratados</h2>
          <p>Conforme a funcionalidade utilizada, o sistema pode tratar dados de identificação e contato de clientes, funcionários e prestadores de serviços; informações de obras e atendimentos; atribuições de trabalho, registros de checklist e históricos operacionais; fotos e documentos fornecidos; e dados técnicos de acesso e auditoria.</p>
          <p>Para usuários do Assistente de Campo, são tratados relatos escritos, áudio e transcrições, fotos, vídeos, descrições geradas com apoio de inteligência artificial, vínculo com a obra e autoria do registro. Esses conteúdos não dependem de WhatsApp.</p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Finalidades de uso</h2>
          <p>Utilizamos os dados para organizar atendimentos e obras, acompanhar serviços, atribuir atividades a pessoas autorizadas, manter históricos e evidências operacionais, responder solicitações e proteger as contas contra acesso indevido. No assistente, os dados são usados para interpretar instruções, produzir respostas e registrar ações permitidas pelo perfil autenticado.</p>
        </section>

        <section style={sectionStyle}>
          <h2>3. Assistente de Campo e inteligência artificial</h2>
          <p>O Assistente de Campo exige autenticação no sistema e respeito às permissões da obra e do perfil. Os relatos são associados à conta autenticada, à obra selecionada e à data de registro. Áudios podem ser transcritos e fotos ou quadros de vídeo podem receber descrições automáticas. Relatórios são gerados a partir de históricos autorizados, com possibilidade de imprecisões que devem ser conferidas.</p>
          <p>Para essa operação, conforme o recurso utilizado, pode haver processamento por prestadores de infraestrutura e tecnologia, incluindo OpenAI (serviços de inteligência artificial), Vercel (hospedagem) e Supabase (armazenamento e banco de dados). Esse processamento é limitado às finalidades do sistema e às configurações dos respectivos serviços.</p>
        </section>

        <section style={sectionStyle}>
          <h2>4. Compartilhamento e proteção</h2>
          <p>O acesso às informações operacionais é condicionado ao perfil e às permissões de cada usuário. O sistema utiliza autenticação, restrições de acesso e mecanismos de verificação de requisições e registros. Informações podem ser compartilhadas com prestadores tecnológicos apenas na medida necessária à operação ou para cumprimento de obrigações legais.</p>
        </section>

        <section style={sectionStyle}>
          <h2>5. Prazo de conservação</h2>
          <p>Os registros são conservados pelo período necessário à prestação dos serviços, à manutenção de históricos de obra, à segurança, ao exercício de direitos e ao cumprimento de obrigações aplicáveis. O prazo pode variar conforme a categoria do dado e a finalidade. Quando cabível, informações poderão ser excluídas ou anonimizadas após avaliação da solicitação.</p>
        </section>

        <section style={sectionStyle}>
          <h2>6. Direitos dos titulares e solicitação de exclusão</h2>
          <p>Você pode solicitar informações sobre o tratamento de seus dados, acesso, correção, atualização ou exclusão, quando aplicável, nos termos da legislação brasileira de proteção de dados. Informe sua relação com a Aliança e quais informações deseja revisar. A empresa poderá solicitar comprovação de identidade antes de atender pedidos que envolvam dados pessoais.</p>
          <p>A revisão ou exclusão de registros do Assistente de Campo pode ser solicitada à administração. Alguns históricos operacionais poderão ser conservados quando necessários para execução de serviços ou obrigações aplicáveis. Vínculos antigos de uma integração anteriormente testada também podem ser objeto de solicitação.</p>
          <p><Link href="/exclusao-de-dados" style={{ color: "#007da3", fontWeight: 700 }}>Ver instruções detalhadas para solicitar exclusão de dados</Link>.</p>
        </section>

        <section style={sectionStyle}>
          <h2>7. Contato</h2>
          <p>Para questões relacionadas a privacidade e dados pessoais, contate a Aliança pelo <a href={contactUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#007da3" }}>canal de atendimento ao cliente no WhatsApp</a> (62) 99143-4343, informando que o assunto é proteção de dados. Também é possível tratar solicitações com a administração da empresa pelos canais internos utilizados no relacionamento com ela.</p>
          <p>Endereço informado no site: Avenida Bela Vista, 957, Jardim Bela Vista, Goiânia/GO.</p>
        </section>

        <section style={sectionStyle}>
          <h2>8. Atualizações</h2>
          <p>Esta política pode ser atualizada para refletir mudanças no funcionamento do site, do sistema ou na legislação. A versão vigente fica disponível neste endereço.</p>
        </section>
        <p style={{ marginTop: 35 }}><Link href="/" style={{ color: "#007da3" }}>Voltar ao site da Aliança</Link></p>
      </article>
    </main>
  );
}
