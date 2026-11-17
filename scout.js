export const CENTER = { lat: 34.6868, lon: -118.1542 };

export function category(tags) {
  if (tags.leisure === 'fitness_centre' || tags.leisure === 'sports_centre') return 'Fitness & recreation';
  if (tags.building === 'apartments') return 'Apartments';
  if (tags.amenity === 'clinic' || tags.amenity === 'hospital') return 'Healthcare';
  if (tags.shop === 'laundry' || tags.amenity === 'car_wash') return 'Waiting areas';
  if (tags.office || tags.industrial || ['warehouse', 'industrial'].includes(tags.building)) return 'Workplaces';
  return 'Community';
}

export function distanceKm(lat, lon) {
  const r = Math.PI / 180;
  const a = Math.sin((lat - CENTER.lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(CENTER.lat * r) * Math.sin((lon - CENTER.lon) * r / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function prospects(elements, radiusKm) {
  return elements.flatMap(element => {
    const t = element.tags || {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || t.amenity === 'vending_machine') return [];
    const distance = distanceKm(lat, lon);
    if (distance > radiusKm) return [];
    const type = category(t);
    const reasons = {
      'Workplaces': ['Potential repeat weekday audience', 'Ask about employee count and break-room access'],
      'Apartments': ['Potential repeat resident audience', 'Ask about occupied units and shared indoor space'],
      'Healthcare': ['Potential staff and visitor waiting time', 'Ask about food-service contracts and visiting hours'],
      'Waiting areas': ['Customers may spend time waiting', 'Ask about daily customers and available power'],
      'Fitness & recreation': ['Potential demand for drinks and portable snacks', 'Ask about memberships and existing concessions'],
      'Community': ['Potential gathering place', 'Ask about attendance and permission requirements']
    }[type];
    const base = { 'Workplaces': 65, 'Apartments': 60, 'Healthcare': 60, 'Waiting areas': 65, 'Fitness & recreation': 60, 'Community': 45 }[type];
    const vending = t.vending || t['vending:machine'] || (t['vending_machine'] === 'yes' ? 'reported' : null);
    const score = Math.min(100, base + (t.opening_hours === '24/7' ? 10 : 0) + (t.phone || t['contact:phone'] || t.website || t['contact:website'] ? 5 : 0));
    return [{ id: `${element.type}/${element.id}`, name: t.name || `Unnamed ${type.toLowerCase()} site`, category: type, lat, lon, distance: Math.round(distance * 10) / 10,
      address: [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' ') || 'Address not recorded',
      phone: t.phone || t['contact:phone'] || '', website: t.website || t['contact:website'] || '', hours: t.opening_hours || 'Hours unknown',
      score, reasons, vending: vending ? 'Vending mentioned in map data — verify on site' : 'Existing vending service unknown',
      scoreDetails: `Category ${base} + 24/7 hours ${t.opening_hours === '24/7' ? 10 : 0} + contact available ${t.phone || t['contact:phone'] || t.website || t['contact:website'] ? 5 : 0}` }];
  }).sort((a, b) => b.score - a.score || a.distance - b.distance || a.id.localeCompare(b.id));
}

export function query(radius) {
  const around = `(around:${radius * 1000},${CENTER.lat},${CENTER.lon})`;
  return `[out:json][timeout:25];(nwr[office]${around};nwr[building~"^(warehouse|industrial|apartments)$"]${around};nwr[industrial]${around};nwr[leisure~"^(fitness_centre|sports_centre)$"]${around};nwr[amenity~"^(clinic|hospital|community_centre|library|car_wash)$"]${around};nwr[shop=laundry]${around};);out center tags;`;
}
