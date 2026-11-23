/* =====================================================================
   SCRIPT – abkd-ichliebedich
   =====================================================================
   Was hier passiert, in dieser Reihenfolge:
     0. Feineinstellungen & Modus (Entwurf / Test / Live)
     1. Lückensätze: 5 zufällige Sätze anzeigen, Lücken als Eingabefelder
        (dazu: Nutzername-Feld)
     2. Zeichenfläche: Symbol der Liebe (Bibliothek „signature_pad“)
     3. Farbe der Liebe: CMYK-Regler mit Live-Vorschau
     4. Absenden: prüfen, Daten zusammenstellen, senden, Danke-Seite

   Die Einstellungen MODUS und WEB_APP_URL stehen in config.js,
   die Sätze in saetze.js.
   ===================================================================== */

(function () {
  "use strict";

  /* ===================================================================
     0. FEINEINSTELLUNGEN
     =================================================================== */

  var ANZAHL_SAETZE = 5;          // wie viele Sätze gezeigt werden
  var MAX_ZEICHEN_PRO_SATZ = 300; // alle Lücken eines Satzes zusammen
  var NUTZERNAME_MIN = 2;         // Nutzername: mindestens so viele Zeichen
  var NUTZERNAME_MAX = 30;        // Nutzername: höchstens so viele Zeichen

  // Emojis sind im Nutzernamen nicht erlaubt. Erkannt werden bunte Emojis und
  // ihre Bausteine (Hautfarben, Flaggen, Verbinder). Typografische Zeichen wie
  // © ™ ♥ ★ bleiben erlaubt, solange sie nicht als Emoji eingegeben werden.
  var EMOJI_MUSTER = "\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F|" +
    "[\\u{1F1E6}-\\u{1F1FF}\\u{1F3FB}-\\u{1F3FF}\\u{E0020}-\\u{E007F}\\u20E3\\uFE0F\\u200D]";
  var LUECKE = "____";            // so ist eine Lücke in saetze.js markiert

  var STIFT_MIN_BREITE = 1.5;     // Strichstärke beim Zeichnen (dünnste Stelle)
  var STIFT_MAX_BREITE = 4;       // Strichstärke beim Zeichnen (dickste Stelle)
  var EXPORT_STIFTFARBE = "#000000"; // Farbe der Striche in SVG und PNG
  var EXPORT_PNG_BREITE = 2000;   // Breite des PNG in Pixeln (mind. 1500)

  var ZAEHLUNG_WARTEZEIT_MS = 3000; // so lange höchstens auf die Antwort-Zählung warten,
                                    // danach werden die Sätze rein zufällig ausgewählt
  var ENTWURF_LADEZEIT_MS = 1200; // künstliche Ladezeit im Entwurfsmodus
  var SENDE_ZEITLIMIT_MS = 60000; // nach 60 s Warten gilt das Senden als fehlgeschlagen

  /* ---------- Modus aus config.js lesen ---------- */

  var modus = String(typeof MODUS === "undefined" ? "entwurf" : MODUS).trim().toLowerCase();
  if (["entwurf", "test", "live"].indexOf(modus) === -1) {
    console.warn('Unbekannter MODUS "' + modus + '" in config.js – verwende "entwurf".');
    modus = "entwurf";
  }
  var webAppUrl = String(typeof WEB_APP_URL === "undefined" ? "" : WEB_APP_URL).trim();

  // ?test=1 in der Adresse → auch im Live-Modus als Test senden
  var testPerLink = false;
  try {
    testPerLink = new URLSearchParams(window.location.search).get("test") === "1";
  } catch (e) { /* sehr alte Browser: ignorieren */ }

  var alsTestSenden = modus === "test" || (modus === "live" && testPerLink);

  // Hinweis-Balken oben einblenden
  var modusHinweis = document.getElementById("modus-hinweis");
  if (modus === "entwurf") {
    modusHinweis.textContent = "Entwurfsmodus – es werden keine Daten gesendet";
    modusHinweis.hidden = false;
  } else if (alsTestSenden) {
    modusHinweis.textContent = "Testmodus – Einsendungen werden als Test markiert";
    modusHinweis.hidden = false;
  }
  if (modus !== "entwurf" && !webAppUrl) {
    console.error("Achtung: In config.js ist keine WEB_APP_URL eingetragen. Absenden wird nicht funktionieren.");
  }


  /* ---------- kleine Helfer ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  // zählt Zeichen so, dass ein Emoji als 1 Zeichen zählt
  function zeichenAnzahl(text) {
    return Array.from(text).length;
  }

  function zufallsElement(liste) {
    return liste[Math.floor(Math.random() * liste.length)];
  }

  function warte(ms) {
    return new Promise(function (fertig) { setTimeout(fertig, ms); });
  }


  /* ===================================================================
     1. LÜCKENSÄTZE
     =================================================================== */

  var satzliste = $("satzliste");
  var satzAnsage = $("satz-ansage");

  // Alle gültigen Sätze aus saetze.js (doppelte IDs und Sätze ohne Lücke
  // werden ignoriert und in der Konsole gemeldet)
  var alleSaetze = (function () {
    var roh = Array.isArray(window.SAETZE) ? window.SAETZE : [];
    var gesehen = {};
    return roh.filter(function (s) {
      if (!s || typeof s.id !== "string" || typeof s.text !== "string") return false;
      if (gesehen[s.id]) {
        console.warn("saetze.js: ID doppelt vergeben, zweiter Eintrag wird ignoriert:", s.id);
        return false;
      }
      if (s.text.indexOf(LUECKE) === -1) {
        console.warn("saetze.js: Satz ohne Lücke (____) wird ignoriert:", s.id);
        return false;
      }
      gesehen[s.id] = true;
      return true;
    });
  })();

  var bereitsGezeigt = {};  // IDs aller Sätze, die schon einmal angezeigt wurden
  var plaetze = [];         // die 5 angezeigten Sätze (je ein „Platz“)

  // Wie oft jeder Satz schon (echt) beantwortet wurde, z. B. { s001: 3, s002: 0 }.
  // null = Zählung nicht verfügbar → rein zufällige Auswahl.
  var antwortZaehlung = null;

  // Gewichteter Zufall: Je seltener ein Satz beantwortet wurde, desto höher
  // seine Chance. Gewicht = 1 / (1 + Anzahl Antworten) – also immer größer
  // als null, kein Satz wird je ausgeschlossen.
  function gewichteteAuswahl(kandidaten) {
    if (!antwortZaehlung) return zufallsElement(kandidaten);
    var gewichte = kandidaten.map(function (s) {
      return 1 / (1 + (antwortZaehlung[s.id] || 0));
    });
    var summe = gewichte.reduce(function (a, b) { return a + b; }, 0);
    var wurf = Math.random() * summe;
    for (var i = 0; i < kandidaten.length; i++) {
      wurf -= gewichte[i];
      if (wurf < 0) return kandidaten[i];
    }
    return kandidaten[kandidaten.length - 1];
  }

  // Sucht einen Satz aus, der noch nicht gezeigt wurde
  function neuenSatzWaehlen() {
    var aktuelleIds = plaetze.map(function (p) { return p.satz && p.satz.id; });
    var kandidaten = alleSaetze.filter(function (s) {
      return !bereitsGezeigt[s.id] && aktuelleIds.indexOf(s.id) === -1;
    });
    // Alle schon gesehen? Dann wieder von vorn (nur nicht die gerade sichtbaren)
    if (kandidaten.length === 0) {
      bereitsGezeigt = {};
      kandidaten = alleSaetze.filter(function (s) { return aktuelleIds.indexOf(s.id) === -1; });
    }
    if (kandidaten.length === 0) return null;
    var satz = gewichteteAuswahl(kandidaten);
    bereitsGezeigt[satz.id] = true;
    return satz;
  }

  // Macht ein Element bearbeitbar (nur reiner Text, keine Formatierung)
  function bearbeitbarMachen(el) {
    try { el.contentEditable = "plaintext-only"; } catch (e) { /* ältere Browser */ }
    if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  }

  // Liest den Text einer Lücke (Zeilenumbrüche bleiben erhalten)
  function lueckenText(el) {
    var text = "";
    (function sammeln(knoten) {
      knoten.childNodes.forEach(function (kind) {
        if (kind.nodeType === 3) text += kind.nodeValue;
        else if (kind.nodeName === "BR") text += "\n";
        else sammeln(kind);
      });
    })(el);
    return text.replace(/ /g, " ").replace(/​/g, "");
  }

  function lueckenTextSetzen(el, text) {
    el.textContent = text;
  }

  function cursorAnsEnde(el) {
    var auswahl = window.getSelection();
    var bereich = document.createRange();
    bereich.selectNodeContents(el);
    bereich.collapse(false);
    auswahl.removeAllRanges();
    auswahl.addRange(bereich);
  }

  // Text an der Cursorposition einfügen
  function textEinfuegen(el, text) {
    if (!text) return;
    var geklappt = false;
    try { geklappt = document.execCommand("insertText", false, text); } catch (e) { geklappt = false; }
    if (geklappt) return;
    var auswahl = window.getSelection();
    if (!auswahl.rangeCount) return;
    var bereich = auswahl.getRangeAt(0);
    bereich.deleteContents();
    var knoten = document.createTextNode(text);
    bereich.insertNode(knoten);
    bereich.setStartAfter(knoten);
    bereich.collapse(true);
    auswahl.removeAllRanges();
    auswahl.addRange(bereich);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function zeichenImPlatz(platz) {
    return platz.luecken.reduce(function (summe, el) {
      return summe + zeichenAnzahl(lueckenText(el));
    }, 0);
  }

  // Wie viele Zeichen dürfen noch dazukommen (markierter Text zählt als frei)
  function restZeichen(platz, el) {
    var markiert = 0;
    var auswahl = window.getSelection();
    if (auswahl.rangeCount && el.contains(auswahl.anchorNode)) {
      markiert = zeichenAnzahl(auswahl.toString());
    }
    return MAX_ZEICHEN_PRO_SATZ - zeichenImPlatz(platz) + markiert;
  }

  function zaehlerAktualisieren(platz) {
    var anzahl = zeichenImPlatz(platz);
    platz.zaehler.textContent = anzahl + " / " + MAX_ZEICHEN_PRO_SATZ;
    platz.zaehler.classList.toggle("zeichenzaehler--voll", anzahl >= MAX_ZEICHEN_PRO_SATZ);
  }

  function alleLuecken() {
    return plaetze.reduce(function (liste, p) { return liste.concat(p.luecken); }, []);
  }

  function zurNaechstenLuecke(el) {
    var liste = alleLuecken();
    var naechste = liste[liste.indexOf(el) + 1];
    if (naechste) naechste.focus();
  }

  // Legt das Grundgerüst für einen der 5 Plätze an
  function platzAnlegen(nummer) {
    var li = document.createElement("li");
    li.className = "satz";

    var text = document.createElement("p");
    text.className = "satz-text";

    var beschreibung = document.createElement("span");
    beschreibung.className = "nur-screenreader";
    beschreibung.id = "satz-" + nummer + "-beschreibung";

    var fuss = document.createElement("div");
    fuss.className = "satz-fuss";

    var zaehler = document.createElement("span");
    zaehler.className = "zeichenzaehler";
    zaehler.id = "satz-" + nummer + "-zaehler";

    var wechseln = document.createElement("button");
    wechseln.type = "button";
    wechseln.className = "knopf knopf--text satz-wechseln";
    wechseln.textContent = "anderen Satz zeigen";
    wechseln.setAttribute("aria-describedby", beschreibung.id);

    var fehler = document.createElement("p");
    fehler.className = "fehler";
    fehler.id = "satz-" + nummer + "-fehler";
    fehler.hidden = true;
    fehler.textContent = "Bitte fülle alle Lücken in diesem Satz aus.";

    fuss.appendChild(zaehler);
    fuss.appendChild(wechseln);
    li.appendChild(text);
    li.appendChild(beschreibung);
    li.appendChild(fuss);
    li.appendChild(fehler);
    satzliste.appendChild(li);

    var platz = {
      nummer: nummer,
      satz: null,
      li: li,
      text: text,
      beschreibung: beschreibung,
      zaehler: zaehler,
      fehler: fehler,
      luecken: []
    };

    wechseln.addEventListener("click", function () {
      var neu = neuenSatzWaehlen();
      if (!neu) return;
      satzZeigen(platz, neu);
      satzAnsage.textContent = "Neuer Satz " + nummer + ": " + neu.text.split(LUECKE).join("…");
    });

    return platz;
  }

  // Setzt einen Satz in einen Platz ein: Text + Lücken als Eingabefelder
  function satzZeigen(platz, satz) {
    platz.satz = satz;
    platz.text.textContent = "";
    platz.luecken = [];
    platz.fehler.hidden = true;
    platz.li.dataset.satzId = satz.id;
    platz.beschreibung.textContent = "Satz " + platz.nummer + ": " + satz.text.split(LUECKE).join("…");

    var stuecke = satz.text.split(LUECKE);
    var anzahlLuecken = stuecke.length - 1;

    stuecke.forEach(function (stueck, i) {
      if (stueck) platz.text.appendChild(document.createTextNode(stueck));
      if (i === anzahlLuecken) return; // nach dem letzten Stück keine Lücke mehr

      var luecke = document.createElement("span");
      luecke.className = "luecke";
      bearbeitbarMachen(luecke);
      luecke.setAttribute("role", "textbox");
      luecke.setAttribute("aria-label", anzahlLuecken > 1
        ? "Satz " + platz.nummer + ", Lücke " + (i + 1) + " von " + anzahlLuecken
        : "Satz " + platz.nummer + ", Lücke");
      luecke.setAttribute("aria-describedby", platz.beschreibung.id + " " + platz.zaehler.id);
      luecke.setAttribute("aria-required", "true");
      luecke.setAttribute("spellcheck", "true");
      luecke.setAttribute("autocapitalize", "none");
      luecke.setAttribute("enterkeyhint", "next");
      luecke.dataset.platz = platz.nummer;

      platz.luecken.push(luecke);
      platz.text.appendChild(luecke);
    });

    zaehlerAktualisieren(platz);
  }

  function platzVonLuecke(el) {
    return plaetze[Number(el.dataset.platz) - 1];
  }

  /* ---------- Eingaben in den Lücken (für alle Lücken gemeinsam) ---------- */

  // Tippen: Zeichengrenze einhalten, Zähler aktualisieren, Fehler ausblenden
  satzliste.addEventListener("input", function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains("luecke")) return;
    var platz = platzVonLuecke(el);

    // leere Lücke wirklich leeren (manche Browser lassen ein <br> zurück)
    if (lueckenText(el) === "" && el.innerHTML !== "") el.innerHTML = "";

    // bei Texteingabe per Silben-/Zeichenwahl (z. B. Japanisch) erst am Ende prüfen
    if (!e.isComposing) {
      var zuViel = zeichenImPlatz(platz) - MAX_ZEICHEN_PRO_SATZ;
      if (zuViel > 0) {
        var zeichen = Array.from(lueckenText(el));
        lueckenTextSetzen(el, zeichen.slice(0, Math.max(0, zeichen.length - zuViel)).join(""));
        cursorAnsEnde(el);
      }
    }

    zaehlerAktualisieren(platz);
    if (lueckenText(el).trim() !== "") el.removeAttribute("aria-invalid");
    if (!platz.fehler.hidden && platz.luecken.every(function (l) { return lueckenText(l).trim() !== ""; })) {
      platz.fehler.hidden = true;
    }
  });

  // Enter springt zur nächsten Lücke, Umschalt+Enter macht einen Zeilenumbruch
  satzliste.addEventListener("keydown", function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains("luecke")) return;
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    if (e.shiftKey) {
      if (restZeichen(platzVonLuecke(el), el) > 0) textEinfuegen(el, "\n");
    } else {
      zurNaechstenLuecke(el);
    }
  });

  // Formatierungen (fett etc.) und Absätze verhindern
  satzliste.addEventListener("beforeinput", function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains("luecke")) return;
    var art = e.inputType || "";
    if (art.indexOf("format") === 0) {
      e.preventDefault();
    } else if (art === "insertParagraph") {
      // „Weiter“-Taste mancher Handy-Tastaturen
      e.preventDefault();
      zurNaechstenLuecke(el);
    } else if (art === "insertLineBreak") {
      e.preventDefault();
      if (restZeichen(platzVonLuecke(el), el) > 0) textEinfuegen(el, "\n");
    }
  });

  // Einfügen: nur reinen Text, auf die Zeichengrenze gekürzt
  satzliste.addEventListener("paste", function (e) {
    var el = e.target.closest ? e.target.closest(".luecke") : null;
    if (!el) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text/plain") || "";
    text = text.replace(/\r\n?/g, "\n");
    var rest = restZeichen(platzVonLuecke(el), el);
    textEinfuegen(el, Array.from(text).slice(0, Math.max(0, rest)).join(""));
  });

  // Hineinziehen von Text/Bildern verhindern
  satzliste.addEventListener("drop", function (e) {
    if (e.target.closest && e.target.closest(".luecke")) e.preventDefault();
  });

  /* ---------- Start: 5 Plätze anlegen und füllen ---------- */

  if (alleSaetze.length < ANZAHL_SAETZE) {
    console.error("saetze.js: Es gibt weniger als " + ANZAHL_SAETZE + " gültige Sätze.");
  }

  var saetzeLaden = $("saetze-laden");
  var saetzeGestartet = false;

  // Legt die 5 Plätze an und wählt die Sätze aus (läuft nur einmal)
  function saetzeStarten() {
    if (saetzeGestartet) return;
    saetzeGestartet = true;
    saetzeLaden.hidden = true;
    for (var n = 1; n <= Math.min(ANZAHL_SAETZE, alleSaetze.length); n++) {
      var platz = platzAnlegen(n);
      plaetze.push(platz);
      satzZeigen(platz, neuenSatzWaehlen());
    }
  }

  // Fragt im Hintergrund ab, wie oft jeder Satz schon beantwortet wurde.
  // Kommt die Antwort zu spät (nach ZAEHLUNG_WARTEZEIT_MS), starten die Sätze
  // rein zufällig – die Zählung wird dann nur noch für „anderen Satz zeigen“
  // genutzt. Fehler blockieren die Umfrage nie.
  function zaehlungLaden() {
    var adresse = webAppUrl + (webAppUrl.indexOf("?") === -1 ? "?" : "&") + "aktion=zaehlung";
    fetch(adresse, { method: "GET", redirect: "follow", cache: "no-store" })
      .then(function (antwort) {
        if (!antwort.ok) throw new Error("Status " + antwort.status);
        return antwort.json();
      })
      .then(function (daten) {
        if (!daten || daten.ok !== true || !daten.zaehlung || typeof daten.zaehlung !== "object") {
          throw new Error("unerwartete Antwort");
        }
        var sauber = {};
        Object.keys(daten.zaehlung).forEach(function (id) {
          var anzahl = Number(daten.zaehlung[id]);
          if (isFinite(anzahl) && anzahl >= 0) sauber[id] = anzahl;
        });
        antwortZaehlung = sauber;
        console.log(saetzeGestartet
          ? "Antwort-Zählung kam verspätet – wird für „anderen Satz zeigen“ genutzt."
          : "Antwort-Zählung geladen – Sätze werden gewichtet ausgewählt.");
      })
      .catch(function (fehler) {
        console.warn("Antwort-Zählung nicht verfügbar – Sätze werden rein zufällig ausgewählt:", fehler);
      })
      .then(saetzeStarten);
  }

  if (modus === "entwurf" || !webAppUrl) {
    // Entwurfsmodus: wie bisher sofort und rein zufällig
    saetzeStarten();
  } else {
    // Hinweis erst nach einer halben Sekunde zeigen (meist ist es dann schon fertig)
    setTimeout(function () { if (!saetzeGestartet) saetzeLaden.hidden = false; }, 500);
    setTimeout(saetzeStarten, ZAEHLUNG_WARTEZEIT_MS);
    zaehlungLaden();
  }

  function saetzePruefen() {
    var erstesProblem = null;
    plaetze.forEach(function (platz) {
      var allesDa = true;
      platz.luecken.forEach(function (el) {
        if (lueckenText(el).trim() === "") {
          el.setAttribute("aria-invalid", "true");
          allesDa = false;
          if (!erstesProblem) erstesProblem = el;
        } else {
          el.removeAttribute("aria-invalid");
        }
      });
      platz.fehler.hidden = allesDa;
      platz.luecken.forEach(function (el) {
        var ids = platz.beschreibung.id + " " + platz.zaehler.id + (allesDa ? "" : " " + platz.fehler.id);
        el.setAttribute("aria-describedby", ids);
      });
    });
    return erstesProblem;
  }

  function saetzeEinsammeln() {
    return plaetze.map(function (platz) {
      return {
        satz_id: platz.satz.id,
        satz: platz.satz.text,
        luecken: platz.luecken.map(function (el) { return lueckenText(el).trim(); })
      };
    });
  }


  /* ===================================================================
     1b. NUTZERNAME
     =================================================================== */

  var nutzernameFeld = $("nutzername");
  var fehlerName = $("fehler-name");
  var fehlerNameText = fehlerName.textContent;   // Standard-Meldung aus index.html
  var EMOJI_MELDUNG = "Emojis sind im Nutzernamen leider nicht möglich.";

  // Wert ohne Leerzeichen am Anfang/Ende (und ohne unsichtbare Steuerzeichen)
  function nutzernameWert() {
    return nutzernameFeld.value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  }

  function nutzernameGueltig() {
    var anzahl = zeichenAnzahl(nutzernameWert());
    return anzahl >= NUTZERNAME_MIN && anzahl <= NUTZERNAME_MAX;
  }

  nutzernameFeld.addEventListener("input", function () {
    // Emojis sofort wieder entfernen und kurz darauf hinweisen
    var ohneEmojis = nutzernameFeld.value.replace(new RegExp(EMOJI_MUSTER, "gu"), "");
    if (ohneEmojis !== nutzernameFeld.value) {
      nutzernameFeld.value = ohneEmojis;
      fehlerName.textContent = EMOJI_MELDUNG;
      fehlerName.hidden = false;
      return;
    }
    // höchstens NUTZERNAME_MAX Zeichen
    var zeichen = Array.from(nutzernameFeld.value);
    if (zeichen.length > NUTZERNAME_MAX) {
      nutzernameFeld.value = zeichen.slice(0, NUTZERNAME_MAX).join("");
    }
    if (fehlerName.textContent === EMOJI_MELDUNG) {
      fehlerName.hidden = true;          // Emoji-Hinweis beim Weitertippen ausblenden
      fehlerName.textContent = fehlerNameText;
    }
    if (nutzernameGueltig()) {
      fehlerName.hidden = true;
      nutzernameFeld.removeAttribute("aria-invalid");
    }
  });

  // Enter springt in die erste Lücke (statt das Formular abzusenden)
  nutzernameFeld.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    var ersteLuecke = alleLuecken()[0];
    if (ersteLuecke) ersteLuecke.focus();
  });


  /* ===================================================================
     2. ZEICHENFLÄCHE – Symbol der Liebe
     =================================================================== */

  var canvas = $("zeichenflaeche");
  var canvasRahmen = $("zeichenflaeche-rahmen");
  var fehlerSymbol = $("fehler-symbol");

  // Stiftfarbe kommt aus style.css (--farbe-stift)
  var stiftfarbe = getComputedStyle(canvas).getPropertyValue("--farbe-stift").trim() || "#E5007D";

  var stiftEinstellungen = {
    minWidth: STIFT_MIN_BREITE,
    maxWidth: STIFT_MAX_BREITE,
    penColor: stiftfarbe,
    backgroundColor: "rgba(0,0,0,0)" // transparent
  };

  var pad = new SignaturePad(canvas, stiftEinstellungen);
  var letzteBreite = 0;
  var geloeschteZeichnung = null; // damit „Rückgängig“ auch „Neu anfangen“ zurücknehmen kann

  // Alle Punkte einer Zeichnung vergrößern/verkleinern (bei Größenänderung)
  function zeichnungSkalieren(daten, faktor) {
    if (faktor === 1) return daten;
    return daten.map(function (gruppe) {
      return Object.assign({}, gruppe, {
        points: gruppe.points.map(function (p) {
          return Object.assign({}, p, { x: p.x * faktor, y: p.y * faktor });
        })
      });
    });
  }

  // Canvas scharf an Bildschirm und Größe anpassen (Zeichnung bleibt erhalten)
  function zeichenflaecheAnpassen() {
    var breite = canvas.offsetWidth;
    var hoehe = canvas.offsetHeight;
    if (!breite || !hoehe || breite === letzteBreite) return;

    var pixelDichte = Math.max(window.devicePixelRatio || 1, 1);
    var daten = pad.toData();
    var faktor = letzteBreite ? breite / letzteBreite : 1;

    canvas.width = Math.round(breite * pixelDichte);
    canvas.height = Math.round(hoehe * pixelDichte);
    canvas.getContext("2d").scale(pixelDichte, pixelDichte);
    pad.clear();
    if (daten.length) pad.fromData(zeichnungSkalieren(daten, faktor));
    if (geloeschteZeichnung) geloeschteZeichnung = zeichnungSkalieren(geloeschteZeichnung, faktor);

    letzteBreite = breite;
  }

  if (window.ResizeObserver) {
    new ResizeObserver(zeichenflaecheAnpassen).observe(canvas);
  } else {
    window.addEventListener("resize", zeichenflaecheAnpassen);
  }
  zeichenflaecheAnpassen();

  function symbolFehlerAusblenden() {
    fehlerSymbol.hidden = true;
    canvasRahmen.classList.remove("zeichenflaeche--fehler");
  }

  pad.addEventListener("endStroke", function () {
    geloeschteZeichnung = null;
    symbolFehlerAusblenden();
  });

  $("zeichnung-zurueck").addEventListener("click", function () {
    var daten = pad.toData();
    if (daten.length) {
      pad.fromData(daten.slice(0, -1));         // letzten Strich entfernen
    } else if (geloeschteZeichnung) {
      pad.fromData(geloeschteZeichnung);        // „Neu anfangen“ zurücknehmen
      geloeschteZeichnung = null;
      symbolFehlerAusblenden();
    }
  });

  $("zeichnung-neu").addEventListener("click", function () {
    var daten = pad.toData();
    if (!daten.length) return;
    geloeschteZeichnung = daten.slice();
    pad.clear();
  });

  // Erzeugt SVG und hochaufgelöstes PNG (transparent, Striche in EXPORT_STIFTFARBE)
  function zeichnungExportieren() {
    var daten = pad.toData().map(function (gruppe) {
      return Object.assign({}, gruppe, { penColor: EXPORT_STIFTFARBE });
    });
    var breite = canvas.offsetWidth || letzteBreite;
    var hoehe = canvas.offsetHeight || breite;

    // SVG: Vektorgrafik in Bildschirm-Koordinaten
    var svgCanvas = document.createElement("canvas");
    svgCanvas.width = canvas.width;
    svgCanvas.height = canvas.height;
    var svgPad = new SignaturePad(svgCanvas, stiftEinstellungen);
    svgPad.fromData(daten);
    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgPad.toSVG();
    svgPad.off();

    // PNG: dieselbe Zeichnung, hochgerechnet auf EXPORT_PNG_BREITE
    var faktor = EXPORT_PNG_BREITE / breite;
    var pngCanvas = document.createElement("canvas");
    pngCanvas.width = EXPORT_PNG_BREITE;
    pngCanvas.height = Math.round(hoehe * faktor);
    pngCanvas.getContext("2d").scale(faktor, faktor);
    var pngPad = new SignaturePad(pngCanvas, stiftEinstellungen);
    pngPad.fromData(daten);
    var png = pngCanvas.toDataURL("image/png");
    pngPad.off();

    return { svg: svg, png: png };
  }


  /* ===================================================================
     3. FARBE DER LIEBE (CMYK)
     =================================================================== */

  var KANAELE = { c: "Cyan", m: "Magenta", y: "Yellow", k: "Key (Schwarz)" };
  var farbe = { c: 0, m: 0, y: 0, k: 0 };
  var farbvorschau = $("farbvorschau");
  var farbwerte = $("farbwerte");

  function begrenzen(wert) {
    return Math.min(100, Math.max(0, Math.round(wert)));
  }

  // einfache Umrechnung CMYK → RGB (nur für die Bildschirm-Vorschau)
  function cmykZuHex(c, m, y, k) {
    var r = Math.round(255 * (1 - c / 100) * (1 - k / 100));
    var g = Math.round(255 * (1 - m / 100) * (1 - k / 100));
    var b = Math.round(255 * (1 - y / 100) * (1 - k / 100));
    return "#" + [r, g, b].map(function (wert) {
      return ("0" + wert.toString(16)).slice(-2);
    }).join("").toUpperCase();
  }

  function farbeAnzeigen() {
    var hex = cmykZuHex(farbe.c, farbe.m, farbe.y, farbe.k);
    farbvorschau.style.backgroundColor = hex;
    farbwerte.textContent = "C " + farbe.c + " · M " + farbe.m + " · Y " + farbe.y + " · K " + farbe.k + " · " + hex;
  }

  Object.keys(KANAELE).forEach(function (kanal) {
    var regler = $("regler-" + kanal);
    var zahl = $("zahl-" + kanal);

    function setzen(wert, quelle) {
      wert = begrenzen(wert);
      farbe[kanal] = wert;
      if (quelle !== "regler") regler.value = wert;
      if (quelle !== "zahl") zahl.value = wert;
      regler.setAttribute("aria-valuetext", KANAELE[kanal] + " " + wert + " Prozent");
      farbeAnzeigen();
    }

    regler.addEventListener("input", function () {
      setzen(Number(regler.value), "regler");
    });

    // beim Tippen sofort übernehmen, aber das Feld nicht „wegkorrigieren“
    zahl.addEventListener("input", function () {
      if (zahl.value === "") return;
      var wert = Number(zahl.value);
      if (isNaN(wert)) return;
      setzen(wert, wert < 0 || wert > 100 ? "" : "zahl");
    });

    // beim Verlassen des Felds aufräumen (leer → 0, Kommazahl → ganze Zahl)
    zahl.addEventListener("change", function () {
      var wert = Number(zahl.value);
      setzen(isNaN(wert) ? 0 : wert, "");
    });

    setzen(Number(regler.value) || 0, "");
  });


  /* ===================================================================
     4. ABSENDEN
     =================================================================== */

  var formular = $("umfrage");
  var absendenKnopf = $("absenden");
  var erneutKnopf = $("erneut-senden");
  var einverstanden = $("einverstanden");
  var fehlerEinverstanden = $("fehler-einverstanden");
  var fehlerSammel = $("fehler-sammel");
  var sendefehler = $("sendefehler");
  var sendefehlerText = $("sendefehler-text");
  var honigtopf = $("website");
  var danke = $("danke");

  var sendetGerade = false;
  var erfolgreichGesendet = false;
  var absendenText = absendenKnopf.textContent;

  einverstanden.addEventListener("change", function () {
    if (einverstanden.checked) {
      fehlerEinverstanden.hidden = true;
      einverstanden.removeAttribute("aria-invalid");
    }
  });

  // Prüft alles. Gibt das erste fehlerhafte Element zurück (oder null)
  function allesPruefen() {
    var probleme = [];
    var erstes = null;

    if (!nutzernameGueltig()) {
      fehlerName.textContent = fehlerNameText;
      fehlerName.hidden = false;
      nutzernameFeld.setAttribute("aria-invalid", "true");
      probleme.push("einen Nutzernamen eingeben");
      erstes = nutzernameFeld;
    } else {
      fehlerName.hidden = true;
      nutzernameFeld.removeAttribute("aria-invalid");
    }

    var luecke = saetzePruefen();
    if (luecke || plaetze.length === 0) {
      probleme.push("alle Lücken ausfüllen");
      if (!erstes) erstes = luecke || $("titel-saetze");
    }

    if (pad.isEmpty()) {
      fehlerSymbol.hidden = false;
      canvasRahmen.classList.add("zeichenflaeche--fehler");
      probleme.push("deine Beziehung zu ABKD zeichnen");
      if (!erstes) erstes = $("titel-symbol");
    } else {
      symbolFehlerAusblenden();
    }

    if (!einverstanden.checked) {
      fehlerEinverstanden.hidden = false;
      einverstanden.setAttribute("aria-invalid", "true");
      probleme.push("dein Einverständnis bestätigen");
      if (!erstes) erstes = einverstanden;
    }

    if (probleme.length) {
      var liste = probleme.length > 1
        ? probleme.slice(0, -1).join(", ") + " und " + probleme[probleme.length - 1]
        : probleme[0];
      fehlerSammel.textContent = "Fast geschafft! Bitte noch " + liste + ".";
      fehlerSammel.hidden = false;
    } else {
      fehlerSammel.hidden = true;
    }
    return erstes;
  }

  function ladezustand(an) {
    absendenKnopf.disabled = an;
    erneutKnopf.disabled = an;
    absendenKnopf.setAttribute("aria-busy", an ? "true" : "false");
    absendenKnopf.textContent = an ? "Wird gesendet …" : absendenText;
  }

  function dankeZeigen() {
    erfolgreichGesendet = true;
    formular.hidden = true;
    danke.hidden = false;
    window.scrollTo(0, 0);
    danke.focus();
  }

  function sendefehlerZeigen(meldung) {
    sendefehlerText.textContent = meldung;
    sendefehler.hidden = false;
    absendenKnopf.hidden = true;  // stattdessen „Erneut versuchen“
    erneutKnopf.focus();
  }

  function datenZusammenstellen() {
    var zeichnung = zeichnungExportieren();
    return {
      version: 1,
      test: alsTestSenden,
      website: honigtopf.value,   // Spam-Schutz, muss leer sein
      einverstanden: einverstanden.checked,
      nutzername: nutzernameWert(),
      saetze: saetzeEinsammeln(),
      farbe: {
        c: farbe.c, m: farbe.m, y: farbe.y, k: farbe.k,
        hex: cmykZuHex(farbe.c, farbe.m, farbe.y, farbe.k)
      },
      symbol: { svg: zeichnung.svg, png: zeichnung.png }
    };
  }

  // Ausgabe im Entwurfsmodus (Browser-Konsole: Rechtsklick → Untersuchen → Konsole)
  function inKonsoleZeigen(daten) {
    console.group("Entwurfsmodus – diese Daten WÜRDEN gesendet (es wurde nichts gesendet):");
    console.log("Nutzername: " + daten.nutzername);
    daten.saetze.forEach(function (s) {
      var teile = s.satz.split(LUECKE);
      var ganz = teile.reduce(function (text, teil, i) {
        return text + teil + (i < s.luecken.length ? s.luecken[i] : "");
      }, "");
      console.log(s.satz_id + ": " + ganz);
    });
    console.log("Farbe:", daten.farbe);
    console.log("Zeichnung: SVG " + Math.round(daten.symbol.svg.length / 1024) + " KB, PNG " +
      Math.round(daten.symbol.png.length * 0.75 / 1024) + " KB");
    console.log("Komplette Daten (auch als window.letzteEinsendung):", daten);
    console.groupEnd();
    window.letzteEinsendung = daten;
  }

  async function absenden() {
    if (sendetGerade || erfolgreichGesendet) return;

    sendefehler.hidden = true;
    absendenKnopf.hidden = false;

    var problem = allesPruefen();
    if (problem) {
      if (problem.tagName === "H2") problem.setAttribute("tabindex", "-1");
      problem.focus();
      problem.scrollIntoView({ block: "center" });
      return;
    }

    sendetGerade = true;
    ladezustand(true);

    try {
      // Spam-Schutz: Bot erkannt → so tun, als hätte es geklappt
      if (honigtopf.value) {
        await warte(ENTWURF_LADEZEIT_MS);
        dankeZeigen();
        return;
      }

      var daten = datenZusammenstellen();

      if (modus === "entwurf") {
        inKonsoleZeigen(daten);
        await warte(ENTWURF_LADEZEIT_MS);
        dankeZeigen();
        return;
      }

      if (!webAppUrl) {
        throw new Error("In config.js ist keine WEB_APP_URL eingetragen.");
      }

      var abbruch = window.AbortController ? new AbortController() : null;
      var zeitlimit = setTimeout(function () { if (abbruch) abbruch.abort(); }, SENDE_ZEITLIMIT_MS);

      var antwort;
      try {
        antwort = await fetch(webAppUrl, {
          method: "POST",
          // text/plain vermeidet die CORS-Vorabfrage, die Apps Script nicht beantwortet
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(daten),
          redirect: "follow",
          signal: abbruch ? abbruch.signal : undefined
        });
      } finally {
        clearTimeout(zeitlimit);
      }

      if (!antwort.ok) throw new Error("Server antwortet mit Status " + antwort.status);

      var ergebnis;
      try {
        ergebnis = await antwort.json();
      } catch (e) {
        throw new Error("Antwort des Servers ist kein JSON – stimmt die WEB_APP_URL und ist die Web-App für „Jeder“ freigegeben?");
      }

      if (!ergebnis || ergebnis.ok !== true) {
        var fehler = new Error((ergebnis && ergebnis.meldung) || "Unbekannter Fehler auf dem Server");
        fehler.vomServer = true;
        throw fehler;
      }

      console.log("Gesendet. Teilnahme-ID:", ergebnis.id, alsTestSenden ? "(Test)" : "");
      dankeZeigen();

    } catch (fehler) {
      console.error("Senden fehlgeschlagen:", fehler);
      var meldung;
      if (fehler.vomServer) {
        meldung = "Das hat leider nicht geklappt: " + fehler.message + " Deine Eingaben sind noch da.";
      } else if (fehler.name === "AbortError") {
        meldung = "Das dauert gerade zu lange. Bitte prüf deine Internetverbindung – deine Eingaben sind noch da.";
      } else {
        meldung = "Das hat leider nicht geklappt. Bitte prüf deine Internetverbindung und versuch es noch einmal – deine Eingaben sind noch da.";
      }
      if (modus !== "live" && !webAppUrl) {
        meldung = "Keine WEB_APP_URL in config.js eingetragen (nur im Test sichtbar).";
      }
      sendefehlerZeigen(meldung);
    } finally {
      sendetGerade = false;
      if (!erfolgreichGesendet) ladezustand(false);
    }
  }

  // Sammelmeldung aktuell halten, sobald etwas nachgetragen wurde
  function sammelmeldungAktualisieren() {
    if (!fehlerSammel.hidden) allesPruefen();
  }
  formular.addEventListener("input", sammelmeldungAktualisieren);
  formular.addEventListener("change", sammelmeldungAktualisieren);
  pad.addEventListener("endStroke", sammelmeldungAktualisieren);

  formular.addEventListener("submit", function (e) {
    e.preventDefault();
    absenden();
  });
  erneutKnopf.addEventListener("click", absenden);

  // Warnung beim Verlassen der Seite, wenn schon etwas eingegeben wurde
  // (nicht im Entwurfsmodus, damit das Neuladen beim Gestalten nicht nervt)
  window.addEventListener("beforeunload", function (e) {
    if (modus === "entwurf" || erfolgreichGesendet) return;
    var etwasEingegeben = !pad.isEmpty() || nutzernameWert() !== "" || alleLuecken().some(function (el) {
      return lueckenText(el).trim() !== "";
    });
    if (etwasEingegeben) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

})();
