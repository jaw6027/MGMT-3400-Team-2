# Team 2 · Vending venture apps

This shared repository preserves three complementary student apps. Each runs independently and retains its own data. To run them together, use a separate terminal for each command:

| App | Purpose | Command | Port |
| --- | --- | --- | --- |
| Stockroom | Inventory, sales, expiration, restocking | `npm run start:inventory` | 3000 |
| Vendwell | Field research, shared location briefs, scoring, outreach | `npm run dev` (development) or `npm run start:vendwell` (after building) | 3001 |
| Vending Scout | Public listings by radius and browser-local shortlist | `npm run start:scout` | 3002 |

`npm start` retains the original standalone Vending Scout behavior on port 3000 for compatibility; set `PORT=3002` when running alongside Stockroom. Vendwell and Scout accept `PORT` overrides. Stockroom uses its `--port` argument. Run `npm test` for **both Node suites**, `npm run test:inventory` for the Python suite, and `npm run build && npm run test:browser` for Vendwell's production browser workflow. Install Node dependencies with `npm ci --cache /workspace/.npm-cache` before using Vendwell. Stockroom and the original Scout do not require third-party packages.

---

# Vendwell · Lancaster location scout

A student team's workspace for finding and evaluating vending machine opportunities in the Lancaster, California area. Add leads from field visits or public map listings, document the vending gap, compare screening scores, and track host conversations.

## Run locally

Requires **Node.js 24+** and npm. SQLite is built into Node; no database service, API key, or paid provider is needed.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

The Express server serves the React/Vite app on port **3001**. `PORT` overrides the port. On computers without `/workspace`, use `npm ci` or choose another writable npm cache. For a production build:

```sh
npm run build
npm run start:vendwell
```

The Node scripts use `--use-env-proxy` to respect managed environment proxies. Fonts and the default schematic map are bundled locally. An Internet connection is only needed for optional public discovery and street map tiles.

## How the team uses it

1. Choose **Start scouting** to leave the example workspace, then **Add location** for a lead found on a field visit. The six initial examples are fictional teaching scenarios held only in the browser, never real records in the database.
2. Alternatively, **Search public listings** queries OpenStreetMap via Overpass. Add a promising listing to the workspace. Imported records keep their source URL and retrieval date; audience, service status, and other field observations start unknown.
3. Open the location brief and choose **Update location**. Record daily people, time on site, open hours, existing machines, power and space, the host contact, a responsible teammate, and dated evidence. Leave unknown numbers blank.
4. **Shortlist** the best leads, plan visits, and move locations through Contacted, In discussion, and Approved. The Outreach board groups active leads by stage. Not a fit records stay available in Discover with their notes.
5. Search or filter the list and **Export** a CSV of the visible real locations for class analysis. Examples cannot be exported. Use the refresh button to load teammates' latest changes. Stale edits and deletions are rejected rather than silently replacing newer work.

Coordinates are optional. Leads without them appear in the list but have no map pin. Both coordinates must be supplied to place a pin. The default map is explicitly a **schematic**, not a street-navigation map; enable the optional street layer for geographic context.

## What the score means

This is a transparent, project-defined **screening rubric**, not a sales prediction, verified foot-traffic dataset, or proof that a host will approve a machine.

| Signal | Points |
| --- | --- |
| Estimated people per day | 1 per 5 people, capped at 30 |
| Typical time on site | 1 per 3 minutes, capped at 20 |
| Reported vending gap | 25 for no machines, 15 for limited service, 0 for unknown or well served |
| Open hours per day | 1 per 1.6 hours, capped at 10 |
| Power and space confirmed | 10 |
| Host approved | 5 |

Unknown inputs earn zero; observed zero is still a filled signal. Signal coverage counts the five observation fields that are filled, not independent verification. The total rounds once, so rounded components may differ by a point. **Worth a visit** requires a score of 65+, at least three filled observation fields, and a reported gap. Well-served sites are never promoted as underserved; unknown service prompts further verification. Teammates should add dates and sources for every estimate. The scoring guide in the app explains the same rules.

## Public data and networking

- Discovery: `https://overpass-api.de/api/interpreter` (fixed query; no credentials).
- Optional street tiles: `https://tile.openstreetmap.org`.
- Attribution: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL](https://opendatacommons.org/licenses/odbl/). Imported briefs link to their specific map object. Respect the public services' usage policies; discovery is cached for 15 minutes, concurrent searches share one request, and retries are throttled.

The search covers a fixed rectangle (34.60–34.80° N, −118.36–−117.99° E), **not Lancaster's legal city boundary**, and returns at most 100 named map objects across laundromats, auto repair/tire shops, fitness centers, offices, warehouses, and community centers. Coverage is incomplete and listings may be stale. Search is a broad candidate screen, not a comprehensive business directory. Verify the address, activity, city boundary, actual audience, existing vending, and permission on site. Public map listings do not reveal whether vending companies neglect a location.

If map services are blocked or unavailable, manual data entry, scoring, outreach, export, and the schematic map continue to work. In the managed cloud environment, allow the two domains above in environment settings; a saved draft alone does not apply network changes. Live discovery could not be verified during initial development because the environment proxy denied its destination. Automated import tests use a provider fixture, not live results.

## Team data and deployment

Records persist in ignored **`data/vendwell.sqlite`** (with SQLite WAL sidecars while running). Set `DB_PATH` to use another file. A single running app instance shares its database with all its visitors. **GitHub shares code, not the database**: separate student cloud tasks have separate data. For a live team pilot, run one instance behind private team access with a persistent disk and database backups. Stop the app before copying the database, or use a SQLite-aware backup tool. CSV export is an analysis report, not a database restore format.

This first version has **no login or roles**; anyone who can reach the server can change its records. Use private environment access. Add authentication before public deployment, and avoid collecting sensitive personal information. The database directory must remain outside public static files and outside Git. No public deployment is performed by this repository.

## Validation

```sh
npm test
npm run test:inventory
npm run build
npm run test:browser
```

The seven Vendwell Node tests exercise scoring, unknown inputs, validation, on-disk persistence, edit conflicts, API CRUD, import provenance, duplicate prevention, caching, and provider failure. The browser test exercises the built production app using an isolated database and a discovery fixture: desktop/mobile layouts, creating and reloading a lead, visibility to a second page, scoring, filters, shortlisting, outreach, CSV download, imports, edit conflicts, and deletion. It never changes the development database. Screenshots are written to ignored `test-results/`.

Browser checks expect Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` to another installed executable. Build before browser tests so they check current code. No live-provider check is implied by a passing fixture-based suite.

## Structure

- `src/`: React interface, Leaflet map, fictional examples, and shared scoring model.
- `server/`: Express API, SQLite persistence, input validation, and public-place discovery.
- `tests/`: Node and Playwright browser checks.

Follow [AGENTS.md](AGENTS.md) before making changes to the shared project. The original [business suggestions](<Business Idea: Suggestions>) remain available.


---

# Stockroom · Inventory & expiration tracking

A vending machine inventory and expiration tracking app. Requires Python 3.10+; no third-party packages, accounts, or API keys.

## Run

```sh
cd /workspace/MGMT-3400-Team-2
python3 app.py --port 3000
```

Open the app on port 3000. The server binds to `0.0.0.0` by default; use `--host 127.0.0.1` for local-only access. `--db /path/to/file.sqlite3` selects a different database. This classroom demo has no authentication; use it on a trusted development machine.

## Features

- Two sample machines with 12 product slots, seeded only on first launch.
- Inventory, search, machine filters, low-stock alerts (quantity at or below each slot’s threshold).
- Expiration alerts from today through 14 days ahead, inclusive; expired products flagged separately and blocked from sale.
- Record a sale to deduct inventory and save quantity, time, and revenue in one database transaction. Overselling is rejected.
- Restock a slot up to capacity using its existing batch date. Use **Replace batch** for expired products, removing the old batch before entering a new quantity and expiration date.
- Restocking report and fleet-wide CSV export show refill quantities, expiration dates, and batch replacement actions. UI filters apply to the displayed report; the CSV always covers both machines.
- Sales activity and daily fleet revenue. Daily calculations use the server’s local calendar date.

Data persists in `data/inventory.sqlite3` (Git-ignored). Sample expiration dates are relative to the date the database is first created and remain fixed afterward. Sample sales begin empty. To start a separate demo, use a new `--db` path. The current model tracks one expiration batch per product slot. Sales are manually recorded; physical vending-machine integration is outside this demo.

## Verify

```sh
python3 -m unittest discover -s tests -v
```

The tests use temporary databases and a real HTTP server, checking inventory persistence, sale deductions, overselling protection, validation, restocking capacity, expired batch replacement, alert boundaries, and CSV generation.


---

# Team 2 · Vending Scout

A research app for finding prospective vending-machine locations around Lancaster, California. Search public OpenStreetMap records within 5, 10, or 20 km of central Lancaster, filter by category, review explainable fit scores, save leads and outreach notes, and export the visible shortlist as CSV.

## Run

Requires Node.js 24 or newer. No package installation or API key is required. The start command respects the environment's HTTP/HTTPS proxy configuration.

```sh
cd /workspace/MGMT-3400-Team-2
npm start
```

The server uses port 3000 by default; set `PORT` to change it. Run `node --test test/scout.test.js` for ranking, location filtering, HTTP integration, caching, and provider failure tests.

The server needs outbound HTTPS access to `overpass-api.de`. Searches use the public Overpass API, have a 35-second timeout, and cache each radius for 15 minutes. Public service availability and map coverage vary. An unavailable provider shows an error; the app never substitutes fictional business leads. No external fonts, map scripts, or paid services are needed.

## Use the results responsibly

The score is a transparent category heuristic: workplaces and waiting areas start at 65, apartments/healthcare/fitness at 60, and community locations at 45. Recorded 24/7 hours add 10; an available phone or website adds 5. These are starting assumptions, not measured traffic, profitability, or proof that a location is neglected. Distances are straight-line from central Lancaster, not driving distances or city-boundary checks. Records may be unnamed, outdated, missing, or overlap within the same property.

Before approaching a site, verify existing vending and exclusivity contracts, employee/resident/visitor counts, opening hours, decision-maker approval, available power, security, delivery access, and product preferences. Use the map/source link and phone or website when available. Record findings in the notes field.

Saved flags, outreach statuses, and notes live in this browser's local storage; they do not sync between students, devices, or browser origins. Export CSV to share or back up the currently filtered results. Reloading requires another map search to retrieve site details. There is no shared database or authentication in this first version.

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database License.
