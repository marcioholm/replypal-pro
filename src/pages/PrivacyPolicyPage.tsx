import { ContaMaisLogo } from "@/components/brand/ContaMaisLogo";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans">
      {/* Top Header */}
      <header className="fixed top-0 w-full bg-white/70 backdrop-blur-xl z-50 border-b border-gray-200/50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/conheca" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/conta-mais-logo.png" alt="Conta+" className="h-8 w-auto object-contain" />
          </a>
          <a 
            href="/conheca" 
            className="text-xs font-semibold text-gray-700 hover:text-black transition-colors px-4 py-2 rounded-full border border-gray-200 bg-white"
          >
            ← Voltar ao início
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        <div className="bg-white rounded-[32px] p-8 md:p-14 shadow-sm border border-gray-200/80">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-action bg-blue-50 px-3 py-1.5 rounded-full inline-block mb-4">
            Transparência & Conformidade LGPD
          </span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-black mb-6">
            Política de Privacidade
          </h1>
          <p className="text-sm text-gray-500 mb-10 pb-6 border-b border-gray-100">
            Última atualização: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · CNPJ: 56.745.517/0001-64
          </p>

          <div className="space-y-8 text-gray-700 leading-relaxed text-base">
            <section>
              <h2 className="text-xl font-bold text-black mb-3">1. Visão Geral</h2>
              <p>
                O <strong>Conta+</strong> valoriza a segurança, privacidade e confidencialidade das informações de todos os seus usuários, clientes e parceiros. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos os dados pessoais tratados na plataforma, em total conformidade com a <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black mb-3">2. Dados Coletados</h2>
              <p className="mb-2">Ao interagir com nosso site e utilizar a plataforma Conta+, podemos coletar os seguintes dados:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li><strong>Dados de contato e identificação:</strong> Nome completo, número de WhatsApp, e-mail institucional ou comercial, e nome da empresa ou escritório contábil.</li>
                <li><strong>Dados operacionais da contabilidade:</strong> Mensagens trafegadas pelo canal do WhatsApp integrado, anexos fiscais e societários enviados voluntariamente pelos usuários do sistema.</li>
                <li><strong>Dados de navegação e técnicos:</strong> Endereço IP, registros de acesso, identificadores de sessão e cookies estritamente necessários para a autenticação e segurança.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black mb-3">3. Finalidade do Tratamento de Dados</h2>
              <p className="mb-2">Os dados tratados pela plataforma têm como finalidades exclusivas:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li>Centralizar e organizar o fluxo de conversas, prazos e atendimentos fiscais entre escritórios e seus clientes;</li>
                <li>Fornecer suporte técnico e aprimorar a usabilidade e desempenho da ferramenta;</li>
                <li>Cumprir obrigações legais, regulatórias ou ordens judiciais pertinentes ao setor de tecnologia e comunicações.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black mb-3">4. Segurança das Informações</h2>
              <p>
                Adotamos rigorosos padrões de segurança da informação, incluindo criptografia ponta a ponta nas transmissões, controle estrito de acessos com autenticação protegida e armazenamento em servidores em nuvem de alta confiabilidade.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black mb-3">5. Seus Direitos (LGPD)</h2>
              <p className="mb-2">
                Conforme previsto no Artigo 18 da LGPD, o titular dos dados tem o direito de requisitar a qualquer momento:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-600">
                <li>Confirmação da existência de tratamento e acesso aos dados;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Eliminação dos dados pessoais tratados com o seu consentimento, resguardadas as exigências de guarda legal.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black mb-3">6. Contato com o Encarregado de Dados (DPO)</h2>
              <p>
                O responsável e encarregado pelo tratamento de dados pessoais (DPO) é <strong>Marcio Holm</strong>. Para exercer seus direitos ou tirar dúvidas relacionadas a esta Política de Privacidade, entre em contato com nossa equipe pelo canal oficial de suporte no WhatsApp ou através dos canais de atendimento indicados no rodapé da plataforma.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 bg-white border-t border-gray-200 text-gray-500 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/conta-mais-logo.png" alt="Conta+" className="h-6 w-auto object-contain" />
            <span>· CNPJ: 56.745.517/0001-64</span>
            <span>· Responsável: Marcio Holm</span>
          </div>
          <div>
            Desenvolvido por <a href="https://www.northwaycompany.com.br/" target="_blank" rel="noreferrer" className="underline hover:text-black">Northway Company</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
