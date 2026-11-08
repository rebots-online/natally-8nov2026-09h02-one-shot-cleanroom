import type { NatalChartResult, CurrentSkySnapshot, AspectChordData } from './ephemeris';

export interface CurrentLocation {
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

export function requestCurrentLocation(): Promise<CurrentLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Device location is unavailable. Choose a city or skip.'));
    navigator.geolocation.getCurrentPosition(position => resolve({
      name: 'Approximate device location',
      latitude: Math.round(position.coords.latitude * 100) / 100,
      longitude: Math.round(position.coords.longitude * 100) / 100,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }), () => reject(new Error('Location was not shared. Choose a city manually or skip.')),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  });
}

export function calculateTransitAspects(
  natal: Array<{ name: string; lon: number }>,
  current: Array<{ name: string; lon: number }>,
) {
  const aspects = [
    { type: 'Conjunction', angle: 0 }, { type: 'Sextile', angle: 60 },
    { type: 'Square', angle: 90 }, { type: 'Trine', angle: 120 }, { type: 'Opposition', angle: 180 },
  ] as const;
  const matches: Array<{ transit: string; natal: string; type: AspectChordData['type']; orb: number }> = [];
  for (const moving of current) for (const birth of natal) {
    if (!Number.isFinite(moving.lon) || !Number.isFinite(birth.lon)) throw new Error('Invalid planetary longitude.');
    const difference = ((moving.lon - birth.lon) % 360 + 360) % 360;
    const separation = Math.min(difference, 360 - difference);
    for (const aspect of aspects) {
      const orb = Math.abs(separation - aspect.angle);
      if (orb <= 3) matches.push({ transit: moving.name, natal: birth.name, type: aspect.type, orb });
    }
  }
  return matches.sort((left, right) => left.orb - right.orb);
}

export function resolveObservationMoment(date?: string, time?: string, offset?: number): Date {
  if (!date && !time) return new Date();
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isFinite(offset) || Math.abs(offset!) > 14) {
    throw new Error('Choose a valid observation date, time and location timezone.');
  }
  const local = new Date(`${date}T${time}:00Z`);
  if (!Number.isFinite(local.getTime()) || local.toISOString().slice(0, 10) !== date) throw new Error('Invalid observation date.');
  return new Date(local.getTime() - offset! * 3600000);
}

export function currentObservationContext(input: NatalChartResult['input']): NonNullable<CurrentSkySnapshot['observationContext']> {
  const locationName = input.currentLocationName?.trim();
  let timezoneId = locationName ? input.currentTimezoneId || 'UTC' : 'UTC';
  try { new Intl.DateTimeFormat('en', {timeZone:timezoneId}); } catch { timezoneId = 'UTC'; }
  return {
    timezoneId,
    ...(locationName ? {locationName} : {}),
    ...(Number.isFinite(input.currentLatitude) && Math.abs(input.currentLatitude!) <= 90 && Number.isFinite(input.currentLongitude) && Math.abs(input.currentLongitude!) <= 180
      ? {latitude:input.currentLatitude!,longitude:input.currentLongitude!} : {}),
  };
}

export async function calculateCurrentSkySnapshot(chart: NatalChartResult, now = new Date()): Promise<CurrentSkySnapshot> {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid observation time.');
  const { getSwissEph, formatLongitude } = await import('./ephemeris');
  const swe = await getSwissEph();
  const julianDay = swe.julday(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600 + now.getUTCMilliseconds() / 3600000);
  const observedAt = now.toISOString();
  const definitions = [
    ['Sun', swe.SE_SUN, '☉'], ['Moon', swe.SE_MOON, '☽'], ['Mercury', swe.SE_MERCURY, '☿'],
    ['Venus', swe.SE_VENUS, '♀'], ['Mars', swe.SE_MARS, '♂'], ['Jupiter', swe.SE_JUPITER, '♃'],
    ['Saturn', swe.SE_SATURN, '♄'], ['Uranus', swe.SE_URANUS, '♅'], ['Neptune', swe.SE_NEPTUNE, '♆'], ['Pluto', swe.SE_PLUTO, '♇'],
  ] as const;
  const bodies = definitions.map(([name, code, glyph]) => {
    const result = swe.calc_ut(julianDay, code, swe.SEFLG_MOSEPH | swe.SEFLG_SPEED);
    if (!Number.isFinite(result[0]) || !Number.isFinite(result[3])) throw new Error('Current sky calculation failed for ' + name);
    return { name, glyph, lon: result[0], speed: result[3], fullDegText: formatLongitude(result[0]).fullText, target: `Now ${name} @ ${observedAt}` };
  });
  const natalBodies = chart.natalBodies.filter(body => !chart.input.birthTimeUnknown || body.name !== 'Moon');
  const styles: Record<AspectChordData['type'], { symbol: string; angle: number }> = {
    Conjunction: { symbol: '☌', angle: 0 }, Sextile: { symbol: '⚹', angle: 60 },
    Square: { symbol: '□', angle: 90 }, Trine: { symbol: '△', angle: 120 }, Opposition: { symbol: '☍', angle: 180 },
  };
  const aspects = calculateTransitAspects(natalBodies, bodies).map(aspect => {
    const style = styles[aspect.type];
    const from = bodies.find(body => body.name === aspect.transit)!;
    const to = natalBodies.find(body => body.name === aspect.natal)!;
    return {
      name: `Now ${aspect.transit} ${style.symbol} natal ${aspect.natal} (${style.angle}°) @ ${observedAt}`,
      from: from.target, to: to.name, type: aspect.type, symbol: style.symbol, angle: style.angle, orb: aspect.orb,
      color: 0x67e8f9, colorHex: '#67e8f9',
      detail: `Current ${from.name} at ${from.fullDegText} ${style.symbol} natal ${to.name} at ${to.fullDegText}. ${aspect.type}, orb ${aspect.orb.toFixed(2)}°. Observed ${observedAt}.`,
    };
  });
  return { observedAt, observationContext:currentObservationContext(chart.input), bodies, aspects };
}

export async function buildCurrentSkyContext(chart: NatalChartResult, now?: Date): Promise<string> {
  const snapshot = now ? await calculateCurrentSkySnapshot(chart, now) : chart.currentSky ?? await calculateCurrentSkySnapshot(chart);
  const displayed = !now && snapshot === chart.currentSky;
  const observation = new Date(snapshot.observedAt);
  let timeZone = chart.input.currentTimezoneId || 'UTC';
  let localTime: string;
  try { localTime = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'long' }).format(observation); }
  catch { timeZone = 'UTC'; localTime = observation.toISOString(); }
  return [
    '[CALCULATED OBSERVATION SKY — Swiss Ephemeris / Moshier, geocentric tropical]',
    `Observation UTC: ${snapshot.observedAt}`,
    displayed ? 'DISPLAYED CURRENT SKY: These exact cyan-layer positions and transit endpoints are on the current chart. Use their timestamped inventory targets.' : 'OFF-DISPLAY OBSERVATION: These positions belong to a separately calculated observation. Do not point at the displayed current-sky layer or claim these dated positions are shown there.',
    `Local display: ${localTime} (${timeZone}); ${displayed ? 'same stored observation as the chart; use Refresh sky for a newer snapshot' : 'separate observation time'}.`,
    `Current location: ${chart.input.currentLocationName || 'Not supplied; do not assume the birthplace is the present location.'}`,
    'Geocentric planetary positions do not depend on the observer location. No current local houses are supplied.',
    'CURRENT POSITIONS: ' + snapshot.bodies.map(body => `${body.name}: ${body.fullDegText}, longitude ${body.lon.toFixed(4)}°, ${body.speed < 0 ? 'retrograde' : 'direct'}${displayed ? `; target ${JSON.stringify(body.target)}` : ''}`).join('; '),
    'TRANSIT-TO-NATAL ASPECTS (3° maximum orb): ' + (snapshot.aspects.length ? snapshot.aspects.map(aspect => `${aspect.detail}${displayed ? ` Target ${JSON.stringify(aspect.name)}.` : ''}`).join('; ') : 'No major aspects within this orb.'),
    chart.input.birthTimeUnknown ? 'Birth time unknown: noon is an approximation. Do not interpret natal houses/angles or precise Moon timing; Moon-target aspects omitted.' : '',
    'Interpret natal foundations first, then distinguish the dated transits from natal aspects. Do not invent aspect dates, exact peaks, duration, applying/separating status or guaranteed events.',
  ].filter(Boolean).join('\n');
}
