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
