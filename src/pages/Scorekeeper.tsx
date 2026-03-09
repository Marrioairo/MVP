import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, Save, FileJson, FileText, AlertCircle, Plus } from "lucide-react";

interface Player { id: string; name: string; number: string; position: string; isStarter: boolean; }
interface MatchEvent { type: string; playerId: string; playerName?: string; team: "home" | "away"; quarter: number; time: string; timestamp: any; }

const Scorekeeper: React.FC = () => {
  const { user } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [quarter] = useState(1);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  
  // Roster (12 players per team, 5 starters)
  const [homePlayers] = useState<Player[]>([
    { id: "h1", name: "J. Smith", number: "1", position: "PG", isStarter: true }, { id: "h2", name: "A. Johnson", number: "2", position: "SG", isStarter: true },
    { id: "h3", name: "M. Brown", number: "3", position: "SF", isStarter: true }, { id: "h4", name: "D. Davis", number: "4", position: "PF", isStarter: true },
    { id: "h5", name: "K. Thompson", number: "5", position: "C", isStarter: true }, { id: "h6", name: "T. Young", number: "11", position: "G", isStarter: false },
    { id: "h7", name: "R. Gobert", number: "27", position: "C", isStarter: false }, { id: "h8", name: "C. Paul", number: "33", position: "G", isStarter: false },
    { id: "h9", name: "D. Booker", number: "10", position: "SG", isStarter: false }, { id: "h10", name: "B. Adebayo", number: "13", position: "C", isStarter: false },
    { id: "h11", name: "J. Tatum", number: "0", position: "F", isStarter: false }, { id: "h12", name: "J. Brown", number: "7", position: "G", isStarter: false }
  ]);
  const [awayPlayers] = useState<Player[]>([
    { id: "a1", name: "L. James", number: "6", position: "F", isStarter: true }, { id: "a2", name: "S. Curry", number: "30", position: "G", isStarter: true },
    { id: "a3", name: "K. Durant", number: "7", position: "F", isStarter: true }, { id: "a4", name: "N. Jokic", number: "15", position: "C", isStarter: true },
    { id: "a5", name: "L. Doncic", number: "77", position: "G", isStarter: true },{ id: "a6", name: "G. Anteto", number: "34", position: "F", isStarter: false },
    { id: "a7", name: "J. Embiid", number: "21", position: "C", isStarter: false }, { id: "a8", name: "A. Davis", number: "3", position: "F", isStarter: false },
    { id: "a9", name: "S. Gilgeous", number: "2", position: "G", isStarter: false }, { id: "a10", name: "J. Morant", number: "12", position: "G", isStarter: false },
    { id: "a11", name: "K. Leonard", number: "2", position: "F", isStarter: false }, { id: "a12", name: "P. George", number: "13", position: "F", isStarter: false }
  ]);

  // New Flow: Action -> Ask Player
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isRunning && timeLeft > 0) { timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000); } 
    else { clearInterval(timerRef.current); }
    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  const handleActionClick = (type: string) => {
    setPendingAction(type); // Abre el popup de jugadores
  };

  const confirmEvent = async (player: Player, team: "home" | "away") => {
    if (!pendingAction || !user) return;

    const newEvent: MatchEvent = { 
        type: pendingAction, 
        playerId: player.id, 
        playerName: player.name, 
        team, 
        quarter, 
        time: formatTime(timeLeft), 
        timestamp: Timestamp.now() 
    };
    
    setEvents((prev) => [newEvent, ...prev]);
    setPendingAction(null);

    // Guardado local (activa la IA Reactiva en el backend)
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvent, matchId }),
      });
    } catch (e) { console.error("Sync error:", e); }

    if (matchId) await addDoc(collection(db, "matches", matchId, "events"), newEvent);
  };

  const calculateScore = (team: "home" | "away") => events.filter((e) => e.team === team).reduce((acc, e) => {
    if (["1PT", "FTM"].includes(e.type)) return acc + 1;
    if (["2PT", "DNK"].includes(e.type)) return acc + 2;
    if (e.type === "3PT") return acc + 3;
    return acc;
  }, 0);

  const statsList = [
      { id: "1PT", label: "+1 FT", color: "bg-emerald-500" },
      { id: "2PT", label: "+2 FG", color: "bg-emerald-500" },
      { id: "3PT", label: "+3 FG", color: "bg-emerald-500" },
      { id: "DNK", label: "DUNK", color: "bg-emerald-600" },
      { id: "AST", label: "AST", color: "bg-indigo-500" },
      { id: "OREB", label: "O-REB", color: "bg-blue-500" },
      { id: "DREB", label: "D-REB", color: "bg-blue-600" },
      { id: "STL", label: "STL", color: "bg-indigo-600" },
      { id: "BLK", label: "BLK", color: "bg-indigo-700" },
      { id: "TOV", label: "TOV", color: "bg-red-500" },
      { id: "PF", label: "FOUL", color: "bg-red-600" },
      { id: "TF", label: "T.FOUL", color: "bg-red-700" },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-neutral-100">
      
      {/* Panel Izquierdo: ROSTER (Home & Away) */}
      <aside className="w-80 border-r border-neutral-200 bg-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
                <h2 className="text-sm font-black text-orange-600 uppercase tracking-wider mb-3">Home Roster</h2>
                <div className="mb-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Starters (5)</span>
                    {homePlayers.filter(p => p.isStarter).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">{p.number}</span><span className="text-sm font-medium">{p.name}</span><span className="text-[10px] text-neutral-400 ml-auto">{p.position}</span></div>
                    ))}
                </div>
                <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Bench (7)</span>
                    {homePlayers.filter(p => !p.isStarter).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">{p.number}</span><span className="text-sm text-neutral-500">{p.name}</span></div>
                    ))}
                </div>
            </div>
            <div className="border-t border-neutral-100 pt-6">
                <h2 className="text-sm font-black text-blue-600 uppercase tracking-wider mb-3">Away Roster</h2>
                <div className="mb-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Starters (5)</span>
                    {awayPlayers.filter(p => p.isStarter).map(p => (
                        <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">{p.number}</span><span className="text-sm font-medium">{p.name}</span><span className="text-[10px] text-neutral-400 ml-auto">{p.position}</span></div>
                    ))}
                </div>
            </div>
        </div>
      </aside>

      {/* Panel Central: Court & Timeline */}
      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <div className="bg-neutral-900 px-6 py-4 text-white shadow-md flex justify-between items-center z-10">
          <div className="text-center"><div className="text-[10px] font-bold text-neutral-400 uppercase">Home</div><div className="text-4xl font-black">{calculateScore("home")}</div></div>
          <div className="flex flex-col items-center">
            <div className="text-4xl font-black tracking-tighter mb-2">{formatTime(timeLeft)}</div>
            <div className="flex gap-2">
              <button onClick={() => setIsRunning(!isRunning)} className="bg-orange-600 p-2 rounded-full">{isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}</button>
              <button onClick={() => { setTimeLeft(600); setIsRunning(false); }} className="bg-neutral-700 p-2 rounded-full"><RotateCcw className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="text-center"><div className="text-[10px] font-bold text-neutral-400 uppercase">Away</div><div className="text-4xl font-black">{calculateScore("away")}</div></div>
        </div>

        {/* Half Court Graphic */}
        <div className="h-64 border-b border-neutral-200 bg-white relative flex items-center justify-center overflow-hidden">
            <div className="absolute bottom-0 w-[400px] h-[300px] border-4 border-orange-200 rounded-t-full flex items-end justify-center pb-4">
                <div className="w-[160px] h-[190px] border-4 border-orange-200 bg-orange-50 flex items-start justify-center pt-4">
                    <div className="w-[120px] h-[120px] border-4 border-orange-200 rounded-full" />
                </div>
                <div className="absolute bottom-4 w-[60px] h-[10px] bg-orange-400 rounded-full shadow-lg" />
            </div>
            <span className="absolute top-4 left-4 text-xs font-bold text-neutral-300 uppercase tracking-widest">Offensive Half</span>
        </div>

        {/* Game Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">Game Timeline</h3>
            <div className="space-y-3">
                <AnimatePresence>
                    {events.map((e, i) => (
                        <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1,y:0}} key={i} className="flex gap-4 items-center bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                            <span className="text-xs font-mono text-neutral-400 font-bold">{e.time}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${e.team === 'home' ? 'bg-orange-500' : 'bg-blue-500'}`}>{e.team === 'home' ? 'HOME' : 'AWAY'}</span>
                            <span className="text-sm"><span className="font-bold text-neutral-900">{e.playerName}</span> • <span className="font-bold text-orange-600">{e.type}</span></span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {events.length === 0 && <div className="text-center py-10 text-neutral-400 text-sm">Waiting for tip-off...</div>}
            </div>
        </div>
      </main>

      {/* Panel Derecho: Stat Buttons */}
      <aside className="w-[320px] border-l border-neutral-200 bg-white p-6 overflow-y-auto flex flex-col">
        <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider mb-6">Record Action</h3>
        <div className="grid grid-cols-2 gap-3">
            {statsList.map(stat => (
                <button 
                  key={stat.id} 
                  onClick={() => handleActionClick(stat.id)}
                  className={`flex items-center justify-center p-4 rounded-xl text-white font-black shadow-md transition-transform active:scale-95 hover:brightness-110 ${stat.color}`}
                >
                    {stat.label}
                </button>
            ))}
        </div>
        <div className="mt-auto pt-8 flex gap-2">
            <button className="flex-1 rounded-xl bg-neutral-900 text-white text-sm font-bold py-3">Finish Game</button>
        </div>
      </aside>

      {/* Popup: "Who performed this?" */}
      {pendingAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl">
                  <h3 className="text-2xl font-black text-center mb-8">Who recorded <span className="text-orange-600">{pendingAction}</span>?</h3>
                  <div className="grid grid-cols-2 gap-8">
                      <div>
                          <h4 className="text-center font-bold text-orange-600 mb-4 bg-orange-50 py-2 rounded-lg">HOME</h4>
                          <div className="grid grid-cols-2 gap-2">
                              {homePlayers.filter(p => p.isActive !== false).map(p => (
                                  <button key={p.id} onClick={() => confirmEvent(p, "home")} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-orange-500 hover:bg-orange-50 transition-colors text-sm font-bold">
                                      {p.number} - {p.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <h4 className="text-center font-bold text-blue-600 mb-4 bg-blue-50 py-2 rounded-lg">AWAY</h4>
                          <div className="grid grid-cols-2 gap-2">
                              {awayPlayers.filter(p => p.isActive !== false).map(p => (
                                  <button key={p.id} onClick={() => confirmEvent(p, "away")} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-bold">
                                      {p.number} - {p.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="mt-8 flex justify-center">
                      <button onClick={() => setPendingAction(null)} className="px-6 py-2 rounded-full border border-neutral-300 font-bold text-neutral-500 hover:bg-neutral-100">Cancel</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Scorekeeper;
