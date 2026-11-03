# Exploitation des connexions aux canaux externes

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. Périmètre et limites de vérification

Ce guide décrit le nouveau panneau Teams, Slack, Discord, Telegram, Google Chat et LINE sans remplacer les parcours Webchat, Kakao, Teams ou la création des bots existants. Il concerne un candidat de développement confronté au code et aux tests synthétiques. Consoles réelles, comptes/secrets réels, échanges externes, aptitude à la production et recette utilisateur restent **non vérifiés**. Les préparatifs ci-dessous sont à confirmer par un responsable autorisé, et non des opérations déjà exécutées.

## 2. Prérequis

- Le responsable confirme commit/image exacts, sauvegarde/retour arrière et autorisations. Les utilisateurs ne manipulent pas directement la DB ou la CLI.
- `CHANNEL_CONNECTION_WORKER_ENABLED=false` par défaut. Enregistrer/vérifier ne contacte aucun service externe. Activation et connexion réelle exigent une autorisation distincte.
- `CHANNEL_CONNECTION_ENCRYPTION_KEY` doit encoder **32 octets** en Base64 ; `CHANNEL_CONNECTION_KEY_VERSION` vaut `v1` par défaut. Ne jamais exposer les valeurs dans captures, Git ou journaux. Clé absente/endommagée ou AAD incorrect : échec fermé, sans connexion externe.
- Le packet bridge API nécessite **Node 22**, les fichiers de conversion partagés et un `CHANNEL_CONNECTION_NODE_BINARY` exécutable. Un autre Node local ne prouve pas le fonctionnement de l’image Node22.
- Le responsable vérifie les migrations additives `20260720_0027` → `20261103_0028` → `20261103_0029` → `20261103_0030` sur une cible approuvée : ajout des tables connexion, lease, correspondance de salons, delivery, sans transfert des anciens enregistrements. La DB de production exige une approbation distincte.
- Organisation, groupe, bot de réponse et canal parent doivent être actifs, avec une version de bot exécutable. Vérifier les droits d’administrateur d’organisation et de gestion d’application externe.

## 3. Enregistrer, connecter et déconnecter

1. Administrateur : ouvrir `Admin > Gestion des canaux`, confirmer le type existant et son état actif, puis `Connexions` sur la ligne compatible.
2. `Ajouter une connexion` : nom, bot, ID d’installation/espace, compte bot externe, salon/canal selon §4. Ne pas remplacer les ID par un nom affiché ou un lien d’invitation.
3. Saisir uniquement les champs d’identifiants affichés, puis enregistrer. Ils sont obligatoires à la création. À la modification, les champs vides conservent les valeurs et les autres sont fusionnés. Ne pas saisir « Enregistrés », étoiles ou masques comme secrets. Les secrets enregistrés ne sont pas réaffichés.
4. `Vérifier les paramètres`, consulter l’heure et l’erreur : contrôle de forme, champs requis et ressources actives, pas d’identité/droits externes. « Paramètres valides · accès externe non vérifié » n’est pas une connexion réussie.
5. Après autorisation de communication et préparation du serveur, `Connecter`. D’abord `Connexion en cours`, puis vérification identité/cible/scope exclusif par le worker. Teams/Google Chat/LINE requièrent aussi le premier événement cible authentifié. Envoyer une seule question autorisée, rouvrir le panneau et comparer état et réponse réelle. La première question est conservée pour traitement.
6. Avant modification/suppression, `Déconnecter` et confirmer `Déconnecté`. Même en erreur, déconnecter si la demande reste active. La suppression est logique et conserve l’historique. Un parent ayant des connexions ne peut pas librement changer de provider ou être supprimé.

## 4. ID et champs d’identifiants

| Provider | installation_id | account_id | target_id | Obligatoires / facultatifs |
|---|---|---|---|---|
| Teams (`ms_teams`) | UUID tenant | UUID client de l’app | ID canal Teams, sinon conversation | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | ID workspace/team | ID **utilisateur** du bot | ID conversation accessible | `bot_token`, `app_token` / `signing_secret` facultatif |
| Discord (`discord`) | ID guild ou `DM` en tête-à-tête | ID utilisateur bot | ID canal/thread/DM | `bot_token` |
| Telegram (`telegram`) | ID numérique utilisateur bot | même ID numérique bot | ID chat private/group/supergroup | `bot_token` |
| Google Chat (`google_chat`) | **Project Number** numérique | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / `project_id` concordant facultatif |
| LINE (`line`) | ID utilisateur bot `U`+32 chiffres hex minuscules | même ID bot | user `U…` / group `C…` / room `R…` | `access_token`, `channel_secret` |

Les ID externes sont aussi sensibles : ne pas publier leurs valeurs dans documentation, erreurs, journaux ou PR. Les accolades sont explicatives et ne doivent pas être enregistrées telles quelles. Les autres champs d’identifiants sont rejetés.

## 5. Préparer et vérifier Teams

Le responsable habilité confirme tenant/client/secret Bot Connector, activation du canal Teams et installation de l’app dans la cible. Tenant/client doivent correspondre au tableau. Callback HTTPS approuvé : `/api/v1/channel-connections/ms-teams/events` ; `https://example.com/api/v1/channel-connections/ms-teams/events` est seulement un exemple réservé.

Un token OAuth ne suffit pas à devenir connecté. Signature JWT Microsoft, issuer, audience, tenant/app, service URL authentifiée et activity cible doivent correspondre. Envoyer la première activity authentifiée adressée au bot ; vérifier conservation de la question, une réponse CGA, bonne conversation. Une mauvaise authentification/tenant/cible ne doit rien exécuter. En cas d’échec : déconnecter, vérifier installation/ID/endpoint, puis tester une nouvelle question. [Documentation Teams officielle](https://learn.microsoft.com/en-us/microsoftteams/platform/).

## 6. Préparer et vérifier Slack

Préparer un bot token et un **app-level token distinct** du même app/workspace. Le second nécessite `connections:write` ; activer Socket Mode et les événements/interactions nécessaires. Confirmer `chat:write`, `bots:read`, lecture des conversations concernées (`channels:read`, `groups:read`, `im:read`, etc.) et abonnements mention/message. Changer les scopes/réinstaller nécessite les autorisations appropriées. Inviter le bot dans une cible non archivée.

Réception outbound Socket Mode, sans callback public. App ID, bot ID et bot user ID diffèrent ; account reçoit le bot user ID. `signing_secret` facultatif ne crée pas de récepteur HTTP public signé. Tester DM/mention, réponse dans le thread, choix et absence de doublon. Pour `SLACK_IDENTITY_VERIFICATION_FAILED`, `missing_scope`, `not_in_channel`, déconnecter et vérifier identité/droits/appartenance. Le scope app est exclusif : aucun récepteur concurrent. [Socket Mode officiel](https://docs.slack.dev/apis/events-api/using-socket-mode/).

## 7. Préparer et vérifier Discord

Installer le bot dans la guild ; contrôler les permissions effectives/overwrites : View Channel, Send Messages (Send Messages in Threads pour threads), Embed Links si nécessaire. Un thread privé nécessite l’appartenance du bot ; threads archivés/verrouillés refusés. En tête-à-tête, utiliser le vrai ID du canal DM et installation `DM`, pas les group DM.

Gateway sans callback public ; intents Identify actuels `4609` (`GUILDS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`), sans `MESSAGE_CONTENT`. Ne pas promettre la lecture de tout message ordinaire. Tester mention/DM et choix de cartes avec la vraie configuration, sans élargir arbitrairement les droits. Vérifier mauvais guild/channel/account, accès refusé et reconnexion/resume sans doublon. Scope app exclusif ; déconnecter avant correction. [Gateway/intents officiels](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx).

## 8. Préparer et vérifier Telegram

Confirmer token, ID bot numérique et ID chat. Installation/account utilisent le même ID numérique bot, pas son username. En privé l’utilisateur démarre la conversation ; en group/supergroup vérifier appartenance et droits d’envoi/photos si utilisées. Broadcast channels exclus. Tester mention/commande/reply selon la confidentialité réelle.

`getUpdates` long polling, sans callback ni poller concurrent. Un webhook existant bloque avec `TELEGRAM_WEBHOOK_EXISTS` : **aucune suppression automatique**. Vérifier d’abord impact sur l’existant et autorisation de transition. Tester question privée/groupe adressée au bot, choix, réponse, récupération offset et déduplication. Déconnecter arrête le polling, sans bascule webhook ni suppression automatique du backlog. [Bot API officielle](https://core.telegram.org/bots/api#getupdates).

## 9. Préparer et vérifier Google Chat

Utiliser une **app HTTP Chat, pas un Google Workspace add-on**, audience **Project Number JWT**. URL-audience ID token et payload add-on ne sont pas pris en charge. Callback `/api/v1/channel-connections/google-chat/events`. Distinguer Project Number numérique, project ID texte, bot `users/{bot-id}` et space `spaces/{space-id}`.

Préparer le JSON RSA service-account du même projet (type, project_id, client_email, private_key_id, private_key, token_uri Google fixe). `project_id` facultatif doit correspondre au JSON. Le responsable confirme Chat API, consultation projet, scopes OAuth `chat.bot`, `cloudplatformprojects.readonly`, droit de lecture des métadonnées projet et présence de l’app dans le space. Ni email de service account ni project ID dans account.

Même après vérification projet actif/numéro et space, le premier événement cible signé Google est nécessaire. Signature, issuer, audience numérique exacte, bot/space et sender de réponse doivent être vérifiés. Tester DM/mention, réponse thread, valeur réelle du choix et déduplication. Ne pas ignorer `GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`, `GOOGLE_CHAT_TARGET_VERIFICATION_FAILED`, `GOOGLE_CHAT_SENDER_VERIFICATION_FAILED` : déconnecter puis investiguer. Confirmer scope projet exclusif et impact sur les apps existantes. [Vérification officielle](https://developers.google.com/workspace/chat/verify-requests-from-chat).

## 10. Préparer et vérifier LINE

Préparer access token, channel secret Messaging API/Official Account et **bot user U-ID** des informations bot. Installation/account utilisent tous deux cet U-ID, **pas le channel ID numérique** de la console. Cible user U-ID, group C-ID ou room R-ID ; confirmer amitié/appartenance, droits d’envoi, réception des groupes et risque de double réponse dû aux réponses automatiques existantes.

Callback `/api/v1/channel-connections/line/events`. Le proxy ne doit pas transformer le body : HMAC `X-Line-Signature` vérifié sur les **octets bruts avant parsing JSON**. L’identité Bot API seule ne suffit pas ; premier événement cible signé valide requis. Tester texte, choix postback, redelivery traitée une fois et signature invalide sans exécution.

Reply token à usage unique ; fenêtre prudente de **moins de 55 secondes** après réception, et redelivery **moins de 20 minutes** depuis l’événement d’origine. Le délai officiel n’est pas une garantie de latence. Ne pas réessayer automatiquement un envoi expiré/incertain avec push/nouveau token. Réémettre channel secret invalide les signatures existantes et exige analyse d’impact/approbation séparée. [Signature officielle](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [Règles reply](https://developers.line.biz/en/reference/messaging-api/#send-reply-message).

## 11. États et erreurs

| État/code | Sens et action |
|---|---|
| `disconnected` / `connecting` / `connected` / `disconnecting` / `error` | État observé, distinct de l’acceptation/vérification ; connected ne prouve pas échange complet ou recette. |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | Faire restaurer clé/version/chiffrement par le responsable ; ne pas afficher/remplacer arbitrairement. |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | Vérifier champs requis/noms/ID ; enregistrer ne valide pas le provider. |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | Vérifier doublon ou déconnecter d’abord ; pas de suppression aveugle. |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | Faire contrôler worker/Node bridge ; aucun contournement. |
| `LEASE_EXPIRED`, erreurs scope/identity | Rouvrir la liste, transmettre code/heure/preuves expurgées ; ne pas modifier lease/fence en DB. |
| 401/403, 413, 422, receiver disabled 503 | Contrôler authentification/signature/body, taille, format, serveur ; HTTP 200 ne prouve pas une réponse bot. |

L’UI peut afficher seulement un code sûr/une erreur générique. Ne pas publier d’erreur API externe brute. Rouvrir le panneau plutôt que supposer un rafraîchissement automatique.

## 12. Arrêt sûr, récupération et limites

Déconnecter pour arrêter les nouveaux travaux ; le responsable peut remettre worker à `false`. Impossible de garantir l’annulation d’un HTTP distant déjà lancé. Delivery `unknown` signifie résultat incertain : **pas de réexécution/renvoi automatique ni suppression du registre**. Le panneau n’a pas d’outil de retraitement unknown. Un opérateur compare en privé registre interne et preuves provider puis obtient une décision distincte. Reconnecter n’autorise pas à rejouer un ancien unknown.

Désactiver le worker avant un revert normal du PR/commit vérifié. Downgrade autorisé seulement si les nouvelles tables sont vides. Des données connexion/runtime doivent provoquer un refus : ne pas forcer/supprimer, suivre le plan approuvé de sauvegarde/conservation. Supprimer une configuration n’efface pas toutes les conversations/deliveries.

Aucun outil automatique de rotation master key/version ou de rechiffrement. Le chiffrement dépend de la clé d’origine et de l’AAD organisation/connexion/version ; changer uniquement la clé d’environnement casse le déchiffrement. Rotation provider autorisée : déconnecter→modifier→vérifier→reconnecter ; nouvel événement d’identité parfois nécessaire. Effacement immédiat des caches mémoire credential/token, gestion de leur durée de vie, croissance/rétention à long terme des cursor/receipts restent des limites. Déconnecter/supprimer ne garantit pas leur disparition. Révocation urgente : plan processus/provider et approbation nécessaires.

## 13. Liste de vérification du candidat

| Provider | Preuve de développement | Plateforme réelle |
|---|---|---|
| Teams | Implémenté ; tests synthétiques JWT/native/packet | Non vérifiée |
| Slack | Implémenté ; Socket Mode/native synthétiques | Non vérifiée |
| Discord | Implémenté ; Gateway/native synthétiques | Non vérifiée |
| Telegram | Implémenté ; polling/native synthétiques | Non vérifiée |
| Google Chat | Implémenté ; JWT/native/choix synthétiques | Non vérifiée |
| LINE | Implémenté ; HMAC/native/reply-token synthétiques | Non vérifiée |

Ce tableau distingue uniquement les preuves Tasks 1–11. Consulter le dossier séparé du candidat pour API/Web complets, migrations, images Node22, skips et SHA exact. Ce n’est pas un PASS plateforme réelle.

- Le testeur autorisé réalise, par provider et dans l’UI réelle : enregistrer→vérifier→connecter→recevoir réellement→exécuter CGA→répondre→choisir→déconnecter/reconnecter.
- Contrôler authentification invalide, mauvaise cible/organisation, doublon/redelivery, redémarrage et timeout/unknown sans double exécution/envoi. Noter commit/image, heure, résultat/non vérifié, rollback, sans ID/Secret réels.
- Création/enregistrement de secrets réels, changement de droits, appels externes/coûts, DB production et déploiement Oracle/production nécessitent leurs approbations distinctes. Un bot LLM payant exige aussi modèle/nombre/budget/conditions d’arrêt. Ce guide n’autorise aucune exécution.

## 14. Correspondance avec le code

[UI](../../apps/web/components/channel-connections-panel.tsx), [champs](../../apps/web/lib/channel-connections-api.ts), [API admin](../../apps/api/app/api/routes/channel_connections.py), [chiffrement](../../apps/api/app/services/channel_connections.py), [récepteurs](../../apps/api/app/api/routes/channel_connection_events.py), [supervisor](../../apps/api/app/services/channel_connection_supervisor.py), [runtime](../../apps/api/app/services/channel_connection_runtime.py), [Teams](../../apps/api/app/services/channel_connection_teams.py), [Slack](../../apps/api/app/services/channel_connection_slack.py), [Discord](../../apps/api/app/services/channel_connection_discord.py), [Telegram](../../apps/api/app/services/channel_connection_telegram.py), [Google Chat](../../apps/api/app/services/channel_connection_google_chat.py), [auth Google](../../apps/api/app/services/channel_connection_google_chat_auth.py), [LINE](../../apps/api/app/services/channel_connection_line.py), [migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py), [configuration](../../apps/api/app/core/config.py).
