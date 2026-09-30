import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking all users...");
  const { data: users, error: uErr } = await supabase
    .from("usuarios")
    .select("*");

  if (uErr) {
    console.error("Error fetching users:", uErr);
    return;
  }

  console.log("All users from 'usuarios':", users);

  if (users && users.length > 0) {
    const user = users[0];
    console.log(`Checking conversations for tenant_id: ${user.tenant_id}`);
    const { count, error: cErr } = await supabase
      .from("conversas")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", user.tenant_id);

    if (cErr) {
      console.error("Error counting conversations:", cErr);
    } else {
      console.log(`Total conversations for tenant_id: ${count}`);
    }

    // Check count of messages
    const { count: msgCount, error: mErr } = await supabase
      .from("mensagens")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", user.tenant_id);

    if (mErr) {
      console.error("Error counting messages:", mErr);
    } else {
      console.log(`Total messages for tenant_id: ${msgCount}`);
    }
  } else {
    console.log("User not found in 'usuarios' table.");
  }
}

run();
