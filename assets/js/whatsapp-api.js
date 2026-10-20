// Meta Cloud API : aucun secret Meta dans le navigateur.
var campagneWhatsAppApi = null;
var envoiWhatsAppApiEnCours = false;
var pauseWhatsAppApi = false;
var modalWhatsAppApiVisible = false;
var contexteWhatsAppApi = null;

function numeroWhatsAppApi(tel) {
  let n = String(tel || "").replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  // Bénin : préfixe national 01 depuis novembre 2024 (ARCEP).
  if (n.length === 8) n = "22901" + n;
  else if (n.length === 10 && n.startsWith("01")) n = "229" + n;
  else if (n.length === 11 && n.startsWith("229")) n = "22901" + n.slice(3);
  if (n.startsWith("229") && !(n.length === 13 && n.startsWith("22901"))) return "";
  return /^[1-9]\d{7,14}$/.test(n) ? n : "";
}

async function appelerWhatsAppApi(body) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Reconnectez-vous au compte d'envoi WhatsApp.");
  let response;
  try {
    response = await fetch(`${window.SUPABASE_URL}/functions/v1/whatsapp-send`, {
    method: "POST", headers: { apikey: window.SUPABASE_ANON, Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
    });
  } catch (cause) {
    const err = new Error(`Connexion au service WhatsApp impossible. Vérifiez que la fonction whatsapp-send est déployée et que WHATSAPP_ALLOWED_ORIGINS contient exactement ${window.location?.origin || "l'origine de votre site"}. Vérifiez également votre connexion réseau.`);
    err.reseau = true;
    err.cause = cause;
    throw err;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(result.error || (response.status === 404 ? "La fonction whatsapp-send est introuvable. Déployez-la dans votre projet Supabase." : "Service WhatsApp indisponible."));
    err.status = response.status;
    throw err;
  }
  return result;
}

function sauvegarderCampagneWhatsAppApi() {
  try { window.sessionStorage.setItem("bdj_campagne_whatsapp_api", JSON.stringify(campagneWhatsAppApi)); return true; }
  catch (_) { return false; }
}

function restaurerCampagneWhatsAppApi() {
  try {
    const c = JSON.parse(window.sessionStorage.getItem("bdj_campagne_whatsapp_api"));
    if (!c || !Array.isArray(c.destinataires) || typeof c.template !== "string" || typeof c.language !== "string") return null;
    if (!c.destinataires.every(d => typeof d.requestId === "string" && typeof d.numero === "string" &&
      Array.isArray(d.parameters) && Array.isArray(d.enfants) && ["a_traiter", "sending", "accepted", "failed", "unknown", "pending"].includes(d.status))) return null;
    c.destinataires.forEach(d => { if (d.status === "sending") d.status = "unknown"; });
    return c;
  } catch (_) { return null; }
}

async function openWhatsAppApiModal(contexte) {
  if (contexte) contexteWhatsAppApi = contexte;
  if (contexte && !envoiWhatsAppApiEnCours && campagneWhatsAppApi?.destinataires.every(d => ["accepted","failed"].includes(d.status))) { campagneWhatsAppApi = null; sauvegarderCampagneWhatsAppApi(); }
  if (envoiWhatsAppApiEnCours) { renderCampagneWhatsAppApi(); return; }
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { openConnexionWhatsAppApi(); return; }
    if (!campagneWhatsAppApi) campagneWhatsAppApi = restaurerCampagneWhatsAppApi();
    if (campagneWhatsAppApi) { renderCampagneWhatsAppApi(); return; }
    const config = await appelerWhatsAppApi({ action: "config" });
    // Les anniversaires gardent leur bouton individuel et les textes classiques.
    config.templates = (config.templates || []).filter(t => t.name !== "bdj_anniversaire");
    if (!config.templates?.length) {
      openModal('<div class="modal-title">Liste des modèles à configurer</div><p class="modal-text">La connexion au serveur fonctionne, mais sa liste de modèles est vide. Les modèles actifs dans Meta ne sont pas importés automatiquement.</p><p class="modal-text">Dans Supabase → Edge Functions → Secrets, remplacez la valeur de WHATSAPP_TEMPLATES_JSON par le contenu du fichier whatsapp-collective-config.json fourni avec le logiciel, après vérification des noms, langues et variables dans Meta. Enregistrez puis rouvrez ce bouton.</p><div class="modal-actions"><button class="btn btn-ghost" id="apiFermer">Fermer</button></div>');
      document.getElementById("apiFermer").addEventListener("click", closeModal);
      return;
    }
    const source = contexteWhatsAppApi?.liste || enfantsFiltresMessagerie();
    const liste = source.filter(consentementWhatsAppValide).map(e => ({ ...e, tel: numeroWhatsAppApi(e.tel) }));
    const file = preparerFileWhatsApp(liste, composerMessageMessagerie());
    if (!file.destinataires.length) throw new Error("Aucun destinataire avec un numéro et un consentement WhatsApp valides.");
    const type = contexteWhatsAppApi?.type || BDJ_MODELE_PAR_FILTRE[document.getElementById("msgFiltrePreset")?.value];
    if (type) {
      config.templates = config.templates.filter(t => t.name === `bdj_${type}`);
      if (!config.templates.length) throw new Error(`Le modèle bdj_${type} doit être approuvé dans Meta et configuré sur le serveur.`);
    }
    openModal(`
      <div class="modal-title">Envoi automatique à ${file.destinataires.length} parent(s)</div>
      <p class="field-hint">Messagerie collective via le numéro API de l'école : +229 01 49 77 77 00.</p>
      <p class="modal-text">${source.length - liste.length} dossier(s) exclus sans consentement valide. Les modèles personnalisés produisent un message par enfant : chaque enfant d'un même parent conserve ses propres informations.</p>
      <div class="field"><label>Modèle approuvé</label><select id="apiModele">${config.templates.map((t, i) => `<option value="${i}">${escapeHtml(t.label || t.name)} (${escapeHtml(t.language)})</option>`).join("")}</select></div>
      <div id="apiParametres"></div>
      <details><summary>Aperçu du message pour le premier enfant</summary><p id="apiApercu" style="white-space:pre-wrap"></p></details>
      <details><summary>Destinataires (${file.destinataires.length})</summary>${file.destinataires.map(d => `<p>${escapeHtml(d.parent)} — ${escapeHtml(d.enfants.join(", "))} · +${escapeHtml(d.numero)}</p>`).join("")}</details>
      <p class="field-hint">Le statut « Accepté par WhatsApp » confirme l'acceptation par l'API, pas encore la livraison au téléphone du parent.</p>
      <div class="modal-actions"><button class="btn btn-ghost" id="apiAnnuler">Annuler</button><button class="btn btn-primary" id="apiEnvoyer">Envoyer à ${file.destinataires.length} parent(s)</button></div>
    `);
    const renderChamps = () => {
      const t = config.templates[Number(document.getElementById("apiModele").value)];
      document.getElementById("apiParametres").innerHTML = t.fields.map((f, i) => f.source === "manuel"
        ? `<div class="field"><label>${escapeHtml(f.label || f.key)}</label><input id="apiChamp-${i}" maxlength="1024" required></div>`
        : `<p class="field-hint">${escapeHtml(f.label || f.key)} : ${f.source === "enfant" ? "rempli automatiquement depuis le dossier de chaque enfant" : f.source === "parent" ? "nom du parent" : f.source === "enfants" ? "enfant(s) du parent" : "message rédigé dans la messagerie"}.</p>`).join("");
      const messages = t.fields.some(f => f.source === "enfant") ? liste.length : file.destinataires.length;
      document.getElementById("apiEnvoyer").textContent = `Envoyer ${messages} message(s)`;
      const apercu = () => {
        try {
          const v = valeursModeleWhatsApp(liste[0], contexteWhatsAppApi?.contextes?.[liste[0].id] || (t.name === "bdj_information_classe" ? { observation:file.texte, trim:"Information générale" } : {}));
          const params = t.fields.map((f,i) => f.source === "enfant" ? parametreWhatsApp(v[f.key]) : f.source === "parent" ? liste[0].parent || "Parent" : f.source === "enfants" ? file.destinataires[0].enfants.join(", ") : f.source === "message" ? parametreWhatsApp(file.texte) : document.getElementById(`apiChamp-${i}`).value || "—");
          document.getElementById("apiApercu").textContent = t.body ? t.body.replace(/\{\{(\d+)\}\}/g, (_,n) => params[Number(n)-1] || "—") + (t.footer ? "\n" + t.footer : "") : params.join("\n");
        } catch (err) { document.getElementById("apiApercu").textContent = err.message; }
      };
      t.fields.forEach((f,i) => { if (f.source === "manuel") document.getElementById(`apiChamp-${i}`).addEventListener("input", apercu); });
      apercu();
    };
    renderChamps();
    document.getElementById("apiModele").addEventListener("change", renderChamps);
    document.getElementById("apiAnnuler").addEventListener("click", closeModal);
    document.getElementById("apiEnvoyer").addEventListener("click", async () => {
      if (envoiWhatsAppApiEnCours) return;
      try {
        const t = config.templates[Number(document.getElementById("apiModele").value)];
        if (t.fields.some((f,i) => f.source === "manuel" && !document.getElementById(`apiChamp-${i}`).value.trim())) throw new Error("Complétez tous les champs du modèle.");
        if (t.fields.some(f => f.source === "message") && !file.texte.trim()) throw new Error("Rédigez le message avant l'envoi.");
        const personnel = t.fields.some(f => f.source === "enfant");
        const destinataires = personnel ? liste.map(e => {
          const v = valeursModeleWhatsApp(e, contexteWhatsAppApi?.contextes?.[e.id] || (t.name === "bdj_information_classe" ? { observation: file.texte, trim: "Information générale" } : {}));
          return { numero:e.tel, parent:e.parent || "Parent", enfants:[e.nom], enfantIds:[e.id], status:"a_traiter", requestId:crypto.randomUUID(),
            parameters:t.fields.map((f,i) => parametreWhatsApp(f.source === "enfant" ? v[f.key] : f.source === "parent" ? e.parent : f.source === "enfants" ? e.nom : f.source === "message" ? file.texte : document.getElementById(`apiChamp-${i}`).value.trim())) };
        })
          : file.destinataires.map(d => ({ ...d, enfantIds: liste.filter(e => e.tel === d.numero).map(e => e.id), status: "a_traiter", requestId: crypto.randomUUID(),
            parameters: t.fields.map((f, i) => parametreWhatsApp(f.source === "parent" ? d.parent : f.source === "enfants" ? d.enfants.join(", ") : f.source === "message" ? file.texte : document.getElementById(`apiChamp-${i}`).value.trim())) }));
        if (destinataires.some(d => d.parameters.some(p => !p.trim() || p.length > 1024))) throw new Error("Renseignez les paramètres du modèle (1 024 caractères maximum par paramètre).");
        campagneWhatsAppApi = { template: t.name, language: t.language, label: t.label || t.name, destinataires };
        if (!sauvegarderCampagneWhatsAppApi()) {
          campagneWhatsAppApi = null;
          throw new Error("Le stockage de session est indisponible. Activez-le avant d'envoyer pour pouvoir reprendre sans doublons.");
        }
        modalWhatsAppApiVisible = true;
        await envoyerCampagneWhatsAppApi();
      } catch (err) { showToast(err.message, "error"); }
    });
  } catch (err) {
    if ([401, 403].includes(err.status)) openConnexionWhatsAppApi(err.message);
    else if (err.reseau) {
      openModal(`<div class="modal-title">Connexion API à vérifier</div><p class="modal-text">${escapeHtml(err.message)}</p><div class="modal-actions"><button class="btn btn-ghost" id="apiDiagnosticFermer">Fermer</button></div>`);
      document.getElementById("apiDiagnosticFermer").addEventListener("click", closeModal);
    }
    else showToast(err.message, "error");
  }
}

function openConnexionWhatsAppApi(erreur = "") {
  openModal(`
    <div class="modal-title">Connexion au service d'envoi WhatsApp</div>
    ${erreur ? `<p class="text-red">${escapeHtml(erreur)}</p>` : ""}
    <p class="modal-text">Utilisez le compte d'envoi de l'école créé dans Supabase Auth. Le token Meta reste sur le serveur.</p>
    <div class="field"><label>Email</label><input type="email" id="apiEmail" autocomplete="username"></div>
    <div class="field"><label>Mot de passe</label><input type="password" id="apiPassword" autocomplete="current-password"></div>
    <div class="modal-actions"><button class="btn btn-ghost" id="apiAnnuler">Annuler</button><button class="btn btn-primary" id="apiConnexion">Connexion</button></div>
  `);
  document.getElementById("apiAnnuler").addEventListener("click", closeModal);
  document.getElementById("apiConnexion").addEventListener("click", async ev => {
    const bouton = ev.currentTarget;
    if (bouton.disabled) return;
    bouton.disabled = true;
    try {
      const email = document.getElementById("apiEmail").value.trim(), password = document.getElementById("apiPassword").value;
      if (!email || !password) throw new Error("Renseignez l'email et le mot de passe du compte d'envoi.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Connexion au compte d'envoi refusée. Vérifiez les identifiants.");
      document.getElementById("apiPassword").value = "";
      await openWhatsAppApiModal();
    } catch (err) { bouton.disabled = false; showToast(err.message, "error"); }
  });
}

function renderCampagneWhatsAppApi() {
  const c = campagneWhatsAppApi;
  if (!c) return;
  modalWhatsAppApiVisible = true;
  const acceptes = c.destinataires.filter(d => d.status === "accepted").length;
  const echecs = c.destinataires.filter(d => d.status === "failed").length;
  const libelles = { a_traiter: "À envoyer", sending: "En cours", accepted: "Accepté par WhatsApp", failed: "Refusé", unknown: "À vérifier", pending: "À vérifier (journal en attente)" };
  openModal(`
    <div class="modal-title">Envoi WhatsApp — ${escapeHtml(c.label)}</div>
    <p>${acceptes}/${c.destinataires.length} accepté(s) par WhatsApp · ${echecs} refusé(s).</p>
    <div style="max-height:45vh;overflow:auto">${c.destinataires.map(d => `<p><strong>${escapeHtml(d.enfants.join(", "))}</strong> — ${escapeHtml(libelles[d.status])}${d.error ? `<br><span class="text-red">${escapeHtml(d.error)}</span>` : ""}</p>`).join("")}</div>
    <p class="field-hint">Les envois acceptés ne sont pas renvoyés à la reprise. Un résultat incertain doit être vérifié avant de créer un nouvel envoi pour ce parent.</p>
    <div class="modal-actions"><button class="btn btn-ghost" id="apiFermer">Fermer</button>${envoiWhatsAppApiEnCours ? '<button class="btn btn-secondary" id="apiPause">Mettre en pause</button>' : '<button class="btn btn-primary" id="apiReprendre">Vérifier / reprendre</button><button class="btn btn-secondary" id="apiNouvelle">Nouvelle liste</button>'}</div>
  `);
  document.getElementById("apiFermer").addEventListener("click", () => { modalWhatsAppApiVisible = false; closeModal(); });
  document.getElementById("apiPause")?.addEventListener("click", () => { pauseWhatsAppApi = true; });
  document.getElementById("apiReprendre")?.addEventListener("click", envoyerCampagneWhatsAppApi);
  document.getElementById("apiNouvelle")?.addEventListener("click", () => {
    if (envoiWhatsAppApiEnCours) return;
    campagneWhatsAppApi = null; sauvegarderCampagneWhatsAppApi(); openWhatsAppApiModal();
  });
}

async function envoyerCampagneWhatsAppApi() {
  if (!campagneWhatsAppApi || envoiWhatsAppApiEnCours) return;
  const campagne = campagneWhatsAppApi;
  modalWhatsAppApiVisible = true;
  envoiWhatsAppApiEnCours = true; pauseWhatsAppApi = false;
  try {
    for (const d of campagne.destinataires) {
      if (pauseWhatsAppApi) break;
      if (["accepted", "failed"].includes(d.status)) continue;
      if (!d.enfantIds?.length || d.enfantIds.some(id => !consentementWhatsAppValide(STATE.enfants.find(e => e.id === id)))) {
        d.status = "failed"; d.error = "Consentement retiré ou coordonnées modifiées : envoi exclu."; sauvegarderCampagneWhatsAppApi(); continue;
      }
      d.status = "sending";
      if (!sauvegarderCampagneWhatsAppApi()) {
        d.status = "a_traiter"; d.error = "Stockage de progression indisponible. Envoi mis en pause avant cet appel.";
        pauseWhatsAppApi = true;
        break;
      }
      if (modalWhatsAppApiVisible) renderCampagneWhatsAppApi();
      try {
        const result = await appelerWhatsAppApi({ action: "send", requestId: d.requestId, to: d.numero,
          template: campagne.template, language: campagne.language, parameters: d.parameters, enfantIds: d.enfantIds });
        d.status = ["accepted", "failed", "unknown", "pending"].includes(result.status) ? result.status : "unknown";
        d.messageId = result.messageId || null; d.error = result.error || "";
        if (result.journalSaved === false) d.error = "Accepté par Meta, mais le journal doit être vérifié avant tout nouvel envoi.";
      } catch (err) {
        d.status = "unknown"; d.error = err.message;
        // Arrêt en cas de connexion/configuration/réseau défaillant : les
        // autres destinataires restent à traiter, avec leurs mêmes identifiants.
        pauseWhatsAppApi = true;
      }
      sauvegarderCampagneWhatsAppApi();
    }
  } finally { envoiWhatsAppApiEnCours = false; if (modalWhatsAppApiVisible) renderCampagneWhatsAppApi(); }
}
