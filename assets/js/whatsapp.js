// ============================================================
// whatsapp.js — Construction et envoi des messages WhatsApp
// Couvre l'onglet "WhatsApp" (bilan par enfant) et l'onglet
// "Messagerie" (envoi collectif à tous les parents).
// ============================================================

// ---------- Formatage du numéro (indicatif Bénin +229) ----------
function formatTelWA(tel) {
  let n = (tel || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("229")) return n;
  if (n.startsWith("0")) n = "229" + n.slice(1);
  if (n.length === 8) n = "229" + n;
  return n;
}

// Ouvre WhatsApp Web / app avec le message pré-rempli
function sendWhatsApp(tel, message) {
  const numero = formatTelWA(tel);
  if (!numero) {
    showToast("Aucun numéro WhatsApp enregistré pour ce parent.", "error");
    return;
  }
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

// ============================================================
// REÇU DE PAIEMENT (envoyé juste après l'enregistrement d'une entrée)
// Trois modèles selon l'objet réel du versement :
//   • CANTINE   — point du mois payé + rappel de l'échéance du mois suivant.
//                  La cantine est facultative et se règle mois par mois :
//                  elle n'entre donc jamais dans un « solde global ».
//   • SCOLARITÉ — point global de la scolarité (frais généraux + tranches)
//                  accompagné des dates d'échéance.
//   • AUTRE     — simple accusé de réception (uniforme, fournitures,
//                  garderie, activités, fêtes, APE, inscription...).
// ============================================================
var WA_SEP = "━━━━━━━━━━━━━━";
var WA_SITE = "lesbullesdejoie-benin.com";
var WA_TEL = "01 97 91 94 52";
var WA_SIGNATURE = "Amour · Travail · Discipline · Créativité";

// Titre du reçu hors cantine/scolarité — libellé au singulier
// (« reçu · UNIFORME », « reçu · FOURNITURE »...)
var WA_TITRE_SECTEUR = {
  "Uniformes": "UNIFORME", "Fournitures": "FOURNITURE", "Garderie": "GARDERIE",
  "Halte-Garderie": "HALTE-GARDERIE", "Goûter": "GOÛTER", "Crèche": "CRÈCHE",
  "Cantine crèche": "CANTINE CRÈCHE", "Activités parascolaires": "ACTIVITÉS PARASCOLAIRES",
  "Fêtes scolaires": "FÊTES SCOLAIRES", "Assurance": "ASSURANCE", "APE": "APE",
  "Inscription": "INSCRIPTION"
};

var MOIS_ORDRE_RECUE = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
var MOIS_LONG_RECUE = {
  "Jan":"janvier", "Fév":"février", "Mar":"mars",   "Avr":"avril",
  "Mai":"mai",     "Jun":"juin",    "Jul":"juillet","Aoû":"août",
  "Sep":"septembre","Oct":"octobre","Nov":"novembre","Déc":"décembre"
};
var MOIS_NUM_RECUE = {
  "Jan":1,"Fév":2,"Mar":3,"Avr":4,"Mai":5,"Jun":6,"Jul":7,"Aoû":8,
  "Sep":9,"Oct":10,"Nov":11,"Déc":12
};
var TRANCHE_LABELS_RECUE = { t1: "1ère tranche", t2: "2ème tranche", t3: "3ème tranche" };

// Montant court pour les lignes de détail (« 12 000 F », sans « CFA »).
// Même normalisation que fmtFCFA (db.js) : l'espace fine insécable que produit
// toLocaleString("fr-FR") est remplacée par une espace normale, sinon le
// montant affiché dans le message diffère de tous les autres.
function montantCourt(n) {
  return Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/ /g, " ") + " F";
}

// Première lettre en capitale (« octobre » -> « Octobre »)
function capitaleFR(txt) {
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt;
}

// Échéance d'un poste (« 05/10 ») complétée par l'année scolaire (sept. 2026 → août 2027)
function echeanceAvecAnnee(dl) {
  if (!dl) return "";
  const parts = String(dl).split("/").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return dl;
  return `${String(parts[0]).padStart(2, "0")}/${String(parts[1]).padStart(2, "0")}/${parts[1] >= 9 ? 2026 : 2027}`;
}

// Échéance de la cantine : le 5 du mois. Certains postes n'ont pas de date en
// base (cantine crèche des mois pleins) — on applique la règle générale.
function echeanceCantine(mois, dl) {
  if (dl) return echeanceAvecAnnee(dl);
  const m = MOIS_NUM_RECUE[mois];
  if (!m) return "";
  return `05/${String(m).padStart(2, "0")}/${m >= 9 ? 2026 : 2027}`;
}

// Mois scolaire en cours (hors septembre → août, on repart de septembre)
function moisScolaireCourant() {
  const num = new Date().getMonth() + 1;
  return Object.keys(MOIS_NUM_RECUE).find(k => MOIS_NUM_RECUE[k] === num) || "Sep";
}

// Pied de page commun à tous les reçus
function piedRecuWA(enfant) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? `${enfant.civilite} ` : "";
  const qui = enfant.parent ? `${civiliteTxt}${enfant.parent}` : (enfant.nom || "");
  return `Merci ${qui} 🙏\n💛 Les Bulles de Joie 🫧🌸\n📍 Zongo 2, Parakou\n🌐 ${WA_SITE}\n📱 Secrétariat : ${WA_TEL}\n${WA_SIGNATURE}`;
}

// En-tête commun : titre, élève, classe, montant, date et mode de paiement.
// `separateurFinal` = false pour un reçu sans corps (article seul) : la
// séparation est déjà ajoutée par buildReceiptMessage, inutile d'en mettre deux.
function enteteRecu(titre, enfant, montantRecu, dateMode, ligneAffectation, separateurFinal) {
  let t = `🫧 REÇU · ${titre} 🫧\n${WA_SEP}\n`;
  t += `👤 Élève : ${enfant.nom || "—"}\n`;
  t += `🏫 Classe : ${SECT_LABELS[enfant.sect] || enfant.sect || "—"}\n`;
  t += `💰 Montant reçu : ${montantRecu}\n`;
  if (ligneAffectation) t += `${ligneAffectation}\n`;
  t += `📅 ${dateMode}\n`;
  if (separateurFinal !== false) t += `${WA_SEP}\n`;
  return t;
}

function buildReceiptMessage(enfant, entree, postesEnfant, secteurs) {
  const nomsSecteurs = (secteurs && secteurs.length)
    ? secteurs
    : (entree.sect || "").split(",").map(s => s.trim()).filter(Boolean);

  const montantRecu = fmtFCFA(entree.mt);
  const dateMode = `${formatDateFR(entree.date)} · 💳 ${entree.mode}`;

  // Le Petit-déjeuner et le Déjeuner sont saisis séparément mais relèvent
  // du même reçu « Cantine » (mois en cours + échéance du mois suivant).
  const estCantine = nomsSecteurs.some(s => s === "Cantine" || s === "Cantine crèche" || s === "Petit-déjeuner" || s === "Déjeuner");
  const estScolarite = nomsSecteurs.some(s => s === "Scolarité Maternelle" || s === "Scolarité Primaire");

  let corps;
  if (estCantine) corps = corpsRecuCantine(enfant, entree, postesEnfant, nomsSecteurs, montantRecu, dateMode);
  else if (estScolarite) corps = corpsRecuScolarite(enfant, entree, postesEnfant, montantRecu, dateMode);
  else corps = corpsRecuAutre(enfant, nomsSecteurs, montantRecu, dateMode);

  return `${corps}${WA_SEP}\n${piedRecuWA(enfant)}`;
}
// ---------- REÇU CANTINE : reste du mois + échéance du mois suivant ----------
// La cantine étant facultative et facturée mois par mois, ce reçu ne parle
// QUE du mois payé et de l'échéance du mois suivant — jamais d'un solde global
// qui engloberait la scolarité.
function corpsRecuCantine(enfant, entree, postesEnfant, secteurs, montantRecu, dateMode) {
  const cat = secteurs.includes("Cantine crèche") ? "Cantine crèche" : "Cantine";
  const mois = entree.mois || moisScolaireCourant();

  let t = enteteRecu("CANTINE", enfant, montantRecu, dateMode);

  const postesDuMois = postesEnfant.filter(p => p.cat === cat && p.mois === mois && !p.is_remise);
  const resteMois = postesDuMois.reduce((s, p) => s + Math.max((p.du || 0) - (p.paye || 0), 0), 0);
  t += `🍽️ Reste pour ${MOIS_LONG_RECUE[mois] || mois.toLowerCase()} : ${montantCourt(resteMois)}${resteMois <= 0 ? " ✅" : ""}\n`;

  const idx = MOIS_ORDRE_RECUE.indexOf(mois);
  const moisSuivant = idx >= 0 ? MOIS_ORDRE_RECUE[idx + 1] : null;
  if (moisSuivant) {
    const postesSuivant = postesEnfant.filter(p => p.cat === cat && p.mois === moisSuivant && !p.is_remise);
    const duSuivant = postesSuivant.reduce((s, p) => s + (p.du || 0), 0);
    if (duSuivant > 0) {
      const dl = postesSuivant.map(p => p.dl).find(Boolean);
      t += `🔔 ${capitaleFR(MOIS_LONG_RECUE[moisSuivant] || moisSuivant)} : ${montantCourt(duSuivant)}, à payer avant le ${echeanceCantine(moisSuivant, dl)}\n`;
    }
  }
  return t;
}

// ---------- REÇU SCOLARITÉ : détail par poste + échéances + total restant ----------
// C'est le SEUL reçu qui donne un « point global », et il porte exclusivement
// sur la scolarité (inscription, frais généraux, tranches) avec les dates
// d'échéance — la cantine n'y entre jamais.
function corpsRecuScolarite(enfant, entree, postesEnfant, montantRecu, dateMode) {
  const tranche = entree.mois && TRANCHE_LABELS_RECUE[entree.mois];
  const affectation = tranche ? `📌 Affecté à : Scolarité, ${tranche}` : "📌 Affecté à : Scolarité";

  let t = enteteRecu("SCOLARITÉ", enfant, montantRecu, dateMode, affectation);
  t += `📋 Détail par poste\n`;

  const retenus = postesEnfant.filter(p =>
    !p.is_var && !p.is_remise && p.key !== "avance" &&
    ["Scolarité", "Fêtes scolaires", "Activités parascolaires", "Assurance", "APE"].includes(p.cat));

  const lignes = [];
  const ajouterLigne = (libelle, postes) => {
    if (!postes.length) return;
    const du = postes.reduce((s, p) => s + (p.du || 0), 0);
    const paye = postes.reduce((s, p) => s + (p.paye || 0), 0);
    const reste = Math.max(du - paye, 0);
    lignes.push(reste <= 0
      ? `✅ ${libelle} : ${montantCourt(paye)} soldé`
      : `⏳ ${libelle} : ${montantCourt(paye)} payé / reste ${montantCourt(reste)}`);
  };

  ajouterLigne("Inscription", retenus.filter(p => p.key === "inscr"));
  retenus.filter(p => p.key !== "inscr" && !["t1","t2","t3"].includes(p.key))
    .forEach(p => ajouterLigne(p.cat, [p]));
  ajouterLigne("Scolarité", retenus.filter(p => ["t1","t2","t3"].includes(p.key)));
  lignes.forEach(l => { t += `${l}\n`; });
  t += `${WA_SEP}\n`;

  t += `🗓️ Échéances de la scolarité\n`;
  ["t1","t2","t3"].forEach(key => {
    const poste = postesEnfant.find(p => p.key === key && p.cat === "Scolarité");
    if (!poste) return;
    const paye = poste.paye || 0;
    const reste = Math.max((poste.du || 0) - paye, 0);
    const montant = reste <= 0 ? "soldé ✅" : (paye > 0 ? `reste ${montantCourt(reste)}` : montantCourt(reste));
    t += `▫️ ${TRANCHE_LABELS_RECUE[key]} · ${echeanceAvecAnnee(poste.dl)} → ${montant}\n`;
  });
  t += `${WA_SEP}\n`;

  const postesScolarite = postesEnfant.filter(p => p.cat === "Scolarité" && !p.is_var && !p.is_remise && p.key !== "avance");
  const totalReste = postesScolarite.reduce((s, p) => s + Math.max((p.du || 0) - (p.paye || 0), 0), 0);
  t += totalReste > 0
    ? `⏳ Total restant à payer : ${montantCourt(totalReste)}\n`
    : `✅ Scolarité intégralement soldée\n`;

  return t;
}

// ---------- REÇU AUTRE : simple accusé de réception ----------
// Uniformes, fournitures, garderie, activités, fêtes, APE, inscription… : le
// parent reçoit la confirmation de son versement, sans point de situation.
function corpsRecuAutre(enfant, secteurs, montantRecu, dateMode) {
  const libelle = secteurs[0] || "Paiement";
  return enteteRecu(WA_TITRE_SECTEUR[libelle] || libelle.toUpperCase(), enfant, montantRecu, dateMode, null, false);
}
// ============================================================
// MESSAGE — BILAN COMPLET (envoyé manuellement depuis un dossier)
// ============================================================

// Ordre d'affichage des catégories — reproduit exactement l'ordre du
// modèle validé (Cantine crèche puis Crèche pour la crèche ; Scolarité en
// tête pour Maternelle/Primaire). Uniformes et Fournitures (montant libre)
// n'y figurent jamais — ce ne sont pas des échéances à régulariser.
// « Inscription » y figure pour les enfants de crèche, dont le poste
// d'inscription porte cette catégorie-là (chez les Maternelle/Primaire il est
// déjà regroupé dans « Scolarité ») : sans elle, la ligne disparaissait
// complètement du bilan des dossiers de crèche.
var ORDRE_CATEGORIES_BILAN = [
  "Cantine crèche", "Crèche", "Inscription", "Scolarité", "Activités parascolaires",
  "Fêtes scolaires", "Assurance", "APE", "Cantine", "Goûter", "Garderie"
];

var MOIS_ORDRE_BILAN = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];

// Postes "frais généraux" — mêmes clés que le seuil de retard du 16
// septembre dans posteEnRetard (postes.js), utilisées ici pour savoir si
// le rappel informatif du 14 septembre doit apparaître dans le message.
var CLES_FRAIS_GENERAUX = ["inscr", "act", "fetes", "assur", "ape"];

// Une petite touche vivante et ludique par secteur — ce message s'adresse
// aux parents d'enfants de crèche/maternelle/primaire, autant que possible
// il doit rester chaleureux plutôt que comptable.
var CAT_EMOJI_BILAN = {
  "Cantine crèche": "🍼", "Crèche": "👶", "Scolarité": "🎒",
  "Inscription": "📄",
  "Activités parascolaires": "🎨", "Fêtes scolaires": "🎉",
  "Assurance": "🛡️", "APE": "🤝", "Cantine": "🍽️",
  "Goûter": "🍪", "Garderie": "🕒"
};

// Bloc "SITUATION FINANCIERE" complet (titre, détail par catégorie, total,
// rappel des échéances) — bloc autonome réutilisé tel quel par le bilan
// financier seul (buildBilanMessage) ET par le rapport combiné envoyé
// depuis Notes & Suivi (buildMessageBulletin) : le rendu financier ne
// change jamais selon l'endroit d'où il est envoyé.
// On mentionne d'abord ce qui est déjà réglé (✅), puis uniquement les
// échéances réellement en retard (⚠️) — jamais les mois à venir qui ne
// sont pas encore dus, pour ne pas donner une impression de dette qui
// n'existe pas encore.
function construireSectionFinanciere(enfant, postesEnfant) {
  const aujourdHui = new Date().toLocaleDateString("fr-FR");
  const DIV = "────────────────────";

  let texte = `💰 *SITUATION FINANCIERE*\n${DIV}\n`;
  texte += `Voici le détail de votre situation au ${aujourdHui} :\n\n`;

  let totalRetard = 0;
  let aDesFraisScolarite = false;
  const aDesFraisGeneraux = postesEnfant.some(p => CLES_FRAIS_GENERAUX.includes(p.key));

  ORDRE_CATEGORIES_BILAN.forEach(cat => {
    const lignes = postesEnfant
      .filter(p => p.cat === cat && !p.is_var && !p.is_remise && p.key !== "avance")
      .sort((a, b) => {
        const am = a.mois ? MOIS_ORDRE_BILAN.indexOf(a.mois) : -1;
        const bm = b.mois ? MOIS_ORDRE_BILAN.indexOf(b.mois) : -1;
        return am - bm;
      });
    if (lignes.length === 0) return;
    if (cat === "Scolarité") aDesFraisScolarite = true;

    const blocs = [];
    lignes.forEach(p => {
      const du = p.du || 0;
      const paye = p.paye || 0;
      const retard = posteEnRetard(p);

      if (paye >= du && du > 0) {
        blocs.push(`✅ ${escapeHtml(p.label)} : ${fmtFCFA(paye)} payé`);
      } else if (paye > 0) {
        let ligne = `✅ ${escapeHtml(p.label)} : ${fmtFCFA(paye)} déjà versé`;
        if (retard) {
          const reste = Math.max(du - paye, 0);
          totalRetard += reste;
          ligne += ` — ⚠️ reste ${fmtFCFA(reste)} en retard`;
        }
        blocs.push(ligne);
      } else if (retard) {
        totalRetard += du;
        blocs.push(`⚠️ ${escapeHtml(p.label)} : ${fmtFCFA(du)} en retard de paiement`);
      } else if (CLES_FRAIS_GENERAUX.includes(p.key)) {
        // Frais généraux non encore échus : on les affiche quand même, sinon le
        // parent ne voit dans le détail QUE les rubriques déjà soldées ou en
        // retard — ce qui contredit le rappel « Frais généraux » du bas du
        // message et masque l'Assurance, les Activités, les Fêtes, l'APE…
        blocs.push(`⏳ ${escapeHtml(p.label)} : ${fmtFCFA(0)} payé / reste ${fmtFCFA(du)}`);
      }
      // Sinon : mensualité ou tranche pas encore échue — on n'en parle pas au
      // parent pour ne pas afficher une dette qui n'existe pas encore.
    });

    if (blocs.length === 0) return;
    texte += `${CAT_EMOJI_BILAN[cat] || "•"} *${cat}*\n`;
    blocs.forEach(b => { texte += `  ${b}\n`; });
    texte += `\n`;
  });

  // Remise éventuelle — créditée directement sur les échéances concernées,
  // simplement rappelée ici pour la transparence avec le parent.
  if (enfant.remise > 0) {
    texte += `🎁 Remise accordée : -${fmtFCFA(enfant.remise)} sur ${enfant.remise_cible || "—"}\n\n`;
  }

  // Avance / trop-perçu : uniquement s'il y en a un réellement — jamais de
  // mention si aucun paiement n'a dépassé le montant dû.
  const avancePostes = postesEnfant.filter(p => p.key === "avance" && (p.paye || 0) > 0);
  if (avancePostes.length > 0) {
    const totalAvance = avancePostes.reduce((s, p) => s + (p.paye || 0), 0);
    texte += `💚 *Avance / Trop-perçu : ${fmtFCFA(totalAvance)}*\n`;
    texte += `Ce montant sera automatiquement déduit de vos prochains paiements.\n\n`;
  }

  texte += `${DIV}\n`;
  texte += totalRetard > 0
    ? `*⚠️ TOTAL EN RETARD : ${fmtFCFA(totalRetard)}*\n\n`
    : `*✅ Aucun retard de paiement — merci pour votre régularité !*\n\n`;

  // Rappel informatif (pas un impayé) : les frais généraux doivent être
  // soldés dès l'inscription, au plus tard le 14 septembre.
  if (aDesFraisGeneraux) {
    texte += `📌 *Frais généraux (Inscription, Assurance, Activités parascolaires, Fêtes scolaires, APE)*\n`;
    texte += `À solder au plus tard le 14 Septembre.\n\n`;
  }

  // Rappel des échéances de tranches — uniquement pour Maternelle/Primaire
  if (aDesFraisScolarite) {
    texte += `📅 *Échéances des tranches de scolarité*\n`;
    texte += `1ère tranche : au plus tard le 19 Octobre\n`;
    texte += `2ème tranche : au plus tard le 07 Décembre\n`;
    texte += `3ème tranche : au plus tard le 05 Février\n\n`;
  }

  texte += totalRetard > 0
    ? `Merci de respecter les délais indiqués ci-dessus. 🙏\n\n`
    : `Merci de continuer à respecter les délais indiqués ci-dessus. 🙏\n\n`;

  return texte;
}

function buildBilanMessage(enfant, postesEnfant, suiviEnfant) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? `${enfant.civilite} ` : "";
  const destinataire = enfant.parent ? `${civiliteTxt}${enfant.parent}` : "cher parent";
  const section = SECT_LABELS[enfant.sect] || enfant.sect;
  const DIV = "────────────────────";

  let msg = `Bonjour ${destinataire},\n\n`;
  msg += `Veuillez trouver ci-dessous le récapitulatif concernant votre enfant :\n`;
  msg += `*${enfant.nom}* - ${section}\n${DIV}\n\n`;
  msg += construireSectionFinanciere(enfant, postesEnfant);
  msg += `${DIV}\n`;
  msg += `💛🌸 Adorables parents, vous êtes nos meilleurs partenaires !\n`;
  msg += `Nous vous remercions pour votre confiance et votre engagement.\n`;
  msg += `Ensemble construisons l avenir de nos enfants avec amour et discipline. 💛\n\n`;
  msg += `💛 Les Bulles de Joie 🫧🌸\n`;
  msg += `📍 Zongo 2, Parakou\n`;
  msg += `🌐 ${WA_SITE}\n`;
  msg += `📱 Secrétariat : ${WA_TEL}\n`;
  msg += `${WA_SIGNATURE}`;

  return msg;
}

// ============================================================
// MESSAGE — ANNIVERSAIRE (4 variantes chaleureuses)
// ============================================================
function buildAnniversaireMessage(enfant) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];
  const age = ageAns(enfant.ddn);

  const variantes = [
    `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\nQuelle belle journée pour ${prenom} ! 🎉🎂 Toute l'équipe des Bulles de Joie se joint à vous pour lui souhaiter un merveilleux anniversaire${age != null ? ` et ses ${age} ans` : ""} !`,
    `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\nC'est un jour spécial aujourd'hui ! 🎈 ${prenom} fête son anniversaire${age != null ? ` (${age} ans)` : ""} et toute l'école lui envoie plein d'amour et de bisous 💛.`,
    `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n🎂 Joyeux anniversaire à notre adorable ${prenom} ! ${age != null ? `${age} ans aujourd'hui, ` : ""}quelle fierté de le/la voir grandir parmi nous.`,
    `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n✨ Aujourd'hui c'est la fête pour ${prenom} ! ${age != null ? `${age} bougies à souffler ` : ""}et toute une école qui l'entoure de tendresse 🫧.`
  ];

  const idx = new Date().getDay() % variantes.length;
  let msg = variantes[idx].replace(/ {2,}/g, " ");
  msg += `\n\nNous te souhaitons une année remplie de joie, de rires et de découvertes 🌸\n\n`;
  msg += `Avec toute notre affection,\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n`;
  msg += `📍 Zongo 2, Parakou\n🌐 ${WA_SITE}\n📱 Secrétariat : ${WA_TEL}\n`;
  msg += `_${WA_SIGNATURE}_`;
  return msg;
}

// ============================================================
// MESSAGE — RAPPEL D'ABONNEMENT CRÈCHE (12 mois glissants)
// ============================================================
function buildMessageRenouvellementCreche(enfant, dateRenouvellement) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? `${enfant.civilite} ` : "";
  const destinataire = enfant.parent ? `${civiliteTxt}${enfant.parent}` : "cher parent";
  const prenom = (enfant.nom || "").split(" ")[0];
  const dateTxt = dateRenouvellement.toLocaleDateString("fr-FR");

  let msg = `Bonjour ${destinataire},\n\n`;
  msg += `📅 *Rappel — Abonnement Crèche de ${prenom}*\n\n`;
  msg += `L'abonnement annuel (inscription et assurance) de ${prenom} arrive à échéance le *${dateTxt}*.\n\n`;
  msg += `Nous vous invitons à procéder au renouvellement avant cette date afin que ${prenom} continue de bénéficier de nos services sans interruption.\n\n`;
  msg += `N'hésitez pas à nous contacter pour toute question.\n\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n`;
  msg += `📍 Zongo 2, Parakou\n🌐 ${WA_SITE}\n📱 Secrétariat : ${WA_TEL}\n`;
  msg += `_${WA_SIGNATURE}_`;
  return msg;
}

// ============================================================
// RENDU — ONGLET WHATSAPP (bilan par enfant)
// ============================================================
function renderWhatsAppTab() {
  const root = document.getElementById("waList");
  if (!root) return;
  const recherche = (document.getElementById("waRecherche")?.value || "").trim().toLowerCase();

  const liste = STATE.enfants
    .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
    .sort((a, b) => a.nom.localeCompare(b.nom));

  majCompteurListe(root, liste.length);

  if (liste.length === 0) {
    root.innerHTML = `<div class="empty-state"><div class="icon"><i class="bi bi-whatsapp"></i></div>Aucun enfant trouvé.</div>`;
    return;
  }

  root.innerHTML = liste.map(e => {
    const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
    const reste = tReste(postesEnfant);
    const aTel = !!formatTelWA(e.tel);
    return `
      <div class="msg-row">
        <div class="msg-info">
          <div class="msg-name">${escapeHtml(e.nom)} <span class="text-muted">— ${SECT_LABELS[e.sect] || e.sect}</span></div>
          <div class="msg-tel">${e.tel ? escapeHtml(e.tel) : "Pas de numéro"} · Reste : ${fmtFCFA(reste)}</div>
        </div>
        <button class="btn btn-whatsapp btn-sm" data-wa-bilan="${e.id}" ${aTel ? "" : "disabled"}><i class="bi bi-whatsapp"></i> Envoyer bilan</button>
      </div>`;
  }).join("");

  root.querySelectorAll("[data-wa-bilan]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.waBilan);
      if (!enfant) return;
      const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
      const suiviEnfant = STATE.suivi.filter(s => s.enfant_id === enfant.id);
      ouvrirModeleParent(enfant, "bilan_financier");
    });
  });
}

// ============================================================
// RENDU — ONGLET MESSAGERIE (envoi collectif)
// ============================================================
// Liste des enfants correspondant aux filtres actuels de la Messagerie
// (recherche texte + section + préréglage). Réutilisée par le rendu de la
// liste et par le bouton d'envoi groupé, pour rester toujours cohérentes.
// Dernier suivi trimestriel renseigné pour un élève (le plus récent
// trimestre disponible), utilisé par les filtres d'alerte de la Messagerie
// — indépendant du trimestre actuellement sélectionné dans Notes & Suivi.
var ORDRE_TRIM_RECENT = ["Trimestre 3", "Trimestre 2", "Trimestre 1"];
function dernierSuiviEnfant(enfantId) {
  for (const trim of ORDRE_TRIM_RECENT) {
    const s = STATE.suivi.find(sv => sv.enfant_id === enfantId && sv.trim === trim);
    if (s) return s;
  }
  return null;
}

// Un enfant est concerné par une relance de catégorie s'il a au moins un
// poste en retard dans les catégories visées — pas seulement "pas encore
// soldé sur l'année", sinon presque tout le monde serait relancé jusqu'en
// juin (voir posteEnRetard, postes.js).
function aRetardDansCategories(enfantId, cats) {
  return STATE.postes.some(p => p.enfant_id === enfantId && cats.includes(p.cat) && posteEnRetard(p));
}

function enfantsFiltresMessagerie() {
  const recherche = (document.getElementById("msgRecherche")?.value || "").trim().toLowerCase();
  const filtreSect = document.getElementById("msgFiltreSect")?.value || "";
  const preset = document.getElementById("msgFiltrePreset")?.value || "tous";

  return STATE.enfants
    .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
    .filter(e => !filtreSect || e.sect === filtreSect)
    .filter(e => {
      if (preset === "creche") return CRECHE_SECTS.includes(e.sect);
      if (preset === "maternelle") return MAT_SECTS.includes(e.sect);
      if (preset === "primaire") return PRIM_SECTS.includes(e.sect);
      // Scolarité et Cantine se relancent séparément : les échéances ne
      // tombent pas aux mêmes dates, on ne veut pas les mélanger.
      if (preset === "impayes_scolarite") return aRetardDansCategories(e.id, ["Scolarité"]);
      if (preset === "impayes_cantine") return aRetardDansCategories(e.id, ["Cantine", "Cantine crèche"]);
      if (preset === "difficulte") return estEnDifficulte(dernierSuiviEnfant(e.id));
      if (preset === "abs_ret") return aAlerteAbsRet(dernierSuiviEnfant(e.id));
      if (preset === "comportement") return aComportementPreoccupant(dernierSuiviEnfant(e.id));
      return true;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

// Assemble le titre/objet (s'il y en a un) avec le corps du message
function composerMessageMessagerie() {
  const titre = document.getElementById("msgTitre").value.trim();
  const texte = document.getElementById("msgTexte").value.trim();
  return titre ? `*${titre}*\n\n${texte}` : texte;
}

function renderMessagerieTab() {
  const root = document.getElementById("msgList");
  if (!root) return;

  const liste = enfantsFiltresMessagerie();
  majCompteurListe(root, liste.length);

  if (liste.length === 0) {
    root.innerHTML = `<div class="empty-state"><div class="icon"><i class="bi bi-megaphone"></i></div>Aucun parent trouvé.</div>`;
    return;
  }

  root.innerHTML = liste.map(e => {
    const aTel = !!formatTelWA(e.tel);
    return `
      <div class="msg-row">
        <div class="msg-info">
          <div class="msg-name">${escapeHtml(e.parent || "Parent")} <span class="text-muted">— ${escapeHtml(e.nom)}</span></div>
          <div class="msg-tel">${e.tel ? escapeHtml(e.tel) : "Pas de numéro"}</div>
        </div>
        <button class="btn btn-whatsapp btn-sm" data-wa-msg="${e.id}" ${aTel ? "" : "disabled"}><i class="bi bi-whatsapp"></i> Envoyer</button>
      </div>`;
  }).join("");

  root.querySelectorAll("[data-wa-msg]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.waMsg);
      const texte = composerMessageMessagerie();
      if (!texte && !BDJ_MODELE_PAR_FILTRE[document.getElementById("msgFiltrePreset")?.value]) {
        showToast("Écrivez un message avant de l'envoyer.", "error");
        return;
      }
      sendWhatsApp(enfant.tel, composerMessageMessagerie());
    });
  });
}

// Un lien wa.me prépare une conversation, il n'envoie pas le message.
// Un clic distinct par parent évite le blocage des fenêtres suivantes.
var fileEnvoiGroupe = restaurerFileWhatsApp();

function restaurerFileWhatsApp() {
  try {
    const file = JSON.parse(window.sessionStorage.getItem("bdj_file_whatsapp_v1"));
    if (typeof file?.texte !== "string" || !Array.isArray(file.destinataires) || !file.destinataires.every(d =>
      /^\d{8,15}$/.test(d.numero) && typeof d.parent === "string" && Array.isArray(d.enfants) &&
      d.enfants.every(n => typeof n === "string") && ["a_traiter", "ouvert", "confirme", "ignore"].includes(d.etat))) return null;
    return file;
  } catch (_) { return null; }
}

function sauvegarderFileWhatsApp() {
  try {
    if (fileEnvoiGroupe) window.sessionStorage.setItem("bdj_file_whatsapp_v1", JSON.stringify(fileEnvoiGroupe));
    else window.sessionStorage.removeItem("bdj_file_whatsapp_v1");
  } catch (_) { /* La file reste utilisable en mémoire si le stockage est désactivé. */ }
}

function preparerFileWhatsApp(liste, texte) {
  const parNumero = new Map();
  let sansNumero = 0;
  liste.forEach(e => {
    const numero = formatTelWA(e.tel);
    if (!numero || !/^\d{8,15}$/.test(numero)) { sansNumero++; return; }
    if (!parNumero.has(numero)) parNumero.set(numero, { numero, parent: e.parent || "Parent", enfants: [], etat: "a_traiter" });
    parNumero.get(numero).enfants.push(e.nom);
  });
  return { texte, destinataires: [...parNumero.values()], sansNumero };
}

function ouvrirDestinataireGroupe(index) {
  const d = fileEnvoiGroupe?.destinataires[index];
  if (!d || ["confirme", "ignore"].includes(d.etat)) return false;
  if (!fileEnvoiGroupe.classique && !STATE.enfants.some(e => telephoneConsentementWhatsApp(e.tel) === telephoneConsentementWhatsApp(d.numero) && consentementWhatsAppValide(e))) { showToast("Le consentement de ce contact n'est plus valide.", "error"); return false; }
  const fenetre = window.open(`https://wa.me/${d.numero}?text=${encodeURIComponent(d.texte ?? fileEnvoiGroupe.texte)}`, "bulles_whatsapp");
  if (!fenetre) { showToast("Le navigateur a bloqué WhatsApp. Autorisez l'ouverture puis réessayez ce destinataire.", "error"); return false; }
  try { fenetre.opener = null; } catch (_) { /* Certains navigateurs protègent cette propriété. */ }
  d.etat = "ouvert";
  sauvegarderFileWhatsApp();
  return true;
}

function ouvrirListeWhatsAppClassique(messages) {
  const destinataires = messages.filter(x => formatTelWA(x.enfant.tel)).map(x => ({
    numero: formatTelWA(x.enfant.tel), parent: x.enfant.parent || "Parent", enfants: [x.enfant.nom],
    texte: x.message, etat: "a_traiter"
  }));
  if (!destinataires.length) { showToast("Aucun numéro WhatsApp valide.", "error"); return; }
  fileEnvoiGroupe = { classique: true, texte: destinataires[0].texte, destinataires, sansNumero: messages.length - destinataires.length };
  sauvegarderFileWhatsApp(); renderFileWhatsApp();
}

function confirmerDestinataireGroupe(index) {
  const d = fileEnvoiGroupe?.destinataires[index];
  if (!d || d.etat !== "ouvert") return false;
  d.etat = "confirme";
  sauvegarderFileWhatsApp();
  return true;
}

function renderFileWhatsApp() {
  const file = fileEnvoiGroupe;
  if (!file) return;
  const confirmes = file.destinataires.filter(d => d.etat === "confirme").length;
  const ignores = file.destinataires.filter(d => d.etat === "ignore").length;
  const index = file.destinataires.findIndex(d => ["a_traiter", "ouvert"].includes(d.etat));
  const courant = file.destinataires[index];
  const libelles = { a_traiter: "À traiter", ouvert: "Conversation ouverte", confirme: "Envoi confirmé par vous", ignore: "Ignoré" };
  openModal(`
    <div class="modal-title">Message à la liste filtrée</div>
    <p class="modal-text">${file.destinataires.length} numéro(s) distinct(s) · ${confirmes} envoi(s) confirmé(s) · ${ignores} ignoré(s).${file.sansNumero ? ` ${file.sansNumero} dossier(s) sans numéro valide.` : ""}</p>
    <p class="modal-text">Ouvrez WhatsApp, validez l'envoi dans WhatsApp, puis revenez ici et confirmez pour passer au parent suivant. La liste est conservée jusqu'à la fin, même si les filtres changent. Un même numéro reçoit un seul message.</p>
    <details><summary>Voir le message</summary><p style="white-space:pre-wrap">${escapeHtml(file.texte)}</p></details>
    ${courant ? `<p><strong>${escapeHtml(courant.parent)}</strong> — ${escapeHtml(courant.enfants.join(", "))}<br>+${escapeHtml(courant.numero)}</p>
      <div class="modal-actions"><button class="btn btn-whatsapp" id="waGroupeOuvrir">${courant.etat === "ouvert" ? "Rouvrir" : "Ouvrir"} WhatsApp</button><button class="btn btn-primary" id="waGroupeConfirmer" ${courant.etat !== "ouvert" ? "disabled" : ""}>J'ai envoyé ce message</button><button class="btn btn-ghost" id="waGroupeIgnorer">Ignorer ce parent</button></div>` : `<p class="text-green">Liste traitée : ${confirmes} envoi(s) confirmé(s) par vous.${ignores ? ` ${ignores} destinataire(s) ignoré(s).` : ""}</p>`}
    <details><summary>Destinataires (${file.destinataires.length})</summary><div style="max-height:25vh;overflow:auto">${file.destinataires.map(d => `<p>${escapeHtml(d.enfants.join(", "))} — ${escapeHtml(libelles[d.etat])}</p>`).join("")}</div></details>
    <div class="modal-actions"><button class="btn btn-ghost" id="waGroupeFermer">${courant ? "Fermer et reprendre plus tard" : "Fermer"}</button><button class="btn btn-secondary" id="waGroupeNouvelle">Nouvelle liste avec les filtres actuels</button></div>
  `);
  document.getElementById("waGroupeFermer").addEventListener("click", closeModal);
  document.getElementById("waGroupeNouvelle").addEventListener("click", () => {
    const texte = composerMessageMessagerie();
    const nouvelle = preparerFileWhatsApp(enfantsFiltresMessagerie(), texte);
    if (!texte || !nouvelle.destinataires.length) { showToast("Écrivez un message et sélectionnez des parents avec un numéro valide. La file en cours est conservée.", "error"); return; }
    fileEnvoiGroupe = nouvelle; sauvegarderFileWhatsApp(); renderFileWhatsApp();
  });
  document.getElementById("waGroupeOuvrir")?.addEventListener("click", () => { if (ouvrirDestinataireGroupe(index)) renderFileWhatsApp(); });
  document.getElementById("waGroupeConfirmer")?.addEventListener("click", () => { if (confirmerDestinataireGroupe(index)) renderFileWhatsApp(); });
  document.getElementById("waGroupeIgnorer")?.addEventListener("click", () => { courant.etat = "ignore"; sauvegarderFileWhatsApp(); renderFileWhatsApp(); });
}

function handleEnvoiGroupe() {
  if (fileEnvoiGroupe?.destinataires.some(d => ["a_traiter", "ouvert"].includes(d.etat))) { renderFileWhatsApp(); return; }
  const texte = composerMessageMessagerie();
  if (!texte) {
    showToast("Écrivez un message avant de l'envoyer.", "error");
    return;
  }

  const file = preparerFileWhatsApp(enfantsFiltresMessagerie().filter(consentementWhatsAppValide), texte);
  if (file.destinataires.length === 0) {
    showToast("Aucun destinataire avec un numéro WhatsApp dans cette sélection.", "error");
    return;
  }

  fileEnvoiGroupe = file;
  sauvegarderFileWhatsApp();
  renderFileWhatsApp();
}

// ---------- Initialisation des écouteurs (appelée une fois au démarrage) ----------
function initWhatsapp() {
  document.getElementById("waRecherche")?.addEventListener("input", renderWhatsAppTab);
  document.getElementById("msgRecherche")?.addEventListener("input", renderMessagerieTab);
  document.getElementById("msgFiltreSect")?.addEventListener("change", renderMessagerieTab);
  document.getElementById("msgFiltrePreset")?.addEventListener("change", renderMessagerieTab);
  document.getElementById("btnEnvoiGroupe")?.addEventListener("click", handleEnvoiGroupe);
  document.getElementById("btnEnvoiGroupeApi")?.addEventListener("click", () => openWhatsAppApiModal({ liste: enfantsFiltresMessagerie(), type: BDJ_MODELE_PAR_FILTRE[document.getElementById("msgFiltrePreset")?.value], contextes: {} }));
}
