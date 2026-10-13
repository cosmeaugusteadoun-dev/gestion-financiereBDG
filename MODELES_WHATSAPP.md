# Modèles WhatsApp issus de notre système

Ces textes reprennent les usages de whatsapp.js et notes.js, avec des valeurs séparées par enfant. Les longs bilans sont synthétisés par rubrique ; le détail complet reste disponible dans le dossier.

**Ils sont à soumettre à Meta : aucun n’est déclaré approuvé automatiquement.** Les catégories ci-dessous sont proposées ; Meta décide de la catégorie finale. Les annonces libres de Messagerie doivent correspondre à un modèle spécifique approuvé.

Dans Meta : choisir le nom exact ci-dessous, la langue **Français** (code de notre configuration : `fr`), le corps et le pied de page. Si Meta fournit un autre code de langue, reprendre ce code exact dans la configuration serveur.

Pied de page commun : `Amour · Travail · Discipline · Créativité`. Les exemples ci-dessous sont fictifs et doivent être renseignés lors de la soumission.

Pour le serveur, copier uniquement les entrées effectivement approuvées du fichier [whatsapp-templates.example.json](supabase/functions/whatsapp-templates.example.json) dans `WHATSAPP_TEMPLATES_JSON`. Ne pas activer les modèles encore en attente.

Les anniversaires restent en envoi individuel depuis le tableau de bord, avec les quatre variantes de texte originales. Aucun modèle anniversaire n’est à créer dans Meta.

## Bilan financier

Nom : `bdj_bilan_financier` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 571 caractères.

```text
Bonjour {{1}},
Récapitulatif concernant *{{2}}* — {{3}}.
Situation financière au {{4}} :
Inscription / Réinscription : {{5}}
Activités parascolaires : {{6}}
Fêtes scolaires : {{7}}
Assurance : {{8}}
APE : {{9}}
Scolarité : {{10}}
Crèche : {{11}}
Petit-déjeuner : {{12}}
Déjeuner : {{13}}
Cantine crèche : {{14}}
Goûter : {{15}}
Garderie : {{16}}
Uniformes : {{17}}
Fournitures : {{18}}
Remise : {{19}}
Avance : {{20}}
*TOTAL EN RETARD : {{21}}*
Échéances : {{22}}
Merci de respecter les délais indiqués.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | section | Maternelle 2 |
| {{4}} | date | 13/10/2026 |
| {{5}} | inscription | ✅ 12 000 F CFA versé ; à jour |
| {{6}} | activites | ✅ 12 000 F CFA versé ; à jour |
| {{7}} | fetes | ✅ 12 000 F CFA versé ; à jour |
| {{8}} | assurance | ✅ 12 000 F CFA versé ; à jour |
| {{9}} | ape | ✅ 12 000 F CFA versé ; à jour |
| {{10}} | scolarite | ✅ 12 000 F CFA versé ; à jour |
| {{11}} | creche | ✅ 12 000 F CFA versé ; à jour |
| {{12}} | petit_dejeuner | ✅ 12 000 F CFA versé ; à jour |
| {{13}} | dejeuner | ✅ 12 000 F CFA versé ; à jour |
| {{14}} | cantine_creche | ✅ 12 000 F CFA versé ; à jour |
| {{15}} | gouter | ✅ 12 000 F CFA versé ; à jour |
| {{16}} | garderie | ✅ 12 000 F CFA versé ; à jour |
| {{17}} | uniformes | ✅ 12 000 F CFA versé ; à jour |
| {{18}} | fournitures | ✅ 12 000 F CFA versé ; à jour |
| {{19}} | remise | 2 000 F CFA sur Scolarité |
| {{20}} | avance | 0 F CFA |
| {{21}} | total_retard | 12 000 F CFA |
| {{22}} | echeances | Frais généraux : 14 septembre ; T1 : 19 octobre ; T2 : 7 décembre ; T3 : 5 février |

## Relance scolarité

Nom : `bdj_relance_scolarite` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 235 caractères.

```text
Bonjour {{1}},
Situation au {{2}} pour *{{3}}* — {{4}}.
Scolarité : {{5}}
*TOTAL SCOLARITÉ EN RETARD : {{6}}*
Échéances : {{7}}
Merci de respecter les délais indiqués.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | date | 13/10/2026 |
| {{3}} | enfant | KOSSOU Léa |
| {{4}} | section | Maternelle 2 |
| {{5}} | scolarite | ✅ 12 000 F CFA versé ; à jour |
| {{6}} | retard_scolarite | 12 000 F CFA |
| {{7}} | echeances | Frais généraux : 14 septembre ; T1 : 19 octobre ; T2 : 7 décembre ; T3 : 5 février |

## Relance cantine

Nom : `bdj_relance_cantine` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 266 caractères.

```text
Bonjour {{1}},
Situation au {{2}} pour *{{3}}* — {{4}}.
Petit-déjeuner : {{5}}
Déjeuner : {{6}}
Cantine crèche : {{7}}
*TOTAL CANTINE EN RETARD : {{8}}*
Merci de régulariser les échéances en retard.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | date | 13/10/2026 |
| {{3}} | enfant | KOSSOU Léa |
| {{4}} | section | Maternelle 2 |
| {{5}} | petit_dejeuner | ✅ 12 000 F CFA versé ; à jour |
| {{6}} | dejeuner | ✅ 12 000 F CFA versé ; à jour |
| {{7}} | cantine_creche | ✅ 12 000 F CFA versé ; à jour |
| {{8}} | retard_cantine | 3 000 F CFA |

## Élève en difficulté

Nom : `bdj_alerte_difficulte` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 386 caractères.

```text
Bonjour {{1}} 👋,
Nous souhaitons attirer votre attention sur les résultats de {{2}} au {{3}} (*{{4}}*), en difficulté selon notre grille d'évaluation.
Un accompagnement rapproché à la maison et un échange avec l'équipe pédagogique pourraient beaucoup l'aider.
N'hésitez pas à nous contacter pour en discuter ensemble.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | trimestre | Trimestre 1 |
| {{4}} | resultat | Bien |

## Absences et retards

Nom : `bdj_alerte_absences_retards` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 313 caractères.

```text
Bonjour {{1}} 👋,
⚠️ Nous constatons *{{2}} absence(s) non justifiée(s)* et *{{3}} retard(s) répétitif(s)* pour {{4}} au {{5}}.
La régularité est essentielle pour sa réussite : merci de veiller à sa ponctualité et de nous justifier ses absences.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | absences | 3 |
| {{3}} | retards | 2 |
| {{4}} | enfant | KOSSOU Léa |
| {{5}} | trimestre | Trimestre 1 |

## Comportement préoccupant

Nom : `bdj_alerte_comportement` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 265 caractères.

```text
Bonjour {{1}} 👋,
Nous aimerions échanger avec vous au sujet du comportement de {{2}} au {{3}}, jugé *préoccupant* par l'équipe.
Votre implication nous serait précieuse pour l'accompagner au mieux.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | trimestre | Trimestre 1 |

## Bulletin trimestriel

Nom : `bdj_bulletin_trimestriel` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 394 caractères.

```text
Bonjour {{1}},
Récapitulatif concernant *{{2}}* — {{3}}.
📚 BILAN SCOLAIRE — {{4}}
Résultat / appréciation : {{5}}
Comportement : {{6}}
Absences non justifiées : {{7}}
Retards : {{8}}
Observation : {{9}}
*TOTAL FINANCIER EN RETARD : {{10}}*
Contactez l'administration pour échanger sur ce suivi ou obtenir le détail financier.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | section | Maternelle 2 |
| {{4}} | trimestre | Trimestre 1 |
| {{5}} | resultat | Bien |
| {{6}} | comportement | Satisfaisant |
| {{7}} | absences | 3 |
| {{8}} | retards | 2 |
| {{9}} | observation | Merci de poursuivre les exercices de lecture à la maison. |
| {{10}} | total_retard | 12 000 F CFA |

## Bulletin annuel

Nom : `bdj_bulletin_annuel` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 243 caractères.

```text
Bonjour {{1}},
Bilan annuel de *{{2}}* — {{3}} · {{4}}.
Trimestre 1 : {{5}}
Trimestre 2 : {{6}}
Trimestre 3 : {{7}}
Pour échanger sur ce suivi, contactez l'équipe pédagogique.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | section | Maternelle 2 |
| {{4}} | annee | 2026-2027 |
| {{5}} | resultat_t1 | Bien |
| {{6}} | resultat_t2 | Très bien |
| {{7}} | resultat_t3 | Bien |

## Reçu de paiement

Nom : `bdj_recu_paiement` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 222 caractères.

```text
Bonjour {{1}},
Reçu de paiement pour *{{2}}* — {{3}}.
Montant reçu : *{{4}}*
Date : {{5}}
Objet : {{6}}
Mois / tranche : {{7}}
Merci pour votre règlement.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | section | Maternelle 2 |
| {{4}} | montant_recu | 20 000 F CFA |
| {{5}} | date_recu | 13/10/2026 |
| {{6}} | objet_recu | Petit-déjeuner, Déjeuner, Goûter, Garderie |
| {{7}} | mois_recu | Oct |

## Renouvellement crèche

Nom : `bdj_renouvellement_creche` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 396 caractères.

```text
Bonjour {{1}},
📅 Rappel — Abonnement Crèche de {{2}}.
L'abonnement annuel (inscription et assurance) arrive à échéance le *{{3}}*.
Nous vous invitons à procéder au renouvellement avant cette date afin que votre enfant continue de bénéficier de nos services sans interruption.
N'hésitez pas à nous contacter pour toute question.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | enfant | KOSSOU Léa |
| {{3}} | date_renouvellement | 20/10/2026 |

## Information de la classe

Nom : `bdj_information_classe` · Langue : `fr` · Catégorie proposée : **UTILITY** · Corps : 176 caractères.

```text
Bonjour {{1}} 👋,
📋 Information de la classe — {{2}} · {{3}}
{{4}}
Pour toute question, contactez l'équipe.

Les Bulles de Joie · Zongo 2, Parakou
Secrétariat : 01 97 91 94 52
```

| Variable | Donnée du système | Exemple à fournir à Meta |
|---|---|---|
| {{1}} | parent | Madame KOSSOU |
| {{2}} | section | Maternelle 2 |
| {{3}} | trimestre | Trimestre 1 |
| {{4}} | observation | Merci de poursuivre les exercices de lecture à la maison. |

