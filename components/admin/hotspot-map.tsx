'use client';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { findFish } from '@/lib/fish';
export type MapPoint = { latitude: number; longitude: number; accuracy: number; fishId: string; date: string; quantity: number };

export default function HotspotMap({ points, exact, weight, reset }: { points: MapPoint[]; exact: boolean; weight: 'catches' | 'fish'; reset: number }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<{ L: typeof Leaflet; map: Leaflet.Map } | null>(null);
  const [ready, setReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const fitted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import('leaflet').then((L) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { zoomAnimation: false, preferCanvas: true, worldCopyJump: true }).setView([-41, 173], 5);
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).on('tileerror', () => setTileError(true)).addTo(map);
      instance.current = { L, map };
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    });
    return () => { cancelled = true; observer?.disconnect(); instance.current?.map.remove(); instance.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !instance.current) return;
    const { L, map } = instance.current;
    const group = L.layerGroup().addTo(map);
    const canvas = L.DomUtil.create('canvas', 'hotspot-heat-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    map.getPanes().overlayPane.appendChild(canvas);
    const longitude = (n: number) => n < 0 ? n + 360 : n;
    const fit = () => {
      if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, longitude(p.longitude)])), { padding: [35, 35], maxZoom: 12 });
      else map.setView([-41, 173], 5);
    };
    if (!fitted.current && points.length) { fit(); fitted.current = true; }
    const draw = () => {
      const size = map.getSize();
      canvas.width = size.x; canvas.height = size.y;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      const context = canvas.getContext('2d');
      if (!context) return;
      // Additive radial density, then colour the accumulated alpha. Each log
      // weighs one by default, so a large shellfish bag doesn't dominate the map.
      for (const p of points) {
        const pixel = map.latLngToContainerPoint([p.latitude, longitude(p.longitude)]);
        if (pixel.x < -40 || pixel.y < -40 || pixel.x > size.x + 40 || pixel.y > size.y + 40) continue;
        const gradient = context.createRadialGradient(pixel.x, pixel.y, 0, pixel.x, pixel.y, 32);
        const intensity = weight === 'fish' ? Math.min(.75, .15 + Math.log2(p.quantity + 1) * .1) : .22;
        gradient.addColorStop(0, `rgba(0,0,0,${intensity})`); gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient; context.fillRect(pixel.x - 32, pixel.y - 32, 64, 64);
      }
      const pixels = context.getImageData(0, 0, size.x, size.y);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const density = pixels.data[i + 3] / 255;
        if (!density) continue;
        pixels.data[i] = Math.round(Math.min(1, density * 3) * 255);
        pixels.data[i + 1] = Math.round(Math.max(0, 1 - Math.abs(density - .4) * 2.5) * 255);
        pixels.data[i + 2] = Math.round(Math.max(0, 1 - density * 4) * 255);
        pixels.data[i + 3] = Math.round(Math.min(.8, density + .15) * 255);
      }
      context.putImageData(pixels, 0, 0);
    };
    if (exact) for (const p of points) {
      const popup = document.createElement('div');
      popup.textContent = `${findFish(p.fishId)?.name || 'Unidentified catch'} · ${p.quantity} fish · ${p.date} · ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)} (±${Math.round(p.accuracy)} m)`;
      L.circleMarker([p.latitude, longitude(p.longitude)], { radius: 4, color: '#203d28', weight: 1, fillColor: '#f5efbd', fillOpacity: .9 }).bindPopup(popup).addTo(group);
    }
    map.on('moveend zoomend resize', draw);
    draw();
    return () => { map.off('moveend zoomend resize', draw); group.remove(); canvas.remove(); };
  }, [points, exact, weight, ready]);
  useEffect(() => {
    if (!reset || !instance.current) return;
    const { L, map } = instance.current;
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude < 0 ? p.longitude + 360 : p.longitude])), { padding: [35, 35], maxZoom: 12 });
    else map.setView([-41, 173], 5);
  }, [reset]);
  return <><div className="hotspot-map" ref={container} role="region" aria-label="Admin catch hotspot map"/>{tileError && <p className="social-privacy">Basemap tiles could not load. Catch points still display; reopen the map online to retry.</p>}</>;
}
