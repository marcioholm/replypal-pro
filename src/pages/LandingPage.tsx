import { useState, type FormEvent } from "react";
import { 
  Inbox, 
  Clock, 
  Users, 
  Bot, 
  ChevronDown, 
  ChevronUp, 
  GraduationCap, 
  Briefcase, 
  Network
} from "lucide-react";
import placarData from "../data/placar.json";

function Logo() {
  return (
    <div className="flex items-center gap-1.5 font-bold text-xl tracking-tight">
      <div className="w-8 h-8 rounded-[8px] bg-brand-blue text-white flex items-center justify-center font-extrabold text-2xl leading-none pt-0.5 shadow-sm">
        +
      </div>
      <div className="text-[#0C2D5A] flex items-center">
        Conta<span className="text-brand-green font-extrabold">+</span>
      </div>
    </div>
  );
}

export default function App() {
  const [origem, setOrigem] = useState("topo");
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    escritorio: "",
    colaboradores: ""
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const formatWhatsApp = (value: string) => {
    const v = value.replace(/\D/g, "");
    const match = v.match(/^(\d{2})(\d{4,5})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, whatsapp: formatWhatsApp(e.target.value) });
  };

  const isFormValid = 
    form.nome.trim().length >= 2 && 
    form.whatsapp.replace(/\D/g, "").length >= 10 && 
    form.escritorio.trim() !== "" && 
    form.colaboradores !== "";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const saudacao = origem === "empreenda-hub" 
      ? "Olá! Quero ser escritório parceiro do Empreenda Hub com o Conta+." 
      : "Olá! Quero conhecer o Conta+.";

    const message = `${saudacao}\n\nNome: ${form.nome}\nWhatsApp: ${form.whatsapp}\nEscritório: ${form.escritorio}\nColaboradores: ${form.colaboradores}\n\nVim pela página do Conta+ (botão: ${origem})`;
    
    window.open(`https://wa.me/5542999896358?text=${encodeURIComponent(message)}`, "_blank");
  };

  const scrollToForm = (btnOrigem: string) => {
    setOrigem(btnOrigem);
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-bg-main flex flex-col font-sans text-text-main selection:bg-brand-action/20 selection:text-brand-dark overflow-x-hidden">
      
      {/* 1. Topo fixo */}
      <header className="fixed top-0 w-full bg-white/70 backdrop-blur-xl z-50 border-b border-gray-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="hover:opacity-70 transition-opacity duration-300 cursor-default">
            <Logo />
          </div>
          <div className="flex items-center gap-8">
            <a href="#empreenda-hub" className="hidden md:block text-xs font-semibold text-gray-800 hover:text-black transition-colors tracking-wide">
              Empreenda Hub
            </a>
            <button 
              onClick={() => scrollToForm("topo")}
              className="bg-black hover:bg-gray-800 text-white px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300"
            >
              Falar com a gente
            </button>
          </div>
        </div>
      </header>

      {/* 2. Abertura (Hero) */}
      <section className="pt-32 pb-16 px-6 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        <div className="mt-4 mb-6 inline-flex items-center gap-2 bg-[#f5f5f7] text-gray-900 px-4 py-2 rounded-full text-xs font-semibold">
          <span className="flex h-1.5 w-1.5 rounded-full bg-brand-green"></span>
          Cada escritório no Conta+ apoia o Empreenda Hub da ACEBRAZ.
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-[-0.02em] text-black max-w-4xl">
          O atendimento do seu escritório, <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-action to-blue-400">brilhantemente organizado.</span>
        </h1>
        <p className="mt-6 text-xl md:text-2xl text-gray-500 font-medium max-w-3xl tracking-tight">
          O Conta+ junta WhatsApp, prazos, documentos e financeiro em um só lugar. Feito por quem vive a contabilidade.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 w-full sm:w-auto">
          <button 
            onClick={() => scrollToForm("abertura")}
            className="w-full sm:w-auto bg-brand-action hover:bg-blue-600 text-white px-8 py-3.5 rounded-full text-base font-semibold transition-all duration-300 min-h-[44px]"
          >
            Conhecer o Conta+
          </button>
          <a href="#empreenda-hub" className="text-base font-medium text-brand-action hover:underline px-4 py-2 flex items-center gap-1">
            Como apoiamos o Empreenda Hub <ChevronDown size={16} className="-rotate-90" />
          </a>
        </div>

        <div className="mt-20 relative w-full max-w-5xl aspect-video md:aspect-[16/10] bg-[#f5f5f7] rounded-[40px] shadow-2xl overflow-hidden border border-gray-200">
          <img src="/tela-sistema.jpg" alt="Tela do sistema Conta+" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </section>

      {/* 3. Problema (Bento Box Minimalista) */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col gap-16">
          <h2 className="text-4xl md:text-5xl font-bold text-black text-center leading-tight tracking-tight max-w-3xl mx-auto">
            O WhatsApp no escritório não precisa ser o caos.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-[#f5f5f7] p-10 rounded-[32px] flex flex-col justify-between aspect-square md:aspect-auto">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6 font-bold text-xl">1</div>
              <h3 className="font-semibold text-2xl text-black leading-snug tracking-tight">
                Cada atendente no seu celular. Ninguém sabe o que foi prometido.
              </h3>
            </div>
            <div className="bg-[#f5f5f7] p-10 rounded-[32px] flex flex-col justify-between aspect-square md:aspect-auto">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6 font-bold text-xl">2</div>
              <h3 className="font-semibold text-2xl text-black leading-snug tracking-tight">
                A mensagem cai no celular de quem está de folga. O cliente espera horas.
              </h3>
            </div>
            <div className="bg-[#f5f5f7] p-10 rounded-[32px] flex flex-col justify-between aspect-square md:aspect-auto">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-6 font-bold text-xl">3</div>
              <h3 className="font-semibold text-2xl text-black leading-snug tracking-tight">
                Guias, extratos e faturamentos perdidos entre pastas e conversas.
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Solução (Bento Box Asimétrico) */}
      <section className="py-24 px-6 max-w-7xl mx-auto w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-black text-center leading-tight tracking-tight mb-16">
          Uma nova forma de trabalhar.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-[#f5f5f7] p-12 rounded-[40px] flex flex-col justify-between overflow-hidden relative">
            <div className="z-10 relative">
              <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-6">
                <Inbox size={28} strokeWidth={2} />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-black tracking-tight">Uma caixa de entrada para a equipe</h3>
              <p className="text-gray-600 font-medium leading-relaxed text-lg max-w-md">
                O WhatsApp do escritório num lugar só. A equipe aceita, transfere e encerra conversas. Tudo registrado.
              </p>
            </div>
          </div>
          <div className="bg-[#f5f5f7] p-12 rounded-[40px] flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-brand-action text-white flex items-center justify-center mb-6">
              <Clock size={28} strokeWidth={2} />
            </div>
            <h3 className="text-3xl font-bold mb-4 text-black tracking-tight">Prazos visíveis</h3>
            <p className="text-gray-600 font-medium leading-relaxed text-lg">
              Cada conversa tem um prazo. O sistema avisa antes de o cliente reclamar.
            </p>
          </div>
          <div className="bg-[#f5f5f7] p-12 rounded-[40px] flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-brand-green text-white flex items-center justify-center mb-6">
              <Users size={28} strokeWidth={2} />
            </div>
            <h3 className="text-3xl font-bold mb-4 text-black tracking-tight">Carteira de clientes</h3>
            <p className="text-gray-600 font-medium leading-relaxed text-lg">
              Regime, contatos, documentos e faturamento de cada empresa organizados.
            </p>
          </div>
          <div className="md:col-span-2 bg-[#f5f5f7] p-12 rounded-[40px] flex flex-col justify-between overflow-hidden relative">
            <div className="z-10 relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center mb-6">
                <Bot size={28} strokeWidth={2} />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-black tracking-tight">Assistente de IA Integrada</h3>
              <p className="text-gray-600 font-medium leading-relaxed text-lg max-w-md">
                Respostas sugeridas, mensagens agendadas e relatórios diários de atendimento direto da base de dados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Como funciona */}
      <section className="py-24 px-6 max-w-7xl mx-auto w-full text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-black mb-20 tracking-tight">Como funciona a contratação.</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 text-center">
          <div className="flex flex-col items-center">
            <div className="text-2xl font-semibold text-gray-400 mb-4">01</div>
            <p className="font-semibold text-black text-xl leading-tight">Preencha o formulário e fale no WhatsApp.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl font-semibold text-gray-400 mb-4">02</div>
            <p className="font-semibold text-black text-xl leading-tight">Entendemos como seu escritório atende hoje.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl font-semibold text-gray-400 mb-4">03</div>
            <p className="font-semibold text-black text-xl leading-tight">Mostramos o Conta+ com seus casos reais.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl font-semibold text-gray-400 mb-4">04</div>
            <p className="font-semibold text-black text-xl leading-tight">Implantamos e treinamos a sua equipe.</p>
          </div>
        </div>
      </section>

      {/* 6. Empreenda Hub (Dark Mode Apple Style) */}
      <section id="empreenda-hub" className="py-32 px-6 bg-black text-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center mb-24">
            <h2 className="text-5xl md:text-7xl font-bold leading-tight tracking-[-0.02em] mb-8">
              Educação que<br />transforma.
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 font-medium leading-relaxed max-w-3xl mx-auto">
              O Empreenda Hub forma jovens empreendedores em Wenceslau Braz. Todo escritório que contrata o Conta+ vira empresa parceira, fomentando inovação na raiz.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-[#1c1c1e] p-10 rounded-[32px]">
              <GraduationCap className="w-10 h-10 text-white mb-6" strokeWidth={1.5} />
              <h3 className="font-semibold text-2xl mb-3 tracking-tight">Formação</h3>
              <p className="text-gray-400 font-medium text-lg leading-relaxed">Encontros mensais sobre MEI, precificação, digital e finanças.</p>
            </div>
            <div className="bg-[#1c1c1e] p-10 rounded-[32px]">
              <Briefcase className="w-10 h-10 text-white mb-6" strokeWidth={1.5} />
              <h3 className="font-semibold text-2xl mb-3 tracking-tight">Vivência</h3>
              <p className="text-gray-400 font-medium text-lg leading-relaxed">Jovens conhecem as empresas parceiras resolvendo um desafio real.</p>
            </div>
            <div className="bg-[#1c1c1e] p-10 rounded-[32px]">
              <Network className="w-10 h-10 text-white mb-6" strokeWidth={1.5} />
              <h3 className="font-semibold text-2xl mb-3 tracking-tight">Networking</h3>
              <p className="text-gray-400 font-medium text-lg leading-relaxed">Encontros trimestrais para apresentação de projetos a empresários.</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-16 items-center bg-[#1c1c1e] rounded-[40px] p-12 lg:p-16">
            <div className="flex-1">
              <h3 className="font-bold text-4xl mb-6 tracking-tight">Faça parte.</h3>
              <p className="text-gray-400 text-xl font-medium leading-relaxed mb-10">
                Parte da assinatura do Conta+ vai para o Hub, apoiando a formação de novos empreendedores, e o escritório participa ativamente do programa.
              </p>
              <button 
                onClick={() => scrollToForm("empreenda-hub")}
                className="bg-white hover:bg-gray-200 text-black px-8 py-3.5 rounded-full text-lg font-semibold transition-all duration-300"
              >
                Quero ser parceiro
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <img src="/empreenda-logo.png" alt="Empreenda Hub Logo" className="w-full max-w-[300px] h-auto mb-8" />
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2 tracking-tight">Em breve</div>
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Lançamento da primeira turma</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Perguntas Frequentes */}
      <section className="py-32 px-6 max-w-4xl mx-auto w-full">
        <h2 className="text-4xl md:text-5xl font-bold text-center text-black mb-16 tracking-tight">Perguntas frequentes.</h2>
        <div className="flex flex-col border-t border-gray-200">
          {[
            { 
              q: "Quanto custa?", 
              a: "Depende do tamanho da equipe e de como o escritório atende. Por isso a gente conversa antes." 
            },
            { 
              q: "Quantas pessoas podem usar?", 
              a: "Toda a equipe, com perfis de admin, supervisor, atendente e recepção." 
            },
            { 
              q: "Como funciona a parceria com o Empreenda Hub?", 
              a: "Parte da assinatura vai para o programa, apoiando diretamente a formação de jovens de Wenceslau Braz." 
            }
          ].map((faq, i) => (
            <div key={i} className="border-b border-gray-200 py-6">
              <button 
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left flex justify-between items-center font-semibold text-2xl text-black hover:text-gray-600 transition-colors"
                aria-expanded={openFaq === i}
              >
                {faq.q}
                {openFaq === i ? <ChevronUp size={24} className="text-gray-400" /> : <ChevronDown size={24} className="text-gray-400" />}
              </button>
              <div className={`pt-4 text-gray-500 text-lg font-medium pr-12 ${openFaq === i ? 'block' : 'hidden'}`}>
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Formulário */}
      <section id="contato" className="py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-black mb-4 tracking-tight">Vamos conversar.</h2>
            <p className="text-xl text-gray-500 font-medium">Preencha rapidamente para continuarmos pelo WhatsApp.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <input 
                id="nome"
                type="text"
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl border border-gray-300 focus:border-brand-action focus:ring-1 focus:ring-brand-action outline-none transition-all font-medium text-black bg-white"
                placeholder="Seu nome"
                required
                minLength={2}
              />
              {form.nome.length > 0 && form.nome.length < 2 && <span className="text-xs text-red-500 font-semibold pl-2">Mínimo de 2 letras.</span>}
            </div>

            <div className="flex flex-col gap-2">
              <input 
                id="whatsapp"
                type="tel"
                value={form.whatsapp}
                onChange={handlePhoneChange}
                className="w-full px-5 py-4 rounded-2xl border border-gray-300 focus:border-brand-action focus:ring-1 focus:ring-brand-action outline-none transition-all font-medium text-black bg-white"
                placeholder="Seu WhatsApp"
                required
                maxLength={15}
              />
              {form.whatsapp.length > 0 && form.whatsapp.replace(/\D/g, "").length < 10 && <span className="text-xs text-red-500 font-semibold pl-2">Telefone inválido.</span>}
            </div>

            <div className="flex flex-col gap-2">
              <input 
                id="escritorio"
                type="text"
                value={form.escritorio}
                onChange={e => setForm({ ...form, escritorio: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl border border-gray-300 focus:border-brand-action focus:ring-1 focus:ring-brand-action outline-none transition-all font-medium text-black bg-white"
                placeholder="Nome do escritório"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="relative">
                <select 
                  id="colaboradores"
                  value={form.colaboradores}
                  onChange={e => setForm({ ...form, colaboradores: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl border border-gray-300 focus:border-brand-action focus:ring-1 focus:ring-brand-action outline-none transition-all font-medium text-black appearance-none bg-white"
                  required
                >
                  <option value="" disabled>Colaboradores no escritório</option>
                  <option value="1 a 3">1 a 3</option>
                  <option value="4 a 10">4 a 10</option>
                  <option value="11 a 25">11 a 25</option>
                  <option value="Mais de 25">Mais de 25</option>
                </select>
                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              </div>
            </div>

            <div className="pt-6 flex flex-col items-center gap-4">
              <button 
                type="submit"
                disabled={!isFormValid}
                className="w-full bg-brand-action hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300"
              >
                Falar no WhatsApp
              </button>
              <p className="text-sm text-gray-500 font-medium text-center">
                Seus dados serão enviados na mensagem do WhatsApp.
              </p>
            </div>
          </form>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="py-12 px-6 bg-white border-t border-gray-200 text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="opacity-50 grayscale scale-90 origin-left">
              <Logo />
            </div>
            <div className="text-xs font-medium text-center md:text-left flex flex-col gap-1">
              <span>Conta+ · [RESPONSÁVEL] · CNPJ: 56.745.517/0001-64</span>
              <span>Desenvolvido por <a href="https://www.northwaycompany.com.br/" target="_blank" rel="noreferrer" className="underline hover:text-black transition-colors">Northway Company</a></span>
            </div>
          </div>
          <div>
            <a href="/privacidade" className="text-xs font-semibold hover:text-black transition-colors">
              Política de privacidade
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
