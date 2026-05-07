
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

// Assuming the app is deployed or accessible at a certain URL.
// Since I don't know the exact production URL, I'll assume it's the one from the logs or common patterns.
// But for now, let's just CHECK the current webhook.

async function checkWebhook() {
  console.log(`Checking webhook for instance: ${instanceName}...`);
  
  try {
    const res = await fetch(`${evolutionUrl}/webhook/find/${instanceName}`, {
      headers: { "apikey": evolutionKey }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('Current Webhook Config:', JSON.stringify(data, null, 2));
    } else {
      console.error('Failed to find webhook:', await res.text());
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkWebhook();
