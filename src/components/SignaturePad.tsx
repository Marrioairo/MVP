import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Check } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  onSave: (signatureDataUrl: string) => void;
  disabled?: boolean;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ label, onSave, disabled = false }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set actual size in memory (scaled to account for extra pixel density if needed)
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#000000';
      }
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || isSaved) return;
    
    // Prevent default scrolling on touch devices
    if ('touches' in e) {
       // Only prevent default if it's a touch event to avoid breaking mouse clicks
       // e.preventDefault() can't be called directly in passive event listeners,
       // React's synthetic events handle this OK usually, but we handle the pure drawing.
    }
    
    setIsDrawing(true);
    setHasSignature(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || isSaved) return;
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    if (disabled || isSaved) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      setIsSaved(false);
    }
  };

  const save = () => {
    if (!hasSignature || disabled || isSaved) return;
    
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setIsSaved(true);
      onSave(dataUrl);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-sm font-bold text-neutral-700 uppercase">{label}</label>
        {!disabled && !isSaved && hasSignature && (
            <button 
              onClick={clear}
              className="text-xs text-neutral-400 hover:text-red-500 flex items-center gap-1 font-bold"
            >
              <Trash2 className="h-3 w-3" /> {t("clear") || "Clear"}
            </button>
        )}
      </div>
      
      <div className={`relative border-2 rounded-xl overflow-hidden bg-neutral-50 ${isSaved ? 'border-emerald-500 bg-emerald-50/30' : 'border-neutral-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-32 cursor-crosshair touch-none"
        />
        
        {isSaved && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
                <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                    <Check className="h-6 w-6" />
                </div>
            </div>
        )}
      </div>
      
      {!disabled && !isSaved && hasSignature && (
          <button 
            onClick={save}
            className="w-full py-2 bg-neutral-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-colors"
          >
            {t("confirm_signature") || "Confirm Signature"}
          </button>
      )}
    </div>
  );
};

export default SignaturePad;
