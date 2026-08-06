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

function appreciationDepuisMoyenne(m) {
  if (m === null || m === undefined || isNaN(m)) return null;
  const g = GRILLE_MOYENNE.find(x => m >= x.seuil);
  return g ? g.label : null;
}

function classeAppreciation(label) {
  const g = GRILLE_MOYENNE.find(x => x.label === label);
  return g ? g.classe : "text-muted";
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
function initNotes() {
  document.getElementById("nEnfant").addEventListener("change", renderNotesForm);
  document.getElementById("nTrim").addEventListener("change", () => {
    renderNotesForm();
    renderNotesMetriquesEtTable();
  });
  document.getElementById("btnAlerterDifficulte").addEventListener("click", handleAlerterDifficulte);
  document.getElementById("btnAlerterAbsRet").addEventListener("click", handleAlerterAbsRet);
  document.getElementById("btnAlerterComportement").addEventListener("click", handleAlerterComportement);
  document.getElementById("btnBulletinsATous").addEventListener("click", handleBulletinsATous);
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
        ${isMat ? `
          <select id="nAppreciation">
            <option value="">— Choisir —</option>
            <option value="Très satisfaisant" ${existant.appreciation === "Très satisfaisant" ? "selected" : ""}>Très satisfaisant</option>
            <option value="Satisfaisant" ${existant.appreciation === "Satisfaisant" ? "selected" : ""}>Satisfaisant</option>
            <option value="Peu satisfaisant" ${existant.appreciation === "Peu satisfaisant" ? "selected" : ""}>Peu satisfaisant</option>
          </select>` : `
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
  const civiliteTxt = enfant.civilite && enfant.civilite !== "—" ? enfant.civilite : "";
  const prenom = (enfant.nom || "").split(" ")[0];
  const resultat = suivi.is_mat
    ? (suivi.appreciation || "—")
    : (suivi.moy != null ? `${suivi.moy}/20 (${suivi.appreciation || "—"})` : "—");

  let msg = `Bonjour ${civiliteTxt} ${enfant.parent || ""} 👋,\n\n`.replace(/ {2,}/g, " ");
  msg += `📘 *Bulletin de ${prenom} — ${suivi.trim}*\n\n`;
  msg += `• Résultat : *${resultat}*\n`;
  msg += `• Absences non justifiées : ${suivi.absences || 0}\n`;
  msg += `• Retards répétitifs : ${suivi.retards || 0}\n`;
  msg += `• Comportement : ${suivi.comportement || "—"}\n`;
  if (suivi.observation) msg += `• Observation : ${suivi.observation}\n`;
  msg += `\nMerci pour votre confiance et votre implication dans le suivi de ${prenom}.\n\n`;
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
    const appreciationTxt = s ? (s.appreciation || "—") : "—";
    const absencesTxt = s ? (s.absences || 0) : "—";
    const retardsTxt = s ? (s.retards || 0) : "—";
    const comportementTxt = s ? (s.comportement || "—") : "—";
    const alerte = !!s && (estEnDifficulte(s) || aAlerteAbsRet(s) || aComportementPreoccupant(s));
    const badgeAlerte = alerte
      ? `<span class="badge badge-red"><i class="bi bi-exclamation-triangle-fill"></i> Alerter</span>`
      : `<span class="badge badge-green"><i class="bi bi-check-circle-fill"></i> Normal</span>`;
    const aTel = !!formatTelWA(x.enfant.tel);

    return `<tr>
      <td>${escapeHtml(x.enfant.nom)}</td>
      <td>${escapeHtml(SECT_LABELS[x.enfant.sect] || x.enfant.sect)}</td>
      <td>${moyenneTxt}</td>
      <td>${escapeHtml(appreciationTxt)}</td>
      <td>${absencesTxt}</td>
      <td>${retardsTxt}</td>
      <td>${escapeHtml(comportementTxt)}</td>
      <td>${badgeAlerte}</td>
      <td>${s ? `<button class="btn btn-whatsapp btn-sm" data-notes-wa="${x.enfant.id}" ${aTel ? "" : "disabled"} title="Envoyer le bulletin"><i class="bi bi-whatsapp"></i></button>` : ""}</td>
    </tr>`;
  }).join("");

  tableRoot.querySelectorAll("[data-notes-wa]").forEach(btn => {
    btn.addEventListener("click", () => {
      const enfant = STATE.enfants.find(e => e.id === btn.dataset.notesWa);
      const suivi = STATE.suivi.find(s => s.enfant_id === enfant.id && s.trim === trim);
      if (enfant && suivi) sendWhatsApp(enfant.tel, buildMessageBulletin(enfant, suivi));
    });
  });
}
