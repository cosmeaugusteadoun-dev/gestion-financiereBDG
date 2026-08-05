// ============================================================
// notes.js — Suivi scolaire par trimestre
// ============================================================

function initNotes() {
  document.getElementById("nEnfant").addEventListener("change", renderNotesForm);
  document.getElementById("nTrim").addEventListener("change", renderNotesForm);
  renderNotes();
}

// Rafraîchit la liste des élèves puis le formulaire (appelé après toute
// modification de dossier, pour garder le sélecteur à jour)
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
}

function renderNotesForm() {
  const root = document.getElementById("notesForm");
  if (!root) return;

  const enfantId = document.getElementById("nEnfant").value;
  const trim = document.getElementById("nTrim").value;
  const enfant = STATE.enfants.find(e => e.id === enfantId);

  if (!enfant) {
    root.innerHTML = `<p class="text-muted">Créez d'abord un dossier élève pour saisir son suivi scolaire.</p>`;
    return;
  }

  const isMat = MAT_SECTS.includes(enfant.sect);
  const isPrim = PRIM_SECTS.includes(enfant.sect);

  if (!isMat && !isPrim) {
    root.innerHTML = `<p class="text-muted">Le suivi scolaire (notes/appréciations) est disponible uniquement pour la Maternelle et le Primaire.</p>`;
    return;
  }

  const existant = STATE.suivi.find(s => s.enfant_id === enfantId && s.trim === trim) || {};

  root.innerHTML = `
    <div class="form-grid">
      ${isMat ? `
        <div class="field">
          <label>Appréciation</label>
          <select id="nAppreciation">
            <option value="">— Choisir —</option>
            <option value="Très satisfaisant" ${existant.appreciation === "Très satisfaisant" ? "selected" : ""}>Très satisfaisant</option>
            <option value="Satisfaisant" ${existant.appreciation === "Satisfaisant" ? "selected" : ""}>Satisfaisant</option>
            <option value="Peu satisfaisant" ${existant.appreciation === "Peu satisfaisant" ? "selected" : ""}>Peu satisfaisant</option>
          </select>
        </div>` : `
        <div class="field">
          <label>Moyenne générale (/20)</label>
          <input type="number" id="nMoyenne" min="0" max="20" step="0.25" value="${existant.moy ?? ""}">
        </div>`}
      <div class="field"><label>Absences</label><input type="number" id="nAbsences" min="0" value="${existant.absences ?? 0}"></div>
      <div class="field"><label>Retards</label><input type="number" id="nRetards" min="0" value="${existant.retards ?? 0}"></div>
      <div class="field">
        <label>Comportement</label>
        <select id="nComportement">
          <option value="Excellent" ${existant.comportement === "Excellent" ? "selected" : ""}>Excellent</option>
          <option value="Bon" ${existant.comportement === "Bon" ? "selected" : ""}>Bon</option>
          <option value="Moyen" ${existant.comportement === "Moyen" ? "selected" : ""}>Moyen</option>
          <option value="À améliorer" ${existant.comportement === "À améliorer" ? "selected" : ""}>À améliorer</option>
        </select>
      </div>
      <div class="field" style="grid-column: 1 / -1;">
        <label>Observation libre</label>
        <textarea id="nObservation" placeholder="Optionnel">${escapeHtml(existant.observation || "")}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnEnregistrerSuivi"><i class="bi bi-check-lg"></i> Enregistrer le suivi</button>
    </div>
  `;

  document.getElementById("btnEnregistrerSuivi").addEventListener("click", async () => {
    const suivi = {
      id: existant.id || uid("suv"),
      enfant_id: enfantId,
      trim,
      moy: isPrim ? (parseFloat(document.getElementById("nMoyenne").value) || null) : null,
      appreciation: isMat ? (document.getElementById("nAppreciation").value || null) : null,
      absences: parseInt(document.getElementById("nAbsences").value, 10) || 0,
      retards: parseInt(document.getElementById("nRetards").value, 10) || 0,
      comportement: document.getElementById("nComportement").value,
      observation: document.getElementById("nObservation").value.trim() || null,
      is_mat: isMat
    };

    try {
      await dbUpsertSuivi(suivi);
      const idx = STATE.suivi.findIndex(s => s.enfant_id === enfantId && s.trim === trim);
      if (idx >= 0) STATE.suivi[idx] = suivi; else STATE.suivi.push(suivi);
      showToast("Suivi scolaire enregistré.", "success");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement du suivi : " + err.message, "error");
    }
  });
}
