import { LANCASTER } from '../src/model.js';

const bbox = `${LANCASTER.south},${LANCASTER.west},${LANCASTER.north},${LANCASTER.east}`;
export const query = `[out:json][timeout:20];(nwr["shop"~"^(car_repair|laundry|tyres)$"]["name"](${bbox});nwr["leisure"="fitness_centre"]["name"](${bbox});nwr["office"]["name"](${bbox});nwr["industrial"="warehouse"]["name"](${bbox});nwr["amenity"="community_centre"]["name"](${bbox}););out center tags 100;`;

export function parsePlaces(data) {
  if (!Array.isArray(data.elements)) throw new Error('The map provider returned an unexpected response.');
  return data.elements.flatMap(place => {
    const tags = place.tags ?? {};
    const lat = place.lat ?? place.center?.lat;
    const lng = place.lon ?? place.center?.lon;
    if (!tags.name || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < LANCASTER.south || lat > LANCASTER.north || lng < LANCASTER.west || lng > LANCASTER.east) return [];
    const category = tags.shop === 'laundry' ? 'Laundromat' : ['car_repair', 'tyres'].includes(tags.shop) ? 'Auto service' : tags.leisure ? 'Fitness & recreation' : tags.office ? 'Office' : tags.industrial ? 'Warehouse & industrial' : 'Community & education';
    return [{
      key: `${place.type}/${place.id}`, name: tags.name, category, lat, lng,
      address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || 'Address not listed — verify on visit',
      source: { kind: 'osm', label: 'OpenStreetMap listing', url: `https://www.openstreetmap.org/${place.type}/${place.id}`, key: `${place.type}/${place.id}`, retrievedAt: new Date().toISOString() },
    }];
  });
}

export async function discover() {
  let response;
  try { response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Vendwell-Lancaster-Student-Scout/1.0' },
    body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(28000),
  }); } catch {
    throw new Error('Public map search could not be reached. Check network access to overpass-api.de, try again later, or add a field location manually.');
  }
  if (!response.ok) throw new Error(`Public map search is unavailable (HTTP ${response.status}). Try again later or add a location from a field visit.`);
  const data = await response.json();
  // Overpass can return HTTP 200 and partial data when it times out.
  if (data.remark) throw new Error('Public map search did not complete. Try again later or add a location manually.');
  return parsePlaces(data);
}
