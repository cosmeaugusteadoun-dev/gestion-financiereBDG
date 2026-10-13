const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let nombre = 0;
for (const fichier of fs.readdirSync('assets/js').filter(n => n.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(`assets/js/${fichier}`, 'utf8'), { filename: fichier });
  nombre++;
}
for (const page of ['index.html', 'app.html']) {
  const html = fs.readFileSync(page, 'utf8');
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  for (const lien of html.matchAll(/(?:src|href)="(assets\/[^"?]+)(?:\?[^" ]*)?"/g)) {
    assert.ok(fs.existsSync(lien[1]), `${page} : fichier manquant ${lien[1]}`);
  }
}
JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
JSON.parse(fs.readFileSync('supabase/functions/whatsapp-templates.example.json', 'utf8'));
let fetchListener;
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
  URL, self: { addEventListener(type, fn) { if (type === 'fetch') fetchListener = fn; } }
});
let intercepte = false;
for (const chemin of ['/auth/v1/user', '/rest/v1/enfants', '/functions/v1/whatsapp-send']) {
  fetchListener({ request: { method: 'GET', url: `https://projet.supabase.co${chemin}` }, respondWith() { intercepte = true; } });
}
assert.equal(intercepte, false, 'Les réponses Supabase doivent rester hors du cache PWA');
console.log(`${nombre} fichiers JavaScript, scripts HTML, liens locaux, JSON et exclusion Supabase du cache : OK`);
