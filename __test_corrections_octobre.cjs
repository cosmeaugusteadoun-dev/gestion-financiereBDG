const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const nodes = new Map();
const node = id => { if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, disabled: false, listeners: {}, addEventListener(t, f) { this.listeners[t] = f; } }); return nodes.get(id); };
let choix = [], html = '', alertes = [], n = 0;
const ctx = vm.createContext({ console: { ...console, error() {} }, crypto: webcrypto, TextEncoder,
  document: { getElementById: node, querySelectorAll: sel => sel === '[data-profil-presence]' ? choix : [] },
  window: { addEventListener() {}, sessionStorage: { setItem() {}, getItem() { return null; } } },
  openModal: s => { html = s; }, closeModal() {}, refreshAllTabs() {}, showToast: s => alertes.push(s)
});
for (const file of ['db.js','postes.js','whatsapp.js','whatsapp-modeles.js','enfants.js','entrees.js','notes.js']) vm.runInContext(fs.readFileSync(`assets/js/${file}`, 'utf8'), ctx);
ctx.openModal = s => { html = s; };
ctx.closeModal = () => {};
ctx.refreshAllTabs = () => {};
ctx.showToast = s => alertes.push(s);
const test = (label, f) => { f(); n++; console.log('OK ' + label); };
async function main() {
  const e = { id: 'e1', nom: 'Enfant', parent: 'Parent', tel: '97320764', sect: 'mat1', opt: {} };
  ctx.STATE.enfants = [e]; ctx.STATE.postes = []; ctx.STATE.entrees = []; ctx.STATE.suivi = [];
  let captures = []; ctx.sendWhatsApp = (tel, message) => captures.push({ tel, message });
  ctx.openWhatsAppApiModal = () => { throw new Error('API interdite hors messagerie collective'); };
  ctx.ouvrirModeleParent(e, 'bilan_financier');
  test('bilan classique : texte intégral et ancien contact, sans consentement API obligatoire', () => {
    assert.equal(captures[0].message, ctx.buildBilanMessage(e, [], [])); assert.ok(captures[0].message.includes('01 97 91 94 52'));
  });
  const entree = { sect: 'Goûter', mt: 3000, date: '2026-10-15', mois: 'Oct' };
  ctx.ouvrirModeleParent(e, 'recu_paiement', { entree });
  test('reçu classique : texte original sans API', () => assert.equal(captures[1].message, ctx.buildReceiptMessage(e, entree, [], ['Goûter'])));
  ctx.ouvrirModeleParent(e, 'bulletin_trimestriel', { suivi: { trim: 'Trimestre 1', moy: 15 } });
  ctx.ouvrirModeleParent(e, 'bulletin_annuel');
  test('bulletins : boutons classiques', () => assert.equal(captures.length, 4));
  let listeClassique;
  ctx.ouvrirListeWhatsAppClassique = liste => { listeClassique = liste; };
  ctx.envoyerEnMasse([{ enfant:e, suivi:{trim:'Trimestre 1', moy:8} }], ctx.buildMessageAlerteDifficulte, 'difficulté');
  test('alertes de Notes et suivi : messages originaux sans API, même en liste', () => {
    assert.equal(listeClassique.length,1); assert.equal(listeClassique[0].message,ctx.buildMessageAlerteDifficulte(e,{trim:'Trimestre 1',moy:8}));
  });
  ctx.openEditProfilModal(e.id);
  for (const [id,value] of Object.entries({editNom:e.nom,editParent:e.parent,editTel:e.tel,editSexe:'',editCivilite:'Madame',editDdn:'',editDateInscription:''})) node(id).value = value;
  node('editConsentWhatsApp').checked = true;
  const click = () => node('modalEnregistrer').listeners.click({ currentTarget: node('modalEnregistrer') });
  ctx.dbUpdateEnfant = async () => { throw new Error('Failed to fetch'); };
  ctx.dbUpsertPostes = async () => {};
  const optAvant = JSON.stringify(e.opt);
  await click();
  test('profil coupure réseau : consentement non déclaré sauvegardé, champs conservés, erreur persistante, bouton réactivé', () => {
    assert.equal(JSON.stringify(e.opt), optAvant); assert.equal(node('editConsentWhatsApp').checked, true);
    assert.equal(node('modalEnregistrer').disabled, false); assert.equal(node('profilErreur').hidden, false);
  });
  ctx.STATE.postes = [{ id:'oct', enfant_id:e.id,key:'gout_Oct',cat:'Goûter',label:'Goûter Oct',mois:'Oct',du:3000,paye:0 }];
  choix = [{dataset:{profilPresence:'gout_Oct'},value:'absent'}];
  ctx.dbUpdateEnfant = async () => {};
  let interruption = true;
  ctx.dbUpsertPostes = async () => { if (interruption) throw new Error('Coupure postes'); };
  await click();
  test('profil sauvegardé puis postes interrompus : absence et consentement durables', () => {
    assert.equal(e.opt.mois_non_souscrits.gout_Oct.absent, true); assert.ok(e.opt.whatsapp_consent.recorded_at);
    assert.equal(node('modalEnregistrer').disabled, false);
  });
  interruption = false; await click();
  test('réessai du profil : absence appliquée, aucun montant payé ajouté', () => { assert.equal(ctx.STATE.postes[0].du,0); assert.equal(ctx.STATE.postes[0].paye,0); });
  const p = (id,cat,du,paye=0) => ({id,enfant_id:e.id,key:id,cat,label:id,mois:'Oct',du,paye});
  ctx.STATE.postes = [p('cant','Cantine',17000),p('gout','Goûter',3000)];
  const a = ctx.imputerPaiementMultiSecteur(ctx.STATE.postes,['Cantine','Goûter'],20000,'Oct');
  test('20 000 F : cantine 17 000 + goûter 3 000 exactement', () => { assert.equal(ctx.STATE.postes[0].paye,17000); assert.equal(ctx.STATE.postes[1].paye,3000); assert.equal(a.reduce((s,x)=>s+x.montant,0),20000); });
  ctx.STATE.postes = [p('cant','Cantine',17000),p('gout','Goûter',3000)];
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes,['Cantine','Goûter'],18000,'Oct');
  test('montant insuffisant : un service soldé avant le suivant, aucune proportion artificielle', () => { assert.equal(ctx.STATE.postes[0].paye,17000); assert.equal(ctx.STATE.postes[1].paye,1000); });
  ctx.STATE.postes = [p('cant','Cantine',17000,15653),p('gout','Goûter',3000,2847),p('four','Fournitures',0,1500)];
  const ancien = {id:'ancien',enfant_id:e.id,nom:e.nom,sect:'Cantine, Goûter, Fournitures',mois:'Oct',mt:20000,allocations:[{poste_id:'cant',montant:15653},{poste_id:'gout',montant:2847},{poste_id:'four',montant:1500}]};
  ctx.STATE.entrees=[ancien];
  const correction = ctx.preparerCorrectionMensuelle(ancien,'Oct',{'Cantine':17000,'Goûter':3000});
  test('ancien paiement : correction manuelle sort les 1 500 F du mauvais secteur sans changer le total encaissé', () => {
    assert.equal(correction.allocations.reduce((s,x)=>s+x.montant,0),20000); assert.equal(correction.sect,'Cantine, Goûter');
    assert.equal(correction.changements.find(x=>x.apres.id==='gout').apres.paye,3000);
    assert.equal(ctx.STATE.postes[0].paye,15653);
  });
  ctx.dbUpdateEntree=async()=>{};
  Object.assign(ancien,correction); await ctx.appliquerCorrectionMensuelle(ancien);
  test('paiement déjà corrigé : nouvelle édition possible et crédits exacts', () => { assert.equal(ctx.entreeRepartitionCorrigeable(ancien),true); assert.equal(ctx.STATE.postes.find(p=>p.id==='cant').paye,17000); });
  assert.throws(()=>ctx.preparerCorrectionMensuelle(ancien,'Oct',{'Cantine':20000,'Goûter':-1}), /entiers/);
  let optionsClient, appels = 0;
  const conf = { window:{sessionStorage:{},supabase:{createClient(_url,_key,options) { optionsClient=options;return {}; }}}, console,
    fetch:async()=>{ appels++; if(appels===1) throw new Error('réseau');return {ok:true}; } };
  vm.runInNewContext(fs.readFileSync('assets/js/config.js','utf8'),conf);
  await optionsClient.global.fetch('https://example.com',{method:'PATCH'});
  test('sauvegarde idempotente : une coupure transitoire est réessayée une fois', () => assert.equal(appels,2));
  appels=0;
  await assert.rejects(()=>optionsClient.global.fetch('https://example.com',{method:'POST'}),/réseau/);
  test('paiements et envois POST : aucun nouvel essai automatique', () => assert.equal(appels,1));
  console.log(`${n} scénarios corrections octobre : OK`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
