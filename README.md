# Team 2 · Vending operations

This repository includes two complementary apps: **Stockroom** for inventory and expiration tracking, and **Vending Scout** for location research. Both apps and their tests are preserved. Run Stockroom on port 3000; to run Scout alongside it, use `PORT=3002 npm start` in a second terminal.

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

The server uses port 3000 by default; set `PORT` to change it. Run `npm test` for ranking, location filtering, HTTP integration, caching, and provider failure tests.

The server needs outbound HTTPS access to `overpass-api.de`. Searches use the public Overpass API, have a 35-second timeout, and cache each radius for 15 minutes. Public service availability and map coverage vary. An unavailable provider shows an error; the app never substitutes fictional business leads. No external fonts, map scripts, or paid services are needed.

## Use the results responsibly

The score is a transparent category heuristic: workplaces and waiting areas start at 65, apartments/healthcare/fitness at 60, and community locations at 45. Recorded 24/7 hours add 10; an available phone or website adds 5. These are starting assumptions, not measured traffic, profitability, or proof that a location is neglected. Distances are straight-line from central Lancaster, not driving distances or city-boundary checks. Records may be unnamed, outdated, missing, or overlap within the same property.

Before approaching a site, verify existing vending and exclusivity contracts, employee/resident/visitor counts, opening hours, decision-maker approval, available power, security, delivery access, and product preferences. Use the map/source link and phone or website when available. Record findings in the notes field.

Saved flags, outreach statuses, and notes live in this browser's local storage; they do not sync between students, devices, or browser origins. Export CSV to share or back up the currently filtered results. Reloading requires another map search to retrieve site details. There is no shared database or authentication in this first version.

Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database License.
