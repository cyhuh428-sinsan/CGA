# Guide d'utilisation CGA NLU

Statut : création de contenu terminée, en attente de vérification de l'exécution
Cible : opérateurs de conception de robots/dialogues, experts en IA/NLU

Ce document sélectionne les moteurs `ML`, `Semantic` et `LLM` de CGA et organise les données, les paramètres, les tests et les méthodes d'amélioration de la qualité pour chaque moteur.

> Les options de moteur, de modèle et de méthode de réponse sur l'écran de création du bot ont été vérifiées dans le navigateur. Pour les éléments pour lesquels les résultats réels d'apprentissage, d'indexation et d'appel de modèle n'ont pas été confirmés, ne les considérez pas comme des confirmations opérationnelles, mais vérifiez également la [Table de vérification des fonctions](../cga-manual-verification-matrix.md).

## 1. Concepts de base du NLU

- Intention : unité de classification qui indique ce que demande l'énoncé de l'utilisateur.
- Phrases d'apprentissage : expressions utilisateur enregistrées pour apprendre l'intention ou être utilisées comme critères de recherche.
- Entité : valeur commerciale ou nom qui doit être extrait de l'énoncé.
- Dictionnaire : ressources pour l'interprétation des termes de domaine, des synonymes et des expressions utilisateur
- Seuil : critères minimaux pour accepter les résultats comme étant utilisables.
- Similitude : valeur qui indique à quel point les données d'entrée et les données candidates ont une signification proche.
- Moteur de réponse : zone permettant de sélectionner une réponse donnée ou de rechercher/créer une réponse en fonction des résultats de classification

## 2. Critères de sélection du moteur

| Catégorie | ML | Sémantique | L.L.M. |
|---|---|---|---|
| Méthode de base | Classification basée sur l'intention et les phrases d'apprentissage | Focus sur l'intégration et la recherche vectorielle | Modèle LLM et traitement basé sur des directives |
| données prêtes | Intention, phrase d'apprentissage, objet, dictionnaire | Intention ou connaissance de recherche, intégration·Vector DB | Intention, directive, fournisseur·Modèle |
| Un bon point de départ | Quand il y a une intention de travail et une gestion des phrases d'apprentissage distinctes | Lorsque vous devez rechercher une signification similaire même si les expressions sont différentes | Quand une analyse/génération et une exploitation de modèles basées sur LLM sont nécessaires |
| Vérification des clés | Exactitude, classification erronée, équilibre des phrases | Similitude de recherche, seuil, statut de l'index | Cohérence des réponses, respect des consignes, délai/coût |
| Principaux risques | Duplication d'intention, déséquilibre des données | Compatibilité d'intégration, incompatibilité d'index | Changement de modèle, impact rapide, écart de réponse |

Le modèle détaillé et l'état de support sont vérifiés en fonction des sélections disponibles sur l'écran de création du bot.

## 3. Procédures opérationnelles communes

1. Vérifiez le bot et la version.
2. Vérifiez la méthode et le modèle NLU.
3. Vérifiez la méthode de réponse.
4. Préparez la configuration des données ou de la connexion.
5. Exécute les tâches de formation, de création d'index et d'application de modèle.
6. Testez les énoncés représentatifs dans le simulateur.
7. Vérifier les résultats dans l'historique d'analyse/évaluation/dialogue.
8. Triez la cause, corrigez les données et testez à nouveau.

## 4. Principes communs du contrôle qualité

- Une phrase de formation contient une intention principale.
- Les intentions similaires incluent des noms, des verbes et des situations qui peuvent être distingués les uns des autres.
- Vérifiez l'équilibre pour éviter de surcharger les données à des fins spécifiques.
- Déterminez d'abord si les termes du domaine seront gérés en tant qu'objets ou dictionnaires.
- Les énoncés de test ne répètent pas seulement les mêmes expressions que les phrases d'entraînement.
- Améliorez d'abord les paires d'intentions avec des erreurs de classification répétées dans les résultats de l'analyse.

### 4.2 Règles de rédaction des phrases d'apprentissage

Remarque Lorsque vous appliquez les principes du guide NLU aux données opérationnelles CGA, utilisez la séquence suivante :

1. Nommez l'intention pour indiquer le but de la tâche.
2. Une seule requête principale est incluse dans une phrase de formation.
3. Préparez la même intention avec un ordre des mots, un ton et une expression différents.
4. Ne vous contentez pas de multiplier les mots qui chevauchent d'autres intentions, incluez le contexte et les actions qui distinguent l'intention.
5. N'enregistrez pas de phrases identiques ou presque identiques à plusieurs reprises.
6. Comparez chaque intention pour vous assurer que les phrases ne sont pas concentrées uniquement sur une intention spécifique.

Par exemple, lorsque vous divisez `Consulter les jours de congé restants` et `Comment demander un congé`, plutôt que d'inclure le mot `Congé` dans les deux intentions, préparez des expressions qui révèlent les critères de division, telles que `Jours restants` et `Procédure de demande`.

### 4.3 Règles de création de données d'assurance qualité/connaissances

Lors de la préparation d'une assurance qualité ou de connaissances basées sur des documents, soyez clair sur la portée des questions et des réponses.

- Les questions sont rédigées dans des expressions que les utilisateurs réels peuvent saisir.
- Les réponses doivent être rédigées en réponse directe à la question et ne pas mélanger plusieurs sujets dans une seule réponse.
- Pour les données basées sur un document, la structure du texte d'origine est organisée de manière à conserver la distinction entre le titre et le corps.
- Si le tableau ou la liste est important, assurez-vous que la signification est conservée après la conversion.
- Lors de la révision d'un document, vérifiez l'état de la demande pour vous assurer que les documents existants et les nouveaux ne sont pas recherchés en même temps.

Les opérations détaillées de téléchargement, de recherche et d'indexation du contrôle qualité peuvent varier en fonction de l'écran CGA et des paramètres de fonctionnement, de sorte que l'étendue réelle de la prise en charge est confirmée sur la base du [Tableau de vérification des fonctions](../cga-manual-verification-matrix.md).

### 4.1 Dossiers d'inspection opérationnelle

Lorsque vous modifiez les paramètres du moteur ou les données d'entraînement, enregistrez les éléments suivants.

- Bots et versions
- Méthode NLU, modèle, méthode de réponse avant et après changement
- Modification de l'intention/de l'objet/du dictionnaire/du contrôle qualité ou des paramètres de connexion
- Opérations d'apprentissage/indexation/application exécutées et état de l'écran
- Énoncés représentatifs de réussite et d'échec
- Résultats du simulateur/analyse/évaluation avant et après changement

Sans cet enregistrement, il est difficile de séparer les effets des changements de moteur des effets des changements de données.

## 5. Guide pour chaque moteur

- [Utilisation du moteur ML](#6-utilisation-du-moteur-ml)
- [Utilisation du moteur sémantique](#7-utilisation-du-moteur-sémantique)
- [Utilisation du moteur LLM](#8-utilisation-du-moteur-llm)

## 6. Utilisation du moteur ML

### 6.1 Paramètres

Les éléments identifiés comme modèles ML dans l'écran actuel sont DeepLearning Lite, TF-IDF Linear et Keyword Baseline. L'état réel de la connexion d'apprentissage est vérifié avec les paramètres d'état et de version sélectionnables.

### 6.2 Écriture de données

- Préparez des expressions représentatives et diverses expressions pour chaque intention.
- Contient une seule intention par instruction.
- Les intentions qui nécessitent une distinction, telles que les requêtes de méthode et d'erreur, ne mélangent pas les expressions.
- Vérifiez le nombre de phrases pour chaque intention et la diversité des expressions.

### 6.3 Tests et améliorations

1. Préparez respectivement des énoncés représentatifs et des énoncés limites.
2. Vérifiez les résultats dans le simulateur.
3. Recherchez les intentions de classification erronées et les expressions répétées dans l'écran d'analyse/évaluation.
4. Corrigez les données pour révéler les différences entre les intentions concurrentes.
5. Entraînez-vous à nouveau et répétez le même test.

### 6.4 Précautions

Nous ne présumons pas que la qualité s'améliorera automatiquement en augmentant simplement le nombre de phrases de formation. Plutôt que de simples changements de suffixe, nous ajoutons des expressions clés qui distinguent l'intention et diverses expressions des utilisateurs réels.

Vérifiez avant de modifier ML :

1. En une phrase, expliquez les critères permettant de les distinguer de l'intention concurrentielle.
2. Vérifiez si chaque intention a une expression représentative, une expression variante ou une expression limite.
3. Vérifiez qu'il n'y a pas de phrases d'apprentissage qui mélangent plusieurs intentions dans une seule phrase.
4. Testez à nouveau si les énoncés réussis avant le changement sont conservés après le changement.

## 7. Utilisation du moteur sémantique

### 7.1 Type

- `Semantic - Vector Worker` : Type utilisant le modèle de base CGA Vector Worker et la base de données vectorielle locale
- `Semantic - External Embedding` : Type connectant l'intégration externe et la base de données vectorielle locale

### 7.2 Paramètres

Lorsque vous sélectionnez Semantic NLU, les paramètres de connexion Intent Vector DB s'affichent. Dans le type d'intégration externe, l'adresse API de recherche, l'entrée de sélection de clé API et le nom d'index peuvent être utilisés. Le type Vector Worker par défaut résout la connexion par défaut et le nom de l'index.

### 7.3 Sélection du modèle

Le code actuel définit des options d'intégration externes, notamment `ko-sroberta` pour les documents généraux coréens, `multilingual-e5` pour les documents/tableaux/formats multilingues et `bge-m3` pour les documents/termes longs. La sélection opérationnelle réelle est une vérification conjointe des caractéristiques du document, de la connectivité opérationnelle et de la compatibilité d'intégration.

### 7.4 Tests et améliorations

1. Préparez des questions et des expressions représentatives.
2. Vérifiez si les données d'intention ou de connaissances sont reflétées dans la base de données vectorielle.
3. Dans le simulateur, les expressions ayant la même signification et les expressions ayant des significations différentes sont testées séparément.
4. Vérifiez les résultats de la recherche, la similarité, le seuil et l'état de l'index.
5. Si la recherche ne correspond pas, vérifiez la combinaison de données, d'intégration et d'index.

> L'état d'achèvement de l'indexation et l'écran des résultats de recherche doivent être confirmés après la vérification du navigateur/de l'exécution.

Vérifiez avant de modifier la sémantique :

1. Vérifiez que le modèle d'intégration et les données recherchées sont compatibles.
2. Vérifiez que le nom de l'index et la cible de connexion correspondent à la version actuelle du bot.
3. Si vous utilisez une API de recherche externe, vérifiez auprès de votre administrateur les spécifications de réponse et les paramètres d'authentification.
4. Les résultats avant la mise à jour de l'index ne sont pas interprétés comme la qualité des nouvelles données.

## 8. Utilisation du moteur LLM

### 8.1 Paramètres

Si vous sélectionnez Moteur LLM, vous pouvez définir le fournisseur LLM et le modèle détaillé pour chaque fournisseur. Les choix de fournisseurs confirmés à l'écran sont Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama et OpenRouter. Par exemple, si vous sélectionnez ChatGPT, vous verrez `GPT-4o mini (Par défaut)` et `GPT-4o (Haute qualité)`. La liste des fournisseurs et des modèles peut varier en fonction de vos paramètres d'exploitation, et si vous utilisez Ollama, vous pouvez voir des entrées d'adresse distinctes.

### 8.2 Instructions et méthodes de réponse

Les LLM doivent examiner ensemble la sélection du modèle NLU et la sélection de la méthode de réponse.

- Réponses du moteur LLM : comment LLM génère des réponses
- Réponse RAG du moteur LLM : Comment utiliser les connaissances récupérées et le LLM ensemble
- Réponses définies : Comment utiliser les réponses prédéfinies

Les instructions documentent clairement le ton, le format de réponse et les limites. Après avoir modifié une directive, nous comparons les réponses de cohérence et d'exception avec le même ensemble de tests.

### 8.3 Tests et améliorations

1. Préparez des questions représentatives, des questions ambiguës et des questions interdites ou d'exception.
2. Fournisseur de correctifs et modèle détaillé.
3. Répétez la même saisie pour vérifier la cohérence de la réponse.
4. Vérifiez le respect de la directive et le fondement de votre réponse.
5. Enregistre les retards, les coûts et les réponses aux échecs.

Les résultats réels des appels et des réponses du fournisseur doivent être vérifiés séparément dans un environnement de type opérationnel. Dans le robot de vérification ML, la demande d'apprentissage a été enregistrée dans la file d'attente, mais n'a pas été complétée, et le simulateur a renvoyé une intention non classifiée sans phrases d'apprentissage.

Vérifier avant changement de LLM :

1. Enregistrez le fournisseur et le modèle détaillé avant et après les modifications.
2. Comparez en utilisant la même méthode de saisie/instruction/réponse.
3. Vérifiez séparément le réalisme, la conformité du format, les réponses interdites et les réponses d'échec.
4. Si les retards ou les coûts sont importants, documentez-les avec des résultats de qualité.

## 9. Analyse et amélioration de la qualité

L'écran d'analyse vérifie les résultats cumulés de la classification et les étapes appliquées. Les étapes de classification actuellement affichées à l'écran peuvent inclure l'exclusion/l'ignorance, les petites discussions, la correspondance exacte, la règle, le ML, la sémantique, le LLM, etc.

Séquence d'amélioration de la qualité :

1. Collectez les énoncés ayant échoué.
2. Vérifiez les étapes de classification réellement appliquées.
3. Isolez le domaine dans lequel se situe le problème : intention, recherche, directive ou réponse.
4. Correction de la plage minimale de données.
5. Retestez ensemble les énoncés réussis et échoués existants.

### 9.1 Configuration de l'ensemble de test

Lors du changement de moteur ou de la modification de données, n'utilisez pas un seul énoncé de test.

| ensemble de tests | Objectif | Exemples de normes |
|---|---|---|
| Discours représentatif | Vérifiez le chemin d'utilisation principal normal | Expressions fréquemment utilisées |
| Énonciation modifiée | Vérifier le traitement des modifications d'expression | Modifications de l'ordre des mots, du ton de la voix et de l'espacement |
| énoncé de frontière | Assurer la distinction par rapport à l'intention concurrentielle | Autres demandes avec des mots similaires |
| énoncé d'exception | Vérifier le traitement des demandes non prises en charge/ambiguës | Questions qui ne font pas partie de l'intention |
| énoncé récursif | Confirmer le maintien des résultats de réussite avant le changement | Énonciation déjà réussie |

Vous devez utiliser le même ensemble avant et après le changement pour comparer les effets des changements de moteur ou des suppléments de données. Les résultats des tests sont enregistrés avec le bot, la version, le moteur, le modèle et la méthode de réponse.

## 10. Réponse à l'erreur

| Symptômes | Vérifiez d'abord | Action suivante |
|---|---|---|
| Non classé comme intention attendue | Bot · Version · Moteur · État des données | Examiner ensemble les énoncés représentatifs/limites et les intentions concurrentielles |
| Sémantique Aucun résultat trouvé | Base de données vectorielle, index, compatibilité d'intégration | Vérifier l'état de connexion/index/réflexion des données |
| Les réponses du LLM vacillent | Fournisseur, modèle, directive, entrée | Comparez avec le même ensemble de tests et affinez les directives |
| Statut d'études ou de préparation non terminé | Historique d'apprentissage, messages d'erreur, combinaisons de sélection | Enregistrer l'état de l'écran et communiquer au personnel des opérations |

Cas observés dans les robots ML de validation :

- Symptôme : la demande d'apprentissage est enregistrée dans la file d'attente, mais reste à `Non entraîné` après l'actualisation
- Résultats du simulateur : `Intention non classée`, `Impossible de classer les intentions car aucune phrase d’entraînement n’est disponible.`
- Jugement : la sauvegarde réussie des phrases de formation et l'achèvement de la formation ML sont des états distincts, de sorte que la qualité de la classification n'est pas évaluée avant la fin de la formation.
- Action : Vérifiez l'état d'achèvement de l'historique d'apprentissage et, s'il n'y a pas d'historique, envoyez le bot, la version, le moteur et demandez l'heure au responsable des opérations.

N'ajustez pas l'état en modifiant directement la base de données ou la CLI. Le bot, la version, le moteur, le message d'erreur et l'heure d'apparition à l'écran sont enregistrés et transmis au responsable des opérations.

## Documents connexes

- [Voir l'intégralité du manuel CGA](../README.md)
- [Démarrer CGA](../cga-getting-started/README.md)
- [Manuel d'utilisation CGA](../cga-user-manual/README.md)
- [Tableau de comparaison des moteurs](engine-comparison.md)
- [Tableau de vérification des fonctions](../cga-manual-verification-matrix.md)
