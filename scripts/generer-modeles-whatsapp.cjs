// Génère les textes à copier dans Meta et la configuration correspondante.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '..'), ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/whatsapp-modeles.js'), 'utf8'), ctx);
const exemples = { parent:'Madame KOSSOU', enfant:'KOSSOU Léa', section:'Maternelle 2', date:'13/10/2026', trimestre:'Trimestre 1', resultat:'Bien', comportement:'Satisfaisant', absences:'3', retards:'2', observation:'Merci de poursuivre les exercices de lecture à la maison.', total_retard:'12 000 F CFA', retard_scolarite:'12 000 F CFA', retard_cantine:'3 000 F CFA', annee:'2026-2027', resultat_t1:'Bien', resultat_t2:'Très bien', resultat_t3:'Bien', age:'5 ans', montant_recu:'20 000 F CFA', date_recu:'13/10/2026', objet_recu:'Petit-déjeuner, Déjeuner, Goûter, Garderie', mois_recu:'Oct', date_renouvellement:'20/10/2026', echeances:'Frais généraux : 14 septembre ; T1 : 19 octobre ; T2 : 7 décembre ; T3 : 5 février', remise:'2 000 F CFA sur Scolarité', avance:'0 F CFA' };
let doc = '# Modèles WhatsApp issus de notre système\n\nCes textes reprennent les usages de whatsapp.js et notes.js, avec des valeurs séparées par enfant. Les longs bilans sont synthétisés par rubrique ; le détail complet reste disponible dans le dossier.\n\n**Ils sont à soumettre à Meta : aucun n’est déclaré approuvé automatiquement.** Les catégories ci-dessous sont proposées ; Meta décide de la catégorie finale. Les annonces libres de Messagerie doivent correspondre à un modèle spécifique approuvé.\n\nDans Meta : choisir le nom exact ci-dessous, la langue **Français** (code de notre configuration : `fr`), le corps et le pied de page. Si Meta fournit un autre code de langue, reprendre ce code exact dans la configuration serveur.\n\nPied de page commun : `Amour · Travail · Discipline · Créativité`. Les exemples ci-dessous sont fictifs et doivent être renseignés lors de la soumission.\n\nPour le serveur, copier uniquement les entrées effectivement approuvées du fichier [whatsapp-templates.example.json](supabase/functions/whatsapp-templates.example.json) dans `WHATSAPP_TEMPLATES_JSON`. Ne pas activer les modèles encore en attente.\n\n';
doc += 'Les anniversaires restent en envoi individuel depuis le tableau de bord, avec les quatre variantes de texte originales. Aucun modèle anniversaire n’est à créer dans Meta.\n\n';
const modeles = Array.from(ctx.BDJ_MODELES_WHATSAPP, m => {
  if (m.body.length > 1024 || m.footer.length > 60) throw new Error('Modèle trop long : '+m.name);
  const variables = [...m.body.matchAll(/\{\{(\d+)\}\}/g)].map(x=>Number(x[1]));
  if (variables.length !== m.fields.length || variables.some((n,i)=>n !== i+1)) throw new Error('Variables incohérentes : '+m.name);
  const samples = m.fields.map(f=>exemples[f.key] || '✅ 12 000 F CFA versé ; à jour');
  doc += `## ${m.label}\n\nNom : \`${m.name}\` · Langue : \`fr\` · Catégorie proposée : **${m.category}** · Corps : ${m.body.length} caractères.\n\n\`\`\`text\n${m.body}\n\`\`\`\n\n| Variable | Donnée du système | Exemple à fournir à Meta |\n|---|---|---|\n`;
  m.fields.forEach((f,i)=>{ doc += `| {{${i+1}}} | ${f.key} | ${samples[i]} |\n`; });
  doc += '\n';
  return {...m, examples:samples};
});
fs.writeFileSync(path.join(root, 'MODELES_WHATSAPP.md'), doc, 'utf8');
fs.writeFileSync(path.join(root, 'supabase/functions/whatsapp-templates.example.json'), JSON.stringify(modeles,null,2)+'\n','utf8');
console.log(modeles.length+' modèles générés et validés (corps ≤ 1024 caractères).');
