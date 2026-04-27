import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function createSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const supabase = await createSupabaseClient();
    const { type, tenantId } = req.query || {};

    if (type === "conversas") {
      const { data: conversations, error: convError } = await supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", tenantId as string)
        .order("last_message_time", { ascending: false })
        .limit(50);

      if (convError) throw convError;
      return res.status(200).json({ success: true, conversas: conversations });
    }

    if (type === "mensagens") {
      const { data: messages, error: msgsError } = await supabase
        .from("mensagens")
        .select("*")
        .eq("conversation_id", req.query.conversationId as string)
        .order("timestamp", { ascending: true });

      if (msgsError) throw msgsError;
      return res.status(200).json({ success: true, messages });
    }

    return res.status(400).json({ error: "Invalid type param" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: String(error) });
  }
}