// Les secrets restent dans un fichier .env ignoré par Git.
const fs = require('node:fs'), crypto = require('node:crypto');
const fichier='.env.push.local';
if(fs.existsSync(fichier)) {
 console.log(fichier+' existe déjà : clés conservées, aucune régénération.');
 process.exit(0);
}
const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();
const lignes=[
 'PUSH_VAPID_PUBLIC_KEY='+ecdh.getPublicKey().toString('base64url'),
 'PUSH_VAPID_PRIVATE_KEY='+ecdh.getPrivateKey().toString('base64url'),
 'PUSH_VAPID_SUBJECT=https://bdj-gestion-financiere.netlify.app',
 'PUSH_CRON_SECRET='+crypto.randomBytes(32).toString('hex'),
];
fs.writeFileSync(fichier,lignes.join('\n')+'\n',{flag:'wx',mode:0o600});
console.log('Clés créées dans '+fichier+'. Copier leurs valeurs dans les secrets Supabase, jamais dans Git.');
