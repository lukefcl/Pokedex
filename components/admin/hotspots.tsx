'use client';
import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { fish } from '@/lib/fish';
import HotspotMap from './hotspot-map';
import { useSocial } from '../social/provider';

export default function AdminHotspots() {
  const { isAdmin } = useSocial();
  return isAdmin ? <MapContent/> : <p role="alert">Admin access required.</p>;
}
function MapContent() {
  const [days, setDays] = useState('90');
  const [fishId, setFishId] = useState('');
  const [weight, setWeight] = useState<'catches' | 'fish'>('catches');
  const [exact, setExact] = useState(true);
  const [reset, setReset] = useState(0);
  const since = days === 'all' ? '1970-01-01' : new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
  const data = useQuery(api.hotspots.map, { since, fishId });
  return <section className="admin-hotspots">
    <span className="eyebrow">ADMIN FIELD INTELLIGENCE</span>
    <h2>Where the bites are.</h2>
    <p className="social-privacy">Catch density from signed-in journals. Exact positions are visible only to admins. This shows reported catches, not fishing effort or a prediction.</p>
    <div className="hotspot-filters">
      <label className="form-label">Species<select value={fishId} onChange={(e) => setFishId(e.target.value)}><option value="">All species</option>{fish.filter((f) => !f.sightingOnly).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}<option value="other">Unidentified</option></select></label>
      <label className="form-label">Period<select value={days} onChange={(e) => setDays(e.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">One year</option><option value="all">All time</option></select></label>
    </div>
    <div className="hotspot-tools"><label>Weight by <select aria-label="Heatmap weighting" value={weight} onChange={(e) => setWeight(e.target.value as typeof weight)}><option value="catches">Catch logs</option><option value="fish">Fish quantity</option></select></label><button className="text-button" onClick={() => setReset((r) => r + 1)}>Fit catches</button></div>
    <label className="release-checkbox"><input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)}/><span>Show exact catch points</span></label>
    {data ? <>
      <p className="hotspot-summary" role="status"><strong>{data.points.length}</strong> catch logs · <strong>{data.points.reduce((sum, p) => sum + p.quantity, 0)}</strong> fish</p>
      <HotspotMap points={data.points} exact={exact} weight={weight} reset={reset}/>
      <div className="heatmap-legend"><span>Fewer</span><i/><span>More nearby catches</span></div>
      {!data.points.length && <p className="social-privacy">No geolocated catches in this selection yet. New catches appear here as devices sync; older records without GPS cannot be plotted.</p>}
      {data.truncated && <p className="social-privacy">Showing the latest 10,000 matching logs. Narrow the period or species for a complete view.</p>}
    </> : <p role="status">Loading fishing spots…</p>}
  </section>;
}
