import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Camera, Upload, FileCheck, X, RefreshCw, ShieldCheck } from "lucide-react";

interface Props {
  isPJ: boolean;
  documentFile: File | null;
  selfieFile: File | null;
  selfieWithDocFile: File | null;
  onDocumentChange: (f: File | null) => void;
  onSelfieChange: (f: File | null) => void;
  onSelfieWithDocChange: (f: File | null) => void;
}

const StepKYC = ({
  isPJ, documentFile, selfieFile, selfieWithDocFile,
  onDocumentChange, onSelfieChange, onSelfieWithDocChange,
}: Props) => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"selfie" | "selfie_with_doc">("selfie");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const openCamera = useCallback(async (target: "selfie" | "selfie_with_doc") => {
    setCameraTarget(target);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraOpen(false);
      alert("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `${cameraTarget}-${Date.now()}.jpg`, { type: "image/jpeg" });
      if (cameraTarget === "selfie") onSelfieChange(file);
      else onSelfieWithDocChange(file);
      closeCamera();
    }, "image/jpeg", 0.85);
  }, [cameraTarget, onSelfieChange, onSelfieWithDocChange]);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const FilePreview = ({ file, onRemove, label }: { file: File | null; onRemove: () => void; label: string }) => {
    if (!file) return null;
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
        <FileCheck className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (cameraOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {cameraTarget === "selfie" ? "Tire uma selfie" : "Selfie segurando documento"}
          </h3>
          <Button variant="ghost" size="sm" onClick={closeCamera}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-60 border-2 border-dashed border-white/50 rounded-[50%]" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-3">
          <Button onClick={capturePhoto} className="flex-1 h-12 rounded-xl gap-2">
            <Camera className="w-5 h-5" /> Capturar foto
          </Button>
          <Button variant="outline" onClick={closeCamera} className="h-12 rounded-xl">
            Cancelar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {cameraTarget === "selfie"
            ? "Posicione seu rosto dentro do guia oval e clique em capturar"
            : "Segure seu documento ao lado do rosto e clique em capturar"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">Verificação de Identidade</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Para sua segurança, precisamos verificar sua identidade. Envie os documentos solicitados abaixo.
      </p>

      {/* Document upload */}
      <div>
        <Label className="mb-2 block font-medium">
          {isPJ ? "Documento do representante (RG ou CNH) *" : "Documento com foto (RG ou CNH) *"}
        </Label>
        {documentFile ? (
          <FilePreview file={documentFile} onRemove={() => onDocumentChange(null)} label={documentFile.name} />
        ) : (
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">Clique para enviar</span>
            <span className="text-xs text-muted-foreground mt-1">JPG, PNG ou PDF (máx. 5MB)</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 5 * 1024 * 1024) {
                  alert("Arquivo muito grande. Máximo 5MB.");
                  return;
                }
                onDocumentChange(f || null);
              }}
            />
          </label>
        )}
      </div>

      {/* Selfie */}
      <div>
        <Label className="mb-2 block font-medium">Selfie em tempo real *</Label>
        {selfieFile ? (
          <div className="space-y-2">
            <FilePreview file={selfieFile} onRemove={() => onSelfieChange(null)} label="Selfie capturada" />
            <img
              src={URL.createObjectURL(selfieFile)}
              alt="Selfie preview"
              className="w-24 h-24 rounded-xl object-cover border border-border"
            />
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => openCamera("selfie")}
            className="w-full h-14 rounded-xl gap-2 border-dashed border-2"
          >
            <Camera className="w-5 h-5" /> Abrir câmera para selfie
          </Button>
        )}
      </div>

      {/* Selfie with document (optional) */}
      <div>
        <Label className="mb-2 block font-medium">
          Selfie segurando documento <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        {selfieWithDocFile ? (
          <div className="space-y-2">
            <FilePreview file={selfieWithDocFile} onRemove={() => onSelfieWithDocChange(null)} label="Selfie com documento" />
            <img
              src={URL.createObjectURL(selfieWithDocFile)}
              alt="Selfie with doc preview"
              className="w-24 h-24 rounded-xl object-cover border border-border"
            />
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => openCamera("selfie_with_doc")}
            className="w-full h-14 rounded-xl gap-2 border-dashed border-2"
          >
            <Camera className="w-5 h-5" /> Selfie segurando documento
          </Button>
        )}
      </div>

      {isPJ && (
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            📄 Para empresas, o Cartão CNPJ e Contrato Social podem ser enviados após o cadastro no painel.
          </p>
        </div>
      )}
    </div>
  );
};

export default StepKYC;
