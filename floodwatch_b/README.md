# FloodCast Radar — Django backend

The API behind the FloodCast Radar frontend (`../floodwatch_f`), built for the NASA
Space Apps Challenge 2026 challenge **“Dancing with the SARs”**.

The backend **does not process satellite imagery**. An external pipeline (the Google
Colab notebook) turns NISAR granules into a small `web_data/` bundle of CSVs, GeoJSON
and PNG overlays. This service imports that bundle, keeps the history, computes flood
alerts, and serves it all to the frontend.

```
 Colab / GitHub Actions          Django (this repo)                    Next.js frontend
 ───────────────────────         ─────────────────────────────         ─────────────────
 NISAR granules ─► web_data/ ──► import_web_data ─► SQLite ─► /api/* ─► map, charts, alerts
                   (.zip)        compute_alerts                /media/  overlay PNGs
```

## 1. Run it

Python 3.12+ (developed on 3.14).

```bash
cd floodwatch_b
python -m venv nenv && source nenv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # then set SECRET_KEY (command is in the file)
python manage.py migrate
python manage.py createsuperuser   # a staff account for /admin/ and the update button
```

Load data. No real NISAR bundle yet? Build a **demo** bundle from the frontend's
synthetic dataset. It is labelled `demo_data: true` and the UI says so on every page.

```bash
python scripts/make_demo_web_data.py ../floodwatch_f web_data
python manage.py import_web_data web_data --compute-alerts
python manage.py runserver 127.0.0.1:8000
```

Then point the frontend at it:

```bash
cd ../floodwatch_f
echo "FLOODWATCH_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev        # http://localhost:3000
```

The Next server proxies `/api/`, `/media/` and `/admin/` to Django, so the browser only
ever talks to `localhost:3000`. No CORS setup is needed, and the staff login works
for the update button.

## 2. Commands

| Command | What it does |
|---|---|
| `python manage.py import_web_data <dir-or-zip> [--compute-alerts]` | Import a bundle. Idempotent and atomic. Prints per-model counts. |
| `python manage.py compute_alerts` | Apply the alert rules to the newest cycle. Safe to repeat. |
| `python manage.py update_floods [--force]` | Run the pipeline (if configured), fetch/import new data, compute alerts, log an `UpdateRun`. Exits non-zero on failure. |
| `python manage.py test floods` | 69 tests: import, API, alerts, update, offline, admin import. |

### Admin panel (no command line needed)

Sign in at `/admin/` with a superuser (or a staff user with the *Can change data
source* permission). The home page is a **dashboard**: latest cycle, newest radar
image, flooded area, open red/orange alerts, recent update runs, and warnings when the
data is demo data or overdue. Quick actions: **Import data**, **Check for new data
now**, **Recompute alerts**, **Download current data (.zip)**.

**Import data** (`/admin/data/import/`) takes three steps:

1. **Upload.** Drag in the whole `web_data` folder as a `.zip`, *or* just the
   files that changed (e.g. a new `district_cycles.csv`). Loose files are merged
   with the current bundle, so the district boundaries never need re-uploading.
   Each file has a **Download example** with the correct columns.
2. **Check.** The real importer and alert engine run in a transaction that is
   rolled back, and the page shows what *would* change: new cycles, new/changed
   rows per table, alerts that would open or close, and any error with its file,
   line and column. Nothing has changed at this point.
3. **Import.** One click applies it, recomputes alerts, logs an `UpdateRun`
   (`admin:<user>`) and saves the bundle as the current `FLOODWATCH_WEB_DATA`.
   The previous bundle goes to `web_data_backups/` (the last 5 are kept), so
   the daily `update_floods` sees "no change" instead of re-importing old files.

## 3. API

All `GET` endpoints are public and read-only. Errors are JSON `{"error": "..."}` with
the matching status code (404 for unknown districts and cycles).

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/districts/` | GeoJSON FeatureCollection. Each feature carries the full district record. `?format=list` drops the geometry (for search). |
| GET | `/api/districts/<id>/timeline/` | One district across all cycles. `<id>` is the slug (`sirajganj`), numeric id (`60`) or name. |
| GET | `/api/cycles/` | Cycle index with a national summary per cycle. |
| GET | `/api/cycles/<date>/` | Per-district statistics for one cycle (`<date>` = ISO date or `latest`). `?format=csv` downloads it. |
| GET | `/api/national/` | National timeline and the season peak. |
| GET | `/api/overlays/?cycle=<date>` | Overlay PNG URLs with their geographic bounds. |
| GET | `/api/alerts/` | Open alerts. `?cycle=<date>` returns the alerts as they stood at that cycle. |
| GET | `/api/meta/` | Provenance, freshness, `demo_data` flag, thresholds, last update run. |
| POST | `/api/update/` | Run `update_floods`. **Staff only**: session login (`/admin/`) + CSRF, or `Authorization: Token <key>`. |

Response shapes match `floodwatch_f/src/types/floodwatch.ts` exactly. Where the backend
knows more, it adds fields alongside: `flood_km2_est`, `images`, `last_image`, `pk`,
`level_code` (`orange`/`red`), `overlays` (per-frame list), `revisit`.

Two field names worth knowing:

* District **`id` is the slug**, because the frontend uses it in URLs
  (`/district/sirajganj/`). The numeric database id is `pk`.
* **`flooded_km2`** is flood water *seen* by the radar, and **`flooded_pct`** is its
  share of the *observed* area. **`flood_km2_est`** extrapolates that share to the whole
  district. District `flooded_km2` values sum to the national figure.

Create an API token for automation: `python manage.py drf_create_token <staff-username>`.

## 4. `web_data` format

> **Please check this against the real Colab output.** The original spec named the
> source files but not every column. The columns below follow the spec's model field
> names. `district_cycles.csv` and `national_cycles.csv` are my naming for the
> per-cycle files. If the notebook writes different names, the importer needs a small
> change. Send me a sample bundle.

Accepted as a folder or a `.zip` (the bundle may sit inside one wrapping folder).

| File | Required | Columns / content |
|---|---|---|
| `districts.geojson` | **yes** | FeatureCollection. `properties`: `name_en`, `area_km2` (required); `id` (integer → primary key, otherwise used as slug), `slug`, `name_bn`, `division`, `source_name`, `shape_id`, `regime`, `permanent_water_km2`, `centroid`, `bbox` (optional; centroid/bbox are computed if absent). |
| `district_cycles.csv` | **yes** | `cycle_start, district, observed_km2, flood_km2_seen, coverage_pct, flood_pct, flood_km2_est, images, last_image` |
| `national_cycles.csv` | no | `cycle_start, flood_km2_est, districts_seen, area_seen_km2` |
| `checkframes.csv` | no | `key, epsg, images, water_cutoff_db, cutoff_source, contrast_db, normal_water_method, first, last` |
| `district_observations.csv` | no | `scene, frame, date, district, observed_km2, water_km2, flood_km2` (one row per scene × district) |
| `overlays.json` | no | `[{"file": "overlays/x.png", "date": "…", "kind": "flood"\|"water", "frame": "T045A_F071", "bounds": [[S, W], [N, E]]}]` (or `south/west/north/east` keys). PNG in EPSG:3857 so Leaflet places it exactly. |
| `meta.json` | no | Provenance: `mission, instrument, distributor, product, provisional, demo_data, demo_note, generated_at, boundaries, pipeline`. |

**The Colab notebook's own names are accepted too:** `district` / `district_id` in
`districts.geojson`, `frames.csv` (with a `frame` column) for `checkframes.csv`, `image`
for `scene` in `district_observations.csv`, and `generated_utc` / `data` / text
`boundaries` in `meta.json`. Exact duplicate entries in `overlays.json` are skipped with
a warning. Bengali names, divisions, regimes and official spellings missing from the
GeoJSON are filled from `floods/district_reference.json` (matched by name). Values the
bundle does supply always win. Extra files (`*.json` copies, `preview.png`,
`districts_raw.geojson`) are ignored.

A `district` column accepts the district's numeric id, slug, English name or source name.
Dates are `YYYY-MM-DD`. Percentages must be 0–100, and areas must be ≥ 0.

**`demo_data` defaults to `true`.** The frontend drops the “Demo data” label only when
the bundle's `meta.json` says `"demo_data": false`. Set that only for bundles built
from real NISAR granules.

### Import guarantees

* **Idempotent.** Natural keys throughout (district slug, frame key, scene name,
  (scene, district), (cycle, district), cycle date, overlay file path). Re-importing
  reports every row as *unchanged*.
* **Atomic.** One transaction: a bad row anywhere changes nothing. Errors name the
  file, line, column and value.
* **Never deletes** records that are missing from a newer bundle.
* **Safe with archives.** Rejects absolute paths, `..` and symlinks in ZIPs. Size is
  capped (`FLOODWATCH_MAX_ZIP_MB`). Overlay paths must stay inside the bundle, and
  overlays must be real PNGs (checked with Pillow).

## 5. Alerts

Configured in `settings.FLOOD_ALERTS` (overridable from `.env`):

| Level | Rule |
|---|---|
| **Orange** | `flood_pct ≥ 10%` and `coverage_pct ≥ 50%` |
| **Red** | (`flood_pct ≥ 25%` **or** a rise of ≥ 10 points since the previous well-observed cycle) and `coverage_pct ≥ 50%` |
| **Close** | `flood_pct < 5%`. Between 5% and 10% an open alert stays open as orange, so it doesn't flicker on and off. |

A cycle where the radar saw under 50% of a district neither opens nor closes that
district's alert. A low number from a half-seen district is not evidence the water
has gone.

The engine replays the season cycle by cycle, so `compute_alerts` is deterministic
(no duplicates, ever). The same logic also answers `/api/alerts/?cycle=` for any past
cycle. At most one open alert per district is also enforced by a database constraint.

In the frontend, `orange` shows as *warning* and `red` as *severe* (`level`). The
backend's own code is in `level_code`.

## 5b. Flood-risk outlook and e-mail alerts

**Risk outlook** (`floods/risk.py`): `GET /api/districts/<id>/risk/?cycle=<date>` gives the
chance (2–98%) that a district floods in the next 12-day cycle, a level
(low / moderate / high / severe), a confidence rating, a forecast range for the next pass,
and every factor's contribution. The factors and weights are: current flood share 30%,
last three passes 15%, rising trend 15%, recurrence this season 10%, season peak 5%,
river terrain 10%, permanent water 5%, and monsoon calendar 10%. Only passes up to the requested
cycle are used, so the past outlooks shown by the slider never use later data.
`GET /api/risk/` returns every district, highest risk first.

**E-mail alerts** (`floods/notify.py`):

| Endpoint / command | What it does |
|---|---|
| `POST /api/subscriptions/` `{name, email, district, min_level}` | Sign up (rate-limited) and send a welcome e-mail with today's outlook |
| `GET /api/subscriptions/unsubscribe/<token>/` | One-click unsubscribe (the link is in every e-mail) |
| `python manage.py send_flood_notifications [--force] [--test EMAIL]` | E-mail everyone whose district reached their level |

Notifications also go out **automatically after every successful import**
(`FLOODWATCH_AUTO_NOTIFY=True`). Each subscriber hears about a cycle at most once, unless
the level gets worse. They also get an "all clear" e-mail when the risk drops back to low.
Subscribers and sent e-mails appear in `/admin/`.

With `EMAIL_HOST` empty, e-mails are printed to the server console (demo mode). For real
delivery with Gmail, set `EMAIL_HOST=smtp.gmail.com`, `EMAIL_HOST_USER=<address>` and
`EMAIL_HOST_PASSWORD=<app password>` (see `.env.example`). Set `FLOODWATCH_SITE_URL` to the
public site address so the links in e-mails work.

## 6. Scheduling updates

NISAR revisits each location about **every 12 days**. A daily check therefore usually
finds nothing new. `UpdateRun` records this as `no_change`, and the frontend's
“Latest image” card explains it.

`update_floods` never reports fresh data it didn't get. If the pipeline fails,
nothing is imported. Every outcome is written to an `UpdateRun` (Django admin), and
the site keeps serving the last good data.

**Hackathon demo:** in-process scheduler at 06:00 Asia/Dhaka.

```env
FLOODWATCH_SCHEDULER=True
```

A file lock ensures only one scheduler runs, however many workers start. Staff can
also press **Check for new images** in the Explorer after signing in at `/admin/`.

**Free production (GitHub Actions):** see `deploy/github-actions-update.yml`. CI runs
the pipeline daily and publishes `web_data.zip` as a release asset. The backend
downloads it:

```env
FLOODWATCH_WEB_DATA_URL=https://github.com/<owner>/<repo>/releases/download/web-data-latest/web_data.zip
```

**Server production (cron):**

```cron
0 6 * * * cd /path/to/floodwatch_b && nenv/bin/python manage.py update_floods >> logs/update.log 2>&1
```

Keep `FLOODWATCH_SCHEDULER=False` when using cron, so there is only one scheduler.

To run a pipeline on the server instead, set `FLOODWATCH_PIPELINE_COMMAND` (it must
write `FLOODWATCH_WEB_DATA`). `EARTHDATA_TOKEN` is there for that command; the
backend itself never downloads imagery.

## 7. Production checklist

```env
DEBUG=False
SECRET_KEY=<long random value>
ALLOWED_HOSTS=api.example.org
CSRF_TRUSTED_ORIGINS=https://floodcast-radar.example.org
CORS_ALLOWED_ORIGINS=https://floodcast-radar.example.org   # only if the browser calls Django directly
```

```bash
python manage.py collectstatic --noinput     # admin CSS/JS, served by WhiteNoise
gunicorn config.wsgi                          # or any WSGI server
```

Overlay PNGs are served by Django from `MEDIA_ROOT` at `/media/`. With nginx in front,
serve `/media/` there and set `SERVE_MEDIA=False`.

## 7b. Deploy to Heroku

Everything Heroku needs is in this folder: `Procfile`, `.python-version` (3.14),
`requirements.txt` (gunicorn, Postgres driver) and settings that read `DATABASE_URL`.

| Process | What it runs |
|---|---|
| `release` | `migrate`, then `bootstrap_data`: imports `web_data/` **only if the database is empty** (first deploy). Later deploys never overwrite data imported through the admin. |
| `web` | `restore_overlays` (re-copies overlay PNGs from `web_data/`, because Heroku's disk is wiped on every restart), then gunicorn. |

**One-time setup** (Heroku CLI, from the repository root):

```bash
heroku create floodcast-radar-api                 # any free name
heroku addons:create heroku-postgresql:essential-0 -a floodcast-radar-api
heroku config:set -a floodcast-radar-api \
  DEBUG=False \
  SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(50))')" \
  FLOODWATCH_SITE_URL=https://<your-frontend-domain> \
  SECURE_SSL_REDIRECT=True
```

Set `SECRET_KEY` **before the first push**: the build runs `collectstatic`, which refuses
to start without it when `DEBUG=False`.

**Deploy.** The backend lives in the `floodwatch_b/` subfolder of the monorepo, so push
only that folder to Heroku:

```bash
git remote add heroku https://git.heroku.com/floodcast-radar-api.git   # once
git subtree push --prefix floodwatch_b heroku main                     # every deploy
```

**After the first deploy:**

```bash
heroku run -a floodcast-radar-api python manage.py createsuperuser     # admin login
heroku open -a floodcast-radar-api                                      # JSON index of the API
```

Then point the frontend at it. On Vercel (or wherever the Next.js app runs) set
`FLOODWATCH_API_URL=https://floodcast-radar-api.herokuapp.com` (use the exact URL
`heroku info` shows). The frontend proxies `/api/`, `/media/` and `/admin/`, so the
browser only talks to the frontend domain and officer sign-in cookies just work.

**Optional:**
- E-mail alerts: set `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` (see `.env.example`).
- Daily data check: add the *Heroku Scheduler* add-on with `python manage.py update_floods`
  rather than `FLOODWATCH_SCHEDULER=True` (eco dynos sleep).
- New data imported through the admin is saved in Postgres, but uploaded overlay PNGs
  live on the dyno disk and are lost on restart. For permanent new overlays, commit the
  new `web_data/` and redeploy, then run
  `heroku run python manage.py import_web_data web_data --compute-alerts`.
- Logs: `heroku logs --tail -a floodcast-radar-api`.

## 8. Layout

```
floodwatch_b/
├── config/              settings (env-driven), urls, wsgi/asgi
├── floods/
│   ├── models.py        District, Frame, Scene, DistrictObservation, DistrictCycle,
│   │                    NationalCycle, Overlay, FloodAlert, UpdateRun, DataSource
│   ├── importer.py      bundle → database (idempotent, atomic, safe ZIP handling)
│   ├── alerts.py        alert rules + season replay
│   ├── updater.py       the update job (pipeline → import → alerts → UpdateRun)
│   ├── scheduler.py     optional APScheduler, single instance via file lock
│   ├── serializers.py   response shapes (match the frontend's TypeScript types)
│   ├── api.py           the nine endpoints
│   ├── views.py         / index and /media/ serving
│   ├── admin.py         every model in Django admin
│   ├── management/commands/  import_web_data, compute_alerts, update_floods
│   └── tests/           import, API, alerts, update endpoint, offline
├── scripts/make_demo_web_data.py   demo bundle from the frontend's synthetic data
├── deploy/github-actions-update.yml
├── .env.example  requirements.txt
```

The project package is `config/` (the one you created) rather than the spec's
`floodwatch/`. The structure is otherwise as specified.

## BMD field portal

Bangladesh Meteorological Department officers can register at `/bmd/register/` on the
frontend, sign in, and file **field reports** for the district they are posted to:
situation level (Normal → Extreme danger), water-level trend, rainfall, river gauge
readings, people affected, shelters open, the conditions they see, and the steps they
have taken. Reports appear on the public dashboard at `/bmd/` and on each district page.

- **Verification.** New officers are *pending*. Their reports are published but marked
  “Unverified” until an admin verifies them in `/admin/` → *BMD officers* (bulk actions:
  verify / suspend). Set `BMD_REQUIRE_VERIFICATION=True` to block reports until verified.
- **Moderation.** Admins can hide any report from the public feed (`FieldReport.hidden`).
- **Privacy.** The public API never exposes an officer's e-mail, phone or employee ID.
- **Security.** Session-cookie auth with CSRF on every write; sign-in and registration are
  throttled per IP (`BMD_AUTH_RATE`, default `30/hour`).
- Endpoints are listed at the top of `floods/bmd.py`; tests are in `floods/tests/test_bmd.py`.
