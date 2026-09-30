import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking conversation 3a4540d2-9509-4c02-85cd-f19daf7bd7bc...");
  const { data: conv, error: cErr } = await supabase
    .from("conversas")
    .select("*")
    .eq("id", "3a4540d2-9509-4c02-85cd-f19daf7bd7bc")
    .single();

  if (cErr) {
    console.error("Error fetching conversation:", cErr);
  } else {
    console.log("Conversation details:", conv);
  }
}

run();
