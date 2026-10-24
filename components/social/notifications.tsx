'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
export default function Notifications() {
  const key = useQuery(api.subscriptions.key, {});
  const subscribe = useMutation(api.subscriptions.subscribe),
    unsubscribe = useMutation(api.subscriptions.unsubscribe);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.pushManager?.getSubscription())
        .then((s) => setEnabled(!!s));
  }, []);
  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        throw new Error(
          'Push is unavailable here. On iPhone, install FINDEX to your home screen, then open it from there.',
        );
      if (!window.isSecureContext) throw new Error('Notifications require HTTPS.');
      if (enabled) {
        const reg = await navigator.serviceWorker.ready;
        const s = await reg.pushManager.getSubscription();
        if (s) {
          await unsubscribe({ endpoint: s.endpoint });
          await s.unsubscribe();
        }
        setEnabled(false);
        return;
      }
      if (!key) throw new Error('Push notifications are still being configured.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted')
        throw new Error(
          'Notifications are off. You can allow them in your browser’s site settings.',
        );
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(
        atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (key.length % 4)) % 4)),
        (c) => c.charCodeAt(0),
      );
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      const json = s.toJSON();
      if (!json.keys) throw new Error('This browser did not provide push keys.');
      try {
        await subscribe({ endpoint: s.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
      } catch (e) {
        await s.unsubscribe();
        throw e;
      }
      setEnabled(true);
      setMessage('Catch alerts enabled on this device.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update notifications.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="social-setting">
      <strong>Catch alerts</strong>
      <p>
        Get a notification when a mate shares a new catch, even with FINDEX closed. iPhone requires
        the installed PWA.
      </p>
      <button className="secondary-button full-width" disabled={busy} onClick={toggle}>
        {busy
          ? 'Updating…'
          : enabled
            ? 'Disable alerts on this device'
            : 'Enable catch notifications'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export async function disconnectPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const s = await reg?.pushManager?.getSubscription();
  if (s && !(await s.unsubscribe()))
    throw new Error('Disable this device’s notifications before signing out.');
}
