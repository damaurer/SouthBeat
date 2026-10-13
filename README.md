# SouthBeat

Ein 2D-Pixel-Art-Beat-'em-up als Webanwendung, gebaut mit Angular und Server-Side Rendering (SSR).

## Spielidee

- **Eigene Charaktere erstellen:** Im Charakter-Editor gestalten Spieler vor allem das Aussehen und die Moves ihrer Kämpfer.
- **Faire Werte:** Stats wie Stärke, Tempo oder Ausdauer lassen sich nur innerhalb eines vorgegebenen Rahmens verteilen, damit die Spielbalance erhalten bleibt.
- **Kämpfer:** Alle Kämpfer sind Programmierer, ihre Moves kommen vom Schreibtisch (Tastatur-Jab, Kaffee-Wurf, Merge-Konflikt …).
- **Schauplatz:** Gekämpft wird in Büros, vom Bunker-Office bis zur Dachterrasse.
- **Multiplayer:** Die erstellten Charaktere treten online gegeneinander an.

## Stand

- **Charakter-Editor** (`/editor`): Name, Haut- und Augenfarbe, 7 Frisuren, 6 Bartstile, Haar-/Bartfarbe, 10 Outfits (Hemd mit Krawatte, Anzug, Business Casual, Karate-Gi, Tanktop, Lederjacke, Hoodie, Ninja, Wrestler, Rüstung) mit eigener Farbe, je ein Move pro Slot (leichter Schlag, schwerer Schlag, Tritt, Spezialangriff) und vier Werte mit Live-Pixel-Vorschau (32×48 Pixel mit Licht, Schatten und Umriss). Gespeichert wird über die Server-API in einer Datei (siehe unten).
- **Balance-Regeln** (`src/app/character/balance.ts`): Jeder Wert liegt zwischen 1 und 10, insgesamt dürfen 22 Punkte verteilt werden. `characterErrors()` prüft einen kompletten Charakter, damit später auch der Server manipulierte Werte ablehnen kann.

- **Arenen** (`/arena`): 10 Büro-Arenen als Pixel-Art (Bunker-Office, Dachterrasse-Office, Großraumbüro, Serverraum, Startup-Loft, Teeküche, Meetingraum, Chefbüro, Garagen-Start-up, Hackathon-Nacht). Die Auswahl zeigt den eigenen Charakter gegen einen Sparringspartner in der Szene. Gezeichnet wird in `src/app/arena/arenas.ts`.

Kampf und Multiplayer folgen.

## Speicherung

Erstellte Kämpfer und Spielstatistiken (Matches, Siege, Niederlagen, Arenen) speichert der SSR-Server in einer JSON-Datei, standardmäßig `data/southbeat.json` (per `SOUTHBEAT_DATA_FILE` änderbar, von Git ignoriert). Der Browser merkt sich nur die ID des eigenen Kämpfers.

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/api/fighters` | alle Kämpfer |
| GET | `/api/fighters/:id` | ein Kämpfer mit Bilanz |
| POST | `/api/fighters` | Kämpfer anlegen |
| PUT | `/api/fighters/:id` | Kämpfer ändern |
| GET | `/api/stats` | Gesamtstatistik und Rangliste |
| POST | `/api/matches` | Matchergebnis speichern (`winnerId`, `loserId`, `arenaId`) |

Der Server prüft jeden Kämpfer gegen die Balance-Regeln, manipulierte Werte werden abgelehnt.

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm start            # Dev-Server auf http://localhost:4200
npm run build        # Produktions-Build inkl. SSR
npm run serve:ssr:southbeat   # gebaute SSR-App starten (Port 4000)
npm test             # Unit-Tests
```
