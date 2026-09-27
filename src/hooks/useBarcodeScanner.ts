import { useEffect, useRef, useState, type RefObject } from "react";
import { getBarcodeDetector } from "@/lib/scanner/barcodeDetector";

const SCAN_INTERVAL_MS = 250;

function cameraErrorMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Camera access was blocked. Allow it in your browser settings and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is in use by another app.";
  return "Couldn't start the camera.";
}

interface UseBarcodeScannerOptions {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  // Called once with the first code read; scanning stops until re-activated.
  onDetect: (value: string) => void;
}

/** Streams the rear camera into videoRef and reads codes while active. */
export function useBarcodeScanner({ active, videoRef, onDetect }: UseBarcodeScannerOptions) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onDetectRef = useRef(onDetect);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastScan = 0;
    let busy = false;
    const stopStream = () => stream?.getTracks().forEach((t) => t.stop());

    async function start() {
      setError(null);
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("Camera scanning needs a secure (https) connection.");
        return;
      }
      setStarting(true);
      try {
        const [detector, media] = await Promise.all([
          getBarcodeDetector(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        ]);
        stream = media;
        const video = videoRef.current;
        if (stopped || !video) return stopStream();
        video.srcObject = media;
        await video.play();

        const scan = async (now: number) => {
          if (stopped) return;
          if (!busy && now - lastScan >= SCAN_INTERVAL_MS && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            busy = true;
            lastScan = now;
            const value = (await detector.detect(video).catch(() => []))[0]?.rawValue;
            busy = false;
            if (value && !stopped) {
              stopped = true;
              onDetectRef.current(value);
              return;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        const tick = (now: number) => void scan(now);
        frame = requestAnimationFrame(tick);
      } catch (err) {
        if (!stopped) setError(cameraErrorMessage(err));
      } finally {
        setStarting(false);
      }
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stopStream();
    };
  }, [active, videoRef]);

  return { error, starting };
}
