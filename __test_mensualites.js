// Régressions financières et WhatsApp, sans connexion réelle à Supabase.
// Exécution : node __test_mensualites.js
const fs = require("fs");
const vm = require("vm");
const assert = require("assert/strict");
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { value: "", disabled: false, innerHTML: "", textContent: "", listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; }, classList: { add() {}, remove() {}, toggle() {} } });
  return elements.get(id);
}
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-10-11T12:00:00"])); }
}
let ouvertures = [], toasts = [], modal = "", numeroUid = 0;
const ctx = {
  console: { log() {}, warn() {}, error() {} }, Date: TestDate,
  STATE: { enfants: [], postes: [], entrees: [], sorties: [], suivi: [] },
  document: { getElementById: element, querySelectorAll: () => [], querySelector: () => null },
  window: { addEventListener() {}, open(url, cible) { ouvertures.push({ url, cible }); return {}; } },
  fmtFCFA: n => String(n), escapeHtml: s => String(s || ""), formatDateFR: s => s,
  uid: () => `test_${++numeroUid}`, openModal: html => { modal = html; }, closeModal() {},
  showToast: (message, type) => toasts.push({ message, type }), refreshAllTabs() {}
};
vm.createContext(ctx);
for (const fichier of ["postes.js", "whatsapp-modeles.js", "entrees.js", "enfants.js", "whatsapp.js", "bilans.js"]) {
  vm.runInContext(fs.readFileSync(`${__dirname}/assets/js/${fichier}`, "utf8"), ctx, { filename: fichier });
}
const copie = x => JSON.parse(JSON.stringify(x));
const run = code => vm.runInContext(code, ctx);
let verifications = 0;
function test(titre, fn) { fn(); verifications++; console.log(`OK ${titre}`); }
function nouveau(sect = "mat1", opt = { ptdej: "oui", dej: "oui", gout: "oui", gard: "oui" }) {
  const enfant = { id: "enfant", nom: "Élève test", sect, stat: "nouveau", opt };
  ctx.STATE = { enfants: [enfant], postes: ctx.fabriquerPostesEnfant(enfant.id, sect, enfant.stat, opt), entrees: [], sorties: [], suivi: [] };
  return enfant;
}
const poste = key => ctx.STATE.postes.find(p => p.key === key);
const secteurs = ["Petit-déjeuner", "Déjeuner", "Goûter", "Garderie"];
const totalPaye = () => ctx.tPaye(ctx.STATE.postes);

async function verifier() {
  nouveau();
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, secteurs, 20000, "Oct");
  test("20 000 F : octobre soldé à 5 000 + 9 000 + 3 000 + 3 000", () => {
    assert.equal(poste("ptdej_Oct").paye, 5000); assert.equal(poste("dej_Oct").paye, 9000);
    assert.equal(poste("gard_Oct").paye, 3000); assert.equal(poste("gout_Oct").paye, 3000);
    assert.equal(poste("gard_Sep").paye, 0); assert.equal(poste("gout_Nov").paye, 0); assert.equal(totalPaye(), 20000);
    assert.ok(!ctx.STATE.postes.filter(p => p.mois === "Oct").some(ctx.posteEnRetard));
  });
  nouveau(); poste("gout_Oct").paye = 2000;
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Déjeuner", "Goûter"], 10000, "Oct");
  test("dettes annuelles différentes : solder le vrai reliquat du mois", () => {
    assert.equal(poste("dej_Oct").paye, 9000); assert.equal(poste("gout_Oct").paye, 3000); assert.equal(poste("gout_Nov").paye, 0);
  });
  nouveau(); ctx.STATE.postes.reverse();
  let allocations = ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, secteurs.slice().reverse(), 24000, "Oct");
  test("le surplus va à novembre uniquement après octobre soldé", () => {
    assert.equal(ctx.STATE.postes.filter(p => p.mois === "Oct").reduce((s, p) => s + p.paye, 0), 20000);
    assert.equal(ctx.STATE.postes.filter(p => p.mois === "Nov").reduce((s, p) => s + p.paye, 0), 4000);
    assert.equal(allocations.reduce((s, a) => s + a.montant, 0), 24000);
  });
  nouveau(); allocations = ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, secteurs, 13001, "Oct");
  test("paiement insuffisant : francs entiers, aucun franc perdu ni futur mois crédité", () => {
    assert.equal(allocations.reduce((s, a) => s + a.montant, 0), 13001);
    assert.ok(allocations.every(a => Number.isSafeInteger(a.montant) && a.poste.mois === "Oct"));
    assert.ok(ctx.STATE.postes.every(p => p.is_var || p.paye <= p.du));
  });
  nouveau(); allocations = ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Cantine", "Petit-déjeuner", "Goûter"], 17000, "Oct");
  test("Cantine et Petit-déjeuner cochés ensemble : pas de double imputation", () => {
    assert.equal(poste("ptdej_Oct").paye, 5000); assert.equal(poste("dej_Oct").paye, 9000);
    assert.equal(poste("gout_Oct").paye, 3000); assert.equal(totalPaye(), 17000);
  });
  nouveau(); ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Déjeuner", "Goûter"], 20000, "Oct", { "Déjeuner": 18000, "Goûter": 2000 });
  test("une répartition manuelle reste prioritaire", () => {
    assert.equal(poste("dej_Oct").paye, 9000); assert.equal(poste("dej_Nov").paye, 9000); assert.equal(poste("gout_Oct").paye, 2000);
  });
  nouveau("creche", {});
  ctx.STATE.postes = [{ id: "ancien", enfant_id: "enfant", key: "mens", cat: "Crèche", du: 30000, paye: 0 }];
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Crèche"], 30000, "Oct");
  test("compatibilité avec un ancien poste crèche sans mois", () => assert.equal(ctx.STATE.postes[0].paye, 30000));

  let enfant = nouveau("creche", { cantC: "oui" });
  ctx.dbUpsertPostes = async () => {}; ctx.dbUpdateEnfant = async () => {}; ctx.dbUpdateEntree = async () => {};
  await ctx.enregistrerMoisNonSouscrits(enfant, { mens_Sep: true, cantc_reduit_Sep: true, mens_Nov: true, mens_Mar: true });
  ctx.STATE.postes.filter(p => !p.mois).forEach(p => p.paye = p.du);
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Crèche", "Cantine crèche"], 43000, "Oct");
  test("arrivée en octobre : septembre absent exclu des dettes et des retards", () => {
    assert.equal(poste("mens_Sep").du, 0); assert.equal(poste("mens_Oct").paye, 30000);
    assert.equal(ctx.statutPaiement(ctx.STATE.postes), "a_jour"); assert.equal(ctx.posteEnRetard(poste("mens_Sep")), false);
    assert.ok(!ctx.construireSectionFinanciere(enfant, ctx.STATE.postes).includes("Mensualité Sep"));
  });
  const avantAbsence = totalPaye();
  await ctx.enregistrerMoisNonSouscrits(enfant, { mens_Sep: false });
  test("réactivation : tarif initial restauré, paiements conservés", () => {
    assert.equal(poste("mens_Sep").du, 30000); assert.equal(totalPaye(), avantAbsence);
    assert.equal(ctx.posteEnRetard(poste("mens_Sep")), true); assert.equal(poste("mens_Nov").du, 0); assert.equal(poste("mens_Déc").du, 30000);
  });
  test("un mois payé ne peut pas être effacé comme absent", () => assert.throws(() => ctx.preparerMoisNonSouscrits(enfant, { mens_Oct: true }), /versement/));
  test("modification des options et régénération conservent les mois absents", () => {
    const resultat = ctx.reconcilerPostes(enfant, copie(enfant.opt));
    assert.equal(resultat.find(p => p.key === "mens_Nov").du, 0);
    assert.equal(ctx.fabriquerPostesEnfant(enfant.id, enfant.sect, enfant.stat, enfant.opt).find(p => p.key === "mens_Nov").du, 0);
  });
  poste("mens_Nov").du = 30000;
  await ctx.synchroniserEtReparerDossiers(); await ctx.synchroniserEtReparerDossiers();
  test("rechargement : un ancien dû ne réapparaît pas pour un mois absent", () => { assert.equal(poste("mens_Nov").du, 0); assert.equal(totalPaye(), avantAbsence); });
  let sauvegardes = [];
  ctx.dbUpsertPostes = async p => sauvegardes.push(copie(p));
  ctx.dbUpdateEnfant = async () => { throw new Error("échec opt"); };
  await assert.rejects(() => ctx.enregistrerMoisNonSouscrits(enfant, { mens_Déc: true }), /échec opt/);
  test("échec de sauvegarde des options : aucun montant modifié", () => {
    assert.equal(sauvegardes.length, 0);
    assert.equal(poste("mens_Déc").du, 30000); assert.ok(!ctx.posteEstAbsent(poste("mens_Déc")));
  });
  ctx.dbUpdateEnfant = async () => {};
  ctx.dbUpsertPostes = async () => { throw new Error("postes indisponibles"); };
  await assert.rejects(() => ctx.enregistrerMoisNonSouscrits(enfant, { mens_Déc: true }), /Participation enregistrée/);
  // Simuler les montants obsolètes renvoyés par la base au rechargement.
  poste("mens_Déc").du = 30000;
  ctx.dbUpsertPostes = async () => {};
  await ctx.synchroniserEtReparerDossiers();
  test("absence sauvegardée mais postes interrompus : reprise sans perdre la participation", () => assert.equal(poste("mens_Déc").du, 0));
  ctx.dbUpsertPostes = async () => { throw new Error("postes indisponibles"); };
  await assert.rejects(() => ctx.enregistrerMoisNonSouscrits(enfant, { mens_Déc: false }), /Participation enregistrée/);
  poste("mens_Déc").du = 0;
  ctx.dbUpsertPostes = async () => {};
  await ctx.synchroniserEtReparerDossiers();
  test("réactivation interrompue : le tarif initial est restauré au rechargement", () => assert.equal(poste("mens_Déc").du, 30000));
  enfant = nouveau("mat1", { gout: "oui", ptdej: "oui" });
  ctx.dbUpsertPostes = async () => {}; ctx.dbUpdateEnfant = async () => {};
  await ctx.enregistrerMoisNonSouscrits(enfant, { gout_reduit_Sep: true });
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Goûter"], 3000, "Sep");
  test("mois réduit absent : le paiement ne redéfinit pas son montant", () => {
    assert.equal(poste("gout_reduit_Sep").du, 0); assert.equal(poste("gout_reduit_Sep").paye, 0); assert.equal(poste("gout_Oct").paye, 3000);
    assert.equal(poste("ptdej_Oct").paye, 0);
  });
  let optReduit = ctx.preparerMoisNonSouscrits(enfant, { gout_reduit_Sep: false });
  enfant.opt = optReduit.opt; ctx.STATE.postes = optReduit.postes;
  poste("gout_reduit_Sep").du = 1500;
  await ctx.enregistrerMoisNonSouscrits(enfant, { gout_reduit_Sep: true });
  await ctx.enregistrerMoisNonSouscrits(enfant, { gout_reduit_Sep: false });
  test("réactivation d'un mois réduit : son tarif personnalisé est conservé", () => assert.equal(poste("gout_reduit_Sep").du, 1500));
  // Une définition manuelle après réactivation reste prioritaire au rechargement.
  ctx.openEditerMontantReduitModal(poste("gout_reduit_Sep").id);
  element("editMontantReduit").value = "2000"; element("modalEnregistrer").disabled = false;
  await element("modalEnregistrer").listeners.click({ currentTarget: element("modalEnregistrer") });
  await ctx.synchroniserEtReparerDossiers();
  test("montant réduit modifié après réactivation : nouveau tarif durable", () => assert.equal(poste("gout_reduit_Sep").du, 2000));
  await ctx.enregistrerMoisNonSouscrits(enfant, { ptdej_reduit_Sep: true });
  await ctx.enregistrerMoisNonSouscrits(enfant, { ptdej_reduit_Sep: false });
  ctx.imputerPaiementMultiSecteur(ctx.STATE.postes, ["Petit-déjeuner"], 3000, "Sep");
  await ctx.synchroniserEtReparerDossiers();
  test("mois réduit réactivé puis défini par paiement : dû et versement conservés", () => {
    assert.equal(poste("ptdej_reduit_Sep").du, 3000); assert.equal(poste("ptdej_reduit_Sep").paye, 3000);
  });

  enfant = nouveau();
  const anciennes = [["ptdej_Oct", 4500], ["dej_Oct", 8000], ["gard_Sep", 3000], ["gard_Oct", 2000], ["gout_Oct", 2500]];
  anciennes.forEach(([key, mt]) => poste(key).paye = mt);
  poste("gout_Nov").paye = 1000;
  const entree = { id: "paiement", enfant_id: enfant.id, nom: enfant.nom, date: "2026-10-09", mois: null,
    sect: secteurs.join(", "), mt: 20000, allocations: anciennes.map(([key, montant]) => ({ poste_id: poste(key).id, montant })) };
  ctx.STATE.entrees = [entree, { id: "autre", enfant_id: enfant.id, sect: "Goûter", mt: 1000, allocations: [{ poste_id: poste("gout_Nov").id, montant: 1000 }] }];
  const avantCorrection = totalPaye();
  const proposition = ctx.preparerCorrectionMensuelle(entree, "Oct");
  test("aperçu de correction : aucun montant modifié avant validation", () => {
    assert.equal(totalPaye(), avantCorrection); assert.equal(poste("gout_Oct").paye, 2500);
    assert.equal(proposition.allocations.reduce((s, a) => s + a.montant, 0), 20000);
    assert.equal(proposition.changements.find(ch => ch.apres.key === "gout_Oct").apres.paye, 3000);
  });
  entree.allocations = proposition.allocations; entree.mois = proposition.mois;
  ctx.dbUpsertPostes = async () => { throw new Error("coupure réseau"); };
  await assert.rejects(() => ctx.appliquerCorrectionMensuelle(entree), /coupure réseau/);
  test("coupure après journal enregistré : correction récupérable, crédits inchangés", () => {
    assert.equal(totalPaye(), avantCorrection); assert.equal(ctx.correctionMensuelleEnAttente(enfant.id), true);
  });
  ctx.dbUpsertPostes = async () => {};
  ctx.dbUpdateEntree = async () => { throw new Error("journal final indisponible"); };
  await assert.rejects(() => ctx.appliquerCorrectionMensuelle(entree), /journal final/);
  test("écriture des postes réussie mais journal incomplet : aucun doublon", () => {
    assert.equal(totalPaye(), avantCorrection); assert.equal(poste("gout_Oct").paye, 3000); assert.equal(poste("gout_Nov").paye, 1000);
  });
  ctx.dbUpdateEntree = async () => {};
  await ctx.synchroniserEtReparerDossiers(); await ctx.synchroniserEtReparerDossiers();
  test("reprise automatique de la correction, autres paiements et encaissement conservés", () => {
    assert.equal(poste("gard_Sep").paye, 0); assert.equal(poste("gard_Oct").paye, 3000);
    assert.equal(poste("ptdej_Oct").paye, 5000); assert.equal(poste("dej_Oct").paye, 9000);
    assert.equal(poste("gout_Nov").paye, 1000); assert.equal(totalPaye(), avantCorrection);
    assert.equal(ctx.correctionMensuelleEnAttente(enfant.id), false); assert.equal(ctx.STATE.entrees.reduce((s, en) => s + en.mt, 0), 21000);
    assert.equal(ctx.entreeRepartitionCorrigeable(ctx.STATE.entrees[1]), true); assert.equal(ctx.entreeRepartitionCorrigeable(entree), true);
  });
  const sansTrace = { ...entree, allocations: [] };
  test("ancien paiement sans trace : aucune correction hasardeuse", () => assert.throws(() => ctx.preparerCorrectionMensuelle(sansTrace, "Oct"), /ne peut pas/));
  const avecConflit = copie(entree);
  avecConflit.allocations[0].correction.etat = "a_appliquer";
  poste("gout_Oct").paye += 1;
  await assert.rejects(() => ctx.appliquerCorrectionMensuelle(avecConflit), /montant a changé/);
  test("une modification concurrente empêche l'écrasement des crédits", () => assert.equal(poste("gout_Oct").paye, 3001));
  poste("gout_Oct").paye -= 1;
  ctx.confirmModal = ({ onConfirm }) => { ctx.supprimerConfirme = onConfirm; };
  ctx.dbDeleteEntree = async () => {};
  ctx.openDeleteEntreeModal(entree.id);
  await ctx.supprimerConfirme();
  test("suppression d'un paiement corrigé : retrait exact, paiement séparé intact", () => {
    assert.equal(totalPaye(), 1000); assert.equal(poste("gout_Nov").paye, 1000); assert.equal(ctx.STATE.entrees.length, 1);
  });

  const liste = [{ nom: "Alice", parent: "Parent A", tel: "97000001" }, { nom: "Bob", tel: "97000002" },
    { nom: "Sœur Alice", parent: "Parent A", tel: "+22997000001" }, { nom: "Charlie", tel: "97000003" }, { nom: "Sans téléphone", tel: "" }, { nom: "Invalide", tel: "123" }];
  ctx.fileEnvoiGroupe = ctx.preparerFileWhatsApp(liste, "Bonjour toute la liste");
  liste.pop();
  ctx.STATE.enfants = liste.map((e,i) => ({...e, id:String(i), opt:{whatsapp_consent:ctx.preparerConsentementWhatsApp(null, !!ctx.telephoneConsentementWhatsApp(e.tel), e.tel, e.parent || '')}}));
  test("WhatsApp : photographie de toute la liste filtrée et dédoublonnage des parents", () => {
    assert.equal(ctx.fileEnvoiGroupe.destinataires.length, 3); assert.equal(ctx.fileEnvoiGroupe.sansNumero, 2);
    assert.equal(ctx.fileEnvoiGroupe.destinataires[0].enfants.length, 2);
  });
  ctx.window.open = () => null;
  test("WhatsApp bloqué : aucun message déclaré envoyé", () => {
    assert.equal(ctx.ouvrirDestinataireGroupe(0), false); assert.equal(ctx.confirmerDestinataireGroupe(0), false);
    assert.equal(ctx.fileEnvoiGroupe.destinataires[0].etat, "a_traiter");
  });
  ctx.window.open = (url, cible) => { ouvertures.push({ url, cible }); return {}; };
  for (let i = 0; i < 3; i++) {
    ctx.renderFileWhatsApp();
    assert.ok(modal.includes(ctx.fileEnvoiGroupe.destinataires[i].enfants[0]));
    assert.equal(ctx.ouvrirDestinataireGroupe(i), true); assert.equal(ctx.confirmerDestinataireGroupe(i), true);
  }
  ctx.renderFileWhatsApp();
  test("WhatsApp : chaque parent est proposé, pas uniquement le premier", () => {
    assert.equal(ouvertures.length, 3); assert.equal(new Set(ouvertures.map(o => o.url)).size, 3);
    assert.ok(ctx.fileEnvoiGroupe.destinataires.every(d => d.etat === "confirme")); assert.ok(modal.includes("Liste traitée : 3"));
  });
  test("ouvrir une conversation n'est pas présenté comme un envoi automatique", () => {
    ctx.fileEnvoiGroupe = ctx.preparerFileWhatsApp(liste, "Test"); ctx.ouvrirDestinataireGroupe(0);
    assert.equal(ctx.fileEnvoiGroupe.destinataires[0].etat, "ouvert");
    assert.equal(ctx.fileEnvoiGroupe.destinataires.filter(d => d.etat === "confirme").length, 0);
  });
  const stockage = new Map();
  ctx.window.sessionStorage = { getItem: cle => stockage.get(cle) || null, setItem: (cle, valeur) => stockage.set(cle, valeur), removeItem: cle => stockage.delete(cle) };
  ctx.sauvegarderFileWhatsApp();
  const fileRestauree = ctx.restaurerFileWhatsApp();
  test("WhatsApp : reprise de la liste après rechargement de l'onglet", () => {
    assert.equal(fileRestauree.destinataires.length, 3); assert.equal(fileRestauree.destinataires[0].etat, "ouvert");
  });
  ctx.fileEnvoiGroupe = null;
  ctx.STATE.enfants = [{ id: "f1", nom: "Filtré A", sect: "mat1", tel: "97000001" }, { id: "f2", nom: "Filtré B", sect: "mat1", tel: "97000002" }, { id: "autre", nom: "Autre section", sect: "cp", tel: "97000003" }];
  ctx.STATE.enfants.forEach(e => { e.opt = {whatsapp_consent:ctx.preparerConsentementWhatsApp(null,true,e.tel,e.parent || '')}; });
  element("msgFiltreSect").value = "mat1"; element("msgTexte").value = "Message pour les deux parents";
  ctx.handleEnvoiGroupe();
  test("vrai bouton groupé : tous les destinataires du filtre, autres sections exclues", () => {
    assert.equal(ctx.fileEnvoiGroupe.destinataires.length, 2); assert.equal(ctx.fileEnvoiGroupe.destinataires[1].enfants[0], "Filtré B");
  });
  element("msgFiltreSect").value = "cp";
  ctx.handleEnvoiGroupe();
  test("changer le filtre ne perd pas les parents restant à traiter", () => {
    assert.equal(ctx.fileEnvoiGroupe.destinataires.length, 2); assert.equal(ctx.fileEnvoiGroupe.destinataires[1].enfants[0], "Filtré B");
  });

  // Vérifier le vrai formulaire : si le mois est automatique, il suit la date.
  enfant = nouveau();
  Object.entries({ eDate: "2026-10-09", eNom: enfant.nom, eMontant: "20000", eMode: "Espèces", eMois: "", eNote: "" }).forEach(([id, value]) => element(id).value = value);
  ctx.document.querySelectorAll = selector => selector === 'input[name="eSect"]:checked' ? secteurs.map(value => ({ value })) : [];
  ctx.resetEntreeForm = () => {}; ctx.dbInsertEntree = async () => {}; ctx.dbUpsertPostes = async () => {};
  await ctx.handleCreateEntree({ preventDefault() {} });
  test("formulaire : paiement daté d'octobre affecté à octobre en mode automatique", () => {
    assert.equal(ctx.STATE.entrees[0].mois, "Oct"); assert.equal(poste("gard_Sep").paye, 0); assert.equal(poste("gout_Oct").paye, 3000);
    assert.equal(ctx.STATE.entrees[0].allocations.reduce((s, a) => s + a.montant, 0), 20000);
    assert.ok(ctx.STATE.entrees[0].allocations.every(a => a.methode === "mensuel_v2"));
  });
  console.log(`\n${verifications} scénarios — TOUS LES TESTS PASSENT`);
}
verifier().catch(err => { console.error(err); process.exitCode = 1; });
