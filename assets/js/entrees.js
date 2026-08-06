// ============================================================
// entrees.js — Saisie des paiements reçus + synchro des dossiers
// ============================================================

var selectedEnfantId = null;

// ============================================================
// INITIALISATION DU MODULE
// ============================================================
function initEntrees() {
  document.getElementById("eDate").value = new Date().toISOString().slice(0, 10);

  document.getElementById("eNom").addEventListener("input", handleNomInput);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#eNomSuggestions") && e.target.id !== "eNom") {
      document.getElementById("eNomSuggestions").style.display = "none";
    }
  });

  document.getElementById("formEntree").addEventListener("submit", handleCreateEntree);
  document.getElementById("btnResetEntree").addEventListener("click", resetEntreeForm);

  document.querySelectorAll('input[name="eSect"]').forEach(cb => {
    cb.addEventListener("change", () => cb.closest(".checkbox-item").classList.toggle("checked", cb.checked));
  });
}

// ============================================================
// AUTOCOMPLÉTION DU NOM (recherche dans les dossiers enfants)
// ============================================================
function handleNomInput() {
  selectedEnfantId = null;
  reinitialiserFiltreSecteurs();
  const valeur = document.getElementById("eNom").value.trim().toLowerCase();
  const box = document.getElementById("eNomSuggestions");

  if (valeur.length < 1) { box.style.display = "none"; return; }

  const correspondances = STATE.enfants
    .filter(e => e.nom.toLowerCase().includes(valeur))
    .slice(0, 8);

  if (correspondances.length === 0) { box.style.display = "none"; return; }

  box.innerHTML = correspondances.map(e => `
    <div class="checkbox-item" style="cursor:pointer; margin-bottom:4px;" data-pick="${e.id}">
      <strong>${escapeHtml(e.nom)}</strong>&nbsp;<span class="text-muted">— ${SECT_LABELS[e.sect] || e.sect}</span>
    </div>`).join("");
  box.style.display = "block";

  box.querySelectorAll("[data-pick]").forEach(el => {
    el.addEventListener("click", () => {
      const enfant = STATE.enfants.find(x => x.id === el.dataset.pick);
      document.getElementById("eNom").value = enfant.nom;
      selectedEnfantId = enfant.id;
      box.style.display = "none";
      document.getElementById("eNomHint").textContent = `Section : ${SECT_LABELS[enfant.sect] || enfant.sect}`;
      filtrerSecteursSelonEnfant(enfant);
    });
  });
}

// ============================================================
// FILTRAGE DES SECTEURS SELON LA SECTION DE L'ENFANT SÉLECTIONNÉ
// Un enfant de la crèche n'a pas de postes "Cantine" (seulement "Cantine
// crèche") : on grise les secteurs qui ne correspondent à aucun de ses
// postes réels, pour éviter qu'un paiement parte sur la mauvaise case.
// ============================================================
function filtrerSecteursSelonEnfant(enfant) {
  const postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
  const catsDisponibles = new Set(postesEnfant.map(p => p.cat));
  const keysDisponibles = new Set(postesEnfant.map(p => p.key));

  document.querySelectorAll("#eSecteurs .checkbox-item").forEach(item => {
    const input = item.querySelector("input");
    const label = input.value;
    let ok;
    if (SECT_TO_KEY[label]) ok = keysDisponibles.has(SECT_TO_KEY[label]);
    else if (SECT_TO_CAT[label]) ok = SECT_TO_CAT[label].some(cat => catsDisponibles.has(cat));
    else ok = true;

    input.disabled = !ok;
    if (!ok) { input.checked = false; item.classList.remove("checked"); }
    item.classList.toggle("disabled", !ok);
  });
}

function reinitialiserFiltreSecteurs() {
  document.getElementById("eNomHint").textContent = "";
  document.querySelectorAll("#eSecteurs .checkbox-item").forEach(item => {
    item.querySelector("input").disabled = false;
    item.classList.remove("disabled");
  });
}

function resetEntreeForm() {
  document.getElementById("formEntree").reset();
  document.getElementById("eDate").value = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[name="eSect"]').forEach(cb => cb.closest(".checkbox-item").classList.remove("checked"));
  document.getElementById("eNomSuggestions").style.display = "none";
  selectedEnfantId = null;
  reinitialiserFiltreSecteurs();
}

// ============================================================
// IMPUTATION D'UN PAIEMENT SUR PLUSIEURS SECTEURS
// Répartit le montant, secteur par secteur, en s'appuyant sur
// imputerPaiement() (postes.js) pour la règle du mois consécutif.
// ============================================================
// Retourne la liste des versements effectués : [{ poste, montant }, ...]
// Nécessaire pour pouvoir annuler précisément ce paiement si l'entrée est
// supprimée plus tard (voir openDeleteEntreeModal).
function imputerPaiementMultiSecteur(postes, secteurs, montantTotal, moisDepart) {
  let reste = montantTotal;
  const allocations = [];

  secteurs.forEach(sect => {
    if (reste <= 0) return;

    if (SECT_TO_KEY[sect]) {
      const poste = postes.find(p => p.key === SECT_TO_KEY[sect]);
      if (poste) {
        const manque = Math.max((poste.du || 0) - (poste.paye || 0), 0);
        const verse = Math.min(reste, manque);
        if (verse > 0) {
          poste.paye = (poste.paye || 0) + verse;
          allocations.push({ poste, montant: verse });
          reste -= verse;
        }
      }
    } else if (SECT_TO_CAT[sect]) {
      SECT_TO_CAT[sect].forEach(cat => {
        if (reste <= 0) return;

        // Postes à montant libre (Fournitures, Uniformes, Services ponctuels
        // crèche...) : pas de "dû" fixe à solder, le versement crédite
        // directement le poste au lieu de passer par la règle du mois
        // consécutif (qui ne s'applique qu'aux postes à montant fixe).
        const posteVar = postes.find(p => p.cat === cat && p.is_var);
        if (posteVar) {
          posteVar.paye = (posteVar.paye || 0) + reste;
          allocations.push({ poste: posteVar, montant: reste });
          reste = 0;
          return;
        }

        const cibles = postes.filter(p => p.cat === cat && !p.is_var && !p.is_remise && p.key !== "avance");
        const manqueTotal = cibles.reduce((s, p) => s + Math.max((p.du || 0) - (p.paye || 0), 0), 0);
        const allouer = Math.min(reste, manqueTotal);
        if (allouer > 0) {
          allocations.push(...imputerPaiement(postes, cat, allouer, moisDepart));
          reste -= allouer;
        }
      });
    }
  });

  // Surplus final (aucune dette restante dans les secteurs sélectionnés)
  if (reste > 0) {
    const cibleCat = secteurs[0] || "Général";
    let avance = postes.find(p => p.key === "avance" && p.cat === cibleCat);
    if (!avance) {
      avance = { key: "avance", cat: cibleCat, label: "Avance / Trop-perçu", du: 0, paye: 0 };
      postes.push(avance);
    }
    avance.paye = (avance.paye || 0) + reste;
    allocations.push({ poste: avance, montant: reste });
  }

  return allocations;
}

// ============================================================
// ENREGISTREMENT D'UN PAIEMENT
// ============================================================
async function handleCreateEntree(e) {
  e.preventDefault();

  const date = document.getElementById("eDate").value;
  const nom = document.getElementById("eNom").value.trim();
  const montant = parseFloat(document.getElementById("eMontant").value);
  const mode = document.getElementById("eMode").value;
  const moisDepart = document.getElementById("eMois").value || null;
  const note = document.getElementById("eNote").value.trim();
  const secteurs = Array.from(document.querySelectorAll('input[name="eSect"]:checked')).map(cb => cb.value);

  if (!date || !nom || !montant || montant <= 0) {
    showToast("Veuillez renseigner la date, le nom et un montant valide.", "error");
    return;
  }
  if (secteurs.length === 0) {
    showToast("Sélectionnez au moins un secteur concerné par ce paiement.", "error");
    return;
  }

  const enfant = selectedEnfantId
    ? STATE.enfants.find(x => x.id === selectedEnfantId)
    : STATE.enfants.find(x => x.nom.toLowerCase() === nom.toLowerCase());

  const entree = {
    id: uid("ent"), date, nom, enfant_id: enfant ? enfant.id : null,
    sect: secteurs.join(", "), mois: moisDepart, mt: montant, mode, note: note || null,
    allocations: []
  };

  try {
    let postesEnfant = [];

    if (enfant) {
      postesEnfant = STATE.postes.filter(p => p.enfant_id === enfant.id);
      const allocations = imputerPaiementMultiSecteur(postesEnfant, secteurs, montant, moisDepart);

      // Les nouveaux postes "Avance" créés pendant l'imputation n'ont pas
      // encore d'identifiant : on les rattache avant de les persister
      postesEnfant.forEach(p => {
        if (!p.id) {
          p.id = uid("pst");
          p.enfant_id = enfant.id;
          STATE.postes.push(p);
        }
      });

      // Trace précisément quel poste a reçu quoi, pour pouvoir annuler
      // ce paiement proprement si l'entrée est supprimée plus tard.
      entree.allocations = allocations.map(a => ({ poste_id: a.poste.id, montant: a.montant }));
    }

    await dbInsertEntree(entree);
    STATE.entrees.unshift(entree);

    if (enfant) {
      await dbUpsertPostes(postesEnfant);
      // Aucun envoi WhatsApp automatique ici : une fois toutes les entrées
      // saisies pour l'enfant, utilisez le bouton "Envoyer bilan WhatsApp"
      // de son dossier (onglet Dossiers enfants ou onglet WhatsApp).
    }

    resetEntreeForm();
    refreshAllTabs();
    showToast(`Paiement de ${fmtFCFA(montant)} enregistré avec succès.`, "success");
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de l'enregistrement du paiement : " + err.message, "error");
  }
}

// ============================================================
// RENDU DE L'HISTORIQUE DES ENTRÉES
// ============================================================
// Mini-bilan en haut de l'onglet : total encaissé, nombre d'opérations, et
// les 3 secteurs qui ont le plus rapporté — pour un coup d'œil rapide sans
// devoir aller sur Bilans secteurs.
function renderEntreesMetrics() {
  const root = document.getElementById("entreesMetrics");
  if (!root) return;

  const total = STATE.entrees.reduce((s, e) => s + (Number(e.mt) || 0), 0);
  const recettesParSecteur = calculerRecettesParSecteur();
  const topSecteurs = Object.entries(recettesParSecteur).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const tuilesSecteurs = topSecteurs.map(([sect, mt], i) => {
    const couleurs = ["metric-navy", "metric-lime", "metric-gold"];
    return `<div class="metric-card ${couleurs[i] || "metric-navy"}"><div class="metric-label">${escapeHtml(sect)}</div><div class="metric-value small">${fmtFCFA(mt)}</div></div>`;
  }).join("");

  root.innerHTML = `
    <div class="metric-card metric-green"><div class="metric-label">Total entrées</div><div class="metric-value">${fmtFCFA(total)}</div></div>
    <div class="metric-card metric-navy"><div class="metric-label">Opérations</div><div class="metric-value">${STATE.entrees.length}</div></div>
    ${tuilesSecteurs}
  `;
}

function renderEntreesList() {
  const tbody = document.getElementById("entreesList");
  if (!tbody) return;

  renderEntreesMetrics();

  const liste = STATE.entrees.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (liste.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aucun paiement enregistré pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = liste.map(en => `
    <tr>
      <td>${formatDateFR(en.date)}</td>
      <td>${escapeHtml(en.nom)}</td>
      <td>${escapeHtml(en.sect || "—")}</td>
      <td>${en.mois || "—"}</td>
      <td><strong>${fmtFCFA(en.mt)}</strong></td>
      <td>${escapeHtml(en.mode)}</td>
      <td><button class="btn btn-danger btn-sm" data-del-entree="${en.id}" title="Supprimer"><i class="bi bi-trash"></i></button></td>
    </tr>`).join("");

  tbody.querySelectorAll("[data-del-entree]").forEach(btn => {
    btn.addEventListener("click", () => openDeleteEntreeModal(btn.dataset.delEntree));
  });
}

function openDeleteEntreeModal(entreeId) {
  const entree = STATE.entrees.find(e => e.id === entreeId);
  if (!entree) return;

  const aDesAllocations = Array.isArray(entree.allocations) && entree.allocations.length > 0;
  const texteAvertissement = aDesAllocations
    ? "Les montants correspondants seront automatiquement retirés du dossier de l'enfant."
    : "Ce paiement a été enregistré avant la mise à jour du logiciel : les montants déjà crédités sur le dossier de l'enfant ne pourront pas être retirés automatiquement — ajustez le dossier manuellement si nécessaire.";

  confirmModal({
    titre: "Supprimer ce paiement ?",
    texte: `Le paiement de <strong>${fmtFCFA(entree.mt)}</strong> du ${formatDateFR(entree.date)} pour <strong>${escapeHtml(entree.nom)}</strong> sera supprimé de l'historique. ${texteAvertissement}`,
    labelConfirmer: "Supprimer",
    onConfirm: async () => {
      try {
        const postesTouches = [];
        (entree.allocations || []).forEach(a => {
          const poste = STATE.postes.find(p => p.id === a.poste_id);
          if (poste) {
            poste.paye = Math.max((poste.paye || 0) - (a.montant || 0), 0);
            postesTouches.push(poste);
          }
        });
        if (postesTouches.length > 0) await dbUpsertPostes(postesTouches);

        await dbDeleteEntree(entree.id);
        STATE.entrees = STATE.entrees.filter(e => e.id !== entree.id);
        refreshAllTabs();
        showToast(
          aDesAllocations ? "Paiement supprimé et dossier de l'enfant mis à jour." : "Paiement supprimé de l'historique.",
          "success"
        );
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la suppression : " + err.message, "error");
      }
    }
  });
}
