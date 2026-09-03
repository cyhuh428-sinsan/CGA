# Démarrer avec CGA

Public : utilisateurs nouveaux sur CGA

Ce document vous guide dans la création de votre premier bot dans CGA et dans l'affichage des résultats de vos premiers tests. Suivez étape par étape, vérifiez les résultats attendus de chaque étape avant de passer à l'étape suivante.


## Complété dans ce document

Si vous lisez ces instructions jusqu'à la fin, vous pourrez :

- Vous pouvez préparer les informations nécessaires avant de créer un nouveau bot.
- Vous pouvez décider quelle méthode NLU choisir parmi ML·Semantic·LLM.
- Vous pouvez vérifier le modèle, la méthode de réponse et l'état du support sur l'écran de création.
- Après avoir créé votre bot, vous saurez quoi rechercher lors de la formation ou de l'indexation et des premiers tests.

## Préparez-vous avant de commencer

- Compte CGA Studio
- Nom du bot à créer
- Un court énoncé utilisateur à utiliser pour les tests.
- Choix par défaut pour la méthode NLU à utiliser

Lors de l'apprentissage de l'écran pour la première fois, il est recommandé de vérifier l'écran en fonction de la combinaison de `ML` et `Réponse fixe`. Cette combinaison est affichée sous la forme `Prêt à exécuter/entraîner` dans l'écran de création actuel. La réussite réelle de la création et de l’apprentissage nécessite une vérification distincte.

Si vous avez besoin de critères de sélection détaillés pour le moteur, veuillez d'abord consulter le [Guide d'utilisation NLU](../cga-nlu-guide/README.md).

### Exemple de préparation minimale pour la première utilisation

N'ajoutez pas beaucoup de fonctionnalités dès le début, vérifiez le flux de l'écran avec une seule intention et de courts énoncés de test.

| Articles de préparation | Exemple |
|---|---|
| nom du robot | Demande de vacances Testbot |
| intention | Vérifier les jours de vacances restants |
| Exemple de phrases d'apprentissage | Combien de jours reste-t-il en vacances ? |
| tester l'allumage | Combien de vacances reste-t-il ? |
| Méthode de première réponse | réponse établie |

L'exemple ci-dessus est destiné à expliquer comment utiliser le document et n'est pas destiné à être utilisé comme données ou réponses commerciales réelles de l'entreprise.

## Étape 1. Connexion

### Objectif

Permet d'accéder à l'écran de travail de CGA Studio.
### Opération

1. Ouvre l'écran de connexion de CGA Studio.
2. Saisissez les informations de votre compte.
3. Sélectionnez le bouton Connexion.

### Résultats attendus

Le tableau de bord ou l'écran de bienvenue de CGA Studio correspondant à vos autorisations s'affiche.

### Si un problème survient

Si vous revenez à l'écran de connexion ou voyez une erreur d'autorisation, vérifiez l'état de votre compte et vos rôles auprès des Opérations.

## Étape 2. Créer un nouveau bot

### Objectif

Saisissez les informations de base sur le bot que vous souhaitez tester.
### Opération

1. Accédez à l'écran de création de bot.
2. Sélectionnez `Bot` dans Type de robot.
3. Sélectionnez le type de texte ou le type de voix.
4. Vous pouvez maintenant sélectionner une image PC dans la zone de profil.
5. Saisissez le nom du robot dans le champ `Saisissez le nom du bot.`.
6. Vérifiez `Coréen` dans la langue.
7. Si nécessaire, saisissez une introduction dans le champ `Saisissez une présentation qui décrit le bot.`.

### Résultats attendus

L'écran de création du bot affiche l'état de sélection et les informations de base saisies dans le récapitulatif de la structure.

### Si un problème survient

Si une erreur de nom de robot apparaît, saisissez à nouveau tous les caractères qui ne correspondent pas aux instructions à l'écran ou réduisez la longueur.

Vérifiez les points suivants avant de saisir :

- Comment puis-je éviter de confondre le nom de mon robot avec celui d'autres robots ?
- Avez-vous préparé l'énoncé du test en une seule phrase ?
- Avez-vous utilisé des données opérationnelles réelles ou des informations personnelles pour saisir le test ?

## Étape 3. Sélectionnez la méthode NLU

### Objectif

Sélectionnez le moteur qui interprétera les énoncés de l'utilisateur.

### opération

Dans `Méthode NLU`, sélectionnez l'une des options suivantes :

- `ML`
- `Semantic - Vector Worker`
- `Semantic - External Embedding`
- `LLM Engine`

### Résultats attendus

Le modèle NLU et les éléments de paramètres supplémentaires appropriés à la méthode sélectionnée s'affichent. Par exemple, si vous sélectionnez `Semantic - External Embedding`, le modèle d'intégration et les éléments de connexion à la base de données Intent Vector seront affichés, et si vous sélectionnez `LLM Engine`, les éléments du fournisseur et du modèle détaillé seront affichés.

### Lors de la première sélection

- Examinez le ML comme point de départ pour concevoir directement des phrases et des intentions d'apprentissage.
- Si la structure utilise la similarité sémantique et Vector DB, pensez à Semantic.
- Consultez le LLM si vous êtes prêt à utiliser le modèle avec un fournisseur LLM.

Pour une sélection spécifique, reportez-vous au [Tableau de comparaison des moteurs](../cga-nlu-guide/engine-comparison.md).

## Étape 4. Vérifiez le modèle et la méthode de réponse

### Objectif

Vérifiez les modèles et les méthodes de réponse requis pour la méthode NLU sélectionnée.

### Fonctionnement

1. Vérifiez les modèles disponibles dans `Modèle NLU`.
2. Dans `Mode de réponse`, vérifiez quels éléments peuvent être sélectionnés parmi la réponse définie, la réponse RAG du moteur sémantique, la réponse RAG du moteur LLM et la réponse du moteur LLM.
3. Vérifiez l'état de prise en charge de la combinaison de sélection.
4. Lors de la première vérification des paramètres, assurez-vous que la combinaison `ML` + `DeepLearning Lite` + `Réponse fixe` s'affiche sous la forme `Prêt à exécuter/entraîner`.

### Résultats attendus

Le résumé de la structure affiche la langue, la méthode NLU, le modèle NLU, la méthode de réponse, le LLM et la version.

### Si un problème survient

Si une combinaison est marquée comme indisponible, choisissez une autre méthode de réponse ou une autre méthode NLU. Nous ne procéderons pas à votre création sans vérifier l’état de votre candidature.

## Étape 5. Préparation minimale pour chaque moteur

Les préparatifs de cette étape varieront en fonction du moteur sélectionné.

### ML.

Préparez des phrases d'intention et d'apprentissage. Écrivez de manière à ce que chaque énoncé ne contienne qu'une seule intention et préparez des expressions distinctes pour des intentions similaires.

Tout d'abord, préparez une seule intention et quelques phrases d'apprentissage et vérifiez le flux de l'écran, puis vérifiez s'il a réussi et élargissez la portée.

### Sémantique

Préparez l'intention ou la connaissance de la cible de recherche et les conditions de connexion à la base de données vectorielle. Si vous choisissez l'intégration externe, vérifiez l'adresse de l'API de recherche et les conditions de compatibilité du modèle d'intégration.

### L.L.M.

Sélectionnez le fournisseur LLM et le modèle détaillé, et préparez les adresses d'appel modèles et les directives de réponse si nécessaire.

La création de données détaillées et l'amélioration de la qualité pour chaque moteur sont traitées dans le chapitre correspondant du [Guide d'utilisation NLU](../cga-nlu-guide/README.md).

## Étape 6. Création, apprentissage, préparation de l'index

### Objectif

Prépare les paramètres et les données du bot saisis pour une utilisation dans CGA.
### Opération

1. Revérifiez les valeurs d'entrée et la combinaison de moteurs.
2. Sélectionnez le bouton `Confirmer` sur l'écran de création.
3. Vérifiez le résultat de la création et l'état de la version.
4. Exécutez toutes les tâches de formation ou de préparation d'index requises pour le moteur sélectionné.
5. Vérifiez que le statut est passé à Terminé ou Disponible.

### Résultats attendus

Le bot et la version sont créés, et l'état de préparation est affiché pour le moteur sélectionné.


### Lorsque la fin de l'apprentissage n'est pas confirmée

Si le bouton d'apprentissage devient `En cours d’entraînement` et qu'après actualisation, il affiche à nouveau `Entraîner` et `Non entraîné`, l'apprentissage échoue. Nous vérifions l'heure et le statut d'achèvement dans la demande d'historique de formation, et s'il n'y a aucun résultat, nous n'utilisons pas le test sur simulateur comme contrôle de qualité.

## Étape 7. premier test

### Objectif

Assurez-vous que les énoncés de l'utilisateur sont traités via le moteur sélectionné.

### Fonctionnement

1. Accédez à l'écran de travail de version du bot que vous avez créé.
2. Ouvrez le simulateur.
3. Saisissez le court énoncé de test que vous avez préparé.
4. Exécutez le test.

### Résultats attendus

Les résultats de réponse et de classification sont affichés.

### Si un problème survient


Affinez la portée dans l'ordre suivant :

1. Vérifie que le bot et la version actuellement sélectionnés sont éligibles pour les tests.
2. Vérifiez l'état de la combinaison de la méthode NLU, du modèle et de la méthode de réponse.
3. Vérifiez l'état de préparation de l'entraînement ou de l'index et les messages d'erreur.
4. Saisissez à nouveau l'énoncé représentatif et les autres énoncés variantes, respectivement.
5. Si l'échec persiste, le bot, la version, le moteur, le déclenchement et l'heure de l'erreur sont enregistrés et transmis au responsable des opérations.

## Étape 8. Vérifiez les résultats et apprenez ensuite

Après le premier test, vérifiez les résultats sur l'écran suivant.

- Simulateur : énoncé d'entrée et réponse immédiate
- Analyse : résultats cumulatifs de classification et étapes d'application
- Évaluation : données et résultats de l'évaluation
- Historique des conversations : historique des conversations enregistré

Si les résultats sont insuffisants, consultez le guide d'utilisation de NLU pour connaître les procédures d'amélioration des données et de revalidation pour chaque moteur.

## Utiliser le guide Getting Started à l’écran

Ouvrez `?` en bas à gauche puis choisissez `Bien démarrer`. Le guide s’affiche sur l’écran CGA actuel et peut être fermé à tout moment.

| Parcours | Huit étapes |
|---|---|
| Explorer les menus | Bot → API → Admin → intentions et phrases → entités et dictionnaires → évaluation → réentraînement → analyse |
| Créer un bot | création → moteur d’intention → modèle et réponse → intentions et phrases → entités, dictionnaires et flux → entraînement → Bot Test → amélioration |

Choisissez un parcours puis `Commencer`. Utilisez `Précédent`, `Suivant` ou le numéro d’étape. `Voir un autre parcours` permet de changer. À la dernière étape, `Terminer` ouvre la liste des bots ou la création d’un bot. Le masquage au démarrage est enregistré uniquement dans le navigateur courant; le guide reste accessible depuis l’aide.

## Document suivant

- [Voir tous les manuels CGA](../README.md)
- [Manuel d'utilisation CGA](../cga-user-manual/README.md)
- [Guide d'utilisation CGA NLU](../cga-nlu-guide/README.md)
