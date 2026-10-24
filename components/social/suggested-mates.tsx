'use client';
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { UserPlus, Users } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { findFish, unidentified } from '@/lib/fish';
import FishSprite from '../fish-sprite';

export default function SuggestedMates() {
  const suggestions = useQuery(api.discovery.suggestions, {});
  const request = useMutation(api.discovery.request);
  const [pending, setPending] = useState<Id<'users'> | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function add(id: Id<'users'>, name: string) {
    setPending(id);
    setError('');
    setStatus('');
    try {
      await request({ id });
      setStatus(`Request sent to ${name}. They’ll appear in your crew once they accept.`);
    } catch (e) {
      setError(e instanceof Error
        ? e.message.replace(/\[CONVEX[^]*?Uncaught ConvexError: /, '').split('\n')[0]
        : 'Couldn’t send this request. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="suggested-mates" aria-labelledby="suggested-mates-heading">
      <div className="social-section-heading">
        <h3 id="suggested-mates-heading"><Users size={16} aria-hidden="true" /> Suggested mates</h3>
        {suggestions && suggestions.mates.length > 0 && <span className="suggestion-count">{suggestions.mates.length}</span>}
      </div>
      <p className="social-privacy">Mates of your mates. Link up to share your FINDEXes after they accept.</p>
      {!suggestions ? <p className="social-privacy" role="status">Finding mutual mates…</p>
        : suggestions.mates.length ? suggestions.mates.map((mate) => (
          <div className="suggested-mate" key={mate.userId}>
            <FishSprite fish={findFish(mate.avatar) || unidentified} />
            <span><strong>{mate.name}</strong><small>{mate.mutualCount} mutual {mate.mutualCount === 1 ? 'mate' : 'mates'}</small></span>
            <button className="secondary-button" disabled={pending !== null}
              aria-label={`Add ${mate.name}`} onClick={() => add(mate.userId, mate.name)}>
              <UserPlus size={14} aria-hidden="true" />{pending === mate.userId ? 'Sending…' : 'Add'}
            </button>
          </div>
        )) : <p className="social-privacy">{suggestions.hasMates
          ? 'No new suggestions yet. More mates appear as your crew grows.'
          : 'Link your first mate by QR to discover their crew here.'}</p>}
      <p className="suggestion-status" role="status">{status}</p>
      {error && <p className="social-error" role="alert">{error}</p>}
    </section>
  );
}
