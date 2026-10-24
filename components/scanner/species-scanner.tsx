'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ScanLine,
  Download,
  Upload,
  ShieldCheck,
  RotateCcw,
  Check,
  Info,
  X,
} from 'lucide-react';
import { fish, findFish, unidentified, type Fish } from '@/lib/fish';
import { preparePhoto } from '@/lib/storage';
import {
  scannerIsCached,
  SCANNER_CACHE,
  type ScanProgress,
  type ScanResult,
  type WorkerReply,
} from '@/lib/scanner/model';
import { CatchPhoto } from '../screen-ui';
import FishSprite from '../fish-sprite';
type Props = {
  photo?: Blob | null;
  onSelect: (entry: Fish, photo: Blob) => void;
  onBack?: () => void;
};
export default function SpeciesScanner({ photo: initialPhoto, onSelect, onBack }: Props) {
  const [photo, setPhoto] = useState<Blob | null>(initialPhoto || null),
    [live, setLive] = useState(false),
    [cameraBusy, setCameraBusy] = useState(false),
    [processing, setProcessing] = useState(false),
    [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'scanning' | 'error'>('idle'),
    [progress, setProgress] = useState<ScanProgress | null>(null),
    [result, setResult] = useState<ScanResult | null>(null),
    [error, setError] = useState(''),
    [cached, setCached] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null),
    stream = useRef<MediaStream | null>(null),
    worker = useRef<Worker | null>(null),
    upload = useRef<HTMLInputElement>(null),
    fallbackCamera = useRef<HTMLInputElement>(null),
    resultsRef = useRef<HTMLElement>(null),
    mounted = useRef(true),
    request = useRef(0);
  useEffect(() => {
    if (result)
      resultsRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  }, [result]);
  function stopCamera() {
    request.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setLive(false);
    setCameraBusy(false);
  }
  function prepare() {
    if (worker.current || phase === 'loading') return;
    setError('');
    setPhase('loading');
    setProgress({ phase: 'load', message: 'Preparing the private scanner…' });
    try {
      const w = new Worker(new URL('./recognition.worker.ts', import.meta.url), { type: 'module' });
      worker.current = w;
      w.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (!mounted.current) return;
        const reply = event.data;
        if (reply.type === 'progress') setProgress(reply.progress);
        else if (reply.type === 'ready') {
          setCached(true);
          setPhase('ready');
          setProgress(null);
        } else if (reply.type === 'result') {
          setResult(reply.result);
          setPhase('ready');
          setProgress(null);
        } else {
          setError(reply.message);
          setPhase('error');
          w.terminate();
          worker.current = null;
        }
      };
      w.onerror = () => {
        setError(
          'This device could not start the AI scanner. Try updating your browser, or choose the species manually.',
        );
        setPhase('error');
        w.terminate();
        worker.current = null;
      };
      w.postMessage({ type: 'load' });
    } catch {
      setPhase('error');
      setError('This browser does not support the scanner. You can still log a catch manually.');
    }
  }
  useEffect(() => {
    mounted.current = true;
    scannerIsCached().then((ready) => {
      if (!mounted.current) return;
      setCached(ready);
      if (ready) prepare();
    });
    return () => {
      mounted.current = false;
      request.current++;
      worker.current?.terminate();
      worker.current = null;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function openCamera() {
    const attempt = ++request.current;
    setError('');
    setCameraBusy(true);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error('secure-camera');
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });
      if (!mounted.current || attempt !== request.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = media;
      setResult(null);
      setLive(true);
    } catch (e) {
      if (mounted.current && attempt === request.current)
        setError(
          e instanceof Error && e.message === 'secure-camera'
            ? 'Live camera needs HTTPS (or localhost). Use Take photo or Choose photo instead.'
            : 'Camera unavailable. Allow camera access in browser settings, or choose a photo instead.',
        );
    } finally {
      if (mounted.current && attempt === request.current) setCameraBusy(false);
    }
  }
  async function choose(file?: File) {
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      const prepared = await preparePhoto(file);
      if (!mounted.current) return;
      stopCamera();
      setPhoto(prepared);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This photo could not be opened.');
    } finally {
      if (mounted.current) setProcessing(false);
      if (upload.current) upload.current.value = '';
      if (fallbackCamera.current) fallbackCamera.current.value = '';
    }
  }
  async function capture() {
    const v = video.current;
    if (!v?.videoWidth || !v.videoHeight) {
      setError('Wait for the camera preview, then try again.');
      return;
    }
    setProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      const size = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * size);
      canvas.height = Math.round(v.videoHeight * size);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture a photo on this device.');
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Could not capture this frame.'))),
          'image/jpeg',
          0.85,
        ),
      );
      if (mounted.current) {
        setPhoto(blob);
        setResult(null);
        stopCamera();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not capture this frame.');
    } finally {
      if (mounted.current) setProcessing(false);
    }
  }
  function identify() {
    if (!photo || phase !== 'ready' || !worker.current) return;
    setResult(null);
    setError('');
    setPhase('scanning');
    setProgress({ phase: 'scan', message: 'Looking at your photo…' });
    worker.current.postMessage({ type: 'scan', photo });
  }
  async function resetModel() {
    worker.current?.terminate();
    worker.current = null;
    try {
      await caches.delete(SCANNER_CACHE);
      setCached(false);
      setPhase('idle');
      setProgress(null);
      setResult(null);
      setError('');
    } catch {
      setError('Could not clear the scanner download. Check your browser’s site storage settings.');
    }
  }
  const busy = phase === 'loading' || phase === 'scanning' || processing;
  return (
    <div className="dialog-content species-scanner">
      <div className="scanner-heading">
        <ScanLine size={26} />
        <span className="eyebrow">ON-DEVICE SPECIES SCANNER</span>
      </div>
      <h2>What’s on the line?</h2>
      <p className="form-intro">
        Fill the frame with one animal, side-on in good light. Keep its fins, tail and markings
        visible.
      </p>
      <div className="scanner-viewfinder">
        {live ? (
          <video
            ref={(el) => {
              video.current = el;
              if (el && stream.current) el.srcObject = stream.current;
            }}
            autoPlay
            playsInline
            muted
            aria-label="Fish scanner camera preview"
          />
        ) : photo ? (
          <CatchPhoto photo={photo} alt="Photo for private species identification" />
        ) : (
          <div className="scanner-empty">
            <ScanLine size={42} />
            <strong>One fish. A closer look.</strong>
            <span>No photo is uploaded for recognition.</span>
          </div>
        )}
        <span className="scanner-corner tl" />
        <span className="scanner-corner tr" />
        <span className="scanner-corner bl" />
        <span className="scanner-corner br" />
        {live && <span className="scanner-live">CAMERA ON</span>}
      </div>
      {live ? (
        <div className="scanner-actions">
          <button className="primary-button" disabled={busy} onClick={capture}>
            <Camera size={17} />
            Capture frame
          </button>
          <button className="secondary-button" onClick={stopCamera}>
            <X size={16} />
            Stop camera
          </button>
        </div>
      ) : (
        <div className="scanner-actions">
          <button className="secondary-button" disabled={busy || cameraBusy} onClick={openCamera}>
            <Camera size={16} />
            {cameraBusy ? 'Opening…' : photo ? 'Retake' : 'Open camera'}
          </button>
          <button
            className="secondary-button"
            disabled={busy || cameraBusy}
            onClick={() => upload.current?.click()}
          >
            <Upload size={16} />
            Choose photo
          </button>
        </div>
      )}
      {!live && (
        <button
          className="text-button scanner-native-camera"
          disabled={busy || cameraBusy}
          onClick={() => fallbackCamera.current?.click()}
        >
          Use device camera / take photo
        </button>
      )}
      <input
        ref={upload}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <input
        ref={fallbackCamera}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {(phase === 'idle' || phase === 'error') && (
        <div className="scanner-download">
          <Download size={20} />
          <div>
            <strong>{cached ? 'Restart your scanner' : 'Prepare your pocket AI'}</strong>
            <p>
              First setup downloads about 61 MB; Wi-Fi is recommended. The model stays on this
              device for offline use, subject to browser storage.
            </p>
            <button className="primary-button full-width" onClick={prepare}>
              {cached ? 'Restart scanner' : 'Download & prepare scanner'}
            </button>
          </div>
        </div>
      )}
      {progress && (
        <div className="scanner-progress" role="status">
          <span className="scanner-pulse" />
          <p>{progress.message}</p>
          {progress.percent !== undefined && (
            <progress aria-label="Scanner model download" max="100" value={progress.percent} />
          )}
          <small>
            {phase === 'scanning'
              ? 'Processing on your device. This may take a little while.'
              : 'You can close this screen and resume setup later.'}
          </small>
        </div>
      )}
      {phase === 'ready' && !result && !live && (
        <button
          className="primary-button full-width"
          disabled={!photo || processing}
          onClick={identify}
        >
          <ScanLine size={18} />
          {photo ? 'Identify this photo' : 'Add a photo to identify'}
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          <Info size={16} />
          {error}
        </p>
      )}
      {result && (
        <section ref={resultsRef} className="scanner-results" aria-label="Species suggestions">
          <span className="eyebrow">
            {result.reason === 'no-animal'
              ? 'NO CLEAR MATCH'
              : result.uncertain
                ? 'A CLOSER LOOK NEEDED'
                : 'POSSIBLE MATCHES'}
          </span>
          <h3>
            {result.reason === 'no-animal'
              ? 'Let’s try a clearer view.'
              : 'Does one of these look right?'}
          </h3>
          <p>
            {result.reason === 'no-animal'
              ? 'I couldn’t find a clear catalogue match. Get closer in good light, or save it for identification later.'
              : result.uncertain
                ? 'These species look similar to the model. Compare the markings and choose only if you recognise the animal.'
                : 'These are AI suggestions, not a confirmed identification. Compare each species before selecting.'}
          </p>
          {result.matches.map((match, index) => {
            const f = findFish(match.id);
            return (
              f && (
                <div className="scanner-match" key={f.id}>
                  <div>
                    <span className="scanner-rank">{index + 1}</span>
                    <FishSprite fish={f} />
                    <div>
                      <strong>{f.name}</strong>
                      <small>{f.scientific}</small>
                    </div>
                  </div>
                  <p>{f.description}</p>
                  <button
                    className="secondary-button full-width"
                    onClick={() => photo && onSelect(f, photo)}
                  >
                    <Check size={15} />
                    Use {f.name}
                  </button>
                </div>
              )
            );
          })}
          <button className="secondary-button full-width" onClick={identify}>
            <RotateCcw size={15} />
            Try this photo again
          </button>
        </section>
      )}
      {photo && !live && (
        <button
          className="text-button full-width"
          disabled={busy}
          onClick={() => onSelect(unidentified, photo)}
        >
          None of these / identify later
        </button>
      )}
      <p className="scanner-safety">
        Experimental AI can confuse similar species. Confirm with the field guide before keeping a
        catch; it cannot establish legal size or whether a species is safe to eat.
      </p>
      <p className="form-privacy">
        <ShieldCheck size={13} />
        No account, API key or photo upload needed. Nothing is logged until you confirm the catch.
      </p>
      {onBack && (
        <button className="text-button full-width" onClick={onBack}>
          Back to catch form
        </button>
      )}
      {(cached || phase === 'error') && !busy && (
        <button className="text-button full-width" onClick={resetModel}>
          Remove scanner model download
        </button>
      )}
    </div>
  );
}
