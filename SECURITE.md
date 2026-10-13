# Sécurité et mise en service

Le logiciel conserve l'ancien identifiant et permet aussi la connexion Supabase Auth.
Le mot de passe historique est vérifié avec l'empreinte enregistrée dans `app_config`.
Une erreur d'accès à cette table ne réactive pas silencieusement l'ancien mot de passe.
**Ne pas appliquer `migration_2026-10-14_securite_acces.sql` dans cette configuration :
elle est destinée à un fonctionnement exclusivement Supabase Auth et bloquerait
l'accès historique aux données.** La sécurisation serveur de cet accès historique
reste à réaliser ; le contrôle du navigateur ne suffit pas à protéger la base.

Si la migration Auth seul a déjà été exécutée, `sql/retablir_acces_historique.sql`
rétablit les permissions nécessaires à l'ancien fonctionnement, sans effacer
les données ni changer les mots de passe. Il réouvre aussi les accès anonymes :
ce retour de compatibilité ne constitue pas une protection serveur.
Tous les comptes Auth non anonymes confirmés disposent des mêmes droits de gestion.
L'envoi WhatsApp impose en plus la liste serveur `WHATSAPP_ADMIN_USER_IDS`.

## À appliquer dans votre projet Supabase

1. Vérifier le compte créé dans Authentication : email confirmé, mot de passe connu.
2. Désactiver **Allow new users to sign up** et les connexions anonymes dans Authentication.
   Désactiver les fournisseurs de connexion que vous n'utilisez pas. Contrôler la liste
   des comptes existants : seuls les membres autorisés doivent y figurer.
3. Publier cette version et vérifier une connexion par email à partir d'un onglet neuf.
4. Uniquement en cas de passage volontaire à Supabase Auth seul, exécuter
   `sql/migration_2026-10-14_securite_acces.sql` dans le SQL Editor.
   Cette migration remplace les politiques des sept tables du logiciel ; elle ne
   supprime aucune donnée. L'ancienne table `app_config` devient inaccessible au navigateur.
   Ne pas réexécuter l'ancien `schema.sql`, qui supprime des tables et rétablit des accès publics.
5. Sans connexion, vérifier que l'API refuse la lecture et l'écriture des dossiers.
   Avec votre compte, vérifier lecture, création, modification et suppression sur un dossier test.

## Vérification serveur en lecture seule

```sql
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, privilege_type;
```

Les tables de gestion ne doivent plus être accessibles à `anon` ou `PUBLIC`.
Le journal `whatsapp_envois` reste réservé au serveur, sans accès navigateur.
Contrôler aussi les autres tables, vues, fonctions RPC et buckets Storage du projet :
la migration couvre uniquement les tables utilisées et connues de ce dépôt.

## Secrets et limites

La clé publique Supabase est destinée au navigateur ; la sécurité repose sur les règles
serveur. Le token Meta et la clé de service restent dans les secrets Edge Functions.
La session Auth est conservée uniquement dans `sessionStorage`, entre les pages de l'onglet.
Les réponses Supabase sont exclues du cache PWA. La connexion requiert le réseau.
Le compteur de tentatives du navigateur est un confort ; les limites Auth serveur font foi.

Ce contrôle est local : il ne certifie ni la configuration distante ni l'absence de toute
faille. Les tests simulent les API, ils ne remplacent pas la vérification des règles appliquées.

Références : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[configuration Auth](https://supabase.com/docs/guides/auth/general-configuration).
