// ============================================================
// Tests de régression — statuts, imputation, rendu et sauvegarde des entrées
// Exécution : node __test_statuts.js (aucune connexion à la base réelle)
// ============================================================
const fs = require("fs");
const vm = require("vm");

// Fixer la date pour que les résultats restent reproductibles toute l'année.
const RealDate = Date;
class TestDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : ["2026-10-08T12:00:00"])); }
  static now() { return new RealDate("2026-10-08T12:00:00").getTime(); }
}
const ctx = {
  console,
  fmtFCFA: n => String(n),
  escapeHtml: s => s,
  Math, Date: TestDate, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN
};
vm.createContext(ctx);

const base = __dirname + "/assets/js/";
vm.runInContext(fs.readFileSync(base + "postes.js", "utf8"), ctx, { filename: "postes.js" });
vm.runInContext(fs.readFileSync(base + "whatsapp-modeles.js", "utf8"), ctx, { filename: "whatsapp-modeles.js" });
vm.runInContext(fs.readFileSync(base + "entrees.js", "utf8"), ctx, { filename: "entrees.js" });

const run = code => vm.runInContext(code, ctx);

let echecs = 0, verifications = 0;
function assert(cond, msg) {
  verifications++;
  if (cond) { console.log("  OK  " + msg); }
  else { echecs++; console.log("  KO  " + msg); }
}

console.log("Date système : " + new Date().toISOString());

// ---------------------------------------------------------------------------
console.log("\n== 1. statutPaiement — nouveaux statuts ==");
assert(run(`statutPaiement([])`) === "a_jour", "aucun poste → à jour");
assert(run(`statutPaiement([
  {key:"t1",cat:"Scolarité",du:35000,paye:35000},
  {key:"act",cat:"Activités parascolaires",du:12000,paye:12000}])`) === "solde", "tout soldé → Soldé");
assert(run(`statutPaiement([
  {key:"t1",cat:"Scolarité",du:35000,paye:10000,dl:"20/10"},
  {key:"fetes",cat:"Fêtes scolaires",du:12000,paye:12000,dl:"07/12"}])`) === "a_jour", "rien d'échu → À jour");
assert(run(`statutPaiement([
  {key:"act",cat:"Activités parascolaires",du:12000,paye:0,dl:"19/10"}])`) === "retard_scol", "frais généraux échus → Retard de scolarité");
assert(run(`statutPaiement([
  {key:"t1",cat:"Scolarité",du:35000,paye:35000},
  {key:"fetes",cat:"Fêtes scolaires",du:12000,paye:12000},
  {key:"ptdej_Oct",cat:"Cantine",du:5000,paye:0,mois:"Oct",dl:"05/10"}])`) === "retard_cantine", "cantine échue + scolarité soldée → Retard de cantine");
assert(run(`statutPaiement([
  {key:"inscr",cat:"Inscription",du:15000,paye:15000,dl:"19/10"},
  {key:"mens_Oct",cat:"Crèche",du:30000,paye:0,mois:"Oct",dl:"05/10"}])`) === "retard_creche", "mensualité crèche échue → Retard de crèche");
assert(run(`statutPaiement([
  {key:"t1",cat:"Scolarité",du:35000,paye:0,dl:"20/10"},
  {key:"act",cat:"Activités parascolaires",du:12000,paye:0,dl:"19/10"},
  {key:"ptdej_Oct",cat:"Cantine",du:5000,paye:0,mois:"Oct",dl:"05/10"}])`) === "retard_scol", "frais généraux échus > cantine → Retard de scolarité");
assert(run(`statutPaiement([
  {key:"t1",cat:"Scolarité",du:35000,paye:32000,dl:"20/10"},
  {key:"ptdej_Oct",cat:"Cantine",du:9000,paye:0,mois:"Oct",dl:"05/10"},
  {key:"dej_Oct",cat:"Cantine",du:9000,paye:0,mois:"Oct",dl:"05/10"},
  {key:"gout_Oct",cat:"Goûter",du:6000,paye:0,mois:"Oct",dl:"05/10"}])`) === "retard_cantine", "retard cantine 24 000 > scol → Retard de cantine");
// ---------------------------------------------------------------------------
console.log("\n== 2. Priorité : frais généraux AVANT la scolarité (45 000 F) ==");
run(`
  var postesA = buildPostes("mat1", "nouveau", {});
  var allocA = imputerPaiementMultiSecteur(postesA,
    ["Scolarité Maternelle","Inscription","Activités parascolaires","Fêtes scolaires","Assurance","APE"],
    45000, null);
  var trouveA = k => (postesA.find(p => p.key === k) || {paye:0}).paye;
`);
assert(run("trouveA('fetes')") === 12000, "Fêtes scolaires soldées (12 000)");
assert(run("trouveA('act')") === 12000, "Activités parascolaires soldées (12 000)");
assert(run("trouveA('ape')") === 2500, "APE soldé (2 500)");
assert(run("trouveA('assur')") === 2000, "Assurance soldée (2 000)");
assert(run("trouveA('inscr')") === 12000, "Inscription soldée (12 000 — tarif nouveau)");
assert(run("trouveA('t1')") === 4500, "Reste 4 500 sur la 1re tranche");
assert(run("trouveA('t2')") === 0, "T2 intacte");
assert(run("allocA.reduce((s,a)=>s+a.montant,0)") === 45000, "45 000 F integralement imputes (aucun trop-percu)");

// ---------------------------------------------------------------------------
console.log("\n== 3. Departage Cantine : petit-dejeuner / dejeuner / gouter ==");
run(`
  var postesB = buildPostes("premat", "nouveau", { ptdej:"oui", dej:"non", gout:"oui" });
  imputerPaiementMultiSecteur(postesB, ["Goûter","Petit-déjeuner"], 8000, null);
  var payeB = k => (postesB.find(p => p.key === k) || {paye:0}).paye;
`);
assert(run("payeB('ptdej_Oct')") === 5000, "Petit-dejeuner Oct = 5 000 (et non 8 000)");
assert(run("payeB('gout_Oct')") === 3000, "Gouter Oct = 3 000 (rien n'est privatise)");
assert(run("postesB.reduce((s,p)=>s+(p.paye||0),0)") === 8000, "8 000 F repartis, rien perdu");

run(`
  var postesC = buildPostes("ci", "nouveau", { ptdej:"non", dej:"oui", gout:"non" });
  imputerPaiementMultiSecteur(postesC, ["Déjeuner"], 9000, null);
`);
assert(run(`postesC.find(p=>p.key==="dej_Oct").paye`) === 9000, "Dejeuner Oct = 9 000 (paiement seul en dejeuner)");
assert(run(`postesC.filter(p=>p.key.indexOf("ptdej_")===0).every(p=>!p.paye)`) === true, "Aucun poste petit-dejeuner touche");

// ---------------------------------------------------------------------------
console.log("\n== 4. Mois : versement explicite sur un mois a montant non defini ==");
// 4a. 3 000 F, secteur Petit-dejeuner, mois SEPTEMBRE -> sur Sept (montant fixe)
run(`
  var postesD = buildPostes("mat1", "nouveau", { ptdej:"oui", dej:"oui", gout:"oui" });
  var reduitD = postesD.find(p => p.key === "ptdej_reduit_Sep");
  imputerPaiementMultiSecteur(postesD, ["Petit-déjeuner"], 3000, "Sep");
`);
assert(run("reduitD.du") === 3000, "Septembre : montant du fixe a 3 000 par le versement");
assert(run("reduitD.paye") === 3000, "Septembre : 3 000 verses (solde)");
assert(run(`postesD.filter(p => p.mois === "Oct").every(p => (p.paye||0) === 0)`) === true, "Octobre/Novembre non touches");

// 4b. Mois explicite -> on commence a ce mois (Nov), pas avant
run(`
  var postesE = buildPostes("mat1", "nouveau", { ptdej:"oui", dej:"non", gout:"non" });
  imputerPaiementMultiSecteur(postesE, ["Petit-déjeuner"], 5000, "Nov");
  var payeE = k => (postesE.find(p => p.key === k) || {paye:0}).paye;
`);
assert(run("payeE('ptdej_Nov')") === 5000, "Mois « Nov » → paiement sur Novembre");
assert(run("postesE.filter(p=>p.mois==='Oct').every(p=>!p.paye)") === true, "Octobre (avant le mois choisi) ignore");

// 4c. Montant superieur a un mois reduit -> plafonne au tarif de reference
run(`
  var postesF = buildPostes("mat1", "nouveau", { ptdej:"oui", dej:"oui", gout:"non" });
  imputerPaiementMultiSecteur(postesF, ["Déjeuner"], 20000, "Sep");
  var reduitF = postesF.find(p => p.key === "dej_reduit_Sep");
`);
assert(run("reduitF.du") === 9000, "Septembre dejeuner plafonne au tarif de reference (9 000)");
assert(run("postesF.reduce((s,p)=>s+(p.paye||0),0)") === 20000, "Les 20 000 F sont repartis (suite sur les mois suivants)");

// ---------------------------------------------------------------------------
console.log("\n== 5. Controles divers ==");
// 5a. L'« Avance » existante (is_var) ne doit pas absorber le paiement
run(`
  var postesG = buildPostes("mat1", "nouveau", { ptdej:"oui", dej:"non", gout:"non" });
  postesG.push({ key:"avance", cat:"Cantine", label:"Avance / Trop-percu", du:0, paye:5000, is_var:true });
  imputerPaiementMultiSecteur(postesG, ["Petit-déjeuner"], 5000, null);
  var avanceG = postesG.find(p => p.key === "avance");
`);
assert(run("postesG.find(p=>p.key==='ptdej_Oct').paye") === 5000, "Paiement cantine sur le vrai poste, pas sur l'Avance");
assert(run("avanceG.paye") === 5000, "Avance inchangee (5 000)");

// 5b. Paiement cible sur une tranche (t1)
run(`
  var postesH = buildPostes("cm1", "ancien", {});
  imputerPaiementMultiSecteur(postesH, ["Scolarité Primaire"], 35000, "t1");
`);
assert(run(`postesH.find(p=>p.key==="t1").paye`) === 35000, "Mois « 1re tranche » → crédite bien T1");

// 5c. Secteur sans poste (ex. Gouter non souscrit) → poste a montant libre
run(`
  var postesI = buildPostes("ce1", "nouveau", { ptdej:"non", dej:"non", gout:"non", four:"non" });
  imputerPaiementMultiSecteur(postesI, ["Goûter"], 3000, null);
  var libreI = postesI.find(p => p.cat === "Goûter" && p.is_var);
`);
assert(run("libreI && libreI.paye") === 3000, "Secteur sans poste → cree a montant libre et credite (3 000)");
assert(run("postesI.some(p => p.key === 'avance')") === false, "Aucune « Avance / Trop-percu » creee");

// 5d. Priorite : fetes d'abord, reliquat ensuite sur l'inscription
run(`
  var postesJ = buildPostes("mat1", "nouveau", {});
  imputerPaiementMultiSecteur(postesJ, ["Fêtes scolaires","Scolarité Maternelle"], 15000, null);
`);
assert(run(`postesJ.find(p=>p.key==="fetes").paye`) === 12000, "Fetes (12 000) reglees d'abord");
assert(run(`postesJ.find(p=>p.key==="act").paye`) === 3000, "Reliquat de 3 000 sur les activités (avant les tranches)");

// ---------------------------------------------------------------------------
console.log("\n== 6. Reparation des postes manquants (cas de la capture d'ecran) ==");
ctx.document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null };
ctx.window = { addEventListener: () => {} };
vm.runInContext(fs.readFileSync(base + "enfants.js", "utf8"), ctx, { filename: "enfants.js" });
run(`STATE = { postes: [], enfants: [], entrees: [], suivi: [] };`);
run(`
  var enfantTest = { id: "enf1", nom: "Test", sect: "premat", stat: "nouveau", opt: {} };
  var postesInitiaux = buildPostes("premat", "nouveau", {})
    .filter(p => ["act","fetes","assur","ape"].indexOf(p.key) === -1);
  postesInitiaux.forEach(p => { p.id = "enf1_" + p.key; p.enfant_id = "enf1"; });
  STATE.postes = postesInitiaux.slice();
  var ajouts = completerPostesEnfant(enfantTest);
`);
assert(run(`ajouts.map(p=>p.key).sort().join(",")`) === "act,ape,assur,fetes", "frais généraux manquants recréés (act, ape, assur, fetes)");
assert(run(`STATE.postes.filter(p=>["act","fetes","assur","ape"].indexOf(p.key)>=0).length`) === 4, "les 4 postes ont rejoint le dossier");
assert(run(`completerPostesEnfant(enfantTest).length`) === 0, "réparation idempotente (aucun doublon)");
assert(run(`STATE.postes.filter(p=>p.key==="t1")[0].du`) === 40000, "les postes existants sont inchangés (T1 = 40 000 en prématernelle)");

console.log("\n== 7. Dettes, ventilation exacte et compatibilité ==");
assert(run(`statutPaiement([{key:"act",cat:"Activités parascolaires",du:12000,paye:0},
  {key:"avance",cat:"Cantine",du:0,paye:50000,is_var:true}])`) === "retard_scol", "une avance ne masque pas une dette échue");
assert(run(`tReste([{key:"t1",du:35000,paye:0},{key:"four",du:0,paye:45000,is_var:true}])`) === 35000, "un versement libre ne solde pas la scolarité");
run(`var repas = buildPostes("premat", "nouveau", {ptdej:"oui", dej:"oui", gout:"oui"});
  var precis = imputerPaiementMultiSecteur(repas, ["Petit-déjeuner","Goûter"], 6000, "Sep",
    {"Petit-déjeuner":3000,"Goûter":3000});`);
assert(run(`repas.find(p=>p.key==='ptdej_reduit_Sep').paye`) === 3000, "répartition explicite : petit-déjeuner septembre 3 000");
assert(run(`repas.find(p=>p.key==='gout_reduit_Sep').paye`) === 3000, "répartition explicite : goûter septembre 3 000");
assert(run(`repas.filter(p=>p.key.indexOf('dej_')===0).every(p=>!p.paye)`) === true, "déjeuner non sélectionné intact, même en septembre");
run(`imputerPaiementMultiSecteur(repas, ["Petit-déjeuner"], 2000, "Sep");`);
assert(run(`repas.find(p=>p.key==='ptdej_reduit_Sep').du`) === 3000, "un mois réduit défini ne voit pas son dû augmenter à chaque paiement");
assert(run(`repas.find(p=>p.key==='ptdej_Oct').paye`) === 2000, "le surplus progresse vers octobre après septembre soldé");
let rejet = false;
try { run(`imputerPaiementMultiSecteur(repas, ["Petit-déjeuner","Goûter"], 8000, "Sep", {"Petit-déjeuner":3000,"Goûter":3000})`); } catch (_) { rejet = true; }
assert(rejet, "répartition dont la somme est incorrecte refusée");
run(`STATE.postes = [{id:"enf1_cantine_reduit_Sep",enfant_id:"enf1",key:"cantine_reduit_Sep",cat:"Cantine",mois:"Sep",du:3000,paye:3000,is_reduit:true}];
  enfantTest.opt={ptdej:"oui",dej:"oui"}; completerPostesEnfant(enfantTest);`);
assert(run(`STATE.postes.filter(p=>p.mois==='Sep' && p.cat==='Cantine').length`) === 1, "ancien mois fusionné payé conservé sans doublon");
vm.runInContext(fs.readFileSync(base + "bilans.js", "utf8"), ctx, { filename: "bilans.js" });
vm.runInContext(fs.readFileSync(base + "dashboard.js", "utf8"), ctx, { filename: "dashboard.js" });
run(`STATE.enfants=[{id:'e',sect:'premat'}]; STATE.postes=[
  {id:'p',enfant_id:'e',key:'ptdej_reduit_Sep',cat:'Cantine'},
  {id:'g',enfant_id:'e',key:'gout_reduit_Sep',cat:'Goûter'}];
  STATE.entrees=[{mt:8000,sect:'Petit-déjeuner, Goûter',allocations:[{poste_id:'p',montant:3000},{poste_id:'g',montant:5000}]}];
  var ventilation=calculerRecettesParSecteur(true);`);
assert(run(`ventilation['Petit-déjeuner']`) === 3000, "mini-bilan : petit-déjeuner séparé");
assert(run(`ventilation['Goûter']`) === 5000, "mini-bilan : montant réel du goûter");
assert(run(`Object.values(ventilation).reduce((s,n)=>s+n,0)`) === 8000, "aucun double comptage du versement multi-secteurs");
assert(run(`calculerRecettesParSecteur().Cantine`) === 3000, "bilan général : repas regroupés sous Cantine");
assert(run(`correspondStatut('solde','a_jour')`) === true, "filtre À jour cohérent avec les dossiers soldés du graphique");
run(`STATE.entrees=[{mt:8000,sect:'Petit-déjeuner, Déjeuner'}];`);
assert(run(`calculerRecettesParSecteur().Cantine`) === 8000, "ancienne entrée cantine non comptée deux fois");
// Vérifier la syntaxe de tous les scripts sans lancer de connexion externe.
for (const file of fs.readdirSync(base).filter(f => f.endsWith('.js'))) {
  try { new vm.Script(fs.readFileSync(base + file, 'utf8'), { filename:file }); }
  catch (err) { assert(false, 'syntaxe ' + file + ': ' + err.message); }
}

async function verifierParcours() {
  console.log("\n== 9. Recettes crèche et garderie dans les bilans ==");
  run("STATE.enfants=[{id:'bebe',nom:'Bébé',sect:'creche'},{id:'midi',nom:'Midi',sect:'garderie'}]; STATE.sorties=[]; STATE.postes=[]; STATE.entrees=[{enfant_id:'bebe',sect:'Crèche',mt:30000,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 30000, "entrée crèche sans poste : 30 000 F remontent au bilan");
  run("STATE.entrees=[{sect:'Crèche',mt:30000,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 30000, "entrée crèche sans dossier enfant comptabilisée");
  run("STATE.entrees=[{enfant_id:'midi',sect:'Garderie',mt:3000,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Garderie']") === 3000, "garderie midi reste distincte de la crèche");
  run("STATE.entrees=[{sect:'Halte-Garderie',mt:3500,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Halte-Garderie']") === 3500, "halte-garderie continue d'avoir son bilan propre");
  run("STATE.entrees=[{enfant_id:'bebe',sect:'Inscription',mt:15000,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 15000, "ancienne inscription crèche sans allocations comptabilisée");
  run("STATE.postes=[{id:'i',enfant_id:'bebe',key:'inscr',cat:'Inscription',du:15000,paye:15000},{id:'m',enfant_id:'bebe',key:'mens_Oct',cat:'Crèche',du:30000,paye:30000}]; STATE.entrees=[{enfant_id:'bebe',sect:'Crèche, Inscription',mt:45000,allocations:[{poste_id:'m',montant:30000},{poste_id:'introuvable',secteur:'Inscription',montant:15000}]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 45000, "allocation partiellement orpheline : aucune recette perdue");
  assert(run("calculerEncaisseParSecteurBilan()['Crèche']") === 45000, "tableau de bord cohérent sans doubler inscription et mensualité");
  run("STATE.entrees=[];");
  assert(run("calculerEncaisseParSecteurBilan()['Crèche']") === 45000, "anciens postes payés de crèche et inscription rattachés à la même carte");
  run("STATE.postes=[{id:'f',enfant_id:'bebe',key:'four',cat:'Fournitures',du:0,paye:5000,is_var:true}]; STATE.entrees=[{enfant_id:'bebe',sect:'Crèche',mt:35000,allocations:[{poste_id:'f',montant:5000},{poste_id:'absent',montant:30000}]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 30000, "retrouver une allocation ailleurs ne fait plus disparaître les 30 000 F de crèche");
  assert(run("Object.values(calculerEncaisseParSecteurDepuisEntrees()).reduce((s,n)=>s+n,0)") === 35000, "montant total conservé sans double comptage");
  run("STATE.postes=[]; STATE.entrees=[{enfant_id:'bebe',sect:'Crèche',mt:30000,allocations:[{poste_id:'archive',montant:30000,poste:{id:'archive',enfant_id:'bebe',key:'mens_Oct',cat:'Crèche'}}]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 30000, "poste archivé : ventilation conservée grâce à la trace du paiement");
  run("STATE.entrees=[{sect:' Creche ',mt:'4000',allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 4000, "anciens libellés sans accent et montants texte reconnus");
  run("STATE.entrees=[{sect:'Creche (Garderie)',mt:4000,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 4000, "ancien libellé Crèche (Garderie) reconnu");
  run("STATE.entrees=[{enfant_id:'bebe',sect:'Crèche, Inscription, Assurance',mt:60000,allocations:[]}];");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Crèche']") === 40000, "ancienne entrée multi-secteurs : crèche et inscription conservent leurs deux parts");
  assert(run("calculerEncaisseParSecteurDepuisEntrees()['Assurance']") === 20000, "la part assurance reste distincte sans gonfler l'encaissement");
  const bilanRoot = { id:"bilansSecteurs", innerHTML:"" };
  const bilanCompteur = {};
  ctx.document = {getElementById:id => id === "bilansSecteurs" ? bilanRoot : id === "bilansSecteursCompteur" ? bilanCompteur : null};
  run("STATE.entrees=[{enfant_id:'bebe',sect:'Crèche',mt:30000,allocations:[]}]; renderBilans();");
  assert(/secteur-card-titre">Crèche<\/span>\s*<span[^>]*>30000<\/span>/.test(bilanRoot.innerHTML), "carte Crèche affichée avec 30 000 F au lieu de 0 F");

  console.log("\n== 8. Rendu et sauvegarde ==");
  run(`var automatique = buildPostes('mat1','nouveau',{});
    imputerPaiementMultiSecteur(automatique,['Scolarité Maternelle'],45000,null);`);
  assert(run(`automatique.find(p=>p.key==='t1').paye`) === 4500, "45 000 F de scolarité : tous les frais généraux sont prioritaires sans devoir les cocher");
  run(`STATE.entrees=[]; STATE.postes=buildPostes('premat','nouveau',{gout:'oui'}).reverse().map(p=>({...p,enfant_id:'chrono'}));
    var fiche=renderEnfantItem({id:'chrono',nom:'Chronologie',sect:'premat',stat:'nouveau'});`);
  assert(run(`fiche.indexOf('Goûter Sep') < fiche.indexOf('Goûter Oct') && fiche.indexOf('Goûter Oct') < fiche.indexOf('Goûter Fév')`), "dossier : septembre avant octobre et février, même si les postes arrivent inversés");

  const listeStatut = { innerHTML:'', querySelectorAll:() => [] };
  ctx.document = { getElementById:id => id === 'dashStatutListe' ? listeStatut : null };
  run(`STATE.enfants=[{id:'aj',nom:'Enfant à jour'},{id:'ret',nom:'Enfant en retard'}];
    STATE.postes=[{enfant_id:'ret',key:'act',cat:'Activités parascolaires',du:12000,paye:0}];
    filtreStatutDashActif='a_jour'; renderListeStatutDashboard();`);
  assert(listeStatut.innerHTML.includes('Enfant à jour') && !listeStatut.innerHTML.includes('Enfant en retard'), "le filtre du tableau de bord affiche uniquement les dossiers correspondants");
  const nodes = new Map();
  const listRoot = { id:'listeTest', closest:() => null, before:element => nodes.set(element.id,element) };
  ctx.document = { getElementById:id => nodes.get(id), createElement:() => ({}) };
  ctx.listRoot = listRoot;
  run(`majCompteurListe(listRoot,4); majCompteurListe(listRoot,0);`);
  assert(nodes.size === 1 && nodes.get('listeTestCompteur').textContent === '0 élément', "compteur mis à jour sans doublon, y compris sur liste vide");

  ctx.dbUpsertPostes = async () => {};
  run(`var eSync={id:'sync',nom:'Synchronisation',sect:'mat1',stat:'nouveau',opt:{}};
    STATE.enfants=[eSync]; STATE.postes=fabriquerPostesEnfant(eSync.id,eSync.sect,eSync.stat,eSync.opt);
    STATE.entrees=[{enfant_id:'sync',mt:15000,sect:'Inscription, Fêtes scolaires',note:'inscription',
      allocations:[{poste_id:'sync_fetes',montant:12000},{poste_id:'sync_act',montant:3000}]}];`);
  await run(`synchroniserEtReparerDossiers()`);
  assert(run(`STATE.postes.find(p=>p.key==='inscr').paye`) === 0, "réparation : un paiement ventilé sur d'autres frais ne crédite pas l'inscription");
  assert(run(`STATE.postes.find(p=>p.key==='act').paye`) === 3000, "restauration d'une allocation enregistrée mais non créditée");
  await run(`synchroniserEtReparerDossiers()`);
  assert(run(`STATE.postes.find(p=>p.key==='act').paye`) === 3000, "synchronisation répétée sans double crédit");
  run(`STATE.entrees.push({enfant_id:'sync',mt:5000,sect:'Fournitures',allocations:[{
    poste_id:'libre_perdu',montant:5000,poste:{id:'libre_perdu',enfant_id:'sync',key:'var_fournitures',cat:'Fournitures',label:'Fournitures',du:0,paye:5000,is_var:true}}]});`);
  await run(`synchroniserEtReparerDossiers()`);
  assert(run(`STATE.postes.find(p=>p.id==='libre_perdu').paye`) === 5000, "nouveau poste libre récupéré après échec de sauvegarde du dossier");

  const values = {eDate:'2026-10-08',eNom:'Sauvegarde',eMontant:'45000',eMode:'Espèces',eMois:'',eNote:''};
  const fields = Object.fromEntries(Object.entries(values).map(([id,value]) => [id,{value}]));
  const submit = { disabled:false };
  ctx.document = {getElementById:id => fields[id],
    querySelectorAll:selector => selector === 'input[name="eSect"]:checked' ? [{value:'Scolarité Maternelle'}] : [],
    querySelector:() => submit};
  run(`var eSave={id:'save',nom:'Sauvegarde',sect:'mat1',stat:'nouveau',opt:{}};
    STATE.enfants=[eSave]; STATE.entrees=[]; STATE.postes=fabriquerPostesEnfant('save','mat1','nouveau',{});
    selectedEnfantId='save'; var erreurs=[];
    uid=prefix=>prefix+'_test'; showToast=(message,type)=>erreurs.push({message,type});
    resetEntreeForm=()=>{}; refreshAllTabs=()=>{}; openConfirmerEnvoiRecuModal=()=>{};`);
  ctx.dbInsertEntree = async () => { throw new Error('Échec simulé'); };
  const consoleOriginal = ctx.console;
  ctx.console = { ...console, error:() => {} };
  await run(`handleCreateEntree({preventDefault(){}})`);
  assert(run(`STATE.postes.reduce((s,p)=>s+p.paye,0)`) === 0, "échec de création : aucun versement fantôme dans les dossiers");
  assert(submit.disabled === false, "bouton réactivé après échec de sauvegarde");
  ctx.dbInsertEntree = async () => {};
  ctx.dbUpsertPostes = async () => { throw new Error('Échec simulé des postes'); };
  await run(`handleCreateEntree({preventDefault(){}})`);
  assert(run(`STATE.entrees.length`) === 1 && run(`erreurs[erreurs.length-1].message.includes('Ne ressaisissez pas')`), "échec partiel : paiement conservé et avertissement contre une double saisie");
  ctx.dbUpsertPostes = async () => {};
  await run(`synchroniserEtReparerDossiers()`);
  assert(run(`STATE.postes.find(p=>p.key==='t1').paye`) === 4500, "paiement partiellement sauvegardé restauré avec sa ventilation exacte");
  ctx.console = consoleOriginal;
  console.log(`\n${verifications} vérifications — ` + (echecs === 0 ? "TOUS LES TESTS PASSENT" : echecs + " ECHEC(S)"));
  process.exit(echecs === 0 ? 0 : 1);
}
verifierParcours().catch(err => { console.error(err); process.exit(1); });

