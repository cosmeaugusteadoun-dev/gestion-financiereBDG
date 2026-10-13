// Réunit les sources existantes pour un déploiement via l'éditeur Supabase.
const fs = require('node:fs');
const dossier = 'supabase/functions/whatsapp-send';
const handler = fs.readFileSync(`${dossier}/handler.mjs`, 'utf8');
const entree = fs.readFileSync(`${dossier}/index.ts`, 'utf8')
  .replace(/^import \{ createWhatsAppHandler \} from "\.\/handler\.mjs";\s*/, '');
fs.writeFileSync('supabase/whatsapp-send-dashboard.ts',
  '// Généré par scripts/generer-whatsapp-dashboard.cjs ; ne contient aucun secret.\n'
  + handler + '\n' + entree, 'utf8');
console.log('supabase/whatsapp-send-dashboard.ts prêt à copier dans Supabase.');
