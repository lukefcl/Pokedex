'use client';
import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { currentPosition } from '@/lib/catch-location';
import { fishingAreaAt } from '@/lib/geo/fishing-area';

export default function LocateLimits({ onArea }: { onArea: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function locate() {
    setBusy(true); setError('');
    try {
      const match = fishingAreaAt(await currentPosition());
      onArea(match.areaId);
      setMessage(`${match.label}. ${match.note}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not find your location.'); }
    finally { setBusy(false); }
  }
  return <div className="locate-limits"><button className="secondary-button full-width" type="button" disabled={busy} onClick={locate}><LocateFixed size={15}/>{busy ? 'Finding your fishing area…' : 'Use my location for limits'}</button>{message && <p className="social-privacy" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
