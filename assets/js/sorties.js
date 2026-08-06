// ============================================================
// sorties.js — Dépenses de l'école
// ============================================================

function initSorties() {
  document.getElementById("sDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("formSortie").addEventListener("submit", handleCreateSortie);
  document.getElementById("btnResetSortie").addEventListener("click", resetSortieForm);

  // Style visuel (case cochée) pour le groupe de radios "Secteur imputé"
  document.querySelectorAll('input[name="sSecteur"]').forEach(radio => {
    radio.addEventListener("change", () => {
      document.querySelectorAll('#sSecteurs .checkbox-item').forEach(item => item.classList.remove("checked"));
      radio.closest(".checkbox-item").classList.add("checked");
    });
  });
}

function resetSortieForm() {
  document.getElementById("formSortie").reset();
  document.getElementById("sDate").value = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('#sSecteurs .checkbox-item').forEach(item => item.classList.remove("checked"));
}

async function handleCreateSortie(e) {
  e.preventDefault();

  const date = document.getElementById("sDate").value;
  const cat = document.getElementById("sCat").value;
  const secteurEl = document.querySelector('input[name="sSecteur"]:checked');
  const secteur = secteurEl ? secteurEl.value : "";
  const label = document.getElementById("sLabel").value.trim();
  const montant = parseFloat(document.getElementById("sMontant").value);
  const note = document.getElementById("sNote").value.trim();

  if (!date || !cat || !secteur || !label || !montant || montant <= 0) {
    showToast("Veuillez remplir tous les champs obligatoires, y compris le secteur imputé.", "error");
    return;
  }

  const sortie = { id: uid("sor"), date, cat, secteur, label, mt: montant, note: note || null };

  try {
    await dbInsertSortie(sortie);
    STATE.sorties.unshift(sortie);
    resetSortieForm();
    refreshAllTabs();
    showToast(`Dépense de ${fmtFCFA(montant)} enregistrée.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'enregistrement : " + err.message, "error");
  }
}

function renderSortiesList() {
  const tbody = document.getElementById("sortiesList");
  if (!tbody) return;

  const liste = STATE.sorties.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Aucune dépense enregistrée pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(s => `
    <tr>
      <td>${formatDateFR(s.date)}</td>
      <td>${escapeHtml(s.cat)}</td>
      <td>${escapeHtml(s.secteur || "Administratif / Divers")}</td>
      <td>${escapeHtml(s.label)}</td>
      <td><strong>${fmtFCFA(s.mt)}</strong></td>
      <td><button class="btn btn-danger btn-sm" data-del-sortie="${s.id}" title="Supprimer"><i class="bi bi-trash"></i></button></td>
    </tr>`).join("");

  tbody.querySelectorAll("[data-del-sortie]").forEach(btn => {
    btn.addEventListener("click", () => openDeleteSortieModal(btn.dataset.delSortie));
  });
}

function openDeleteSortieModal(sortieId) {
  const sortie = STATE.sorties.find(s => s.id === sortieId);
  if (!sortie) return;

  confirmModal({
    titre: "Supprimer cette dépense ?",
    texte: `La dépense « <strong>${escapeHtml(sortie.label)}</strong> » de <strong>${fmtFCFA(sortie.mt)}</strong> du ${formatDateFR(sortie.date)} sera définitivement supprimée.`,
    labelConfirmer: "Supprimer",
    onConfirm: async () => {
      try {
        await dbDeleteSortie(sortie.id);
        STATE.sorties = STATE.sorties.filter(s => s.id !== sortie.id);
        refreshAllTabs();
        showToast("Dépense supprimée.", "success");
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la suppression : " + err.message, "error");
      }
    }
  });
}
