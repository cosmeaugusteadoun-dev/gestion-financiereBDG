# Raccordement WhatsApp — Les Bulles de Joie

L'intégration locale est préparée pour Meta Cloud API. Le token et le Phone Number ID
restent côté serveur. Aucun message n'a été envoyé pendant le développement.

L'API est réservée au bouton d'envoi groupé de **Messagerie collective**,
avec le numéro de l'école **+229 01 49 77 77 00** associé au Phone Number ID Meta.
Les boutons individuels de cette section et les autres boutons (bilans, reçus,
anniversaires, notes et suivi, renouvellements) ouvrent WhatsApp classique avec
les textes d'origine. Les envois de Notes et suivi utilisent également ce parcours
classique, avec validation manuelle de chaque conversation.
Le contact **01 97 91 94 52** reste dans les messages classiques. Leur expéditeur
est le compte connecté dans l'application WhatsApp utilisée, à choisir sur le téléphone.

## 1. Préparer le serveur Supabase

Dans le SQL Editor du projet existant, exécuter
[la migration du journal d'envoi](sql/migration_2026-10-11_whatsapp_api.sql).
Elle crée uniquement `whatsapp_envois`, sans modifier les paiements ou dossiers.
Exécuter ensuite [la migration du consentement](sql/migration_2026-10-13_whatsapp_consent.sql).
Cette table est privée : les accès anonymes et authentifiés sont interdits ;
la fonction serveur utilise la clé de service pour lire et écrire les résultats.

Dans **Authentication > Users > Add user**, créer un compte dédié à l'envoi
(email, mot de passe et email confirmé). Copier son UUID.
Les comptes créés dans Supabase Authentication se connectent au
logiciel avec leur email et mot de passe. L'ancien identifiant reste disponible.
Consulter les limites et précautions de sécurité dans [SECURITE.md](SECURITE.md).
Le compte d'envoi est vérifié côté
serveur et doit figurer dans `WHATSAPP_ADMIN_USER_IDS`.

## 2. Configurer les secrets

Dans **Edge Functions > Secrets**, renseigner :

| Secret | Valeur |
| --- | --- |
| `WHATSAPP_TOKEN` | Votre token Meta, idéalement d'utilisateur système pour la production |
| `WHATSAPP_PHONE_NUMBER_ID` | Votre Phone Number ID, pas le numéro de téléphone |
| `WHATSAPP_GRAPH_VERSION` | Version exacte figurant dans l'exemple d'appel Meta, au format `vXX.0` |
| `WHATSAPP_ADMIN_USER_IDS` | UUID du compte d'envoi Supabase Auth |
| `WHATSAPP_ALLOWED_ORIGINS` | Adresse du site, protocole et port inclus, sans slash final ; virgule pour plusieurs origines |
| `WHATSAPP_TEMPLATES_JSON` | Liste des modèles approuvés, décrite ci-dessous ; `[]` en attendant |

Pour Live Server sur le port de votre capture, inclure exactement
`http://127.0.0.1:5503` dans `WHATSAPP_ALLOWED_ORIGINS`. `localhost` et `127.0.0.1`
sont des origines différentes ; chaque port l'est également. Pour conserver le
site publié, séparer son origine et celle de Live Server par une virgule.
Une erreur « Failed to fetch » peut indiquer une origine refusée, une fonction
non déployée ou un problème réseau ; elle ne prouve pas un refus de Meta.

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont utilisées exclusivement dans
la fonction serveur et sont normalement fournies par Supabase.
Ne pas copier le token Meta ou la clé de service dans les fichiers publics.

Pour le développement CLI, le fichier exemple est
[supabase/functions/.env.example](supabase/functions/.env.example).
Sa copie `.env` est ignorée par Git.

## 3. Faire approuver un premier modèle

Les modèles de notre application sont prêts dans [MODELES_WHATSAPP.md](MODELES_WHATSAPP.md),
avec les corps à copier, pieds de page et exemples. Leurs paramètres sont remplis
automatiquement depuis les dossiers, suivis et paiements ciblés. Commencer par
`bdj_alerte_absences_retards` ou `bdj_bilan_financier` puis copier uniquement l'entrée
effectivement approuvée de [whatsapp-templates.example.json](supabase/functions/whatsapp-templates.example.json)
dans `WHATSAPP_TEMPLATES_JSON`. L'exemple manuel ci-dessous reste applicable aux
annonces spécifiques qui n'ont pas encore de texte fixe dans notre application.

Dans **WhatsApp Manager > Modèles de messages**, soumettre un modèle en français.
Exemple de texte pour une réunion :

> Bonjour {{1}}, Les Bulles de Joie vous invite à une réunion le {{2}} à {{3}}.
> Merci de confirmer votre présence auprès de l'administration.

Renseigner des exemples concrets pour chaque variable et attendre l'approbation.
Meta détermine la catégorie et peut demander des ajustements. Copier le nom
exact et le code de langue approuvés. Exemple de configuration **uniquement
après approbation de ce modèle sous ce nom et cette langue** :

```json
[
  {
    "name": "bdj_reunion_parents",
    "language": "fr",
    "label": "Réunion des parents",
    "fields": [
      { "key": "parent", "label": "Parent", "source": "parent" },
      { "key": "date", "label": "Date de la réunion", "source": "manuel" },
      { "key": "heure", "label": "Heure de la réunion", "source": "manuel" }
    ]
  }
]
```

L'ordre des champs correspond exactement à `{{1}}`, `{{2}}`, etc.
Sources disponibles : `parent` (nom du parent), `enfants` (enfants associés
au même numéro), `message` (texte de la messagerie) et `manuel` (champ saisi
au lancement). Chaque paramètre est limité à 1 024 caractères dans cette
première intégration. Seuls les modèles avec des variables texte dans le corps
sont pris en charge ; pas encore d'en-tête média, de boutons ou de document.

Les messages actuels (reçus, bilans, relances, suivi scolaire, renouvellements,
et annonces) devront avoir des modèles adaptés et approuvés.
Les anniversaires sont exclus de l'API : ils conservent leur bouton individuel
du tableau de bord et les textes originaux de `buildAnniversaireMessage`.
La source `enfant` des modèles `bdj_*` calcule automatiquement les champs.
Les longs bilans et bulletins sont synthétisés ; le dossier garde le détail intégral.
Un paramètre montant commun ne convient pas à une liste de reçus avec des
montants différents : traiter le parent concerné ou préparer une adaptation dédiée.
Le texte libre n'est pas envoyé hors de la fenêtre autorisée : cette première
version envoie uniquement des modèles configurés, même si le parent a écrit récemment.

Pour le numéro Meta de test, `hello_world` peut être configuré si disponible
avec `language: "en_US"` et `fields: []`. Ce message est un test technique,
pas une annonce de l'école. Ajouter le destinataire test dans Meta.

## 4. Déployer

Sans terminal pour le déploiement : **Edge Functions → Deploy a new function → Via Editor**.
Nommer la fonction `whatsapp-send` et remplacer intégralement `index.ts` par le contenu
de [whatsapp-send-dashboard.ts](supabase/whatsapp-send-dashboard.ts), puis déployer.
Dans les paramètres de la fonction, désactiver **Verify JWT / Enforce JWT verification** :
notre code vérifie lui-même le JWT Supabase et les UID autorisés.
Le fichier unique est généré à partir des deux sources par
`node scripts/generer-whatsapp-dashboard.cjs` ; le régénérer si ces sources changent.

Depuis la racine du projet avec le CLI Supabase configuré et connecté :

```powershell
supabase link --project-ref xutdwwjwftgizwfovafk
supabase functions deploy whatsapp-send
```

Le fichier `supabase/config.toml` désactive la vérification JWT automatique
du portail pour cette fonction. **La fonction vérifie elle-même le JWT réel
auprès de Supabase Auth et refuse tout compte hors de la liste d'admins.**
La clé publique ou le drapeau de session du tableau de bord ne permettent pas
d'envoyer des messages.

## 5. Tester depuis l'application

1. Recharger la version modifiée du site.
2. Dans Messagerie, filtrer sur un seul parent test ayant accepté ces messages.
   Dans son profil, cocher l'accord WhatsApp et enregistrer. Aucun ancien dossier
   n'est considéré comme consentant automatiquement. Un changement de numéro ou
   de nom du parent impose un nouvel accord. Le serveur vérifie le consentement
   à chaque envoi ; le journal conserve la date d'accord utilisée.
3. Cliquer **Envoi automatique (API)** et se connecter au compte d'envoi.
4. Choisir le modèle approuvé, compléter ses paramètres et vérifier le destinataire.
5. Cliquer **Envoyer à 1 parent** et vérifier le message reçu sur le téléphone.
6. Après validation de ce test, sélectionner la liste souhaitée et lancer l'envoi.

Les annonces communes sont regroupées par numéro. Les modèles personnalisés
produisent un message par enfant : une fratrie conserve ses données distinctes.
Les filtres sont figés pour la campagne. La conversion des numéros béninois ajoute le préfixe national
`01` aux anciens numéros à huit chiffres, sans modifier les dossiers stockés.

La progression est sauvegardée dans la session de l'onglet. Après un
rechargement, se reconnecter au compte d'envoi, puis utiliser **Vérifier / reprendre**.
La connexion Supabase Auth est conservée dans `sessionStorage` pour suivre
la navigation entre les pages du logiciel, et effacée à la déconnexion.

## Résultats et limites

### Modèles en examen et catégories Meta

Le code peut être commité pendant l'examen des modèles : le commit ne les
soumet pas et n'envoie pas de messages. Garder `WHATSAPP_TEMPLATES_JSON=[]`
tant qu'aucun modèle n'est approuvé, puis ajouter uniquement les modèles
approuvés. Les secrets doivent rester dans Supabase, jamais dans le commit.

L'avertissement « Catégorie de modèle mise à jour » signifie que Meta a
reclassé un modèle proposé comme Utilitaire en Marketing ; il ne signifie
pas que le modèle a été rejeté. La catégorie effective est décidée par Meta.
Vous pouvez conserver cette catégorie ou utiliser l'examen proposé dans
Meta. La catégorie n'est pas envoyée par notre appel d'envoi : les noms,
langues et paramètres doivent correspondre aux modèles approuvés.

- **Accepté par WhatsApp** : Meta a retourné un identifiant de message ; cela ne
  prouve pas encore la livraison ou la lecture par le parent.
- **Refusé** : Meta a explicitement refusé la requête (modèle, token, numéro...).
- **À vérifier** : réponse perdue, erreur serveur Meta ou journal incomplet.
  La reprise conserve le même identifiant et ne renvoie pas le message déjà
  enregistré. Elle ne renvoie jamais automatiquement un envoi incertain.

Les identifiants sont conservés dans `whatsapp_envois`, avant l'appel à Meta.
Ne pas créer une nouvelle campagne pour réessayer un résultat incertain sans
avoir vérifié cet envoi. Une coupure après acceptation par Meta et avant
sauvegarde finale peut nécessiter une vérification manuelle du journal Meta.

Le webhook de livraison/lecture et la réception des réponses ne sont pas encore
implémentés. Pour cette étape, il faudra le secret de l'application Meta ;
l'URL HTTPS du webhook et son jeton de vérification seront fournis par le code.
Les limites de débit, les droits du numéro de test et la facturation Meta
restent ceux de votre compte. Conserver l'accord des parents et leurs demandes
d'arrêt avant les envois.

## Vérifications locales

```powershell
node __test_whatsapp_api.mjs
node __test_modeles_whatsapp.cjs
node __test_statuts.js
node __test_mensualites.js
```

Sources : [Meta Cloud API](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api),
[règles des modèles et de la fenêtre de réponse](https://business.whatsapp.com/policy),
[secrets Supabase](https://supabase.com/docs/guides/functions/secrets),
[configuration des fonctions](https://supabase.com/docs/guides/functions/function-configuration),
[numérotation ARCEP Bénin](https://web.arcep.bj/passage-des-numero-a-10-chiffre/).
