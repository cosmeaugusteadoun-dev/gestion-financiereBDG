// Modèles et consentement WhatsApp — Les Bulles de Joie.
function telephoneConsentementWhatsApp(tel) {
  let n = String(tel || "").replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.length === 8) n = "22901" + n;
  else if (n.length === 10 && n.startsWith("01")) n = "229" + n;
  else if (n.length === 11 && n.startsWith("229")) n = "22901" + n.slice(3);
  if (n.startsWith("229") && !(n.length === 13 && n.startsWith("22901"))) return "";
  return /^[1-9]\d{7,14}$/.test(n) ? n : "";
}
function consentementWhatsAppValide(e) {
  const c = e?.opt?.whatsapp_consent;
  return !!(c?.granted && c.recorded_at && c.phone && c.phone === telephoneConsentementWhatsApp(e.tel) && c.parent === (e.parent || "").trim());
}
function preparerConsentementWhatsApp(ancien, accord, tel, parent) {
  const phone = telephoneConsentementWhatsApp(tel), nom = (parent || "").trim();
  if (accord && !phone) throw new Error("Renseignez un numéro WhatsApp valide avant de valider le consentement.");
  const memeContact = ancien?.phone === phone && ancien?.parent === nom;
  return { granted: !!accord, phone, parent: nom,
    recorded_at: accord ? (ancien?.granted && memeContact && ancien.recorded_at ? ancien.recorded_at : new Date().toISOString()) : ancien?.recorded_at || null,
    revoked_at: accord ? null : ancien?.granted ? new Date().toISOString() : ancien?.revoked_at || null };
}
function parametreWhatsApp(value) {
  const texte = String(value ?? "").replace(/\s+/g, " ").trim() || "—";
  if (texte.length > 1024) throw new Error("Une valeur du modèle dépasse 1 024 caractères. Raccourcissez le message ou l'observation.");
  return texte;
}
function definirModeleWhatsApp(type, label, body, keys, category = "UTILITY") {
  const ordre = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
  const numeros = new Map(ordre.map((n, i) => [n, i + 1]));
  body = body.replace(/\{\{(\d+)\}\}/g, (_, n) => `{{${numeros.get(Number(n))}}}`);
  return { name: `bdj_${type}`, type, label, language: "fr", category,
    body: body + "\n\nLes Bulles de Joie · Zongo 2, Parakou\nSecrétariat : 01 97 91 94 52",
    footer: "Amour · Travail · Discipline · Créativité",
    fields: ordre.map(n => keys[n - 1]).map(key => ({ key, label: key.replace(/_/g, " "), source: "enfant" })) };
}
var BDJ_MODELES_WHATSAPP = [
  definirModeleWhatsApp("bilan_financier", "Bilan financier", "Bonjour {{1}},\nRécapitulatif concernant *{{2}}* — {{3}}.\nSituation financière au {{4}} :\nInscription / Réinscription : {{5}}\nActivités parascolaires : {{6}}\nFêtes scolaires : {{7}}\nAssurance : {{8}}\nAPE : {{9}}\nScolarité : {{10}}\nCrèche : {{11}}\nPetit-déjeuner : {{12}}\nDéjeuner : {{13}}\nCantine crèche : {{14}}\nGoûter : {{15}}\nGarderie : {{16}}\nUniformes : {{17}}\nFournitures : {{18}}\nRemise : {{19}}\nAvance : {{20}}\n*TOTAL EN RETARD : {{21}}*\nÉchéances : {{22}}\nMerci de respecter les délais indiqués.",
    ["parent","enfant","section","date","inscription","activites","fetes","assurance","ape","scolarite","creche","petit_dejeuner","dejeuner","cantine_creche","gouter","garderie","uniformes","fournitures","remise","avance","total_retard","echeances"]),
  definirModeleWhatsApp("relance_scolarite", "Relance scolarité", "Bonjour {{1}},\nSituation au {{4}} pour *{{2}}* — {{3}}.\nScolarité : {{5}}\n*TOTAL SCOLARITÉ EN RETARD : {{6}}*\nÉchéances : {{7}}\nMerci de respecter les délais indiqués.", ["parent","enfant","section","date","scolarite","retard_scolarite","echeances"]),
  definirModeleWhatsApp("relance_cantine", "Relance cantine", "Bonjour {{1}},\nSituation au {{4}} pour *{{2}}* — {{3}}.\nPetit-déjeuner : {{5}}\nDéjeuner : {{6}}\nCantine crèche : {{7}}\n*TOTAL CANTINE EN RETARD : {{8}}*\nMerci de régulariser les échéances en retard.", ["parent","enfant","section","date","petit_dejeuner","dejeuner","cantine_creche","retard_cantine"]),
  definirModeleWhatsApp("alerte_difficulte", "Élève en difficulté", "Bonjour {{1}} 👋,\nNous souhaitons attirer votre attention sur les résultats de {{2}} au {{3}} (*{{4}}*), en difficulté selon notre grille d'évaluation.\nUn accompagnement rapproché à la maison et un échange avec l'équipe pédagogique pourraient beaucoup l'aider.\nN'hésitez pas à nous contacter pour en discuter ensemble.", ["parent","enfant","trimestre","resultat"]),
  definirModeleWhatsApp("alerte_absences_retards", "Absences et retards", "Bonjour {{1}} 👋,\n⚠️ Nous constatons *{{4}} absence(s) non justifiée(s)* et *{{5}} retard(s) répétitif(s)* pour {{2}} au {{3}}.\nLa régularité est essentielle pour sa réussite : merci de veiller à sa ponctualité et de nous justifier ses absences.", ["parent","enfant","trimestre","absences","retards"]),
  definirModeleWhatsApp("alerte_comportement", "Comportement préoccupant", "Bonjour {{1}} 👋,\nNous aimerions échanger avec vous au sujet du comportement de {{2}} au {{3}}, jugé *préoccupant* par l'équipe.\nVotre implication nous serait précieuse pour l'accompagner au mieux.", ["parent","enfant","trimestre"]),
  definirModeleWhatsApp("bulletin_trimestriel", "Bulletin trimestriel", "Bonjour {{1}},\nRécapitulatif concernant *{{2}}* — {{3}}.\n📚 BILAN SCOLAIRE — {{4}}\nRésultat / appréciation : {{5}}\nComportement : {{6}}\nAbsences non justifiées : {{7}}\nRetards : {{8}}\nObservation : {{9}}\n*TOTAL FINANCIER EN RETARD : {{10}}*\nContactez l'administration pour échanger sur ce suivi ou obtenir le détail financier.", ["parent","enfant","section","trimestre","resultat","comportement","absences","retards","observation","total_retard"]),
  definirModeleWhatsApp("bulletin_annuel", "Bulletin annuel", "Bonjour {{1}},\nBilan annuel de *{{2}}* — {{3}} · {{4}}.\nTrimestre 1 : {{5}}\nTrimestre 2 : {{6}}\nTrimestre 3 : {{7}}\nPour échanger sur ce suivi, contactez l'équipe pédagogique.", ["parent","enfant","section","annee","resultat_t1","resultat_t2","resultat_t3"]),
  definirModeleWhatsApp("recu_paiement", "Reçu de paiement", "Bonjour {{1}},\nReçu de paiement pour *{{2}}* — {{3}}.\nMontant reçu : *{{4}}*\nDate : {{5}}\nObjet : {{6}}\nMois / tranche : {{7}}\nMerci pour votre règlement.", ["parent","enfant","section","montant_recu","date_recu","objet_recu","mois_recu"]),
  definirModeleWhatsApp("renouvellement_creche", "Renouvellement crèche", "Bonjour {{1}},\n📅 Rappel — Abonnement Crèche de {{2}}.\nL'abonnement annuel (inscription et assurance) arrive à échéance le *{{3}}*.\nNous vous invitons à procéder au renouvellement avant cette date afin que votre enfant continue de bénéficier de nos services sans interruption.\nN'hésitez pas à nous contacter pour toute question.", ["parent","enfant","date_renouvellement"]),
  definirModeleWhatsApp("information_classe", "Information de la classe", "Bonjour {{1}} 👋,\n📋 Information de la classe — {{2}} · {{3}}\n{{4}}\nPour toute question, contactez l'équipe.", ["parent","section","trimestre","observation"]),
];
var BDJ_MODELE_PAR_FILTRE = { impayes_scolarite: "relance_scolarite", impayes_cantine: "relance_cantine", difficulte: "alerte_difficulte", abs_ret: "alerte_absences_retards", comportement: "alerte_comportement" };
function valeursModeleWhatsApp(e, contexte = {}) {
  const postes = STATE.postes.filter(p => p.enfant_id === e.id), suivi = contexte.suivi || (typeof dernierSuiviEnfant === "function" ? dernierSuiviEnfant(e.id) : null);
  const retard = liste => posteRetardsDetail(liste).reduce((s, d) => s + d.manque, 0);
  const statut = pred => {
    const liste = postes.filter(p => !p.is_remise && p.key !== "avance" && !posteEstAbsent(p) && pred(p));
    if (!liste.length) return "—";
    const paye = liste.reduce((s, p) => s + (Number(p.paye) || 0), 0), manque = retard(liste);
    if (manque > 0) return `⚠️ ${fmtFCFA(manque)} en retard ; versé ${fmtFCFA(paye)}`;
    if (liste.every(p => p.is_var)) return `${fmtFCFA(paye)} versé`;
    if (liste.every(p => !(p.du > 0)) && liste.some(p => p.is_reduit)) return "Montant à définir";
    return `✅ ${fmtFCFA(paye)} versé ; à jour`;
  };
  const resultat = s => !s ? "Non renseigné" : e.sect === "creche" ? [...(s.qualites_positives || []), ...(s.qualites_accompagner || [])].join(" ; ") || "Suivi renseigné" : s.is_mat ? s.appreciation || "Non renseigné" : s.moy != null ? `${s.moy}/20 ; ${s.appreciation || "—"}` : "Non renseigné";
  const en = contexte.entree;
  const v = { parent: `${e.civilite && e.civilite !== "—" ? e.civilite + " " : ""}${e.parent || "cher parent"}`, enfant: e.nom, section: SECT_LABELS[e.sect] || e.sect, date: new Date().toLocaleDateString("fr-FR"),
    inscription: statut(p => p.key === "inscr"), activites: statut(p => p.key === "act"), fetes: statut(p => p.key === "fetes"), assurance: statut(p => p.key === "assur"), ape: statut(p => p.key === "ape"),
    scolarite: statut(p => p.cat === "Scolarité" && p.key !== "inscr"), creche: statut(p => p.cat === "Crèche"), petit_dejeuner: statut(p => /^ptdej_/.test(p.key)), dejeuner: statut(p => /^dej_/.test(p.key) || /^cantine_reduit_/.test(p.key)), cantine_creche: statut(p => p.cat === "Cantine crèche"), gouter: statut(p => p.cat === "Goûter"), garderie: statut(p => p.cat === "Garderie"), uniformes: statut(p => p.cat === "Uniformes"), fournitures: statut(p => p.cat === "Fournitures"),
    remise: e.remise > 0 ? `${fmtFCFA(e.remise)} sur ${e.remise_cible || "—"}` : "—", avance: fmtFCFA(postes.filter(p => p.key === "avance").reduce((s, p) => s + (Number(p.paye) || 0), 0)), total_retard: fmtFCFA(retard(postes)), retard_scolarite: fmtFCFA(retard(postes.filter(p => p.cat === "Scolarité"))), retard_cantine: fmtFCFA(retard(postes.filter(p => ["Cantine","Cantine crèche"].includes(p.cat)))),
    echeances: postes.some(p => ["t1","t2","t3"].includes(p.key)) ? "Frais généraux : 14 septembre ; T1 : 19 octobre ; T2 : 7 décembre ; T3 : 5 février" : "Mensualités : le 5 du mois ; frais annuels selon inscription",
    trimestre: contexte.trim || suivi?.trim || "Non renseigné", resultat: resultat(suivi), comportement: suivi?.comportement || "Non renseigné", absences: suivi?.absences ?? 0, retards: suivi?.retards ?? 0, observation: contexte.observation ?? suivi?.observation ?? "—", annee: e.annee || "2026-2027",
    age: typeof ageAns === "function" && e.ddn ? `${ageAns(e.ddn)} ans` : "Non renseigné", montant_recu: en ? fmtFCFA(en.mt) : "—", date_recu: en ? formatDateFR(en.date) : "—", objet_recu: en?.sect || "—", mois_recu: en?.mois || "Non précisé", date_renouvellement: contexte.dateRenouvellement ? new Date(contexte.dateRenouvellement).toLocaleDateString("fr-FR") : "—" };
  for (let n = 1; n <= 3; n++) v[`resultat_t${n}`] = resultat(STATE.suivi.find(s => s.enfant_id === e.id && s.trim === `Trimestre ${n}`));
  return v;
}
function parametresModeleEnfant(modele, enfant, contexte) {
  const v = valeursModeleWhatsApp(enfant, contexte);
  return modele.fields.map(f => parametreWhatsApp(v[f.key]));
}
function ouvrirModeleParent(e, type, contexte = {}) {
  if (!consentementWhatsAppValide(e)) { showToast("Validez le consentement WhatsApp dans le profil avant l'envoi.", "error"); return; }
  return openWhatsAppApiModal({ liste: [e], type, contextes: { [e.id]: contexte } });
}
