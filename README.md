# Ferienplan Baar

Ein sehr einfacher webbasierter Ferienplan für Mitarbeitende und Admin.

## Start

```powershell
npm.cmd install
npm.cmd start
```

Dann im Browser öffnen:

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
- Admin erfasst pro Mitarbeiter bis zu 5 Tage Übertrag aus dem Vorjahr.
- Übertrag wird bis 31. März zuerst verbraucht.
- Mitarbeitende loggen sich mit ihrem persönlichen Code ein und tragen Ferien ein.
- Überschneidungen werden im Kalender rot markiert und dem Admin als Warnung angezeigt.
- Feiertage für Baar werden automatisch berücksichtigt.
- Feiertagsähnliche Tage können im Admin-Bereich ein- oder ausgeschaltet werden.
- PDF-Ausgabe über den Button `Drucken`, danach im Browser `Als PDF speichern` wählen.
- Ganzjahres-, 1.-Halbjahr- und 2.-Halbjahr-Ansicht.

## Daten

Die Daten liegen lokal in:

```text
data/ferienplan.json
```

Der Ordner `data/` ist absichtlich in `.gitignore`, weil dort echte Personaldaten und Passwortdaten liegen.

## Feiertage Baar

Die gesetzlichen Feiertage orientieren sich an der offiziellen kantonalen Feiertagsliste für Baar. Berchtoldstag, Ostermontag, Pfingstmontag und Stefanstag sind feiertagsähnliche Tage; die App kann sie optional als freie Tage zählen.

## Internet-Betrieb

Für eine echte Internet-Nutzung sollte die App hinter HTTPS laufen und mit regelmässigen Backups betrieben werden. Die aktuelle Version ist bewusst einfach gehalten und eignet sich gut für einen kleinen Betrieb oder als Startpunkt für Hosting.

## Vercel

Die App kann auf Vercel deployed werden. Dort wird die JSON-Datei aus technischen Gründen in `/tmp` gespeichert. Das ist für eine Demo okay, aber nicht dauerhaft. Für produktiven Betrieb braucht es eine Datenbank, zum Beispiel Vercel Postgres, Supabase oder Neon.
