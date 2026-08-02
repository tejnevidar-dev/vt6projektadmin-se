import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, PenLine, Type } from "lucide-react";

interface SignaturePadProps {
  /** Namnförtydligande – styrs av föräldern */
  name: string;
  onNameChange: (v: string) => void;
  /** Anropas när signaturbilden ändras (data-URL PNG eller null) */
  onSignatureChange: (dataUrl: string | null) => void;
  label?: string;
}

type Mode = "draw" | "type";

export function SignaturePad({
  name,
  onNameChange,
  onSignatureChange,
  label = "Signatur",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [mode, setMode] = useState<Mode>("draw");

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";
  };

  useEffect(() => {
    setupCanvas();
    const onResize = () => {
      setupCanvas();
      hasInk.current = false;
      onSignatureChange(null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSignatureChange(hasInk.current ? canvas.toDataURL("image/png") : null);
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onSignatureChange(null);
  };

  /** Renderar det skrivna namnet till en PNG i skrivstil */
  const renderTyped = (value: string) => {
    if (!value.trim()) {
      onSignatureChange(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 700;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000000";
    ctx.font = "italic 68px 'Instrument Serif', Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(value.trim(), 20, 95);
    onSignatureChange(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "draw" ? "default" : "outline"}
            onClick={() => {
              setMode("draw");
              onSignatureChange(null);
            }}
          >
            <PenLine className="mr-1 h-3.5 w-3.5" />
            Rita
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "type" ? "default" : "outline"}
            onClick={() => {
              setMode("type");
              renderTyped(name);
            }}
          >
            <Type className="mr-1 h-3.5 w-3.5" />
            Skriv
          </Button>
        </div>
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none rounded-md border border-input bg-card"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-muted-foreground/40" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="absolute right-2 top-2"
            onClick={clear}
          >
            <Eraser className="mr-1 h-3.5 w-3.5" />
            Rensa
          </Button>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border border-input bg-card px-4">
          <span
            className="truncate text-4xl italic"
            style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
          >
            {name.trim() || "Ditt namn"}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Namnförtydligande</Label>
        <Input
          value={name}
          placeholder="För- och efternamn"
          onChange={(e) => {
            onNameChange(e.target.value);
            if (mode === "type") renderTyped(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
