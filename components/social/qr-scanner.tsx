'use client';
import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
export default function QrScanner({
  onRead,
  onClose,
}: {
  onRead: (value: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls.current?.stop();
              onRead(result.getText());
            }
          },
        );
        if (cancelled) c.stop();
        else controls.current = c;
      } catch {
        setError(
          'Camera unavailable. Allow camera access, use a QR photo, or paste your mate’s invite link.',
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      controls.current?.stop();
    };
  }, [onRead]);
  return (
    <div className="qr-scanner">
      <video ref={video} playsInline muted aria-label="Friend QR camera" />
      {error && <p role="alert">{error}</p>}
      <button className="secondary-button full-width" onClick={onClose}>
        Close camera
      </button>
    </div>
  );
}
