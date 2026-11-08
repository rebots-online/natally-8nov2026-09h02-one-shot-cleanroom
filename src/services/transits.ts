// Current-location service for the first-light onboarding intake
// (src/onboarding-original). Mirrors the operator-authorized original
// contract: one geolocation request per explicit tap, never in background.
// The device fix is reverse-geocoded to the NEAREST real place in the
// bundled gazetteer, and the field is populated with that place's exact
// search label ("Name, CC") so the confirmed chip resolves like a search
// selection. Too far from anywhere we know → truthful no-match error.

import { loadGazetteer, type GazetteerEntry } from './gazetteer';

/** What the reading carries when the customer shares today's place. */
export interface CurrentLocation {
  /** Gazetteer search label — identical to a datalist suggestion. */
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

/** Beyond this, the nearest known place is not honestly "where you are". */
const MAX_DISTANCE_KM = 150;

/** Great-circle distance in kilometres. */
function haversineKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const rad = Math.PI / 180;
  const dLat = (latB - latA) * rad;
  const dLon = (lonB - lonA) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Nearest gazetteer place to a coordinate fix, or null beyond range. */
function nearestPlace(latitude: number, longitude: number): GazetteerEntry | null {
  let best: GazetteerEntry | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const entry of loadGazetteer()) {
    const km = haversineKm(latitude, longitude, entry.lat, entry.lon);
    if (km < bestKm) {
      bestKm = km;
      best = entry;
    }
  }
  return bestKm <= MAX_DISTANCE_KM ? best : null;
}

export function requestCurrentLocation(): Promise<CurrentLocation> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.reject(new Error('Device location is unavailable — choose a city or skip.'));
  }
  // Executor form rather than Promise.withResolvers(): the project's frozen
  // tsconfig targets ES2022, where that constructor method does not exist.
  return new Promise<GeolocationCoordinates>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      failure => {
        reject(
          new Error(
            failure.code === failure.PERMISSION_DENIED
              ? 'Location permission was declined — choose a city or skip.'
              : 'Location is unreachable right now — choose a city or skip.',
          ),
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }).then((coords): CurrentLocation => {
    const place = nearestPlace(coords.latitude, coords.longitude);
    if (!place) {
      throw new Error('No place in my gazetteer is near enough to call where you are — choose a city or skip.');
    }
    return {
      name: `${place.name}, ${place.countryCode}`,
      latitude: place.lat,
      longitude: place.lon,
      timeZone: place.tzid,
    };
  });
}
