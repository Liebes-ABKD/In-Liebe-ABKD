# Liebes ABKD / In Liebe ABKD – Online-Umfrage

Statische Umfrage-Webseite (HTML, CSS, JavaScript) für die Publikation „Liebes ABKD / In Liebe ABKD“, einen kollektiven (Liebes-)Brief an ABKD. Die Antworten landen über ein Google Apps Script in einem Google Sheet, die Zeichnungen als SVG und PNG im Drive-Ordner „Zeichnungen“.

---

## Inhalt

1. [Was liegt wo?](#1-was-liegt-wo)
2. [Empfohlene Reihenfolge](#2-empfohlene-reihenfolge)
3. [Die Seite lokal ansehen (Entwurfsmodus)](#3-die-seite-lokal-ansehen-entwurfsmodus)
4. [Schriftdateien hinzufügen](#4-schriftdateien-hinzufügen)
5. [Script ins Sheet einfügen und einrichten](#5-script-ins-sheet-einfügen-und-einrichten)
6. [Web-App bereitstellen und URL eintragen](#6-web-app-bereitstellen-und-url-eintragen)
7. [Nach Script-Änderungen: neue Version bereitstellen](#7-nach-script-änderungen-neue-version-bereitstellen)
8. [Dateien ins GitHub-Repository hochladen](#8-dateien-ins-github-repository-hochladen)
9. [GitHub Pages einschalten](#9-github-pages-einschalten)
10. [Modi umschalten und Testdaten löschen](#10-modi-umschalten-und-testdaten-löschen)
11. [Sätze ergänzen, ersetzen, entfernen](#11-sätze-ergänzen-ersetzen-entfernen)
12. [Auswertung und Export für InDesign](#12-auswertung-und-export-für-indesign)
13. [Später: eigene Domain verbinden](#13-später-eigene-domain-verbinden)
14. [Gestaltung anpassen](#14-gestaltung-anpassen)
15. [Wenn etwas nicht klappt](#15-wenn-etwas-nicht-klappt)

---

## 1. Was liegt wo?

```
/
├── index.html      Aufbau der Seite (alle Texte stehen hier)
├── style.css       Gestaltung – alle Farben, Größen, Abstände oben als Variablen
├── fonts.css       Einbindung der Schriften
├── script.js       Funktion der Seite
├── config.js       EINSTELLUNGEN: Modus und Web-App-Adresse
├── saetze.js       die Satzliste
├── fonts/          Schriftdateien (WOFF2) + Lizenzen
├── lib/            signature_pad (Zeichenfläche) + Lizenz
└── apps-script/    Kopie des Google-Scripts (nur zur Versionierung)
    ├── Code.gs     das Backend
    └── Saetze.gs   = derselbe Inhalt wie saetze.js
```

Alle Pfade auf der Seite sind relativ (`./style.css`), deshalb läuft die Seite ohne Änderungen lokal, unter `liebes-abkd.github.io/In-Liebe-ABKD/` und später unter eurer eigenen Domain. Einzige Ausnahme ist die Link-Vorschau-Angabe `og:url` in `index.html`: WhatsApp & Co. verlangen dort eine volle Adresse (siehe [Abschnitt 13](#13-später-eigene-domain-verbinden)).

Die Seite lädt nichts von fremden Servern: keine CDNs, kein Google Fonts, kein Tracking. Die einzige Verbindung nach außen ist das Absenden an euer Apps Script.

---

## 2. Empfohlene Reihenfolge

1. **Kurzer Frühtest der Verbindung im Testmodus.** Script einrichten (Abschnitt 5 und 6), in `config.js` `MODUS = "test"` und die URL eintragen, die Seite lokal öffnen (Abschnitt 3) und ein- bis zweimal absenden. Prüfen, ob Zeilen im Sheet und Dateien im Ordner auftauchen.
2. **Testdaten löschen** (Menü „Umfrage“ → „Testdaten löschen“).
3. **Gestaltung im Entwurfsmodus.** `MODUS = "entwurf"`, Schriften hinzufügen (Abschnitt 4), `style.css` und Texte in `index.html` anpassen.
4. **Ausführlicher Test auf GitHub Pages** (Handy und Desktop): hochladen (Abschnitt 8), Pages einschalten (Abschnitt 9), `MODUS = "test"`, auf mehreren Geräten durchspielen.
5. **Testdaten löschen.**
6. **Live schalten:** `MODUS = "live"`, `config.js` hochladen, Link verteilen.

---

## 3. Die Seite lokal ansehen (Entwurfsmodus)

In `config.js` muss `var MODUS = "entwurf";` stehen. Dann wird nichts gesendet. Das Absenden wird nur simuliert und danach erscheint die Danke-Seite.

**Variante A: direkt öffnen.** Doppelklick auf `index.html`. Das funktioniert, aber manche Browser (vor allem Firefox) laden dann die Schriftdateien nicht. Für die Gestaltung ist deshalb Variante B besser.

**Variante B: kleiner lokaler Server (empfohlen).**

1. Terminal öffnen (Mac: Programme → Dienstprogramme → Terminal).
2. In den Projektordner wechseln: `cd ` tippen (mit Leerzeichen dahinter), den Projektordner ins Terminal-Fenster ziehen, Enter drücken.
3. `python3 -m http.server 8000` eingeben und Enter drücken.
4. Im Browser `http://localhost:8000` öffnen.
5. Beenden: im Terminal `ctrl` + `C` drücken.

**Daten ansehen, die gesendet würden:** Rechtsklick auf die Seite → „Untersuchen“ → Reiter „Konsole“. Nach dem Absenden stehen dort die fünf Sätze, die Farbe und die Größe der Zeichnung. Unter `window.letzteEinsendung` liegt alles komplett, auch die Bilddaten.

**Am Handy testen (im selben WLAN):** Mit Variante B am Mac unter Systemeinstellungen → WLAN → Details die IP-Adresse nachsehen (z. B. `192.168.0.23`), dann am Handy `http://192.168.0.23:8000` öffnen.

---

## 4. Schriftdateien hinzufügen

Verwendet werden **Pinyon Script** (Schreibschrift für Akzente) und **Inter Regular** (oder Inter als variable Schrift), jeweils als **WOFF2**. **Ballet** ist zusätzlich eingebunden, falls ihr zurückwechseln wollt (in `style.css` bei `--schrift-akzent`).

> Achtung: Der Download direkt bei Google Fonts liefert TTF-Dateien, kein WOFF2.

So bekommt ihr WOFF2:

- **Pinyon Script / Ballet:** über den „google-webfonts-helper“ (gwfh.mranftl.com/fonts/pinyon-script bzw. …/fonts/ballet). Zeichensatz „latin“ und den Schnitt „regular“ wählen, herunterladen. Alternativ die TTF von Google Fonts mit einem Konverter (TTF → WOFF2) umwandeln.
- **Inter:** von der offiziellen Seite rsms.me/inter herunterladen. Im Paket liegen WOFF2-Dateien (`Inter-Regular.woff2` und `InterVariable.woff2`).

Dann:

1. Dateien in den Ordner `fonts/` legen und so benennen:
   - `pinyon-script-v24-latin-regular.woff2` (so wie vom google-webfonts-helper geliefert) und `Ballet-Regular.woff2`
   - `Inter-Regular.woff2`, **oder** `InterVariable.woff2` (dann in `fonts.css` auf die „Alternative“ umstellen, die Anleitung steht in der Datei)
2. Wenn ihr die Dateien anders nennt, einfach den Namen in `fonts.css` bei `url("./fonts/…")` eintragen.
3. Lizenzen: Für jede Schrift die `OFL.txt` mit in `fonts/` legen, jeweils mit eigenem Namen, damit sie sich nicht überschreiben (z. B. `OFL.txt` für Ballet, `Pinyon_OFL.txt`, `Inter-OFL.txt`).
4. Seite neu laden (am besten mit Variante B aus Abschnitt 3).

Solange die Dateien fehlen, nutzt die Seite Ersatzschriften (Systemschriften). Das ist so gewollt.

---

## 5. Script ins Sheet einfügen und einrichten

Alles im **Google-Projekt-Account**.

1. Das (leere) Google Sheet öffnen → **Erweiterungen → Apps Script**.
2. Im Editor gibt es eine Datei `Code.gs` mit ein paar Zeilen Beispielcode. Diese komplett löschen und den gesamten Inhalt von `apps-script/Code.gs` einfügen.
3. Links neben „Dateien“ auf **+** → **Script** klicken, die neue Datei `Saetze` nennen (wird zu `Saetze.gs`). Den gesamten Inhalt von `saetze.js` hineinkopieren.
4. **Ordner-ID eintragen:** Den Drive-Ordner „Zeichnungen“ öffnen. Die Adresse sieht so aus: `https://drive.google.com/drive/folders/1AbCdEf…`. Der Teil nach `folders/` ist die ID. In `Code.gs` ganz oben eintragen:
   `var FOLDER_ID = "1AbCdEf…";`
5. Speichern (Disketten-Symbol oder `cmd` + `S`).
6. **Zeitzone prüfen:** im Apps-Script-Editor links auf das Zahnrad (Projekteinstellungen) → Zeitzone „(GMT+01:00) Berlin“. Im Sheet: Datei → Einstellungen → Zeitzone ebenfalls Berlin.
7. Das Sheet im Browser neu laden. Nach ein paar Sekunden erscheint oben das Menü **„Umfrage“**.
8. **Umfrage → Einrichten.** Beim ersten Mal fragt Google nach Berechtigungen:
   - „Autorisierung erforderlich“ → **Weiter** → den Projekt-Account wählen.
   - Es erscheint „Google hat diese App nicht überprüft“. Das ist bei eigenen Scripts normal: **Erweitert** → **Zu … wechseln (unsicher)** → **Zulassen**.
   - Danach **Einrichten** noch einmal ausführen.
9. Ergebnis: die Tabs „Teilnahmen“, „Antworten“, „Sätze“ und „Auswertung“, jeweils mit geschützter Kopfzeile. (Der Schutz ist eine Warnung: Wer eine Kopfzeile ändern will, wird gefragt, ob das wirklich sein soll.)
10. **Umfrage → Sätze aktualisieren** füllt den Tab „Sätze“ mit allen Sätzen.
11. **Umfrage → Verbindung testen** prüft, ob Sheet, Tabs und Ordner erreichbar sind.

> Den Drive-Ordner „Zeichnungen“ nicht öffentlich freigeben. Das Script braucht das nicht, weil es mit eurem Account schreibt.

---

## 6. Web-App bereitstellen und URL eintragen

1. Im Apps-Script-Editor oben rechts: **Bereitstellen → Neue Bereitstellung**.
2. Beim Zahnrad neben „Typ auswählen“ → **Web-App**.
3. Einstellungen:
   - Beschreibung: z. B. „Umfrage v1“
   - **Ausführen als: Ich** (der Projekt-Account)
   - **Zugriff: Jeder** (wirklich „Jeder“, nicht „Jeder mit Google-Konto“)
4. **Bereitstellen** → ggf. Zugriff autorisieren (wie in Abschnitt 5).
5. Die **Web-App-URL** kopieren. Sie endet auf `/exec`.
6. Kurztest: Die URL im Browser öffnen. Dort sollte „läuft – Umfrage-Backend abkd-ichliebedich“ stehen (der alte Projektname im Script ist nur ein Text und kann so bleiben).
7. In `config.js` eintragen:
   `var WEB_APP_URL = "https://script.google.com/macros/s/…/exec";`

---

## 7. Nach Script-Änderungen: neue Version bereitstellen

Änderungen an `Code.gs` oder `Saetze.gs` gelten für die Web-App **erst, wenn ihr eine neue Version bereitstellt**. Damit die URL gleich bleibt, keine neue Bereitstellung anlegen, sondern die bestehende aktualisieren:

1. **Bereitstellen → Bereitstellungen verwalten**
2. Die aktive Bereitstellung auswählen → **Bearbeiten** (Stift-Symbol)
3. Bei „Version“: **Neue Version** wählen
4. **Bereitstellen**

Die URL bleibt dieselbe, `config.js` muss nicht geändert werden.
(Die Menüpunkte im Sheet nutzen immer sofort den aktuellen Code. Das gilt nur für die Web-App.)

Legt danach auch die geänderte Datei in `apps-script/` im Repository ab, damit die Kopie aktuell bleibt.

---

## 8. Dateien ins GitHub-Repository hochladen

Repository: Organisation **liebes-abkd**, Repository **In-Liebe-ABKD**. Lokaler Ordner (GitHub Desktop): `Dokumente/GitHub/In-Liebe-ABKD`.

**Variante A: im Browser**

1. Repository auf github.com öffnen → **Add file → Upload files**.
2. Den **Inhalt** des Projektordners (nicht den Ordner selbst) ins Fenster ziehen, also `index.html`, `style.css` … und die Ordner `fonts`, `lib`, `apps-script`. Ordner werden mit hochgeladen.
3. Unten eine kurze Beschreibung eintragen (z. B. „Schriften ergänzt“) → **Commit changes** (in den Branch `main`).
4. Einzelne geänderte Dateien (z. B. nur `config.js`) könnt ihr genauso hochladen. Gleichnamige Dateien werden ersetzt.

**Variante B: GitHub Desktop**

1. GitHub Desktop installieren, anmelden.
2. **File → Clone repository** → `liebes-abkd/In-Liebe-ABKD` → einen Speicherort wählen.
3. Die Projektdateien in diesen Ordner kopieren (bzw. dort weiterarbeiten).
4. In GitHub Desktop erscheinen die Änderungen. Unten links eine Beschreibung eintragen → **Commit to main** → oben **Push origin**.

Nach dem Hochladen dauert es 1–2 Minuten, bis die Seite aktualisiert ist. Falls ihr noch die alte Version seht: Seite neu laden mit `cmd` + `shift` + `R`.

---

## 9. GitHub Pages einschalten

1. Das Repository muss auf **Public** stehen: Settings → General → ganz unten „Danger Zone“ → **Change visibility** → Public. (GitHub Pages für private Repositories gibt es nur in kostenpflichtigen Tarifen.)
   Im Repository steht dann nur, was hier sowieso öffentlich ist: die Webseite und die Script-Kopie ohne Passwörter. Die Ordner-ID allein gibt niemandem Zugriff auf den Ordner.
2. **Settings → Pages**
3. Bei „Build and deployment“: Source **Deploy from a branch**, Branch **main**, Ordner **/ (root)** → **Save**.
4. Nach 1–2 Minuten ist die Seite erreichbar unter
   **https://liebes-abkd.github.io/In-Liebe-ABKD/**

---

## 10. Modi umschalten und Testdaten löschen

Alles in `config.js` (nach jeder Änderung hochladen):

| Modus | Was passiert | Hinweis auf der Seite |
|---|---|---|
| `"entwurf"` | Nichts wird gesendet, das Absenden wird simuliert, die Daten stehen in der Konsole | „Entwurfsmodus“ |
| `"test"` | Wird echt gesendet, aber mit `test = WAHR` markiert, die Zeichnungen heißen `TEST_symbol_…` | „Testmodus“ |
| `"live"` | Echte Einsendungen | keiner |

**Testen trotz Live-Modus:** `?test=1` an die Adresse hängen, z. B.
`https://liebes-abkd.github.io/In-Liebe-ABKD/?test=1`
Dann wird als Test gesendet und der Hinweis „Testmodus“ erscheint.

**Testdaten löschen:** Im Sheet **Umfrage → Testdaten löschen** → Sicherheitsabfrage mit „Ja“ bestätigen. Gelöscht werden nur Zeilen mit `test = WAHR` in „Teilnahmen“ und „Antworten“ sowie alle Dateien, deren Name mit `TEST_` beginnt (sie landen im Drive-Papierkorb und lassen sich dort 30 Tage lang wiederherstellen). Echte Einsendungen werden nie angefasst. Am Ende zeigt eine Meldung, wie viel gelöscht wurde.

---

## 11. Sätze ergänzen, ersetzen, entfernen

Die Sätze stehen in `saetze.js`, ein Eintrag pro Satz:

```js
{ id: "s226", text: "Ich habe heimlich ____ gekernt." },
```

**Regeln für IDs**

- Jede ID ist fest und eindeutig: `s001`, `s002` …
- Eine ID wird **nie geändert und nie neu vergeben**, auch nicht, wenn der Satz gelöscht wurde.
- Neue Sätze bekommen die **nächste freie Nummer** (höchste je vergebene + 1). Die höchste bisher vergebene ID steht oben im Kommentar von `saetze.js`. Bitte dort mitpflegen.

**Lücken:** jede Lücke = genau vier Unterstriche `____`. Ein Satz kann eine oder mehrere Lücken haben, am Anfang, in der Mitte oder am Ende. Anführungszeichen im Satz bitte als „…“ schreiben, nicht als `"…"`.

**So geht's**

| Was | Schritte |
|---|---|
| **Neuer Satz** | Eintrag mit der nächsten freien ID in `saetze.js` ergänzen → hochladen. Fertig. |
| **Satz entfernen** | Eintrag aus `saetze.js` löschen → hochladen. Bisherige Antworten bleiben erhalten, die ID wird nie wieder benutzt. |
| **Satz ersetzen / umformulieren** | Alten Eintrag löschen, neuen mit **neuer** ID anlegen → hochladen. |
| **Tippfehler korrigieren** | Direkt im Text korrigieren, die ID bleibt → hochladen. |

**Danach (optional, aber empfohlen):** Den kompletten neuen Inhalt von `saetze.js` ins Apps Script in die Datei `Saetze.gs` kopieren (alles ersetzen), speichern, dann im Sheet **Umfrage → Sätze aktualisieren** ausführen. Das trägt neue Sätze und korrigierte Texte in den Tab „Sätze“ ein. Sätze, die ihr entfernt habt, bleiben im Tab stehen (für die alten Antworten), und die Spalte „notiz“ wird nie verändert. Eine neue Web-App-Version ist dafür nicht nötig.

Wenn ihr das vergesst, ist es nicht schlimm: Sobald jemand einen neuen Satz beantwortet, trägt das Backend ihn automatisch mit seinem Text in den Tab „Sätze“ ein.

Im Tab „Sätze“ ist die Spalte „notiz“ für euch frei.

**Gleichmäßige Verteilung:** Damit am Ende jeder Satz ungefähr gleich viele Antworten hat, fragt die Webseite beim Laden ab, wie oft jeder Satz schon (echt, ohne Tests) beantwortet wurde. Selten beantwortete Sätze werden dann häufiger gezeigt (Gewicht = 1 ÷ (1 + Anzahl Antworten)). Kein Satz wird je ausgeschlossen. Die Zählung wird im Script 90 Sekunden zwischengespeichert. Antwortet das Script nicht innerhalb von 3 Sekunden, und immer im Entwurfsmodus, werden die Sätze wie früher rein zufällig gewählt – die Umfrage wird dadurch nie blockiert. Die Wartezeit steht oben in `script.js` (`ZAEHLUNG_WARTEZEIT_MS`). Prüfen könnt ihr die Zählung, indem ihr die Web-App-Adresse mit `?aktion=zaehlung` am Ende im Browser öffnet.

---

## 12. Auswertung und Export für InDesign

**Tabs im Sheet**

- **Teilnahmen:** eine Zeile pro Person (ID, Zeitstempel, Test, CMYK, Hex, Dateinamen der Zeichnungen mit Link, Nutzername, Datum, Uhrzeit). Nur Rohdaten.
- **Antworten:** eine Zeile pro Satz (Satz mit Lücken, vollständiger Satz, eingesetzte Wörter getrennt durch „ | “, Nutzername, Datum, Uhrzeit). Nur Rohdaten.
- **Sätze:** alle Sätze, die es je gab, mit einer freien Spalte für Notizen.
- **Auswertung:** zeigt per Formel automatisch alle echten Antworten (ohne Tests) mit Nutzername, Datum, Uhrzeit und Hex-Farbe. Zum Filtern, z. B. nach Satz: Daten → Filter erstellen (oder Filteransichten). Nicht hineinschreiben und nicht sortieren, sonst geht die Formel in Zelle A2 kaputt. Falls doch: einfach „Einrichten“ erneut ausführen.

Die Rohdaten-Tabs bitte nicht von Hand umsortieren oder Spalten verschieben, weil das Script feste Spaltenpositionen erwartet. Neue Spalten werden im Script immer rechts angehängt; „Einrichten“ ergänzt sie dann in den bestehenden Tabs, ohne vorhandene Daten zu verändern.

`datum` (TT.MM.JJJJ) und `uhrzeit` (HH:MM) werden beim Speichern vom Script gesetzt (Zeitzone Berlin) und als Text gespeichert, damit Google Sheets sie nicht umwandelt.

**Export für InDesign**

1. **Umfrage → Export für InDesign.** Das erzeugt bzw. erneuert den Tab „Export InDesign“: eine Zeile pro echtem Antwortsatz, sortiert nach Satz, mit
   `teilnahme_id, zeitstempel, satz_id, satz, antwort, luecken, luecke_1 …, nutzername, datum, uhrzeit, c, m, y, k, hex, @symbol`
   Die Spalte `@symbol` enthält den relativen Bildpfad `Zeichnungen/symbol_<id>.png`.
   Zeilenumbrüche in Antworten werden hier durch Leerzeichen ersetzt, weil die Datenzusammenführung damit nicht umgehen kann. In „Antworten“ bleiben sie erhalten.
2. Im Tab „Export InDesign“: **Datei → Herunterladen → Kommagetrennte Werte (.csv)**.
3. In Drive den Ordner „Zeichnungen“ herunterladen (Rechtsklick → Herunterladen, kommt als ZIP) und entpacken.
4. CSV-Datei und Ordner `Zeichnungen` **nebeneinander** in denselben Ordner legen.
5. InDesign: Fenster → Hilfsprogramme → **Datenzusammenführung** → Datenquelle auswählen → „Importoptionen anzeigen“ aktivieren → Trennzeichen Komma, Kodierung **Unicode**. Werden Umlaute falsch angezeigt, die CSV in einem Texteditor als UTF-16 speichern und erneut laden.
6. Emojis erscheinen in InDesign nur mit einer Schrift, die Emojis enthält.

Die Zeichnungen sind schwarz auf transparentem Grund. PNG ist 2000 px breit, SVG als Vektor. Die SVGs lassen sich in Illustrator/InDesign frei umfärben.

---

## 13. Später: eigene Domain verbinden

1. Bei eurem Domain-Anbieter einen DNS-Eintrag anlegen:
   - für eine **Subdomain** (z. B. `umfrage.eure-domain.de`): einen **CNAME** auf `liebes-abkd.github.io`
   - für die **Hauptdomain** (`eure-domain.de`): vier **A-Einträge** auf `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
2. Im Repository: **Settings → Pages → Custom domain** → Domain eintragen → **Save**. GitHub legt dabei automatisch eine Datei `CNAME` im Repository an. Die nicht löschen.
3. Wenn die Prüfung durch ist (kann bis zu einem Tag dauern): **Enforce HTTPS** anhaken.
4. In `index.html` die Link-Vorschau-Adresse anpassen und hochladen:
   - `og:url` → `https://eure-domain.de/`

Sonst muss nichts geändert werden, weil alle anderen Pfade relativ sind. Die alte github.io-Adresse leitet danach automatisch auf die neue Domain weiter.

Tipp: In den Einstellungen der Organisation unter „Pages“ kann die Domain zusätzlich „verifiziert“ werden. Das schützt davor, dass jemand anderes sie mit GitHub verknüpft.

---

## 14. Gestaltung anpassen

- **Alle Farben, Schriften, Größen, Abstände, Linien und Radien** stehen als Variablen ganz oben in `style.css` (`:root { … }`). Meist reicht es, dort zu ändern.
- **Pink:** `--farbe-pink`. Achtung Kontrast: `#E5007D` auf Weiß erreicht knapp das Minimum von 4,5 : 1 für gut lesbaren Text. Hellere Pinktöne fallen darunter.
- **Schriften** werden nur über `--schrift-akzent` (Pinyon Script) und `--schrift-text` (Inter) verwendet.
- **Texte** (Überschriften, Hinweise, Danke-Satz …) stehen in `index.html`. Mit `PLATZHALTER` markierte Stellen sind Vorschläge.
- **Stiftfarbe beim Zeichnen** am Bildschirm: `--farbe-stift` in `style.css`. Die Farbe der exportierten Dateien (Schwarz), Strichstärke und PNG-Breite stehen oben in `script.js` unter „Feineinstellungen“.
- **Link-Vorschau:** Titel und Beschreibung in `index.html` (`og:title`, `og:description`). Es gibt bewusst kein Vorschaubild – beim Teilen erscheint nur Text.
- **Favicon:** Es gibt bewusst keins; der Browser zeigt sein Standard-Symbol.

Bedienung per Tastatur: `Tab` springt von Lücke zu Lücke, `Enter` springt in die nächste Lücke, `Umschalt` + `Enter` macht einen Zeilenumbruch in der Antwort. Die Zeichenfläche selbst lässt sich naturgemäß nur mit Maus, Finger oder Stift bedienen.

---

## 15. Wenn etwas nicht klappt

**„Das hat leider nicht geklappt …“ beim Absenden**
- Stimmt die `WEB_APP_URL` in `config.js` (endet auf `/exec`)? Im Browser öffnen, dort muss „läuft“ stehen.
- Steht die Web-App auf **Zugriff: Jeder**? (Bereitstellungen verwalten → Bearbeiten)
- Nach einer Script-Änderung eine **neue Version** bereitgestellt? (Abschnitt 7)
- Genauere Fehlermeldungen stehen in der Browser-Konsole (Rechtsklick → Untersuchen → Konsole).
- Im Apps-Script-Editor links unter **Ausführungen** stehen alle Aufrufe mit eventuellen Fehlern.

**Menü „Umfrage“ fehlt:** Sheet neu laden und ein paar Sekunden warten. Falls immer noch nicht: Im Apps-Script-Editor oben die Funktion `onOpen` auswählen und auf „Ausführen“ klicken.

**„Verbindung testen“ meldet, dass der Drive-Ordner nicht erreichbar ist:** `FOLDER_ID` prüfen (nur der Teil nach `folders/`, ohne `?usp=…`). Ordner und Sheet müssen im selben Account liegen.

**„Auswertung“ zeigt `#ERROR!` („Fehler beim Parsen der Formel“):** „Einrichten“ probiert die Formel-Schreibweisen mit `,` und `;` automatisch durch. Falls trotzdem ein Fehler bleibt, die vier Formeln von Hand eintragen (die Warnung beim Bearbeiten der geschützten Zeile bestätigen):

| Zelle | Formel |
|---|---|
| A2 | `=WENNFEHLER(FILTER('Antworten'!A2:B; 'Antworten'!A2:A<>""; 'Antworten'!C2:C<>WAHR); "")` |
| C2 | `=WENNFEHLER(FILTER('Antworten'!D2:G; 'Antworten'!A2:A<>""; 'Antworten'!C2:C<>WAHR); "")` |
| G2 | `=WENNFEHLER(FILTER('Antworten'!H2:J; 'Antworten'!A2:A<>""; 'Antworten'!C2:C<>WAHR); "")` |
| J2 | `=ARRAYFORMULA(WENNFEHLER(FILTER(WENNFEHLER(SVERWEIS('Antworten'!A2:A; 'Teilnahmen'!A2:H; 8; 0); ""); 'Antworten'!A2:A<>""; 'Antworten'!C2:C<>WAHR); ""))` |

**Die Seite zeigt noch die alte Version:** 1–2 Minuten warten, dann mit `cmd` + `shift` + `R` neu laden.

**Die Schriften erscheinen nicht:** Dateinamen in `fonts/` und `fonts.css` vergleichen (Groß- und Kleinschreibung zählt online!). Lokal Variante B aus Abschnitt 3 nutzen.

**Es kann tagelang niemand teilnehmen:** Das ist kein Problem. Die Web-App „schläft“ nicht ein und braucht keine Wartung.
