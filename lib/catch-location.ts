export type CatchPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};

export function shouldCaptureCatchPosition(sighting: boolean, originalKind?: 'catch' | 'sighting') {
  return !sighting && originalKind !== 'catch';
}

export function validPosition(value: unknown): value is CatchPosition {
  if (!value || typeof value !== 'object') return false;
  const p = value as CatchPosition;
  return Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90
    && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180
    && Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= 100000
    && Number.isFinite(p.capturedAt) && p.capturedAt > 0;
}

export function currentPosition(): Promise<CatchPosition> {
  return new Promise((resolve, reject) => {
    if (!globalThis.isSecureContext || !navigator.geolocation) {
      reject(new Error('Location needs HTTPS (or localhost) and a browser with location support.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords, timestamp }) => {
      const position = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, capturedAt: timestamp };
      if (!validPosition(position)) reject(new Error('Your device returned an invalid location. Try again.'));
      else resolve(position);
    }, (error) => reject(new Error(error.code === 1
      ? 'Allow location in your browser settings to use GPS.'
      : error.code === 3 ? 'Location timed out. Move to an open area and try again.'
        : 'Your position is unavailable. Turn on device location and try again.')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  });
}
