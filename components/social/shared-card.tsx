'use client';
import { useEffect, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { findFish, unidentified } from '@/lib/fish';
import FishSprite from '../fish-sprite';
import { useSocial } from './provider';
export type SharedRecord = FunctionReturnType<typeof api.social.feed>[number];
export default function SharedCard({ record }: { record: SharedRecord }) {
  const social = useSocial();
  const remove = useMutation(api.records.remove);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const photo = useAction(api.sharing.photo);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSrc(null);
    if (record.hasPhoto)
      photo({ id: record._id })
        .then((s) => {
          if (active) setSrc(s);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [record._id, record.updatedAt, record.hasPhoto, photo]);
  const fish = findFish(record.fishId) || unidentified;
  return (
    <article className="shared-card">
      <div className="catch-art">
        {src && (
          <img
            src={src}
            alt={`${record.author.name}’s shared ${fish.name}`}
            className="catch-art-photo"
          />
        )}
        <div className="catch-art-shade" />
        <FishSprite fish={fish} />
        <span className="record-kind-badge">
          {record.kind === 'sighting' ? 'SPOTTED' : 'CAUGHT'}
        </span>
      </div>
      <div className="shared-copy">
        <strong>{record.customName || fish.name}</strong>
        <span>
          {record.author.name} · {record.date}
        </span>
        <small>
          {record.quantity > 1 ? `${record.quantity} × ` : ''}
          {record.kind === 'sighting'
            ? 'Wildlife sighting'
            : `${record.length ? `${record.length} cm · ` : ''}${record.released ? 'Released' : 'Kept'}`}
        </small>
        {record.owner === social.me?.userId &&
          (confirm ? (
            <div className="social-confirm">
              <p>Remove this shared copy? The original local record stays on its device.</p>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    if (social.isOwned(record.localId)) social.remove(record.localId);
                    await remove({ localId: record.localId });
                  } catch {
                    setError('Could not remove this shared copy. Try again online.');
                  }
                }}
              >
                Remove shared copy
              </button>
              <button className="text-button" onClick={() => setConfirm(false)}>
                Keep shared
              </button>
            </div>
          ) : (
            <button className="text-button" onClick={() => setConfirm(true)}>
              Manage shared copy
            </button>
          ))}
        {error && <p role="alert">{error}</p>}
      </div>
    </article>
  );
}
