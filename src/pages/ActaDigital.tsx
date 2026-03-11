import React, { useRef, useState } from "react";
import { motion } from "motion/react";
import { Download, PenLine, CheckCircle, X } from "lucide-react";

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  isStarter: boolean;
}

interface MatchEvent {
  type: string;
  playerId: string;
  playerName: string;
  team: "home" | "away";
  quarter: number;
  time: string;
  timestamp: number;
}

interface ActaDigitalProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homePlayers: Player[];
  awayPlayers: Player[];
  events: MatchEvent[];
  modality: string;
  category: string;
  onClose: () => void;
}

const ActaDigital: React.FC<ActaDigitalProps> = ({
  matchId, homeTeam, awayTeam, homeScore, awayScore,
  homePlayers, awayPlayers, events, modality, category, onClose
}) => {
  const actaRef = useRef<HTMLDivElement>(null);
  const [signatures, setSignatures] = useState({ referee: "", homeCaptain: "", awayCaptain: "" });
  const [isSigned, setIsSigned] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Calculate per-player stats
  const getPlayerStats = (playerId: string) => {
    const playerEvents = events.filter(e => e.playerId === playerId);
    const pts = playerEvents.reduce((acc, e) => {
      if (["1PT", "FTM"].includes(e.type)) return acc + 1;
      if (["2PT", "DNK"].includes(e.type)) return acc + 2;
      if (e.type === "3PT") return acc + 3;
      return acc;
    }, 0);
    const fouls = playerEvents.filter(e => ["PF", "TF", "U", "D", "GD", "FF"].includes(e.type)).length;
    const ast = playerEvents.filter(e => e.type === "AST").length;
    const reb = playerEvents.filter(e => ["OREB", "DREB"].includes(e.type)).length;
    return { pts, fouls, ast, reb };
  };

  const exportToImage = async () => {
    if (!actaRef.current) return;
    setExporting(true);
    try {
      // Dynamically import html2canvas to keep bundle size in check
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(actaRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `acta_${homeTeam}_vs_${awayTeam}_${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export falló. Asegúrate de tener conexión o copia la pantalla manualmente.");
    } finally {
      setExporting(false);
    }
  };

  const renderPlayerTable = (players: Player[], team: "home" | "away") => (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-neutral-100 text-neutral-500 uppercase text-[10px] tracking-widest">
          <th className="border border-neutral-200 p-1.5 w-6">#</th>
          <th className="border border-neutral-200 p-1.5 text-left">Jugador</th>
          <th className="border border-neutral-200 p-1.5 w-8">POS</th>
          <th className="border border-neutral-200 p-1.5 w-8">PTS</th>
          <th className="border border-neutral-200 p-1.5 w-8">AST</th>
          <th className="border border-neutral-200 p-1.5 w-8">REB</th>
          <th className="border border-neutral-200 p-1.5 w-8">F1</th>
          <th className="border border-neutral-200 p-1.5 w-8">F2</th>
          <th className="border border-neutral-200 p-1.5 w-8">F3</th>
          <th className="border border-neutral-200 p-1.5 w-8">F4</th>
          <th className="border border-neutral-200 p-1.5 w-8">F5</th>
          <th className="border border-neutral-200 p-1.5 w-8">TOT</th>
        </tr>
      </thead>
      <tbody>
        {players.map(p => {
          const stats = getPlayerStats(p.id);
          const foulCells = Array.from({ length: 5 }, (_, i) => i < stats.fouls);
          return (
            <tr key={p.id} className={`${p.isStarter ? "font-bold" : "text-neutral-500"} hover:bg-neutral-50`}>
              <td className="border border-neutral-200 p-1.5 text-center font-mono">{p.number}</td>
              <td className="border border-neutral-200 p-1.5">
                {p.name}
                {p.isStarter && <span className="ml-1 text-[9px] text-orange-500 font-black uppercase">★</span>}
              </td>
              <td className="border border-neutral-200 p-1.5 text-center text-neutral-400">{p.position}</td>
              <td className="border border-neutral-200 p-1.5 text-center font-black">{stats.pts || "-"}</td>
              <td className="border border-neutral-200 p-1.5 text-center">{stats.ast || "-"}</td>
              <td className="border border-neutral-200 p-1.5 text-center">{stats.reb || "-"}</td>
              {foulCells.map((filled, i) => (
                <td key={i} className="border border-neutral-200 p-1.5 text-center">
                  {filled ? <span className="text-red-600 font-black">✕</span> : ""}
                </td>
              ))}
              <td className="border border-neutral-200 p-1.5 text-center font-bold text-red-600">{stats.fouls > 0 ? stats.fouls : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Export Controls */}
        <div className="flex items-center justify-between px-8 py-4 bg-neutral-900 text-white">
          <div className="flex items-center gap-3">
            <PenLine className="h-5 w-5 text-orange-400" />
            <span className="font-black text-lg uppercase tracking-widest">Acta Digital Oficial</span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-sm font-bold">{modality}</span>
            {category !== "Libre" && <span className="px-3 py-1 rounded-full bg-orange-600/70 text-sm font-bold">{category}</span>}
          </div>
          <div className="flex gap-3">
            <button onClick={exportToImage} disabled={exporting} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30 disabled:opacity-50">
              {exporting ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exportando..." : "Exportar PNG"}
            </button>
            <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/20 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Acta */}
        <div ref={actaRef} className="p-8 bg-white">
          {/* Header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-neutral-900">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Hoja de Anotación Oficial — Antigravity Platform</div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-neutral-900 mb-1">{homeTeam} vs {awayTeam}</h1>
            <div className="flex items-center justify-center gap-4 text-sm text-neutral-500">
              <span>Modalidad: <b className="text-neutral-900">{modality}</b></span>
              <span>Categoría: <b className="text-neutral-900">{category}</b></span>
              <span>Fecha: <b className="text-neutral-900">{new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</b></span>
              <span className="text-[10px] text-neutral-300">ID: {matchId.slice(0, 8)}</span>
            </div>
          </div>

          {/* Scoreline */}
          <div className="grid grid-cols-3 gap-4 mb-8 text-center">
            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
              <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">{homeTeam} (Local)</div>
              <div className="text-5xl font-black text-orange-600">{homeScore}</div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="text-2xl font-black text-neutral-300">—</div>
              <div className="text-xs text-neutral-400 font-bold uppercase mt-1">Final</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <div className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">{awayTeam} (Visita)</div>
              <div className="text-5xl font-black text-blue-600">{awayScore}</div>
            </div>
          </div>

          {/* Roster Tables */}
          <div className="grid grid-cols-1 gap-6 mb-8">
            <div>
              <h3 className="font-black text-orange-600 uppercase text-sm tracking-wide mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-600 inline-block" /> {homeTeam} — Plantilla
              </h3>
              {renderPlayerTable(homePlayers, "home")}
            </div>
            <div>
              <h3 className="font-black text-blue-600 uppercase text-sm tracking-wide mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> {awayTeam} — Plantilla
              </h3>
              {renderPlayerTable(awayPlayers, "away")}
            </div>
          </div>

          {/* Signatures */}
          <div className="border-t-2 border-neutral-900 pt-6 grid grid-cols-3 gap-6">
            {([
              { key: "referee", label: "Árbitro Principal" },
              { key: "homeCaptain", label: `Capitán — ${homeTeam}` },
              { key: "awayCaptain", label: `Capitán — ${awayTeam}` },
            ] as const).map(({ key, label }) => (
              <div key={key} className="text-center">
                <div className="border-b-2 border-neutral-900 mb-2 h-16 flex items-end justify-center">
                  {signatures[key] ? (
                    <span className="font-bold text-lg pb-1 text-neutral-700 italic">{signatures[key]}</span>
                  ) : (
                    <input
                      className="w-full border-none outline-none text-center font-bold italic text-lg text-neutral-400 bg-transparent pb-1"
                      placeholder="Firma aquí..."
                      onChange={e => setSignatures(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  )}
                </div>
                <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {/* Validity stamp */}
          {signatures.referee && signatures.homeCaptain && signatures.awayCaptain && (
            <div className="mt-6 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 rounded-xl py-3 border border-emerald-200">
              <CheckCircle className="h-5 w-5" />
              <span className="font-black text-sm uppercase tracking-wide">Acta Validada — {new Date().toLocaleString("es-MX")}</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-[9px] text-neutral-300 font-mono uppercase tracking-widest">
            Generado por Antigravity Platform · HoopsAI · Acta Oficial Partido {matchId}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ActaDigital;
