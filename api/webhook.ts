import { createClient } from "@supabase/supabase-js";

// Use environment variables with fallbacks
// NOTE: Vercel requires these to be set in the Dashboard
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);


export default async function handler(req: any, res: any) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials");
      return res.status(500).json({ 
        success: false, 
        error: "Supabase configuration missing in Vercel. Please add SUPABASE_URL and SUPABASE_ANON_KEY to your Vercel Environment Variables." 
      });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("mensagens")
        .select(`*, conversas(client_name, client_phone)`)
        .order("timestamp", { ascending: false })
        .limit(20);
        
      if (error) throw error;
      return res.json({ success: true, messages: data || [] });
    }
    
    if (req.method === "POST") {
      const body = req.body || {};
      const payload = body.data || body;
      
      const msgKey = payload.key?.id;
      const remoteJid = payload.key?.remoteJid || "";
      
      if (!msgKey || !remoteJid) {
        console.log("Ignored request: missing msgKey or remoteJid", body);
        return res.json({ success: true, message: "Request received but no valid message key/jid found" });
      }

      const fromMe = payload.key?.fromMe;
      const phone = typeof remoteJid === 'string' ? remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "") : "";
      const pushName = payload.pushName || "WhatsApp User";
      
      const text = payload.message?.conversation || 
                   payload.message?.extendedTextMessage?.text || 
                   payload.message?.imageMessage?.caption || 
                   "Mensagem não suportada ou sem texto";

      const tenantId = "11111111-1111-1111-1111-111111111111"; // Sasaki Tenant

      // Find/Create conversation
      let { data: conversation, error: convError } = await supabase
        .from("conversas")
        .select("id")
        .eq("client_phone", phone)
        .maybeSingle();
        
      if (convError) throw convError;
      
      let conversationId;
      
      if (!conversation) {
        const { data: newConv, error: createError } = await supabase
          .from("conversas")
          .insert({
            client_name: pushName,
            client_phone: phone,
            last_message: text,
            last_message_time: new Date().toISOString(),
            status: "novo",
            tenant_id: tenantId
          })
          .select()
          .single();
          
        if (createError) throw createError;
        conversationId = newConv?.id;
      } else {
        conversationId = conversation.id;
        await supabase
          .from("conversas")
          .update({
            last_message: text,
            last_message_time: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", conversationId);
      }
      
      const { error: msgError } = await supabase.from("mensagens").insert({
        conversation_id: conversationId,
        content: text,
        sender: fromMe ? "agent" : "client",
        sender_name: fromMe ? "ReplyPal" : pushName,
        timestamp: new Date().toISOString()
      });
        
      if (msgError) throw msgError;

      return res.json({ success: true, conversationId });
    }
    
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Fatal Error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error", 
      details: err?.message || String(err) 
    });
  }
}