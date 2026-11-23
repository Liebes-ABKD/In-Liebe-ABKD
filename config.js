/* =====================================================================
   EINSTELLUNGEN – abkd-ichliebedich
   =====================================================================
   Hier stehen alle Einstellungen, die ihr im Laufe des Projekts ändert.
   Nach jeder Änderung: Datei speichern und (für die Online-Seite) wieder
   ins GitHub-Repository hochladen.
   ===================================================================== */



/* MODUS – wie sich die Seite beim Absenden verhält:

   "entwurf"  Es wird NICHTS gesendet. Das Absenden wird nur simuliert,
              die Daten erscheinen in der Browser-Konsole. Zum Gestalten
              und Durchklicken. Hinweis „Entwurfsmodus“ auf der Seite.

   "test"     Es wird echt gesendet, aber jede Einsendung ist als Test
              markiert (test = WAHR im Sheet, Zeichnungen mit „TEST_“).
              Hinweis „Testmodus“ auf der Seite.

   "live"     Echte Einsendungen, kein Hinweis.
              Tipp: Wird die Seite mit  ?test=1  am Ende der Adresse
              geöffnet, wird trotzdem als Test gesendet, z. B.
              https://abkd-ichliebedich.github.io/abkd-ichliebedich/?test=1
*/
var MODUS = "test";


/* WEB_APP_URL – Adresse der Google-Apps-Script-Web-App.
   Bekommt ihr beim Bereitstellen des Scripts („Bereitstellen“ →
   „Neue Bereitstellung“). Sie endet auf  /exec
   Beispiel: "https://script.google.com/macros/s/AKfy...xyz/exec"
   Im Entwurfsmodus darf sie leer bleiben.
*/
var WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwRhy2BQWoWmHPVgv9kT4PgBy0upMkkSFBRQOdtdrphxK4La2zO9sTGNlQG14JfIT4Wqw/exec";
