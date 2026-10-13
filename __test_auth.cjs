const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function run() {
  let updates = 0;
  let user = { id: 'compte-a', email: 'admin@example.com' };
  const contexte = vm.createContext({ supabase: { auth: {
    async signInWithPassword({ password }) {
      return password === 'correct' ? { data: { user, session: { access_token: 'test' } }, error: null }
        : { data: {}, error: new Error('Invalid credentials') };
    },
    async getUser() { return { data: { user }, error: null }; },
    async updateUser({ password }) { assert.equal(password, 'nouveau'); updates++; return { error: null }; }
  } } });
  vm.runInContext(fs.readFileSync('assets/js/auth.js', 'utf8'), contexte);
  const session = await contexte.connecterCompteSupabase('admin@example.com', 'correct');
  assert.equal(session.mode, 'supabase');
  assert.equal(session.userId, 'compte-a');
  assert.equal(await contexte.connecterCompteSupabase('admin@example.com', 'incorrect'), null);
  assert.equal(await contexte.verifierSessionSupabase(session), true);
  assert.equal(await contexte.verifierSessionSupabase({ mode: 'historique' }), false);
  assert.equal(await contexte.verifierSessionSupabase({ mode: 'historique', actif: true, expire: Date.now() + 60000 }), true);
  assert.equal(await contexte.verifierSessionSupabase(null), false);
  assert.equal(await contexte.verifierSessionSupabase({ mode: 'supabase', userId: 'autre-compte' }), false);
  await assert.rejects(contexte.changerMotDePasseSupabase(session, 'incorrect', 'nouveau'), /incorrect/);
  assert.equal(updates, 0);
  await contexte.changerMotDePasseSupabase(session, 'correct', 'nouveau');
  assert.equal(updates, 1);
  user = null;
  assert.equal(await contexte.verifierSessionSupabase(session), false);
  await assert.rejects(contexte.changerMotDePasseSupabase(session, 'correct', 'nouveau'), /expiré/);
  assert.equal(updates, 1);
  for (const page of ['index.html', 'app.html']) {
    const html = fs.readFileSync(page, 'utf8');
    assert.ok(html.includes('assets/js/auth.js?v=44'));
    for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  }
  new vm.Script(fs.readFileSync('assets/js/app.js', 'utf8'));
  console.log('Connexion, refus, identité, expiration et changement de mot de passe : OK');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
