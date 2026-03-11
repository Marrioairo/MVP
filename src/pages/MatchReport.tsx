import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SignaturePad from '../components/SignaturePad';
import { CheckCircle, Download } from 'lucide-react';

interface MatchReportProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  onClose: () => void;
  onSignaturesComplete: (signatures: { referee: string; homeCaptain: string; awayCaptain: string }) => void;
}

const MatchReport: React.FC<MatchReportProps> = ({ 
    matchId, homeTeam, awayTeam, homeScore, awayScore, onClose, onSignaturesComplete 
}) => {
  const { t } = useTranslation();
  const [refSignature, setRefSignature] = useState<string | null>(null);
  const [homeSignature, setHomeSignature] = useState<string | null>(null);
  const [awaySignature, setAwaySignature] = useState<string | null>(null);

  const isFullySigned = refSignature && homeSignature && awaySignature;

  const handleFinalize = () => {
      if (isFullySigned) {
          onSignaturesComplete({
              referee: refSignature,
              homeCaptain: homeSignature,
              awayCaptain: awaySignature
          });
      }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-100 overflow-y-auto">
      <div className="max-w-4xl mx-auto min-h-screen bg-white shadow-2xl flex flex-col">
        
        {/* Header (Acta Oficial style) */}
        <header className="bg-neutral-900 text-white p-8 text-center relative">
            <h1 className="text-3xl font-black uppercase tracking-widest mb-2">{t("digital_scoresheet") || "Official Digital Scoresheet"}</h1>
            <p className="font-mono text-neutral-400">MATCH ID: {matchId}</p>
            <button onClick={onClose} className="absolute top-8 right-8 text-neutral-400 hover:text-white font-bold">{t("close") || "Close"}</button>
        </header>

        {/* Final Score Section */}
        <section className="p-12 border-b border-neutral-100">
            <div className="flex justify-between items-center max-w-2xl mx-auto">
                <div className="text-center w-1/3">
                    <h2 className="text-xl font-black text-orange-600 uppercase truncate px-2">{homeTeam}</h2>
                    <div className="text-7xl font-black mt-4">{homeScore}</div>
                </div>
                <div className="text-neutral-300 font-bold text-2xl">FINAL</div>
                <div className="text-center w-1/3">
                    <h2 className="text-xl font-black text-blue-600 uppercase truncate px-2">{awayTeam}</h2>
                    <div className="text-7xl font-black mt-4">{awayScore}</div>
                </div>
            </div>
        </section>

        {/* Signatures Section */}
        <section className="p-12 flex-1 bg-neutral-50">
            <h3 className="text-xl font-black uppercase mb-8 text-center text-neutral-800">{t("official_signatures") || "Official Signatures"}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <SignaturePad 
                    label={t("referee_signature") || "Lead Referee"} 
                    onSave={setRefSignature} 
                    disabled={!!refSignature} 
                />
                <SignaturePad 
                    label={`${homeTeam} ${t("captain") || "Captain"}`} 
                    onSave={setHomeSignature} 
                    disabled={!!homeSignature} 
                />
                <SignaturePad 
                    label={`${awayTeam} ${t("captain") || "Captain"}`} 
                    onSave={setAwaySignature} 
                    disabled={!!awaySignature} 
                />
            </div>

            <div className="mt-16 flex justify-center">
                <button 
                  onClick={handleFinalize}
                  disabled={!isFullySigned}
                  className={`flex items-center gap-3 px-12 py-4 rounded-full text-lg font-black transition-all ${isFullySigned ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105 shadow-xl shadow-emerald-500/20' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}
                >
                    <CheckCircle className="h-6 w-6" />
                    {t("lock_and_submit") || "Lock & Submit Scoresheet"}
                </button>
            </div>
        </section>

      </div>
    </div>
  );
};

export default MatchReport;
