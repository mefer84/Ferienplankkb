# Ferienplan Baar

Ein sehr einfacher webbasierter Ferienplan fuer Mitarbeitende und Admin.

## Start

```powershell
npm.cmd install
npm.cmd start
```

Dann im Browser oeffnen:

```text
http://localhost:3000
```

Erster Admin-Login:

```text
admin123
```

Bitte im Admin-Bereich danach ein eigenes Passwort setzen.

## Funktionen

- Admin erfasst Mitarbeitende mit 25 bis 30 Ferientagen.
- Admin erfasst pro Mitarbeiter bis zu 5 Tage Uebertrag aus dem Vorjahr.
- Uebertrag wird bis 31. Maerz zuerst verbraucht.
- Mitarbeitende loggen sich mit ihrem persoenlichen Code ein und tragen Ferien ein.
- Ueberschneidungen werden im Kalender rot markiert und dem Admin als Warnung angezeigt.
- Zuger Feiertage fuer Baar werden automatisch beruecksichtigt.
- Feiertagsaehnliche Tage koennen im Admin-Bereich ein- oder ausgeschaltet werden.
- PDF-Ausgabe ueber den Button `Drucken`, danach im Browser `Als PDF speichern` waehlen.
- Ganzjahres-, 1.-Halbjahr- und 2.-Halbjahr-Ansicht.

## Daten

Die Daten liegen lokal in:

```text
data/ferienplan.json
```

Der Ordner `data/` ist absichtlich in `.gitignore`, weil dort echte Personaldaten und Passwortdaten liegen.

## Feiertage Zug/Baar

Die gesetzlichen Feiertage orientieren sich an der offiziellen Liste des Kantons Zug. Berchtoldstag, Ostermontag, Pfingstmontag und Stefanstag sind im Kanton Zug feiertagsaehnliche Tage; die App kann sie optional als freie Tage zaehlen.

## Internet-Betrieb

Fuer eine echte Internet-Nutzung sollte die App hinter HTTPS laufen und mit regelmaessigen Backups betrieben werden. Die aktuelle Version ist bewusst einfach gehalten und eignet sich gut fuer einen kleinen Betrieb oder als Startpunkt fuer Hosting.

## Vercel

Die App kann auf Vercel deployed werden. Dort wird die JSON-Datei aus technischen Gruenden in `/tmp` gespeichert. Das ist fuer eine Demo okay, aber nicht dauerhaft. Fuer produktiven Betrieb braucht es eine Datenbank, zum Beispiel Vercel Postgres, Supabase oder Neon.
