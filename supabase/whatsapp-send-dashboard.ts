// Généré par scripts/generer-whatsapp-dashboard.cjs ; ne contient aucun secret.
// Aucun jeton Meta n'est transmis au navigateur. Le code est testable sans Deno.
export function createWhatsAppHandler({ env, fetch, crypto }) {
  return async function handler(request) {
    const origin = request.headers.get("origin");
    const origins = (env("WHATSAPP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
    if (origin && origins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.includes(origin)) return json(403, { error: "Origine non autorisée." });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      ...headers, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    } });
    if (request.method !== "POST") return json(405, { error: "Méthode non autorisée." });
    const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_GRAPH_VERSION", "WHATSAPP_ADMIN_USER_IDS", "WHATSAPP_ALLOWED_ORIGINS", "WHATSAPP_TEMPLATES_JSON"];
    const missing = required.filter(name => !env(name));
    if (missing.length) return json(503, { error: "Configuration serveur incomplète.", missing });
    const base = env("SUPABASE_URL").replace(/\/$/, "");
    const serverKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const auth = request.headers.get("authorization") || "";
    if (!/^Bearer \S+$/i.test(auth)) return json(401, { error: "Connexion Supabase requise pour envoyer des messages." });
    try {
      const authResponse = await fetch(`${base}/auth/v1/user`, { headers: { apikey: serverKey, Authorization: auth }, signal: AbortSignal.timeout(10000) });
      if (!authResponse.ok) return json(401, { error: "Session expirée ou invalide. Reconnectez-vous." });
      const user = await authResponse.json();
      const admins = env("WHATSAPP_ADMIN_USER_IDS").split(",").map(s => s.trim());
      if (!user.id || !admins.includes(user.id)) return json(403, { error: "Ce compte n'est pas autorisé à envoyer les messages de l'école." });
      let templates;
      try {
        templates = JSON.parse(env("WHATSAPP_TEMPLATES_JSON"));
        if (!Array.isArray(templates) || templates.length > 30 || templates.some(t =>
          !/^[a-z0-9_]{1,100}$/.test(t.name) || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(t.language) ||
          !Array.isArray(t.fields) || t.fields.length > 30 || t.fields.some(f =>
            !/^[a-z0-9_]+$/.test(f.key) || !["message", "parent", "enfants", "manuel", "enfant"].includes(f.source)) ||
          new Set(t.fields.map(f => f.key)).size !== t.fields.length)) throw new Error();
      } catch (_) { return json(503, { error: "Liste des modèles serveur invalide." }); }
      if (Number(request.headers.get("content-length")) > 20000) return json(413, { error: "Requête trop volumineuse." });
      const raw = await request.text();
      if (raw.length > 20000) return json(413, { error: "Requête trop volumineuse." });
      let body;
      try { body = JSON.parse(raw); } catch (_) { return json(400, { error: "Requête JSON invalide." }); }
      if (body.action === "config") return json(200, { templates });
      if (body.action !== "send") return json(400, { error: "Action invalide." });
      const template = templates.find(t => t.name === body.template && t.language === body.language);
      if (!template) return json(400, { error: "Modèle absent de la liste approuvée configurée par l'école." });
      if (!/^[1-9]\d{7,14}$/.test(body.to || "") || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.requestId || "")) {
        return json(400, { error: "Numéro international ou identifiant d'envoi invalide." });
      }
      if (!Array.isArray(body.parameters) || body.parameters.length !== template.fields.length || body.parameters.some(p => typeof p !== "string" || !p.trim() || p.length > 1024 || /[\r\n\t]| {4}/.test(p))) {
        return json(400, { error: "Les paramètres doivent correspondre au modèle et contenir au maximum 1 024 caractères chacun." });
      }
      const version = env("WHATSAPP_GRAPH_VERSION"), phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
      if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(phoneId)) return json(503, { error: "Version Graph API ou Phone Number ID invalide." });
      const payload = { messaging_product: "whatsapp", to: body.to, type: "template", template: {
        name: template.name, language: { code: template.language },
        ...(body.parameters.length ? { components: [{ type: "body", parameters: body.parameters.map(text => ({ type: "text", text })) }] } : {}),
      } };
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload))))].map(n => n.toString(16).padStart(2, "0")).join("");
      const dbHeaders = { apikey: serverKey, Authorization: `Bearer ${serverKey}`, "Content-Type": "application/json" };
      if (!Array.isArray(body.enfantIds) || !body.enfantIds.length || body.enfantIds.length > 50 || body.enfantIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,150}$/.test(id))) return json(400, { error: "Dossiers des destinataires requis." });
      const contacts = await fetch(`${base}/rest/v1/enfants?id=in.(${[...new Set(body.enfantIds)].join(",")})&select=id,tel,parent,opt`, { headers: dbHeaders, signal: AbortSignal.timeout(10000) });
      if (!contacts.ok) return json(503, { error: "Impossible de vérifier les consentements. Aucun envoi lancé." });
      const enfants = await contacts.json();
      const normaliser = tel => {
        let n = String(tel || "").replace(/\D/g, "");
        if (n.startsWith("00")) n = n.slice(2);
        if (n.length === 8) n = "22901" + n;
        else if (n.length === 10 && n.startsWith("01")) n = "229" + n;
        else if (n.length === 11 && n.startsWith("229")) n = "22901" + n.slice(3);
        return n;
      };
      if (new Set(enfants.map(e => e.id)).size !== new Set(body.enfantIds).size || enfants.some(e => {
        const c = e.opt?.whatsapp_consent;
        return !c?.granted || !c.recorded_at || c.phone !== body.to || normaliser(e.tel) !== body.to || c.parent !== (e.parent || "").trim();
      })) return json(403, { error: "Consentement absent ou retiré, ou coordonnées modifiées. Envoi exclu." });
      const ledger = `${base}/rest/v1/whatsapp_envois`;
      const saved = await fetch(ledger, { method: "POST", headers: { ...dbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ request_id: body.requestId, owner_id: user.id, recipient: body.to, template_name: template.name, payload_hash: hash, status: "pending", enfant_ids: body.enfantIds, consentements: enfants.map(e => ({ enfant_id: e.id, recorded_at: e.opt.whatsapp_consent.recorded_at })) }),
        signal: AbortSignal.timeout(10000) });
      if (!saved.ok) {
        const error = await saved.json().catch(() => ({}));
        if (error.code !== "23505") return json(503, { error: "Journal d'envoi indisponible. Aucun appel à Meta n'a été lancé." });
        const previous = await fetch(`${ledger}?request_id=eq.${body.requestId}&select=owner_id,payload_hash,status,message_id,error`, { headers: dbHeaders, signal: AbortSignal.timeout(10000) });
        if (!previous.ok) return json(503, { error: "Impossible de consulter l'envoi précédent. Réessayez avec le même identifiant." });
        const row = (await previous.json())[0];
        if (!row || row.owner_id !== user.id || row.payload_hash !== hash) return json(409, { error: "Identifiant déjà utilisé pour un autre envoi." });
        return json(200, { status: row.status, messageId: row.message_id, error: row.error, duplicate: true });
      }
      const update = async patch => {
        const response = await fetch(`${ledger}?request_id=eq.${body.requestId}`, { method: "PATCH", headers: dbHeaders,
          body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }), signal: AbortSignal.timeout(10000) });
        return response.ok;
      };
      let meta;
      try {
        meta = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, { method: "POST",
          headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      } catch (_) {
        await update({ status: "unknown", error: "Réponse Meta non reçue. Vérifier cet envoi avant toute nouvelle tentative." }).catch(() => {});
        return json(200, { status: "unknown", error: "Réponse Meta non reçue. Aucun renvoi automatique pour éviter un doublon." });
      }
      const result = await meta.json().catch(() => ({}));
      if (!meta.ok) {
        const status = meta.status >= 500 ? "unknown" : "failed";
        const error = String(result.error?.message || `Réponse Meta ${meta.status}.`).replaceAll(env("WHATSAPP_TOKEN"), "[masqué]").slice(0, 700);
        await update({ status, error }).catch(() => {});
        return json(200, { status, error });
      }
      const messageId = result.messages?.[0]?.id;
      if (!messageId) {
        await update({ status: "unknown", error: "Réponse Meta sans identifiant de message." }).catch(() => {});
        return json(200, { status: "unknown", error: "Réponse Meta sans identifiant ; vérifier avant de renvoyer." });
      }
      const recorded = await update({ status: "accepted", message_id: messageId, error: null }).catch(() => false);
      return json(200, { status: "accepted", messageId, journalSaved: recorded });
    } catch (_) {
      return json(503, { error: "Service temporairement indisponible. Reprenez avec le même identifiant d'envoi." });
    }
  };
}

Deno.serve(createWhatsAppHandler({
  env: (name: string) => Deno.env.get(name),
  fetch: globalThis.fetch,
  crypto: globalThis.crypto,
}));
