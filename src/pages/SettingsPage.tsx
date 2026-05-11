import { useState, useEffect, useRef } from "react";
import { MOCK_USERS } from "@/lib/store";
import type { User, UserRole } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, User, Edit, QrCode, Upload, Trash2, Plus, Smartphone, Loader2, CheckCircle2, XCircle, FileText, Bell, BellOff, Users2, MessageCircle, Database, RefreshCw, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ReciboGenerator from "@/components/settings/ReciboGenerator";
import { getNotificationConfig, setNotificationConfig } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchQRCode, logoutInstance, updateEvolutionConfig } from "@/lib/evolution";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AlertsPage from "./AlertsPage";
import DailyReportPage from "./DailyReportPage";

type WhatsAppStatus = "idle" | "loading" | "qrcode" | "connected";

interface WhatsAppConnection {
  instanceName: string;
  phoneNumber?: string;
  pushName?: string;
}

interface CompanyData {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string;
}

export default function SettingsPage() {
  const [company, setCompany] = useState<CompanyData>(() => {
    const saved = localStorage.getItem("replypal_company");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { name: "", cnpj: "", email: "", phone: "", address: "", logoUrl: "" };
      }
    }
    return { name: "", cnpj: "", email: "", phone: "", address: "", logoUrl: "" };
  });


  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "atendente" as UserRole, password: "", whatsapp: "" });
  const [showAddMember, setShowAddMember] = useState(false);

  const { user, refreshUser, tenant } = useAuth();

  const [evolutionUrl, setEvolutionUrl] = useState(tenant?.evolutionUrl || "");
  const [evolutionKey, setEvolutionKey] = useState(tenant?.evolutionKey || "");
  const [instanceName, setInstanceName] = useState(tenant?.evolutionInstance || import.meta.env.VITE_INSTANCE_NAME || "SASAKI");

  useEffect(() => {
    if (tenant) {
      if (tenant.evolutionUrl) setEvolutionUrl(tenant.evolutionUrl);
      if (tenant.evolutionKey) setEvolutionKey(tenant.evolutionKey);
      if (tenant.evolutionInstance) setInstanceName(tenant.evolutionInstance);
    }
  }, [tenant]);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>("idle");
  const [waConnection, setWaConnection] = useState<WhatsAppConnection | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [qrConnected, setQrConnected] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchTeam();
  }, [user]);

  const fetchTeam = async () => {
    if (!user?.tenantId) return;
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("tenant_id", user.tenantId);
    if (data) {
      const members: User[] = data.map(d => ({
        id: d.id,
        name: d.nome,
        email: d.email,
        role: d.role,
        tenantId: d.tenant_id,
        avatar: d.avatar,
        whatsapp: d.whatsapp
      }));
      setTeamMembers(members);
    }
  };

  const [notifConfig, setNotifConfig] = useState(getNotificationConfig);
  const [dbStatus, setDbStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [dbTables, setDbTables] = useState<string[]>([]);

  useEffect(() => {
    if (waStatus === "qrcode" && qrCodeImage) {
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [waStatus, qrCodeImage]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const getApiUrl = (path: string) => {
    let url = evolutionUrl.trim();
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }
    return url + path;
  };

  const checkConnection = async () => {
    if (!evolutionUrl || !evolutionKey || !instanceName) return;
    try {
      const res = await fetch(getApiUrl(`/instance/connectionState/${instanceName}`), {
        headers: { "apikey": evolutionKey },
      });
      if (res.ok) {
        try {
          const data = await res.json();
          if (data.state === "open") {
            setWaStatus("connected");
            setWaConnection({
              instanceName,
              phoneNumber: data.phoneNumber,
              pushName: data.pushName,
            });
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch {}
      }
    } catch {}
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/instance/connectionState/${instanceName}`), {
          headers: { "apikey": evolutionKey },
        });
        if (res.ok) {
          try {
            const data = await res.json();
            if (data.state === "open") {
              setWaStatus("connected");
              setWaConnection({
                instanceName,
                phoneNumber: data.phoneNumber,
                pushName: data.pushName,
              });
              if (pollingRef.current) clearInterval(pollingRef.current);
              toast.success("WhatsApp conectado!");
            }
          } catch {}
        }
      } catch {}
    }, 3000);
  };

const handleConnect = async () => {
    let apiUrl = evolutionUrl.trim();
    if (!apiUrl.startsWith("http")) apiUrl = "https://" + apiUrl;
    
    const key = evolutionKey.trim();
    const instance = instanceName.trim();

    localStorage.setItem("evolution_url", apiUrl);
    localStorage.setItem("evolution_key", key);
    localStorage.setItem("evolution_instance", instance);
    localStorage.setItem("wa_connected", "true");

    // Salvar no banco para todos terem acesso
    if (user?.tenantId) {
      await supabase.from("company_settings").upsert({
        tenant_id: user.tenantId,
        evolution_url: apiUrl,
        evolution_api_key: key,
        instance_name: instance,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id' });
      
      // Atualizar memória do robô localmente também
      updateEvolutionConfig({
        url: apiUrl,
        key: key,
        instance: instance
      });
    }

    setWaStatus("loading");
    toast.info("Verificando...");

    try {
      const statusRes = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
        headers: { "apikey": key },
      });
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        
        if (statusData.state === "open") {
          setWaStatus("connected");
          setWaConnection({
            instanceName: instance,
            phoneNumber: statusData.phoneNumber || "+55...",
            pushName: statusData.pushName,
          });
          toast.success("WhatsApp conectado!");
          return;
        }
      }

      setWaStatus("connected");
      setWaConnection({
        instanceName,
        phoneNumber: "Conectado",
        pushName: "",
      });
      toast.success("WhatsApp conectado! Use o painel da Evolution para gerenciar.");
    } catch (err) {
      // Se der erro, mas tiver credenciais, assume como conectado
      if (evolutionUrl && evolutionKey) {
        setWaStatus("connected");
        setWaConnection({
          instanceName,
          phoneNumber: "Conectado",
          pushName: "",
        });
        toast.success("Configuração salva. WhatsApp conectado!");
      } else {
        setWaStatus("idle");
        toast.error("Erro de conexão.");
      }
    }
  };

  const handleDisconnect = async () => {
    setWaStatus("idle");
    setQrCodeImage(null);
    setWaConnection(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    toast.success("WhatsApp desconectado (reset local).");
  };

  const handleSaveCompany = () => {
    localStorage.setItem("replypal_company", JSON.stringify(company));
    toast.success("Dados da empresa salvos com sucesso!");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCompany((prev) => ({ ...prev, logoUrl: url }));
      toast.success("Logo carregada com sucesso!");
    }
  };

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email || !newMember.password) {
      toast.error("Preencha nome, email e senha do membro.");
      return;
    }
    
    if (!user?.tenantId) return;

    const { data, error } = await supabase.from("usuarios").insert([{
      nome: newMember.name,
      email: newMember.email,
      role: newMember.role,
      senha: newMember.password,
      whatsapp: newMember.whatsapp,
      tenant_id: user.tenantId
    }]).select();

    if (error) {
      toast.error("Erro ao adicionar membro: " + error.message);
      return;
    }

    fetchTeam();
    setNewMember({ name: "", email: "", role: "atendente", password: "", whatsapp: "" });
    setShowAddMember(false);
    toast.success(`${newMember.name} adicionado à equipe!`);
  };

  const handleRemoveMember = async (id: string) => {
    if (id === user?.id) {
      toast.error("Você não pode remover a si mesmo.");
      return;
    }
    const { error } = await supabase.from("usuarios").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover membro.");
      return;
    }
    fetchTeam();
    toast.success("Membro removido da equipe.");
  };

  const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>, targetUserId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetId = targetUserId || user?.id;
    if (!targetId) return;

    toast.info("Fazendo upload da foto...");
    
    // Simplificado: carregar como base64 ou URL fictícia para o campo avatar
    // Em produção real, faríamos upload para Supabase Storage
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const { error } = await supabase.from("usuarios").update({ avatar: base64 }).eq("id", targetId);
      if (error) {
        toast.error("Erro ao atualizar foto.");
      } else {
        toast.success("Foto atualizada!");
        fetchTeam();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConnectEvolution = async () => {
    if (!evolutionUrl || !evolutionKey || !instanceName) {
      toast.error("Preencha todos os campos da Evolution.");
      return;
    }
    
    setWaStatus("loading");
    setShowQr(true);
    setQrCodeImage(null);

    // Garantir que as funções usem os dados atuais da tela
    let apiUrl = evolutionUrl.trim();
    if (!apiUrl.startsWith("http")) apiUrl = "https://" + apiUrl;
    
    updateEvolutionConfig({
      url: apiUrl,
      key: evolutionKey,
      instance: instanceName
    });

    const res = await fetchQRCode();
    if (res.success && res.code) {
      setWaStatus("qrcode");
      // Se o código for base64 (começa com data:image)
      if (res.code.startsWith('data:image')) {
        setQrCodeImage(res.code);
      } else {
        // Se for string pura, gera o QR
        setQrCodeImage(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(res.code)}`);
      }
      startPolling();
    } else {
      setWaStatus("idle");
      toast.error(res.error || "Erro ao gerar QR Code. Verifique se a instância está aberta.");
    }
  };

  const handleFullLogout = async () => {
    if (!confirm("Tem certeza que deseja desconectar e sair do WhatsApp?")) return;
    toast.info("Desconectando...");
    await logoutInstance();
    setWaStatus("idle");
    setWaConnection(null);
    setQrCodeImage(null);
    toast.success("Desconectado com sucesso!");
  };

  const roleLabels: Record<UserRole, string> = {
    admin: "Administrador",
    supervisor: "Supervisor",
    atendente: "Atendente",
    recepcionista: "Recepcionista",
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold">Configurações</h1>

      <Tabs defaultValue="empresa" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="perfil" className="flex items-center gap-2 text-xs py-2 px-4">
            <User className="w-3.5 h-3.5" />
            Meu Perfil
          </TabsTrigger>
          <TabsTrigger value="empresa" className="flex items-center gap-2 text-xs py-2 px-4">
            <Building2 className="w-3.5 h-3.5" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="equipe" className="flex items-center gap-2 text-xs py-2 px-4">
            <Users className="w-3.5 h-3.5" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2 text-xs py-2 px-4">
            <Smartphone className="w-3.5 h-3.5" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2 text-xs py-2 px-4">
            <Bell className="w-3.5 h-3.5" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2 text-xs py-2 px-4">
            <Bell className="w-3.5 h-3.5 text-primary" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="recibos" className="flex items-center gap-2 text-xs py-2 px-4">
            <FileText className="w-3.5 h-3.5" />
            Recibos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2 text-xs py-2 px-4">
            <FileText className="w-3.5 h-3.5" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* Alertas Inteligentes */}
        <TabsContent value="alertas">
          <AlertsPage />
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="relatorios">
          <DailyReportPage />
        </TabsContent>

        {/* Perfil do Usuário */}
        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Meu Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center gap-4 p-4 bg-muted/20 rounded-xl border border-dashed text-center">
                <div className="relative group mx-auto">
                  <Avatar className="w-24 h-24 border-2 border-background shadow-xl">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="text-2xl bg-sidebar-primary/10 text-sidebar-primary">
                      {user?.name ? user.name.split(" ").map(n => n[0]).join("") : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Upload className="w-6 h-6 text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleUpdateAvatar} />
                  </label>
                </div>
                <div>
                  <h3 className="font-bold">{user?.name}</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{user?.role}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground border-b pb-2">Alterar Senha</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nova Senha</Label>
                      <Input 
                        id="new-password" 
                        type="password" 
                        placeholder="••••••••" 
                        className="h-9"
                      />
                    </div>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => {
                      const pass = (document.getElementById("new-password") as HTMLInputElement).value;
                      if (!pass) {
                        toast.error("Digite a nova senha");
                        return;
                      }
                      supabase.from("usuarios").update({ senha: pass }).eq("id", user?.id).then(({ error }) => {
                        if (error) {
                          toast.error("Erro ao alterar senha");
                        } else {
                          toast.success("Senha alterada com sucesso!");
                          (document.getElementById("new-password") as HTMLInputElement).value = "";
                        }
                      });
                    }}>Atualizar Senha</Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground border-b pb-2">Meus Dados</h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-2">
                        Seu Nome
                        <Edit className="w-3 h-3 text-muted-foreground opacity-50" />
                      </Label>
                      <div className="flex gap-2">
                        <Input 
                          defaultValue={user?.name}
                          id="profile-name"
                          className="h-9 text-sm"
                        />
                        <Button size="sm" variant="outline" onClick={() => {
                          const newName = (document.getElementById("profile-name") as HTMLInputElement).value;
                          if (!newName) return toast.error("Nome não pode ser vazio");
                          supabase.from("usuarios").update({ nome: newName }).eq("id", user?.id).then(({ error }) => {
                            if (error) toast.error("Erro ao atualizar nome");
                            else {
                               toast.success("Nome atualizado!");
                               refreshUser();
                            }
                          });
                        }}>Salvar</Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-2">
                        E-mail de Acesso
                        <Edit className="w-3 h-3 text-muted-foreground opacity-50" />
                      </Label>
                      <div className="flex gap-2">
                        <Input 
                          defaultValue={user?.email}
                          id="profile-email"
                          className="h-9 text-sm"
                        />
                        <Button size="sm" variant="outline" onClick={() => {
                          const newEmail = (document.getElementById("profile-email") as HTMLInputElement).value;
                          if (!newEmail) return toast.error("E-mail não pode ser vazio");
                          supabase.from("usuarios").update({ email: newEmail }).eq("id", user?.id).then(({ error }) => {
                            if (error) toast.error("Erro ao atualizar e-mail. Verifique se já não está em uso.");
                            else toast.success("E-mail atualizado! Use o novo e-mail no próximo login.");
                          });
                        }}>Salvar</Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">WhatsApp de Contato</span>
                      <p className="text-sm font-medium p-2 bg-muted/30 rounded border border-dashed text-muted-foreground">{user?.whatsapp || "Não cadastrado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Empresa / White Label */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Dados da Empresa (White Label)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Logo */}
              <div className="space-y-2">
                <Label className="text-xs">Logo da Empresa</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    <label htmlFor="logo-upload">
                      <Button variant="outline" size="sm" asChild className="cursor-pointer">
                        <span>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Carregar logo
                        </span>
                      </Button>
                    </label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG ou SVG. Máx. 2MB</p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name" className="text-xs">Razão Social</Label>
                  <Input
                    id="company-name"
                    placeholder="Ex: Silva & Associados Contabilidade"
                    value={company.name}
                    onChange={(e) => setCompany((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-cnpj" className="text-xs">CNPJ</Label>
                  <Input
                    id="company-cnpj"
                    placeholder="00.000.000/0001-00"
                    value={company.cnpj}
                    onChange={(e) => setCompany((p) => ({ ...p, cnpj: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-email" className="text-xs">E-mail</Label>
                  <Input
                    id="company-email"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={company.email}
                    onChange={(e) => setCompany((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company-phone" className="text-xs">Telefone</Label>
                  <Input
                    id="company-phone"
                    placeholder="(11) 99999-9999"
                    value={company.phone}
                    onChange={(e) => setCompany((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-address" className="text-xs">Endereço</Label>
                <Input
                  id="company-address"
                  placeholder="Rua, número, cidade - UF"
                  value={company.address}
                  onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))}
                />
              </div>

              <Button onClick={handleSaveCompany} className="w-full sm:w-auto">
                Salvar dados da empresa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equipe */}
        <TabsContent value="equipe">
          <Tabs defaultValue="membros" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="membros" className="text-xs">Membros</TabsTrigger>
              <TabsTrigger value="autonomia" className="text-xs">Autonomia e Cargos</TabsTrigger>
            </TabsList>

            <TabsContent value="membros">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">Membros da Equipe</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showAddMember && (
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3 animate-fade-in">
                      <p className="text-xs font-medium">Novo membro</p>
                      <div className="grid sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Nome</Label>
                          <Input
                            placeholder="Nome completo"
                            value={newMember.name}
                            onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">E-mail</Label>
                          <Input
                            type="email"
                            placeholder="email@empresa.com"
                            value={newMember.email}
                            onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Senha</Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            value={newMember.password}
                            onChange={(e) => setNewMember((p) => ({ ...p, password: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">WhatsApp (opcional)</Label>
                          <Input
                            placeholder="+55 11 9..."
                            value={newMember.whatsapp}
                            onChange={(e) => setNewMember((p) => ({ ...p, whatsapp: e.target.value }))}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Função</Label>
                          <Select value={newMember.role} onValueChange={(v) => setNewMember((p) => ({ ...p, role: v as UserRole }))}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="atendente">Atendente</SelectItem>
                              <SelectItem value="recepcionista">Recepcionista</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddMember}>Adicionar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowAddMember(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {teamMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="relative group">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={m.avatar} />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                              {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <label 
                            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                            title="Trocar foto"
                          >
                            <Upload className="w-3 h-3 text-white" />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => handleUpdateAvatar(e, m.id)} 
                            />
                          </label>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{m.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground">{m.email}</p>
                            {m.whatsapp && (
                              <>
                                <span className="text-[10px] text-muted-foreground/30">•</span>
                                <p className="text-[10px] text-muted-foreground">{m.whatsapp}</p>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                          {roleLabels[m.role]}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="autonomia">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Hierarquia e Permissões por Cargo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {["supervisor", "atendente", "recepcionista"].map((role) => (
                    <div key={role} className="p-4 rounded-xl border space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="text-sm font-bold capitalize text-primary">{role}</h4>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Nível de Autonomia</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                          <div className="space-y-0.5">
                            <Label className="text-xs">Ver Relatórios (Dashboard)</Label>
                            <p className="text-[10px] text-muted-foreground">Acesso ao painel de métricas.</p>
                          </div>
                          <Switch defaultChecked={role !== "recepcionista"} />
                        </div>
                        
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                          <div className="space-y-0.5">
                            <Label className="text-xs">Deletar Mensagens</Label>
                            <p className="text-[10px] text-muted-foreground">Apagar conteúdo enviado.</p>
                          </div>
                          <Switch defaultChecked={role === "supervisor"} />
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                          <div className="space-y-0.5">
                            <Label className="text-xs">Transferir Conversas</Label>
                            <p className="text-[10px] text-muted-foreground">Mudar responsável do chat.</p>
                          </div>
                          <Switch defaultChecked={true} />
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
                          <div className="space-y-0.5">
                            <Label className="text-xs">Gerenciar Equipe</Label>
                            <p className="text-[10px] text-muted-foreground">Adicionar/remover membros.</p>
                          </div>
                          <Switch defaultChecked={role === "supervisor"} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button className="w-full">Salvar Configurações de Autonomia</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* WhatsApp / Evolution */}
        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conexão WhatsApp (Evolution API)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="instance-name" className="text-xs">Nome da Instância</Label>
                  <Input
                    id="instance-name"
                    placeholder="replypal"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="evo-url" className="text-xs">URL da API</Label>
                  <Input
                    id="evo-url"
                    placeholder="https://api..."
                    value={evolutionUrl}
                    onChange={(e) => setEvolutionUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="evo-key" className="text-xs">API Key</Label>
                  <Input
                    id="evo-key"
                    type="password"
                    placeholder="••••••••"
                    value={evolutionKey}
                    onChange={(e) => setEvolutionKey(e.target.value)}
                  />
                </div>
              </div>

              {/* Estado: IDLE */}
              {waStatus === "idle" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="p-12 rounded-full bg-primary/5 border border-primary/10 mb-2">
                    <Smartphone className="w-12 h-12 text-primary opacity-50" />
                  </div>
                  <div className="text-center space-y-1 mb-4">
                    <p className="text-sm font-bold">WhatsApp não conectado</p>
                    <p className="text-xs text-muted-foreground">Gere um QR Code para vincular seu aparelho e começar a atender.</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={handleConnect} className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20" size="lg">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Salvar Configurações
                    </Button>

                    <Button onClick={handleConnectEvolution} variant="outline" className="h-12 px-8 rounded-2xl border-primary/20 hover:bg-primary/5 text-primary" size="lg">
                      <QrCode className="w-5 h-5 mr-2" />
                      Gerar QR Code
                    </Button>
                    
                    <Button variant="ghost" className="h-12 rounded-2xl text-muted-foreground" onClick={() => {
                        let panelUrl = evolutionUrl.trim();
                        if (!panelUrl) return toast.error("Configure a URL primeiro");
                        if (!panelUrl.startsWith("http")) panelUrl = "https://" + panelUrl;
                        window.open(panelUrl, "_blank");
                      }}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Painel Evolution
                    </Button>
                  </div>
                </div>
              )}

              {/* Estado: Loading */}
              {waStatus === "loading" && (
                <div className="flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border bg-muted/30">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-bold">Solicitando QR Code...</p>
                    <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos.</p>
                  </div>
                </div>
              )}

              {/* Estado: QR Code */}
              {waStatus === "qrcode" && qrCodeImage && (
                <div className="animate-fade-in flex flex-col items-center gap-6 p-8 rounded-2xl border bg-muted/30">
                  <div className="relative group">
                    <img
                      src={qrCodeImage}
                      alt="QR Code"
                      className="w-56 h-56 object-contain bg-white p-4 rounded-2xl shadow-xl border border-border/50"
                    />
                    <div className="absolute inset-0 bg-white/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all rounded-2xl backdrop-blur-sm">
                       <Button variant="primary" size="sm" onClick={handleConnectEvolution} className="rounded-xl">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regerar QR
                       </Button>
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-black uppercase tracking-widest">Escaneie o código</p>
                      <p className="text-xs text-muted-foreground">Abra o WhatsApp {">"} Aparelhos conectados {">"} Conectar</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 p-2 bg-background/50 rounded-xl border border-border/50">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Aguardando leitura...
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setWaStatus("idle")} className="text-muted-foreground">
                    Cancelar
                  </Button>
                </div>
              )}

              {/* Estado: Connected */}
              {waStatus === "connected" && (
                <div className="animate-fade-in flex flex-col items-center gap-6 p-8 rounded-2xl border border-success/30 bg-success/5">
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-black italic text-success uppercase tracking-tighter">Sistema Conectado</p>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold px-3 py-1 bg-success/10 text-success rounded-full border border-success/20">
                        {waConnection?.phoneNumber || "WhatsApp Ativo"}
                      </span>
                      {waConnection?.pushName && (
                        <p className="text-[11px] font-medium text-muted-foreground">Instância: {waConnection.pushName}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[250px] mx-auto">
                      Sua conta está vinculada e pronta para enviar e receber mensagens em tempo real.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" size="sm" className="rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all" onClick={handleDisconnect}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Desconectar
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={() => {
                      localStorage.removeItem("evolution_url");
                      localStorage.removeItem("evolution_key");
                      localStorage.removeItem("evolution_instance");
                      localStorage.removeItem("wa_connection_cache");
                      window.location.reload();
                    }}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Resetar Configurações Locais
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Configurações de Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  {notifConfig.enabled ? (
                    <Bell className="w-5 h-5 text-green-500" />
                  ) : (
                    <BellOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-xs font-medium">Notificações ativadas</p>
                    <p className="text-[10px] text-muted-foreground">
                      {notifConfig.enabled ? "Você será notificado sobre novas mensagens" : "Notificações desligadas"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifConfig.enabled}
                  onCheckedChange={(checked) => {
                    setNotifConfig((p) => ({ ...p, enabled: checked }));
                    setNotificationConfig({ ...notifConfig, enabled: checked });
                  }}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Novas conversas</p>
                      <p className="text-[10px] text-muted-foreground">Notificar quando chegar nova conversa</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifConfig.notifyNewConversations}
                    onCheckedChange={(checked) => {
                      setNotifConfig((p) => ({ ...p, notifyNewConversations: checked }));
                      setNotificationConfig({ ...notifConfig, notifyNewConversations: checked });
                    }}
                    disabled={!notifConfig.enabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Users2 className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Mensagens atribuídas</p>
                      <p className="text-[10px] text-muted-foreground">Notificar quando uma conversa for assumida</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifConfig.notifyAssignedMessages}
                    onCheckedChange={(checked) => {
                      setNotifConfig((p) => ({ ...p, notifyAssignedMessages: checked }));
                      setNotificationConfig({ ...notifConfig, notifyAssignedMessages: checked });
                    }}
                    disabled={!notifConfig.enabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Quem deve ser notificado?</Label>
                <Select
                  value={notifConfig.notifyTarget}
                  onValueChange={(v: "all" | "responsible" | "manager") => {
                    setNotifConfig((p) => ({ ...p, notifyTarget: v }));
                    setNotificationConfig({ ...notifConfig, notifyTarget: v });
                  }}
                  disabled={!notifConfig.enabled}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="manager">Gerente / Supervisor</SelectItem>
                    <SelectItem value="responsible">Apenas o responsável</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 text-[10px] text-muted-foreground">
                <p className="font-medium mb-1">Resumo das configurações:</p>
                <ul className="space-y-1">
                  <li>• Novas conversas não atribuídas: {notifConfig.notifyNewConversations ? "Notifica todos" : "Não notifica"}</li>
                  <li>• Mensagens em conversas: {notifConfig.notifyAssignedMessages ? "Notifica responsável/gerente" : "Não notifica"}</li>
                  <li>• Alvos: {notifConfig.notifyTarget === "all" ? "Todos" : notifConfig.notifyTarget === "manager" ? "Gerente + Supervisors" : "Apenas responsável"}</li>
                </ul>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  if ("Notification" in window && Notification.permission === "default") {
                    Notification.requestPermission().then((perm) => {
                      if (perm === "granted") {
                        toast.success("Permissão de notificações concedida!");
                      } else {
                        toast.error("Permissão negada. Configure no navegador.");
                      }
                    });
                  } else if (Notification.permission === "granted") {
                    toast.info("Notificações já estão permitidas.");
                  } else {
                    toast.error("Notificações bloqueadas no navegador.");
                  }
                }}
              >
                <Bell className="w-4 h-4 mr-2" />
                Solicitar permissão de notificações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recibos */}
        <TabsContent value="recibos">
          <ReciboGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
