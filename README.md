# SouthBeat

Ein 2D-Pixel-Art-Beat-'em-up als Webanwendung, gebaut mit Angular und Server-Side Rendering (SSR).

## Spielidee

- **Eigene Charaktere erstellen:** Im Charakter-Editor gestalten Spieler vor allem das Aussehen und die Moves ihrer Kämpfer.
- **Faire Werte:** Stats wie Stärke, Tempo oder Ausdauer lassen sich nur innerhalb eines vorgegebenen Rahmens verteilen, damit die Spielbalance erhalten bleibt.
- **Kämpfer:** Alle Kämpfer sind Programmierer, ihre Moves kommen vom Schreibtisch (Tastatur-Jab, Kaffee-Wurf, Merge-Konflikt …).
- **Schauplatz:** Gekämpft wird in Büros, vom Bunker-Office bis zur Dachterrasse.
- **Multiplayer:** Die erstellten Charaktere treten online gegeneinander an.

## Stand

- **Charakter-Editor** (`/editor`): Name, Körperbau (normal, kräftig, schlank), Accessoire (Brille, Sonnenbrille, Headset, Offiziersmütze), Haut- und Augenfarbe, 7 Frisuren, 6 Bartstile, Haar-/Bartfarbe, 12 Outfits (Hemd mit Krawatte, Anzug, Business Casual, Bluse & Rock, Uniform, Karate-Gi, Tanktop, Lederjacke, Hoodie, Ninja, Wrestler, Rüstung) mit eigener Farbe, je ein Move pro Slot (leichter Schlag, schwerer Schlag, Tritt, Spezialangriff, ultimativer Angriff) und vier Werte mit Live-Pixel-Vorschau (32×48 Pixel mit Licht, Schatten und Umriss). Gespeichert wird über die Server-API in einer Datei (siehe unten).
- **Spezialangriffe** gibt es in vier Arten: Geschoss (Kaffee-Wurf, USB-Stick-Schuss), Bogenwurf (Tastatur-Bogenwurf), Sturmangriff (Deadline-Sprint) und Nahkampf (Merge-Konflikt, Stack Overflow). Bei geworfenen Angriffen zeichnet der Spieler sein Geschoss im Editor selbst (12×12 Pixel, 16 Farben, Vorlagen Kaffeetasse, Bug, Diskette, Tomate). Die Zeichnung wird mit dem Kämpfer gespeichert und im Kampf angezeigt.
- **Charakter aus Foto**: Im Editor lässt sich ein Foto auswählen. Der Browser erkennt daraus Hautfarbe, Frisur und Haarfarbe, Bart, Brille oder Sonnenbrille sowie Kleidung (Anzug, Hemd oder Casual) und übernimmt das ins Aussehen, das danach frei weiter bearbeitet werden kann. Die Auswertung läuft komplett lokal (`src/app/character/photo-analysis.ts`); das Foto wird weder hochgeladen noch gespeichert.
- **Balance-Regeln** (`src/app/character/balance.ts`): Jeder Wert liegt zwischen 1 und 10, insgesamt dürfen 22 Punkte verteilt werden. `characterErrors()` prüft einen kompletten Charakter, damit später auch der Server manipulierte Werte ablehnen kann.

- **Kämpferauswahl** (`/select`, Startseite „Freier Kampf“): Aufgebaut wie bei klassischen Prüglern. Oben steht ein Raster mit Porträts: dein Kämpfer, der Sparringspartner, alle Einzelspieler-Gegner und „Zufall“. Gustav Großmaul bleibt als Silhouette gesperrt, bis er im Einzelspieler besiegt ist. Unten hat jeder Spieler ein farbiges Panel (P1 rot, P2 blau, CPU grau) mit Figur, Rolle und Werten. Jeder Spieler steuert seinen eigenen Cursor (P1: WASD, J wählen, K zurück; P2: Pfeiltasten, Num 1 wählen, Num 2 zurück) oder klickt. Gegen die CPU wählt P1 nach dem eigenen Kämpfer auch den der CPU. „zu Spieler 2 wechseln“ macht daraus ein 2-Spieler-Match. Sind beide gewählt, startet „Bereit zum Kampf!“ die Arena-Auswahl. Die Online-Lobby nutzt dieselbe Auswahl.
- **Arenen** (`/arena`): 10 Büro-Arenen als Pixel-Art (Bunker-Office, Dachterrasse-Office, Großraumbüro, Serverraum, Startup-Loft, Teeküche, Meetingraum, Chefbüro, Garagen-Start-up, Hackathon-Nacht). Die Arena-Auswahl zeigt oben eine große Vorschau mit beiden gewählten Kämpfern und darunter alle Arenen plus „Zufall“ als Raster, steuerbar mit Tasten oder Maus. Gezeichnet wird in `src/app/arena/arenas.ts`.
- **Kampf** (`/fight`): Spielbarer Kampf gegen die CPU oder zu zweit an einer Tastatur, mit Lebens- und Action-Balken und 99-Sekunden-Timer. Der Action-Balken lädt sich mit der Zeit, durch Treffer und durch eingesteckte Treffer auf. Ist er voll, kann der Kämpfer seinen ultimativen Angriff starten (Freitags-Deploy, rm -rf /, Bluescreen oder Endlosschleife); er leert den Balken und lässt sich nicht unterbrechen. Die Regeln stecken in `src/app/fight/combat.ts`.

| | Laufen | Leicht | Schwer | Tritt | Spezial | Ultimate |
| --- | --- | --- | --- | --- | --- | --- |
| Spieler 1 | A / D | J | K | L | Ö | Ä |
| Spieler 2 | ← / → | Num 1 | Num 2 | Num 3 | Num 4 | Num 5 |

W / S und ↑ / ↓ sind für Springen und Ducken reserviert. Ö und Ä beziehen sich auf die deutsche Tastatur.

- **Einzelspieler** (`/singleplayer`): Eine Gegnerleiter durch die Chefetage. Jeder Sieg schaltet den nächsten Gegner frei, der Fortschritt landet in der Datendatei.

| Gegner | Rolle | Stil | Arena |
| --- | --- | --- | --- |
| Bernd Brummer (Bernd) | Co-Teamleiter | Kräftig, Bart und Brille, Bauch-Schubser mit riesigem Rückstoß | Teeküche |
| Konrad Kettner (Konrad) | Teamleiter | Panzer-General, Spezialattacke Panzer-Walze rollt über die ganze Arena | Bunker-Office |
| Lena Flink (Lena) | HO | Sehr schnell, Kombo-Angriffe mit mehreren Treffern pro Taste | Meetingraum |
| Ralf Rackwitz (Ralf) | CTO | Rack-Schlag mit Server-Bauteilen, wirft Festplatten | Serverraum |
| Gustav Großmaul (Gustav) | CPO, Endboss | Alter Mann mit langem Bart, wirft Tomaten (Ultimate Tomatenhagel), redet ununterbrochen und verspricht Kunden Features, die weder abgestimmt noch implementiert sind | Dachterrasse-Office mit Tomatenbeeten |

Die Gegner sprechen in Sprechblasen am oberen Bildschirmrand. Die Sprechblasen sind rein kosmetisch und beeinflussen das Spiel nicht. Gegner und Sprüche stehen in `src/app/singleplayer/opponents.ts`. Außerdem sagen alle Kämpfer, auch in normalen Kämpfen und im 2-Spieler-Modus, hin und wieder etwas, wenn sie getroffen werden: Spieler 1 links oben, Spieler 2 rechts oben. Jeder Gegner hat dafür eigene Sprüche, alle anderen nutzen die allgemeinen aus `src/app/fight/hit-lines.ts`.

Online-Multiplayer folgt.

## Online-Kampf

Unter `/online` (Startseite: „Online-Kampf“) kämpfen zwei Spieler an zwei PCs in Echtzeit gegeneinander. Einer erstellt einen Raum, wählt die Arena und gibt den vierstelligen Raumcode weiter. Der andere tritt mit dem Code bei, und der Kampf startet sofort. Jeder spielt mit seinem gespeicherten Kämpfer und an seinem PC mit den Tasten von Spieler 1 (WASD, J K L Ö Ä). Nach dem Kampf ist eine Revanche möglich. Sind beide Kämpfer gespeichert, zählt das Ergebnis in der Statistik.

Der Kampf läuft auf dem Server (`src/server/online.ts`, WebSocket unter `/online` auf demselben Port). Die Browser schicken nur ihre Tasten und zeichnen die Bilder, die der Server 60-mal pro Sekunde zurückschickt. Beide sehen dadurch immer denselben Kampf, und niemand kann am eigenen Browser schummeln. Die Verzögerung hängt von der Verbindung zum Server ab; im lokalen Netz ist sie kaum spürbar.

Zum Spielen über zwei PCs im selben Netz:

```bash
npm run build
NG_ALLOWED_HOSTS=192.168.1.20 npm run serve:ssr:southbeat   # IP des PCs, auf dem der Server läuft
```

Beide öffnen dann `http://192.168.1.20:4000/online`. Für Spiele übers Internet muss der Server öffentlich erreichbar sein. `ng serve` unterstützt den Online-Kampf nicht, dafür braucht es den gebauten Server.

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
