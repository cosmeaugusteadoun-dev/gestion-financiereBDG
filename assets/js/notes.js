// ============================================================
// notes.js — Notes, absences, retards & comportement par trimestre
// ============================================================

// ---------- Grille d'appréciation automatique (moyenne /20) ----------
// Utilisée pour la Crèche et le Primaire — la Maternelle reste sur une
// appréciation choisie manuellement (3 paliers, voir renderNotesForm).
var GRILLE_MOYENNE = [
  { seuil: 16, label: "Excellent",     classe: "text-green" },
  { seuil: 14, label: "Bien",          classe: "text-gold" },
  { seuil: 12, label: "Passable",      classe: "text-orange" },
  { seuil: 0,  label: "En difficulté", classe: "text-red" }
];

var SEUIL_ALERTE_ABSENCES = 2;
var SEUIL_ALERTE_RETARDS = 2;

var COMPORTEMENT_OPTIONS = ["Exemplaire", "Satisfaisant", "À améliorer", "Préoccupant"];

// Appréciation Maternelle exprimée en 1 à 3 étoiles (widget visuel, voir
// starRatingHTML) — l'ordre du tableau fixe la correspondance étoiles ↔ libellé.
var STAR_APPRECIATIONS = ["Peu satisfaisant", "Satisfaisant", "Très satisfaisant"];

// Libellés d'affichage des trimestres, dans l'ordre — réutilisés par le
// bulletin annuel consolidé.
var LIBELLES_TRIM = ["1er Trimestre", "2e Trimestre", "3e Trimestre"];

// Libellés du trimestre pour le bulletin WhatsApp — forme normale ("1er
// trimestre", dans le corps du texte) et forme MAJUSCULE (titres de section).
var TRIM_LIBELLE_BULLETIN = {
  "Trimestre 1": { normal: "1er trimestre", maj: "1ER TRIMESTRE" },
  "Trimestre 2": { normal: "2e trimestre",  maj: "2E TRIMESTRE" },
  "Trimestre 3": { normal: "3e trimestre",  maj: "3E TRIMESTRE" }
};

// Pastille de couleur associée à chaque niveau d'appréciation (résultats
// académiques et Maternelle partagent la même échelle visuelle 🟢🟡🟠🔴).
var EMOJI_APPRECIATION = {
  "Excellent": "🟢", "Bien": "🟡", "Passable": "🟠", "En difficulté": "🔴",
  "Très satisfaisant": "🟢", "Satisfaisant": "🟡", "Peu satisfaisant": "🔴"
};

// Paragraphe d'encouragement/accompagnement selon le niveau de résultat —
// un seul et même texte, que la notation vienne de la moyenne (Primaire)
// ou de l'appréciation étoilée (Maternelle).
var PARAGRAPHE_RESULTAT = {
  "Excellent": "Votre enfant réalise d'excellents résultats au cours de ce {trim}. Bravo pour ce travail remarquable !\nContinuons à l'encourager et à valoriser ses efforts — quelle belle réussite !",
  "Très satisfaisant": "Votre enfant réalise d'excellents résultats au cours de ce {trim}. Bravo pour ce travail remarquable !\nContinuons à l'encourager et à valoriser ses efforts — quelle belle réussite !",
  "Bien": "Votre enfant réalise de bons résultats au cours de ce {trim}. Félicitations !\nContinuons ensemble sur cette belle lancée. Encourageons-le/la à viser encore plus haut !",
  "Satisfaisant": "Votre enfant réalise de bons résultats au cours de ce {trim}. Félicitations !\nContinuons ensemble sur cette belle lancée. Encourageons-le/la à viser encore plus haut !",
  "Passable": "Votre enfant obtient des résultats moyens au cours de ce {trim}. Un potentiel encore à développer.\nUn accompagnement à la maison pourrait l'aider à progresser davantage — nous restons à votre disposition.",
  "En difficulté": "Votre enfant rencontre des difficultés au cours de ce {trim}.\nUn accompagnement rapproché à la maison, ainsi qu'un échange avec l'équipe pédagogique, pourraient beaucoup l'aider. N'hésitez pas à nous contacter.",
  "Peu satisfaisant": "Votre enfant rencontre des difficultés au cours de ce {trim}.\nUn accompagnement rapproché à la maison, ainsi qu'un échange avec l'équipe pédagogique, pourraient beaucoup l'aider. N'hésitez pas à nous contacter."
};

// Bloc "Comportement" — emoji + texte selon l'option choisie.
var BLOC_COMPORTEMENT = {
  "Exemplaire": { emoji: "🌟", texte: "Votre enfant fait preuve d'un comportement irréprochable en classe. Il/elle est un modèle de tenue et de respect pour ses camarades. Félicitations à vous et à lui/elle !" },
  "Satisfaisant": { emoji: "🙂", texte: "Votre enfant se comporte bien en classe et respecte les règles de vie collective. Continuons à l'encourager dans cette voie !" },
  "À améliorer": { emoji: "⚠️", texte: "Votre enfant a parfois du mal à respecter les règles de vie en classe. Un rappel bienveillant à la maison pourrait l'aider à progresser." },
  "Préoccupant": { emoji: "🚨", texte: "Le comportement de votre enfant en classe nous préoccupe. Nous aimerions échanger avec vous pour l'accompagner au mieux — n'hésitez pas à nous contacter." }
};

function appreciationDepuisMoyenne(m) {
  if (m === null || m === undefined || isNaN(m)) return null;
  const g = GRILLE_MOYENNE.find(x => m >= x.seuil);
  return g ? g.label : null;
}

function classeAppreciation(label) {
  const g = GRILLE_MOYENNE.find(x => x.label === label);
  return g ? g.classe : "text-muted";
}

// ---------- Widget d'appréciation en étoiles (Maternelle) ----------
function starRatingHTML(appreciationActuelle) {
  const niveauActuel = STAR_APPRECIATIONS.indexOf(appreciationActuelle) + 1; // 0 si aucune sélection
  const etoiles = [1, 2, 3].map(n => `
    <button type="button" class="star-btn ${n <= niveauActuel ? "star-filled" : ""}" data-star="${n}" aria-label="${STAR_APPRECIATIONS[n - 1]}">
      <i class="bi ${n <= niveauActuel ? "bi-star-fill" : "bi-star"}"></i>
    </button>`).join("");
  return `
    <div class="star-rating" id="nAppreciationEtoiles">${etoiles}</div>
    <div class="field-hint" id="nAppreciationLabel">${appreciationActuelle || "Sélectionnez une appréciation"}</div>
    <input type="hidden" id="nAppreciation" value="${appreciationActuelle || ""}">`;
}

// Affichage compact des étoiles dans le tableau récapitulatif
function appreciationAffichageHTML(s) {
  if (!s || !s.appreciation) return "—";
  if (!s.is_mat) return escapeHtml(s.appreciation);
  const niveau = STAR_APPRECIATIONS.indexOf(s.appreciation) + 1;
  if (niveau <= 0) return "—";
  return `<span class="star-display">${[1, 2, 3].map(n => `<i class="bi ${n <= niveau ? "bi-star-fill" : "bi-star"}"></i>`).join("")}</span>`;
}

// Un enfant est "en difficulté" académiquement quel que soit le mode de
// notation (moyenne pour Crèche/Primaire, appréciation étoilée en Maternelle).
function estEnDifficulte(s) {
  if (!s) return false;
  return s.is_mat ? s.appreciation === "Peu satisfaisant" : s.appreciation === "En difficulté";
}
function estExcellent(s) {
  if (!s) return false;
  return s.is_mat ? s.appreciation === "Très satisfaisant" : s.appreciation === "Excellent";
}
function aAlerteAbsRet(s) {
  if (!s) return false;
  return (s.absences || 0) >= SEUIL_ALERTE_ABSENCES || (s.retards || 0) >= SEUIL_ALERTE_RETARDS;
}
function aComportementPreoccupant(s) {
  return !!s && s.comportement === "Préoccupant";
}

// ============================================================
// INITIALISATION
// ============================================================
// Mode de saisie du formulaire : "individuel" (élève, avec moyenne/notes)
// ou "classe" (observation générale, sans champs de moyenne).
var notesMode = "individuel";

function initNotes() {
  document.getElementById("nEnfant").addEventListener("change", renderNotesForm);
  document.getElementById("nClasse").addEventListener("change", renderNotesForm);
  document.getElementById("nTrim").addEventListener("change", () => {
    renderNotesForm();
    renderNotesMetriquesEtTable();
  });

  document.getElementById("nClasse").innerHTML = Object.keys(SECT_LABELS)
    .map(sect => `<option value="${sect}">${escapeHtml(SECT_LABELS[sect])}</option>`).join("");

  document.querySelectorAll("#nModeToggle [data-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      notesMode = btn.dataset.mode;
      document.querySelectorAll("#nModeToggle [data-mode]").forEach(b => {
        b.classList.toggle("btn-primary", b === btn);
        b.classList.toggle("btn-ghost", b !== btn);
      });
      document.getElementById("nEnfantField").style.display = notesMode === "individuel" ? "" : "none";
      document.getElementById("nClasseField").style.display = notesMode === "classe" ? "" : "none";
      renderNotesForm();
    });
  });

  document.getElementById("btnAlerterDifficulte").addEventListener("click", handleAlerterDifficulte);
  document.getElementById("btnAlerterAbsRet").addEventListener("click", handleAlerterAbsRet);
  document.getElementById("btnAlerterComportement").addEventListener("click", handleAlerterComportement);
  document.getElementById("btnBulletinsATous").addEventListener("click", handleBulletinsATous);
  document.getElementById("btnBulletinsAnnuelsATous").addEventListener("click", handleBulletinsAnnuelsATous);
  renderNotes();
}

// Rafraîchit la liste des élèves, le formulaire, et le tableau récapitulatif
// (appelé après toute modification de dossier, pour rester à jour)
function renderNotes() {
  const select = document.getElementById("nEnfant");
  if (!select) return;

  const valeurPrecedente = select.value;
  const liste = STATE.enfants.slice().sort((a, b) => a.nom.localeCompare(b.nom));

  select.innerHTML = liste.length
    ? liste.map(e => `<option value="${e.id}">${escapeHtml(e.nom)} (${SECT_LABELS[e.sect] || e.sect})</option>`).join("")
    : '<option value="">Aucun élève enregistré</option>';

  if (liste.some(e => e.id === valeurPrecedente)) select.value = valeurPrecedente;

  renderNotesForm();
  renderNotesMetriquesEtTable();
}

// ============================================================
// FORMULAIRE DE SAISIE
// ============================================================
function renderNotesForm() {
  const root = document.getElementById("notesForm");
  if (!root) return;

  if (notesMode === "classe") { renderNotesFormClasse(); return; }

  const enfantId = document.getElementById("nEnfant").value;
  const trim = document.getElementById("nTrim").value;
  const enfant = STATE.enfants.find(e => e.id === enfantId);

  if (!enfant) {
    root.innerHTML = `<p class="text-muted">Créez d'abord un dossier élève pour saisir son suivi.</p>`;
    return;
  }

  const isMat = MAT_SECTS.includes(enfant.sect);
  const existant = STATE.suivi.find(s => s.enfant_id === enfantId && s.trim === trim) || {};
  const appreciationAutoInit = appreciationDepuisMoyenne(existant.moy);

  root.innerHTML = `
    <div class="form-grid">
      <div class="field" style="grid-column: 1 / -1;">
        <label>${isMat ? "Appréciation" : "Moyenne (/20)"}</label>
        ${isMat ? starRatingHTML(existant.appreciation) : `
          <input type="number" id="nMoyenne" min="0" max="20" step="0.25" placeholder="Ex. 13.5" value="${existant.moy ?? ""}">
          <div class="field-hint">Appréciation automatique : <strong id="nAppreciationAuto" class="${classeAppreciation(appreciationAutoInit)}">${appreciationAutoInit || "—"}</strong></div>`}
      </div>
      <div class="field"><label>Absences non justifiées</label><input type="number" id="nAbsences" min="0" value="${existant.absences ?? 0}"></div>
      <div class="field"><label>Retards répétitifs</label><input type="number" id="nRetards" min="0" value="${existant.retards ?? 0}"></div>
      <div style="grid-column: 1 / -1;" id="nAlerteAbsRet"></div>
      <div class="field">
        <label>Comportement</label>
        <select id="nComportement">
          <option value="">— Choisir —</option>
          ${COMPORTEMENT_OPTIONS.map(c => `<option value="${c}" ${existant.comportement === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="grid-column: 1 / -1;">
        <label>Observation libre</label>
        <textarea id="nObservation" placeholder="Optionnel">${escapeHtml(existant.observation || "")}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnEnregistrerSuivi"><i class="bi bi-check-lg"></i> Enregistrer</button>
      <button class="btn btn-whatsapp" id="btnNotifierParent" ${enfant.tel ? "" : "disabled"}><i class="bi bi-whatsapp"></i> Notifier le parent WhatsApp</button>
    </div>
  `;

  // Aperçu live de l'appréciation automatique (mode moyenne)
  if (!isMat) {
    document.getElementById("nMoyenne").addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      const label = appreciationDepuisMoyenne(isNaN(val) ? null : val);
      const cible = document.getElementById("nAppreciationAuto");
      cible.textContent = label || "—";
      cible.className = classeAppreciation(label);
    });
  } else {
    // Widget étoiles (Maternelle) : un clic fixe le niveau et remplit le
    // champ caché nAppreciation lu par sauvegarderSuivi().
    const zoneEtoiles = document.getElementById("nAppreciationEtoiles");
    const champCache = document.getElementById("nAppreciation");
    const zoneLibelle = document.getElementById("nAppreciationLabel");
    zoneEtoiles.querySelectorAll(".star-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const niveau = parseInt(btn.dataset.star, 10);
        const valeur = STAR_APPRECIATIONS[niveau - 1];
        champCache.value = valeur;
        zoneLibelle.textContent = valeur;
        zoneEtoiles.querySelectorAll(".star-btn").forEach(b => {
          const n = parseInt(b.dataset.star, 10);
          b.classList.toggle("star-filled", n <= niveau);
          b.querySelector("i").className = `bi ${n <= niveau ? "bi-star-fill" : "bi-star"}`;
        });
      });
    });
  }

  // Bandeau d'alerte en direct dès que les seuils absences/retards sont atteints
  function rafraichirAlerte() {
    const abs = parseInt(document.getElementById("nAbsences").value, 10) || 0;
    const ret = parseInt(document.getElementById("nRetards").value, 10) || 0;
    const zone = document.getElementById("nAlerteAbsRet");
    zone.innerHTML = (abs >= SEUIL_ALERTE_ABSENCES || ret >= SEUIL_ALERTE_RETARDS)
      ? `<div class="alert-banner"><i class="bi bi-exclamation-triangle-fill"></i> Alerte : ${abs} absence(s) non justifiée(s), ${ret} retard(s) répétitif(s). Notification du parent recommandée.</div>`
      : "";
  }
  document.getElementById("nAbsences").addEventListener("input", rafraichirAlerte);
  document.getElementById("nRetards").addEventListener("input", rafraichirAlerte);
  rafraichirAlerte();

  document.getElementById("btnEnregistrerSuivi").addEventListener("click", async () => {
    const suivi = await sauvegarderSuivi(enfant, trim, existant, isMat);
    if (suivi) { renderNotesForm(); renderNotesMetriquesEtTable(); }
  });

  document.getElementById("btnNotifierParent")?.addEventListener("click", async () => {
    const suivi = await sauvegarderSuivi(enfant, trim, existant, isMat);
    if (suivi) {
      sendWhatsApp(enfant.tel, buildMessageBulletin(enfant, suivi));
      renderNotesForm();
      renderNotesMetriquesEtTable();
    }
  });
}

// ============================================================
// FORMULAIRE DE SAISIE — SUIVI PAR CLASSE (observation générale, sans
// moyenne ni appréciation individuelle) — même carte, mode "classe".
// ============================================================
function renderNotesFormClasse() {
  const root = document.getElementById("notesForm");
  if (!root) return;

  const sect = document.getElementById("nClasse").value;
  const trim = document.getElementById("nTrim").value;
  const existant = STATE.suiviClasse.find(s => s.sect === sect && s.trim === trim) || {};
  const nbElevesClasse = STATE.enfants.filter(e => e.sect === sect).length;

  root.innerHTML = `
    <div class="form-grid">
      <div class="field" style="grid-column: 1 / -1;">
        <label>Observation générale de la classe</label>
        <textarea id="ncObservation" placeholder="Ex. Sortie éducative prévue, consigne pour la classe, information collective...">${escapeHtml(existant.observation || "")}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnEnregistrerSuiviClasse"><i class="bi bi-check-lg"></i> Enregistrer</button>
      <button class="btn btn-whatsapp" id="btnDiffuserClasse" ${nbElevesClasse === 0 ? "disabled" : ""}><i class="bi bi-whatsapp"></i> Diffuser aux parents de la classe (${nbElevesClasse})</button>
    </div>
  `;

  document.getElementById("btnEnregistrerSuiviClasse").addEventListener("click", async () => {
    await sauvegarderSuiviClasse(sect, trim, existant);
  });

  document.getElementById("btnDiffuserClasse").addEventListener("click", async () => {
    const suiviClasse = await sauvegarderSuiviClasse(sect, trim, existant);
    if (!suiviClasse) return;
    const enfantsClasse = STATE.enfants.filter(e => e.sect === sect);
    const avecTel = enfantsClasse.filter(e => formatTelWA(e.tel));
    if (avecTel.length === 0) {
      showToast("Aucun parent de cette classe n'a de numéro WhatsApp renseigné.", "error");
      return;
    }
    avecTel.forEach(e => sendWhatsApp(e.tel, buildMessageSuiviClasse(sect, trim, suiviClasse.observation)));
    showToast(`Diffusion lancée pour ${avecTel.length} parent(s). Autorisez les fenêtres pop-up si votre navigateur les bloque.`, "success");
  });
}

async function sauvegarderSuiviClasse(sect, trim, existant) {
  const observation = document.getElementById("ncObservation").value.trim();
  if (!observation) {
    showToast("Renseignez l'observation avant d'enregistrer.", "error");
    return null;
  }

  const suiviClasse = { id: existant.id || uid("suvc"), sect, trim, observation };

  try {
    await dbUpsertSuiviClasse(suiviClasse);
    const idx = STATE.suiviClasse.findIndex(s => s.sect === sect && s.trim === trim);
    if (idx >= 0) STATE.suiviClasse[idx] = suiviClasse; else STATE.suiviClasse.push(suiviClasse);
    showToast("Suivi de classe enregistré.", "success");
    renderNotesForm();
    return suiviClasse;
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'enregistrement du suivi de classe : " + err.message, "error");
    return null;
  }
}

function buildMessageSuiviClasse(sect, trim, observation) {
  const section = SECT_LABELS[sect] || sect;
  let msg = `Bonjour 👋,\n\n`;
  msg += `📋 *Information de la classe — ${section} · ${trim}*\n\n`;
  msg += `${observation}\n\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n📍 Zongo 2, Parakou · 📱 01 97 91 94 52\n_Amour · Travail · Discipline · Créativité_`;
  return msg;
}

async function sauvegarderSuivi(enfant, trim, existant, isMat) {
  const moyenneVal = isMat ? null : (parseFloat(document.getElementById("nMoyenne").value) || null);
  const appreciationVal = isMat
    ? (document.getElementById("nAppreciation").value || null)
    : appreciationDepuisMoyenne(moyenneVal);

  const suivi = {
    id: existant.id || uid("suv"),
    enfant_id: enfant.id,
    trim,
    moy: moyenneVal,
    appreciation: appreciationVal,
    absences: parseInt(document.getElementById("nAbsences").value, 10) || 0,
    retards: parseInt(document.getElementById("nRetards").value, 10) || 0,
    comportement: document.getElementById("nComportement").value || null,
    observation: document.getElementById("nObservation").value.trim() || null,
    is_mat: isMat
  };

  try {
    await dbUpsertSuivi(suivi);
    const idx = STATE.suivi.findIndex(s => s.enfant_id === enfant.id && s.trim === trim);
    if (idx >= 0) STATE.suivi[idx] = suivi; else STATE.suivi.push(suivi);
    showToast("Suivi scolaire enregistré.", "success");
    return suivi;
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'enregistrement du suivi : " + err.message, "error");
    return null;
  }
}

// ============================================================
// MESSAGES WHATSAPP (bulletin individuel + 3 alertes ciblées)
// Le ton reste chaleureux, comme tous les messages envoyés aux parents.
// ============================================================
function buildMessageBulletin(enfant, suivi) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? `${enfant.civilite} ` : "";
  const destinataire = enfant.parent ? `${civiliteTxt}${enfant.parent}` : "cher parent";
  const prenom = (enfant.nom || "").split(" ")[0];
  const classe = SECT_LABELS[enfant.sect] || enfant.sect;
  const trimInfo = TRIM_LIBELLE_BULLETIN[suivi.trim] || { normal: suivi.trim, maj: suivi.trim.toUpperCase() };
  const DIV = "────────────────────";

  const appreciation = suivi.appreciation || null;
  const resultatDispo = suivi.is_mat ? !!appreciation : suivi.moy != null;

  let msg = `Bonjour — ${destinataire},\n\n`;
  msg += `Bulletin scolaire de ${prenom} (${classe}) - ${trimInfo.normal}\n${DIV}\n\n`;

  if (resultatDispo) {
    msg += `📚 *RÉSULTATS — ${trimInfo.maj}*\n${DIV}\n`;
    if (!suivi.is_mat) msg += `Moyenne générale : *${suivi.moy} / 20*\n`;
    msg += `Appréciation     : ${EMOJI_APPRECIATION[appreciation] || "⚪"} ${appreciation}\n\n`;
    const paragraphe = PARAGRAPHE_RESULTAT[appreciation];
    if (paragraphe) msg += `${paragraphe.replace(/\{trim\}/g, trimInfo.normal)}\n\n`;
  }

  const absencesAlerte = (suivi.absences || 0) >= SEUIL_ALERTE_ABSENCES;
  const retardsAlerte = (suivi.retards || 0) >= SEUIL_ALERTE_RETARDS;
  const blocComportement = suivi.comportement ? BLOC_COMPORTEMENT[suivi.comportement] : null;

  if (absencesAlerte || retardsAlerte || blocComportement) {
    msg += `⚠️ *SIGNALEMENT — ${trimInfo.maj}*\n${DIV}\n\n`;

    if (absencesAlerte) {
      msg += `🚨 *ABSENCES NON JUSTIFIÉES : ${suivi.absences} absence(s)*\n`;
      msg += `Votre enfant a accumulé ${suivi.absences} absence(s) non justifiée(s) au cours de ce ${trimInfo.normal}.\n`;
      msg += `Nous vous prions de bien vouloir régulariser ces absences auprès de l'administration dans les meilleurs délais.\n`;
      msg += `Une présence régulière et assidue est essentielle pour la réussite scolaire de votre enfant.\n\n`;
    }

    if (retardsAlerte) {
      msg += `🔔 *RETARDS RÉPÉTITIFS : ${suivi.retards} retard(s) enregistrés* au cours de ce ${trimInfo.normal}\n`;
      msg += `Les retards répétitifs perturbent non seulement votre enfant, mais également le bon déroulement des cours pour toute la classe.\n`;
      msg += `Nous comptons sur votre précieux soutien pour favoriser une arrivée ponctuelle chaque matin.\n`;
      msg += `Ensemble, nous pouvons corriger cette situation.\n\n`;
    }

    if (blocComportement) {
      msg += `${blocComportement.emoji} *COMPORTEMENT : ${suivi.comportement.toUpperCase()}*\n`;
      msg += `${blocComportement.texte}\n\n`;
    }
  }

  if (suivi.observation) msg += `📝 *Observation* : ${suivi.observation}\n\n`;

  msg += `${DIV}\n`;
  msg += `💛🌸 Adorables parents, vous êtes nos meilleurs partenaires !\n`;
  msg += `Nous vous remercions sincèrement pour votre confiance et votre engagement à nos côtés.\n`;
  msg += `Ensemble, bâtissons l'avenir de nos enfants avec Amour et Discipline. 💛\n\n`;
  msg += `Les Bulles de Joie — Parakou\n`;
  msg += `Tel : 01 97 91 94 52\n`;
  msg += `Amour · Travail · Discipline · Créativité`;

  return msg;
}

// Bulletin annuel détaillé : consolide les 3 trimestres d'un élève, sans
// jamais mélanger les données saisies au fil de l'année — chaque trimestre
// garde sa propre section, dans l'ordre chronologique.
function suivisAnnuelsEnfant(enfantId) {
  return LIBELLES_TRIM.map((_, i) => STATE.suivi.find(s => s.enfant_id === enfantId && s.trim === `Trimestre ${i + 1}`) || null);
}

function buildMessageBulletinAnnuel(enfant, suivis) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];
  const isMat = MAT_SECTS.includes(enfant.sect);

  let msg = `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n`.replace(/ {2,}/g, " ");
  msg += `📗 *Bulletin annuel de ${prenom}*\n\n`;

  let sommeMoyennes = 0, nbMoyennes = 0;
  suivis.forEach((s, i) => {
    msg += `*${LIBELLES_TRIM[i]}*\n`;
    if (!s) { msg += `  Non renseigné\n\n`; return; }
    const resultat = s.is_mat ? (s.appreciation || "—") : (s.moy != null ? `${s.moy}/20 (${s.appreciation || "—"})` : "—");
    if (!s.is_mat && s.moy != null) { sommeMoyennes += s.moy; nbMoyennes++; }
    msg += `  Résultat : ${resultat}\n`;
    msg += `  Absences : ${s.absences || 0} · Retards : ${s.retards || 0}\n`;
    msg += `  Comportement : ${s.comportement || "—"}\n`;
    if (s.observation) msg += `  Observation : ${s.observation}\n`;
    msg += `\n`;
  });

  if (!isMat && nbMoyennes > 0) {
    const moyenneAnnuelle = (sommeMoyennes / nbMoyennes).toFixed(2);
    msg += `*Moyenne annuelle : ${moyenneAnnuelle}/20 (${appreciationDepuisMoyenne(parseFloat(moyenneAnnuelle)) || "—"})*\n\n`;
  }

  msg += `Merci pour votre confiance tout au long de cette année scolaire.\n\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n📍 Zongo 2, Parakou · 📱 01 97 91 94 52\n_Amour · Travail · Discipline · Créativité_`;
  return msg;
}

function buildMessageAlerteDifficulte(enfant, suivi) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];
  const resultat = suivi.is_mat ? suivi.appreciation : `${suivi.moy}/20`;

  let msg = `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n`.replace(/ {2,}/g, " ");
  msg += `Nous souhaitons attirer votre attention sur les résultats de ${prenom} ce trimestre (*${resultat}*), en difficulté selon notre grille d'évaluation. Un accompagnement rapproché à la maison, et un échange avec l'équipe pédagogique, pourraient beaucoup l'aider.\n\n`;
  msg += `N'hésitez pas à nous contacter pour en discuter ensemble.\n\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n📍 Zongo 2, Parakou · 📱 01 97 91 94 52`;
  return msg;
}

function buildMessageAlerteAbsRet(enfant, suivi) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];

  let msg = `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n`.replace(/ {2,}/g, " ");
  msg += `⚠️ Nous constatons *${suivi.absences || 0} absence(s) non justifiée(s)* et *${suivi.retards || 0} retard(s) répétitif(s)* pour ${prenom} ce trimestre. La régularité est essentielle pour sa réussite — merci de veiller à sa ponctualité et de nous justifier ses absences.\n\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n📍 Zongo 2, Parakou · 📱 01 97 91 94 52`;
  return msg;
}

function buildMessageAlerteComportement(enfant, suivi) {
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];

  let msg = `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n`.replace(/ {2,}/g, " ");
  msg += `Nous aimerions échanger avec vous au sujet du comportement de ${prenom} ce trimestre, jugé *préoccupant* par l'équipe. Votre implication nous serait précieuse pour l'accompagner au mieux.\n\n`;
  msg += `💛 *L'équipe des Bulles de Joie* 🫧🌸\n📍 Zongo 2, Parakou · 📱 01 97 91 94 52`;
  return msg;
}

// ============================================================
// ENVOIS GROUPÉS (4 boutons d'alerte)
// ============================================================
function suiviDuTrimestreCourant() {
  const trim = document.getElementById("nTrim").value;
  return STATE.enfants
    .map(e => ({ enfant: e, suivi: STATE.suivi.find(s => s.enfant_id === e.id && s.trim === trim) }))
    .filter(x => x.suivi);
}

function envoyerEnMasse(liste, builder, libelle) {
  if (liste.length === 0) {
    showToast(`Aucun élève concerné par "${libelle}" ce trimestre.`, "error");
    return;
  }
  const avecTel = liste.filter(x => formatTelWA(x.enfant.tel));
  if (avecTel.length === 0) {
    showToast("Aucun des parents concernés n'a de numéro WhatsApp renseigné.", "error");
    return;
  }
  avecTel.forEach(x => sendWhatsApp(x.enfant.tel, builder(x.enfant, x.suivi)));
  showToast(`Envoi lancé pour ${avecTel.length} parent(s). Autorisez les fenêtres pop-up si votre navigateur les bloque.`, "success");
}

function handleAlerterDifficulte() {
  envoyerEnMasse(suiviDuTrimestreCourant().filter(x => estEnDifficulte(x.suivi)), buildMessageAlerteDifficulte, "parents en difficulté");
}
function handleAlerterAbsRet() {
  envoyerEnMasse(suiviDuTrimestreCourant().filter(x => aAlerteAbsRet(x.suivi)), buildMessageAlerteAbsRet, "absences/retards");
}
function handleAlerterComportement() {
  envoyerEnMasse(suiviDuTrimestreCourant().filter(x => aComportementPreoccupant(x.suivi)), buildMessageAlerteComportement, "comportement préoccupant");
}
function handleBulletinsATous() {
  envoyerEnMasse(suiviDuTrimestreCourant(), buildMessageBulletin, "bulletins à tous");
}

// Envoi groupé des bulletins annuels — inclut tout élève ayant au moins un
// trimestre renseigné (les trimestres manquants apparaissent "Non renseigné").
function handleBulletinsAnnuelsATous() {
  const liste = STATE.enfants
    .map(e => ({ enfant: e, suivis: suivisAnnuelsEnfant(e.id) }))
    .filter(x => x.suivis.some(s => s));

  if (liste.length === 0) {
    showToast("Aucun suivi enregistré pour l'année en cours.", "error");
    return;
  }
  const avecTel = liste.filter(x => formatTelWA(x.enfant.tel));
  if (avecTel.length === 0) {
    showToast("Aucun des parents concernés n'a de numéro WhatsApp renseigné.", "error");
    return;
  }
  avecTel.forEach(x => sendWhatsApp(x.enfant.tel, buildMessageBulletinAnnuel(x.enfant, x.suivis)));
  showToast(`Envoi lancé pour ${avecTel.length} parent(s). Autorisez les fenêtres pop-up si votre navigateur les bloque.`, "success");
}

// ============================================================
// MÉTRIQUES + TABLEAU RÉCAPITULATIF DU TRIMESTRE SÉLECTIONNÉ
// ============================================================
function renderNotesMetriquesEtTable() {
  const metricsRoot = document.getElementById("notesMetrics");
  const tableRoot = document.getElementById("notesTableBody");
  if (!metricsRoot || !tableRoot) return;

  const trim = document.getElementById("nTrim").value;
  const lignes = STATE.enfants.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(e => ({
    enfant: e,
    suivi: STATE.suivi.find(s => s.enfant_id === e.id && s.trim === trim) || null
  }));

  const notesSaisies = lignes.filter(x => x.suivi).length;
  const enDifficulte = lignes.filter(x => estEnDifficulte(x.suivi)).length;
  const alertesAbsRet = lignes.filter(x => aAlerteAbsRet(x.suivi)).length;
  const excellents = lignes.filter(x => estExcellent(x.suivi)).length;

  metricsRoot.innerHTML = `
    <div class="metric-card metric-navy"><div class="metric-label">Élèves inscrits</div><div class="metric-value">${STATE.enfants.length}</div></div>
    <div class="metric-card metric-green"><div class="metric-label">Notes saisies</div><div class="metric-value">${notesSaisies}</div></div>
    <div class="metric-card metric-red"><div class="metric-label">En difficulté</div><div class="metric-value">${enDifficulte}</div></div>
    <div class="metric-card metric-gold"><div class="metric-label">Alertes abs/ret</div><div class="metric-value">${alertesAbsRet}</div></div>
    <div class="metric-card metric-lime"><div class="metric-label">Excellents</div><div class="metric-value">${excellents}</div></div>
  `;

  tableRoot.innerHTML = lignes.map(x => {
    const s = x.suivi;
    const moyenneTxt = s && !s.is_mat && s.moy != null ? `${s.moy}/20` : "—";
    const absencesTxt = s ? (s.absences || 0) : "—";
    const retardsTxt = s ? (s.retards || 0) : "—";
    const comportementTxt = s ? (s.comportement || "—") : "—";
    const alerte = !!s && (estEnDifficulte(s) || aAlerteAbsRet(s) || aComportementPreoccupant(s));
    const badgeAlerte = alerte
      ? `<span class="badge badge-red"><i class="bi bi-exclamation-triangle-fill"></i> Alerter</span>`
      : `<span class="badge badge-green"><i class="bi bi-check-circle-fill"></i> Normal</span>`;
    const aTel = !!formatTelWA(x.enfant.tel);
    const aSuiviAnnee = suivisAnnuelsEnfant(x.enfant.id).some(sv => sv);

    return `<tr>
      <td>${escapeHtml(x.enfant.nom)}</td>
      <td>${escapeHtml(SECT_LABELS[x.enfant.sect] || x.enfant.sect)}</td>
      <td>${moyenneTxt}</td>
      <td>${appreciationAffichageHTML(s)}</td>
      <td>${absencesTxt}</td>
      <td>${retardsTxt}</td>
      <td>${escapeHtml(comportementTxt)}</td>
      <td>${badgeAlerte}</td>
      <td>
        ${s ? `<button class="btn btn-whatsapp btn-sm" data-notes-wa="${x.enfant.id}" ${aTel ? "" : "disabled"} title="Envoyer le bulletin du trimestre"><i class="bi bi-whatsapp"></i></button>` : ""}
        ${aSuiviAnnee ? `<button class="btn btn-ghost btn-sm" data-notes-annuel="${x.enfant.id}" ${aTel ? "" : "disabled"} title="Envoyer le bulletin annuel"><i class="bi bi-journal-check"></i></button>` : ""}
      </td>
    </tr>`;
  }).join("");

  tableRoot.querySelectorAll("[data-notes-wa]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.notesWa);
      const suivi = STATE.suivi.find(s => s.enfant_id === enfant.id && s.trim === trim);
      if (enfant && suivi) sendWhatsApp(enfant.tel, buildMessageBulletin(enfant, suivi));
    });
  });

  tableRoot.querySelectorAll("[data-notes-annuel]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.notesAnnuel);
      if (enfant) sendWhatsApp(enfant.tel, buildMessageBulletinAnnuel(enfant, suivisAnnuelsEnfant(enfant.id)));
    });
  });
}
