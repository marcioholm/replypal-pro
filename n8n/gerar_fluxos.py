"""
Gera os fluxos do n8n do Conta+ (arquivos .json nesta pasta).
Rode:  python3 n8n/gerar_fluxos.py
Edite este arquivo (não os .json) quando precisar mudar um fluxo.
"""
import json
import os
import uuid

AQUI = os.path.dirname(os.path.abspath(__file__))

CRED_PG = {"postgres": {"id": "contaPostgres", "name": "Conta+ · Supabase (Postgres)"}}
CRED_OPENAI = {"httpHeaderAuth": {"id": "contaOpenAI", "name": "Conta+ · OpenAI"}}
CRED_SUPA = {"httpCustomAuth": {"id": "contaSupaService", "name": "Conta+ · Supabase service"}}
CRED_API = {"httpHeaderAuth": {"id": "contaApiInterna", "name": "Conta+ · API interna"}}

MODELO_IA = "gpt-4.1-mini"

# Nó de configuração: único lugar com valores a preencher em cada fluxo
CONFIG_JS = r"""
// ⚙️ CONFIGURAÇÃO — preencha uma vez
return [{ json: {
  ...$json,
  config: {
    SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',   // sem barra no final
    APP_URL: 'https://SEU-APP.vercel.app',              // endereço do Conta+, sem barra no final
    EVOLUTION_V1: false,                                // true se a sua Evolution for v1.x
    MODELO_IA: '%s',
  }
}}];
""" % MODELO_IA

# Monta o corpo da Evolution (v2 por padrão; v1 se config.EVOLUTION_V1)
EVOLUTION_HELPERS = r"""
function corpoTexto(numero, texto, v1) {
  return v1 ? { number: numero, textMessage: { text: texto } } : { number: numero, text: texto };
}
function corpoMidia(numero, url, tipo, nome, legenda, v1) {
  const m = { mediatype: tipo || 'document', media: url, fileName: nome || 'arquivo', caption: legenda || '' };
  return v1 ? { number: numero, mediaMessage: m } : { number: numero, ...m };
}
function endpoint(evo, caminho) {
  return `${String(evo.url || '').replace(/\/$/, '')}/message/${caminho}/${encodeURIComponent(evo.instance || '')}`;
}
"""


class Fluxo:
    def __init__(self, nome, descricao):
        self.nome = nome
        self.descricao = descricao
        self.nodes = []
        self.conn = {}
        self.x = 0

    def add(self, nome, tipo, versao, params, pos, cred=None, extra=None):
        n = {
            "parameters": params,
            "id": str(uuid.uuid5(uuid.NAMESPACE_URL, self.nome + nome)),
            "name": nome,
            "type": tipo,
            "typeVersion": versao,
            "position": list(pos),
        }
        if cred:
            n["credentials"] = cred
        if extra:
            n.update(extra)
        self.nodes.append(n)
        return nome

    def liga(self, de, para, saida=0):
        lst = self.conn.setdefault(de, {"main": []})["main"]
        while len(lst) <= saida:
            lst.append([])
        lst[saida].append({"node": para, "type": "main", "index": 0})

    def nota(self, texto, pos, w=420, h=260):
        self.add(f"Nota {len(self.nodes)}", "n8n-nodes-base.stickyNote", 1,
                 {"content": texto, "height": h, "width": w}, pos)

    def salvar(self, arquivo):
        d = {
            "name": self.nome,
            "nodes": self.nodes,
            "connections": self.conn,
            "active": False,
            "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo",
                         "saveDataErrorExecution": "all", "saveDataSuccessExecution": "none"},
            "meta": {"templateCredsSetupCompleted": False},
            "tags": [],
            "pinData": {},
        }
        with open(os.path.join(AQUI, arquivo), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
        return arquivo


# ── blocos de nós ────────────────────────────────────────────

def webhook(f, nome, path, pos, responder_no=True):
    return f.add(nome, "n8n-nodes-base.webhook", 2, {
        "httpMethod": "POST",
        "path": path,
        "responseMode": "responseNode" if responder_no else "onReceived",
        "options": {},
    }, pos, extra={"webhookId": str(uuid.uuid5(uuid.NAMESPACE_URL, path))})


def agenda(f, nome, pos, minutos=None, cron=None):
    regra = {"field": "cronExpression", "expression": cron} if cron else {"field": "minutes", "minutesInterval": minutos}
    return f.add(nome, "n8n-nodes-base.scheduleTrigger", 1.2, {"rule": {"interval": [regra]}}, pos)


def code(f, nome, js, pos, por_item=False):
    p = {"jsCode": js.strip()}
    if por_item:
        p["mode"] = "runOnceForEachItem"
    return f.add(nome, "n8n-nodes-base.code", 2, p, pos)


def sql(f, nome, query, params_expr, pos, sempre=False):
    p = {"operation": "executeQuery", "query": query.strip(), "options": {}}
    if params_expr:
        p["options"]["queryReplacement"] = "={{ " + params_expr + " }}"
    extra = {"alwaysOutputData": True} if sempre else None
    return f.add(nome, "n8n-nodes-base.postgres", 2.5, p, pos, cred=CRED_PG, extra=extra)


def http_dinamico(f, nome, pos):
    """POST para $json.req.url com headers $json.req.headers e corpo $json.req.body. Nunca falha: o próximo nó lê o status."""
    return f.add(nome, "n8n-nodes-base.httpRequest", 4.2, {
        "method": "POST",
        "url": "={{ $json.req.url }}",
        "sendHeaders": True,
        "specifyHeaders": "json",
        "jsonHeaders": "={{ JSON.stringify($json.req.headers || {}) }}",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json.req.body) }}",
        "options": {"timeout": 30000,
                    "response": {"response": {"fullResponse": True, "neverError": True}}},
    }, pos)


def openai(f, nome, mensagens_expr, pos, json_mode=True):
    corpo = "={{ JSON.stringify({ model: $json.config.MODELO_IA, temperature: 0.2, " + \
            ("response_format: { type: 'json_object' }, " if json_mode else "") + \
            "messages: " + mensagens_expr + " }) }}"
    return f.add(nome, "n8n-nodes-base.httpRequest", 4.2, {
        "method": "POST",
        "url": "https://api.openai.com/v1/chat/completions",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": corpo,
        "options": {"timeout": 60000,
                    "response": {"response": {"fullResponse": False, "neverError": True}}},
    }, pos, cred=CRED_OPENAI)


def responder(f, nome, corpo_expr, pos, status=200):
    p = {"respondWith": "json", "responseBody": "={{ " + corpo_expr + " }}", "options": {}}
    if status != 200:
        p["options"]["responseCode"] = status
    return f.add(nome, "n8n-nodes-base.respondToWebhook", 1.1, p, pos)


def se(f, nome, expr_bool, pos):
    return f.add(nome, "n8n-nodes-base.if", 2, {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
            "conditions": [{
                "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f.nome + nome)),
                "leftValue": "={{ " + expr_bool + " }}",
                "rightValue": "",
                "operator": {"type": "boolean", "operation": "true", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    }, pos)


def rotas(f, nome, campo_expr, valores, pos):
    """Switch por valor de texto; saída i = valores[i]."""
    regras = []
    for v in valores:
        regras.append({
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                "conditions": [{
                    "leftValue": "={{ " + campo_expr + " }}",
                    "rightValue": v,
                    "operator": {"type": "string", "operation": "equals"},
                }],
                "combinator": "and",
            },
            "renameOutput": True,
            "outputKey": v,
        })
    return f.add(nome, "n8n-nodes-base.switch", 3, {"rules": {"values": regras}, "options": {}}, pos)


# ═════════════════════════════════════════════════════════════
# 01 · Assistente IA interno
# ═════════════════════════════════════════════════════════════
def fluxo_01():
    f = Fluxo("Conta+ 01 · Assistente IA interno",
              "Responde o chat de IA do sistema com dados do próprio escritório.")
    f.nota("## 01 · Assistente IA interno\nChamado pelo painel de IA do Conta+ "
           "(POST /webhook/replypal/ia-pro).\n\n1. A IA classifica a pergunta (intenção + termo).\n"
           "2. A função `ia_contexto` busca os dados **só do escritório (tenant)**.\n"
           "3. A IA responde usando apenas esse contexto.\n\nA IA nunca escreve SQL.",
           [-60, -320], 460, 280)
    wh = webhook(f, "Webhook IA", "replypal/ia-pro", [0, 0])
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    norm = code(f, "Validar pergunta", r"""
const b = $json.body || {};
const pergunta = String(b.mensagem_texto || '').trim().slice(0, 2000);
const tenant = String(b.tenant_id || '');
const uuidOk = s => /^[0-9a-f-]{36}$/i.test(s || '');
return [{ json: {
  config: $json.config,
  pergunta,
  tenant_id: uuidOk(tenant) ? tenant : null,
  cliente_id: uuidOk(b.cliente_id) ? b.cliente_id : null,
  colaborador: b.colaborador || 'Equipe',
  valido: !!pergunta && uuidOk(tenant),
}}];
""", [440, 0])
    ok = se(f, "Pergunta válida?", "$json.valido", [660, 0])
    erro = responder(f, "Responder: inválido", "({ resposta: 'Não entendi a pergunta. Tente de novo.' })", [880, 200])
    classificar = openai(f, "IA: classificar", r"""[
  { role: 'system', content: 'Você classifica perguntas feitas pela equipe de um escritório de contabilidade sobre o próprio sistema. Responda só JSON: {"intencao": "carteira|cliente|financeiro|documentos|atendimento|conhecimento|outro", "termo": "nome da empresa, CNPJ ou assunto principal, ou null"}. carteira = visão geral de todos os clientes; cliente = dados de uma empresa; financeiro = faturamento/compras/vendas/folha de uma empresa; documentos = arquivos de uma empresa; atendimento = conversas, fila, SLA; conhecimento = dúvida de procedimento, prazo, legislação; outro = conversa geral.' },
  { role: 'user', content: $json.pergunta }
]""", [880, 0])
    parse = code(f, "Ler classificação", r"""
const base = $('Validar pergunta').item.json;
let c = {};
try { c = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) { c = {}; }
const intencoes = ['carteira','cliente','financeiro','documentos','atendimento','conhecimento','outro'];
const intencao = intencoes.includes(c.intencao) ? c.intencao : 'conhecimento';
return [{ json: { ...base, intencao, termo: c.termo ? String(c.termo).slice(0, 120) : null } }];
""", [1100, 0], por_item=False)
    ctx = sql(f, "Buscar contexto", """
SELECT public.ia_contexto($1::uuid, $2, NULLIF($3, ''), NULLIF($4, '')::uuid) AS contexto
""", "[ $json.tenant_id, $json.intencao === 'outro' ? 'conhecimento' : $json.intencao, $json.termo || '', $json.cliente_id || '' ]",
        [1320, 0])
    responder_ia = openai(f, "IA: responder", r"""[
  { role: 'system', content: 'Você é o Assistente Conta+, que ajuda a equipe de um escritório de contabilidade. Responda em português do Brasil, curto e direto, usando SOMENTE os dados do CONTEXTO. Se o contexto tiver "precisa_escolher", liste as empresas encontradas e peça para a pessoa dizer qual. Se tiver "nao_encontrado", diga que não achou e sugira buscar pelo CNPJ. Nunca invente números, datas, valores ou prazos que não estejam no contexto; se faltar informação, diga o que falta. Valores em R$ no formato brasileiro.' },
  { role: 'user', content: 'Pergunta de ' + $('Ler classificação').item.json.colaborador + ': ' + $('Ler classificação').item.json.pergunta + '\n\nCONTEXTO (JSON):\n' + JSON.stringify($json.contexto || {}) }
]""", [1540, 0], json_mode=False)
    # o nó IA: responder usa $json.config -> repassa a config
    f.nodes[-1]["parameters"]["jsonBody"] = f.nodes[-1]["parameters"]["jsonBody"].replace(
        "$json.config.MODELO_IA", "$('Config').item.json.config.MODELO_IA")
    f.nodes[[n["name"] for n in f.nodes].index("IA: classificar")]["parameters"]["jsonBody"] = \
        f.nodes[[n["name"] for n in f.nodes].index("IA: classificar")]["parameters"]["jsonBody"].replace(
            "$json.config.MODELO_IA", "$('Config').item.json.config.MODELO_IA")
    final = code(f, "Montar resposta", r"""
const texto = $json.choices?.[0]?.message?.content?.trim();
return [{ json: { resposta: texto || 'Não consegui responder agora. Tente de novo em instantes.' } }];
""", [1760, 0])
    resp = responder(f, "Responder", "$json", [1980, 0])
    f.liga(wh, cfg); f.liga(cfg, norm); f.liga(norm, ok)
    f.liga(ok, classificar, 0); f.liga(ok, erro, 1)
    f.liga(classificar, parse); f.liga(parse, ctx); f.liga(ctx, responder_ia)
    f.liga(responder_ia, final); f.liga(final, resp)
    return f.salvar("01-assistente-ia.json")


# ═════════════════════════════════════════════════════════════
# 02 · Upload de documentos
# ═════════════════════════════════════════════════════════════
def fluxo_02():
    f = Fluxo("Conta+ 02 · Upload de documentos",
              "Recebe o arquivo do cadastro do cliente, guarda no Storage privado e registra em documentos.")
    f.nota("## 02 · Upload de documentos\nChamado pela aba Documentos do cliente "
           "(POST /webhook/documentos/upload, via /api/proxy-webhook).\n\n"
           "Guarda o arquivo no bucket **privado** `documentos` do Supabase e cria a linha em "
           "`documentos`. O app abre e envia sempre por link assinado (/api/documento-url).\n\n"
           "Limite: 15 MB por arquivo.", [-60, -320], 460, 260)
    wh = webhook(f, "Webhook upload", "documentos/upload", [0, 0])
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    val = code(f, "Validar arquivo", r"""
const b = { ...($json.body || {}) };
// aceita base64 puro ou data URL ("data:application/pdf;base64,....")
b.arquivo_base64 = String(b.arquivo_base64 || '').replace(/^data:[^,]*,/, '');
const uuidOk = s => /^[0-9a-f-]{36}$/i.test(s || '');
const erros = [];
if (!uuidOk(b.cliente_id)) erros.push('cliente_id');
if (!b.arquivo_base64) erros.push('arquivo');
if (!b.tipo) erros.push('tipo');
const bytes = Math.floor(String(b.arquivo_base64 || '').length * 3 / 4);
if (bytes > 15 * 1024 * 1024) erros.push('arquivo maior que 15 MB');  // pelo app o limite real é 3 MB (proxy da Vercel)
const limpo = String(b.arquivo_nome || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80);
return [{ json: { config: $json.config, b, bytes, nome_limpo: limpo, erro: erros.join(', ') } }];
""", [440, 0])
    ok = se(f, "Arquivo válido?", "!$json.erro", [660, 0])
    ruim = responder(f, "Responder: inválido", "({ success: false, error: 'Dados inválidos: ' + $json.erro })", [880, 220], 400)
    cli = sql(f, "Buscar cliente", "SELECT id, tenant_id FROM public.clientes WHERE id = $1::uuid",
              "[ $json.b.cliente_id ]", [880, 0], sempre=True)
    tem = se(f, "Cliente existe?", "!!$json.tenant_id", [1100, 0])
    semcli = responder(f, "Responder: sem cliente", "({ success: false, error: 'Cliente não encontrado' })", [1320, 220], 404)
    prep = code(f, "Preparar arquivo", r"""
const v = $('Validar arquivo').item.json;
const b = v.b;
const agora = new Date();
const comp = b.ano && b.mes ? `${b.ano}-${String(b.mes).padStart(2, '0')}` : agora.toISOString().slice(0, 7);
const categoria = String(b.categoria || 'Geral').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-');
const path = `${$json.tenant_id}/${b.cliente_id}/${categoria}/${comp}/${agora.getTime()}-${v.nome_limpo}`;
const bin = await this.helpers.prepareBinaryData(Buffer.from(b.arquivo_base64, 'base64'), v.nome_limpo, b.arquivo_tipo || 'application/octet-stream');
return [{
  json: {
    config: v.config, tenant_id: $json.tenant_id, b, path, bytes: v.bytes,
    upload_url: `${v.config.SUPABASE_URL}/storage/v1/object/documentos/${path.split('/').map(encodeURIComponent).join('/')}`,
  },
  binary: { arquivo: bin },
}];
""", [1320, 0])
    up = f.add("Enviar ao Storage", "n8n-nodes-base.httpRequest", 4.2, {
        "method": "POST",
        "url": "={{ $json.upload_url }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpCustomAuth",
        "sendHeaders": True,
        "headerParameters": {"parameters": [
            {"name": "x-upsert", "value": "true"},
            {"name": "Content-Type", "value": "={{ $json.b.arquivo_tipo || 'application/octet-stream' }}"},
        ]},
        "sendBody": True,
        "contentType": "binaryData",
        "inputDataFieldName": "arquivo",
        "options": {"timeout": 60000, "response": {"response": {"fullResponse": True, "neverError": True}}},
    }, [1540, 0], cred=CRED_SUPA)
    subiu = se(f, "Subiu?", "$json.statusCode < 300", [1760, 0])
    falhou = responder(f, "Responder: falha no Storage",
                       "({ success: false, error: 'Falha ao gravar o arquivo (' + $json.statusCode + ')' })", [1980, 220], 502)
    reg = sql(f, "Registrar documento", """
INSERT INTO public.documentos
  (cliente_id, tenant_id, categoria, tipo, mes, ano, url, storage_path, nome_arquivo,
   mime_type, tamanho_bytes, uploaded_by, vigente, uploaded_at)
VALUES ($1::uuid, $2::uuid, $3, $4, NULLIF($5, '')::int, NULLIF($6, '')::int, $7, $8, $9,
        $10, $11::bigint, $12, true, now())
RETURNING id, url
""", """[
  $('Preparar arquivo').item.json.b.cliente_id,
  $('Preparar arquivo').item.json.tenant_id,
  $('Preparar arquivo').item.json.b.categoria || 'Geral',
  $('Preparar arquivo').item.json.b.tipo,
  String($('Preparar arquivo').item.json.b.mes || ''),
  String($('Preparar arquivo').item.json.b.ano || ''),
  $('Preparar arquivo').item.json.config.SUPABASE_URL + '/storage/v1/object/documentos/' + $('Preparar arquivo').item.json.path,
  $('Preparar arquivo').item.json.path,
  $('Preparar arquivo').item.json.b.arquivo_nome || 'arquivo',
  $('Preparar arquivo').item.json.b.arquivo_tipo || null,
  String($('Preparar arquivo').item.json.bytes),
  $('Preparar arquivo').item.json.b.uploaded_by || 'Conta+'
]""", [1980, 0])
    resp = responder(f, "Responder: ok", "({ success: true, id: $json.id, url: $json.url })", [2200, 0])
    f.liga(wh, cfg); f.liga(cfg, val); f.liga(val, ok)
    f.liga(ok, cli, 0); f.liga(ok, ruim, 1)
    f.liga(cli, tem); f.liga(tem, prep, 0); f.liga(tem, semcli, 1)
    f.liga(prep, up); f.liga(up, subiu); f.liga(subiu, reg, 0); f.liga(subiu, falhou, 1)
    f.liga(reg, resp)
    return f.salvar("02-upload-documentos.json")


# ═════════════════════════════════════════════════════════════
# 03 · Cliente pede documento no WhatsApp
# ═════════════════════════════════════════════════════════════
TIPOS_DOC = ["cartao_cnpj", "alvara", "documentos_fiscais", "boletos_honorarios", "contrato_social",
             "folha_pagamento", "faturamento", "compras", "vendas", "certificado_digital"]


def fluxo_03():
    f = Fluxo("Conta+ 03 · Pedido de documentos pelo WhatsApp",
              "O cliente pede um documento; o bot confirma e envia, avisa a equipe ou pede aprovação.")
    f.nota("## 03 · Pedido de documentos pelo WhatsApp\nChamado pelo `api/evolution-webhook.ts` a cada "
           "mensagem de texto de cliente (variável N8N_DOCUMENTOS_WEBHOOK = "
           "https://SEU-N8N/webhook/conta/documentos).\n\nSó age se **bot_documentos_ativo** estiver "
           "ligado em Configurações. Regras de quem recebe o quê estão no banco "
           "(migration 013): o fluxo só conversa e envia.", [-60, -360], 520, 280)
    wh = webhook(f, "Webhook mensagem", "conta/documentos", [0, 0], responder_no=False)
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    ctx = sql(f, "Carregar contexto", """
SELECT
  coalesce(cs.bot_documentos_ativo, false) AS ativo,
  public.evolution_config($1::uuid) AS evolution,
  public.telefone_whatsapp($2) AS numero,
  (SELECT row_to_json(p) FROM public.pedidos_documento p
    WHERE p.tenant_id = $1::uuid AND public.mesmo_telefone(p.telefone, $2)
      AND p.status IN ('aguardando_cliente', 'escolher_empresa')
      AND p.created_at > now() - interval '15 minutes'
    ORDER BY p.created_at DESC LIMIT 1) AS pedido
FROM public.company_settings cs WHERE cs.tenant_id = $1::uuid
""", "[ $json.body.tenant_id, $json.body.telefone ]", [440, 0], sempre=True)
    decidir = code(f, "Decidir caminho", r"""
const ent = $('Config').item.json;
const b = ent.body || {};
const texto = String(b.texto || '').trim();
const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const p = $json.pedido;
let caminho = 'ignorar';
let escolha = null;
if ($json.ativo) {
  if (p && p.status === 'escolher_empresa' && /^\d{1,2}$/.test(t)) { caminho = 'escolher'; escolha = parseInt(t, 10); }
  else if (p && p.status === 'aguardando_cliente' && /^(1|sim|s|isso|pode|quero|ok|claro)\b/.test(t)) caminho = 'confirmar';
  else if (p && /^(2|nao|n|cancela|deixa)\b/.test(t)) caminho = 'cancelar';
  else if (/(contrato|social|cartao|cnpj|certificado|guia|\bdas\b|boleto|honorario|folha|holerite|alvara|faturamento|compras|vendas)/.test(t)) caminho = 'classificar';
}
return [{ json: {
  config: ent.config, caminho, escolha, texto,
  tenant_id: b.tenant_id, conversa_id: b.conversa_id, telefone: b.telefone,
  numero: $json.numero, evolution: $json.evolution, pedido: p,
}}];
""", [660, 0])
    sw = rotas(f, "Caminho", "$json.caminho", ["confirmar", "cancelar", "escolher", "classificar"], [880, 0])

    # confirmar
    conf = sql(f, "Confirmar pedido", """
SELECT public.confirmar_pedido_documento($1::uuid) AS r,
       p.id AS pedido_id, p.tipo, p.documento_id, d.nome_arquivo,
       coalesce(cfg.rotulo, p.tipo) AS rotulo
FROM public.pedidos_documento p
LEFT JOIN public.documentos d ON d.id = p.documento_id
LEFT JOIN public.documento_tipos_config cfg ON cfg.tenant_id = p.tenant_id AND cfg.tipo = p.tipo
WHERE p.id = $1::uuid
""", "[ $json.pedido.id ]", [1100, -300])
    acao = rotas(f, "Ação", "$json.r.acao", ["enviar_agora", "avisar_equipe", "aguardar_aprovacao"], [1320, -300])
    # O Conta+ devolve um link de 5 minutos, venha o arquivo do Google Drive do
    # escritório ou do cofre (Storage). O fluxo não precisa saber onde ele está.
    assinar = f.add("Pedir link do arquivo", "n8n-nodes-base.httpRequest", 4.2, {
        "method": "GET",
        "url": "={{ $('Config').item.json.config.APP_URL + '/api/documento-url?id=' + $json.documento_id }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {"timeout": 20000, "response": {"response": {"fullResponse": False, "neverError": True}}},
    }, [1540, -480], cred=CRED_API)
    montar_midia = code(f, "Montar envio do arquivo", EVOLUTION_HELPERS + r"""
const base = $('Decidir caminho').item.json;
const c = $('Confirmar pedido').item.json;
const url = $json.url || null;   // sem link (arquivo apagado, Drive desconectado): avisa a equipe
const legenda = `Segue o ${c.rotulo}.`;
return [{ json: {
  ...base, pedido_id: c.pedido_id, enviar_arquivo: true, legenda, nome_arquivo: c.nome_arquivo,
  url_arquivo: url,
  req: url ? {
    url: endpoint(base.evolution, 'sendMedia'),
    headers: { apikey: base.evolution.apikey },
    body: corpoMidia(base.numero, url, 'document', c.nome_arquivo, legenda, base.config.EVOLUTION_V1),
  } : null,
}}];
""", [1760, -480])
    tem_link = se(f, "Tem link?", "!!$json.url_arquivo", [1870, -480])
    enviar_midia = http_dinamico(f, "Enviar arquivo", [1980, -480])
    marcar = sql(f, "Marcar enviado", """
SELECT public.marcar_pedido_enviado($1::uuid, NULL) AS pedido,
       public.registrar_mensagem_automatica($2::uuid, $3, 'Conta+ (automático)', 'document', NULL, $4, NULLIF($5, ''))
""", """[
  $('Montar envio do arquivo').item.json.pedido_id,
  $('Montar envio do arquivo').item.json.conversa_id,
  $('Montar envio do arquivo').item.json.legenda,
  $('Montar envio do arquivo').item.json.nome_arquivo || 'documento',
  ($json.body && $json.body.key && $json.body.key.id) || ''
]""", [2420, -480])
    enviou = se(f, "Arquivo saiu?", "$json.statusCode < 300", [2200, -480])
    falha_envio = code(f, "Texto: falha no envio", r"""
const b = $('Montar envio do arquivo').item.json;
return [{ json: { ...b, resposta: 'Não consegui enviar o arquivo agora. Um atendente já vai te ajudar.' } }];
""", [2420, -300])
    # Não saiu sozinho: o pedido vai para a fila de "um clique" da equipe em vez de expirar.
    para_equipe = sql(f, "Deixar para a equipe", """
UPDATE public.pedidos_documento
   SET status = 'aguardando_envio', motivo = 'Envio automático falhou', updated_at = now()
 WHERE id = $1::uuid AND status = 'aguardando_cliente'
RETURNING id
""", "[ $('Montar envio do arquivo').item.json.pedido_id ]", [2420, -140], sempre=True)
    txt_equipe = code(f, "Texto: equipe envia", r"""
return [{ json: { ...$('Decidir caminho').item.json, resposta: 'Pedido recebido! A equipe envia em instantes.' } }];
""", [1540, -300])
    txt_aprov = code(f, "Texto: aguarda aprovação", r"""
return [{ json: { ...$('Decidir caminho').item.json, resposta: 'Esse documento precisa de uma aprovação interna. Avisamos por aqui assim que for liberado.' } }];
""", [1540, -140])

    # cancelar
    canc = sql(f, "Cancelar pedido", """
UPDATE public.pedidos_documento SET status = 'cancelado' WHERE id = $1::uuid RETURNING id
""", "[ $json.pedido.id ]", [1100, -60])
    txt_canc = code(f, "Texto: cancelado", r"""
return [{ json: { ...$('Decidir caminho').item.json, resposta: 'Tudo bem! Se precisar de algum documento, é só pedir.' } }];
""", [1320, -60])

    # escolher empresa
    esc = sql(f, "Resolver empresa escolhida", """
WITH opcoes AS (
  SELECT c.id, row_number() OVER (ORDER BY c.nome_fantasia) AS n
  FROM public.contatos ct JOIN public.clientes c ON c.id = ct.customer_id
  WHERE ct.tenant_id = $1::uuid AND public.mesmo_telefone(ct.whatsapp_digitos, $2)
    AND ct.pode_receber_documentos
    AND ($3 <> 'certificado_digital' OR ct.pode_receber_certificado)
    AND coalesce(c.status, 'Ativo') NOT IN ('Inativo', 'Encerrado')
), cancela AS (
  UPDATE public.pedidos_documento SET status = 'cancelado' WHERE id = $5::uuid RETURNING id
)
SELECT public.resolver_pedido_documento($1::uuid, $2, $3, $6::uuid, $7,
         (SELECT id FROM opcoes WHERE n = $4::int)) AS resultado
FROM (SELECT 1) x
WHERE EXISTS (SELECT 1 FROM opcoes WHERE n = $4::int)
""", "[ $json.tenant_id, $json.telefone, $json.pedido.tipo, String($json.escolha), $json.pedido.id, $json.conversa_id, $json.texto ]",
        [1100, 160], sempre=True)

    # classificar
    clas = openai(f, "IA: é pedido de documento?", r"""[
  { role: 'system', content: 'Você lê mensagens de clientes de um escritório de contabilidade. Responda só JSON: {"pedido": true|false, "tipo": "%s" ou null}. pedido=true só se a pessoa está PEDINDO para receber o documento agora. Perguntas sobre o documento (prazo, alteração, dúvida) são pedido=false. guia, DAS, DARF, GPS e notas = documentos_fiscais; holerite = folha_pagamento; boleto do escritório = boletos_honorarios.' },
  { role: 'user', content: $json.texto }
]""" % "|".join(TIPOS_DOC), [1100, 380])
    f.nodes[-1]["parameters"]["jsonBody"] = f.nodes[-1]["parameters"]["jsonBody"].replace(
        "$json.config.MODELO_IA", "$('Config').item.json.config.MODELO_IA")
    ler = code(f, "Ler classificação", r"""
const base = $('Decidir caminho').item.json;
let c = {};
try { c = JSON.parse($json.choices?.[0]?.message?.content || '{}'); } catch (e) {}
const tipos = %s;
return [{ json: { ...base, eh_pedido: c.pedido === true && tipos.includes(c.tipo), tipo: c.tipo } }];
""" % json.dumps(TIPOS_DOC), [1320, 380])
    eh = se(f, "É pedido?", "$json.eh_pedido", [1540, 380])
    resolver = sql(f, "Resolver pedido", """
SELECT public.resolver_pedido_documento($1::uuid, $2, $3, $4::uuid, $5) AS resultado
""", "[ $json.tenant_id, $json.telefone, $json.tipo, $json.conversa_id, $json.texto ]", [1760, 380])

    montar_txt = code(f, "Texto da decisão", r"""
const base = $('Decidir caminho').item.json;
const r = $json.resultado;
if (!r) return [{ json: { ...base, resposta: 'Não entendi qual empresa. Responda com o número da lista.' } }];
let resposta;
switch (r.decisao) {
  case 'confirmar_com_cliente':
    resposta = `Você quer receber o ${r.rotulo} da ${r.empresa}? Responda 1 para sim ou 2 para não.`; break;
  case 'escolher_empresa':
    resposta = 'De qual empresa?\n' + (r.empresas || []).map((e, i) => `${i + 1}. ${e.empresa}`).join('\n') +
               '\n\nResponda com o número.'; break;
  case 'nao_autorizado':
    resposta = 'Não encontrei seu cadastro para receber documentos por aqui. Um atendente já vai te ajudar.'; break;
  case 'sem_documento':
    resposta = 'Não achei esse documento no sistema. Um atendente já vai te ajudar.'; break;
  default:
    resposta = 'Esse documento é tratado só com a nossa equipe. Um atendente já vai te ajudar.';
}
return [{ json: { ...base, resposta } }];
""", [1980, 260])

    # cauda comum: enviar texto e gravar no chat
    montar_envio = code(f, "Montar envio do texto", EVOLUTION_HELPERS + r"""
return [{ json: { ...$json, req: {
  url: endpoint($json.evolution, 'sendText'),
  headers: { apikey: $json.evolution.apikey },
  body: corpoTexto($json.numero, $json.resposta, $json.config.EVOLUTION_V1),
}}}];
""", [2640, 0])
    enviar_txt = http_dinamico(f, "Enviar texto", [2860, 0])
    gravar = sql(f, "Gravar no chat", """
SELECT public.registrar_mensagem_automatica($1::uuid, $2, 'Conta+ (automático)', 'text', NULL, NULL, NULLIF($3, ''))
""", """[
  $('Montar envio do texto').item.json.conversa_id,
  $('Montar envio do texto').item.json.resposta,
  ($json.body && $json.body.key && $json.body.key.id) || ''
]""", [3080, 0])

    f.liga(wh, cfg); f.liga(cfg, ctx); f.liga(ctx, decidir); f.liga(decidir, sw)
    f.liga(sw, conf, 0); f.liga(sw, canc, 1); f.liga(sw, esc, 2); f.liga(sw, clas, 3)
    f.liga(conf, acao)
    f.liga(acao, assinar, 0); f.liga(acao, txt_equipe, 1); f.liga(acao, txt_aprov, 2)
    f.liga(assinar, montar_midia); f.liga(montar_midia, tem_link); f.liga(tem_link, enviar_midia, 0)
    f.liga(tem_link, para_equipe, 1); f.liga(enviar_midia, enviou)
    f.liga(enviou, marcar, 0); f.liga(enviou, para_equipe, 1); f.liga(para_equipe, falha_envio)
    f.liga(canc, txt_canc)
    f.liga(esc, montar_txt)
    f.liga(clas, ler); f.liga(ler, eh); f.liga(eh, resolver, 0); f.liga(resolver, montar_txt)
    for n in (txt_equipe, txt_aprov, txt_canc, montar_txt, falha_envio):
        f.liga(n, montar_envio)
    f.liga(montar_envio, enviar_txt); f.liga(enviar_txt, gravar)
    return f.salvar("03-pedido-documentos-whatsapp.json")


# ═════════════════════════════════════════════════════════════
# 04 · Mensagens agendadas
# ═════════════════════════════════════════════════════════════
def fluxo_04():
    f = Fluxo("Conta+ 04 · Mensagens agendadas", "Envia as mensagens agendadas no chat, a cada minuto.")
    f.nota("## 04 · Mensagens agendadas\nA cada minuto reserva até 20 mensagens vencidas "
           "(`reservar_mensagens_agendadas`, com trava para não enviar duas vezes), envia pela Evolution "
           "do escritório e grava o resultado (`concluir_mensagem_agendada`).\n\n"
           "Erro: tenta de novo até 3 vezes; depois marca como erro (aparece em Agendamentos).",
           [-60, -320], 460, 240)
    ag = agenda(f, "A cada minuto", [0, 0], minutos=1)
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    res = sql(f, "Reservar mensagens", "SELECT * FROM public.reservar_mensagens_agendadas(20)", None, [440, 0])
    montar = code(f, "Montar envio", EVOLUTION_HELPERS + r"""
const v1 = $('Config').first().json.config.EVOLUTION_V1;
return $input.all().map(({ json: m }) => {
  const midia = m.message_type && m.message_type !== 'text';
  return { json: { ...m, req: {
    url: endpoint(m.evolution, midia ? 'sendMedia' : 'sendText'),
    headers: { apikey: m.evolution.apikey },
    body: midia
      ? corpoMidia(m.numero, m.media_url, m.message_type, m.file_name, m.text_content, v1)
      : corpoTexto(m.numero, m.text_content, v1),
  }}};
});
""", [660, 0])
    env = http_dinamico(f, "Enviar pela Evolution", [880, 0])
    conc = sql(f, "Concluir", """
SELECT public.concluir_mensagem_agendada($1::uuid, $2::boolean, NULLIF($3, ''), NULLIF($4, '')) AS resultado
""", """[
  $('Montar envio').item.json.id,
  $json.statusCode < 300,
  $json.statusCode < 300 ? '' : ('HTTP ' + $json.statusCode + ': ' + JSON.stringify($json.body || '').slice(0, 300)),
  ($json.body && $json.body.key && $json.body.key.id) || ''
]""", [1100, 0])
    f.liga(ag, cfg); f.liga(cfg, res); f.liga(res, montar); f.liga(montar, env); f.liga(env, conc)
    return f.salvar("04-mensagens-agendadas.json")


# ═════════════════════════════════════════════════════════════
# 05 · Alertas de atendimento
# ═════════════════════════════════════════════════════════════
def fluxo_05():
    f = Fluxo("Conta+ 05 · Alertas de atendimento",
              "Avisa a gestão quando um cliente fica sem resposta além do limite configurado.")
    f.nota("## 05 · Alertas de atendimento\nA cada 15 minutos lê `alertas_devidos()`: conversas de cliente "
           "cuja última mensagem é do cliente e passou do limite configurado em **Alertas** (dias e horário "
           "respeitados). Cada episódio é avisado uma única vez (`alertas_envios`).", [-60, -300], 460, 220)
    ag = agenda(f, "A cada 15 minutos", [0, 0], minutos=15)
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    dev = sql(f, "Alertas devidos", "SELECT * FROM public.alertas_devidos()", None, [440, 0])
    montar = code(f, "Montar envio", EVOLUTION_HELPERS + r"""
const v1 = $('Config').first().json.config.EVOLUTION_V1;
return $input.all().map(({ json: a }) => ({ json: { ...a, req: {
  url: endpoint(a.evolution, 'sendText'),
  headers: { apikey: a.evolution.apikey },
  body: corpoTexto(a.numero_destino, a.mensagem, v1),
}}}));
""", [660, 0])
    env = http_dinamico(f, "Enviar alerta", [880, 0])
    reg = sql(f, "Registrar alerta", """
SELECT public.registrar_alerta($1::uuid, $2::uuid, $3::timestamptz, $4::boolean, NULLIF($5, ''))
""", """[
  $('Montar envio').item.json.alerta_id,
  $('Montar envio').item.json.conversa_id,
  $('Montar envio').item.json.referencia,
  $json.statusCode < 300,
  $json.statusCode < 300 ? '' : 'HTTP ' + $json.statusCode
]""", [1100, 0])
    f.liga(ag, cfg); f.liga(cfg, dev); f.liga(dev, montar); f.liga(montar, env); f.liga(env, reg)
    return f.salvar("05-alertas-atendimento.json")


# ═════════════════════════════════════════════════════════════
# 06 · Relatório diário
# ═════════════════════════════════════════════════════════════
def fluxo_06():
    f = Fluxo("Conta+ 06 · Relatório diário de atendimento",
              "Envia o resumo do atendimento do dia anterior no horário configurado; aceita disparo de teste.")
    f.nota("## 06 · Relatório diário\nA cada 5 minutos verifica `relatorios_devidos()` (horário configurado "
           "em Configurações › Relatório diário, uma vez por dia).\n\nO botão **Testar** do sistema chama "
           "POST /webhook/replypal/relatorio-atendimento/teste e envia na hora, sem contar como o envio do dia.",
           [-60, -340], 480, 240)
    ag = agenda(f, "A cada 5 minutos", [0, 0], minutos=5)
    wh = webhook(f, "Webhook teste", "replypal/relatorio-atendimento/teste", [0, 220], responder_no=False)
    cfg = code(f, "Config", CONFIG_JS, [220, 100])
    dev = sql(f, "Relatórios devidos", "SELECT * FROM public.relatorios_devidos(NULLIF($1, '')::uuid)",
              "[ ($json.body && $json.body.tenant_id) || '' ]", [440, 100])
    fmt = code(f, "Formatar mensagem", EVOLUTION_HELPERS + r"""
const v1 = ($('Config').first().json.config || {}).EVOLUTION_V1;
const saida = [];
for (const { json: r } of $input.all()) {
  const d = r.dados || {}, o = r.opcoes || {};
  const linhas = [];
  linhas.push(`*${r.mensagem_intro || r.nome || 'Relatório diário de atendimento'}*`);
  linhas.push(`${d.dia || ''}${r.teste ? ' (teste)' : ''}`);
  if (o.resumo_geral !== false) {
    linhas.push('', '*Resumo*',
      `• Novas conversas: ${d.novas ?? 0}`,
      `• Resolvidas: ${d.resolvidas ?? 0}`,
      `• Abertas agora: ${d.abertas_agora ?? 0} (na fila: ${d.na_fila ?? 0})`,
      `• Na triagem: ${d.triagem ?? 0}`);
  }
  if (o.tempo_resposta !== false && d.tempo_medio_primeira_resposta_min != null) {
    linhas.push(`• Tempo médio da 1ª resposta: ${d.tempo_medio_primeira_resposta_min} min`);
  }
  if (o.alertas !== false) linhas.push(`• Prazo de resposta estourado: ${d.sla_estourado ?? 0}`);
  if (o.por_usuario !== false && (d.por_usuario || []).length) {
    linhas.push('', '*Por atendente*', ...d.por_usuario.map(u => `• ${u.nome}: ${u.resolvidas} resolvidas, ${u.abertas} abertas`));
  }
  if (o.pendentes !== false && (d.pendentes_mais_antigas || []).length) {
    linhas.push('', '*Esperando há mais tempo*', ...d.pendentes_mais_antigas.map(p => `• ${p.cliente} (desde ${p.desde})`));
  }
  const texto = linhas.join('\n');
  for (const dest of (r.destinos || [])) {
    saida.push({ json: {
      relatorio_id: r.relatorio_id, teste: r.teste, numero: dest.numero, nome: dest.nome,
      req: { url: endpoint(r.evolution, 'sendText'), headers: { apikey: r.evolution.apikey },
             body: corpoTexto(dest.numero, texto, v1) },
    }});
  }
}
return saida;
""", [660, 100])
    env = http_dinamico(f, "Enviar relatório", [880, 100])
    reg = sql(f, "Registrar envio", """
SELECT public.registrar_envio_relatorio($1::uuid, $2, $3, $4::boolean, NULLIF($5, ''), $6::jsonb, $7::boolean)
""", """[
  $('Formatar mensagem').item.json.relatorio_id,
  $('Formatar mensagem').item.json.numero,
  $('Formatar mensagem').item.json.nome || '',
  $json.statusCode < 300,
  $json.statusCode < 300 ? '' : 'HTTP ' + $json.statusCode,
  JSON.stringify($json.body || {}),
  !!$('Formatar mensagem').item.json.teste
]""", [1100, 100])
    f.liga(ag, cfg); f.liga(wh, cfg); f.liga(cfg, dev)
    f.liga(dev, fmt); f.liga(fmt, env); f.liga(env, reg)
    return f.salvar("06-relatorio-diario.json")


# ═════════════════════════════════════════════════════════════
# 07 · Eventos do sistema (cliente cadastrado)
# ═════════════════════════════════════════════════════════════
def fluxo_07():
    f = Fluxo("Conta+ 07 · Eventos do sistema",
              "Recebe eventos do app (hoje: cliente cadastrado) e avisa admin e supervisores.")
    f.nota("## 07 · Eventos do sistema\nChamado pelo app quando um cliente é cadastrado "
           "(POST /webhook/conta/eventos, via /api/proxy-webhook).\n\nHoje: avisa admin e supervisores "
           "pelo WhatsApp (campo WhatsApp do usuário). Ponto de extensão para criar pastas no Drive, "
           "planilha de onboarding etc.", [-60, -300], 460, 220)
    wh = webhook(f, "Webhook eventos", "conta/eventos", [0, 0], responder_no=False)
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    sw = rotas(f, "Evento", "$json.body.event", ["cliente_criado"], [440, 0])
    dest = sql(f, "Destinatários", """
SELECT public.telefone_whatsapp(u.whatsapp) AS numero, public.evolution_config(u.tenant_id) AS evolution
FROM public.usuarios u
WHERE u.tenant_id = $1::uuid AND u.role IN ('admin', 'supervisor')
  AND length(regexp_replace(coalesce(u.whatsapp, ''), '\\D', '', 'g')) >= 10
""", "[ $json.body.tenant_id ]", [660, 0])
    montar = code(f, "Montar aviso", EVOLUTION_HELPERS + r"""
const ev = $('Config').first().json;
const b = ev.body || {};
const v1 = ev.config.EVOLUTION_V1;
const texto = `Novo cliente cadastrado no Conta+: *${b.cliente_nome || 'sem nome'}*` +
  (b.cnpj ? ` (CNPJ ${b.cnpj})` : '') + (b.criado_por ? `\nCadastrado por: ${b.criado_por}` : '') +
  '\nConfira os contatos e marque quem pode receber documentos.';
return $input.all().map(({ json: d }) => ({ json: { req: {
  url: endpoint(d.evolution, 'sendText'), headers: { apikey: d.evolution.apikey },
  body: corpoTexto(d.numero, texto, v1),
}}}));
""", [880, 0])
    env = http_dinamico(f, "Enviar aviso", [1100, 0])
    f.liga(wh, cfg); f.liga(cfg, sw); f.liga(sw, dest, 0); f.liga(dest, montar); f.liga(montar, env)
    return f.salvar("07-eventos-sistema.json")


# ═════════════════════════════════════════════════════════════
# 08 · Lembretes da pré-venda (opcional)
# ═════════════════════════════════════════════════════════════
def fluxo_08():
    f = Fluxo("Conta+ 08 · Lembretes da pré-venda",
              "Dias úteis às 8h, manda para admin e supervisores os contatos de pré-venda do dia e os atrasados.")
    f.nota("## 08 · Lembretes da pré-venda (opcional)\nDias úteis às 8h, envia a admin e supervisores "
           "(campo WhatsApp do usuário) as oportunidades com próximo contato hoje ou atrasado "
           "(`lembretes_pre_venda()`).", [-60, -280], 440, 200)
    ag = agenda(f, "Dias úteis 8h", [0, 0], cron="0 8 * * 1-5")
    cfg = code(f, "Config", CONFIG_JS, [220, 0])
    lem = sql(f, "Lembretes", "SELECT * FROM public.lembretes_pre_venda()", None, [440, 0])
    montar = code(f, "Montar envio", EVOLUTION_HELPERS + r"""
const v1 = $('Config').first().json.config.EVOLUTION_V1;
const saida = [];
for (const { json: l } of $input.all()) {
  for (const numero of (l.destinos || [])) {
    saida.push({ json: { req: { url: endpoint(l.evolution, 'sendText'), headers: { apikey: l.evolution.apikey },
                                body: corpoTexto(numero, l.texto, v1) } } });
  }
}
return saida;
""", [660, 0])
    env = http_dinamico(f, "Enviar lembrete", [880, 0])
    f.liga(ag, cfg); f.liga(cfg, lem); f.liga(lem, montar); f.liga(montar, env)
    return f.salvar("08-lembretes-pre-venda.json")


if __name__ == "__main__":
    for gerar in (fluxo_01, fluxo_02, fluxo_03, fluxo_04, fluxo_05, fluxo_06, fluxo_07, fluxo_08):
        print("gerado:", gerar())
