import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function testConnection() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
    return { success: false, error: "Variáveis de ambiente não configuradas" };
  }
  try {
    const { data, error } = await supabase.from("pg_database").select("datname").limit(1);
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("Supabase connection error:", err);
    return { success: false, error: err };
  }
}