// ============================================================
// app.js — Initialisation générale, navigation entre onglets
// ============================================================

// Protection de session : retour à l'écran de connexion si non authentifié
// ou si la session a expiré (durée de vie fixée à la connexion, voir index.html)
function sessionValide() {
  try {
    const session = JSON.parse(sessionStorage.getItem("bdj_session"));
    return !!session && session.actif === true && session.expire > Date.now();
  } catch {
    return false;
  }
}
if (!sessionValide()) {
  sessionStorage.removeItem("bdj_session");
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  wireLogout();
  wireBurgerMenu();
  wireChangerMotDePasse();
  wireTabs();

  const root = document.querySelector(".main-content");
  root.style.opacity = "0.5";

  try {
    await loadAll();
    if (typeof synchroniserEtReparerDossiers === "function") {
      await synchroniserEtReparerDossiers();
    }
  } catch (err) {
    console.error(err);
    showToast("Impossible de charger les données. Vérifiez la configuration Supabase dans config.js.", "error");
    root.style.opacity = "1";
    return;
  }

  initEnfants();
  initEntrees();
  initSorties();
  initWhatsapp();
  initNotes();

  refreshAllTabs();
  root.style.opacity = "1";
});

// ============================================================
// DÉCONNEXION
// ============================================================
function deconnecter() {
  sessionStorage.removeItem("bdj_session");
  window.location.href = "index.html";
}
function wireLogout() {
  document.getElementById("btnLogout").addEventListener("click", deconnecter);
  document.getElementById("btnLogoutMobile").addEventListener("click", deconnecter);
}

// ============================================================
// MENU BURGER (mobile) — "Changer le mot de passe" + "Déconnexion"
// ============================================================
function wireBurgerMenu() {
  const bouton = document.getElementById("btnBurgerMenu");
  const icone = bouton.querySelector("i");
  const menu = document.getElementById("burgerMenu");

  function definirEtat(ouvert) {
    menu.hidden = !ouvert;
    bouton.setAttribute("aria-expanded", String(ouvert));
    icone.className = ouvert ? "bi bi-x-lg" : "bi bi-list";
  }

  bouton.addEventListener("click", (e) => {
    e.stopPropagation();
    definirEtat(menu.hidden);
  });

  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== bouton) definirEtat(false);
  });

  menu.querySelectorAll("button").forEach(item => {
    item.addEventListener("click", () => definirEtat(false));
  });
}

// ============================================================
// CHANGEMENT DE MOT DE PASSE
// ============================================================
function wireChangerMotDePasse() {
  document.getElementById("btnChangerMdp").addEventListener("click", openChangerMotDePasseModal);
  document.getElementById("btnChangerMdpMobile").addEventListener("click", openChangerMotDePasseModal);
}

function champMotDePasseHTML(id, label) {
  return `
    <div class="field">
      <label>${label}</label>
      <div class="password-wrap">
        <input type="password" id="${id}" class="login-input" autocomplete="off">
        <button type="button" class="password-toggle" data-toggle-cible="${id}" aria-label="Afficher le mot de passe" title="Afficher le mot de passe">
          <i class="bi bi-eye"></i>
        </button>
      </div>
    </div>`;
}

function openChangerMotDePasseModal() {
  openModal(`
    <div class="modal-title">Changer le mot de passe</div>
    <div class="modal-text" id="mdpErreur" style="display:none; color: var(--red);"></div>
    ${champMotDePasseHTML("mdpAncien", "Ancien mot de passe")}
    ${champMotDePasseHTML("mdpNouveau", "Nouveau mot de passe")}
    ${champMotDePasseHTML("mdpConfirmer", "Confirmer le nouveau mot de passe")}
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalAnnuler">Annuler</button>
      <button class="btn btn-primary" id="btnValiderMdp"><i class="bi bi-check-lg"></i> Enregistrer</button>
    </div>
  `);

  document.getElementById("modalAnnuler").addEventListener("click", closeModal);

  document.querySelectorAll("[data-toggle-cible]").forEach(btn => {
    btn.addEventListener("click", () => {
      const champ = document.getElementById(btn.dataset.toggleCible);
      const visible = champ.type === "text";
      champ.type = visible ? "password" : "text";
      btn.querySelector("i").className = visible ? "bi bi-eye" : "bi bi-eye-slash";
    });
  });

  document.getElementById("btnValiderMdp").addEventListener("click", async () => {
    const zoneErreur = document.getElementById("mdpErreur");
    const afficherErreurMdp = (texte) => { zoneErreur.textContent = texte; zoneErreur.style.display = "block"; };
    zoneErreur.style.display = "none";

    const ancien = document.getElementById("mdpAncien").value;
    const nouveau = document.getElementById("mdpNouveau").value;
    const confirmer = document.getElementById("mdpConfirmer").value;

    if (!ancien || !nouveau || !confirmer) {
      afficherErreurMdp("Veuillez remplir les trois champs.");
      return;
    }
    if (nouveau.length < 6) {
      afficherErreurMdp("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (nouveau !== confirmer) {
      afficherErreurMdp("Le nouveau mot de passe et sa confirmation ne correspondent pas.");
      return;
    }

    const btn = document.getElementById("btnValiderMdp");
    btn.disabled = true;
    btn.textContent = "Vérification…";

    try {
      const hashActuel = await dbRecupererHashMotDePasse();
      const hashAncienSaisi = await sha256HexApp(ancien);

      if (hashAncienSaisi !== hashActuel) {
        afficherErreurMdp("L'ancien mot de passe saisi est incorrect.");
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-check-lg"></i> Enregistrer`;
        return;
      }

      const hashNouveau = await sha256HexApp(nouveau);
      await dbChangerMotDePasse(hashNouveau);
      closeModal();
      showToast("Mot de passe changé avec succès. Utilisez le nouveau mot de passe à la prochaine connexion.", "success");
    } catch (err) {
      console.error(err);
      afficherErreurMdp("Erreur technique : " + err.message);
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-check-lg"></i> Enregistrer`;
    }
  });
}

// Empreinte SHA-256 (hexadécimal) — même logique que l'écran de connexion
async function sha256HexApp(texte) {
  const donnees = new TextEncoder().encode(texte);
  const hash = await crypto.subtle.digest("SHA-256", donnees);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================
// NAVIGATION PAR ONGLETS
// ============================================================
function wireTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tabName}`));
  window.scrollTo({ top: 0, behavior: "auto" });
}

// Ouvre le dossier d'un enfant depuis un autre onglet (ex. alerte de retard)
function verFicheEnfant(enfantId) {
  switchTab("enfants");
  openIds.add(enfantId);
  renderEnfantsList();
  requestAnimationFrame(() => {
    const el = document.getElementById(`enfant-${enfantId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ============================================================
// RAFRAÎCHISSEMENT GLOBAL
// Appelé après toute création/modification/suppression de données
// pour que tous les onglets restent synchronisés entre eux.
// ============================================================
function refreshAllTabs() {
  renderDashboard();
  renderEnfantsList();
  renderEntreesList();
  renderSortiesList();
  renderBilans();
  renderWhatsAppTab();
  renderMessagerieTab();
  renderNotes();
  renderBilanGeneral();
}
