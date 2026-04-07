import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eraser } from 'lucide-react';

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

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Suporte para Mouse e Touch
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (e.type === 'touchstart') e.preventDefault(); // Evita rolar a página no mobile
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.type === 'touchmove') e.preventDefault(); // Evita rolar a página no mobile
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
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
    <div className="space-y-2 text-left">
      <Label>Assinatura do Gestor</Label>
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-2 bg-white flex flex-col items-center">
        <canvas
          ref={canvasRef}
          width={500}
          height={200}
          style={{ touchAction: 'none' }} // Crucial para mobile
          className="border border-slate-200 rounded cursor-crosshair w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <div className="flex gap-2 mt-2 w-full">
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