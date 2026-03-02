import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Privacy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="max-w-3xl mx-auto px-6 pt-28 pb-16 prose prose-sm prose-neutral dark:prose-invert">
      <h1 className="font-display">Política de Privacidade</h1>
      <p className="text-muted-foreground">Última atualização: 2 de março de 2026</p>

      <h2>1. Dados Coletados</h2>
      <p>Coletamos nome, e-mail, telefone, localização e dados de uso para viabilizar o funcionamento da plataforma.</p>

      <h2>2. Uso dos Dados</h2>
      <p>Seus dados são utilizados para criar sua conta, exibir perfis, facilitar agendamentos e enviar notificações relevantes.</p>

      <h2>3. Compartilhamento</h2>
      <p>Não vendemos seus dados. Informações de perfil público são visíveis a outros usuários conforme a natureza da plataforma.</p>

      <h2>4. Armazenamento e Segurança</h2>
      <p>Utilizamos criptografia e práticas de segurança padrão de mercado para proteger seus dados.</p>

      <h2>5. Seus Direitos</h2>
      <p>Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais entrando em contato conosco.</p>

      <h2>6. Cookies</h2>
      <p>Utilizamos cookies essenciais para autenticação e funcionamento da plataforma.</p>
    </main>
    <Footer />
  </div>
);

export default Privacy;
