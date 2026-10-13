# SouthBeat

Ein 2D-Pixel-Art-Beat-'em-up als Webanwendung, gebaut mit Angular und Server-Side Rendering (SSR).

## Spielidee

- **Eigene Charaktere erstellen:** Im Charakter-Editor gestalten Spieler vor allem das Aussehen und die Moves ihrer Kämpfer.
- **Faire Werte:** Stats wie Stärke, Tempo oder Ausdauer lassen sich nur innerhalb eines vorgegebenen Rahmens verteilen, damit die Spielbalance erhalten bleibt.
- **Multiplayer:** Die erstellten Charaktere treten online gegeneinander an.

## Stand

- **Charakter-Editor** (`/editor`): Name, Hautfarbe, Frisur, Haarfarbe, Outfit, je ein Move pro Slot (leichter Schlag, schwerer Schlag, Tritt, Spezialangriff) und vier Werte mit Live-Pixel-Vorschau. Gespeichert wird vorerst im Browser.
- **Balance-Regeln** (`src/app/character/balance.ts`): Jeder Wert liegt zwischen 1 und 10, insgesamt dürfen 22 Punkte verteilt werden. `characterErrors()` prüft einen kompletten Charakter, damit später auch der Server manipulierte Werte ablehnen kann.

Kampf und Multiplayer folgen.

## Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm start            # Dev-Server auf http://localhost:4200
npm run build        # Produktions-Build inkl. SSR
npm run serve:ssr:southbeat   # gebaute SSR-App starten (Port 4000)
npm test             # Unit-Tests
```
