import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function QRScanner({ onScan, active = true, placeholder = "Posicione o código QR na câmera" }) {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  const startScanning = async () => {
    try {
      setError(null);
      setScanning(true);
      
      // Aguarda o próximo frame para garantir que o DOM está pronto
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8]
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          const scannedCode = decodedText?.trim() || '';
          
          if (scannedCode && scannedCode !== lastScan) {
            setLastScan(scannedCode);
            toast.success(`Código lido: ${scannedCode}`);
            onScan(scannedCode);
            setTimeout(() => setLastScan(null), 2000);
          }
        },
        () => {} // Ignora erros de scan
      );
    } catch (err) {
      console.error('Erro ao iniciar scanner:', err);
      const errorMsg = err.name === 'NotAllowedError' 
        ? 'Permissão de câmera negada' 
        : err.name === 'NotFoundError'
        ? 'Nenhuma câmera encontrada'
        : 'Erro ao acessar câmera';
      setError(errorMsg);
      setScanning(false);
      toast.error(errorMsg);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Erro ao parar:', err);
      }
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {/* Elemento sempre presente no DOM */}
        <div 
          id="qr-reader" 
          style={{ display: scanning ? 'block' : 'none' }}
          className="w-full"
        />
        
        {!scanning && !error && (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50">
            <Camera className="h-16 w-16 text-slate-400 mb-4" />
            <p className="text-sm text-slate-600 text-center">{placeholder}</p>
            <Button onClick={startScanning} className="mt-4">
              <Camera className="h-4 w-4 mr-2" />
              Iniciar Scanner
            </Button>
          </div>
        )}

        {scanning && lastScan && (
          <div className="absolute top-4 left-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-10">
            ✓ Lido: {lastScan}
          </div>
        )}
        
        {scanning && (
          <div className="p-4 bg-slate-50 border-t">
            <Button onClick={stopScanning} variant="outline" className="w-full">
              <CameraOff className="h-4 w-4 mr-2" />
              Parar Scanner
            </Button>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-8 bg-red-50">
            <CameraOff className="h-16 w-16 text-red-400 mb-4" />
            <p className="text-sm text-red-600 text-center mb-4">{error}</p>
            <Button onClick={startScanning} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}