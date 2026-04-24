// Script para gerar hash de senha - execute no browser console
// Navigate para o app e execute:

async function genHash(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const saltB64 = btoa(String.fromCharCode(...salt));
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  
  const hash = btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
  
  console.log('Password:', password);
  console.log('Salt:', saltB64);
  console.log('Hash:', hash);
  console.log('\nUse: INSERT INTO usuarios SET senha_salt = ' + JSON.stringify(saltB64) + ', senha_hash = ' + JSON.stringify(hash));
}

// Execute:
genHash('admin123'); // Carlos
genHash('sasaki123'); // Gabriel