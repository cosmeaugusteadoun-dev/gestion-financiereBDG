// Aucune connexion à Meta ou Supabase : tous les appels réseau sont simulés.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createWhatsAppHandler } from "./supabase/functions/whatsapp-send/handler.mjs";

const admin = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
let verifications = 0;
const test = (titre, fn) => { fn(); verifications++; console.log(`OK ${titre}`); };
const response = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function setup(options = {}) {
  const values = {
    SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "cle-service-factice",
    WHATSAPP_TOKEN: "token-meta-factice", WHATSAPP_PHONE_NUMBER_ID: "123456", WHATSAPP_GRAPH_VERSION: "v99.0",
    WHATSAPP_ADMIN_USER_IDS: admin, WHATSAPP_ALLOWED_ORIGINS: "https://ecole.test",
    WHATSAPP_TEMPLATES_JSON: JSON.stringify([{ name: "annonce_approuvee", language: "fr", fields: [{ key: "date", source: "manuel" }] }]),
    ...options.env,
  };
  const rows = new Map(), stats = { meta: 0, payload: null };
  const fakeFetch = async (url, init = {}) => {
    if (url.endsWith("/auth/v1/user")) {
      const auth = init.headers.Authorization;
      return auth === "Bearer session-admin" ? response(200, { id: admin }) : auth === "Bearer session-autre" ? response(200, { id: "autre" }) : response(401, {});
    }
    if (url.startsWith("https://graph.facebook.com/")) {
      stats.meta++; stats.payload = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, "Bearer token-meta-factice");
      if (options.metaTimeout) throw new Error("timeout");
      return response(options.metaStatus || 200, options.metaBody || { messages: [{ id: "wamid.test" }] });
    }
    if (url.includes('/rest/v1/enfants?')) return response(200, [{id:'enfant_test', tel:'97000001', parent:'Parent test', opt:{whatsapp_consent:{granted:!options.noConsent, recorded_at:'2026-10-13T12:00:00Z', phone: options.badPhone ? '2290197000002' : '2290197000001', parent:'Parent test'}}}]);
    assert.ok(url.startsWith("https://supabase.test/rest/v1/whatsapp_envois"));
    if (init.method === "POST") {
      if (options.ledgerUnavailable) return response(500, { code: "erreur" });
      const row = JSON.parse(init.body);
      if (rows.has(row.request_id)) return response(409, { code: "23505" });
      rows.set(row.request_id, row);
      return response(201, {});
    }
    const id = new URL(url).searchParams.get("request_id").replace("eq.", "");
    if (init.method === "PATCH") {
      if (options.patchUnavailable) return response(500, {});
      Object.assign(rows.get(id), JSON.parse(init.body));
      return response(200, {});
    }
    return response(200, rows.has(id) ? [rows.get(id)] : []);
  };
  const handler = createWhatsAppHandler({ env: name => values[name], fetch: fakeFetch, crypto: webcrypto });
  const call = async (body, { authorization = "Bearer session-admin", origin = "https://ecole.test", method = "POST" } = {}) => {
    const result = await handler(new Request("https://supabase.test/functions/v1/whatsapp-send", {
      method, headers: { authorization, origin, "Content-Type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    }));
    return { status: result.status, body: result.status === 204 ? null : await result.json() };
  };
  return { handler, call, stats, rows };
}
const body = { action: "send", requestId, to: "2290197000001", template: "annonce_approuvee", language: "fr", parameters: ["15 octobre"], enfantIds:['enfant_test'] };

let s = setup();
let result = await s.call(body, { authorization: "" });
test("sans session serveur : refus avant tout appel Meta", () => { assert.equal(result.status, 401); assert.equal(s.stats.meta, 0); });
result = await s.call(body, { authorization: "Bearer cle-publique" });
test("une clé publique ou une fausse session ne permet pas d'envoyer", () => assert.equal(result.status, 401));
result = await s.call(body, { authorization: "Bearer session-autre" });
test("compte non autorisé : refus malgré un JWT valide", () => assert.equal(result.status, 403));
result = await s.call(body, { origin: "https://autre.test" });
test("origine non autorisée : refus", () => assert.equal(result.status, 403));
result = await s.call({}, { method: "OPTIONS" });
test("préflight CORS autorisé sans envoi", () => { assert.equal(result.status, 204); assert.equal(s.stats.meta, 0); });
result = await s.call({ action: "config" });
test("configuration publique du modèle ne divulgue aucun secret", () => {
  assert.equal(result.body.templates[0].name, "annonce_approuvee");
  assert.ok(!JSON.stringify(result.body).includes("token-meta-factice")); assert.ok(!JSON.stringify(result.body).includes("cle-service-factice"));
});
result = await s.call({ ...body, template: "inconnu" });
test("modèle non configuré : aucun envoi", () => { assert.equal(result.status, 400); assert.equal(s.stats.meta, 0); });
result = await s.call({ ...body, parameters: [] });
test("nombre de variables incorrect : refus", () => assert.equal(result.status, 400));
result = await s.call({ ...body, parameters: ["x".repeat(1025)] });
test("paramètre trop long : refus", () => assert.equal(result.status, 400));
result = await s.call({ ...body, to: "123" });
test("numéro invalide : refus", () => assert.equal(result.status, 400));
result = await s.call({ ...body, requestId: "injection" });
test("identifiant d'envoi invalide : refus", () => assert.equal(result.status, 400));
result = await s.call(body);
test("envoi autorisé : modèle exact, paramètres et numéro transmis à Meta", () => {
  assert.equal(result.body.status, "accepted"); assert.equal(result.body.messageId, "wamid.test");
  assert.equal(s.stats.payload.template.components[0].parameters[0].text, "15 octobre");
  assert.equal(s.rows.get(requestId).status, "accepted"); assert.equal(s.stats.meta, 1);
});
result = await s.call(body);
test("reprise du même envoi : aucune seconde requête Meta", () => { assert.equal(result.body.duplicate, true); assert.equal(s.stats.meta, 1); });
result = await s.call({ ...body, parameters: ["16 octobre"] });
test("réutiliser un identifiant pour un autre contenu est interdit", () => { assert.equal(result.status, 409); assert.equal(s.stats.meta, 1); });
s = setup({ ledgerUnavailable: true }); result = await s.call(body);
test("journal indisponible : aucun envoi avant sauvegarde", () => { assert.equal(result.status, 503); assert.equal(s.stats.meta, 0); });
s = setup({ metaStatus: 400, metaBody: { error: { message: "Modèle refusé token-meta-factice" } } }); result = await s.call(body);
test("refus Meta : échec explicite, token masqué même dans une erreur", () => {
  assert.equal(result.body.status, "failed"); assert.ok(!result.body.error.includes("token-meta-factice"));
});
s = setup({ metaStatus: 500 }); result = await s.call(body); await s.call(body);
test("erreur serveur Meta : résultat incertain et aucun renvoi automatique", () => { assert.equal(result.body.status, "unknown"); assert.equal(s.stats.meta, 1); });
s = setup({ metaTimeout: true }); result = await s.call(body); await s.call(body);
test("réponse Meta perdue : reprise sans double envoi", () => { assert.equal(result.body.status, "unknown"); assert.equal(s.stats.meta, 1); });
s = setup({ patchUnavailable: true }); result = await s.call(body); const reprise = await s.call(body);
test("acceptation Meta puis journal incomplet : pas de doublon à la reprise", () => {
  assert.equal(result.body.status, "accepted"); assert.equal(result.body.journalSaved, false); assert.equal(reprise.body.status, "pending"); assert.equal(s.stats.meta, 1);
});
s = setup({ env: { WHATSAPP_TOKEN: "" } }); result = await s.call(body);
test("secret manquant : diagnostic sans divulguer les valeurs", () => { assert.equal(result.status, 503); assert.ok(result.body.missing.includes("WHATSAPP_TOKEN")); assert.equal(s.stats.meta, 0); });
s = setup({ env: { WHATSAPP_TEMPLATES_JSON: "[]" } }); result = await s.call({ action: "config" }); const sansModele = await s.call(body);
test("aucun modèle approuvé : configuration vide, aucun envoi possible", () => { assert.equal(result.body.templates.length, 0); assert.equal(sansModele.status, 400); });
s = setup({noConsent:true}); result = await s.call(body);
test("serveur : consentement absent ou retiré interdit l'envoi", () => { assert.equal(result.status,403); assert.equal(s.stats.meta,0); });
s = setup({badPhone:true}); result = await s.call(body);
test("serveur : consentement lié à un autre numéro interdit l'envoi", () => { assert.equal(result.status,403); assert.equal(s.stats.meta,0); });
s = setup(); result = await s.call({...body, enfantIds:[]});
test("serveur : impossible d'envoyer sans dossier lié au consentement", () => { assert.equal(result.status,400); assert.equal(s.stats.meta,0); });
result = await s.call({...body,parameters:['texte\nmultiligne']});
test("serveur : valeur multiligne refusée avant l'appel Meta", () => assert.equal(result.status,400));
result = await s.call({...body,parameters:['texte    espaces']});
test("serveur : quatre espaces consécutifs refusés", () => assert.equal(result.status,400));

const storage = new Map();
const ctx = { console, crypto: webcrypto, window: { sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("./assets/js/whatsapp-modeles.js", import.meta.url), "utf8"), ctx);
vm.runInContext(fs.readFileSync(new URL("./assets/js/whatsapp-api.js", import.meta.url), "utf8"), ctx);
test("numéros Bénin : ancien, nouveau et international donnent le même destinataire", () => {
  assert.equal(ctx.numeroWhatsAppApi("97000001"), "2290197000001");
  assert.equal(ctx.numeroWhatsAppApi("01 97 00 00 01"), "2290197000001");
  assert.equal(ctx.numeroWhatsAppApi("+22997000001"), "2290197000001");
  assert.equal(ctx.numeroWhatsAppApi("002290197000001"), "2290197000001");
  assert.equal(ctx.numeroWhatsAppApi("+33612345678"), "33612345678"); assert.equal(ctx.numeroWhatsAppApi("123"), "");
});
ctx.renderCampagneWhatsAppApi = () => {};
ctx.STATE = {enfants:[1,2,3].map(i=>({id:'e'+i, tel:`229019700000${i}`, parent:'Parent', opt:{whatsapp_consent:{granted:true,recorded_at:'2026-10-13T12:00:00Z',phone:`229019700000${i}`,parent:'Parent'}}}))};
ctx.campagneWhatsAppApi = { template: "annonce_approuvee", language: "fr", label: "Annonce", destinataires: [1, 2, 3].map(i => ({
  requestId: webcrypto.randomUUID(), numero: `229019700000${i}`, enfants: [`Enfant ${i}`], enfantIds:['e'+i], parameters: ["15 octobre"], status: "a_traiter",
})) };
let calls = [];
ctx.appelerWhatsAppApi = async data => { calls.push(data); return { status: calls.length === 2 ? "failed" : "accepted", messageId: "wamid." + calls.length }; };
await ctx.envoyerCampagneWhatsAppApi();
test("campagne : chaque parent est traité malgré un refus individuel", () => {
  assert.equal(calls.length, 3); assert.deepEqual(Array.from(ctx.campagneWhatsAppApi.destinataires, d => d.status), ["accepted", "failed", "accepted"]);
});
await ctx.envoyerCampagneWhatsAppApi();
test("campagne reprise : acceptations et refus explicites ne sont pas renvoyés", () => assert.equal(calls.length, 3));
ctx.campagneWhatsAppApi.destinataires.forEach(d => d.status = "a_traiter");
const ids = ctx.campagneWhatsAppApi.destinataires.map(d => d.requestId);
ctx.appelerWhatsAppApi = async () => { throw new Error("réseau coupé"); };
await ctx.envoyerCampagneWhatsAppApi();
test("coupure : arrêt, autres parents conservés à traiter", () => {
  assert.deepEqual(Array.from(ctx.campagneWhatsAppApi.destinataires, d => d.status), ["unknown", "a_traiter", "a_traiter"]);
});
calls = []; ctx.appelerWhatsAppApi = async data => { calls.push(data); return { status: "accepted" }; };
await ctx.envoyerCampagneWhatsAppApi();
test("reprise après coupure : mêmes identifiants de prévention des doublons", () => {
  assert.deepEqual(calls.map(d => d.requestId), ids); assert.ok(ctx.campagneWhatsAppApi.destinataires.every(d => d.status === "accepted"));
});
test("campagne sauvegardée : aucun token dans la session locale", () => {
  assert.ok(storage.get("bdj_campagne_whatsapp_api")); assert.ok(!storage.get("bdj_campagne_whatsapp_api").includes("token-meta-factice"));
  assert.equal(ctx.restaurerCampagneWhatsAppApi().destinataires.length, 3);
});
console.log(`\n${verifications} scénarios WhatsApp API — TOUS LES TESTS PASSENT`);
