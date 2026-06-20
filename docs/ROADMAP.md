# OpenSBF Fork — Roadmap & Handover

Dieses Dokument ist die **Single Source of Truth**, um an diesem Fork weiterzuarbeiten —
auch ohne Vorwissen aus der vorherigen Session. Bitte bei jedem Fortschritt aktualisieren.

## Ziel & Leitstern
Privater, **self-hostbarer** Lerntrainer für den Sportbootführerschein (See/Binnen),
betrieben auf **Unraid via Docker**. **Ein Nutzer, kein Login** (Heimnetz, Handy + Rechner).

**Leitstern für jede Entscheidung:** Den Nutzer *hooken* und mit **minimalem Zeitaufwand
zum Bestehen** führen — die richtigen Fragen zur richtigen Zeit, ablenkungsarme UI.
*Weniger ist mehr.*

## Tech-Stack
Next.js 16 (App Router) · React 19 · TypeScript (strikt) · Tailwind v4 · PWA · framer-motion.
Kein Supabase/Backend-Dienst mehr — Persistenz über schlanken eigenen JSON-Store.

## Quality Gate (PFLICHT vor jedem Commit)
Aus `app/`:
```bash
npm run lint        # 0 Fehler
npm run typecheck   # 0 Fehler
```
Keine `eslint-disable` / `@ts-ignore` — Ursache fixen. Strikte Typregeln siehe `app/AGENTS.md`.

## Lokal starten / bauen / deployen
```bash
cd app && npm install && npm run dev      # Dev auf :3000
cd app && npm run build                    # Standalone-Build (output: 'standalone')
docker compose up -d --build               # Unraid: 1 Container, Volume /data (OPENSBF_DATA_DIR)
```

## Architektur-Kurzüberblick
- **Persistenz:** `app/src/lib/db.ts` (atomarer JSON-Store) hinter Route Handler
  `app/src/app/api/state/route.ts` (`GET`/`PUT`, serverseitiger Merge via `mergeProgress`).
  Client: `loadProgress/saveProgress` (localStorage + debounced Push), `ProgressBootstrap`
  zieht beim Start den Serverstand → Geräte-Sync Handy↔PC.
- **SRS-Engine:** `app/src/lib/srs.ts` — SM-2-light. `applyGrade` (again/good/easy),
  `buildDailyQueue` (fällig + gedeckelt neu), `getQueueCounts`, `getReadiness`
  (vorhergesagte Trefferquote: gesehen→FSRS-Retrievability, ungesehen→bayessche
  Erstversuchsquote; Ziel `READINESS_TARGET=85`).
- **Gamification:** `app/src/lib/gamification.ts` — Streak/Heute/XP, **rein aus Antwortdaten
  abgeleitet** (kein Datenmodell-Umbau, merge-sicher).
- **Quiz:** `app/src/app/ueben/[exam]/[topic]/page.tsx` — wird für die Tages-Queue
  (`topicId === 'heute'`) und Problemfragen (`schwierige-fragen`) wiederverwendet.
- **Daten:** statische Fragen in `app/src/data/*` (richtige Antwort im Quelltext immer `a`,
  Optionen werden beim Anzeigen gemischt). Tutorials in `app/src/data/tutorials.ts`.

## Status — erledigt
- **P0 Self-Hosting-Skelett** (`5a8ea90`): Supabase/Auth/Forum/Gating entfernt; JSON-Store +
  `/api/state`; Dockerfile + docker-compose; PWA bleibt.
- **P1 SRS + Tages-Queue** (`5d4f41b`): Engine, `recordAnswer` plant Karten,
  „Heute lernen"-Flow, CTAs + Prüfungsreife.
- **P2 Kluge Prüfungsreife + Gamification + Mobile-UI** (`b0ca629`): predicted-score
  Readiness, Streak/XP/Tagesziel-Leiste, mobile-first Karten (framer-motion, große Targets),
  SW-Fix (kein Caching von `/api/*`, Cache v2).
- **UX-Cleanup + Quiz-Flow** (`6b60def`): Logo-Schriftzug raus (Anker bleibt), floating
  Feedback-Button raus, Home-Heading raus, Footer schlank. **Richtig → Auto-Advance**
  (`AUTO_ADVANCE_MS=750`), **falsch → manuell** (Erklärung lesen), **Zurück-Button**
  (+ Pfeil-links) zum Review der Vorfrage.

Alle Commits liegen auf Branch **`selfhost-rework`** (noch **nicht** gepusht).
Default-Branch: `main`. Upstream-Remote (Original) ist gesetzt.

## Offene kleine Stellschrauben (schnell)
- [ ] Auto-Advance-Timing `AUTO_ADVANCE_MS` (aktuell 750 ms) ggf. anpassen.
- [ ] Playfair-Serifenschrift: aktuell noch auf Seitentiteln (z. B. „SBF See",
      „Tagesziel erreicht") und in `globals.css`/`layout`. Entscheiden: durchgängig Inter?

## Nächster großer Schritt — P3 Didaktik
1. **Erklärung immer zeigen** (auch bei richtig), nicht nur bei Fehlern. Aktuell wird
   `currentQuestion.hint` nur im Falsch-Zweig gerendert (`app/src/app/ueben/[exam]/[topic]/page.tsx`).
   → Hint auch bei richtiger Antwort anzeigen (kurz, dezent). Hinweis: nicht alle Fragen
   haben `hint` — fehlende sind Content-Arbeit, nicht blockierend.
2. **Frage ↔ Tutorial verknüpfen:** `tutorials.ts` hat `relatedTopics`. Bei kniffligen
   Fragen einen „Mehr dazu"-Link zum passenden Lernartikel (`/lernen/[slug]`) einblenden.
3. Optional: Eselsbrücken-Feld; smarte Reihenfolge neuer Karten (leichte zuerst).

## Spätere Ideen (P4+)
- Feinschliff Prüfungsreife: echte Bestehensschwellen je Prüfung statt generischer 85 %.
- „Easy"-Bewertung im Quiz (SRS unterstützt `easy` bereits) — nur falls es nicht zu viele
  Klicks bringt (Leitstern beachten).
- Achievements/Meilensteine (dezent), Wochenrückblick.
- Bessere Bild-/Sichtzeichen-Darstellung auf Mobile.

## Test-/Deploy-Stolperfallen (wichtig!)
- **Zombie-Dev-Server:** alte `next dev`-Prozesse blockieren Port 3000 →
  `lsof -ti tcp:3000 | xargs -r kill -9` vor dem Start.
- **PWA Service Worker** cacht im Dev alte Bundles → im Preview vor dem Test SW
  deregistrieren + Caches leeren, dann hart neu laden. In Produktion unkritisch
  (content-gehashte Assets), aber nach Deploy ggf. einmal hart neu laden.
- **Browser-Preview:** `.claude/launch.json` (Config-Name `opensbf`) via Preview-MCP.
- **SRS-Logiktests:** `srs.ts` läuft per Node-Type-Stripping direkt
  (`node datei.mts`) — gut für schnelle Engine-Checks ohne Browser.
