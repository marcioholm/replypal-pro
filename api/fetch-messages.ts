
// Use environment variables with fallbacks
const EVOLUTION_URL = process.env.EVOLUTION_URL || "https://evolutionapi.vps8204.panel.icontainer.cloud";
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || "F4EJNZXRtwncyMb4CD2DBCfkk8fimETc";
const INSTANCE_NAME = process.env.INSTANCE_NAME || "SASAKI";

let cachedMessages: any[] = [];

export default async function handler(req: any, res: any) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, apikey");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.json({ success: true, messages: cachedMessages, count: cachedMessages.length });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const url = EVOLUTION_URL.replace(/\/$/, "");
    const response = await fetch(`${url}/chat/getMessages/${INSTANCE_NAME}`, {
      headers: { "apikey": EVOLUTION_KEY },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: "Failed to fetch from Evolution", details: errorText });
    }

    const data = await response.json();
    const messages = data.messages || [];
    cachedMessages = messages.slice(0, 50);

    return res.json({ success: true, messages: cachedMessages, count: cachedMessages.length });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Internal error", details: String(error) });
  }
}