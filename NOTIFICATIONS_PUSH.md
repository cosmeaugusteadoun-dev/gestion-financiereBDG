# Notifications gratuites des anniversaires — activation

L'intégration Web Push est implémentée dans le code. Elle utilise votre projet
Supabase existant, sans service de notification tiers ni abonnement ajouté.
Elle doit encore être déployée et configurée sur Supabase pour recevoir de vrais pushes.

## 1. Tables privées

Dans Supabase → SQL Editor, exécuter :
[sql/migration_2026-10-26_push.sql](sql/migration_2026-10-26_push.sql).

Cette migration ajoute deux tables privées ; elle ne modifie ni les paiements,
ni les enfants, ni l'accès historique. Ne pas exécuter schema.sql.

## 2. Secrets déjà générés localement

Le fichier [.env.push.local](.env.push.local) contient les clés générées pour ce projet.
Il est ignoré par Git. Ne jamais copier son contenu dans le chat, un commit ou le code public.
Dans Supabase → Edge Functions → Secrets, créer les quatre secrets portant les mêmes noms :

| Secret | Valeur |
| --- | --- |
| PUSH_VAPID_PUBLIC_KEY | Valeur de ce nom dans .env.push.local |
| PUSH_VAPID_PRIVATE_KEY | Valeur privée du même fichier |
| PUSH_VAPID_SUBJECT | URL publique du site, déjà préremplie dans le fichier |
| PUSH_CRON_SECRET | Valeur aléatoire du même fichier |

Configurer également :
- PUSH_ADMIN_USER_IDS : UUID des comptes Supabase autorisés, séparés par virgules.
  Si absent, les comptes de WHATSAPP_ADMIN_USER_IDS sont utilisés.
- PUSH_ALLOWED_ORIGINS : https://bdj-gestion-financiere.netlify.app
  Si absent, WHATSAPP_ALLOWED_ORIGINS est utilisé. Ajouter séparément l'origine locale si besoin.

Conserver ces clés : les régénérer invaliderait les anciens abonnements.
Le générateur refuse d'écraser un fichier existant :
node scripts/generer-cles-push.cjs

## 3. Déployer la nouvelle fonction

Depuis le terminal du projet, après connexion au CLI Supabase :

npx supabase functions deploy push-notifications --project-ref xutdwwjwftgizwfovafk

Ou, sans terminal :
Edge Functions → Deploy a new function → Via Editor → nom push-notifications.
Remplacer index.ts par le contenu intégral de
[supabase/push-notifications-dashboard.ts](supabase/push-notifications-dashboard.ts), puis déployer.
Désactiver Verify JWT dans les paramètres de cette fonction : elle vérifie elle-même
le JWT Supabase et la liste des comptes autorisés pour l'inscription des appareils.
L'appel quotidien utilise uniquement le secret de planification privé.
Le fichier unique est régénérable avec node scripts/assembler-push-dashboard.cjs.

## 4. Planifier chaque matin

Dans Supabase → Vault (via la recherche du tableau de bord si nécessaire),
créer un secret nommé push_cron_secret. Sa valeur est celle de PUSH_CRON_SECRET,
identique à celle enregistrée dans Edge Functions.

Dans SQL Editor, exécuter :
[sql/planifier_anniversaires_push.sql](sql/planifier_anniversaires_push.sql).

Cela active un seul job : 0 6 * * * (06 h UTC = 07 h au Bénin).
La réexécution met à jour le même job, sans en créer plusieurs.
Contrôler ses exécutions dans Integrations → Cron.
Pour désactiver l'envoi quotidien :

select cron.unschedule('bdj-anniversaires-quotidiens');

## 5. Publier et inscrire chaque téléphone

1. Publier le site modifié sur Netlify et recharger l'application.
2. Installer l'application sur l'écran d'accueil du téléphone.
3. Ouvrir Notifications dans l'en-tête ou Notifications anniversaires dans le menu mobile.
4. Si demandé, se connecter avec le compte Supabase autorisé.
   Cette connexion dédiée ne remplace pas votre ancien identifiant.
5. Appuyer sur Activer sur cet appareil puis accepter l'autorisation du téléphone.
6. Rouvrir le panneau : Tester l'affichage permet un test local sur ce téléphone.
   Ce bouton ne déclenche ni campagne serveur ni message aux parents.
7. Répéter sur chaque téléphone souhaité (maximum dix appareils actifs par compte).

Le test local vérifie le service worker et l'affichage du téléphone, pas la tâche Cron.
Le prochain anniversaire permet de vérifier l'ensemble de la chaîne.
Le journal push_deliveries distingue accepted, failed, pending et unknown.
Accepted confirme l'acceptation par le service Push, pas la lecture sur le téléphone.
Ne pas supprimer un journal pending/unknown pour forcer un nouvel envoi :
une coupure a pu se produire après acceptation.

## Comportement

- Calcul des anniversaires du jour à l'heure du Bénin, données serveur à jour.
- Aucun push si personne ne fête son anniversaire.
- Une notification par appareil et par date, même si Cron est déclenché plusieurs fois.
- Le message sur l'écran verrouillé indique uniquement le nombre d'anniversaires.
- Toucher la notification ouvre la liste du jour ; le badge est acquitté.
- Le compteur est aussi mis à jour à l'ouverture du tableau de bord si l'API est disponible.
- Un appareil ayant consulté les anniversaires avant l'envoi est ignoré si l'acquittement
  a pu être transmis au serveur avec une session autorisée.
- Le 29 février est célébré le 1er mars les années non bissextiles.
- Les abonnements expirés sont désactivés ; les réponses incertaines ne sont pas renvoyées automatiquement.
- La déconnexion du logiciel ne désabonne pas le téléphone : utiliser Désactiver dans
  Notifications pour arrêter les rappels sur cet appareil.

## Gratuité et compatibilité

Web Push et les clés VAPID n'imposent aucun abonnement à un service tiers.
Supabase Free inclut actuellement 500 000 invocations Edge Functions par mois ;
l'appel quotidien représente environ 31 invocations par mois, auxquelles s'ajoutent
les inscriptions et consultations de configuration. Les autres quotas du projet
(base, trafic et stockage) restent partagés avec le logiciel.
Rester dans l'offre Free et ses quotas ; aucun abonnement payant n'est activé par ce code.

Un projet Free peut être mis en pause pour faible activité. Dans ce cas, le reprendre
depuis Supabase avant de compter sur les alertes. La livraison dépend aussi de la
connexion et des réglages de batterie/notifications du téléphone.

Sur Android, le lanceur peut afficher un simple point plutôt qu'un chiffre rouge.
Sur iPhone/iPad compatibles, la PWA doit être installée sur l'écran d'accueil
et autorisée à afficher les notifications. La couleur et la forme du badge sont
gérées par le système. Le badge d'hier peut persister tant que l'application ou
la notification n'est pas consultée : aucun push silencieux de remise à zéro n'est envoyé.

Sources :
- [Quotas Edge Functions](https://supabase.com/docs/guides/functions/pricing)
- [Planification Supabase](https://supabase.com/docs/guides/functions/schedule-functions)
- [Mise en pause Free](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Badges Chrome/Android](https://developer.chrome.com/docs/capabilities/web-apis/badging-api)
- [Web Push et badges iOS](https://webkit.org/blog/13878/)
