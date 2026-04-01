import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eraser, Download } from 'lucide-react';

export default function SignatureCanvas({ onSave, initialSignature }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState(initialSignature || null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load initial signature if exists
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    ctx.beginPath();
    ctx.moveTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    ctx.lineTo(
      e.clientX - rect.left,
      e.clientY - rect.top
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');
      setSignature(dataUrl);
      if (onSave) {
        onSave(dataUrl);
      }
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
    if (onSave) {
      onSave(null);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Assinatura do Gestor</Label>
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-2 bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={200}
          className="border border-slate-200 rounded cursor-crosshair w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCanvas}
            className="text-slate-600"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Desenhe a assinatura do gestor responsável pela aprovação da baixa
      </p>
    </div>
  );
}