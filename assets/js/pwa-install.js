// ============================================================
// pwa-install.js — Bannière d'installation de l'application (PWA)
// S'affiche automatiquement sur les écrans de smartphone à chaque visite
// (tant que l'application n'est pas déjà installée) : prompt natif différé
// sur Android/Chrome, instructions manuelles sur iOS (Safari ne propose
// jamais de prompt d'installation automatique).
// ============================================================

var pwaDeferredPrompt = null;

function pwaEstMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia("(max-width: 820px)").matches;
}
function pwaEstIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function pwaEstInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function pwaAfficherBanniere(mode) {
  if (document.getElementById("pwaInstallBanner") || pwaEstInstallee()) return;

  const banniere = document.createElement("div");
  banniere.id = "pwaInstallBanner";
  banniere.className = "pwa-install-banner";

  let sousTitre, boutonHtml;
  if (mode === "ios") {
    sousTitre = "Appuyez sur <i class=\"bi bi-box-arrow-up\"></i> puis « Sur l'écran d'accueil »";
    boutonHtml = "";
  } else if (mode === "android") {
    sousTitre = "Accédez plus vite à l'application depuis votre écran d'accueil";
    boutonHtml = `<button type="button" class="btn btn-primary btn-sm" id="pwaInstallBtn">Installer</button>`;
  } else {
    sousTitre = "Ouvrez le menu de votre navigateur et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »";
    boutonHtml = "";
  }

  banniere.innerHTML = `
    <img src="assets/img/logo.webp" alt="" class="pwa-install-logo">
    <div class="pwa-install-texte">
      <div class="pwa-install-titre">Installer Les Bulles de Joie</div>
      <div class="pwa-install-sous">${sousTitre}</div>
    </div>
    ${boutonHtml}
    <button type="button" class="pwa-install-close" id="pwaInstallClose" aria-label="Fermer"><i class="bi bi-x-lg"></i></button>
  `;
  document.body.appendChild(banniere);
  requestAnimationFrame(() => banniere.classList.add("show"));

  document.getElementById("pwaInstallClose").addEventListener("click", pwaMasquerBanniere);

  const btnInstaller = document.getElementById("pwaInstallBtn");
  if (btnInstaller) {
    btnInstaller.addEventListener("click", async () => {
      if (!pwaDeferredPrompt) return;
      pwaDeferredPrompt.prompt();
      await pwaDeferredPrompt.userChoice;
      pwaDeferredPrompt = null;
      pwaMasquerBanniere();
    });
  }
}

function pwaMasquerBanniere() {
  const banniere = document.getElementById("pwaInstallBanner");
  if (!banniere) return;
  banniere.classList.remove("show");
  setTimeout(() => banniere.remove(), 250);
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pwaDeferredPrompt = e;
  if (pwaEstMobile() && !pwaEstInstallee()) pwaAfficherBanniere("android");
});

window.addEventListener("appinstalled", pwaMasquerBanniere);

document.addEventListener("DOMContentLoaded", () => {
  if (!pwaEstMobile() || pwaEstInstallee()) return;

  if (pwaEstIOS()) {
    // iOS ne déclenche jamais beforeinstallprompt : instructions directes.
    pwaAfficherBanniere("ios");
    return;
  }

  // Sur Android/autres navigateurs mobiles, on laisse une chance au prompt
  // natif de se déclencher ; sinon, instructions génériques en secours.
  setTimeout(() => {
    if (!document.getElementById("pwaInstallBanner") && !pwaEstInstallee()) {
      pwaAfficherBanniere(pwaDeferredPrompt ? "android" : "generique");
    }
  }, 2500);
});
