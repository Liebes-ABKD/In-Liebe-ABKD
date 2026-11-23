/* =====================================================================
   BACKEND – abkd-ichliebedich (Google Apps Script)
   =====================================================================
   Dieses Script gehört in das Google Sheet:
     Erweiterungen → Apps Script → Datei „Code.gs“ (diesen Inhalt einfügen)
   Zusätzlich braucht es die Datei „Saetze.gs“ (= Inhalt von saetze.js).

   Was es tut:
   - doPost: nimmt Einsendungen der Webseite an, prüft sie und speichert
     sie im Sheet (Tabs „Teilnahmen“, „Antworten“, „Sätze“) und die
     Zeichnungen im Drive-Ordner „Zeichnungen“.
   - doGet:  einfacher Funktionstest im Browser („läuft“) und – mit
     ?aktion=zaehlung – wie oft jeder Satz schon beantwortet wurde
     (damit die Webseite seltene Sätze bevorzugt zeigen kann).
   - Menü „Umfrage“ im Sheet: Einrichten, Sätze aktualisieren,
     Verbindung testen, Testdaten löschen, Export für InDesign.

   Gespeichert werden KEINE IP-Adressen, Namen oder sonstigen
   personenbezogenen Daten – nur Zeitstempel, Antworten, Farbe, Zeichnung.
   ===================================================================== */


/* =====================================================================
   EINSTELLUNGEN – hier eintragen bzw. anpassen
   ===================================================================== */

// ID des Drive-Ordners „Zeichnungen“.
// So findet ihr sie: Ordner in Google Drive öffnen, die Adresse sieht so aus:
//   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
// Die ID ist der Teil nach „folders/“.
var FOLDER_ID = "1i98KGojnSyEjEhx2aXO2FGsdq1A4PR8C";

// Namen aller Tabs (nur hier ändern, falls ihr Tabs umbenennen wollt –
// und danach „Einrichten“ ausführen)
var TAB_TEILNAHMEN = "Teilnahmen";
var TAB_ANTWORTEN  = "Antworten";
var TAB_SAETZE     = "Sätze";
var TAB_AUSWERTUNG = "Auswertung";
var TAB_EXPORT     = "Export InDesign";

// Ordnername, der im InDesign-Export vor den Bilddateinamen gesetzt wird
// (relativer Pfad: CSV-Datei und Ordner „Zeichnungen“ liegen nebeneinander)
var EXPORT_BILDORDNER = "Zeichnungen";

// Präfix für Test-Zeichnungen
var TEST_PRAEFIX = "TEST_";

// Prüfregeln
var ANZAHL_SAETZE        = 5;
var MAX_ZEICHEN_PRO_SATZ = 300;              // alle Lücken eines Satzes zusammen
var MAX_SATZ_LAENGE      = 600;              // Länge des Satztextes selbst
var MAX_BILD_BYTES       = 5 * 1024 * 1024;  // max. 5 MB pro Bild (SVG bzw. PNG)
var MIN_PNG_BREITE       = 1500;             // PNG muss mind. so breit sein (Pixel)
var LUECKE               = "____";
var NUTZERNAME_MIN       = 2;                // Nutzername: mind. 2 Zeichen …
var NUTZERNAME_MAX       = 30;               // … und höchstens 30 Zeichen
// Emojis sind im Nutzernamen nicht erlaubt (gleiche Regel wie auf der Webseite).
// Typografische Zeichen wie © ™ ♥ ★ bleiben erlaubt.
var EMOJI_MUSTER = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}\u20E3\uFE0F\u200D]/u;

// Zeitzone für die Spalten „datum“ und „uhrzeit“
var ZEITZONE             = "Europe/Berlin";

// Kopfzeilen der Tabs (Reihenfolge = Spaltenreihenfolge)
// Neue Spalten immer nur RECHTS anhängen – „Einrichten“ ergänzt sie dann in
// bestehenden Tabs, ohne vorhandene Spalten oder Daten zu verändern.
var KOPF_TEILNAHMEN = ["id", "zeitstempel", "test", "c", "m", "y", "k", "hex", "symbol_svg", "symbol_png",
                       "nutzername", "datum", "uhrzeit"];
var KOPF_ANTWORTEN  = ["teilnahme_id", "zeitstempel", "test", "satz_id", "satz", "antwort", "luecken",
                       "nutzername", "datum", "uhrzeit"];
var KOPF_SAETZE     = ["satz_id", "satz", "notiz"];
var KOPF_AUSWERTUNG = ["teilnahme_id", "zeitstempel", "satz_id", "satz", "antwort", "luecken",
                       "nutzername", "datum", "uhrzeit", "hex"];

// Zählung der Antworten pro Satz (für die gleichmäßigere Verteilung):
// Das Ergebnis wird kurz zwischengespeichert, damit viele gleichzeitige
// Aufrufe schnell bleiben. Neue Antworten zählen spätestens danach mit.
var ZAEHLUNG_CACHE_SEKUNDEN  = 90;
var ZAEHLUNG_CACHE_SCHLUESSEL = "zaehlung_v1";

// Zahlenformate der Spalten (Spaltennummer: Format).
// "@" = reiner Text → verhindert, dass eine Antwort wie „=…“ als Formel
// oder „3.4“ als Datum gelesen wird.
var FORMAT_DATUM = "dd.MM.yyyy HH:mm:ss";
var FORMATE_TEILNAHMEN = { 1: "@", 2: FORMAT_DATUM, 4: "0", 5: "0", 6: "0", 7: "0", 8: "@", 9: "@", 10: "@",
                           11: "@", 12: "@", 13: "@" };
var FORMATE_ANTWORTEN  = { 1: "@", 2: FORMAT_DATUM, 4: "@", 5: "@", 6: "@", 7: "@",
                           8: "@", 9: "@", 10: "@" };
var FORMATE_SAETZE     = { 1: "@", 2: "@", 3: "@" };

var KOPF_SCHUTZ_NAME = "Kopfzeile (vom Script geschützt)";


/* =====================================================================
   MENÜ IM SHEET
   ===================================================================== */

// Läuft automatisch beim Öffnen des Sheets
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Umfrage")
    .addItem("Einrichten", "menueEinrichten")
    .addItem("Sätze aktualisieren", "saetzeAktualisieren")
    .addItem("Verbindung testen", "verbindungTesten")
    .addSeparator()
    .addItem("Testdaten löschen", "testdatenLoeschen")
    .addItem("Export für InDesign", "exportFuerInDesign")
    .addToUi();
}


/* =====================================================================
   WEB-APP: Funktionstest und Einsendungen
   ===================================================================== */

// Aufruf der Web-App-Adresse im Browser → „läuft“
// Aufruf mit ?aktion=zaehlung → { ok: true, zaehlung: { "s001": 3, … } }
function doGet(e) {
  var aktion = e && e.parameter ? String(e.parameter.aktion || "") : "";
  if (aktion === "zaehlung") {
    try {
      return jsonAntwort({ ok: true, zaehlung: antwortenZaehlen() });
    } catch (fehler) {
      console.error("Fehler bei der Zählung: " + (fehler && fehler.stack ? fehler.stack : fehler));
      return jsonAntwort({ ok: false, fehler: "server" });
    }
  }
  return ContentService
    .createTextOutput("läuft – Umfrage-Backend abkd-ichliebedich")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Zählt pro satz_id die echten Antworten (Testdaten werden nicht mitgezählt).
// Ergebnis wird ZAEHLUNG_CACHE_SEKUNDEN lang zwischengespeichert.
function antwortenZaehlen() {
  var cache = CacheService.getScriptCache();
  var gespeichert = cache.get(ZAEHLUNG_CACHE_SCHLUESSEL);
  if (gespeichert) return JSON.parse(gespeichert);

  var zaehlung = {};
  var tab = SpreadsheetApp.getActive().getSheetByName(TAB_ANTWORTEN);
  if (tab && tab.getLastRow() >= 2) {
    // Spalten A–D: teilnahme_id, zeitstempel, test, satz_id
    tab.getRange(2, 1, tab.getLastRow() - 1, 4).getValues().forEach(function (z) {
      if (z[0] === "" || z[2] === true) return;   // leere Zeile oder Test
      var satzId = String(z[3]);
      if (!satzId) return;
      zaehlung[satzId] = (zaehlung[satzId] || 0) + 1;
    });
  }
  cache.put(ZAEHLUNG_CACHE_SCHLUESSEL, JSON.stringify(zaehlung), ZAEHLUNG_CACHE_SEKUNDEN);
  return zaehlung;
}

// Empfängt eine Einsendung der Webseite (JSON als Text)
function doPost(e) {
  try {
    var roh = e && e.postData ? e.postData.contents : "";
    if (!roh) {
      return jsonAntwort({ ok: false, fehler: "leer", meldung: "Es sind keine Daten angekommen." });
    }
    if (roh.length > 4 * MAX_BILD_BYTES) {
      return jsonAntwort({ ok: false, fehler: "zu_gross", meldung: "Die Einsendung ist zu groß." });
    }

    var daten;
    try {
      daten = JSON.parse(roh);
    } catch (f) {
      return jsonAntwort({ ok: false, fehler: "ungueltig", meldung: "Die Daten konnten nicht gelesen werden." });
    }

    // Spam-Schutz: Honigtopf-Feld ausgefüllt → still „ok“ melden, nichts speichern
    if (daten && daten.website) {
      return jsonAntwort({ ok: true, id: "" });
    }

    var geprueft = einsendungPruefen(daten);
    var id = einsendungSpeichern(geprueft);
    return jsonAntwort({ ok: true, id: id });

  } catch (fehler) {
    if (fehler && fehler.istPruefung) {
      return jsonAntwort({ ok: false, fehler: "ungueltig", meldung: fehler.message });
    }
    console.error("Fehler beim Speichern: " + (fehler && fehler.stack ? fehler.stack : fehler));
    return jsonAntwort({
      ok: false,
      fehler: "server",
      meldung: "Auf unserer Seite ist ein Fehler passiert. Bitte versuch es gleich noch einmal."
    });
  }
}

function jsonAntwort(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}


/* =====================================================================
   PRÜFEN
   ===================================================================== */

// Fehler, die an die Teilnehmenden zurückgemeldet werden dürfen
function pruefFehler(meldung) {
  var f = new Error(meldung);
  f.istPruefung = true;
  return f;
}

// zählt Zeichen so, dass ein Emoji als 1 Zeichen zählt (wie auf der Webseite)
function zeichenAnzahl(text) {
  return Array.from(text).length;
}

// Steuerzeichen entfernen, Zeilenumbrüche vereinheitlichen
function textSaeubern(text) {
  return String(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function einsendungPruefen(d) {
  if (!d || typeof d !== "object") throw pruefFehler("Die Daten sind unvollständig.");
  if (d.einverstanden !== true) throw pruefFehler("Das Einverständnis fehlt.");

  // --- Nutzername (Pflicht, 2–30 Zeichen, Leerzeichen am Rand entfernt) ---
  if (typeof d.nutzername !== "string") throw pruefFehler("Der Nutzername fehlt.");
  var nutzername = textSaeubern(d.nutzername).replace(/\s*\n\s*/g, " ");
  if (EMOJI_MUSTER.test(nutzername)) throw pruefFehler("Emojis sind im Nutzernamen nicht möglich.");
  var nameLaenge = zeichenAnzahl(nutzername);
  if (nameLaenge < NUTZERNAME_MIN || nameLaenge > NUTZERNAME_MAX) {
    throw pruefFehler("Der Nutzername muss " + NUTZERNAME_MIN + " bis " + NUTZERNAME_MAX + " Zeichen lang sein.");
  }

  // --- Sätze ---
  if (!Array.isArray(d.saetze) || d.saetze.length !== ANZAHL_SAETZE) {
    throw pruefFehler("Es müssen genau " + ANZAHL_SAETZE + " Sätze sein.");
  }
  var gesehen = {};
  var saetze = d.saetze.map(function (s) {
    if (!s || typeof s !== "object") throw pruefFehler("Ein Satz fehlt.");

    var satzId = String(s.satz_id || "");
    if (!/^s\d{3,6}$/.test(satzId)) throw pruefFehler("Ein Satz hat eine ungültige Kennung.");
    if (gesehen[satzId]) throw pruefFehler("Ein Satz ist doppelt.");
    gesehen[satzId] = true;

    var satz = typeof s.satz === "string" ? s.satz : "";
    if (!satz || satz.length > MAX_SATZ_LAENGE) throw pruefFehler("Ein Satz ist ungültig.");
    var anzahlLuecken = satz.split(LUECKE).length - 1;
    if (anzahlLuecken < 1) throw pruefFehler("Ein Satz hat keine Lücke.");

    if (!Array.isArray(s.luecken) || s.luecken.length !== anzahlLuecken) {
      throw pruefFehler("Die Zahl der Antworten passt nicht zum Satz.");
    }
    var luecken = s.luecken.map(function (l) {
      if (typeof l !== "string") throw pruefFehler("Eine Antwort ist ungültig.");
      var sauber = textSaeubern(l);
      if (!sauber) throw pruefFehler("Bitte fülle alle Lücken aus.");
      return sauber;
    });
    var zeichen = luecken.reduce(function (n, l) { return n + zeichenAnzahl(l); }, 0);
    if (zeichen > MAX_ZEICHEN_PRO_SATZ) {
      throw pruefFehler("Eine Antwort ist länger als " + MAX_ZEICHEN_PRO_SATZ + " Zeichen.");
    }

    return {
      satz_id: satzId,
      satz: satz,
      luecken: luecken,
      antwort: satzZusammensetzen(satz, luecken)
    };
  });

  // --- Farbe ---
  var f = d.farbe || {};
  var farbe = {};
  ["c", "m", "y", "k"].forEach(function (kanal) {
    var wert = f[kanal];
    if (typeof wert !== "number" || !isFinite(wert) || Math.round(wert) !== wert || wert < 0 || wert > 100) {
      throw pruefFehler("Die Farbe ist ungültig.");
    }
    farbe[kanal] = wert;
  });
  farbe.hex = cmykZuHex(farbe.c, farbe.m, farbe.y, farbe.k); // serverseitig neu berechnet

  // --- Zeichnung ---
  var symbol = d.symbol || {};
  var svg = symbol.svg;
  if (typeof svg !== "string" || !svg) throw pruefFehler("Die Zeichnung fehlt.");
  if (svg.length > MAX_BILD_BYTES) throw pruefFehler("Die Zeichnung ist zu groß.");
  var svgKern = svg.replace(/^\s*<\?xml[^>]*\?>\s*/, "");
  if (!/^<svg[\s>]/.test(svgKern)) throw pruefFehler("Die Zeichnung ist ungültig.");
  if (/<script|<foreignObject|<iframe|<!ENTITY|javascript:|\son[a-z]+\s*=/i.test(svg)) {
    throw pruefFehler("Die Zeichnung enthält unerlaubte Inhalte.");
  }
  if (!/<(path|circle|line)[\s>]/.test(svg)) throw pruefFehler("Die Zeichnung ist leer.");

  var png = symbol.png;
  var PNG_PRAEFIX = "data:image/png;base64,";
  if (typeof png !== "string" || png.indexOf(PNG_PRAEFIX) !== 0) throw pruefFehler("Das Bild der Zeichnung fehlt.");
  var base64 = png.slice(PNG_PRAEFIX.length);
  if (base64.length > Math.ceil(MAX_BILD_BYTES * 4 / 3) + 4) throw pruefFehler("Das Bild der Zeichnung ist zu groß.");
  var bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (fehler) {
    throw pruefFehler("Das Bild der Zeichnung ist beschädigt.");
  }
  var signatur = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signatur.some(function (b, i) { return (bytes[i] & 255) !== b; })) {
    throw pruefFehler("Das Bild der Zeichnung ist kein PNG.");
  }
  var breite = (((bytes[16] & 255) << 24) | ((bytes[17] & 255) << 16) | ((bytes[18] & 255) << 8) | (bytes[19] & 255)) >>> 0;
  if (breite < MIN_PNG_BREITE) throw pruefFehler("Das Bild der Zeichnung ist zu klein.");

  return {
    test: d.test === true,
    nutzername: nutzername,
    saetze: saetze,
    farbe: farbe,
    svg: svg,
    pngBytes: bytes
  };
}

// „Je länger ich dich ____, desto ____ bin ich.“ + ["gestalte","verliebter"]
// → „Je länger ich dich gestalte, desto verliebter bin ich.“
function satzZusammensetzen(satz, luecken) {
  return satz.split(LUECKE).reduce(function (text, stueck, i) {
    return text + stueck + (i < luecken.length ? luecken[i] : "");
  }, "");
}

// einfache Umrechnung CMYK → RGB → Hex (wie auf der Webseite)
function cmykZuHex(c, m, y, k) {
  var r = Math.round(255 * (1 - c / 100) * (1 - k / 100));
  var g = Math.round(255 * (1 - m / 100) * (1 - k / 100));
  var b = Math.round(255 * (1 - y / 100) * (1 - k / 100));
  return "#" + [r, g, b].map(function (w) { return ("0" + w.toString(16)).slice(-2); }).join("").toUpperCase();
}


/* =====================================================================
   SPEICHERN
   ===================================================================== */

function einsendungSpeichern(g) {
  // Sperre: gleichzeitige Einsendungen werden nacheinander abgearbeitet
  var sperre = LockService.getScriptLock();
  if (!sperre.tryLock(30000)) {
    throw new Error("Zeitüberschreitung beim Warten auf die Sperre");
  }

  var neueDateien = [];
  try {
    var ss = SpreadsheetApp.getActive();
    var tabTeilnahmen = tabSicherstellen(ss, TAB_TEILNAHMEN, KOPF_TEILNAHMEN);
    var tabAntworten  = tabSicherstellen(ss, TAB_ANTWORTEN, KOPF_ANTWORTEN);
    var tabSaetze     = tabSicherstellen(ss, TAB_SAETZE, KOPF_SAETZE);

    var id = neueTeilnahmeId(tabTeilnahmen);
    var zeitstempel = new Date();   // serverseitig
    var datum = Utilities.formatDate(zeitstempel, ZEITZONE, "dd.MM.yyyy");   // z. B. 21.11.2026
    var uhrzeit = Utilities.formatDate(zeitstempel, ZEITZONE, "HH:mm");      // z. B. 15:16
    var praefix = g.test ? TEST_PRAEFIX : "";

    // 1. Zeichnungen in den Drive-Ordner
    var ordner = DriveApp.getFolderById(FOLDER_ID);
    var svgName = praefix + "symbol_" + id + ".svg";
    var pngName = praefix + "symbol_" + id + ".png";
    var svgDatei = ordner.createFile(Utilities.newBlob(g.svg, "image/svg+xml", svgName));
    neueDateien.push(svgDatei);
    var pngDatei = ordner.createFile(Utilities.newBlob(g.pngBytes, "image/png", pngName));
    neueDateien.push(pngDatei);

    // 2. Tab „Teilnahmen“ (eine Zeile)
    var bereich = zeilenAnhaengen(tabTeilnahmen, [[
      id, zeitstempel, g.test,
      g.farbe.c, g.farbe.m, g.farbe.y, g.farbe.k, g.farbe.hex,
      svgName, pngName,
      g.nutzername, datum, uhrzeit
    ]], FORMATE_TEILNAHMEN);
    // Dateinamen als Link zur Datei in Drive
    tabTeilnahmen.getRange(bereich.getRow(), 9, 1, 2).setRichTextValues([[
      SpreadsheetApp.newRichTextValue().setText(svgName).setLinkUrl(svgDatei.getUrl()).build(),
      SpreadsheetApp.newRichTextValue().setText(pngName).setLinkUrl(pngDatei.getUrl()).build()
    ]]);

    // 3. Tab „Antworten“ (eine Zeile pro Satz)
    zeilenAnhaengen(tabAntworten, g.saetze.map(function (s) {
      return [id, zeitstempel, g.test, s.satz_id, s.satz, s.antwort, s.luecken.join(" | "),
              g.nutzername, datum, uhrzeit];
    }), FORMATE_ANTWORTEN);
    auswertungsPlatzSichern(ss, tabAntworten.getLastRow());

    // 4. Unbekannte Sätze im Tab „Sätze“ ergänzen (bestehende Einträge bleiben unverändert)
    unbekannteSaetzeErgaenzen(tabSaetze, g.saetze);

    SpreadsheetApp.flush();
    return id;

  } catch (fehler) {
    // halb gespeicherte Einsendung: Dateien wieder entfernen (Papierkorb)
    neueDateien.forEach(function (datei) {
      try { datei.setTrashed(true); } catch (f) { /* egal */ }
    });
    throw fehler;
  } finally {
    sperre.releaseLock();
  }
}

// kurze, eindeutige ID (8 Zeichen, ohne leicht verwechselbare Zeichen wie l/1/o/0)
function neueTeilnahmeId(tabTeilnahmen) {
  var vorhanden = spaltenWerteAlsSet(tabTeilnahmen, 1);
  var zeichen = "abcdefghijkmnpqrstuvwxyz23456789";
  var id;
  do {
    id = "";
    for (var i = 0; i < 8; i++) id += zeichen.charAt(Math.floor(Math.random() * zeichen.length));
  } while (vorhanden[id]);
  return id;
}

function unbekannteSaetzeErgaenzen(tabSaetze, saetze) {
  var vorhanden = spaltenWerteAlsSet(tabSaetze, 1);
  var neu = saetze
    .filter(function (s) { return !vorhanden[s.satz_id]; })
    .map(function (s) { return [s.satz_id, s.satz, ""]; });
  if (neu.length) zeilenAnhaengen(tabSaetze, neu, FORMATE_SAETZE);
}


/* =====================================================================
   HILFSFUNKTIONEN FÜR TABS
   ===================================================================== */

// Holt einen Tab; legt ihn mit Kopfzeile an, falls er fehlt
function tabSicherstellen(ss, name, kopf) {
  var tab = ss.getSheetByName(name);
  if (!tab) {
    tab = ss.insertSheet(name);
    kopfzeileSetzen(tab, kopf);
  }
  return tab;
}

function kopfzeileSetzen(tab, kopf) {
  if (tab.getMaxColumns() < kopf.length) {
    tab.insertColumnsAfter(tab.getMaxColumns(), kopf.length - tab.getMaxColumns());
  }
  var bereich = tab.getRange(1, 1, 1, kopf.length);
  bereich.setNumberFormat("@").setValues([kopf]).setFontWeight("bold");
  tab.setFrozenRows(1);
}

// Hängt Zeilen unten an und setzt vorher die Zahlenformate
function zeilenAnhaengen(tab, werte, formate) {
  var start = tab.getLastRow() + 1;
  var ende = start + werte.length - 1;
  if (ende > tab.getMaxRows()) {
    tab.insertRowsAfter(tab.getMaxRows(), ende - tab.getMaxRows() + 200);
  }
  Object.keys(formate || {}).forEach(function (spalte) {
    tab.getRange(start, Number(spalte), werte.length, 1).setNumberFormat(formate[spalte]);
  });
  var bereich = tab.getRange(start, 1, werte.length, werte[0].length);
  bereich.setValues(werte);
  return bereich;
}

// Alle Werte einer Spalte (ohne Kopfzeile) als Nachschlage-Objekt
function spaltenWerteAlsSet(tab, spalte) {
  var set = {};
  var letzte = tab.getLastRow();
  if (letzte < 2) return set;
  tab.getRange(2, spalte, letzte - 1, 1).getValues().forEach(function (z) {
    if (z[0] !== "") set[String(z[0])] = true;
  });
  return set;
}

// Spaltennummer zu einem Kopfzeilen-Namen (1-basiert, 0 = nicht gefunden)
function spalteVon(tab, name) {
  if (tab.getLastColumn() < 1) return 0;
  var kopf = tab.getRange(1, 1, 1, tab.getLastColumn()).getValues()[0];
  return kopf.indexOf(name) + 1;
}

// Tab-Namen für Formeln (mit ' umschlossen)
function tabRef(name) {
  return "'" + String(name).replace(/'/g, "''") + "'";
}

// Meldung anzeigen (im Sheet als Fenster, beim Ausführen im Editor im Log)
function melden(titel, text) {
  try {
    SpreadsheetApp.getUi().alert(titel, text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (f) {
    console.log(titel + "\n" + text);
  }
}


/* =====================================================================
   MENÜ: EINRICHTEN
   ===================================================================== */

function menueEinrichten() {
  var bericht = einrichten();
  melden("Einrichten", bericht.join("\n"));
}

// Legt alle Tabs mit Kopfzeilen an (falls noch nicht vorhanden),
// setzt Formate, schützt die Kopfzeilen und baut die Auswertung.
// Bestehende Daten werden NICHT verändert.
function einrichten() {
  var sperre = LockService.getScriptLock();
  sperre.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActive();
    var bericht = [];

    // Ein neues Sheet hat ein leeres Standard-Tab („Tabellenblatt1“) –
    // das wird zu „Teilnahmen“ umbenannt, statt herumzuliegen.
    var tabs = ss.getSheets();
    var eigeneNamen = [TAB_TEILNAHMEN, TAB_ANTWORTEN, TAB_SAETZE, TAB_AUSWERTUNG, TAB_EXPORT];
    if (tabs.length === 1 && eigeneNamen.indexOf(tabs[0].getName()) === -1 &&
        tabs[0].getLastRow() === 0 && tabs[0].getLastColumn() === 0) {
      bericht.push("Leeres Tab „" + tabs[0].getName() + "“ in „" + TAB_TEILNAHMEN + "“ umbenannt.");
      tabs[0].setName(TAB_TEILNAHMEN);
    }

    var plan = [
      [TAB_TEILNAHMEN, KOPF_TEILNAHMEN, FORMATE_TEILNAHMEN],
      [TAB_ANTWORTEN, KOPF_ANTWORTEN, FORMATE_ANTWORTEN],
      [TAB_SAETZE, KOPF_SAETZE, FORMATE_SAETZE],
      [TAB_AUSWERTUNG, KOPF_AUSWERTUNG, { 2: FORMAT_DATUM }]
    ];

    plan.forEach(function (eintrag) {
      var name = eintrag[0], kopf = eintrag[1], formate = eintrag[2];
      var tab = ss.getSheetByName(name);
      if (!tab) {
        tab = ss.insertSheet(name);
        bericht.push("Tab „" + name + "“ angelegt.");
      }

      var ersteZeile = tab.getLastRow() > 0
        ? tab.getRange(1, 1, 1, Math.max(tab.getLastColumn(), 1)).getValues()[0]
        : [];
      // leere Zellen am Ende der Kopfzeile ignorieren
      while (ersteZeile.length && ersteZeile[ersteZeile.length - 1] === "") ersteZeile.pop();
      var istAnfang = ersteZeile.length < kopf.length &&
        ersteZeile.every(function (w, i) { return w === kopf[i]; });

      if (ersteZeile.length === 0) {
        kopfzeileSetzen(tab, kopf);
        bericht.push("Kopfzeile in „" + name + "“ eingetragen.");
      } else if (name === TAB_AUSWERTUNG) {
        // „Auswertung“ wird komplett per Formel erzeugt → Kopfzeile immer neu
        tab.getRange(1, 1, 1, tab.getMaxColumns()).clearContent();
        kopfzeileSetzen(tab, kopf);
      } else if (istAnfang) {
        // neue Spalten rechts anhängen – vorhandene Spalten und Daten bleiben
        if (tab.getMaxColumns() < kopf.length) {
          tab.insertColumnsAfter(tab.getMaxColumns(), kopf.length - tab.getMaxColumns());
        }
        tab.getRange(1, ersteZeile.length + 1, 1, kopf.length - ersteZeile.length)
          .setNumberFormat("@")
          .setValues([kopf.slice(ersteZeile.length)]);
        bericht.push("In „" + name + "“ neue Spalten ergänzt: " + kopf.slice(ersteZeile.length).join(", ") + ".");
      } else if (kopf.some(function (k, i) { return ersteZeile[i] !== k; })) {
        bericht.push("ACHTUNG: Die Kopfzeile in „" + name + "“ weicht ab – bitte prüfen (erwartet: " + kopf.join(" | ") + ").");
      }
      tab.setFrozenRows(1);
      tab.getRange(1, 1, 1, kopf.length).setFontWeight("bold");

      // Spaltenformate für alle Zeilen unter der Kopfzeile
      if (tab.getMaxRows() > 1) {
        Object.keys(formate).forEach(function (spalte) {
          tab.getRange(2, Number(spalte), tab.getMaxRows() - 1, 1).setNumberFormat(formate[spalte]);
        });
      }

      kopfzeileSchuetzen(tab, kopf.length);
    });

    var antworten = ss.getSheetByName(TAB_ANTWORTEN);
    auswertungsPlatzSichern(ss, Math.max(antworten.getLastRow(), 2000));
    var trenner = auswertungAufbauen(ss);
    if (trenner) {
      bericht.push("Auswertung mit Formeln eingerichtet (Trennzeichen „" + trenner + "“).");
    } else {
      bericht.push("ACHTUNG: Die Formeln in „" + TAB_AUSWERTUNG + "“ zeigen weiterhin #ERROR! – siehe README, Abschnitt 15.");
    }

    // Prüfen, ob die Ordner-ID eingetragen ist
    if (!FOLDER_ID || FOLDER_ID.indexOf("HIER_") === 0) {
      bericht.push("ACHTUNG: FOLDER_ID ist oben in Code.gs noch nicht eingetragen.");
    }
    if (typeof SAETZE === "undefined") {
      bericht.push("Hinweis: Die Datei „Saetze.gs“ fehlt noch (für „Sätze aktualisieren“).");
    }

    bericht.push("Fertig.");
    return bericht;
  } finally {
    sperre.releaseLock();
  }
}

// Kopfzeile schützen: Wer sie ändern will, bekommt eine Warnung.
// (Nur Warnung, damit ihr im Team nicht ausgesperrt werdet.)
function kopfzeileSchuetzen(tab, anzahlSpalten) {
  tab.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (schutz) {
    if (schutz.getDescription() === KOPF_SCHUTZ_NAME) schutz.remove();
  });
  tab.getRange(1, 1, 1, anzahlSpalten).protect()
    .setDescription(KOPF_SCHUTZ_NAME)
    .setWarningOnly(true);
}

// Die Formel in „Auswertung“ kann nur so viele Zeilen füllen, wie der Tab hat –
// deshalb wächst er rechtzeitig mit dem Tab „Antworten“ mit.
function auswertungsPlatzSichern(ss, benoetigt) {
  var tab = ss.getSheetByName(TAB_AUSWERTUNG);
  if (tab && tab.getMaxRows() < benoetigt + 50) {
    tab.insertRowsAfter(tab.getMaxRows(), benoetigt + 500 - tab.getMaxRows());
  }
}

// Tab „Auswertung“: zeigt per Formel alle echten Antworten (ohne Tests).
// Aktualisiert sich selbst.
//
// Vier einfache Formeln (Spalten A, C, G und J), alle mit denselben
// Filterbedingungen – deshalb stehen die Zeilen immer passend nebeneinander.
// Der Hex-Wert kommt per Nachschlagen über die teilnahme_id aus „Teilnahmen“.
//
// Wichtig: Je nach Spracheinstellung des Sheets erwartet Google zwischen
// den Formel-Argumenten Kommas (,) oder Semikolons (;). Deshalb werden die
// Schreibweisen nacheinander ausprobiert, bis keine „#ERROR!“-Meldung mehr
// erscheint. Gibt die funktionierende Schreibweise zurück (oder null).
function auswertungAufbauen(ss) {
  var tab = ss.getSheetByName(TAB_AUSWERTUNG);
  var EN = { iferror: "IFERROR", vlookup: "VLOOKUP", wahr: "TRUE" };
  var DE = { iferror: "WENNFEHLER", vlookup: "SVERWEIS", wahr: "WAHR" };
  var varianten = [
    { trenner: ";", namen: EN },
    { trenner: ";", namen: DE },
    { trenner: ",", namen: EN }
  ];
  // Sheets mit englischer (o. ä.) Spracheinstellung: Komma zuerst probieren
  var locale = "";
  try { locale = String(ss.getSpreadsheetLocale() || ""); } catch (f) { /* egal */ }
  if (/^(en|ja|zh|ko|he|th|hi)/i.test(locale)) {
    varianten = [varianten[2], varianten[0], varianten[1]];
  }

  for (var i = 0; i < varianten.length; i++) {
    auswertungsFormelnSchreiben(tab, varianten[i].trenner, varianten[i].namen);
    SpreadsheetApp.flush();
    if (!auswertungHatFehler(tab)) {
      auswertungSchuetzen(tab);
      return varianten[i].trenner + (varianten[i].namen === DE ? " (deutsche Funktionsnamen)" : "");
    }
  }
  // nichts hat geklappt: die wahrscheinlichste Variante stehen lassen
  auswertungsFormelnSchreiben(tab, varianten[0].trenner, varianten[0].namen);
  auswertungSchuetzen(tab);
  return null;
}

function auswertungHatFehler(tab) {
  var anzeige = tab.getRange(2, 1, 1, KOPF_AUSWERTUNG.length).getDisplayValues()[0];
  return anzeige.some(function (w) { return String(w).indexOf("#ERROR") === 0 || String(w).indexOf("#FEHLER") === 0; });
}

function auswertungsFormelnSchreiben(tab, t, n) {
  var a = tabRef(TAB_ANTWORTEN);
  var leer = "\"\"";
  var bedingung = a + "!A2:A<>" + leer + t + " " + a + "!C2:C<>" + n.wahr;   // nicht leer und kein Test

  function filter(bereich) {
    return "=" + n.iferror + "(FILTER(" + bereich + t + " " + bedingung + ")" + t + " " + leer + ")";
  }

  // alte Formeln/Inhalte unter der Kopfzeile entfernen
  if (tab.getMaxRows() > 1) {
    tab.getRange(2, 1, tab.getMaxRows() - 1, KOPF_AUSWERTUNG.length).clearContent();
  }
  // A–B: teilnahme_id, zeitstempel
  tab.getRange(2, 1).setFormula(filter(a + "!A2:B"));
  // C–F: satz_id, satz, antwort, luecken
  tab.getRange(2, 3).setFormula(filter(a + "!D2:G"));
  // G–I: nutzername, datum, uhrzeit
  tab.getRange(2, 7).setFormula(filter(a + "!H2:J"));
  // J: hex – aus „Teilnahmen“ (Spalte 8) über die teilnahme_id
  var tn = tabRef(TAB_TEILNAHMEN);
  var hex = n.iferror + "(" + n.vlookup + "(" + a + "!A2:A" + t + " " + tn + "!A2:H" + t + " 8" + t + " 0)" + t + " " + leer + ")";
  tab.getRange(2, 10).setFormula("=ARRAYFORMULA(" + filter(hex).slice(1) + ")");
}

// die Formelzeile mit einer Warnung schützen
function auswertungSchuetzen(tab) {
  tab.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (schutz) {
    if (schutz.getDescription() === "Formel (vom Script geschützt)") schutz.remove();
  });
  tab.getRange(2, 1, 1, KOPF_AUSWERTUNG.length).protect()
    .setDescription("Formel (vom Script geschützt)").setWarningOnly(true);
}


/* =====================================================================
   MENÜ: SÄTZE AKTUALISIEREN
   ===================================================================== */

// Überträgt IDs und Texte aus Saetze.gs in den Tab „Sätze“.
// - neue IDs werden angehängt
// - Texte werden aktualisiert (z. B. nach Tippfehler-Korrektur)
// - Sätze, die nicht mehr in der Liste stehen, bleiben erhalten
// - die Spalte „notiz“ wird nie angefasst
function saetzeAktualisieren() {
  if (typeof SAETZE === "undefined" || !Array.isArray(SAETZE)) {
    melden("Sätze aktualisieren", "Die Datei „Saetze.gs“ fehlt. Bitte den Inhalt von saetze.js als Datei „Saetze.gs“ ins Apps Script kopieren.");
    return;
  }

  var sperre = LockService.getScriptLock();
  sperre.waitLock(30000);
  var bericht;
  try {
    var ss = SpreadsheetApp.getActive();
    var tab = tabSicherstellen(ss, TAB_SAETZE, KOPF_SAETZE);

    var letzte = tab.getLastRow();
    var bestand = letzte >= 2 ? tab.getRange(2, 1, letzte - 1, 2).getValues() : [];
    var zeileVonId = {};
    bestand.forEach(function (z, i) { if (z[0] !== "") zeileVonId[String(z[0])] = i; });

    var neu = [];
    var texteGeaendert = 0;
    var listeIds = {};

    SAETZE.forEach(function (satz) {
      if (!satz || !satz.id) return;
      listeIds[satz.id] = true;
      var i = zeileVonId[satz.id];
      if (i === undefined) {
        neu.push([satz.id, satz.text, ""]);
        zeileVonId[satz.id] = -1; // doppelte IDs in der Liste nicht zweimal anlegen
        return;
      }
      if (i < 0) return;
      if (bestand[i][1] !== satz.text) {
        bestand[i][1] = satz.text;
        texteGeaendert++;
      }
    });

    // Textspalte zurückschreiben (Spalte A und „notiz“ bleiben unberührt)
    if (bestand.length && texteGeaendert) {
      var bereich = tab.getRange(2, 2, bestand.length, 1);
      bereich.setNumberFormat("@");
      bereich.setValues(bestand.map(function (z) { return [z[1]]; }));
    }
    if (neu.length) zeilenAnhaengen(tab, neu, FORMATE_SAETZE);

    var nichtMehrInListe = Object.keys(zeileVonId).filter(function (id) { return !listeIds[id]; }).length;

    bericht = [
      neu.length + " neue Sätze eingetragen.",
      texteGeaendert + " Satztexte aktualisiert.",
      nichtMehrInListe + " Sätze stehen im Tab, aber nicht (mehr) in der Satzliste – sie bleiben erhalten."
    ];
  } finally {
    sperre.releaseLock();
  }
  melden("Sätze aktualisieren", bericht.join("\n"));
}


/* =====================================================================
   MENÜ: VERBINDUNG TESTEN
   ===================================================================== */

function verbindungTesten() {
  var zeilen = [];
  var allesOk = true;

  // Sheet und Tabs
  try {
    var ss = SpreadsheetApp.getActive();
    zeilen.push("✓ Sheet erreichbar: „" + ss.getName() + "“");
    [TAB_TEILNAHMEN, TAB_ANTWORTEN, TAB_SAETZE, TAB_AUSWERTUNG].forEach(function (name) {
      if (ss.getSheetByName(name)) {
        zeilen.push("✓ Tab „" + name + "“ vorhanden");
      } else {
        zeilen.push("✗ Tab „" + name + "“ fehlt → „Einrichten“ ausführen");
        allesOk = false;
      }
    });
  } catch (f) {
    zeilen.push("✗ Sheet nicht erreichbar: " + f.message);
    allesOk = false;
  }

  // Drive-Ordner: lesen und testweise eine Datei anlegen + löschen
  if (!FOLDER_ID || FOLDER_ID.indexOf("HIER_") === 0) {
    zeilen.push("✗ FOLDER_ID ist oben in Code.gs noch nicht eingetragen");
    allesOk = false;
  } else {
    try {
      var ordner = DriveApp.getFolderById(FOLDER_ID);
      zeilen.push("✓ Drive-Ordner erreichbar: „" + ordner.getName() + "“");
      var probe = ordner.createFile(Utilities.newBlob("Verbindungstest", "text/plain", TEST_PRAEFIX + "verbindungstest.txt"));
      probe.setTrashed(true);
      zeilen.push("✓ Schreiben in den Ordner funktioniert");
    } catch (f) {
      zeilen.push("✗ Drive-Ordner nicht erreichbar: " + f.message);
      allesOk = false;
    }
  }

  // Satzliste
  if (typeof SAETZE !== "undefined" && Array.isArray(SAETZE)) {
    zeilen.push("✓ Saetze.gs vorhanden (" + SAETZE.length + " Sätze)");
  } else {
    zeilen.push("– Saetze.gs fehlt (nur für „Sätze aktualisieren“ nötig)");
  }

  // Web-App-Adresse (falls schon bereitgestellt)
  try {
    var url = ScriptApp.getService().getUrl();
    zeilen.push(url ? "Web-App-Adresse: " + url : "– Web-App noch nicht bereitgestellt");
  } catch (f) {
    zeilen.push("– Web-App-Adresse nicht abrufbar");
  }

  zeilen.unshift(allesOk ? "Alles bereit." : "Es gibt noch Probleme:");
  melden("Verbindung testen", zeilen.join("\n"));
}


/* =====================================================================
   MENÜ: TESTDATEN LÖSCHEN
   ===================================================================== */

// Löscht NUR Zeilen mit test = WAHR (in „Teilnahmen“ und „Antworten“)
// und NUR Dateien mit dem Präfix TEST_ im Drive-Ordner (→ Papierkorb).
function testdatenLoeschen() {
  var ui = SpreadsheetApp.getUi();
  var frage = ui.alert(
    "Testdaten löschen",
    "Alle Zeilen mit test = WAHR und alle Zeichnungen mit „" + TEST_PRAEFIX + "“ im Dateinamen werden gelöscht.\n" +
    "Echte Einsendungen bleiben unberührt.\n\nFortfahren?",
    ui.ButtonSet.YES_NO
  );
  if (frage !== ui.Button.YES) return;

  var sperre = LockService.getScriptLock();
  sperre.waitLock(30000);
  var bericht = [];
  try {
    var ss = SpreadsheetApp.getActive();

    [TAB_TEILNAHMEN, TAB_ANTWORTEN].forEach(function (name) {
      var tab = ss.getSheetByName(name);
      if (!tab) return;
      var anzahl = testzeilenLoeschen(tab);
      bericht.push(name + ": " + anzahl + " Testzeilen gelöscht");
    });

    var dateien = 0;
    if (FOLDER_ID && FOLDER_ID.indexOf("HIER_") !== 0) {
      var alle = DriveApp.getFolderById(FOLDER_ID).getFiles();
      while (alle.hasNext()) {
        var datei = alle.next();
        if (datei.getName().indexOf(TEST_PRAEFIX) === 0) {
          datei.setTrashed(true);
          dateien++;
        }
      }
    }
    bericht.push("Drive-Ordner: " + dateien + " Testdateien in den Papierkorb verschoben");
  } finally {
    sperre.releaseLock();
  }
  melden("Testdaten gelöscht", bericht.join("\n"));
}

// löscht in einem Tab alle Zeilen, in denen die Spalte „test“ WAHR ist
function testzeilenLoeschen(tab) {
  var spalte = spalteVon(tab, "test");
  var letzte = tab.getLastRow();
  if (!spalte || letzte < 2) return 0;

  var werte = tab.getRange(2, spalte, letzte - 1, 1).getValues();
  var geloescht = 0;
  // Google Sheets erlaubt nicht, alle Zeilen unter der Kopfzeile zu löschen –
  // deshalb sicherheitshalber eine leere Zeile ans Ende
  if (tab.getMaxRows() === letzte) tab.insertRowsAfter(letzte, 1);
  // von unten nach oben, zusammenhängende Blöcke auf einmal
  var i = werte.length - 1;
  while (i >= 0) {
    if (werte[i][0] === true) {
      var ende = i;
      while (i - 1 >= 0 && werte[i - 1][0] === true) i--;
      var anzahl = ende - i + 1;
      tab.deleteRows(i + 2, anzahl);
      geloescht += anzahl;
    }
    i--;
  }
  return geloescht;
}


/* =====================================================================
   MENÜ: EXPORT FÜR INDESIGN
   ===================================================================== */

// Erzeugt (bzw. erneuert) den Tab „Export InDesign“:
// eine Zeile pro echtem Antwortsatz, mit Nutzername, Datum, Uhrzeit und Farbe
// und der Spalte @symbol (relativer Bildpfad für die Datenzusammenführung).
// Zeilenumbrüche in Antworten werden durch Leerzeichen ersetzt, weil die
// InDesign-Datenzusammenführung damit nicht umgehen kann.
function exportFuerInDesign() {
  var ss = SpreadsheetApp.getActive();
  var tabT = ss.getSheetByName(TAB_TEILNAHMEN);
  var tabA = ss.getSheetByName(TAB_ANTWORTEN);
  if (!tabT || !tabA) {
    melden("Export für InDesign", "Es fehlen Tabs – bitte zuerst „Einrichten“ ausführen.");
    return;
  }
  var zeitzone = ss.getSpreadsheetTimeZone();

  function zeilenLesen(tab, anzahlSpalten) {
    var letzte = tab.getLastRow();
    return letzte >= 2 ? tab.getRange(2, 1, letzte - 1, anzahlSpalten).getValues() : [];
  }
  function einzeilig(text) {
    return String(text).replace(/\s*\n\s*/g, " ");
  }

  // Teilnahmen: id → Farbe, test
  var teilnahmen = {};
  zeilenLesen(tabT, KOPF_TEILNAHMEN.length).forEach(function (z) {
    teilnahmen[String(z[0])] = { test: z[2] === true, c: z[3], m: z[4], y: z[5], k: z[6], hex: z[7] };
  });

  // Antworten: nur echte
  var eintraege = [];
  var maxLuecken = 1;
  zeilenLesen(tabA, KOPF_ANTWORTEN.length).forEach(function (z) {
    var id = String(z[0]);
    var t = teilnahmen[id];
    if (!id || z[2] === true || !t || t.test) return;
    var luecken = String(z[6]).split(" | ").map(einzeilig);
    maxLuecken = Math.max(maxLuecken, luecken.length);
    eintraege.push({
      id: id,
      zeit: z[1] instanceof Date ? z[1] : null,
      satzId: String(z[3]),
      nutzername: einzeilig(z[7]),
      datum: String(z[8]),
      uhrzeit: String(z[9]),
      satz: einzeilig(z[4]),
      antwort: einzeilig(z[5]),
      luecken: luecken,
      farbe: t
    });
  });

  // sortiert nach Satz, dann Zeit
  eintraege.sort(function (a, b) {
    return a.satzId.localeCompare(b.satzId) ||
      ((a.zeit ? a.zeit.getTime() : 0) - (b.zeit ? b.zeit.getTime() : 0));
  });

  var kopf = ["teilnahme_id", "zeitstempel", "satz_id", "satz", "antwort", "luecken"];
  for (var n = 1; n <= maxLuecken; n++) kopf.push("luecke_" + n);
  kopf = kopf.concat(["nutzername", "datum", "uhrzeit", "c", "m", "y", "k", "hex", "@symbol"]);

  var zeilen = eintraege.map(function (e) {
    var z = [
      e.id,
      e.zeit ? Utilities.formatDate(e.zeit, zeitzone, "dd.MM.yyyy HH:mm") : "",
      e.satzId, e.satz, e.antwort, e.luecken.join(" | ")
    ];
    for (var n = 0; n < maxLuecken; n++) z.push(e.luecken[n] || "");
    return z.concat([
      e.nutzername, e.datum, e.uhrzeit,
      String(e.farbe.c), String(e.farbe.m), String(e.farbe.y), String(e.farbe.k), String(e.farbe.hex),
      EXPORT_BILDORDNER + "/symbol_" + e.id + ".png"
    ]);
  });

  var tab = ss.getSheetByName(TAB_EXPORT) || ss.insertSheet(TAB_EXPORT);
  tab.clear();
  var alleZeilen = [kopf].concat(zeilen);
  if (tab.getMaxRows() < alleZeilen.length) tab.insertRowsAfter(tab.getMaxRows(), alleZeilen.length - tab.getMaxRows());
  if (tab.getMaxColumns() < kopf.length) tab.insertColumnsAfter(tab.getMaxColumns(), kopf.length - tab.getMaxColumns());
  var bereich = tab.getRange(1, 1, alleZeilen.length, kopf.length);
  bereich.setNumberFormat("@");
  bereich.setValues(alleZeilen);
  tab.getRange(1, 1, 1, kopf.length).setFontWeight("bold");
  tab.setFrozenRows(1);

  var anzahlPersonen = Object.keys(eintraege.reduce(function (o, e) { o[e.id] = true; return o; }, {})).length;
  melden("Export für InDesign",
    eintraege.length + " Antwortsätze von " + anzahlPersonen + " Teilnahmen exportiert (ohne Testdaten).\n\n" +
    "Weiter: Tab „" + TAB_EXPORT + "“ öffnen → Datei → Herunterladen → CSV.\n" +
    "Die CSV-Datei neben den heruntergeladenen Ordner „" + EXPORT_BILDORDNER + "“ legen.");
}
