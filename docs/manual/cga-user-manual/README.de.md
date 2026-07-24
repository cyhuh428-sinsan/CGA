# CGA Studio-Benutzerhandbuch

Zielgruppe: Allgemeine Benutzer, Bot-Betreiber, Systemadministratoren

Dieses Dokument beschreibt die Menüs und den Arbeitsablauf von CGA Studio. Wenn Sie es zum ersten Mal verwenden, lesen Sie zuerst [CGA Getting Started](../cga-getting-started/README.md) und lesen Sie dann den [CGA NLU Utilization Guide](../cga-nlu-guide/README.md) für Informationen zur Engine-Auswahl, zum Lernen und zur Qualitätsverbesserung.


## 1. CGA Studio starten

### 1.1 Anmeldung

1. Öffnet den Anmeldebildschirm von CGA Studio.
2. Geben Sie Ihre Kontoinformationen ein.
3. Gehen Sie nach der Anmeldung zum CGA Studio-Bildschirm.


### 1.2 In Dokumenten verwendete Notationen

- `Bot`: Einheit, die Konversationsdienste bereitstellt
- `Version`: Ausführungseinheit, die die Konfigurations- und Trainingsressourcen des Bots verwaltet.
- `NLU-Methode`: Eine Methode zur Interpretation von Benutzeräußerungen als Absicht oder Bedeutung
- `Antwortmethode`: Methode zum Generieren oder Abrufen von Antworten basierend auf Klassifizierungsergebnissen
- `Training`: Reflektiert Daten vom Bot für ML oder die ausgewählte Ausführungs-Engine

### 1.3 Status auf dem Bildschirm prüfen

Der Bot-Erstellungsbildschirm zeigt einen Eingabebereich sowie einen Bereich an, der die aktuelle Auswahl zusammenfasst. Überprüfen Sie zunächst die folgenden Punkte:

- Sprache
- NLU-Methode
- NLU-Modell
- Antwortmethode
- LLM-Anbieter oder -Modell
- -Version

Wenn Sie die NLU-Methode oder Antwortmethode ändern, ändern sich möglicherweise die auswählbaren Modelle und zusätzlichen Einstellungselemente. Überprüfen Sie, ob der Kombinationsstatus des Bildschirms `Ausführungs-/trainingsbereit` oder `Nur Einstellungen können gespeichert werden` ist, und entscheiden Sie dann über die nächste Aktion. Wenn Sie es zum ersten Mal verwenden, wählen Sie `Bestätigen` nicht aus, ohne den Kombinationsstatus zu überprüfen.

Im Erstellungsbildschirm ist `Bestätigen` eine Aktion zum Übermitteln der eingegebenen Einstellungen und `Abbrechen` eine Aktion zum Verlassen des Erstellungsbildschirms. Nach der Übermittlung unterliegen die Ergebnisse der Bot-Erstellung und der Lern-/Indizierungsabschlussstatus einer separaten Ausführungsüberprüfung.

## 2. Bot-Erstellung und KI-Einstellungen

Geben Sie auf dem Bot-Erstellungsbildschirm grundlegende Bot-Informationen und KI-bezogene Einstellungen an.

### 2.1 Grundlegende Informationen

Die auf dem aktuellen Bildschirm angezeigten Standardelemente sind wie folgt:

- Bot-Typ: Bot, Bot Hub
- Bot-Modus: Texttyp, Sprachtyp
- Bot-Profil
- Bot-Name
- Sprache: Die aktuellen Bildschirmoptionen sind Koreanisch
- Einführung

Geben Sie den Bot-Namen ein, indem Sie den Anweisungen auf dem Bildschirm folgen und dabei die zulässigen Zeichen und Länge beachten. Das Profilbild wird im PNG-, JPEG-, WEBP-Format vorliegen und die Größenbeschränkung wird auf dem Bildschirm angezeigt.

### 2.2 NLU-Methode

Die NLU-Methoden, die derzeit auf dem CGA-Bildschirm zur Auswahl stehen, sind wie folgt.

| Anzeigebildschirm | Bedeutung |
|---|---|
| ML | Klassifizierungsmethode basierend auf Lernsätzen und Absicht |
| Semantik - Vektorarbeiter | Semantische Methode mit CGAs Vector Worker und Vector DB |
| Semantik – Externe Einbettung | Semantische Methode, die externe Einbettung und lokale Vektor-DB verbindet |
| LLM-Engine | So verwenden Sie das LLM-Modell |

Engine-spezifische Auswahlkriterien und Datenvorbereitungsmethoden finden Sie unter [Engine-Vergleich im NLU-Utilization-Guide](../cga-nlu-guide/engine-comparison.md).

### 2.3 NLU-Modell

Die Modellliste variiert je nach NLU-Methode.

- ML: DeepLearning Lite, TF-IDF Linear, Keyword Baseline
- Semantik: Standard-Vector-Worker-Modell oder externes Einbettungsmodell
- LLM: Anbieterauswahl und detaillierte Modellauswahl für jeden Anbieter

Auf dem LLM-Bildschirm können Anbieter wie Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama und OpenRouter angezeigt werden, und die detaillierte Modellliste variiert je nach ausgewähltem Anbieter. Die tatsächlich verfügbaren Modelle und der Verbindungsstatus werden anhand des auswählbaren Status auf dem Erstellungsbildschirm überprüft.

### 2.4 Antwortmethode

Die auf dem aktuellen Bildschirm angezeigten Antwortmethoden sind wie folgt.

- Definierte Antwort
- Semantic Engine RAG-Antwort
- LLM Engine RAG-Antworten
- LLM Engine-Antworten

Kombinationen von NLU-Methoden und Antwortmethoden können den Supportstatus anzeigen. Wenn der Kombinationsstatus als nicht verfügbar angezeigt wird, fahren Sie nicht fort; Wechseln Sie zu einer unterstützten Kombination.

## 3. Bot-Version und Arbeitsbereich

Nachdem Sie einen Bot erstellt haben, verwalten Sie den Bot und die Version separat.

- Bot: Grundlegende Informationen und Betriebsziel der Serviceeinheit
- Version: Eine Einheit, die Absicht, Objekt, Wörterbuch, Dialogdesign und KI-Einstellungen verwaltet.
- Arbeitsbereich: Bildschirm zum Entwerfen, Testen und Analysieren einer bestimmten Bot-Version.

Der detaillierte Pfad wird anhand des Menünamens des aktuellen CGA-Bildschirms überprüft.

Wenn Sie einen Vorgang starten, wählen Sie zunächst den Bot und die Version aus und stellen Sie sicher, dass das, was auf dem Bildschirm angezeigt wird, Ihren Absichten entspricht. Wenn Sie Ihre Daten bearbeiten und dabei einen anderen Bot oder eine andere Version ausgewählt haben, können Ihre Ergebnisse variieren.

### 3.1 Hauptzugriffspfad

| Arbeit | Anfahrtsweg |
|---|---|
| Bot-Liste | Studio > Bot |
| Erstellen Sie einen neuen Bot | Studio > Bot > Bot erstellen |
| Bot-Einstellungen | Ausgewählter Bot > Einstellungen |
| Versionsliste | Ausgewählter Bot > Versionskontrolle |
| Versionsarbeitsbereich | Ausgewählter Bot > Version > Arbeitsbereich |

Überprüfen Sie zunächst den Status der Bot-/Versionsauswahl auf dem Bildschirm und ändern Sie dann Versionsressourcen wie Absicht, Objekt, Wörterbuch und Qualitätssicherung.

## 4. Dialogdesign-Assets

### 4.1 Absicht

Dies ist eine Einheit, die unterscheidet, was eine Benutzeräußerung anfordert. Der mit den Lernsätzen für jede Absicht verbundene Gesprächsablauf muss gemeinsam überprüft werden.

Der Zugriffspfad ist `Bot > Version > Absichten`. Überprüfen Sie nach dem Ändern der Absichtsdaten den Trainingsstatus und die Simulatorergebnisse dieser Version.

### 4.2 Objekt

Dies ist eine Einheit, die den für die Geschäftsverarbeitung erforderlichen Wert oder Namen aus einer Äußerung extrahiert. Überprüfen Sie beim Ändern eines Objekts, ob die zugehörige Absicht und der Dialogablauf aktiviert sind oder nicht.

Der Zugriffspfad ist `Bot > Version > Entitäten`. Stellen Sie beim Ändern von Entitätsnamen oder Extraktionskriterien sicher, dass vorhandene Absichten und Testäußerungen gültig bleiben.

### 4.3 Wörterbuch

Assets, die zur Interpretation von Domänenbegriffen, Synonymen und Benutzerausdrücken verwendet werden. Die detaillierten Prinzipien zum Erstellen eines Wörterbuchs werden im NLU Utilization Guide erläutert.

Der Zugriffspfad ist `Bot > Version > Wörterbuch`. Unterscheiden Sie beim Hinzufügen von Synonymen zwischen Ausdrücken, die nur eine bestimmte Absicht betreffen, und Ausdrücken, die häufig für mehrere Absichten verwendet werden.

### 4.4 Qualitätssicherung

Dies ist der Bereich, der Fragen und Antworten oder dokumentenbasiertes Wissen verwaltet. Zunächst werden das Upload-Format und die Dokumentstruktur überprüft, um festzustellen, welcher Bereich vom tatsächlichen CGA-Bildschirm unterstützt wird.

Der Zugriffspfad ist `Bot > Version > QA`. Überprüfen Sie nach der Reflexion von Dokumenten oder Fragen/Antworten, ob eine Indizierung oder ein Antragsstatus vorliegt, und verwenden Sie die Ergebnisse nicht für Vorgänge ohne Bestätigung.

### 4.5 Dialogablauf

Der Konversationsfluss ist der Bereich, der den Prozess der Bearbeitung der Anfrage eines Benutzers organisiert, indem er sie mit der Absicht verknüpft.

Der Zugriffspfad ist `Bot > Version > Gesprächsabläufe`. Überprüfen Sie beim Ändern eines Flows Folgendes:

1. Überprüfen Sie, mit welcher Absicht der Fluss verknüpft ist.
2. Überprüfen Sie die Reihenfolge der Benutzereingaben und Bot-Antworten.
3. Überprüfen Sie, ob Schritte Objekte oder gemeinsame Variablen verwenden.
4. Überprüfen Sie die Verzweigung auf Beendigungs-, Rückfrage- und Ausnahmesituationen.
5. Testen Sie nach dem Speichern die Normal- und Ausnahmepfade separat im Simulator.

### 4.6 API

Das API-Menü ist ein Bereich, der API-Informationen verwaltet, die mit der Konversationsverarbeitung Ihres Bots oder Ihrer Version verbunden sind.

Der Zugriffspfad ist `Studio > API` oder `Bot > Version > API`. Überprüfen Sie beim Ändern einer API die Anforderungselemente, Antwortelemente, zugehörigen Absichten und Authentifizierungseinstellungen. Tatsächliche externe Verbindungstests und Betriebsverbindungsergebnisse erfordern eine separate Überprüfung.

## 5. Testen/Analyse/Bewertung

Derzeit sind in CGA für jede Version die folgenden Arbeitsbildschirme vorhanden.

- Simulator: Bildschirm zur Eingabe der Äußerung und Überprüfung der Antwort
- Analyse: Bildschirm zur Überprüfung der kumulativen Klassifizierungsergebnisse und der angewendeten Klassifizierungsschritte
- Auswertung: Bildschirm zur Überprüfung der vorbereiteten Auswertungsdaten und -ergebnisse
- Gesprächsverlauf: Bildschirm zur Überprüfung tatsächlicher oder gespeicherter Gesprächsergebnisse
- Neu trainieren: Bildschirm, um Rückmeldungen oder Korrekturdaten erneut anzuzeigen

Die Hauptzugriffspfade sind wie folgt:

| Arbeit | Anfahrtsweg |
|---|---|
| Simulator | Bot > Version > Simulator |
| Analyse | Bot > Version > Analytics |
| Bewertung | Bot > Version > Bewertung |
| Gesprächsverlauf | Bot > Version > Konversationsverlauf |
| Umlernen | Bot > Version > Neu trainieren |

Ausschluss/Ignorieren, Smalltalk, genaue Übereinstimmung, Regel, ML, Semantik, LLM usw. können in der Klassifizierungsphase des Analysebildschirms angezeigt werden. Die Interpretation basiert auf den tatsächlichen Klassifizierungsschritten und Indikatoren, die auf dem Bildschirm angezeigt werden.

## 6. Systemverwaltung

Der Umfang des Zugriffs auf das Systemverwaltungsmenü kann je nach Rolle variieren.

Die aktuellen Menügruppen sind wie folgt:

- Benutzerverwaltung: Benutzerverwaltung, Anmeldeverlauf, Gruppenverwaltung
- Statusabfrage: Betriebs-/Systemprotokoll, Bot-Status, Lernverlauf, Konversationsverlauf, API-Aufrufverlauf, Warteschlangenverlauf, Feedback nach Absicht
- Konversationsmanagement: Gemeinsame Variablen, Standardnachricht
- Systemverbindung: Kanal, Verbindungsstatus der Bot-Station
- Sonstige Verwaltung: Vorlagen, Lizenzen

Der tatsächliche Anzeigename des Administratormenüs lautet wie folgt.

- Benutzerverwaltung: Benutzerverwaltung, Anmeldeverlauf, Gruppenverwaltung
- Statusabfrage: Betriebs-/Systemprotokollabfrage, Bot-Statusabfrage, Lernverlaufsabfrage, Gesprächsverlaufsabfrage, API-Aufrufverlaufsabfrage, Warteschlangenverlaufsabfrage, Feedbackabfrage nach Absicht
- Konversationsmanagement: Gemeinsame Variablen verwalten, Basisnachrichten verwalten
- Systemverbindung: Kanalverwaltung, Verbindungsstatus der Bot-Station
- Sonstige Verwaltung: Vorlagenliste, Lizenzsuche

### 6.1 Kanäle und Bot-Station

- `Kanalverwaltung`: Verwaltet Kanal-ID, Kanalname, Anbieter, Renderertyp, Verfügbarkeit und Verbindungseinstellungen.
- `Botstation-Verbindungsstatus`: Überprüfen Sie den Verknüpfungsstatus von Gruppe, Kanal, Bot, Betriebsversion und aktivem Kanal.

Überprüfen Sie vor dem Wechseln von Kanälen oder Botstationen die Betriebsversion und die aktiven Kanäle des Ziel-Bots. Wenn ein Verbindungstest oder ein Speicherergebnis fehlschlägt, notieren Sie die Fehlermeldung und Zielinformationen auf dem Bildschirm und leiten Sie sie an das Betriebspersonal weiter.

Detaillierte Vorgänge für jede Autorität im Administratormenü werden nach Überprüfung durch den Browser für jede tatsächliche Rolle bestätigt.

### 6.2 KakaoTalk-Kanalverbindung

Um eine Verbindung zu KakaoTalk herzustellen, müssen Sie die Kakao-Entwicklereinstellungen, die KakaoTalk-Kanal-/Chatbot-Einstellungen und die CGA-Verbindungsinformationseinstellungen der Reihe nach abschließen. Durch die bloße Registrierung eines Kanals auf dem CGA-Bildschirm wird die KakaoTalk-Verbindung nicht abgeschlossen.

> Sicherheitshinweis: Authentifizierungs-/Verbindungsinformationen wie App-ID, REST-API-Schlüssel, Skill-URL und Betriebs-/Test-Header werden nicht als tatsächliche Werte in Dokumenten, Screenshots, Protokollen oder Messengern aufgezeichnet. Der tatsächliche Wert wird vom Betriebspersonal über einen sicheren Lieferweg bestätigt und nur der Artikelname und der Lagerort werden im Dokument erfasst.

#### 6.2.1 Vorbereitung

Überprüfen Sie die folgenden Informationen mit Ihrem Betriebsvertreter:

- Kakao Developers-App und App-ID
- Verbindungsstatus des KakaoTalk-Kanals und des Business-Kanals
- Kakao Business Chatbot und Betriebskanal
- Bots und Betriebsversionen zur Verwendung in CGA
- Skill-URL und Test-URL, ausgestellt von CGA
- Erforderliche Betriebs- und Testheader

Wenn die App-ID oder der Schlüssel im Dokument oder Bildschirm fest codiert ist oder wenn die Versionen des Operations-Bots und des Test-Bots unterschiedlich sind, wird keine Verbindungsbestätigung durchgeführt.

#### 6.2.2 Kakao Developers-App-Einstellungen

1. Melden Sie sich bei [Kakao Developers](https://developers.kakao.com/) an.
2. Wählen Sie die zu verbindende App aus dem **App**-Menü aus.
3. Überprüfen Sie den App-Namen und die App-ID.
4. Wenn eine Kakao-Anmeldung unter **Kakao-Anmeldung > Allgemein** erforderlich ist, setzen Sie den Status auf `ON` und speichern Sie.
5. Überprüfen Sie die grundlegenden App-Informationen und den Biz-App-Konvertierungsstatus unter **Unternehmenszertifizierung > Biz-App-Wechsel**.
6. Überprüfen Sie die Bewerbungsberechtigung und den Überprüfungsstatus unter **KakaoTalk Channel > Business Channel Connection**.
7. Überprüfen Sie den REST-API-Schlüssel in den App-Einstellungen, aber geben Sie den tatsächlichen Schlüsselwert nicht nach außen preis.

Business-Channel-Verbindungen sind je nach Überprüfungsstatus möglicherweise nicht sofort verfügbar. Wenn die Verbindung gerade überprüft wird, notieren Sie den Status, anstatt festzustellen, dass die Verbindung abgeschlossen ist.


#### 6.2.3 KakaoTalk-Kanal- und Chatbot-Einstellungen

1. Überprüfen Sie den zu verbindenden Kanal im [KakaoTalk Channel Management Center](https://center-pf.kakao.com/) oder im Kakao Business Management Center.
2. Stellen Sie sicher, dass der Kanal erkennbar und verfügbar ist.
3. Erstellen Sie einen Chatbot oder wählen Sie einen vorhandenen Chatbot unter **Business Tools > Chatbots** aus.
4. Wählen und speichern Sie den Betriebskanal, der mit CGA verbunden werden soll, unter **Einstellungen > Betriebskanal auswählen** des Chatbots.
5. Überprüfen Sie, ob der Betriebskanal und der Chatbot unter **Chatbot verbinden** im Kanal-Dashboard verbunden sind.


#### 6.2.4 Skill-Erstellung und Eingabe von Verbindungsinformationen

1. Wählen Sie den Ziel-Chatbot im Kakao Chatbot Management Center aus.
2. Wählen Sie **Neuen Block erstellen > Fertigkeit erstellen**.
3. Geben Sie den Skill-Namen ein. Benennen Sie es gemäß den Betriebsregeln und identifizieren Sie es als Fähigkeit für die CGA-Verbindung.
4. Geben Sie die von CGA ausgegebene Skill-URL bzw. Test-URL ein.
5. Geben Sie bei Bedarf Betriebs- und Testheader ein.
6. Überprüfen Sie nach dem Speichern die URL, die Test-URL, den Header-Eingabestatus und die anwendbaren Blöcke auf dem Bildschirm mit den Skill-Details.

Die Skill-URL und der Header verwenden Werte, die vom CGA-Betriebspersonal bereitgestellt werden. Erraten Sie keine Werte und geben Sie Produktions- und Test-URLs nicht abwechselnd ein.

![Kakao Connect Skill-Detailbildschirm](screenshots/kakao-skill-detail-masked.png)

Abbildung 6-2-1. `CGA-Kakao-Verbindung` Bildschirm mit den Fertigkeitsdetails. URL- und Header-Werte werden aus Sicherheitsgründen maskiert.

#### 6.2.5 Begrüßungsblock und Fallback-Block verbinden

1. Öffnen Sie den Willkommensblock des Chatbots.
2. Wählen Sie in den **Parametereinstellungen** die CGA-Verbindungsfähigkeit aus.
3. Wählen Sie in den Bot-Antworteinstellungen **Skill-Daten verwenden** aus.
4. Speichern.
5. Legen Sie den gleichen CGA-Verbindungs-Skill fest und **verwenden Sie Skill-Daten** im Fallback-Block.
6. Überprüfen Sie die Speicherergebnisse und den Verbindungsstatus für jeden Block erneut.

Der Willkommensblock verarbeitet den ersten Eintrag in eine KakaoTalk-Konversation und der Fallback-Block leitet reguläre Äußerungen an den CGA weiter. Wenn die beiden Blöcke unterschiedliche Fähigkeiten oder unterschiedliche Bedienversionen verwenden, können die Verarbeitungsergebnisse für die anfängliche Begrüßung und die allgemeine Antwort unterschiedlich sein.

![Kakao-Willkommensblock](screenshots/kakao-welcome-block.png)

Abbildung 6-2-2. Willkommensblock-Parametereinstellungen und Skill-Datennutzungsbildschirm.

![Kakao-Fallback-Block](screenshots/kakao-fallback-block.png)

Abbildung 6-2-3. Parametereinstellungen für den Fallback-Block und Bildschirm zur Verwendung von Fertigkeitsdaten.

#### 6.2.6 CGA-Kanalregistrierung und Betriebsversion verknüpfen

1. Gehen Sie in CGA Studio zu **Systemverwaltung > Kanalverwaltung**.
2. Geben Sie die Kanal-ID und den Kanalnamen ein, die für die KakaoTalk-Verbindung verwendet werden sollen, oder wählen Sie einen vorhandenen Kanal aus.
3. Überprüfen Sie den Anbieter, den Renderertyp, die Verfügbarkeit und die Verbindungseinstellungen.
4. Überprüfen Sie den Bot, mit dem Sie eine Verbindung herstellen, und seine Betriebsversion.
5. Überprüfen Sie nach dem Speichern den Verbindungsstatus auf dem Kanalverwaltungsbildschirm.
6. Überprüfen Sie, ob die Kombination aus Gruppe, Kanal, Bot, Betriebsversion und aktivem Kanal im **Botstation-Verbindungsstatus** korrekt ist.

#### 6.2.7 Verbindung prüfen

1. Suchen Sie nach dem mit KakaoTalk verbundenen Kanal und öffnen Sie den Chatroom.
2. Stellen Sie sicher, dass die Standardbegrüßung von CGA beim ersten Eintrag angezeigt wird.
3. Geben Sie die reguläre Äußerung ein, die der registrierten Absicht entspricht.
4. Stellen Sie sicher, dass die NLU-Klassifizierung und die Konversationsflussergebnisse von CGA in der Antwort angezeigt werden.
5. Stellen Sie sicher, dass Benutzeräußerungen und -antworten im CGA-Konversationsverlauf gespeichert werden.
6. Überprüfen Sie, ob der Kanalwert im Verlauf `Kakao` oder der in der Betriebsumgebung definierte Kakao-Kanalwert ist.
7. Stellen Sie sicher, dass der Bot, die Betriebsversion und die Kanalinformationen mit der beabsichtigten Zielgruppe übereinstimmen.

Die Bedingungen für den Verbindungsabschluss sind wie folgt.

- Der Willkommensblock und der Fallback-Block rufen den CGA-Verbindungsskill auf.
- Beide Blöcke sind auf die Verwendung von Fertigkeitsdaten eingestellt.
- Die erste Begrüßung und allgemeine Antwort stammen aus den CGA-Bot-Einstellungen, nicht aus der Kakao-Einstellungsphrase.
- Bot-, Versions- und Kakao-Kanalinformationen bleiben im CGA-Konversationsverlauf.

Wenn die Verbindung fehlschlägt, überprüfen Sie den Kakao-Kanalstatus, den Chatbot-Betriebskanal, die Skill-URL/den Skill-Header, den Willkommens-/Fallback-Block, den CGA-Kanalanbieter und die Betriebsversion in dieser Reihenfolge. Kopieren Sie keine Schlüssel oder Kopfzeilen in Dokumenten und ändern Sie sie auch nicht willkürlich.


#### 6.2.8 CGA-Screenshot-Einfügeort

Der folgende CGA-Bildschirm fügt eine Aufnahme ein, nachdem die Berechtigungen und der Verbindungsstatus der tatsächlichen Betriebsumgebung überprüft wurden.


Maskieren Sie beim Einfügen einer Erfassung zunächst vertrauliche Informationen wie Kontoname, App-ID, REST-API-Schlüssel, Skill-URL, Authentifizierungsheader und persönliche Informationen.

## 7. Grundlegende Bestätigungssequenz, wenn ein Problem auftritt

1. Stellen Sie sicher, dass der aktuelle Bot und die aktuelle Version korrekt sind.
2. Überprüfen Sie den Kombinationsstatus der ausgewählten NLU-Methode, des Modells und der Antwortmethode.
3. Überprüfen Sie, ob die erforderlichen Daten gespeichert wurden.
4. Überprüfen Sie den Schulungs-/Indexierungs-/Bewerbungsstatus.
5. Testen Sie dieselbe Äußerung noch einmal im Simulator.
6. Überprüfen Sie die Ergebnisse in der Analyse-/Auswertungs-/Dialoghistorie.

Wenn Ursache und Ergebnis nicht auf dem Bildschirm bestätigt werden, manipulieren Sie nicht direkt die Datenbank oder CLI, sondern übermitteln Sie den Bot, die Version, die Fehlermeldung und den Zeitpunkt des Auftretens auf dem Bildschirm an den Betriebsleiter.

### Bei Nichtlernen auch nach Lernanfrage

1. Drücken Sie die Lerntaste und prüfen Sie, ob die Meldung `Die NLU-Trainingsanfrage wurde zur Warteschlange hinzugefügt.` angezeigt wird.
2. Stellen Sie sicher, dass sich die Schaltfläche „Lernen“ in `Training läuft` ändert.
3. Überprüfen Sie nach der Aktualisierung, ob sich der Versionsstatus in `Training beendet` oder Verfügbar ändert.
4. Überprüfen Sie die Startzeit, Abschlusszeit und den Lernstatus des gleichen Bots/der gleichen Version in der Lernverlaufsabfrage.
5. Wenn es erneut als `Nicht trainiert` angezeigt wird oder kein Lernverlauf vorliegt, werten Sie es nicht als Erfolg, sondern übermitteln Sie dem Betriebspersonal den Bot, die Version, die Lern-Engine und die Anforderungszeit.

Eine Trainingsanfrage wird der Queue hinzugefügt und von einem separaten Worker asynchron verarbeitet. ML- und Semantic-Training kann je nach Daten und Umgebung länger als drei Minuten dauern; testen Sie erst, wenn der Trainingsverlauf Erfolgreich oder trainiert anzeigt.

## 8. Allgemeine Verfahren für Menüoperationen

Die folgende Reihenfolge wird üblicherweise bei der Verwendung der Menüs „Intent“, „Objekt“, „Wörterbuch“, „QA“, „Dialogfluss“ und „API“ angewendet.

1. **Zweck**: Definieren Sie in einem Satz das Arbeitsergebnis, das Sie mit dieser Aufgabe ändern möchten.
2. **Zugriffspfad**: Wählen Sie den richtigen Bot und die richtige Version aus und navigieren Sie zum entsprechenden Menü.
3. **Bildschirmaufbau**: Überprüfen Sie zuerst den aktuellen Wert, den Auswahlstatus, Fehler/Warnungen und inaktive Elemente.
4. **Verwendungsverfahren**: Ändern Sie nur die erforderlichen Elemente und notieren Sie die Werte vor den Änderungen.
5. **Ergebnis speichern/anwenden**: Überprüfen Sie die Speichermeldung und den Lern-/Indexierungs-/Anwenderstatus.
6. **Achtung**: Überprüfen Sie die Auswirkungen auf den zugehörigen Intent/Flow/Kanal/Version.
7. **Zugehörige Dokumentation**: Wenn es sich um ein Engine- oder Qualitätsproblem handelt, lesen Sie auch den [NLU-Nutzungsleitfaden](../cga-nlu-guide/README.md).

Die Erfolgsmeldung beim Speichern allein bestimmt nicht, dass die Vorgangsreflexion abgeschlossen wurde. Wenn Sie tatsächliche Nutzungsergebnisse benötigen, überprüfen Sie die Ergebnisse im Simulator, in der Analyse und im Gesprächsverlauf.

## 9. Glossar

| Terminologie | Beschreibung |
|---|---|
| bot | Diensteinheit, die mit dem Benutzer kommuniziert |
| Bot-Hub | Eine Einheit, die mehrere Bots verwaltet |
| Version | Einheit, die Bot-Einstellungen und Konversationsdesign separat verwaltet |
| Absicht | Eine Einheit, die den Zweck einer Benutzeranfrage klassifiziert
| Objekt | Ein aus einer Äußerung | extrahierter Wert oder Name
| NLU | Funktionsbereich, der die Eingaben des Benutzers in natürlicher Sprache interpretiert |
| Lernen | Die Aufgabe, registrierte Daten widerzuspiegeln, damit die Engine sie verwenden kann |
| Indizierung | Vorbereiten der Suchstruktur von Daten für den Abruf |
| RAG | Wie man abgerufenes Wissen und generative Modelle gemeinsam nutzt |

## Verwandte Dokumente

- [Alle CGA-Handbücher anzeigen](../README.md)
- [CGA Erste Schritte](../cga-getting-started/README.md)
- [CGA NLU-Nutzungsleitfaden](../cga-nlu-guide/README.md)
