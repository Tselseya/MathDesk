import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Upload, X } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { ImageRejected, prepareImage, type PreparedImage } from '../lib/images';

interface CameraCaptureProps { onClose: () => void; onUseImage: (image: PreparedImage) => void; }

export default function CameraCapture({ onClose, onUseImage }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const capturedBlob = useRef<Blob | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function close() {
    stopCamera();
    onClose();
  }

  const dialogRef = useDialogA11y<HTMLElement>(close);

  async function startCamera(nextFacing = facing) {
    setError('');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : '';
      setError(name === 'NotAllowedError' ? 'Camera permission was denied. You can upload a photo instead.' : name === 'NotFoundError' ? 'No camera was found on this device.' : 'We could not access the camera. You can upload a photo instead.');
    }
  }

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) setError('This browser does not support camera capture. You can upload a photo instead.');
    else void startCamera();
    return stopCamera;
  }, []);

  useEffect(() => () => { if (captured) URL.revokeObjectURL(captured); }, [captured]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError('Could not capture the photo. Please try again.'); return; }
      setCaptured(URL.createObjectURL(blob));
      capturedBlob.current = blob;
    }, 'image/jpeg', 0.92);
  }

  async function submit(source: Blob | null | undefined) {
    if (!source || busy) return;
    setBusy(true);
    try {
      onUseImage(await prepareImage(source));
      close();
    } catch (problem) {
      setError(problem instanceof ImageRejected ? problem.message : 'That image could not be used. Please try another one.');
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    capturedBlob.current = null;
    setCaptured(null);
    void startCamera();
  }

  return (
    <div className="camera-overlay">
      <section ref={dialogRef} tabIndex={-1} className="camera-card" role="dialog" aria-modal="true" aria-labelledby="camera-title">
        <header className="camera-header">
          <div><span className="eyebrow"><Camera size={14} /> Camera input</span><h2 id="camera-title">Capture a math problem</h2></div>
          <button className="tool-close" onClick={close} aria-label="Close camera"><X size={18} /></button>
        </header>
        <div className="camera-view">
          {captured ? <img src={captured} alt="Captured math problem preview" /> : <video ref={videoRef} autoPlay playsInline muted />}
          {error && <div className="camera-error"><Camera size={25} /><p>{error}</p><button className="primary-tool-button" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload a photo</button></div>}
        </div>
        <canvas ref={canvasRef} hidden />
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { void submit(event.target.files?.[0]); event.target.value = ''; }} />
        <footer className="camera-actions">
          {captured ? (
            <>
              <button className="secondary-tool-button" onClick={retake}><RotateCcw size={15} /> Retake</button>
              <button className="primary-tool-button" onClick={() => void submit(capturedBlob.current)} disabled={busy}>{busy ? 'Preparing…' : 'Use this photo'}</button>
            </>
          ) : (
            <>
              {!error && (
                <>
                  <button className="camera-flip" onClick={() => { const next = facing === 'environment' ? 'user' : 'environment'; setFacing(next); void startCamera(next); }} title="Switch camera">↻</button>
                  <button className="capture-button" onClick={capture} aria-label="Capture photo"><span /></button>
                </>
              )}
              <button className="secondary-tool-button" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload instead</button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
