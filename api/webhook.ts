import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

// Use environment variables with fallbacks
// NOTE: Vercel requires these to be set in the Dashboard
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    if (req.method === "OPTIONS") return res.status(200).end();
    
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    const { type, tenantId } = req.query || {};

    // Fetch conversations
    if (type === "conversas") {
      const { data: conversations, error: convError } = await supabase
        .from("conversas")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("last_message_time", { ascending: false })
        .limit(50);

      if (convError) throw convError;
      return res.status(200).json({ success: true, conversas: conversations });
    }

    // Fetch messages
    if (type === "mensagens") {
      const { messages, error: msgsError } = await supabase
        .from("mensagens")
        .select("*")
        .eq("conversation_id", req.query.conversationId)
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