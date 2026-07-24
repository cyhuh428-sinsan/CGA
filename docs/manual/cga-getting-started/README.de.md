# CGA Erste Schritte

Status: Inhaltserstellung abgeschlossen, Ausführungsüberprüfung wartet
Zielgruppe: Benutzer, die neu bei CGA sind

Dieses Dokument führt Sie durch die Erstellung Ihres ersten Bots in CGA und zeigt die Ergebnisse Ihrer ersten Tests. Befolgen Sie Schritt für Schritt und überprüfen Sie die erwarteten Ergebnisse jedes Schritts, bevor Sie mit dem nächsten Schritt fortfahren.

> Die Übermittlung der Bot-Erstellung und die Ausführung des Simulators wurden mit einem Verifizierungs-Bot bestätigt. Das ML-Lernen wurde nicht abgeschlossen, obwohl die Warteschlangenregistrierung bestätigt wurde, sodass der Erfolgspfad nach Abschluss des Lernens nicht als betriebliches Bestätigungsverfahren betrachtet wird.

## In diesem Dokument abgeschlossen

Wenn Sie diese Anweisungen bis zum Ende lesen, können Sie:

- Sie können die erforderlichen Informationen vorbereiten, bevor Sie einen neuen Bot erstellen.
- Sie können entscheiden, welche NLU-Methode Sie unter ML·Semantic·LLM wählen möchten.
- Sie können das Modell, die Antwortmethode und den Supportstatus auf dem Erstellungsbildschirm überprüfen.
- Nachdem Sie Ihren Bot erstellt haben, wissen Sie, worauf Sie beim Training oder bei der Indizierung und beim ersten Testen achten müssen.

## Bereiten Sie sich vor, bevor Sie beginnen

- CGA Studio-Konto
- Zu erstellender Bot-Name
- Eine kurze Benutzeräußerung zum Testen.
- Standardauswahl für die zu verwendende NLU-Methode

Beim ersten Erlernen des Bildschirms wird empfohlen, den Bildschirm anhand der Kombination von `ML` und `Feste Antwort` zu überprüfen. Diese Kombination wird im aktuellen Erstellungsbildschirm als `Ausführungs-/trainingsbereit` angezeigt. Der tatsächliche Erstellungs- und Lernerfolg bedarf einer gesonderten Überprüfung.

Wenn Sie detaillierte Auswahlkriterien für die Engine benötigen, lesen Sie bitte zunächst den [NLU-Nutzungsleitfaden](../cga-nlu-guide/README.md).

### Beispiel für die Mindestvorbereitung für den ersten Gebrauch

Fügen Sie nicht von Anfang an viele Funktionen hinzu, sondern überprüfen Sie den Bildschirmfluss mit einem Intent und kurzen Testäußerungen.

| Vorbereitungsartikel | Beispiel |
|---|---|
| Bot-Name | Urlaubsanfrage Testbot |
| Absicht | Überprüfen Sie die verbleibenden Urlaubstage |
| Beispiel für das Lernen von Sätzen | Wie viele Tage verbleiben im Urlaub? |
| Testzündung | Wie viel Urlaub bleibt übrig? |
| Erste Antwortmethode | etablierte Antwort |

Das obige Beispiel soll die Verwendung des Dokuments erläutern und ist nicht als tatsächliche Geschäftsdaten oder Antworten des Unternehmens gedacht.

## Schritt 1. Anmelden

### Zweck

Ruft den CGA Studio-Arbeitsbildschirm auf.

### -Vorgang

1. Öffnet den Anmeldebildschirm von CGA Studio.
2. Geben Sie Ihre Kontoinformationen ein.
3. Wählen Sie die Schaltfläche „Anmelden“.

### Erwartete Ergebnisse

Das Dashboard oder der Begrüßungsbildschirm von CGA Studio entsprechend Ihren Berechtigungen wird angezeigt.

### Wenn ein Problem auftritt

Wenn Sie zum Anmeldebildschirm zurückkehren oder einen Berechtigungsfehler sehen, überprüfen Sie Ihren Kontostatus und Ihre Rollen bei Operations.

## Schritt 2. Erstellen Sie einen neuen Bot

### Zweck

Geben Sie grundlegende Informationen für den Bot ein, den Sie testen möchten.

### -Vorgang

1. Gehen Sie zum Bot-Erstellungsbildschirm.
2. Wählen Sie `Bot` unter Bot-Typ aus.
3. Wählen Sie Texttyp oder Sprachtyp.
4. Sie können jetzt im Profilbereich ein PC-Bild auswählen.
5. Geben Sie den Bot-Namen in das Feld `Geben Sie den Bot-Namen ein.` ein.
6. Überprüfen Sie `Koreanisch` in der Sprache.
7. Geben Sie bei Bedarf eine Einführung in das Feld `Geben Sie eine Beschreibung des Bots ein.` ein.

### Erwartete Ergebnisse

Der Bot-Erstellungsbildschirm zeigt den Auswahlstatus und die grundlegenden Informationen an, die in der Strukturzusammenfassung eingegeben wurden.

### Wenn ein Problem auftritt

Wenn ein Bot-Namensfehler auftritt, geben Sie alle Zeichen erneut ein, die nicht den Anweisungen auf dem Bildschirm entsprechen, oder kürzen Sie die Länge.

Überprüfen Sie vor der Eingabe Folgendes:

- Wie kann ich verhindern, dass mein Bot-Name mit anderen Bots verwechselt wird?
- Haben Sie die Testäußerung als einen Satz vorbereitet?
- Haben Sie bei der Eingabe des Tests tatsächliche Betriebsdaten oder persönliche Informationen verwendet?

## Schritt 3. Wählen Sie die NLU-Methode aus

### Zweck

Wählen Sie die Engine aus, die Benutzeräußerungen interpretiert.

### -Vorgang

Wählen Sie in `NLU-Methode` eine der folgenden Optionen aus:

- `ML`
- `Semantic - Vector Worker`
- `Semantic - External Embedding`
- `LLM Engine`

### Erwartete Ergebnisse

Das NLU-Modell und zusätzliche Einstellungselemente, die für die ausgewählte Methode geeignet sind, werden angezeigt. Wenn Sie beispielsweise `Semantic - External Embedding` auswählen, werden das Einbettungsmodell und die Intent Vector DB-Verbindungselemente angezeigt. Wenn Sie `LLM Engine` auswählen, werden der Anbieter und detaillierte Modellelemente angezeigt.

### Bei der ersten Auswahl

- Sehen Sie sich ML als Ausgangspunkt für die direkte Gestaltung von Lernsätzen und -absichten an.
- Wenn die Struktur semantische Ähnlichkeit und Vektor-DB verwendet, ziehen Sie Semantik in Betracht.
- Überprüfen Sie das LLM, wenn Sie bereit sind, das Modell mit einem LLM-Anbieter zu betreiben.

Eine spezifische Auswahl finden Sie in der [Motorvergleichstabelle](../cga-nlu-guide/engine-comparison.md).

## Schritt 4. Überprüfen Sie das Modell und die Antwortmethode

### Zweck

Überprüfen Sie die für die ausgewählte NLU-Methode erforderlichen Modelle und Antwortmethoden.

### Betrieb

1. Überprüfen Sie die verfügbaren Modelle in `NLU-Modell`.
2. Überprüfen Sie in `Antwortmethode`, welche Elemente aus der festgelegten Antwort, der Semantic Engine RAG-Antwort, der LLM Engine RAG-Antwort und der LLM Engine-Antwort ausgewählt werden können.
3. Überprüfen Sie den Unterstützungsstatus der Auswahlkombination.
4. Stellen Sie bei der ersten Überprüfung der Einstellungen sicher, dass die Kombination `ML` + `DeepLearning Lite` + `Feste Antwort` als `Ausführungs-/trainingsbereit` angezeigt wird.

### Erwartete Ergebnisse

Die Strukturzusammenfassung zeigt Sprache, NLU-Methode, NLU-Modell, Antwortmethode, LLM und Version.

### Wenn ein Problem auftritt

Wenn eine Kombination als nicht verfügbar markiert ist, wählen Sie eine andere Antwortmethode oder NLU-Methode. Wir werden mit Ihrer Erstellung nicht fortfahren, ohne Ihren Bewerbungsstatus zu prüfen.

## Schritt 5. Mindestvorbereitung für jeden Motor

Die Vorbereitungen ab dieser Phase variieren je nach ausgewählter Engine.

### M.L.

Bereiten Sie Absichts- und Lernsätze vor. Schreiben Sie so, dass jede Äußerung nur eine Absicht enthält, und bereiten Sie unterschiedliche Ausdrücke für ähnliche Absichten vor.

Bereiten Sie zunächst nur eine Absicht und einige Lernsätze vor und überprüfen Sie den Bildschirmfluss. Überprüfen Sie dann, ob er erfolgreich war, und erweitern Sie den Umfang.

### Semantisch

Bereiten Sie die Absicht vor oder suchen Sie nach Zielwissen und Vector DB-Verbindungsbedingungen. Wenn Sie sich für die externe Einbettung entscheiden, überprüfen Sie die Such-API-Adresse und die Kompatibilitätsbedingungen des Einbettungsmodells.

### L.L.M.

Wählen Sie den LLM-Anbieter und das detaillierte Modell aus und bereiten Sie bei Bedarf Modellaufrufadressen und Antwortanweisungen vor.

Detaillierte Datenerstellung und Qualitätsverbesserung für jede Engine werden im entsprechenden Kapitel des [NLU Utilization Guide](../cga-nlu-guide/README.md) behandelt.

## Schritt 6. Erstellung, Lernen, Indexvorbereitung

### Zweck

Bereitet die eingegebenen Bot-Einstellungen und Daten für die Verwendung in CGA vor.

### -Vorgang

1. Überprüfen Sie die Eingabewerte und die Motorkombination erneut.
2. Wählen Sie auf dem Erstellungsbildschirm die Schaltfläche `Bestätigen`.
3. Überprüfen Sie das Erstellungsergebnis und den Versionsstatus.
4. Führen Sie alle für die ausgewählte Engine erforderlichen Schulungs- oder Indexvorbereitungsjobs aus.
5. Stellen Sie sicher, dass sich der Status in „Abgeschlossen“ oder „Verfügbar“ geändert hat.

### Erwartete Ergebnisse

Der Bot und die Version werden erstellt und der Bereitschaftsstatus wird für die ausgewählte Engine angezeigt.

> Das Erstellungsergebnis des Verifizierungsbots und die Bildschirmverschiebung zur Version `v1` wurden bestätigt. Die Lernanfrage wurde in der Warteschlange registriert, aber der Status `Nicht trainiert` blieb nach der Aktualisierung erhalten und es gab keine Ergebnisse im Lernverlauf.

### Wenn der Lernabschluss nicht bestätigt wird

Wenn sich die Lernschaltfläche zu `Training läuft` ändert und nach der Aktualisierung erneut `Trainieren` und `Nicht trainiert` angezeigt wird, ist das Lernen nicht erfolgreich. Wir überprüfen die Abschlusszeit und den Status in der Abfrage des Trainingsverlaufs. Wenn keine Ergebnisse vorliegen, verwenden wir den Simulatortest nicht zur Qualitätsprüfung.

## Schritt 7. Erster Test

### Zweck

Stellen Sie sicher, dass Benutzeräußerungen über die ausgewählte Engine verarbeitet werden.

### Betrieb

1. Gehen Sie zum Versionsarbeitsbildschirm für den von Ihnen erstellten Bot.
2. Öffnen Sie den Simulator.
3. Geben Sie die kurze Testäußerung ein, die Sie vorbereitet haben.
4. Führen Sie den Test aus.

### Erwartete Ergebnisse

Die Antwort- und Klassifizierungsergebnisse werden angezeigt.

### Wenn ein Problem auftritt

Wenn keine Antwort erfolgt oder diese anders als erwartet ausfällt, überprüfen Sie zunächst den Bot/die Version, den Trainings- oder Indexstatus, die ausgewählte Engine und die Antwortmethode. Der Verifizierungsbot zeigte `Nicht klassifizierte Absicht` und `Die Absichtsklassifizierung kann ohne Trainingssätze nicht ausgeführt werden` an, ohne dass das Training abgeschlossen wurde.

Grenzen Sie den Bereich in der folgenden Reihenfolge ein:

1. Überprüft, ob der aktuell ausgewählte Bot und die aktuell ausgewählte Version zum Testen berechtigt sind.
2. Überprüfen Sie den Kombinationsstatus von NLU-Methode, Modell und Antwortmethode.
3. Überprüfen Sie den Schulungs- oder Indexbereitschaftsstatus und Fehlermeldungen.
4. Geben Sie die repräsentative Äußerung bzw. andere Variantenäußerungen erneut ein.
5. Wenn der Fehler weiterhin besteht, werden Bot, Version, Engine, Auslösung und Fehlerzeit aufgezeichnet und an den Betriebsleiter übermittelt.

## Schritt 8. Überprüfen Sie die Ergebnisse und lernen Sie als Nächstes

Überprüfen Sie nach dem ersten Test die Ergebnisse auf dem nächsten Bildschirm.

- Simulator: Eingabeäußerung und sofortige Reaktion
- Analyse: Kumulative Klassifizierungsergebnisse und Anwendungsschritte
- Auswertung: Auswertungsdaten und Ergebnisse
- Gesprächsverlauf: Gespeicherter Gesprächsverlauf

Wenn die Ergebnisse unzureichend sind, sehen Sie im NLU-Nutzungsleitfaden nach, um die Datenverbesserungs- und Revalidierungsverfahren für jede Engine zu finden.

## Nächstes Dokument

- [Alle CGA-Handbücher anzeigen](../README.md)
- [CGA-Benutzerhandbuch](../cga-user-manual/README.md)
- [CGA NLU-Nutzungsleitfaden](../cga-nlu-guide/README.md)
- [Funktionsüberprüfungstabelle](../cga-manual-verification-matrix.md)
