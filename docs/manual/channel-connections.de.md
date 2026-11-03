# Betrieb externer Kanalverbindungen

[한국어](channel-connections.md) · [English](channel-connections.en.md) · [简体中文](channel-connections.zh-CN.md) · [日本語](channel-connections.ja.md) · [Tiếng Việt](channel-connections.vi.md) · [Français](channel-connections.fr.md) · [Deutsch](channel-connections.de.md)

## 1. Umfang und Prüfgrenzen

Diese Anleitung beschreibt das neue Verbindungspanel für Teams, Slack, Discord, Telegram, Google Chat und LINE. Bestehende Webchat-, Kakao-, Teams- und Bot-Erstellungsabläufe bleiben erhalten. Die Anleitung zum Entwicklungskandidaten wurde mit Quellcode und synthetischen Tests abgeglichen. Echte Plattformoberflächen, Konten/Secrets, externe Nachrichten, Produktionsreife und Benutzerabnahme sind **ungeprüft**. Die folgenden Vorbereitungen sind Prüfaufgaben für autorisierte Personen, kein Nachweis bereits ausgeführter Konfiguration.

## 2. Voraussetzungen

- Verantwortliche bestätigen exakten commit/image, Sicherung/Rollback und Genehmigung. Benutzer bearbeiten DB/CLI nicht selbst.
- `CHANNEL_CONNECTION_WORKER_ENABLED=false` ist Standard. Speichern/Prüfen löst keine externen Aufrufe aus. Worker-Aktivierung und echte Verbindung erfordern gesonderte Freigabe.
- `CHANNEL_CONNECTION_ENCRYPTION_KEY` muss **32 Byte** in Base64 darstellen; `CHANNEL_CONNECTION_KEY_VERSION` ist standardmäßig `v1`. Werte niemals in Screenshots, Git oder Logs ablegen. Fehlender/beschädigter Schlüssel oder falsches AAD führt ohne externe Verbindung zum Fehler.
- Die API-Packet-Bridge benötigt **Node 22**, gemeinsame Konvertierungsdateien und ein ausführbares `CHANNEL_CONNECTION_NODE_BINARY`. Tests mit einem anderen lokalen Node ersetzen keinen Node22-Image-Nachweis.
- Verantwortliche prüfen additive Migrationen `20260720_0027` → `20261103_0028` → `20261103_0029` → `20261103_0030` auf freigegebenem Ziel. Nur Verbindungs-, Lease-, Raumzuordnungs- und Delivery-Tabellen kommen hinzu; bestehende Datensätze werden nicht übertragen. Produktions-DB separat freigeben.
- Organisation, Gruppe, Antwort-Bot und Elternkanal müssen aktiv sein; eine ausführbare Bot-Version ist nötig. Organisationsadmin- und Plattform-App-Verwaltungsrechte prüfen.

## 3. Registrieren, verbinden und trennen

1. Als Administrator `Admin > Kanalverwaltung` öffnen, bestehenden Kanaltyp und Aktivstatus prüfen, bei unterstützter Zeile `Verbindungen` öffnen.
2. `Verbindung hinzufügen`: Name, Antwort-Bot, Installations-/Workspace-ID, externes Bot-Konto und Raum-/Kanal-ID nach Abschnitt 4. Anzeigenamen/Einladungslinks sind keine IDs.
3. Nur angezeigte Zugangsdatenfelder ausfüllen und speichern. Erstmalig sind Zugangsdaten nötig. Beim Bearbeiten behalten leere Felder den alten Wert, nichtleere werden zusammengeführt. „Registriert“, Sterne und Maskierungen sind keine Secrets. Gespeicherte Secrets werden nicht erneut angezeigt.
4. `Einstellungen prüfen`, Zeit und Fehler ansehen. Geprüft werden Format, Pflichtfelder und aktive Ressourcen, nicht externe Identität/Rechte. „Einstellungen gültig · externer Zugriff ungeprüft“ ist kein Verbindungserfolg.
5. Nach Freigabe echter Kommunikation und Servervorbereitung `Verbinden`. Zunächst `Verbindung wird hergestellt`; der Worker prüft Identität, Ziel und exklusiven Scope. Teams/Google Chat/LINE benötigen zusätzlich das erste authentifizierte Zielereignis. Eine freigegebene Testfrage einmal senden, Panel erneut öffnen, Zustand und echte Antwort vergleichen. Auch die erste Frage bleibt zur Verarbeitung erhalten.
6. Vor Bearbeiten/Löschen `Trennen` und `Getrennt` bestätigen. Auch Fehlerzeilen mit aktivem Verbindungswunsch trennen. Löschen ist Soft-Delete der Einstellung; Verlauf bleibt erhalten. Eltern mit Verbindungszeilen können Provider nicht beliebig ändern oder gelöscht werden.

## 4. IDs und Zugangsdatenfelder

| Provider | installation_id | account_id | target_id | Pflicht / optional |
|---|---|---|---|---|
| Teams (`ms_teams`) | Tenant-UUID | App-Client-UUID | Teams-Kanal-ID, sonst Conversation-ID | `tenant_id`, `client_id`, `client_secret` |
| Slack (`slack`) | Workspace/Team-ID | Bot-**Benutzer**-ID | zugängliche Conversation-ID | `bot_token`, `app_token` / optional `signing_secret` |
| Discord (`discord`) | Guild-ID oder `DM` bei 1:1 | Bot-Benutzer-ID | Kanal/Thread/DM-ID | `bot_token` |
| Telegram (`telegram`) | numerische Bot-Benutzer-ID | gleiche numerische Bot-ID | Private/Group/Supergroup-Chat-ID | `bot_token` |
| Google Chat (`google_chat`) | numerische **Project Number** | `users/{bot-id}` | `spaces/{space-id}` | `service_account_json` / optional passendes `project_id` |
| LINE (`line`) | Bot-Benutzer-ID `U`+32 kleine Hex-Zeichen | gleiche Bot-ID | User `U…` / Group `C…` / Room `R…` | `access_token`, `channel_secret` |

Auch externe IDs sind sensible Betriebsdaten: keine echten Werte in öffentliche Dokumente, Fehler, Logs oder PRs kopieren. Geschweifte Klammern kennzeichnen Erklärungsplatzhalter, nicht speicherbare Werte. Andere Zugangsdatenfelder werden abgewiesen.

## 5. Teams vorbereiten und prüfen

Autorisierte Personen prüfen Bot-Connector-Tenant/Client/Secret, Teams-Kanalaktivierung und App-Installation im Ziel. Tenant/Client der Zugangsdaten müssen der Tabelle entsprechen. Freigegebener HTTPS-Callback-Pfad: `/api/v1/channel-connections/ms-teams/events`; `https://example.com/api/v1/channel-connections/ms-teams/events` ist nur ein reserviertes Beispiel.

Ein OAuth-Token allein bedeutet nicht verbunden. Microsoft-JWT-Signatur, Issuer, Audience, Tenant/App, authentifizierte Service-URL und Ziel-Activity müssen passen. Erste authentifizierte Bot-Anfrage senden; erhaltene Erstfrage, genau eine CGA-Antwort und richtige Konversation prüfen. Ungültige Authentifizierung/Tenant/Ziel darf nichts ausführen. Bei Fehler trennen, Installation/IDs/Endpoint prüfen, dann neue Frage testen. [Offizielle Teams-Dokumentation](https://learn.microsoft.com/en-us/microsoftteams/platform/).

## 6. Slack vorbereiten und prüfen

Bot-Token und **separates App-Level-Token** derselben App/Workspace vorbereiten. App-Token braucht `connections:write`; Socket Mode und notwendige Ereignisse/Interaktionen aktivieren. Bot-Rechte für den Einsatzzweck prüfen: `chat:write`, `bots:read`, passende Conversation-Leserechte (`channels:read`, `groups:read`, `im:read` usw.) und Mention/Message-Abonnements. Scope-Änderungen/Neuinstallation brauchen entsprechende Freigabe. Bot ins nicht archivierte Ziel einladen.

Empfang per Outbound Socket Mode, kein öffentlicher Callback. App-ID, Bot-ID, Bot-Benutzer-ID unterscheiden; Account nutzt Bot-Benutzer-ID. Optionales `signing_secret` bedeutet keinen neuen öffentlichen signierten HTTP-Empfänger. DM/Mention, Thread-Antwort, Auswahl und einmalige Antwort bei Duplikaten prüfen. Bei `SLACK_IDENTITY_VERIFICATION_FAILED`, `missing_scope`, `not_in_channel` trennen, Identität/Rechte/Mitgliedschaft prüfen. App-Scope exklusiv, keine konkurrierenden Empfänger. [Offizieller Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/).

## 7. Discord vorbereiten und prüfen

Bot in Guild installieren; effektive Rechte inklusive Overwrites prüfen: View Channel, Send Messages (Threads: Send Messages in Threads), gegebenenfalls Embed Links. Private Threads brauchen Bot-Mitgliedschaft; archivierte/gesperrte Threads werden abgelehnt. Bei 1:1 echte DM-Kanal-ID und Installation `DM` verwenden; Gruppen-DMs sind ausgeschlossen.

Empfang per Gateway, ohne öffentlichen Callback. Aktuelle Identify-Intents: `4609` (`GUILDS`, `GUILD_MESSAGES`, `DIRECT_MESSAGES`), ohne `MESSAGE_CONTENT`. Kein Versprechen, sämtliche gewöhnlichen Nachrichteninhalte zu lesen. Mention/DM und Kartenauswahl mit realer App-Konfiguration prüfen, Rechte nicht eigenmächtig erweitern. Falsche Guild/Kanal/Account, Zugriffsfehler und Reconnect/Resume ohne doppelte Antwort prüfen. App-Scope exklusiv; vor Korrektur trennen. [Offizielles Gateway/Intents](https://github.com/discord/discord-api-docs/blob/main/developers/events/gateway.mdx).

## 8. Telegram vorbereiten und prüfen

Bot-Token, numerische Bot-ID und Ziel-Chat-ID bestätigen. Installation/Account sind dieselbe numerische Bot-ID, nicht Username. Privat muss der Benutzer den Chat beginnen; in Group/Supergroup Mitgliedschaft, Sende- und nötige Fotorechte prüfen. Broadcast Channels sind ausgeschlossen. Mention/Befehl/Reply-Empfang gemäß realen Privacy-Einstellungen prüfen.

`getUpdates`-Long-Polling, kein Callback und kein paralleler Poller. Bestehender Webhook blockiert mit `TELEGRAM_WEBHOOK_EXISTS`, **wird nicht automatisch gelöscht**. Erst Auswirkungen und Umstellung freigeben. Private oder an den Bot gerichtete Gruppenfrage, Auswahl, Antwort, Offset-Wiederherstellung und Deduplizierung prüfen. Trennen stoppt Polling, schaltet keinen Webhook um und löscht keinen Backlog automatisch. [Offizielle Bot API](https://core.telegram.org/bots/api#getupdates).

## 9. Google Chat vorbereiten und prüfen

Eine **HTTP-Chat-App, kein Google Workspace Add-on**, mit Audience **Project Number JWT** verwenden. URL-Audience-ID-Token/Add-on-Payloads sind nicht unterstützt. Callback `/api/v1/channel-connections/google-chat/events`. Numerische Project Number, textuelle Project-ID, Bot `users/{bot-id}`, Space `spaces/{space-id}` unterscheiden.

RSA-Service-Account-JSON desselben Projekts bereitstellen (type, project_id, client_email, private_key_id, private_key, feste Google token_uri). Optionales `project_id` muss zum JSON passen. Verantwortliche prüfen Chat API, Projektabfrage, OAuth-Scopes `chat.bot`, `cloudplatformprojects.readonly`, Projekt-Metadatenleserechte und App im Space. Keine Service-Account-E-Mail oder Project-ID als Account verwenden.

Nach aktivem Projekt-/Nummer- und Space-Nachweis ist noch das erste Google-signierte Zielereignis erforderlich. Signatur, Issuer, exakte numerische Audience, Bot/Space sowie Antwort-Sender prüfen. DM/Space-Mention, Thread-Antwort, tatsächlichen Kartenauswahlwert und Deduplizierung testen. `GOOGLE_CHAT_PROJECT_VERIFICATION_FAILED`, `GOOGLE_CHAT_TARGET_VERIFICATION_FAILED`, `GOOGLE_CHAT_SENDER_VERIFICATION_FAILED` nicht ignorieren: trennen und untersuchen. Exklusiven Projekt-Scope und bestehende Apps beachten. [Offizielle Anfrageprüfung](https://developers.google.com/workspace/chat/verify-requests-from-chat).

## 10. LINE vorbereiten und prüfen

Access Token, Channel Secret von Messaging API/Official Account und **Bot-Benutzer-U-ID** aus Bot-Informationen vorbereiten. Installation/Account nutzen beide diese U-ID, **nicht die numerische Channel-ID** der Konsole. Ziel ist User-U-ID, Group-C-ID oder Room-R-ID. Freundschaft/Mitgliedschaft, Senderechte, Gruppenempfang und mögliche Doppelantworten bestehender Auto-Replies prüfen.

Callback `/api/v1/channel-connections/line/events`. Proxy darf Body nicht verändern: `X-Line-Signature`-HMAC wird über **Originalbytes vor JSON-Parsing** geprüft. Bot-API-Identität allein genügt nicht; erstes gültig signiertes Zielereignis erforderlich. Text, Postback-Auswahl, einmalige Redelivery-Verarbeitung und keine Ausführung bei falscher Signatur prüfen.

Reply-Token sind einmalig. Implementiert ist ein konservatives Fenster von **unter 55 Sekunden** seit Empfang, bei Redelivery zusätzlich **unter 20 Minuten** seit Originalereignis. Offizielle Fristen sind keine Verzögerungsgarantie. Abgelaufene/unklare Sendungen nicht automatisch mit Push/neuem Token wiederholen. Neuausstellung des Channel Secret macht bestehende Signaturen ungültig; Auswirkungen und separate Freigabe vorher klären. [Offizielle Signaturprüfung](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) · [Reply-Regeln](https://developers.line.biz/en/reference/messaging-api/#send-reply-message).

## 11. Zustände und Fehler

| Zustand/Code | Bedeutung und Maßnahme |
|---|---|
| `disconnected` / `connecting` / `connected` / `disconnecting` / `error` | Beobachteter Zustand, nicht bloße Annahme/Prüfung. Connected beweist keinen vollständigen Austausch oder Abnahme. |
| `CONNECTION_KEY_UNAVAILABLE`, `CONNECTION_CREDENTIALS_UNAVAILABLE` | Verantwortliche müssen Schlüssel/Version/Chiffretext wiederherstellen; nicht ausgeben oder beliebig ersetzen. |
| `INVALID_CREDENTIALS`, `CONNECTION_CREDENTIALS_REQUIRED`, `INVALID_CONNECTION` | Pflichtwerte/Feldnamen/IDs prüfen; Speichern beweist keine Provider-Validierung. |
| `CONNECTION_TARGET_DUPLICATE`, `CONNECTION_ACTIVE` | Duplikat prüfen oder zuerst trennen; nicht blind löschen. |
| `CONNECTION_WORKER_UNAVAILABLE`, `CHANNEL_PACKET_RUNTIME_UNAVAILABLE` | Worker/Node-Bridge prüfen lassen; Gate nicht umgehen. |
| `LEASE_EXPIRED`, Scope/Identity-Fehler | Liste neu öffnen, Code/Zeit/bereinigte Belege melden; DB-Lease/Fence nicht direkt ändern. |
| 401/403, 413, 422, Receiver disabled 503 | Authentifizierung/Signatur/Body, Größe, Format, Server prüfen. HTTP 200 beweist keine Bot-Antwort. |

Die UI zeigt eventuell nur sichere Codes/allgemeine Fehler. Keine rohen externen API-Fehler veröffentlichen. Panel neu öffnen statt automatische Aktualisierung anzunehmen.

## 12. Sicher stoppen, wiederherstellen und Grenzen

Trennen stoppt neue Arbeit; Verantwortliche können Worker auf `false` setzen. Bereits gestartete entfernte HTTP-Sendungen lassen sich nicht garantiert zurückholen. Delivery `unknown` heißt unklarer Ausgang: **keine automatische Neuausführung/Wiederholung oder Löschung des Ledgers**. Das Panel hat kein Unknown-Nachbearbeitungswerkzeug. Verantwortliche vergleichen Provider-Belege und internes Ledger vertraulich und holen eine eigene Entscheidung ein. Reconnect erlaubt keine Wiederholung alter Unknowns.

Worker vor normalem Revert des geprüften PR/Commit deaktivieren. Migration-Downgrade nur bei leeren neuen Tabellen. Bestehende Verbindungs-/Runtime-Daten müssen zur Ablehnung führen; nicht erzwingen/löschen, genehmigten Sicherungs-/Erhaltungsplan nutzen. Einstellung löschen entfernt nicht alle Gespräche/Deliveries.

Keine automatische Master-Key/Versionsrotation oder Neuverschlüsselung. Chiffretext ist an ursprünglichen Schlüssel sowie Organisation/Verbindung/Versions-AAD gebunden; nur Umgebungs-Key ändern zerstört Entschlüsselbarkeit. Provider-Credentials erst genehmigt rotieren: trennen→bearbeiten→prüfen→verbinden; neues Identitätsereignis kann nötig sein. Sofortiges Löschen von Credential/Token-Memory-Caches, Cache-Lebensdauer und langfristiges Cursor/Receipt-Wachstum/Aufbewahrung bleiben Grenzen. Trennen/Löschen garantiert keine vollständige Cache/Receipt-Entfernung. Notfallwiderruf benötigt Prozess-/Provider-Widerrufsplan und Freigabe.

## 13. Prüfliste für Kandidaten

| Provider | Entwicklungsnachweis | Reale Plattform |
|---|---|---|
| Teams | Implementiert; synthetische JWT/Native/Packet-Prüfung | Ungeprüft |
| Slack | Implementiert; synthetische Socket-Mode/Native-Prüfung | Ungeprüft |
| Discord | Implementiert; synthetische Gateway/Native-Prüfung | Ungeprüft |
| Telegram | Implementiert; synthetische Polling/Native-Prüfung | Ungeprüft |
| Google Chat | Implementiert; synthetische JWT/Native/Auswahlprüfung | Ungeprüft |
| LINE | Implementiert; synthetische HMAC/Native/Reply-Token-Prüfung | Ungeprüft |

Nur die Entwicklungsnachweise Tasks 1–11 werden unterschieden. Vollständige API/Web-, Migrations-, Node22-Image-Prüfungen, Skips und exakte SHA im separaten Kandidatennachweis prüfen. Kein realer Plattform-PASS.

- Autorisierte Prüfer folgen pro Provider in der echten UI: registrieren→prüfen→verbinden→real empfangen→CGA ausführen→antworten→auswählen→trennen/neu verbinden.
- Falsche Authentifizierung/Ziel/Organisation, Duplikate/Redelivery, Neustart, Timeout/Unknown dürfen keine doppelte Ausführung/Sendung verursachen. Commit/Image, Zeit, Ergebnis/ungeprüft und Rollback ohne echte IDs/Secrets dokumentieren.
- Echte Secrets anlegen/registrieren, Rechte ändern, externe Aufrufe/Kosten, Produktions-DB und Oracle/Produktionsdeployment benötigen jeweils passende separate Freigaben. Kostenpflichtige LLM-Bots brauchen zudem Modell/Anzahl/Budget/Abbruchbedingungen. Diese Anleitung ist keine Ausführungsfreigabe.

## 14. Quellcode-Abgleich

[UI](../../apps/web/components/channel-connections-panel.tsx), [Felder](../../apps/web/lib/channel-connections-api.ts), [Admin-API](../../apps/api/app/api/routes/channel_connections.py), [Verschlüsselung](../../apps/api/app/services/channel_connections.py), [Empfänger](../../apps/api/app/api/routes/channel_connection_events.py), [Supervisor](../../apps/api/app/services/channel_connection_supervisor.py), [Runtime](../../apps/api/app/services/channel_connection_runtime.py), [Teams](../../apps/api/app/services/channel_connection_teams.py), [Slack](../../apps/api/app/services/channel_connection_slack.py), [Discord](../../apps/api/app/services/channel_connection_discord.py), [Telegram](../../apps/api/app/services/channel_connection_telegram.py), [Google Chat](../../apps/api/app/services/channel_connection_google_chat.py), [Google-Auth](../../apps/api/app/services/channel_connection_google_chat_auth.py), [LINE](../../apps/api/app/services/channel_connection_line.py), [Migration](../../apps/api/alembic/versions/20261103_0028_channel_connections.py), [Konfiguration](../../apps/api/app/core/config.py).
