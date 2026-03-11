import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ShotData {
  x: number;
  y: number;
  type: string;
  made: boolean;
}

interface ShotHeatmapProps {
  shots: ShotData[];
}

const ShotHeatmap: React.FC<ShotHeatmapProps> = ({ shots }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 flex flex-col items-center">
        <h3 className="font-black text-xl text-neutral-900 mb-6 uppercase tracking-wider">{t("team_shot_chart") || "Team Shot Chart & Heatmap"}</h3>
        
        {/* Half Court Graphic */}
        <div className="relative w-full max-w-[400px] h-[300px] border-b-4 border-neutral-300 bg-neutral-50 overflow-hidden">
            
            {/* The Court Lines */}
            <div className="absolute bottom-0 w-full h-full border-4 border-orange-200 rounded-t-[200px] flex items-end justify-center pb-4 box-border">
                {/* Paint / Key */}
                <div className="w-[160px] h-[190px] border-4 border-orange-200 bg-orange-50/50 flex items-start justify-center pt-4 box-border relative">
                    <div className="absolute -top-[60px] w-[120px] h-[120px] border-4 border-orange-200 rounded-full border-b-transparent" />
                    <div className="absolute -top-[60px] w-[120px] h-[120px] border-4 border-dashed border-orange-200 rounded-full border-t-transparent opacity-50" />
                </div>
                <div className="absolute bottom-[30px] w-[60px] h-[4px] bg-orange-400 rounded-full shadow-lg" />
                <div className="absolute bottom-[34px] w-[16px] h-[16px] border-4 border-orange-500 rounded-full bg-orange-100" />
            </div>

            {/* Shots Plotting */}
            {shots.map((shot, idx) => (
                <div 
                    key={idx}
                    className={`absolute w-3 h-3 rounded-full opacity-80 transform -translate-x-1/2 translate-y-1/2 transition-all ${shot.type === '3PT' ? 'bg-emerald-500' : 'bg-blue-500'} ${!shot.made ? 'bg-red-500 opacity-60' : 'shadow-md shadow-black/20 z-10'}`}
                    style={{ 
                        left: `${shot.x}%`, 
                        bottom: `${shot.y}%` 
                    }}
                    title={`${shot.type}`}
                />
            ))}
            
            {shots.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-neutral-400 z-20">
                    {t("no_shot_data") || "No shot location data available yet."}
                </div>
            )}
        </div>

        {/* Legend */}
        <div className="flex gap-6 mt-6 text-xs font-bold text-neutral-500">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> 2PT / Paint</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> 3PT</div>
        </div>
    </div>
  );
};

export default ShotHeatmap;
