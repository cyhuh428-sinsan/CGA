# CGA NLU-Nutzungshandbuch

Zielgruppe: Bot-/Dialogdesign-Betreiber, KI/NLU-Experten

Dieses Dokument wählt die CGA-Engines `ML`, `Semantic` und `LLM` aus und organisiert Daten, Einstellungen, Tests und Methoden zur Qualitätsverbesserung für jede Engine.


## 1. NLU-Grundkonzepte

- Absicht: Eine Klassifizierungseinheit, die angibt, was die Äußerung des Benutzers anfordert.
- Lernsätze: Benutzerausdrücke, die zum Erlernen der Absicht oder zur Verwendung als Suchkriterien registriert wurden.
- Entität: Der geschäftliche Wert oder Name, der aus der Äußerung extrahiert werden muss.
- Wörterbuch: Assets zur Interpretation von Domänenbegriffen, Synonymen und Benutzerausdrücken
- Schwellenwert: Mindestkriterien, um Ergebnisse als verwendbar zu akzeptieren.
- Ähnlichkeit: Ein Wert, der angibt, wie ähnlich die Eingabe- und Kandidatendaten in ihrer Bedeutung sind.
- Antwort-Engine: Bereich zum Auswählen einer bestimmten Antwort oder zum Suchen/Erstellen einer Antwort basierend auf Klassifizierungsergebnissen

## 2. Engine-Auswahlkriterien

| Kategorie | ML | Semantisch | L.L.M. |
|---|---|---|---|
| Grundlegende Methode | Klassifizierung basierend auf Absicht und Lernsätzen | Einbettungs- und Vektorsuchfokus | LLM-Modell und weisungsbasierte Verarbeitung |
| fertige Daten | Absicht, Lernsatz, Objekt, Wörterbuch | Absicht oder Suchwissen, Einbettung·Vector DB | Absicht, Richtlinie, Anbietermodell |
| Ein guter Ausgangspunkt | Wenn es eine unterscheidbare Arbeitsabsicht und Steuerung von Lernsätzen gibt | Wenn Sie nach einer ähnlichen Bedeutung suchen müssen, obwohl die Ausdrücke unterschiedlich sind | Wenn LLM-basierte Analyse/Generierung und Modellbetrieb erforderlich sind |
| Schlüsselüberprüfung | Genauigkeit, Fehlklassifizierung, Satzbalance | Suchähnlichkeit, Schwellenwert, Indexstatus | Reaktionskonsistenz, Einhaltung von Anweisungen, Verzögerung/Kosten |
| Hauptrisiken | Absichtsduplizierung, Datenungleichgewicht | Einbettungskompatibilität, Indexkonflikt | Modelländerung, sofortige Auswirkung, Reaktionsabweichung |

Der detaillierte Modell- und Supportstatus wird anhand der auf dem Bot-Erstellungsbildschirm verfügbaren Auswahlmöglichkeiten überprüft.

## 3. Allgemeine Betriebsabläufe

1. Überprüfen Sie den Bot und die Version.
2. Überprüfen Sie die NLU-Methode und das NLU-Modell.
3. Überprüfen Sie die Antwortmethode.
4. Bereiten Sie sich auf den Daten- oder Verbindungsaufbau vor.
5. Führt Schulungs-, Indexerstellungs- und Modellanwendungsaufgaben aus.
6. Testen Sie repräsentative Äußerungen im Simulator.
7. Überprüfen Sie die Ergebnisse in der Analyse-/Auswertungs-/Dialoghistorie.
8. Ermitteln Sie die Ursache, korrigieren Sie die Daten und testen Sie erneut.

## 4. Gemeinsame Grundsätze der Qualitätsprüfung

- Ein Trainingssatz enthält eine Kernabsicht.
- Ähnliche Absichten umfassen Substantive, Verben und Situationen, die voneinander unterschieden werden können.
- Überprüfen Sie das Gleichgewicht, um eine Überlastung der Daten für bestimmte Absichten zu vermeiden.
- Legen Sie zunächst fest, ob Domänenbegriffe als Objekte oder Wörterbücher verwaltet werden.
- Testäußerungen wiederholen nicht nur dieselben Ausdrücke wie Trainingssätze.
- Verbessern Sie zunächst Absichtspaare mit wiederholten Fehlklassifizierungen in den Analyseergebnissen.

### 4.2 Regeln zum Schreiben von Lernsätzen

Hinweis Wenn Sie die Grundsätze des NLU-Leitfadens auf CGA-Betriebsdaten anwenden, verwenden Sie die folgende Reihenfolge:

1. Benennen Sie die Absicht, um den Zweck der Aufgabe anzugeben.
2. In einem Trainingssatz ist nur eine Kernanforderung enthalten.
3. Bereiten Sie dieselbe Absicht mit unterschiedlicher Wortreihenfolge, unterschiedlichem Tonfall und unterschiedlichem Ausdruck vor.
4. Multiplizieren Sie nicht einfach Wörter, die sich mit anderen Absichten überschneiden, sondern beziehen Sie Kontext und Aktionen ein, die die Absicht unterscheiden.
5. Registrieren Sie identische oder nahezu identische Sätze nicht wiederholt.
6. Vergleichen Sie jede Absicht, um sicherzustellen, dass sich Sätze nicht nur auf eine bestimmte Absicht konzentrieren.

Wenn Sie beispielsweise `Verbleibende Urlaubstage prüfen` und `Urlaub beantragen` teilen, sollten Sie Ausdrücke vorbereiten, die die Teilungskriterien offenlegen, anstatt das Wort `Urlaub` in beide Intents aufzunehmen, z. B. `Verbleibende Tage` und `Antragsverfahren`.

### 4.3 QA/Wissensdatenerstellungsregeln

Machen Sie sich bei der Vorbereitung von QA- oder dokumentenbasiertem Wissen den Umfang der Fragen und Antworten klar.

- Fragen werden in Ausdrücken geschrieben, die tatsächliche Benutzer eingeben können.
- Antworten sollten als direkte Antwort auf die Frage verfasst werden und nicht mehrere Themen in einer Antwort vermischen.
- Bei dokumentbasierten Daten wird die ursprüngliche Textstruktur so organisiert, dass die Unterscheidung zwischen Titel und Text erhalten bleibt.
- Wenn die Tabelle oder Liste wichtig ist, stellen Sie sicher, dass die Bedeutung nach der Konvertierung erhalten bleibt.
- Überprüfen Sie beim Überarbeiten eines Dokuments den Anwendungsstatus, um sicherzustellen, dass vorhandene und neue Dokumente nicht gleichzeitig durchsucht werden.


### 4.1 Betriebsinspektionsaufzeichnungen

Wenn Sie Motoreinstellungen oder Trainingsdaten ändern, notieren Sie die folgenden Elemente.

- Bots und Versionen
- NLU-Methode, Modell, Antwortmethode vor und nach der Änderung
- Absicht/Objekt/Wörterbuch/QA oder Verbindungseinstellungen geändert
- Lern-/Indizierungs-/Anwendeoperationen und Bildschirmstatus ausgeführt
- Repräsentative Erfolgs- und Misserfolgsäußerungen
- Simulator-/Analyse-/Bewertungsergebnisse vor und nach der Änderung

Ohne diesen Datensatz ist es schwierig, die Auswirkungen von Engine-Änderungen von den Auswirkungen von Datenänderungen zu trennen.

## 5. Anleitung für jeden Motor

- [ML-Engine-Auslastung](#6-verwendung-der-ml-engine)
- [Semantic Engine-Nutzung](#7-verwendung-der-semantic-engine)
- [LLM-Engine-Auslastung](#8-verwendung-der-llm-engine)

## 6. Verwendung der ML Engine

### 6.1 Einstellungen

Die im aktuellen Bildschirm als ML-Modelle identifizierten Elemente sind DeepLearning Lite, TF-IDF Linear und Keyword Baseline. Der tatsächliche Lernverbindungsstatus wird zusammen mit den wählbaren Status- und Versionseinstellungen überprüft.

### 6.2 Daten schreiben

- Bereiten Sie repräsentative Ausdrücke und verschiedene Ausdrücke für jede Absicht vor.
- Enthält nur eine Absicht pro Anweisung.
- Absichten, die eine Unterscheidung erfordern, wie z. B. Methoden- und Fehlerabfragen, vermischen keine Ausdrücke.
- Überprüfen Sie die Anzahl der Sätze für jede Absicht und die Vielfalt der Ausdrücke.

### 6.3 Tests und Verbesserungen

1. Bereiten Sie repräsentative Äußerungen bzw. Grenzäußerungen vor.
2. Überprüfen Sie die Ergebnisse im Simulator.
3. Suchen Sie im Analyse-/Bewertungsbildschirm nach Fehlklassifizierungsabsichten und wiederholten Ausdrücken.
4. Korrigieren Sie Daten, um Unterschiede zwischen konkurrierenden Absichten aufzudecken.
5. Trainieren Sie erneut und wiederholen Sie den gleichen Test.

### 6.4 Vorsichtsmaßnahmen

Wir gehen nicht davon aus, dass sich die Qualität automatisch verbessert, indem einfach die Anzahl der Trainingssätze erhöht wird. Anstelle einfacher Suffixänderungen fügen wir Schlüsselausdrücke hinzu, die Absichten und verschiedene Ausdrücke von tatsächlichen Benutzern unterscheiden.

Überprüfen Sie vor dem Ändern von ML:

1. Erklären Sie in einem Satz die Kriterien zur Unterscheidung von Wettbewerbsabsichten.
2. Überprüfen Sie, ob jede Absicht einen repräsentativen Ausdruck, Variantenausdruck oder Grenzausdruck hat.
3. Stellen Sie sicher, dass es keine Lernsätze gibt, die mehrere Absichten in einem Satz vermischen.
4. Testen Sie erneut, ob erfolgreiche Äußerungen vor der Änderung nach der Änderung beibehalten werden.

## 7. Verwendung der Semantic Engine

### 7.1 Typ

- `Semantic - Vector Worker`: Typ mit CGA Vector Worker-Basismodell und Local Vector DB
- `Semantic - External Embedding`: Typ, der externe Einbettung und lokale Vektor-DB verbindet

### 7.2 Einstellungen

Wenn Sie Semantic NLU auswählen, werden die Intent Vector DB-Verbindungseinstellungen angezeigt. Im Typ „Externe Einbettung“ können die Such-API-Adresse, die API-Schlüsselauswahleingabe und der Indexname verwendet werden. Der standardmäßige Vector Worker-Typ löst die Standardverbindung und den Standardindexnamen auf.

### 7.3 Modellauswahl

Der aktuelle Code definiert externe Einbettungsoptionen, einschließlich `ko-sroberta` für koreanische allgemeine Dokumente, `multilingual-e5` für mehrsprachige Dokumente/Tabellen/Formate und `bge-m3` für lange Dokumente/Begriffe. Bei der eigentlichen operativen Auswahl handelt es sich um eine gemeinsame Prüfung der Dokumenteigenschaften, der operativen Konnektivität und der Einbettungskompatibilität.

### 7.4 Tests und Verbesserungen

1. Bereiten Sie repräsentative Fragen und Ausdrücke vor.
2. Überprüfen Sie, ob Absichts- oder Wissensdaten in Vector DB widergespiegelt werden.
3. Im Simulator werden Ausdrücke mit gleicher Bedeutung und Ausdrücke mit unterschiedlicher Bedeutung separat getestet.
4. Überprüfen Sie Suchergebnisse, Ähnlichkeit, Schwellenwert und Indexstatus.
5. Wenn die Suche nicht übereinstimmt, überprüfen Sie die Kombination aus Daten, Einbettung und Index.

> Der tatsächliche Abschlussstatus der Indizierung und der Suchergebnisbildschirm müssen nach der Browser-/Ausführungsüberprüfung bestätigt werden.

Überprüfen Sie vor dem Ändern der Semantik:

1. Stellen Sie sicher, dass das Einbettungsmodell und die durchsuchten Daten kompatibel sind.
2. Stellen Sie sicher, dass der Indexname und das Verbindungsziel mit der aktuellen Bot-Version übereinstimmen.
3. Wenn Sie eine externe Such-API verwenden, erkundigen Sie sich bei Ihrem Administrator nach Antwortspezifikationen und Authentifizierungseinstellungen.
4. Ergebnisse vor der Aktualisierung des Index werden nicht als Qualität neuer Daten interpretiert.

## 8. Verwendung der LLM-Engine

### 8.1 Einstellungen

Wenn Sie LLM Engine auswählen, können Sie den LLM-Anbieter und das detaillierte Modell für jeden Anbieter festlegen. Die auf dem Bildschirm bestätigten Anbieteroptionen sind Gemini, ChatGPT, Claude, Groq, Cerebras, Mistral, Ollama und OpenRouter. Wenn Sie beispielsweise ChatGPT auswählen, werden `GPT-4o mini (Standard)` und `GPT-4o (Hohe Qualität)` angezeigt. Die Liste der Anbieter und Modelle kann je nach Ihren Betriebseinstellungen variieren. Wenn Sie Ollama verwenden, werden möglicherweise separate Adresseinträge angezeigt.

### 8.2 Anweisungen und Antwortmethoden

LLMs sollten die Auswahl des NLU-Modells und die Auswahl der Antwortmethode gemeinsam überprüfen.

- LLM Engine-Antworten: Wie LLM Antworten generiert
- LLM Engine RAG Antwort: Wie man abgerufenes Wissen und LLM zusammen nutzt
- Definierte Antworten: So verwenden Sie vordefinierte Antworten

Anweisungen dokumentieren klar den Ton, das Antwortformat und die Einschränkungen. Nach dem Ändern einer Anweisung vergleichen wir Konsistenz- und Ausnahmeantworten mit demselben Testsatz.

### 8.3 Tests und Verbesserungen

1. Bereiten Sie repräsentative Fragen, mehrdeutige Fragen und verbotene oder Ausnahmefragen vor.
2. Fixanbieter und detailliertes Modell.
3. Wiederholen Sie dieselbe Eingabe, um die Antwortkonsistenz zu überprüfen.
4. Überprüfen Sie die Einhaltung der Richtlinie und die Grundlage für Ihre Antwort.
5. Protokolliert Verzögerungen, Kosten und Fehlerreaktionen.


Prüfung vor LLM-Änderung:

1. Erfassen Sie den Anbieter und das detaillierte Modell vor und nach Änderungen.
2. Vergleichen Sie mit derselben Eingabe-/Anweisungs-/Antwortmethode.
3. Prüfen Sie Realismus, Formatkonformität, verbotene Antworten und Fehlerantworten separat.
4. Wenn Verzögerungen oder Kosten erheblich sind, dokumentieren Sie diese mit Qualitätsergebnissen.

## 9. Analyse und Qualitätsverbesserung

Der Analysebildschirm prüft die kumulierten Klassifizierungsergebnisse und die durchgeführten Schritte. Zu den derzeit auf dem Bildschirm angezeigten Klassifizierungsschritten können Ausschluss/Ignorieren, Smalltalk, Exacting Matching, Regel, ML, Semantik, LLM usw. gehören.

Qualitätsverbesserungssequenz:

1. Fehlgeschlagene Äußerungen sammeln.
2. Überprüfen Sie die tatsächlich angewendeten Klassifizierungsschritte.
3. Isolieren Sie, um welchen Bereich es sich handelt: Absicht, Suche, Direktive oder Antwort.
4. Mindestdatenbereich festlegen.
5. Testen Sie vorhandene erfolgreiche und fehlgeschlagene Äußerungen gemeinsam erneut.

### 9.1 Testset-Konfiguration

Wenn Sie die Engine ändern oder Daten ändern, verwenden Sie nicht nur eine Testäußerung.

| Testsatz | Zweck | Beispielstandards |
|---|---|---|
| Repräsentative Rede | Überprüfen Sie den normalen Hauptnutzungspfad | Häufig verwendete Ausdrücke |
| Modifizierte Äußerung | Verarbeitung auf Ausdrucksänderungen prüfen | Änderungen in Wortreihenfolge, Tonfall und Abständen |
| Grenzäußerung | Sicherstellung der Unterscheidung von Wettbewerbsabsichten | Andere Anfragen mit ähnlichen Wörtern |
| Ausnahmeäußerung | Verarbeitung nicht unterstützter/mehrdeutiger Anfragen prüfen | Fragen, die nicht Teil der Absicht sind |
| rekursive Äußerung | Bestätigen Sie die Aufrechterhaltung der Erfolgsergebnisse vor der Änderung | Zuvor erfolgreiche Äußerung |

Sie müssen vor und nach der Änderung dasselbe Set verwenden, um die Auswirkungen von Engine-Änderungen oder Datenergänzungen zu vergleichen. Die Testergebnisse werden zusammen mit Bot, Version, Engine, Modell und Antwortmethode aufgezeichnet.

## 10. Fehlerreaktion

| Symptome | Zuerst prüfen | Nächste Aktion |
|---|---|---|
| Nicht als erwartete Absicht klassifiziert | Bot·Version·Engine·Datenstatus | Überprüfen Sie gemeinsam repräsentative/grenzüberschreitende Äußerungen und Wettbewerbsabsichten |
| Semantik Keine Ergebnisse gefunden | Vector DB, Index, Einbettungskompatibilität | Überprüfen Sie den Verbindungs-/Index-/Datenreflexionsstatus |
| LLM antwortet schwankend | Anbieter, Modell, Direktive, Eingabe | Vergleichen Sie mit demselben Testsatz und grenzen Sie die Anweisungen ein |
| Studien- oder Bereitschaftsstatus nicht abgeschlossen | Lernhistorie, Fehlermeldungen, Auswahlkombinationen | Bildschirmstatus aufzeichnen und dem Betriebspersonal mitteilen |

Fälle, die bei Validierungs-ML-Bots beobachtet wurden:

- Symptom: Die Lernanfrage wird in der Warteschlange registriert, bleibt aber nach der Aktualisierung bei `Nicht trainiert`
- Simulatorergebnisse: `Nicht klassifizierte Absicht`, `Die Absichtsklassifizierung kann ohne Trainingssätze nicht ausgeführt werden.`
- Beurteilung: Das erfolgreiche Speichern von Trainingssätzen und der Abschluss des ML-Trainings sind separate Zustände, daher wird die Klassifizierungsqualität nicht bewertet, bevor das Training abgeschlossen ist.
- Aktion: Überprüfen Sie den Abschlussstatus des Lernverlaufs. Wenn kein Verlauf vorhanden ist, senden Sie Bot, Version, Engine und Anforderungszeit an den Betriebsmanager.

Passen Sie den Status nicht durch direktes Ändern der Datenbank oder CLI an. Der Bot, die Version, die Engine, die Fehlermeldung und die Auftrittszeit auf dem Bildschirm werden aufgezeichnet und an den Betriebsleiter übermittelt.

## 11. Ausführung und Zustandsbewertung von Lernen und Indexierung

- Prüfen Sie vor der Ausführung Bot-UUID, Version, Sprache, Engine, Modell, Antwortmethode, gespeicherte Assets und den Referenztestsatz.
- ML-Lernen und Semantic-Indexierung können länger als drei Minuten dauern. Eine Anforderungsmeldung allein belegt keinen Erfolg.
- Prüfen Sie den Endzustand im Lernverlauf und führen Sie erst dann den Bot-Test aus. Fehlender Verlauf, unveränderter Status „ungelernt“, leerer Index oder fehlgeschlagener LLM-Aufruf gelten als Fehler.

## 12. Betrieb von Score und Cut-off

1. Notieren Sie die aktuellen Cut-off- und Ähnlichkeitskriterien.
2. Erfassen Sie Score-Verteilungen für richtige, falsche, Grenz- und nicht unterstützte Äußerungen.
3. Ändern Sie jeweils nur ein Kriterium und führen Sie denselben Regressionstestsatz erneut aus.
4. Bewerten Sie Fehlannahmen und Fehlablehnungen; optimieren Sie nicht nur den angezeigten Prozentsatz.

## 13. Mehrsprachiger NLU-Betrieb

CGA unterstützt Koreanisch, Englisch, vereinfachtes Chinesisch, Japanisch, Vietnamesisch, Französisch und Deutsch für UI und Bot-Sprache. Bezeichner und API-Verträge bleiben kanonisch; Äußerungen, Meldungen, Entitäten und Bewertungssätze werden in der Zielsprache erstellt.

Die Nachrichtensuche verwendet zuerst die Anfragesprache und andernfalls die Bot-Sprache. Prüfen Sie Morphologie, Abstände, Höflichkeitsformen, Akzente und sprachspezifische Varianten getrennt und verlassen Sie sich nicht nur auf wörtliche Übersetzung.

## 14. Kontrollierte Engine-Experimente

- Erstellen Sie eine separate Arbeitsversion, statt die Betriebsversion zu überschreiben.
- Fixieren Sie den Testsatz und ändern Sie pro Versuch nur Daten, Schwellenwert, Modell, Provider, Prompt oder Indexeinstellung.
- Protokollieren Sie Genauigkeit, Fehlerart, Antwortkonsistenz, Latenz, Kosten und Betriebsgrenzen.
- Übernehmen Sie nur Versionen, die die vereinbarten Kriterien erfüllen und bestehende Erfolgsfälle bewahren.

## 15. Beispiel zur Qualitätsverbesserung

Trennen Sie bei Lieferanfragen Termin- und Statusanfragen, erstellen Sie repräsentative, variierte, Grenz-, Ausnahme- und Regressionsäußerungen, prüfen Sie die Extraktion der Bestellnummer und vergleichen Sie nach Lernen oder Indexierung alle Sätze erneut. Weniger Fehler reichen nicht aus, wenn frühere Erfolgsfälle Score oder Intent verlieren.

## 16. Checkliste für die Betriebsübernahme

- [ ] Bot-UUID, Version, Sprache, Engine, Modell und Antwortmethode wurden notiert.
- [ ] Vorher/Nachher wurde mit demselben Testsatz verglichen.
- [ ] Lernen oder Indexierung wurde im Verlauf bestätigt.
- [ ] Scores, Konflikte ähnlicher Intents und Regressionen wurden geprüft.
- [ ] Zielsprachige Meldungen und Entitätsextraktion wurden geprüft.
- [ ] Realer Kanal sowie Dialog-, API- und Queue-Verlauf wurden geprüft.

## Verwandte Dokumente

- [Das gesamte CGA-Handbuch ansehen](../README.md)
- [CGA Erste Schritte](../cga-getting-started/README.md)
- [CGA-Benutzerhandbuch](../cga-user-manual/README.md)
- [Motorvergleichstabelle](engine-comparison.md)
