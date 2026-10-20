const fs = require('node:fs');
const types = new Set(['bilan_financier', 'relance_scolarite', 'relance_cantine',
  'alerte_difficulte', 'alerte_absences_retards', 'alerte_comportement', 'information_classe']);
const modeles = JSON.parse(fs.readFileSync('supabase/functions/whatsapp-templates.example.json', 'utf8'));
const config = modeles.filter(m => types.has(m.type)).map(({name, language, label, body, footer, fields}) =>
  ({name, language, label, body, footer, fields}));
if (config.length !== types.size) throw new Error('Catalogue collectif incomplet');
fs.writeFileSync('supabase/whatsapp-collective-config.json', JSON.stringify(config, null, 2) + '\n');
console.log(`${config.length} modèles collectifs prêts pour WHATSAPP_TEMPLATES_JSON. Vérifier les noms, langues et variables avec les modèles approuvés dans Meta.`);
