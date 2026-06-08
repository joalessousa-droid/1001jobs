// Captura uma selfie real via getUserMedia e devolve um data URL base64.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  onCapture: (base64: string) => void;
  captured?: string | null;
}

export function WebcamCapture({ onCapture, captured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);

  async function start() {
    setError(null); setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch (e: any) {
      setError(e?.message ?? "Câmera indisponível");
    } finally { setStarting(false); }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }

  useEffect(() => { return () => stop(); }, []);

  function snap() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const b64 = c.toDataURL("image/jpeg", 0.85);
    onCapture(b64);
    stop();
  }

  if (captured) {
    return (
      <div className="space-y-2">
        <img src={captured} alt="Selfie capturada" className="w-full max-w-xs rounded border border-border" />
        <Button type="button" variant="outline" size="sm" onClick={() => { onCapture(""); start(); }}>
          <RefreshCw className="h-4 w-4 mr-1" />Refazer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <video ref={videoRef} playsInline muted className="w-full max-w-xs rounded border border-border bg-black" />
      {!ready ? (
        <Button type="button" size="sm" onClick={start} disabled={starting}>
          {starting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          Iniciar câmera
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={snap}>
          <Camera className="h-4 w-4 mr-1" />Capturar selfie
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
