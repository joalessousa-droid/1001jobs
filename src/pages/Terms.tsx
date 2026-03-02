import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="max-w-3xl mx-auto px-6 pt-28 pb-16 prose prose-sm prose-neutral dark:prose-invert">
      <h1 className="font-display">Termos de Uso</h1>
      <p className="text-muted-foreground">Última atualização: 2 de março de 2026</p>

      <h2>1. Aceitação dos Termos</h2>
      <p>Ao acessar e utilizar a plataforma 1001JOBS, você concorda com estes Termos de Uso. Caso não concorde, não utilize a plataforma.</p>

      <h2>2. Descrição do Serviço</h2>
      <p>A 1001JOBS é uma plataforma que conecta clientes a profissionais prestadores de serviços. Não somos parte nas negociações entre usuários.</p>

      <h2>3. Cadastro</h2>
      <p>Para utilizar a plataforma, é necessário criar uma conta com informações verdadeiras e mantê-las atualizadas.</p>

      <h2>4. Responsabilidades</h2>
      <p>Cada usuário é responsável pelas informações fornecidas, pela qualidade dos serviços prestados e pelo cumprimento dos agendamentos.</p>

      <h2>5. Propriedade Intelectual</h2>
      <p>Todo o conteúdo da plataforma, incluindo marca, layout e código, é de propriedade da 1001JOBS.</p>

      <h2>6. Modificações</h2>
      <p>Reservamo-nos o direito de alterar estes termos a qualquer momento. As alterações entram em vigor após publicação.</p>
    </main>
    <Footer />
  </div>
);

export default Terms;
