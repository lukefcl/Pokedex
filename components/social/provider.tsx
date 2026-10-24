'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConvexReactClient, useQuery, useAction, useMutation, useConvexAuth } from 'convex/react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import type { CatchRecord } from '@/lib/storage';
import { getCatches } from '@/lib/storage';
import {
  enqueue,
  enqueueRemoval,
  canShare,
  readOutbox,
  finishJob,
  ownedBy,
  sharedFields,
  thumbnail,
} from '@/lib/social/client';
import { findFish } from '@/lib/fish';
type Social = {
  configured: boolean;
  me: Doc<'profiles'> | null | undefined;
  authenticated: boolean;
  loading: boolean;
  pending: number;
  syncError: string;
  toast: string;
  dismiss: () => void;
  share: (record: CatchRecord, value: boolean, historic?: boolean) => void;
  remove: (id: string) => void;
  isOwned: (id: string) => boolean;
  canShare: (id: string) => boolean;
  isShared: (id: string) => boolean;
  retry: () => void;
};
const fallback: Social = {
  configured: false,
  me: null,
  authenticated: false,
  loading: false,
  pending: 0,
  syncError: '',
  toast: '',
  dismiss: () => {},
  share: () => {},
  remove: enqueueRemoval,
  isOwned: () => false,
  canShare: () => false,
  isShared: () => false,
  retry: () => {},
};
const Context = createContext<Social>(fallback);
export const useSocial = () => useContext(Context);
const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;
export default function OnlineProvider({ children }: { children: ReactNode }) {
  return client ? (
    <ConvexAuthProvider client={client} shouldHandleCode={false}>
      <Connected>{children}</Connected>
    </ConvexAuthProvider>
  ) : (
    children
  );
}
function Connected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.social.me, isAuthenticated ? {} : 'skip');
  const alerts = useQuery(api.social.alerts, me ? {} : 'skip');
  const publish = useAction(api.sharing.publish);
  const removeRemote = useMutation(api.records.remove);
  const [tick, setTick] = useState(0),
    [pending, setPending] = useState(0),
    [syncError, setError] = useState(''),
    [toast, setToast] = useState('');
  const running = useRef(false),
    baseline = useRef<{ user: string; seen: Set<string> } | null>(null);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    window.addEventListener('online', update);
    window.addEventListener('findex-outbox', update);
    window.addEventListener('storage', update);
    const timer = setInterval(update, 30000);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('findex-outbox', update);
      window.removeEventListener('storage', update);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!me || !alerts) {
      if (!me) baseline.current = null;
      return;
    }
    if (baseline.current?.user !== me.userId) {
      baseline.current = { user: me.userId, seen: new Set(alerts.map((a) => a.id)) };
      return;
    }
    const fresh = alerts.filter((a) => !baseline.current!.seen.has(a.id));
    baseline.current.seen = new Set(alerts.map((a) => a.id));
    if (fresh.length) {
      const a = fresh[0];
      setToast(
        fresh.length > 1
          ? `${fresh.length} new catches from your mates!`
          : `${a.name} caught ${a.customName || findFish(a.fishId)?.name || 'a fish'}!`,
      );
    }
  }, [alerts, me]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 8000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!me || running.current) return;
    const user = me.userId;
    let cancelled = false;
    async function flush() {
      running.current = true;
      try {
        const jobs = readOutbox().jobs.filter((j) => j.user === user);
        setPending(jobs.length);
        if (!navigator.onLine) return;
        for (const job of jobs) {
          if (cancelled) break;
          if (job.remove) await removeRemote({ localId: job.id });
          else {
            const r = (await getCatches()).find((r) => r.id === job.id);
            if (r)
              await publish({
                record: sharedFields(r),
                photo: await thumbnail(r.photo),
                historic: job.historic,
              });
          }
          finishJob(job);
          setPending(readOutbox().jobs.filter((j) => j.user === user).length);
        }
        setError('');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Online sync paused.');
      } finally {
        running.current = false;
        if (cancelled) setTick((t) => t + 1);
      }
    }
    void flush();
    return () => {
      cancelled = true;
    };
  }, [me?.userId, tick, publish, removeRemote]);
  const value: Social = {
    configured: true,
    me,
    authenticated: isAuthenticated,
    loading: isLoading,
    pending,
    syncError,
    toast,
    dismiss: () => setToast(''),
    share: (r, yes, historic = false) => {
      if (me && canShare(me.userId, r.id)) enqueue(me.userId, r.id, yes, historic);
      else if (yes) throw new Error('Sign into this record’s original online profile to share it.');
    },
    remove: enqueueRemoval,
    isOwned: (id) => !!me && ownedBy(me.userId, id),
    canShare: (id) => {
      try {
        return !!me && canShare(me.userId, id);
      } catch {
        return false;
      }
    },
    isShared: (id) => {
      try {
        return !!me && ownedBy(me.userId, id) && !!readOutbox().shares?.[id];
      } catch {
        return false;
      }
    },
    retry: () => setTick((t) => t + 1),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
