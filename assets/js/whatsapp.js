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
// MESSAGE — REÇU DE PAIEMENT (automatique après une entrée)
// ============================================================
function buildReceiptMessage(enfant, entree, postesEnfant, secteurs) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];

  const lignes = (secteurs || []).map(sect => {
    let reste = 0;
    if (SECT_TO_KEY[sect]) {
      const poste = postesEnfant.find(p => p.key === SECT_TO_KEY[sect]);
      reste = poste ? Math.max((poste.du || 0) - (poste.paye || 0), 0) : 0;
    } else if (SECT_TO_CAT[sect]) {
      const cats = SECT_TO_CAT[sect];
      reste = postesEnfant
        .filter(p => cats.includes(p.cat) && !p.is_remise && !p.is_var && p.key !== "avance")
        .reduce((s, p) => s + Math.max((p.du || 0) - (p.paye || 0), 0), 0);
    }
    return `  • ${sect} → *${fmtFCFA(reste)} restant*`;
  }).join("\n");

  const totalReste = tReste(postesEnfant);

  let msg = `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n`.replace(/ {2,}/g, " ");
  msg += `Nous avons bien reçu votre paiement de *${fmtFCFA(entree.mt)}* pour *${prenom}*. Merci !\n`;
  msg += `📅 ${formatDateFR(entree.date)} · 💳 ${entree.mode}\n\n`;
  msg += `📊 *Voici où en est le compte de ${prenom} :*\n\n`;
  msg += lignes ? `${lignes}\n\n` : "\n";
  msg += `💡 Solde global à régulariser : *${fmtFCFA(totalReste)}*\n\n`;
  msg += `Avec toute notre gratitude,\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n`;
  msg += `📍 Zongo 2, Parakou · 📱 01 97 91 94 52\n`;
  msg += `_Amour · Travail · Discipline · Créativité_`;
  return msg;
}

// ============================================================
// MESSAGE — BILAN COMPLET (envoyé manuellement depuis un dossier)
// ============================================================

// Ordre d'affichage des catégories — reproduit exactement l'ordre du
// modèle validé (Cantine crèche puis Crèche pour la crèche ; Scolarité en
// tête pour Maternelle/Primaire). Uniformes et Fournitures (montant libre)
// n'y figurent jamais — ce ne sont pas des échéances à régulariser.
var ORDRE_CATEGORIES_BILAN = [
  "Cantine crèche", "Crèche", "Scolarité", "Activités parascolaires",
  "Fêtes scolaires", "Assurance", "APE", "Cantine", "Goûter", "Garderie"
];

// Catégories facturées mois par mois : on détaille les mois non soldés
// sous le total, pour que le parent sache précisément lesquels régler.
var CATS_MENSUELLES_BILAN = ["Crèche", "Cantine crèche", "Cantine"];
var MOIS_ORDRE_BILAN = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];

function buildBilanMessage(enfant, postesEnfant, suiviEnfant) {
  const parent = enfant.parent || "cher parent";
  const section = SECT_LABELS[enfant.sect] || enfant.sect;
  const aujourdHui = new Date().toLocaleDateString("fr-FR");
  const DIV = "────────────────────";

  let msg = `Bonjour ${parent},\n\n`;
  msg += `Veuillez trouver ci-dessous le récapitulatif concernant votre enfant :\n`;
  msg += `*${enfant.nom}* - ${section}\n${DIV}\n\n`;
  msg += `💰 *SITUATION FINANCIERE*\n${DIV}\n`;
  msg += `Voici le détail de votre situation au ${aujourdHui} :\n\n`;

  let totalReste = 0;

  ORDRE_CATEGORIES_BILAN.forEach(cat => {
    const lignes = postesEnfant.filter(p => p.cat === cat && !p.is_var && !p.is_remise && p.key !== "avance");
    if (lignes.length === 0) return;

    const du = lignes.reduce((s, p) => s + (p.du || 0), 0);
    const paye = lignes.reduce((s, p) => s + (p.paye || 0), 0);
    const reste = Math.max(du - paye, 0);
    totalReste += reste;

    msg += `• *${cat}*\n`;
    msg += `  Montant dû    : ${fmtFCFA(du)}\n`;
    msg += `  Déjà payé     : ${fmtFCFA(paye)}\n`;
    msg += `  Reste à payer : *${fmtFCFA(reste)}*\n`;

    if (CATS_MENSUELLES_BILAN.includes(cat)) {
      const moisNonSoldes = lignes
        .filter(p => p.mois && (p.paye || 0) < (p.du || 0))
        .sort((a, b) => MOIS_ORDRE_BILAN.indexOf(a.mois) - MOIS_ORDRE_BILAN.indexOf(b.mois));
      if (moisNonSoldes.length > 0) {
        msg += `  Détail mensuel :\n`;
        moisNonSoldes.forEach(p => {
          msg += `    · ${p.mois} : ${fmtFCFA(Math.max((p.du || 0) - (p.paye || 0), 0))} restant\n`;
        });
      }
    }
    msg += `\n`;
  });

  // Remise éventuelle
  const remisePoste = postesEnfant.find(p => p.is_remise);
  if (remisePoste) {
    totalReste = Math.max(totalReste - (remisePoste.paye || 0), 0);
    msg += `🎁 Remise accordée : -${fmtFCFA(remisePoste.paye)} sur ${remisePoste.cat}\n\n`;
  }

  msg += `${DIV}\n`;
  msg += `*TOTAL RESTANT : ${fmtFCFA(totalReste)}*\n\n`;
  msg += `Merci de régulariser votre situation avant les échéances indiquées.\n\n`;
  msg += `${DIV}\n`;
  msg += `💛🌸 Adorables parents, vous êtes nos meilleurs partenaires !\n`;
  msg += `Nous vous remercions pour votre confiance et votre engagement.\n`;
  msg += `Ensemble construisons l avenir de nos enfants avec amour et discipline. 💛\n\n`;
  msg += `Les Bulles de Joie - Parakou\n`;
  msg += `Tel : 01 97 91 94 52\n`;
  msg += `Amour · Travail · Discipline · Creativite`;

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
  msg += `📍 Zongo 2, Parakou · 📱 01 97 91 94 52\n`;
  msg += `_Amour · Travail · Discipline · Créativité_`;
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
      const msg = buildBilanMessage(enfant, postesEnfant, suiviEnfant);
      sendWhatsApp(enfant.tel, msg);
    });
  });
}

// ============================================================
// RENDU — ONGLET MESSAGERIE (envoi collectif)
// ============================================================
// Liste des enfants correspondant aux filtres actuels de la Messagerie
// (recherche texte + section + préréglage). Réutilisée par le rendu de la
// liste et par le bouton d'envoi groupé, pour rester toujours cohérentes.
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
      if (preset === "impayes") {
        const postesEnfant = STATE.postes.filter(p => p.enfant_id === e.id);
        return statutPaiement(postesEnfant) !== "solde";
      }
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
      if (!texte) {
        showToast("Écrivez un message avant de l'envoyer.", "error");
        return;
      }
      sendWhatsApp(enfant.tel, texte);
    });
  });
}

// Envoi groupé : ouvre un onglet WhatsApp par destinataire filtré et
// disposant d'un numéro. Les navigateurs autorisent plusieurs fenêtres
// ouvertes depuis un seul clic — au-delà, ils peuvent bloquer les
// suivantes (autoriser les popups pour ce site si besoin).
function handleEnvoiGroupe() {
  const texte = composerMessageMessagerie();
  if (!texte) {
    showToast("Écrivez un message avant de l'envoyer.", "error");
    return;
  }

  const destinataires = enfantsFiltresMessagerie().filter(e => formatTelWA(e.tel));
  if (destinataires.length === 0) {
    showToast("Aucun destinataire avec un numéro WhatsApp dans cette sélection.", "error");
    return;
  }

  destinataires.forEach(e => sendWhatsApp(e.tel, texte));
  showToast(`Envoi lancé pour ${destinataires.length} destinataire(s). Autorisez les fenêtres pop-up si votre navigateur les bloque.`, "success");
}

// ---------- Initialisation des écouteurs (appelée une fois au démarrage) ----------
function initWhatsapp() {
  document.getElementById("waRecherche")?.addEventListener("input", renderWhatsAppTab);
  document.getElementById("msgRecherche")?.addEventListener("input", renderMessagerieTab);
  document.getElementById("msgFiltreSect")?.addEventListener("change", renderMessagerieTab);
  document.getElementById("msgFiltrePreset")?.addEventListener("change", renderMessagerieTab);
  document.getElementById("btnEnvoiGroupe")?.addEventListener("click", handleEnvoiGroupe);
}
