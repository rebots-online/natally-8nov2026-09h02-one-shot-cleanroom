import { ZODIAC_SIGNS, type NatalChartResult } from './ephemeris';

export function chartTargets(chart: NatalChartResult): string[] {
  return [...new Set([
    ...chart.natalBodies.filter(body => !chart.input.birthTimeUnknown || !/^(Ascendant|Midheaven|AC|MC)$/i.test(body.name)).map(body => body.name), ...ZODIAC_SIGNS.map(sign => sign.name),
    ...(!chart.input.birthTimeUnknown ? chart.houseCusps.map(house => 'House ' + house.num) : []),
    ...(chart.currentSky?.bodies.map(body => body.target) || []),
    ...(chart.currentSky?.aspects.map(aspect => aspect.name) || []),
    ...chart.aspectChords.filter(aspect => !chart.input.birthTimeUnknown || !/Moon|Ascendant|Midheaven|\bAC\b|\bMC\b/i.test(aspect.name)).map(aspect => aspect.name),
  ])];
}
export function chartFocusKey(chart: NatalChartResult): string {
  return JSON.stringify([chart.input, chart.natalBodies.map(body => [body.name, body.lon]), chart.aspectChords.map(aspect => aspect.name)]);
}
/** Renderer inventory expansion must not invalidate readings of the same natal coordinates. */
export function chartFocusKeyMatches(key: unknown, chart: NatalChartResult): boolean {
  if (typeof key !== 'string') return false;
  try {
    const saved = JSON.parse(key);
    if (!Array.isArray(saved) || !saved[0] || !Array.isArray(saved[1])) return false;
    const input = saved[0], current = chart.input;
    const close = (left: unknown, right: unknown) => typeof left === 'number' && typeof right === 'number' && Number.isFinite(left) && Number.isFinite(right) && Math.abs(left-right) < 0.000001;
    if (input.birthDate !== current.birthDate || input.birthTime !== current.birthTime ||
        !!input.birthTimeUnknown !== !!current.birthTimeUnknown || (input.houseSystem || 'P') !== (current.houseSystem || 'P') ||
        !close(input.latitude,current.latitude) || !close(input.longitude,current.longitude) || !close(input.timezoneOffset,current.timezoneOffset)) return false;
    // Current location, display name and object property ordering are not natal identity.
    // Compare named coordinates, allowing only sub-arcsecond floating-point roundoff.
    const positions = new Map(saved[1].filter((row:unknown) => Array.isArray(row) && row.length === 2).map((row:[string,number]) => [row[0],row[1]]));
    return positions.size === chart.natalBodies.length && chart.natalBodies.every(body => close(positions.get(body.name),body.lon));
  } catch { return false; }
}
const normalize = (raw: string) => raw.replace(/[*_\x60]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const chartTargetLabel = (target: string): string => target.replace(/ @ \d{4}-\d{2}-\d{2}T[\d:.]+Z$/, '');
export const isDatedSkyTarget = (target: unknown): target is string => typeof target === 'string' && /^Now .+ @ \d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(target);
export function resolveChartTarget(raw: string, chart: NatalChartResult): string | null {
  const wanted = normalize(raw);
  const inventory = chartTargets(chart);
  const exact = inventory.find(target => normalize(target) === wanted);
  if (exact) return exact;
  // A stored observation must never silently migrate to a different sky.
  if (raw.includes('@')) return null;
  const natal = chart.natalBodies.find(body => normalize('natal ' + body.name) === wanted);
  if (natal && inventory.includes(natal.name)) return natal.name;
  const current = chart.currentSky?.bodies.find(body => ['now ', 'current ', 'transiting '].some(prefix => normalize(prefix + body.name) === wanted));
  if (current) return current.target;
  const stripAngle = (text: string) => normalize(text).replace(/\s*\(\d+°\)$/, '').replace(/\bconjunct(?:s)?\b/g, 'conjunction').replace(/\b(trine|square|sextile)s\b/g, '$1');
  const request = stripAngle(wanted);
  for (const aspect of chart.aspectChords) {
    if (!inventory.includes(aspect.name)) continue;
    const aliases = [aspect.name, `${aspect.from} ${aspect.type} ${aspect.to}`, `${aspect.to} ${aspect.type} ${aspect.from}`, `${aspect.from} ${aspect.symbol} ${aspect.to}`, `${aspect.to} ${aspect.symbol} ${aspect.from}`, `natal ${aspect.from} ${aspect.type} natal ${aspect.to}`];
    if (aliases.some(alias => stripAngle(alias) === request)) return aspect.name;
  }
  for (const aspect of chart.currentSky?.aspects || []) {
    const body = chart.currentSky!.bodies.find(body => body.target === aspect.from);
    const aliases = [chartTargetLabel(aspect.name), ...['Now','current','transiting'].map(prefix => `${prefix} ${body?.name} ${aspect.type} natal ${aspect.to}`)];
    if (aliases.some(alias => stripAngle(alias) === request)) return aspect.name;
  }
  return null;
}

/** Human-readable references retain layer identity before the shorter planet-name match. */
export function chartReferenceNames(chart: NatalChartResult): string[] {
  return [...new Set([
    ...chartTargets(chart),
    ...chartTargets(chart).map(chartTargetLabel),
    ...chart.natalBodies.map(body => 'natal ' + body.name),
    ...(chart.currentSky?.bodies.flatMap(body => ['Now ', 'current ', 'transiting '].map(prefix => prefix + body.name)) || []),
    ...chart.aspectChords.flatMap(aspect => [`${aspect.from} ${aspect.type} ${aspect.to}`, `${aspect.to} ${aspect.type} ${aspect.from}`]),
    ...(chart.currentSky?.aspects.flatMap(aspect => {
      const body = chart.currentSky!.bodies.find(body => body.target === aspect.from);
      return ['Now', 'current', 'transiting'].map(prefix => `${prefix} ${body?.name} ${aspect.type} natal ${aspect.to}`);
    }) || []),
  ])];
}
