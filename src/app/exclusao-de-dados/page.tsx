import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Exclusão de Dados | Aliança Limpeza e Restauração",
  description: "Como solicitar revisão, desvinculação do WhatsApp e exclusão de dados pessoais.",
};
const contactUrl = "https://wa.me/5562991434343?text=" + encodeURIComponent("Olá, solicito informações sobre a exclusão de meus dados pessoais no sistema Aliança.");
export default function DataDeletionPage() {
  return (
    <main style={{ background: "#f5f8fc", minHeight: "100vh", padding: "48px 18px", color: "#14273c", lineHeight: 1.7 }}>
      <article style={{ maxWidth: 800, margin: "auto", background: "#fff", borderRadius: 16, padding: "clamp(22px, 5vw, 48px)" }}>
        <Link href="/" style={{ color: "#007da3" }}>Aliança Limpeza e Restauração</Link>
        <h1>Solicitação de exclusão de dados</h1>
        <p>Os titulares de dados tratados no site, no sistema Aliança ou no Assistente WhatsApp podem solicitar revisão, correção e exclusão de informações pessoais, quando aplicável.</p>
        <h2>Como solicitar</h2>
        <ol>
          <li><a href={contactUrl} style={{ color: "#007da3" }} target="_blank" rel="noopener noreferrer">Entre em contato com o atendimento da Aliança</a> pelo WhatsApp (62) 99143-4343.</li>
          <li>Informe que deseja tratar de privacidade e indique quais dados ou vinculações precisam ser revisados. Não envie senhas nem códigos de autenticação.</li>
          <li>O responsável poderá solicitar a confirmação de identidade e avaliar os registros que podem ser eliminados, corrigidos ou que precisam ser conservados para obrigações legais e execução contratual.</li>
        </ol>
        <h2>Desvincular o Assistente WhatsApp</h2>
        <p>Usuários habilitados podem remover o vínculo no próprio sistema acessando <Link href="/assistente-whatsapp" style={{ color: "#007da3" }}>Assistente WhatsApp</Link> com sua conta. Também podem solicitar a desvinculação à administração da Aliança. A remoção do número não implica automaticamente exclusão do histórico necessário à operação de serviços.</p>
        <h2>Mais informações</h2>
        <p>Leia a <Link href="/politica-de-privacidade" style={{ color: "#007da3" }}>Política de Privacidade</Link>.</p>
      </article>
    </main>
  );
}
