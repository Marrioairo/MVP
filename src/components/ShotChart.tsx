import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ShotChartProps {
  onCoordinateSelected: (coordinates: { x: number; y: number } | null) => void;
  isCourtActive: boolean;
  actionType?: string | null;
}

const ShotChart: React.FC<ShotChartProps> = ({ onCoordinateSelected, isCourtActive, actionType }) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number } | null>(null);

  // Reset selected point when action changes or court becomes inactive
  useEffect(() => {
    if (!isCourtActive) {
      setSelectedPoint(null);
    }
  }, [isCourtActive, actionType]);

  const handleCourtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCourtActive || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate relative percentages (0 to 100) instead of absolute pixels for responsiveness
    // x: 0 is left sideline, 100 is right sideline
    // y: 0 is baseline (hoop side), 100 is halfcourt line
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    
    // Invert Y so that 0 is the baseline at the bottom of our graphic
    let y = 100 - (((e.clientY - rect.top) / rect.height) * 100);

    // Keep within bounds
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    const coords = { x, y };
    setSelectedPoint(coords);
    onCoordinateSelected(coords);
  };

  return (
    <div className={`relative w-full h-full min-h-[250px] border-b border-neutral-200 bg-white flex flex-col items-center overflow-hidden transition-all ${isCourtActive ? 'ring-4 ring-orange-500 ring-inset cursor-crosshair' : ''}`}>
        
        {/* Banner Instruccional Activo */}
        {isCourtActive && (
             <div className="absolute top-0 inset-x-0 bg-orange-600 text-white text-xs font-bold text-center py-2 z-20 animate-pulse">
                 {t("select_shot_location") || "TAP COURT TO SELECT SHOT LOCATION"}
             </div>
        )}
        
        {/* Etiqueta default */}
        {!isCourtActive && (
            <span className="absolute top-4 left-4 text-xs font-bold text-neutral-300 uppercase tracking-widest z-20">{t("offensive_half")}</span>
        )}

        {/* Half Court Graphic container (Clickable Area) */}
        <div 
           ref={containerRef}
           onClick={handleCourtClick}
           className="relative w-[400px] h-[300px] mt-auto"
        >
            {/* The Court Lines */}
            <div className="absolute bottom-0 w-full h-full border-4 border-orange-200 rounded-t-[200px] flex items-end justify-center pb-4 box-border">
                {/* Paint / Key */}
                <div className="w-[160px] h-[190px] border-4 border-orange-200 bg-orange-50 flex items-start justify-center pt-4 box-border relative">
                    {/* Free throw circle (top half) */}
                    <div className="absolute -top-[60px] w-[120px] h-[120px] border-4 border-orange-200 rounded-full border-b-transparent" />
                    {/* Free throw circle (bottom dashed half inside paint) */}
                    <div className="absolute -top-[60px] w-[120px] h-[120px] border-4 border-dashed border-orange-200 rounded-full border-t-transparent opacity-50" />
                </div>
                {/* Backboard & Hoop */}
                <div className="absolute bottom-[30px] w-[60px] h-[4px] bg-orange-400 rounded-full shadow-lg" />
                <div className="absolute bottom-[34px] w-[16px] h-[16px] border-4 border-orange-500 rounded-full bg-orange-100" />
            </div>

            {/* Selected Point Marker */}
            {selectedPoint && (
                <div 
                    className="absolute w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-md z-30 transform -translate-x-1/2 translate-y-1/2 transition-all duration-200"
                    style={{ 
                        left: `${selectedPoint.x}%`, 
                        // Convert internal Y (0 at baseline) back to pixels for rendering (0 at top)
                        bottom: `${selectedPoint.y}%` 
                    }}
                />
            )}
        </div>
    </div>
  );
};

export default ShotChart;
