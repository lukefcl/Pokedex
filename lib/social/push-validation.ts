export function validPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      value.length < 2048 &&
      (u.hostname === 'fcm.googleapis.com' ||
        u.hostname === 'updates.push.services.mozilla.com' ||
        u.hostname.endsWith('.push.apple.com') ||
        u.hostname.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}
export function validPushKeys(p256dh: string, auth: string) {
  return /^[A-Za-z0-9_-]{87}={0,1}$/.test(p256dh) && /^[A-Za-z0-9_-]{22}={0,2}$/.test(auth);
}
