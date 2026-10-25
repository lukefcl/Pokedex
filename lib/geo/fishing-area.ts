import fmas from './fmas.json';
import type { CatchPosition } from '../catch-location';

type Ring = number[][];
function insideRing(longitude: number, latitude: number, ring: Ring) {
  let inside = false;
  const unwrap = (x: number) => longitude + ((x - longitude + 540) % 360) - 180;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = [unwrap(ring[i][0]), ring[i][1]];
    const [xj, yj] = [unwrap(ring[j][0]), ring[j][1]];
    if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function contains(longitude: number, latitude: number, polygon: Ring[]) {
  return insideRing(longitude, latitude, polygon[0]) && !polygon.slice(1).some((ring) => insideRing(longitude, latitude, ring));
}
function regionAt(longitude: number, latitude: number) {
  return fmas.filter((f) => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return (polygons as Ring[][]).some((p) => contains(longitude, latitude, p));
  });
}
const direct: Record<string, string> = { FMA1: 'auckland-east', FMA9: 'auckland-west', FMA2: 'central-east', FMA8: 'central-west' };
export function fishingAreaAt(position: CatchPosition): { areaId: string; label: string; note: string } {
  const hits = regionAt(position.longitude, position.latitude);
  const match = hits.length === 1 ? hits[0] : undefined;
  if (!match) return { areaId: '', label: 'No verified marine area match', note: 'Select your fishing area below. GPS may be inland, on the shoreline or outside the saved boundaries.' };
  // Include the GPS uncertainty circle and a 200 m geometry tolerance. Never
  // silently choose a side when a reading straddles a regulatory boundary.
  const radius = Math.max(position.accuracy, 200) / 111320;
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const nearby = regionAt(position.longitude + Math.cos(angle) * radius / Math.cos(position.latitude * Math.PI / 180), position.latitude + Math.sin(angle) * radius);
    if (nearby.length !== 1 || nearby[0].id !== match.id) return { areaId: '', label: match.name, note: 'Near a shoreline or area boundary. Confirm your fishing area below before using limits.' };
  }
  const areaId = direct[match.id] || '';
  return { areaId, label: match.name, note: areaId
    ? 'Regional limits selected from MPI boundaries. Local closures, reserves and freshwater rules still apply.'
    : 'This region has separate local catch zones. Select the correct zone below; GPS alone cannot verify its special restrictions.' };
}
