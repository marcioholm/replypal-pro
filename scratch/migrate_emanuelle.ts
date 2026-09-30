import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const OLD_ID = "5407fe22-3fe2-47c1-82c9-bd85941398c5";
const NEW_ID = "c5eeb822-244d-44fd-ad96-4e106b1cdb4e";

async function run() {
  console.log(`Migrating conversations from old ID ${OLD_ID} to new ID ${NEW_ID}...`);
  
  const { data, error } = await supabase
    .from("conversas")
    .update({ assigned_to: NEW_ID })
    .eq("assigned_to", OLD_ID)
    .select("id, client_name");

  if (error) {
    console.error("Migration error:", error);
  } else {
    console.log(`Successfully migrated ${data?.length || 0} conversations to new ID.`);
    if (data && data.length > 0) {
      console.log("Migrated conversations:", data.map(c => c.client_name));
    }
  }
}

run();
