export const categories = ['Warehouse & industrial', 'Auto service', 'Laundromat', 'Fitness & recreation', 'Office', 'Community & education', 'Other'];
export const stages = ['To research', 'Visit planned', 'Contacted', 'In discussion', 'Approved', 'Not a fit'];
export const serviceOptions = { unknown: 'Not checked', none: 'No machines reported', limited: 'Limited service reported', served: 'Already well served' };
export const LANCASTER = { south: 34.60, west: -118.36, north: 34.80, east: -117.99 };

// A transparent screening rubric, not a prediction of sales or permission to install.
export function assess(candidate) {
  const demand = candidate.dailyPeople == null ? 0 : Math.min(30, candidate.dailyPeople / 5);
  const dwell = candidate.dwellMinutes == null ? 0 : Math.min(20, candidate.dwellMinutes / 3);
  const hours = candidate.openHours == null ? 0 : Math.min(10, candidate.openHours / 1.6);
  const service = { unknown: 0, none: 25, limited: 15, served: 0 }[candidate.service] ?? 0;
  const access = candidate.power === 'yes' ? 10 : 0;
  const permission = candidate.stage === 'Approved' ? 5 : 0;
  const factors = [
    { label: 'Daily audience', points: Math.round(demand), max: 30, known: candidate.dailyPeople != null },
    { label: 'Time on site', points: Math.round(dwell), max: 20, known: candidate.dwellMinutes != null },
    { label: 'Vending gap', points: service, max: 25, known: candidate.service !== 'unknown' },
    { label: 'Open hours', points: Math.round(hours), max: 10, known: candidate.openHours != null },
    { label: 'Power confirmed', points: access, max: 10, known: candidate.power !== 'unknown' },
    { label: 'Host approval', points: permission, max: 5, known: candidate.stage === 'Approved' },
  ];
  const score = Math.round(demand + dwell + hours + service + access + permission);
  const known = factors.slice(0, 5).filter(f => f.known).length;
  const label = candidate.service === 'served' ? 'Already well served' : known < 3 ? 'Needs research' : candidate.service === 'unknown' ? 'Verify vending gap' : score >= 65 ? 'Worth a visit' : score >= 40 ? 'Explore further' : 'Lower priority';
  return { score, factors, coverage: known * 20, label };
}

export function nextStep(candidate) {
  if (candidate.stage === 'Not a fit') return 'Keep the reason on file before revisiting.';
  if (candidate.service === 'unknown') return 'Visit the site and check for existing vending service.';
  if (candidate.dailyPeople == null) return 'Ask the host about daily employees and visitors.';
  if (candidate.dwellMinutes == null) return 'Observe how long people typically stay.';
  if (candidate.power !== 'yes') return 'Confirm an accessible power outlet and indoor space.';
  if (candidate.stage === 'Approved') return 'Agree on placement, access, products, and a service schedule.';
  return 'Contact the property decision-maker to discuss placement.';
}
