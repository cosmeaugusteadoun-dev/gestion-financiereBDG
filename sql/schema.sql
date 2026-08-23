-- ============================================================
-- LES BULLES DE JOIE — Schéma base de données Supabase
-- Usage : coller dans Supabase > SQL Editor > Run
-- ============================================================

DROP TABLE IF EXISTS suivi CASCADE;
DROP TABLE IF EXISTS entrees CASCADE;
DROP TABLE IF EXISTS sorties CASCADE;
DROP TABLE IF EXISTS postes CASCADE;
DROP TABLE IF EXISTS enfants CASCADE;

-- Enfants (dossiers élèves)
CREATE TABLE enfants (
  id           TEXT PRIMARY KEY,
  nom          TEXT NOT NULL,
  sect         TEXT NOT NULL,
  stat         TEXT DEFAULT 'ancien',
  tel          TEXT,
  parent       TEXT,
  civilite     TEXT DEFAULT '—',
  sexe         TEXT, -- 'F' ou 'M', laissé vide si non renseigné
  ddn          DATE,
  annee        TEXT DEFAULT '2026-2027',
  opt          JSONB DEFAULT '{}',
  remise       NUMERIC DEFAULT 0,
  remise_cible TEXT DEFAULT 'Cantine',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Postes financiers (générés par buildPostes)
CREATE TABLE postes (
  id          TEXT PRIMARY KEY,
  enfant_id   TEXT NOT NULL REFERENCES enfants(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  cat         TEXT NOT NULL,
  label       TEXT,
  du          NUMERIC DEFAULT 0,
  paye        NUMERIC DEFAULT 0,
  mois        TEXT,
  dl          TEXT,
  is_var      BOOLEAN DEFAULT FALSE,
  is_remise   BOOLEAN DEFAULT FALSE,
  is_reduit   BOOLEAN DEFAULT FALSE
);

-- Entrées (paiements reçus)
CREATE TABLE entrees (
  id          TEXT PRIMARY KEY,
  date        DATE NOT NULL,
  nom         TEXT NOT NULL,
  enfant_id   TEXT REFERENCES enfants(id) ON DELETE SET NULL,
  sect        TEXT,
  mois        TEXT,
  mt          NUMERIC NOT NULL,
  mode        TEXT DEFAULT 'Espèces',
  note        TEXT,
  allocations JSONB DEFAULT '[]', -- détail des postes crédités par ce paiement (permet d'annuler proprement à la suppression)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sorties (dépenses)
CREATE TABLE sorties (
  id          TEXT PRIMARY KEY,
  date        DATE NOT NULL,
  cat         TEXT,
  secteur     TEXT, -- secteur imputé (Crèche, Maternelle, Primaire... ou Administratif/Divers) — utilisé pour les bilans
  label       TEXT,
  mt          NUMERIC NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Suivi scolaire
CREATE TABLE suivi (
  id            TEXT PRIMARY KEY,
  enfant_id     TEXT NOT NULL REFERENCES enfants(id) ON DELETE CASCADE,
  trim          TEXT NOT NULL,
  moy           NUMERIC,
  appreciation  TEXT,
  absences      INT DEFAULT 0,
  retards       INT DEFAULT 0,
  comportement  TEXT,
  observation   TEXT,
  is_mat        BOOLEAN DEFAULT FALSE,
  qualites_positives   JSONB DEFAULT '[]',
  qualites_accompagner JSONB DEFAULT '[]',
  tranche_age   TEXT,
  UNIQUE(enfant_id, trim)
);

-- Suivi collectif par classe et par trimestre (distinct du suivi individuel
-- ci-dessus) : observation générale adressée à toute une classe.
CREATE TABLE suivi_classe (
  id            TEXT PRIMARY KEY,
  sect          TEXT NOT NULL,
  trim          TEXT NOT NULL,
  observation   TEXT,
  UNIQUE(sect, trim)
);

-- Configuration de l'application (empreinte du mot de passe de connexion —
-- voir "Changer le mot de passe" dans l'en-tête). Initialisée avec
-- l'empreinte du mot de passe par défaut défini dans config.js.
CREATE TABLE app_config (
  id             TEXT PRIMARY KEY,
  password_hash  TEXT NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now()
);
INSERT INTO app_config (id, password_hash)
VALUES ('main', '6051fc84a7a0d74c225fb18a496b09952da5642e60723ecae543298edd7d82d6');

-- Index utiles pour les recherches fréquentes
CREATE INDEX idx_postes_enfant   ON postes(enfant_id);
CREATE INDEX idx_entrees_enfant  ON entrees(enfant_id);
CREATE INDEX idx_suivi_enfant    ON suivi(enfant_id);

-- Sécurité (accès total, usage solo)
ALTER TABLE enfants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE postes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sorties     ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi       ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi_classe ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acces_total" ON enfants      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON postes       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON entrees      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON sorties      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON suivi        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON suivi_classe FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "acces_total" ON app_config   FOR ALL USING (true) WITH CHECK (true);
