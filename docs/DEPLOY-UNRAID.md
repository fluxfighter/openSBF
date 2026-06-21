# OpenSBF auf Unraid hosten

Single-user, kein Login. Ein Docker-Container serviert die App; der Lernfortschritt
liegt als eine JSON-Datei in einem persistenten Volume und wird so über alle Geräte
(Handy + PC) im Heimnetz geteilt.

/ Architektur in einem Satz: Next.js (standalone) → Container Port `3000` → Daten in
`/data/progress.json` (gemappt nach `/mnt/user/appdata/opensbf`).

---

## Empfohlener Weg: docker compose auf Unraid (Image lokal bauen)

Am einfachsten für einen Heim-Single-User: Repo auf Unraid holen und mit
`docker compose` bauen + starten. Kein externes Registry/Token nötig.

### Voraussetzungen
- Docker ist in Unraid aktiv (Standard).
- `docker compose` verfügbar. In aktuellen Unraid-Versionen ist das v2-Plugin oder
  die **Compose Manager**-App (Community Applications) der bequemste Weg. Test:
  ```bash
  docker compose version
  ```
  Falls nicht vorhanden: in Community Applications **„Compose Manager"** installieren.
- `git` (über das **NerdTools**-Plugin) — alternativ das Repo per Browser als ZIP
  herunterladen und nach `/boot/.../` bzw. ins Zielverzeichnis entpacken.

### Schritte (per SSH)
```bash
# 1) Zielordner (überlebt Reboots, da auf dem Array)
mkdir -p /mnt/user/appdata/opensbf
cd /mnt/user/appdata

# 2) Repo holen (Branch mit dem aktuellen Stand)
git clone https://github.com/fluxfighter/openSBF.git opensbf-src
cd opensbf-src
git checkout learning-focus      # bis es in main gemerged ist

# 3) Bauen & starten (erster Build dauert ein paar Minuten)
docker compose up -d --build

# 4) Status / Logs
docker compose ps
docker compose logs -f opensbf
```

Aufruf danach: `http://<UNRAID-IP>:3000`

> Port belegt? In `docker-compose.yml` die **linke** Zahl bei `ports:` ändern
> (z. B. `"3080:3000"`) und `docker compose up -d` erneut ausführen.

### Update auf eine neue Version
```bash
cd /mnt/user/appdata/opensbf-src
git pull
docker compose up -d --build
```
Der Lernfortschritt bleibt erhalten (liegt im separaten Volume, nicht im Image).

### Stoppen / Entfernen
```bash
docker compose down            # Container weg, Daten bleiben in appdata
```

---

## Daten & Backup

- Alles liegt in **`/mnt/user/appdata/opensbf/progress.json`**.
- Im Unraid **CA Appdata Backup**-Plugin ist `appdata` ohnehin abgedeckt.
- Manuelles Backup: einfach die Datei kopieren.
- In der App selbst gibt es zusätzlich **Profil → Daten → Export/Import** als
  manuelles Backup, unabhängig vom Server.

---

## Als App aufs Handy (PWA)

Die Seite im mobilen Browser öffnen → „Zum Home-Bildschirm hinzufügen". Dann läuft
OpenSBF wie eine native App im Vollbild. Voraussetzung fürs reibungslose Sync:
alle Geräte greifen auf **dieselbe** Unraid-Adresse zu.

> Service Worker / PWA brauchen idealerweise HTTPS. Im reinen Heimnetz funktioniert
> es über `http://<IP>:Port`; für „echtes" PWA-Verhalten von außen einen Reverse
> Proxy mit TLS davorsetzen (z. B. **SWAG** oder **Nginx Proxy Manager**).

---

## Alternative: Verwaltung über die Unraid-Docker-UI

Wenn du den Container lieber im Web-UI siehst, gibt es zwei Wege:

1. **Compose Manager** zeigt den per Compose erstellten Stack im UI an (Start/Stop/Logs).
2. **Image in eine Registry pushen** (z. B. GHCR) und dann in Unraid über
   *Docker → Add Container* manuell anlegen:
   - Repository: `ghcr.io/<user>/opensbf:latest`
   - Port: `3000` (Host frei wählbar)
   - Pfad/Volume: Container `/data` → Host `/mnt/user/appdata/opensbf`
   - Variable: `OPENSBF_DATA_DIR=/data`

   Das ist „Unraid-nativer" (Auto-Update über CA), kostet aber Registry + Token.
   Für einen Single-User-Heimbetrieb ist der Compose-Weg oben einfacher.

---

## Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| `docker compose: command not found` | Compose Manager (CA) installieren oder v2-Binary einrichten |
| Build bricht ab | Logs lesen: `docker compose logs`. Genug RAM/Speicher frei? |
| Seite lädt, Fortschritt weg nach Rebuild | Volume-Mapping prüfen: `/mnt/user/appdata/opensbf:/data` muss gesetzt sein |
| Sync zwischen Geräten klappt nicht | Beide Geräte müssen dieselbe IP/denselben Port nutzen; Container-Logs auf `PUT /api/state` checken |
| Container „unhealthy" | `docker compose logs opensbf` — meist Startfehler; Healthcheck pingt `/api/state` |

---

## Was ich (Claude) per SSH übernehmen kann

Wenn du mir SSH-Zugang gibst, kann ich:
1. Voraussetzungen prüfen (`docker`, `docker compose`, Pfade).
2. Repo klonen/aktualisieren und den Container bauen + starten.
3. Health/Logs verifizieren und die Erreichbarkeit testen.
4. Port/Volume an deine Unraid-Gegebenheiten anpassen.

Bereithalten: Unraid-IP, gewünschter Port, und ob `appdata` unter dem Standardpfad
`/mnt/user/appdata` liegt.
