# SouthBeat für Coding-Agenten

SouthBeat ist ein 2D-Pixel-Prügelspiel (Angular 20 SSR, Express, WebSocket). Alle Kämpfer sind
Programmierer im Büro. Diese Datei richtet sich an Coding-Agenten (Claude Code, Codex, Cursor …)
und an Menschen, die neue Inhalte ins Spiel bringen wollen.

## Neue Inhalte: Inhaltspakete statt Code

Neue **Gegner, Arenen, Kämpfer und Attacken** kommen als JSON-Inhaltspaket ins Spiel, nicht als
TypeScript. Ein Paket wird gegen dieselben Balance-Regeln geprüft wie die eingebauten Inhalte.

1. Lies die Spielwerte und Regeln: `npm run content -- reference`
2. Lies das Schema `content/schema/content-pack.schema.json` und das Beispiel
   `content/examples/netzwerk-pack.json`.
3. Lege eine neue Datei an, z. B. `content/packs/mein-paket.json` (Dateiname = Paket-`id`).
4. Prüfe sie: `npm run content -- validate content/packs/mein-paket.json`
   Behebe jeden gemeldeten Fehler, bis `✓` erscheint. Ändere dafür die Werte im Paket,
   nicht die Regeln in `src/app/content/content.ts`.
5. Server neu starten (bzw. neu bauen). Pakete in `content/packs` lädt der Server beim Start.

Alternativ prüft und kopiert `npm run content -- add <datei.json>` ein Paket nach `content/packs`.
`npm run content -- list` zeigt, was installiert ist.

### Was ein Paket enthalten kann

| Feld | Bedeutung |
| --- | --- |
| `moves` | Neue Attacken. `exclusive: true` macht sie zur Signatur-Attacke, die nur Kämpfer aus demselben Paket nutzen dürfen. |
| `arenas` | Arenen aus Bausteinen (`props`): Fenster, Schreibtische, Serverschränke, Schilder, Neon, Pflanzen … Bild 240×135 Pixel, Wand bis y=100. |
| `fighters` | Zusätzliche Kämpfer in der Kämpferauswahl, mit höchstens 22 Statuspunkten wie im Editor. |
| `opponents` | Bonus-Gegner der Einzelspieler-Leiter nach dem Endboss, mit CPU-Verhalten und Sprüchen, höchstens 30 Punkte. |

### Balance-Regeln in Kürze

- **Wucht** = `damage × hits − startupFrames / 2` muss im Bereich des Slots liegen: light 1–3,
  heavy 4–6, kick 2,5–4,5, special 1–6,5 (Geschosse höchstens 4), ultimate 19–21.
  Schnellere Attacken treffen also schwächer.
- `projectileSpeed`, `arc` und `dashSpeed` gibt es nur bei `special`.
- IDs: 2–40 Zeichen `a–z`, `0–9`, `-`, und sie dürfen nicht schon vergeben sein.
- Texte (Namen, Sprüche, Beschreibungen) auf Deutsch, im Büro- und Entwickler-Humor des Spiels.

Die vollständigen Regeln stehen in `src/app/content/content.ts` (`MOVE_RULES`, `packErrors`),
die Arena-Bausteine in `src/app/content/arena-spec.ts` (`PROP_FIELDS`).

## Content-Studio im Spiel

Unter `/studio` beschreiben Spieler in Worten, was sie wollen; ein LLM baut das Paket über
Werkzeugaufrufe (`get_reference`, `validate_pack`, `submit_pack`) und bekommt Regelverstöße
zurückgemeldet, bis das Paket passt. Gespeichert wird erst nach Bestätigung, in
`data/content/` (neben den Spielständen). Der Agent steckt in `src/server/studio/`.

## Entwicklung

```bash
npm ci
npm start                      # Entwicklungsserver
npx ng build && npm run serve:ssr:southbeat
npx ng test --watch=false      # Browser-Tests (Karma)
npm run test:server            # Server-Tests (Node)
npm run content -- validate content/packs/*.json
```

Konventionen: Kommentare und Bezeichner auf Englisch, Texte im Spiel auf Deutsch. Spiellogik
(`src/app/fight`, `src/app/stage`) läuft im Browser und auf dem Server und darf keine
Browser-APIs nutzen. Neue Regeln brauchen Tests.

Wenn das Schema geändert wird: `npm run content -- schema` schreibt die Datei neu; ein Test
prüft, dass Datei und Code übereinstimmen.
