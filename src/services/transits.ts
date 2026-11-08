// Current-location service for the first-light onboarding intake
// (src/onboarding-original). Mirrors the operator-authorized original
// contract: one geolocation request, rounded honestly, never background.

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
