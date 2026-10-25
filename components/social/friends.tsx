'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import {
  Users,
  ScanLine,
  QrCode,
  ArrowLeft,
  Check,
  X,
  Upload,
  Download,
  WifiOff,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { fish, findFish, unidentified } from '@/lib/fish';
import { newRecovery, parseRecovery, inviteToken, type Recovery } from '@/lib/social/client';
import { useSocial } from './provider';
import FishSprite from '../fish-sprite';
import QrScanner from './qr-scanner';
import Notifications, { disconnectPush } from './notifications';
import SharedCard from './shared-card';
import SuggestedMates from './suggested-mates';
import AdminHotspots from '../admin/hotspots';
function message(e: unknown) {
  return e instanceof Error
    ? e.message.replace(/\[CONVEX[^]*?Uncaught ConvexError: /, '').split('\n')[0]
    : 'Something went wrong. Please try again.';
}
function downloadRecovery(r: Recovery) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'findex-online-recovery.private.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export default function Friends() {
  const s = useSocial();
  if (!s.configured)
    return (
      <div className="empty-state">
        <Users size={30} />
        <h2>Bring your mates.</h2>
        <p>
          Online FINDEX needs its Convex connection. Set NEXT_PUBLIC_CONVEX_URL, then rebuild the
          app.
        </p>
      </div>
    );
  return <OnlineFriends />;
}
function OnlineFriends() {
  const s = useSocial();
  const { signIn, signOut } = useAuthActions();
  const setup = useMutation(api.social.setup);
  const [name, setName] = useState(''),
    [avatar, setAvatar] = useState('001'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [recovery, setRecovery] = useState<Recovery | null>(null);
  const restore = useRef<HTMLInputElement>(null);
  const account = useQuery(api.social.account, s.authenticated ? {} : 'skip');
  const [pendingProfile, setPendingProfile] = useState<{ name: string; avatar: string } | null>(
    null,
  );
  const settingUp = useRef(false);
  useEffect(() => {
    if (!pendingProfile || !s.authenticated || s.me !== null || settingUp.current) return;
    settingUp.current = true;
    setBusy(true);
    setup(pendingProfile)
      .catch((e) => setError(message(e)))
      .finally(() => {
        settingUp.current = false;
        setPendingProfile(null);
        setBusy(false);
      });
  }, [pendingProfile, s.authenticated, s.me, setup]);
  useEffect(() => {
    if (!account) return;
    try {
      const raw = localStorage.getItem(`findex-online-key:${account}`);
      if (raw) setRecovery(parseRecovery(JSON.parse(raw)));
    } catch {
      setError('Your recovery file is not available on this device. Keep the original file safe.');
    }
  }, [account]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  async function create() {
    setBusy(true);
    setError('');
    try {
      if (!name.trim()) throw new Error('Choose your display name first.');
      const r = newRecovery();
      localStorage.setItem(`findex-online-key:${r.account}`, JSON.stringify(r));
      setRecovery(r);
      setPendingProfile({ name, avatar });
      await signIn('password', { email: r.account, password: r.secret, flow: 'signUp' });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function recover(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (file.size > 4096) throw new Error('Choose your private recovery file.');
      const r = parseRecovery(JSON.parse(await file.text()));
      await signIn('password', { email: r.account, password: r.secret, flow: 'signIn' });
      localStorage.setItem(`findex-online-key:${r.account}`, JSON.stringify(r));
      setRecovery(r);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
      if (restore.current) restore.current.value = '';
    }
  }
  async function saveProfile() {
    setBusy(true);
    setError('');
    try {
      await setup({ name, avatar });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="social-screen">
      {!online && (
        <p className="social-banner">
          <WifiOff size={14} />
          Offline. Your local journal still works; sharing resumes online.
        </p>
      )}
      {s.loading || (s.authenticated && s.me === undefined) ? (
        <p>Connecting to your FINDEX…</p>
      ) : !s.me ? (
        <div className="social-welcome">
          <div className="social-hero">
            <Users size={28} />
            <span className="eyebrow">LINK YOUR FIELD UNITS</span>
            <h2>
              Good catches.
              <br />
              Great company.
            </h2>
          </div>
          <p>
            Create a private online profile to swap QR invites, browse your mates’ collections and
            celebrate each catch.
          </p>
          <label className="form-label">
            Display name
            <input
              maxLength={30}
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What your mates call you"
            />
          </label>
          <label className="form-label">
            Your companion
            <select value={avatar} onChange={(e) => setAvatar(e.target.value)}>
              {fish.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <p className="social-privacy">
            All catches and sightings automatically sync with accepted mates when signed in, including previous records on this device. Shared records include species, date, size, quantity, outcome and a
            photo thumbnail. New catches use GPS when available; exact catch coordinates sync to an admin-only fishing map. Mates cannot see coordinates. Place names and notes stay on your device.
          </p>
          <button
            className="primary-button full-width"
            disabled={busy || !online || s.loading || name.trim().length < 2}
            onClick={s.authenticated ? saveProfile : create}
          >
            {busy
              ? 'Connecting…'
              : s.authenticated
                ? 'Save online profile'
                : 'Create my online FINDEX'}
          </button>
          <button
            className="secondary-button full-width"
            disabled={busy || !online}
            onClick={() => restore.current?.click()}
          >
            <Upload size={15} />
            Restore an online profile
          </button>
          <input
            ref={restore}
            type="file"
            hidden
            accept="application/json,.json"
            onChange={(e) => recover(e.target.files?.[0])}
          />
          <p className="social-privacy">
            Your private recovery file is your sign-in key. Save it after joining; it restores your
            friends and shared journal on another device. Local-only records need a separate journal
            backup.
          </p>
        </div>
      ) : (
        <Member
          key={s.me.userId}
          recovery={recovery}
          onSignOut={async () => {
            await disconnectPush();
            await signOut();
            if (account) localStorage.removeItem(`findex-online-key:${account}`);
            setRecovery(null);
          }}
        />
      )}
      {recovery && s.me && (
        <details className="recovery-banner">
          <summary>Save your private sign-in key</summary>
          <p>
            Keep this file private. Anyone with it can access your online profile. Save it before
            signing out.
          </p>
          <button
            className="secondary-button full-width"
            onClick={() => downloadRecovery(recovery)}
          >
            <Download size={15} />
            Download recovery file
          </button>
        </details>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
function Member({
  recovery,
  onSignOut,
}: {
  recovery: Recovery | null;
  onSignOut: () => Promise<void>;
}) {
  const s = useSocial();
  const me = s.me!;
  const home = useQuery(api.social.home, {}),
    feed = useQuery(api.social.feed, {});
  const preferences = useMutation(api.social.preferences),
    answer = useMutation(api.social.answer),
    unfriend = useMutation(api.social.unfriend),
    cancel = useMutation(api.social.cancelRequest),
    createInvite = useAction(api.invites.create),
    request = useMutation(api.social.request);
  const [view, setView] = useState<'feed' | 'mates' | 'qr' | 'settings' | 'map'>('feed'),
    [selected, setSelected] = useState<Id<'users'> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(''),
    [link, setLink] = useState(''),
    [token, setToken] = useState(''),
    [qr, setQr] = useState(''),
    [expires, setExpires] = useState(0),
    [now, setNow] = useState(Date.now()),
    [scanning, setScanning] = useState(false);
  const collection = useQuery(api.social.collection, selected ? { id: selected } : 'skip');
  const preview = useQuery(api.social.preview, token ? { token } : 'skip');
  const photoInput = useRef<HTMLInputElement>(null);
  const read = useCallback((value: string) => {
    setScanning(false);
    const t = inviteToken(value, window.location.origin);
    if (!t) {
      setError('Scan a FINDEX invite from this site, or paste your mate’s full invite link.');
      return;
    }
    setToken(t);
    setView('mates');
    setError('');
  }, []);
  useEffect(() => {
    const check = () => {
      if (location.hash.startsWith('#friend=')) read(location.href);
      if (location.hash === '#friends') setView('feed');
    };
    check();
    window.addEventListener('hashchange', check);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener('hashchange', check);
      clearInterval(timer);
    };
  }, [read]);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function makeQr() {
    await run(async () => {
      const i = await createInvite({});
      const value = `${location.origin}/#friend=${i.token}`;
      setLink(value);
      setExpires(i.expiresAt);
      setQr(
        await QRCode.toDataURL(value, {
          width: 320,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: { dark: '#16331b', light: '#ffffff' },
        }),
      );
    });
  }
  async function readPhoto(file?: File) {
    if (!file) return;
    await run(async () => {
      if (file.size > 15000000) throw new Error('Choose a QR photo under 15 MB.');
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const url = URL.createObjectURL(file);
      try {
        read((await reader.decodeFromImageUrl(url)).getText());
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    if (photoInput.current) photoInput.current.value = '';
  }
  if (selected)
    return (
      <div className="friend-detail">
        <button className="text-button" onClick={() => setSelected(null)}>
          <ArrowLeft size={15} />
          Back to mates
        </button>
        {collection === undefined ? (
          <p>Opening collection…</p>
        ) : collection === null ? (
          <p>This FINDEX is no longer shared with you.</p>
        ) : (
          <>
            <div className="friend-profile">
              <FishSprite fish={findFish(collection.profile.avatar) || unidentified} />
              <div>
                <h2>{collection.profile.name}</h2>
                <p>
                  {Object.keys(collection.species).filter((id) => id !== 'other').length} /{' '}
                  {fish.length} species · {collection.total} shared memories
                </p>
              </div>
            </div>
            <div className="friend-collection">
              {fish
                .filter((f) => collection.species[f.id])
                .map((f) => (
                  <div key={f.id} title={f.name}>
                    <FishSprite fish={f} />
                    <span>{f.name}</span>
                  </div>
                ))}
            </div>
            <h3>Recent catches & sightings</h3>
            {collection.recent.map((r) => (
              <SharedCard key={r._id} record={r} />
            ))}
          </>
        )}
      </div>
    );
  return (
    <>
      <button
        className="social-profile full-width"
        aria-label="Open my shared FINDEX"
        onClick={() => setSelected(me.userId)}
      >
        <FishSprite fish={findFish(me.avatar) || unidentified} />
        <div>
          <strong>{me.name}</strong>
          <small>{home?.friends.length || 0} mates linked · view my shared FINDEX →</small>
        </div>
      </button>
      <div className="social-tabs">
        {(['feed', 'mates', 'qr', 'settings'] as const).map((v) => (
          <button
            key={v}
            className={view === v ? 'active' : ''}
            onClick={() => {
              setView(v);
              setError('');
            }}
          >
            {v === 'qr' ? 'MY QR' : v === 'settings' ? 'SETUP' : v.toUpperCase()}
            {v === 'mates' && !!home?.incoming.length && <b>{home.incoming.length}</b>}
          </button>
        ))}
      </div>
      {s.pending > 0 && (
        <p className="social-banner">
          {s.pending} online {s.pending === 1 ? 'change' : 'changes'} waiting to sync.
        </p>
      )}
      {s.syncError && (
        <div className="social-banner">
          <span>Online sync paused: {message(new Error(s.syncError))}</span>
          <button onClick={s.retry}>Retry</button>
        </div>
      )}
      {view === 'feed' && (
        <>
          <div className="social-section-heading">
            <span className="eyebrow">THE MATES’ FEED</span>
            <span className="live-dot">LIVE</span>
          </div>
          {feed === undefined ? (
            <p>Listening for catches…</p>
          ) : feed.length ? (
            feed.map((r) => <SharedCard key={r._id} record={r} />)
          ) : (
            <div className="empty-state">
              <Users size={28} />
              <h3>Your next fishing story starts here.</h3>
              <p>
                Add a mate with their QR. Their shared catches and sightings will appear here
                instantly.
              </p>
              <button className="secondary-button" onClick={() => setView('mates')}>
                Find your mates
              </button>
            </div>
          )}
        </>
      )}
      {view === 'map' && s.isAdmin && <><button className="text-button" onClick={() => setView('settings')}>← Back to setup</button><AdminHotspots/></>}
      {view === 'mates' && (
        <>
          <div className="social-actions">
            <button className="primary-button" onClick={() => setScanning(true)}>
              <ScanLine size={16} />
              Scan QR
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => photoInput.current?.click()}
            >
              <Upload size={15} />
              QR photo
            </button>
          </div>
          <input
            ref={photoInput}
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => readPhoto(e.target.files?.[0])}
          />
          {scanning && <QrScanner onRead={read} onClose={() => setScanning(false)} />}
          <form
            className="invite-paste"
            onSubmit={(e) => {
              e.preventDefault();
              read(link);
            }}
          >
            <label className="form-label">
              Or paste an invite link
              <input
                aria-label="Friend invite link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…/#friend=…"
              />
            </label>
            <button className="secondary-button" type="submit">
              Open
            </button>
          </form>
          {token && (
            <div className="invite-preview">
              {preview === undefined ? (
                <p>Checking invite…</p>
              ) : preview ? (
                <>
                  <strong>{preview.name}’s FINDEX</strong>
                  <p>Send a request. Journals become visible after they accept.</p>
                  <button
                    className="primary-button full-width"
                    disabled={busy || preview.userId === me.userId}
                    onClick={() =>
                      run(async () => {
                        await request({ token });
                        setToken('');
                        history.replaceState(null, '', location.pathname);
                      })
                    }
                  >
                    {preview.userId === me.userId ? 'This is your FINDEX' : 'Send friend request'}
                  </button>
                </>
              ) : (
                <p>This invite has expired. Ask for a fresh QR.</p>
              )}
              <button
                className="text-button"
                onClick={() => {
                  setToken('');
                  history.replaceState(null, '', location.pathname);
                }}
              >
                Dismiss invite
              </button>
            </div>
          )}
          {home?.incoming.map((r) => (
            <div className="friend-request" key={r._id}>
              <span>
                <strong>{r.profile.name}</strong>
                <small>wants to link FINDEXes</small>
              </span>
              <button
                aria-label={`Accept ${r.profile.name}`}
                disabled={busy}
                onClick={() => run(() => answer({ id: r._id, accept: true }))}
              >
                <Check size={18} />
              </button>
              <button
                aria-label={`Decline ${r.profile.name}`}
                disabled={busy}
                onClick={() => run(() => answer({ id: r._id, accept: false }))}
              >
                <X size={18} />
              </button>
            </div>
          ))}
          {home?.outgoing.map((r) => (
            <div className="friend-request" key={r._id}>
              <span>
                <strong>{r.profile.name}</strong>
                <small>Request sent · waiting for approval</small>
              </span>
              <button className="text-button" onClick={() => run(() => cancel({ id: r._id }))}>
                Cancel
              </button>
            </div>
          ))}
          <h3>Your crew</h3>
          {home?.friends.length ? (
            home.friends.map((p) => (
              <div className="mate-row" key={p.userId}>
                <button onClick={() => setSelected(p.userId)}>
                  <FishSprite fish={findFish(p.avatar) || unidentified} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>Open collection & recent catches →</small>
                  </span>
                </button>
                <button aria-label={`Remove ${p.name}`} onClick={() => setConfirm(p.userId)}>
                  <X size={15} />
                </button>
                {confirm === p.userId && (
                  <div className="social-confirm">
                    <p>Remove {p.name}? Both journals become private to each other immediately.</p>
                    <button
                      disabled={busy}
                      className="secondary-button"
                      onClick={() =>
                        run(async () => {
                          await unfriend({ id: p.userId });
                          setConfirm('');
                        })
                      }
                    >
                      Remove mate
                    </button>
                    <button className="text-button" onClick={() => setConfirm('')}>
                      Keep mate
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="social-privacy">No mates linked yet. Scan their QR or show yours.</p>
          )}
          <SuggestedMates />
        </>
      )}
      {view === 'qr' && (
        <div className="my-qr">
          <QrCode size={26} />
          <h2>Link up, in person.</h2>
          <p>Your mate scans this with their FINDEX, then you accept their request.</p>
          {qr && expires > now ? (
            <>
              <img src={qr} alt="Your temporary FINDEX friend invite QR" width={240} height={240} />
              <span>Expires in {Math.max(0, Math.ceil((expires - now) / 60000))} min</span>
              <button
                className="secondary-button full-width"
                onClick={() =>
                  run(async () => {
                    await navigator.clipboard.writeText(link);
                  })
                }
              >
                Copy invite link
              </button>
            </>
          ) : (
            <p className="social-privacy">
              Invites last 10 minutes. Generating a new QR invalidates the previous one.
            </p>
          )}
          <button className="primary-button full-width" disabled={busy} onClick={makeQr}>
            {busy ? 'Generating…' : qr ? 'Generate fresh QR' : 'Show my friend QR'}
          </button>
        </div>
      )}
      {view === 'settings' && (
        <>
          {s.isAdmin && <div className="social-setting"><strong>Admin tools</strong><p>Catch locations and fishing density. Restricted to your admin account.</p><button className="secondary-button full-width" onClick={() => setView('map')}>Open fishing hotspot map</button></div>}
          <div className="social-setting">
            <strong>Shared with your mates</strong>
            <p>All catches and sightings automatically sync with your accepted mates, including previous records on this device. Offline records sync when you reconnect.</p>
          </div>
          <Notifications />
          <label className="release-checkbox">
            <input
              type="checkbox"
              checked={me.muteAlerts}
              onChange={(e) =>
                run(() => preferences({ muteAlerts: e.target.checked }))
              }
            />
            <span>Mute all catch toasts & push alerts</span>
          </label>
          <div className="social-setting">
            <strong>Your account</strong>
            <p>
              {recovery
                ? 'Download your private recovery file below before signing out.'
                : 'Your online profile was restored on this device. Keep your original recovery file safe.'}{' '}
              Your local journal stays on this device when you sign out.
            </p>
            <button
              className="secondary-button full-width"
              disabled={busy}
              onClick={() => setConfirm('signout')}
            >
              Sign out of online FINDEX
            </button>
            {confirm === 'signout' && (
              <div className="social-confirm">
                <p>Have your recovery file saved? You need it to get back to this profile.</p>
                <button className="secondary-button" disabled={busy} onClick={() => run(onSignOut)}>
                  Sign out
                </button>
                <button className="text-button" onClick={() => setConfirm('')}>
                  Stay signed in
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
