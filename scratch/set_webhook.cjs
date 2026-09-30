
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const evolutionUrl = env.VITE_EVOLUTION_URL || env.EVOLUTION_URL;
const evolutionKey = env.VITE_EVOLUTION_API_KEY || env.EVOLUTION_API_KEY;
const instanceName = env.VITE_INSTANCE_NAME || env.INSTANCE_NAME || 'SASAKI';

const targetWebhookUrl = "https://replypal-pro-main.vercel.app/api/evolution-webhook";

async function setWebhook() {
  console.log(`Setting webhook for instance: ${instanceName} to ${targetWebhookUrl}...`);
  
  try {
    const res = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "apikey": evolutionKey 
      },
      body: JSON.stringify({
        webhook: {
          url: targetWebhookUrl,
          enabled: true,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "MESSAGES_SET",
            "SEND_MESSAGE"
          ]
        }
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('Webhook updated successfully:', JSON.stringify(data, null, 2));
    } else {
      console.error('Failed to set webhook:', await res.text());
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

setWebhook();
