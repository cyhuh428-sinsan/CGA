# Manuel d'utilisation de CGA Studio

Public : utilisateurs généraux, opérateurs de robots, administrateurs système

Ce document décrit les menus et le flux de travail de CGA Studio. Si vous l'utilisez pour la première fois, lisez d'abord [Démarrage CGA](../cga-getting-started/README.md) et reportez-vous au [Guide d'utilisation CGA NLU](../cga-nlu-guide/README.md) pour la sélection du moteur, l'apprentissage et l'amélioration de la qualité.


## 1. Démarrage de CGA Studio

### 1.1 Connexion

1. Ouvre l'écran de connexion de CGA Studio.
2. Saisissez les informations de votre compte.
3. Après vous être connecté, accédez à l'écran CGA Studio.


### 1.2 Notations utilisées dans les documents

- `Bot` : Unité fournissant des services de conversation
- `Version` : unité d'exécution qui gère la configuration et les actifs de formation du bot.
- `Méthode NLU` : une méthode d'interprétation des énoncés de l'utilisateur comme une intention ou une signification
- `Mode de réponse` : Méthode de génération ou de récupération de réponses basées sur les résultats de classification
- `Entraînement` : réflexion des données du bot pour le ML ou le moteur d'exécution sélectionné

### 1.3 Vérification de l'état à l'écran

L'écran de création du bot affiche une zone de saisie ainsi qu'une zone résumant la sélection en cours. Vérifiez d'abord les éléments suivants :

- Langue
- Méthode NLU
- Modèle NLU
- Méthode de réponse
- Fournisseur ou modèle LLM
Version - version

Si vous modifiez la méthode NLU ou la méthode de réponse, les modèles sélectionnables et les éléments de configuration supplémentaires peuvent changer. Vérifiez si l'état de combinaison de l'écran est `Prêt à exécuter/entraîner` ou `Seul l’enregistrement des paramètres est possible`, puis décidez de l'action suivante. Si vous l'utilisez pour la première fois, ne sélectionnez pas `Confirmer` sans vérifier l'état de la combinaison.

Dans l'écran de création, `Confirmer` est une action pour soumettre les paramètres saisis et `Annuler` est une action pour quitter l'écran de création. Après la soumission, les résultats de la création du bot et l’état d’achèvement de l’apprentissage/indexation sont soumis à une vérification d’exécution distincte.

## 2. Création de bot et paramètres d'IA

Sur l'écran de création du bot, spécifiez les informations de base du bot et les paramètres liés à l'IA.

### 2.1 Informations de base

Les éléments par défaut affichés sur l'écran actuel sont les suivants :

- Type de robot : Bot, Bot Hub
- Mode Bot : type de texte, type de voix
- Profil du robot
- Nom du robot
- Langue : les options d'écran actuelles sont le coréen
- Introduction

Saisissez le nom du robot en suivant les instructions à l'écran, en respectant les caractères et la longueur autorisés. L'image de profil sera au format PNG, JPEG, WEBP et la limite de taille affichée à l'écran.

### 2.2 Méthode NLU

Les méthodes NLU actuellement disponibles pour la sélection sur l'écran CGA sont les suivantes.

| écran d'affichage | Signification |
|---|---|
| ML | Méthode de classification basée sur les phrases d'apprentissage et l'intention |
| Sémantique - Travailleur vectoriel | Méthode sémantique utilisant Vector Worker et Vector DB de CGA |
| Sémantique - Intégration externe | Méthode sémantique connectant l'intégration externe et la base de données vectorielle locale |
| Moteur LLM | Comment utiliser le modèle LLM |

Pour connaître les critères de sélection spécifiques au moteur et les méthodes de préparation des données, reportez-vous à [Comparaison des moteurs dans le guide d'utilisation NLU](../cga-nlu-guide/engine-comparison.md).

### Modèle NLU 2.3

La liste des modèles varie en fonction de la méthode NLU.

- ML : DeepLearning Lite, TF-IDF linéaire, référence de mots clés
- Sémantique : modèle de vecteur de travail par défaut ou modèle d'intégration externe
- LLM : Sélection du fournisseur et sélection détaillée du modèle pour chaque fournisseur

Sur l'écran LLM, des fournisseurs tels que Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama et OpenRouter peuvent être affichés, et la liste détaillée des modèles varie en fonction du fournisseur sélectionné. Les modèles réellement disponibles et l'état de la connexion sont vérifiés en fonction de l'état sélectionnable sur l'écran de création.

### 2.4 Méthode de réponse

Les méthodes de réponse affichées sur l'écran actuel sont les suivantes.

- Réponse définie
- Réponse RAG du moteur sémantique
- Réponses RAG du moteur LLM
- Réponses du moteur LLM

Les combinaisons de méthodes NLU et de méthodes de réponse peuvent afficher l'état de prise en charge. Si l'état de la combinaison est indisponible, ne continuez pas ; passer à une combinaison prise en charge.

## 3. Version du bot et espace de travail

Après avoir créé un bot, gérez le bot et la version séparément.

- Bot : informations de base et cible opérationnelle de l'unité de service
- Version : une unité qui gère les paramètres d'intention, d'objet, de dictionnaire, de conception de dialogue et d'IA.
- Espace de travail : écran permettant de concevoir, tester et analyser une version spécifique du robot.

Le chemin détaillé est vérifié en fonction du nom du menu de l'écran CGA actuel.

Lorsque vous démarrez une opération, sélectionnez d'abord le bot et la version, et assurez-vous que ce qui est affiché à l'écran correspond à ce que vous vouliez. Si vous modifiez vos données avec un autre robot ou une autre version sélectionnée, vos résultats peuvent varier.

### 3.1 Voie d'accès principale

| travail | Voie d'accès |
|---|---|
| Liste des robots | Studio > Bot |
| Créer un nouveau bot | Studio > Bot > Créer un bot |
| Paramètres du robot | Bot sélectionné > Paramètres |
| Liste des versions | Bot sélectionné > Contrôle de version |
| Espace de travail des versions | Bot sélectionné > Version > Espace de travail |

Vérifiez d'abord l'état de sélection du bot/version sur l'écran, puis modifiez les actifs de version tels que l'intention, l'objet, le dictionnaire et l'assurance qualité.

## 4. Actifs de conception de boîtes de dialogue

### 4.1 Intention

Il s'agit d'une unité qui distingue ce que demande un énoncé utilisateur. Le flux de conversation lié aux phrases d’apprentissage pour chaque intention doit être revu ensemble.

Le chemin d'accès est `Bot > Version > Intentions`. Après avoir modifié les données d'intention, vérifiez l'état de la formation et les résultats du simulateur de cette version.

### 4.2 Objet

Il s'agit d'une unité qui extrait la valeur ou le nom requis pour le traitement métier d'un énoncé. Lors de la modification d'un objet, vérifiez si l'intention et le flux de dialogue associés sont activés ou non.

Le chemin d'accès est `Bot > Version > Entités`. Lorsque vous modifiez les noms d’entités ou les critères d’extraction, assurez-vous que les intentions et les énoncés de test existants restent valides.

### 4.3 Dictionnaire

Actifs utilisés pour interpréter les termes de domaine, les synonymes et les expressions utilisateur. Les principes détaillés de création d'un dictionnaire sont expliqués dans le Guide d'utilisation NLU.

Le chemin d'accès est `Bot > Version > Dictionnaire`. Lorsque vous ajoutez des synonymes, faites la distinction entre les expressions qui affectent uniquement une intention spécifique ou les expressions couramment utilisées dans plusieurs intentions.

### 4.4 Assurance qualité

Il s'agit de la zone qui gère les questions et réponses ou les connaissances basées sur des documents. Le format de téléchargement et la structure du document sont d'abord vérifiés pour voir quelle plage est prise en charge par l'écran CGA réel.

Le chemin d'accès est `Bot > Version > QA`. Après avoir réfléchi aux documents ou aux questions/réponses, vérifiez si l'indexation ou le statut de la candidature est fourni et n'utilisez pas les résultats pour des opérations sans confirmation.

### 4.5 Flux de dialogue

Le flux de conversation est la zone qui organise le processus de traitement de la demande d'un utilisateur en la liant à l'intention.

Le chemin d'accès est `Bot > Version > Flux de conversation`. Lorsque vous modifiez un flux, vérifiez les points suivants :

1. Vérifiez à quelle intention le flux est associé.
2. Vérifiez l'ordre des entrées de l'utilisateur et des réponses du bot.
3. Vérifiez si des étapes utilisent des objets ou des variables communes.
4. Vérifiez le branchement pour les situations de terminaison, de nouvelle question et d'exception.
5. Après avoir enregistré, testez les chemins normaux et d'exception séparément dans le simulateur.

### 4.6 API

Le menu API est une zone qui gère les informations API associées à la gestion des conversations de votre bot ou de votre version.

Le chemin d'accès est `Studio > API` ou `Bot > Version > API`. Lorsque vous modifiez une API, vérifiez les éléments de requête, les éléments de réponse, les intentions associées et les paramètres d'authentification. Les tests d'interconnexion externe réels et les résultats de connexion opérationnelle nécessitent une vérification séparée.

## 5. Tests/Analyses/Évaluation

Actuellement, les écrans de travail suivants existent dans CGA pour chaque version.

- Simulateur : écran pour saisir l'énoncé et vérifier la réponse
- Analyse : écran permettant de vérifier les résultats cumulés de la classification et les étapes de classification appliquées
- Évaluation : écran permettant de vérifier les données et les résultats de l'évaluation préparée
- Historique des conversations : écran permettant de vérifier les résultats des conversations réelles ou enregistrées
- Réentraîner : écran pour refléter à nouveau les données de retour ou de correction

Les principaux chemins d'accès sont les suivants :

| travail | Voie d'accès |
|---|---|
| simulateur | Bot > Version > Simulateur |
| analyse | Bot > Version > Analyses |
| évaluation | Bot > Version > Évaluation |
| historique des conversations | Bot > Version > Historique des conversations |
| Réapprentissage | Bot > Version > Réentraîner |

Exclusion/Ignorer, Small Talk, Exacting Matching, Rule, ML, Semantics, LLM, etc. peuvent être affichés dans l'étape de classification de l'écran d'analyse. L'interprétation est basée sur les étapes de classification réelles et les indicateurs affichés à l'écran.

## 6. Gestion du système

L'étendue de l'accès au menu de gestion du système peut varier en fonction du rôle.

Les groupes de menus actuels sont les suivants :

- Gestion des utilisateurs : gestion des utilisateurs, historique des connexions, gestion des groupes
- Demande d'état : journal des opérations/système, état du bot, historique d'apprentissage, historique des conversations, historique des appels API, historique des files d'attente, commentaires par intention
- Gestion des conversations : variables communes, message par défaut
- Connexion système : canal, état de connexion de la station robot
- Autre gestion : modèles, licences

Le nom d'affichage réel du menu administrateur est le suivant.

- Gestion des utilisateurs : gestion des utilisateurs, historique des connexions, gestion des groupes
- Demande d'état : demande de journal d'exploitation/système, demande d'état du robot, demande d'historique d'apprentissage, demande d'historique de conversation, demande d'historique d'appels API, demande d'historique de file d'attente, demande de commentaires par intention
- Gestion des conversations : gestion des variables communes, gestion des messages de base
- Connexion système : gestion des canaux, état de connexion de la station bot
- Autre gestion : liste de modèles, recherche de licence

### 6.1 Canaux et Bot Station

- `Gestion des canaux` : gère l'ID du canal, le nom du canal, le fournisseur, le type de moteur de rendu, la disponibilité et les paramètres de connexion.
- `État de la connexion Botstation` : vérifiez l'état de liaison du groupe, du canal, du bot, de la version d'exploitation et du canal actif.

Avant de changer de canal ou de botstation, vérifiez la version d'exploitation du bot cible et les canaux actifs. Si un test de connexion ou un résultat d'enregistrement échoue, enregistrez le message d'erreur et les informations de destination sur l'écran et transmettez-les au personnel d'exploitation.

Les opérations détaillées pour chaque autorité dans le menu administrateur sont confirmées après vérification par le navigateur pour chaque rôle réel.

### 6.2 Connexion du canal KakaoTalk

Pour vous connecter à KakaoTalk, vous devez compléter les paramètres du développeur Kakao, les paramètres du canal/chatbot KakaoTalk et les paramètres des informations de connexion CGA dans l'ordre. Le simple enregistrement d'une chaîne sur l'écran CGA ne complète pas la connexion KakaoTalk.

> Attention de sécurité : les informations d'authentification/connexion telles que l'ID de l'application, la clé API REST, l'URL de la compétence et les en-têtes d'opération/test ne sont pas enregistrées en tant que valeurs réelles dans les documents, les captures d'écran, les journaux ou les messagers. La valeur réelle est confirmée par le personnel opérationnel via un chemin de livraison sécurisé, et seuls le nom de l'article et l'emplacement de stockage sont enregistrés dans le document.

#### 6.2.1 Préparation

Vérifiez les informations suivantes auprès de votre représentant des opérations :

- Application Kakao Developers et ID d'application
- État de connexion du canal KakaoTalk et du canal professionnel
- Kakao Business Chatbot et canal d'exploitation
- Bots et versions d'exploitation à utiliser dans CGA
- URL de compétence et URL de test émises par CGA
- En-têtes opérationnels et de test requis

Si l'ID ou la clé de l'application est codé en dur dans le document ou l'écran, ou si les versions du robot d'opération et du robot de test sont différentes, la confirmation de connexion n'est pas effectuée.

#### 6.2.2 Paramètres de l'application Kakao Developers

1. Connectez-vous à [Kakao Developers](https://developers.kakao.com/).
2. Sélectionnez l'application à connecter dans le menu **Application**.
3. Vérifiez le nom et l'ID de l'application.
4. Si la connexion Kakao est requise dans **Connexion Kakao > Général**, définissez le statut sur `ON` et enregistrez.
5. Vérifiez les informations de base sur l'application et l'état de conversion de l'application Biz dans **Certification d'entreprise > Changement d'application Biz**.
6. Vérifiez l'éligibilité de la candidature et examinez l'état dans **KakaoTalk Channel > Business Channel Connection**.
7. Vérifiez la clé API REST dans les paramètres de l'application, mais n'exposez pas la valeur réelle de la clé à l'extérieur.

Les connexions aux canaux professionnels peuvent ne pas être disponibles immédiatement en fonction de l'état de l'examen. S'il est en cours de révision, enregistrez l'état plutôt que de déterminer que la connexion est terminée.


#### 6.2.3 Paramètres du canal KakaoTalk et du chatbot

1. Vérifiez le canal à connecter dans [KakaoTalk Channel Management Center](https://center-pf.kakao.com/) ou Kakao Business Management Center.
2. Assurez-vous que le canal est détectable et disponible.
3. Créez un chatbot ou sélectionnez un chatbot existant dans **Business Tools > Chatbots**.
4. Sélectionnez et enregistrez le canal d'opération à connecter à CGA dans **Paramètres > Sélectionner le canal d'opération** du chatbot.
5. Vérifiez que le canal d'opération et le chatbot sont connectés dans **Connect chatbot** dans le tableau de bord du canal.


#### 6.2.4 Création de compétences et saisie des informations de connexion

1. Sélectionnez le chatbot cible dans le Kakao Chatbot Management Center.
2. Sélectionnez **Créer un nouveau bloc > Créer une compétence**.
3. Saisissez le nom de la compétence. Nommez-le selon les règles de fonctionnement et identifiez-le comme une compétence de connexion CGA.
4. Saisissez respectivement l'URL de la compétence et l'URL du test émises par CGA.
5. Saisissez respectivement les en-têtes opérationnels et de test, si nécessaire.
6. Après l'enregistrement, vérifiez l'URL, l'URL de test, l'état de saisie de l'en-tête et les blocs applicables sur l'écran des détails de la compétence.

L'URL de la compétence et l'en-tête utilisent les valeurs fournies par le personnel opérationnel de CGA. Ne devinez pas les valeurs et ne saisissez pas les URL de production et de test de manière interchangeable.

![Écran de détails de la compétence Kakao Connect](screenshots/kakao-skill-detail-masked.png)

Figure 6-2-1. `Connexion CGA Kakao` Écran de détails des compétences. Les valeurs d'URL et d'en-tête sont masquées pour des raisons de sécurité.

#### 6.2.5 Connexion du bloc de bienvenue et du bloc de secours

1. Ouvrez le bloc de bienvenue du chatbot.
2. Sélectionnez la compétence de connexion CGA dans **Paramètres**.
3. Sélectionnez **Utiliser les données de compétences** dans les paramètres de réponse du bot.
4. Enregistrer.
5. Définissez la même compétence de connexion CGA et **utilisez les données de compétence** dans le bloc de secours.
6. Revérifiez les résultats de la sauvegarde et l'état de la connexion pour chaque bloc.

Le bloc de bienvenue gère la première entrée dans une conversation KakaoTalk et le bloc de secours transmet les énoncés réguliers au CGA. Si les deux blocs utilisent des compétences différentes ou des versions de fonctionnement différentes, les résultats du traitement du message d'accueil initial et de la réponse générale peuvent différer.

![Bloc de bienvenue Kakao](screenshots/kakao-welcome-block.png)

Figure 6-2-2. Bienvenue dans les paramètres des paramètres de bloc et dans l'écran d'utilisation des données de compétences.

![Bloc de secours Kakao](screenshots/kakao-fallback-block.png)

Figure 6-2-3. Paramètres des paramètres du bloc de secours et écran d'utilisation des données de compétences.

#### 6.2.6 Liaison de l'enregistrement du canal CGA et de la version d'exploitation

1. Dans CGA Studio, accédez à **Gestion du système > Gestion des canaux**.
2. Saisissez l'ID et le nom du canal à utiliser pour la connexion KakaoTalk, ou sélectionnez un canal existant.
3. Vérifiez le fournisseur, le type de moteur de rendu, la disponibilité et les paramètres de connexion.
4. Vérifiez le bot auquel vous vous connectez et sa version d'exploitation.
5. Après l'enregistrement, vérifiez l'état de la connexion sur l'écran de gestion des chaînes.
6. Vérifiez que la combinaison groupe, canal, bot, version d'exploitation et canal actif est correcte dans **État de connexion Botstation**.

#### 6.2.7 Vérifier la connexion

1. Recherchez la chaîne connectée à KakaoTalk et ouvrez la salle de discussion.
2. Assurez-vous que le message d'accueil par défaut de CGA s'affiche lors de la première entrée.
3. Saisissez l'énoncé régulier correspondant à l'intention enregistrée.
4. Assurez-vous que les résultats de la classification NLU et du flux de conversation de CGA sont affichés dans la réponse.
5. Vérifiez que les déclarations et les réponses des utilisateurs sont enregistrées dans l'historique des conversations CGA.
6. Vérifiez si la valeur du canal dans l'historique est `Kakao` ou la valeur du canal Kakao définie dans l'environnement d'exploitation.
7. Vérifiez que le bot, la version d'exploitation et les informations sur la chaîne correspondent au public visé.

Les conditions d'achèvement de la connexion sont les suivantes.

- Le bloc de bienvenue et le bloc de repli appellent la compétence de connexion CGA.
- Les deux blocs sont configurés pour utiliser les données de compétences.
- Le premier message d'accueil et la réponse générale proviennent des paramètres du bot CGA, et non de la phrase des paramètres Kakao.
- Les informations sur le bot, la version et le canal Kakao restent dans l'historique des conversations CGA.

Si la connexion échoue, vérifiez l'état du canal Kakao, le canal de fonctionnement du chatbot, l'URL/l'en-tête de la compétence, le bloc de bienvenue/de secours, le fournisseur de canal CGA et la version de fonctionnement dans cet ordre. Ne copiez pas et ne modifiez pas arbitrairement les clés ou les en-têtes des documents.


#### 6.2.8 Emplacement d'insertion de la capture d'écran CGA

L'écran CGA suivant insère une capture après avoir vérifié les autorisations et l'état de connexion de l'environnement d'exploitation réel.


Lors de l'insertion d'une capture, masquez d'abord les informations sensibles telles que le nom du compte, l'ID de l'application, la clé API REST, l'URL de la compétence, l'en-tête d'authentification et les informations personnelles.

## 7. Séquence de confirmation de base lorsqu'un problème survient

1. Vérifiez que le bot et la version actuels sont corrects.
2. Vérifiez l'état de la combinaison de la méthode NLU, du modèle et de la méthode de réponse sélectionnés.
3. Vérifiez que les données requises ont été enregistrées.
4. Vérifiez le statut de formation/indexation/application.
5. Testez à nouveau le même énoncé dans le simulateur.
6. Vérifier les résultats dans l'historique d'analyse/évaluation/dialogue.

Si la cause et le résultat ne sont pas confirmés à l'écran, ne manipulez pas directement la base de données ou la CLI, mais transmettez le bot, la version, le message d'erreur et l'heure d'apparition à l'écran au responsable des opérations.

### En cas de non-apprentissage même après demande d'apprentissage

1. Appuyez sur le bouton Learn et vérifiez si le message `La demande d’entraînement NLU a été ajoutée à la file d’attente.` s'affiche.
2. Vérifiez que le bouton Apprendre devient `En cours d’entraînement`.
3. Après l'actualisation, vérifiez si l'état de la version passe à `Entraînement terminé` ou Disponible.
4. Vérifiez l'heure de début, l'heure de fin et l'état d'apprentissage du même bot/version dans la demande d'historique d'apprentissage.
5. S'il s'affiche à nouveau sous la forme `Non entraîné` ou s'il n'y a pas d'historique d'apprentissage, ne le jugez pas comme un succès, mais transmettez le bot, la version, le moteur d'apprentissage et le temps de demande au personnel d'exploitation.

Une demande d'apprentissage est ajoutée à la Queue et traitée de manière asynchrone par un Worker distinct. L'apprentissage ML et Semantic peut dépasser trois minutes selon les données et l'environnement ; attendez l'état Réussi ou entraîné dans l'historique avant de tester.

## 8. Procédures courantes pour les opérations de menu

L'ordre suivant est généralement appliqué lors de l'utilisation des menus Intention, Objet, Dictionnaire, Assurance qualité, Flux de dialogue et API.

1. **Objectif** : En une phrase, définissez le résultat du travail que vous souhaitez modifier avec cette tâche.
2. **Chemin d'accès** : sélectionnez le bot et la version appropriés et accédez au menu correspondant.
3. **Composition de l'écran** : vérifiez d'abord la valeur actuelle, l'état de la sélection, les erreurs/avertissements et les éléments inactifs.
4. **Procédure d'utilisation** : modifiez uniquement les éléments nécessaires et enregistrez les valeurs avant les modifications.
5. **Résultat de l'enregistrement/de l'application** : Vérifiez le message d'enregistrement et l'état d'apprentissage/indexation/application.
6. **Attention** : Vérifiez l'impact sur l'intention/le flux/le canal/la version associés.
7. **Documentation associée** : S'il s'agit d'un problème de moteur ou de qualité, consultez également le [Guide d'utilisation NLU](../cga-nlu-guide/README.md).

Le message de réussite de l'enregistrement à lui seul ne détermine pas que la réflexion de l'opération est terminée. Si vous avez besoin de résultats d'utilisation réels, vérifiez les résultats dans le simulateur, l'analyse et l'historique des conversations.

## 9. Glossaire

| Terminologie | Descriptif |
|---|---|
| robot | Unité de service qui parle à l'utilisateur |
| Centre de robots | Une unité qui gère plusieurs robots |
| version | Unité qui gère séparément les paramètres du bot et la conception des conversations |
| intention | Une unité qui classe le but de la demande d'un utilisateur |
| objet | Une valeur ou un nom extrait d'un énoncé |
| NLU | Zone fonctionnelle qui interprète la saisie en langage naturel de l'utilisateur |
| Apprentissage | La tâche de refléter les données enregistrées afin que le moteur puisse les utiliser |
| Indexation | Préparer la structure de recherche des données pour la récupération |
| CHIFFON | Comment utiliser ensemble les connaissances récupérées et les modèles génératifs |

## 10. Entités et dictionnaires

- Les entités extraient des valeurs telles que date, région, produit ou numéro de commande.
- Les dictionnaires normalisent les termes métier et les synonymes. Après une modification, retestez toutes les intentions associées.
- Conservez la cohérence entre noms, expressions représentatives, variables et flux de dialogue.

## 11. Flux de dialogue et modèles

1. Partez de l’intention et identifiez la première carte.
2. Reliez réponses, conditions, API, variables et carte suivante.
3. Créez les chemins normal, exceptionnel et final, puis vérifiez qu’aucune carte n’est isolée.
4. Sélectionnez uniquement les modèles actifs du canal cible et vérifiez le rendu dans le test du bot et le canal réel.

## 12. Gestion et exécution des API

- Enregistrez le nom, la Base URL, la méthode, l’authentification, les en-têtes, le Path, la Query et le Body.
- Le code navigateur appelle uniquement un chemin same-origin ; les adresses Docker internes et les secrets restent côté serveur.
- Après le test, contrôlez état, latence et erreurs dans les données d’analyse et **Admin > Historique des appels API**.

## 13. Test du bot, évaluation, réapprentissage et analyse

- Dans le test du bot, vérifiez ensemble la réponse et le panneau d’analyse : étape appliquée, Score, entités, variables, carte de dialogue et réponse finale.
- Dans l’évaluation, examinez les phrases mal classées, les faibles Scores et les conflits d’intentions similaires avec le même jeu de référence.
- Lors du réapprentissage, n’intégrez que les phrases validées et vérifiez le résultat dans l’historique d’apprentissage.
- Dans l’analyse, distinguez absence de données, filtre incorrect et problème de collecte avant de modifier le modèle.

## 14. Administration système et tableau de bord d’exploitation

- Gérez utilisateurs, groupes, rôles, canaux, liaisons Botstation, modèles, licences et messages système multilingues dans Admin.
- Le tableau de bord montre API/DB, cache, latence, erreurs, verrous d’édition, séparation DB, GPU ML et GPU Semantic.
- Utilisez les historiques pour suivre bot, version, langue, énoncé, canal, heure et résultat sans exposer de secrets ni de données personnelles.

## 15. Liste de contrôle et exemple opérationnel

Avant une modification, notez UUID du bot, version, langue, version d’exploitation, ressources touchées, énoncés de référence et canaux connectés. Ensuite vérifiez sauvegarde, apprentissage/indexation, test du bot, évaluation, analyse, historiques dialogue/API/Queue et canal réel.

Exemple : créez un bot de suivi de livraison, ajoutez les intentions calendrier et état actuel, des énoncés multilingues et l’entité numéro de commande, connectez une carte API, apprenez ou indexez, puis ne réutilisez en réapprentissage que les échecs confirmés.

## Documents connexes

- [Voir tous les manuels CGA](../README.md)
- [Démarrer CGA](../cga-getting-started/README.md)
- [Guide d'utilisation CGA NLU](../cga-nlu-guide/README.md)
