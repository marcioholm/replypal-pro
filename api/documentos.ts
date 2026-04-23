import { createClient } from "@supabase/supabase-js";

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
    
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    const { cliente_id, categoria, tipo, mes, ano, uploaded_by, page = 1, limit = 20 } = req.query;

    if (!cliente_id) {
      return res.status(400).json({ success: false, error: "Missing cliente_id" });
    }

    let query = supabase
      .from("documentos")
      .select("*", { count: "exact" })
      .eq("cliente_id", cliente_id);

    if (categoria && categoria !== "Todos") query = query.eq("categoria", categoria);
    if (tipo && tipo !== "Todos") query = query.eq("tipo", tipo);
    if (mes && mes !== "Todos") query = query.eq("mes", parseInt(mes));
    if (ano && ano !== "Todos") query = query.eq("ano", parseInt(ano));
    if (uploaded_by && uploaded_by !== "Todos") query = query.ilike("uploaded_by", `%${uploaded_by}%`);

    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    const { data, error, count } = await query
      .order("uploaded_at", { ascending: false })
      .range(from, to);

    if (error) {
      if (error.message.includes("does not exist")) {
        return res.json({ success: true, documentos: [], total: 0 });
      }
      throw error;
    }

    return res.json({ 
      success: true, 
      documentos: data || [], 
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err: any) {
    console.error("API Documents Error:", err);
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error", 
      details: err?.message || String(err) 
    });
  }
}
