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
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-lg z-50 border-b border-gray-200/50 shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="hover:scale-105 transition-transform duration-300 cursor-default">
            <Logo />
          </div>
          <div className="flex items-center gap-6">
            <a href="#empreenda-hub" className="hidden md:block text-sm font-semibold text-text-muted hover:text-brand-action transition-colors">
              Empreenda Hub
            </a>
            <button 
              onClick={() => scrollToForm("topo")}
              className="bg-brand-action hover:bg-brand-blue text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
            >
              Falar com a gente
            </button>
          </div>
        </div>
      </header>

      {/* 2. Abertura */}
      <section className="pt-32 pb-20 px-6 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center relative">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-brand-action/5 via-bg-main/0 to-transparent -z-10 pointer-events-none"></div>
        <div className="flex flex-col items-start gap-6">
          <h1 className="text-4xl lg:text-[54px] font-extrabold leading-[1.1] tracking-tight text-brand-dark">
            O atendimento do seu escritório contábil, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-action to-brand-blue">organizado</span>.
          </h1>
          <p className="text-lg text-text-muted leading-relaxed font-medium">
            O Conta+ junta as conversas do WhatsApp, os prazos de resposta, os documentos e os dados financeiros dos seus clientes num lugar só. Feito dentro de um escritório de contabilidade.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 w-full sm:w-auto">
            <button 
              onClick={() => scrollToForm("abertura")}
              className="w-full sm:w-auto bg-brand-action hover:bg-brand-blue text-white px-8 py-4 rounded-full text-base font-bold transition-all duration-300 shadow-lg shadow-brand-action/30 hover:shadow-xl hover:shadow-brand-action/40 hover:-translate-y-1 min-h-[44px]"
            >
              Quero conhecer o Conta+
            </button>
            <a href="#empreenda-hub" className="text-sm font-semibold text-brand-action hover:text-brand-blue hover:underline px-4 py-2 transition-colors">
              Como apoiamos o Empreenda Hub
            </a>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 bg-brand-action/5 text-brand-dark px-5 py-2.5 rounded-full text-sm font-bold border border-brand-action/10 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-brand-green"></span>
            Cada escritório no Conta+ apoia o Empreenda Hub da ACEBRAZ.
          </div>
        </div>
        <div className="relative w-full aspect-video md:aspect-[4/3] lg:aspect-square bg-white rounded-[20px] shadow-xl overflow-hidden border border-white/50">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-action/5 to-transparent"></div>
          <img src="/tela-sistema.png" alt="Tela do sistema Conta+" className="absolute inset-0 w-full h-full object-cover object-left-top" />
        </div>
      </section>

      {/* 3. Problema */}
      <section className="py-24 px-6 bg-white relative">
        <div className="max-w-5xl mx-auto flex flex-col gap-14 relative z-10">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-brand-dark text-center leading-tight max-w-3xl mx-auto">
            Se o seu escritório atende pelo WhatsApp, você conhece isso:
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-bg-main/50 hover:bg-bg-main p-8 rounded-[24px] border border-gray-100 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 font-bold text-lg">!</div>
              <p className="font-semibold text-text-main leading-relaxed">
                Cada atendente responde pelo próprio celular, e ninguém sabe o que o outro prometeu
              </p>
            </div>
            <div className="bg-bg-main/50 hover:bg-bg-main p-8 rounded-[24px] border border-gray-100 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 font-bold text-lg">!</div>
              <p className="font-semibold text-text-main leading-relaxed">
                O cliente espera horas porque a mensagem caiu no celular de quem estava de folga
              </p>
            </div>
            <div className="bg-bg-main/50 hover:bg-bg-main p-8 rounded-[24px] border border-gray-100 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 font-bold text-lg">!</div>
              <p className="font-semibold text-text-main leading-relaxed">
                A guia, o extrato e o faturamento do cliente ficam espalhados entre pasta, planilha e conversa
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Solução */}
      <section className="py-24 px-6 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[24px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-brand-action/5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-action/20 to-brand-action/5 text-brand-action flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Inbox size={28} strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-extrabold mb-3 text-brand-dark">Uma caixa de entrada para a equipe</h3>
            <p className="text-text-muted font-medium leading-relaxed text-lg">
              O WhatsApp do escritório num lugar só. A equipe aceita, transfere e encerra conversas, e tudo fica registrado.
            </p>
          </div>
          <div className="bg-white p-10 rounded-[24px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-brand-action/5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-action/20 to-brand-action/5 text-brand-action flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Clock size={28} strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-extrabold mb-3 text-brand-dark">Prazo de resposta visível</h3>
            <p className="text-text-muted font-medium leading-relaxed text-lg">
              Cada conversa tem um prazo. O sistema mostra o que está perto de estourar antes de o cliente reclamar.
            </p>
          </div>
          <div className="bg-white p-10 rounded-[24px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-brand-action/5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-action/20 to-brand-action/5 text-brand-action flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Users size={28} strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-extrabold mb-3 text-brand-dark">A carteira de clientes organizada</h3>
            <p className="text-text-muted font-medium leading-relaxed text-lg">
              Regime, situação financeira, contatos, documentos e faturamento mensal de cada empresa.
            </p>
          </div>
          <div className="bg-white p-10 rounded-[24px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-brand-action/5 group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-action/20 to-brand-action/5 text-brand-action flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <Bot size={28} strokeWidth={2} />
            </div>
            <h3 className="text-2xl font-extrabold mb-3 text-brand-dark">Assistente de IA e relatórios</h3>
            <p className="text-text-muted font-medium leading-relaxed text-lg">
              Respostas sugeridas, mensagens agendadas e relatório diário do atendimento, puxando direto da base.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Origem */}
      <section className="py-20 px-6 bg-gradient-to-r from-brand-action to-brand-blue text-white text-center shadow-inner">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Nasceu dentro de um escritório de contabilidade
          </h2>
          <p className="text-white/90 text-lg md:text-xl font-medium leading-relaxed">
            O Conta+ foi criado e é usado no dia a dia de um escritório de contabilidade. Cada tela resolve um problema que apareceu no atendimento de verdade.
          </p>
        </div>
      </section>

      {/* 6. Como funciona */}
      <section className="py-28 px-6 max-w-6xl mx-auto w-full relative">
        <h2 className="text-4xl font-extrabold text-center text-brand-dark mb-20">Como funciona a contratação</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 relative">
          <div className="hidden lg:block absolute top-6 left-[10%] right-[10%] h-0.5 bg-brand-action/10 z-0"></div>
          <div className="flex flex-col gap-6 relative z-10 items-center text-center group">
            <div className="w-14 h-14 rounded-full bg-white border-4 border-bg-main shadow-lg text-brand-dark font-extrabold flex items-center justify-center text-xl group-hover:scale-110 group-hover:bg-brand-action group-hover:text-white transition-all duration-300">1</div>
            <p className="font-bold text-text-main text-lg leading-relaxed">Você preenche o formulário e fala com a gente pelo WhatsApp</p>
          </div>
          <div className="flex flex-col gap-6 relative z-10 items-center text-center group">
            <div className="w-14 h-14 rounded-full bg-white border-4 border-bg-main shadow-lg text-brand-dark font-extrabold flex items-center justify-center text-xl group-hover:scale-110 group-hover:bg-brand-action group-hover:text-white transition-all duration-300">2</div>
            <p className="font-bold text-text-main text-lg leading-relaxed">Entendemos como o seu escritório atende hoje</p>
          </div>
          <div className="flex flex-col gap-6 relative z-10 items-center text-center group">
            <div className="w-14 h-14 rounded-full bg-white border-4 border-bg-main shadow-lg text-brand-dark font-extrabold flex items-center justify-center text-xl group-hover:scale-110 group-hover:bg-brand-action group-hover:text-white transition-all duration-300">3</div>
            <p className="font-bold text-text-main text-lg leading-relaxed">Mostramos o Conta+ funcionando com casos do seu dia a dia</p>
          </div>
          <div className="flex flex-col gap-6 relative z-10 items-center text-center group">
            <div className="w-14 h-14 rounded-full bg-white border-4 border-bg-main shadow-lg text-brand-dark font-extrabold flex items-center justify-center text-xl group-hover:scale-110 group-hover:bg-brand-action group-hover:text-white transition-all duration-300">4</div>
            <p className="font-bold text-text-main text-lg leading-relaxed">Implantamos e treinamos a sua equipe</p>
          </div>
        </div>
      </section>

      {/* 7. Empreenda Hub */}
      <section id="empreenda-hub" className="py-28 px-6 bg-brand-dark text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-action/20 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="max-w-3xl mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-8">
              Seu escritório no Conta+ fortalece quem está começando a empreender em Wenceslau Braz
            </h2>
            <p className="text-xl text-white/80 font-medium leading-relaxed">
              O Empreenda Hub é o programa da Associação Comercial de Wenceslau Braz que forma jovens empreendedores e aproxima esses jovens dos empresários da cidade. Todo escritório que contrata o Conta+ vira empresa parceira do programa.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <div className="bg-white/5 hover:bg-white/10 transition-colors duration-300 backdrop-blur-md border border-white/10 shadow-xl p-10 rounded-[24px]">
              <GraduationCap className="w-10 h-10 text-brand-green mb-6" strokeWidth={2} />
              <h3 className="font-extrabold text-2xl mb-3">Formação</h3>
              <p className="text-white/80 font-medium text-base leading-relaxed">Encontros mensais sobre como abrir um MEI, precificar, vender no digital e organizar o dinheiro.</p>
            </div>
            <div className="bg-white/5 hover:bg-white/10 transition-colors duration-300 backdrop-blur-md border border-white/10 shadow-xl p-10 rounded-[24px]">
              <Briefcase className="w-10 h-10 text-brand-green mb-6" strokeWidth={2} />
              <h3 className="font-extrabold text-2xl mb-3">Vivência</h3>
              <p className="text-white/80 font-medium text-base leading-relaxed">Jovens conhecem empresas parceiras por dentro e resolvem um desafio real.</p>
            </div>
            <div className="bg-white/5 hover:bg-white/10 transition-colors duration-300 backdrop-blur-md border border-white/10 shadow-xl p-10 rounded-[24px]">
              <Network className="w-10 h-10 text-brand-green mb-6" strokeWidth={2} />
              <h3 className="font-extrabold text-2xl mb-3">Networking</h3>
              <p className="text-white/80 font-medium text-base leading-relaxed">Encontro trimestral de empresários e jovens, com apresentação dos projetos.</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-16 items-center bg-white/5 border border-white/10 shadow-2xl rounded-[32px] p-10 lg:p-14 backdrop-blur-md">
            <div className="flex-1">
              <h3 className="font-extrabold text-3xl mb-6">Como o escritório participa</h3>
              <p className="text-white/90 text-lg font-medium leading-relaxed">
                Parte da assinatura do Conta+ vai para o Hub, apoiando a formação de novos empreendedores, e o escritório participa ativamente do programa.
              </p>
              <button 
                onClick={() => scrollToForm("empreenda-hub")}
                className="mt-10 bg-brand-green hover:bg-[#158f55] text-white px-8 py-4 rounded-full text-lg font-bold transition-all duration-300 shadow-lg hover:shadow-brand-green/30 hover:-translate-y-1 min-h-[44px]"
              >
                Quero ser parceiro
              </button>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
              <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-[20px] p-6 text-center border border-white/10">
                <div className="text-4xl font-extrabold text-brand-green mb-2">{placarData.participantes}</div>
                <div className="text-xs font-bold text-white/70 uppercase tracking-widest">Jovens Participantes</div>
              </div>
              <div className="bg-white/5 hover:bg-white/10 transition-colors rounded-[20px] p-6 text-center border border-white/10">
                <div className="text-4xl font-extrabold text-brand-green mb-2">{placarData.oficinas}</div>
                <div className="text-xs font-bold text-white/70 uppercase tracking-widest">Sessões Realizadas</div>
              </div>
              <div className="bg-brand-dark/50 rounded-xl p-4 text-center border border-white/5">
                <div className="text-3xl font-extrabold text-brand-green">{placarData.mentoria}h</div>
                <div className="text-xs font-semibold text-white/60 mt-1 uppercase tracking-wider">Horas de Mentoria</div>
              </div>
              <div className="bg-brand-dark/50 rounded-xl p-4 text-center border border-white/5">
                <div className="text-3xl font-extrabold text-brand-green">{placarData.negocios}</div>
                <div className="text-xs font-semibold text-white/60 mt-1 uppercase tracking-wider">Negócios Formalizados</div>
              </div>
              <div className="col-span-2 text-center text-xs text-white/40 mt-2">
                Primeira turma em {placarData.inicio}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Perguntas Frequentes */}
      <section className="py-24 px-6 max-w-3xl mx-auto w-full">
        <h2 className="text-3xl font-extrabold text-center text-brand-dark mb-12">Perguntas Frequentes</h2>
        <div className="flex flex-col gap-4">
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
            <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
              <button 
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-6 py-5 text-left flex justify-between items-center font-bold text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-action min-h-[44px]"
                aria-expanded={openFaq === i}
              >
                {faq.q}
                {openFaq === i ? <ChevronUp size={20} className="text-brand-action" /> : <ChevronDown size={20} className="text-brand-action" />}
              </button>
              <div className={`px-6 pb-5 text-text-muted font-medium ${openFaq === i ? 'block' : 'hidden'}`}>
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Formulário */}
      <section id="contato" className="py-24 px-6 bg-white border-t border-brand-action/10">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-brand-dark mb-4">Vamos conversar sobre o seu escritório</h2>
            <p className="text-text-muted font-medium">Preencha rapidamente para continuarmos pelo WhatsApp.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-bg-main p-8 rounded-[24px]">
            <div className="flex flex-col gap-2">
              <label htmlFor="nome" className="text-sm font-bold text-text-main">Seu nome</label>
              <input 
                id="nome"
                type="text"
                value={form.nome}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-transparent focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 outline-none transition-all font-medium text-text-main"
                placeholder="Como gosta de ser chamado"
                required
                minLength={2}
              />
              {form.nome.length > 0 && form.nome.length < 2 && <span className="text-xs text-red-500 font-semibold">Mínimo de 2 letras.</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="whatsapp" className="text-sm font-bold text-text-main">Seu WhatsApp</label>
              <input 
                id="whatsapp"
                type="tel"
                value={form.whatsapp}
                onChange={handlePhoneChange}
                className="w-full px-4 py-3 rounded-xl border border-transparent focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 outline-none transition-all font-medium text-text-main"
                placeholder="(00) 00000-0000"
                required
                maxLength={15}
              />
              {form.whatsapp.length > 0 && form.whatsapp.replace(/\D/g, "").length < 10 && <span className="text-xs text-red-500 font-semibold">Telefone inválido.</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="escritorio" className="text-sm font-bold text-text-main">Nome do escritório</label>
              <input 
                id="escritorio"
                type="text"
                value={form.escritorio}
                onChange={e => setForm({ ...form, escritorio: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-transparent focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 outline-none transition-all font-medium text-text-main"
                placeholder="Razão social ou nome fantasia"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="colaboradores" className="text-sm font-bold text-text-main">Colaboradores no escritório</label>
              <div className="relative">
                <select 
                  id="colaboradores"
                  value={form.colaboradores}
                  onChange={e => setForm({ ...form, colaboradores: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-transparent focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 outline-none transition-all font-medium text-text-main appearance-none bg-white"
                  required
                >
                  <option value="" disabled>Selecione uma opção</option>
                  <option value="1 a 3">1 a 3</option>
                  <option value="4 a 10">4 a 10</option>
                  <option value="11 a 25">11 a 25</option>
                  <option value="Mais de 25">Mais de 25</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={20} />
              </div>
            </div>

            <div className="pt-6 flex flex-col items-center gap-4">
              <button 
                type="submit"
                disabled={!isFormValid}
                className="w-full bg-brand-green hover:bg-[#158f55] disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed text-white px-8 py-4 rounded-full text-lg font-bold transition-all duration-300 shadow-lg hover:shadow-brand-green/30 hover:-translate-y-1 min-h-[44px]"
              >
                Falar no WhatsApp
              </button>
              <p className="text-sm text-text-muted font-medium text-center max-w-sm">
                Ao continuar, seus dados vão na mensagem do WhatsApp para a equipe do Conta+.
              </p>
            </div>
          </form>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="py-12 px-6 bg-brand-dark text-white/60">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="opacity-80 grayscale">
              <Logo />
            </div>
            <div className="text-sm font-medium text-center md:text-left">
              Conta+ · [RESPONSÁVEL] · CNPJ: [00.000.000/0000-00]
            </div>
          </div>
          <div>
            <a href="/privacidade" className="text-sm font-semibold hover:text-white transition-colors underline underline-offset-4">
              Política de privacidade
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
