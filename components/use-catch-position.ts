'use client';
import { useEffect, useRef, useState } from 'react';
import { currentPosition, shouldCaptureCatchPosition, validPosition } from '@/lib/catch-location';
import { fishingAreaAt } from '@/lib/geo/fishing-area';
import type { CatchRecord } from '@/lib/storage';
import { recordKind } from '@/lib/fish';

export function useCatchPosition(initial: CatchRecord | undefined, sighting: boolean, onArea: (id: string) => void) {
  const [position, setPosition] = useState(initial?.position);
  const [areaNote, setAreaNote] = useState('');
  const request = useRef<ReturnType<typeof currentPosition> | null>(null);
  const missingPosition = shouldCaptureCatchPosition(sighting, initial ? recordKind(initial) : undefined) && !validPosition(position);

  useEffect(() => {
    if (!missingPosition) return;
    let active = true;
    // Reuse the same one-off request during React's effect replay. Results
    // after closing the form or switching to a sighting must not change it.
    request.current ??= currentPosition();
    request.current.then((value) => {
      if (!active) return;
      const match = fishingAreaAt(value);
      setPosition(value);
      onArea(match.areaId);
      setAreaNote(`${match.label}. ${match.note}`);
    }).catch(() => { /* GPS is best effort; saving never depends on it. */ });
    return () => { active = false; };
  }, [missingPosition, onArea]);
  return { position, areaNote };
}
