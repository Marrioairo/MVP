import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, RotateCcw, Save, FileJson, FileText, AlertCircle, Plus, Settings, UserPlus, X, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { logEvent, MatchEvent } from "../lib/offlineSync";
import MatchReport from "./MatchReport";
import ShotChart from "../components/ShotChart";
import ActaDigital from "./ActaDigital";

interface Player { id: string; name: string; number: string; position: string; isStarter: boolean; }

const Scorekeeper: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initMatchId = searchParams.get("matchId");
  const navigate = useNavigate();

  const [matchId, setMatchId] = useState<string | null>(null);
  const [quarter, setQuarter] = useState(1);
  const [timeLeft, setTimeLeft] = useState(600); // will be overridden by match doc
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeTeamName, setHomeTeamName] = useState("Home Team");
  const [awayTeamName, setAwayTeamName] = useState("Away Team");
  
  // Modality Rules
  const [modality, setModality] = useState<string>("5x5 FIBA");
  const [category, setCategory] = useState<string>("Libre");
  // Dynamic Period Engine
  const [numPeriods, setNumPeriods] = useState<number>(4);
  const [periodMinutes, setPeriodMinutes] = useState<number>(10);
  
  // Substitution State
  const [subTeam, setSubTeam] = useState<"home" | "away">("home");
  const [subIn, setSubIn] = useState<Player | null>(null);
  const [subOut, setSubOut] = useState<Player | null>(null);

  // New Flow: Action -> Ask Player
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [shotCoordinates, setShotCoordinates] = useState<{ x: number, y: number } | null>(null);

  const isCourtActive = pendingAction !== null && ['1PT', '2PT', '3PT'].includes(pendingAction) && !shotCoordinates;

  // Match Report & Signature State
  const [showMatchReport, setShowMatchReport] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [gameReport, setGameReport] = useState<string | null>(null);
  const [showActa, setShowActa] = useState(false);

  const timerRef = useRef<any>(null);

  const playBuzzer = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) { 
      timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000); 
    } else { 
      clearInterval(timerRef.current); 
      if (isRunning && timeLeft === 0) {
        setIsRunning(false);
        playBuzzer();
      }
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (!user || !initMatchId) {
      if (!initMatchId) navigate("/create-game");
      return;
    }
    const fetchMatch = async () => {
      const docRef = doc(db, "matches_v2", initMatchId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMatchId(docSnap.id);
        setHomeTeamName(data.homeTeamName || "Home Team");
        setAwayTeamName(data.awayTeamName || "Away Team");
        setHomePlayers(data.homePlayers || []);
        setAwayPlayers(data.awayPlayers || []);
        if (data.modality) setModality(data.modality);
        if (data.category) setCategory(data.category);
        // Load period config from match document
        const nP = data.numPeriods || 4;
        const pM = data.periodMinutes || 10;
        setNumPeriods(nP);
        setPeriodMinutes(pM);
        setTimeLeft(pM * 60); // Set clock to the configured period length
      } else {
        alert("Match not found");
        navigate("/create-game");
      }
    };
    fetchMatch();
  }, [user, initMatchId, navigate]);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  const handleActionClick = (type: string) => {
    if (modality === "3x3 Relámpago" && type === "3PT") {
        return alert("En 3x3 no existe línea de 3 puntos. Utiliza +1 o +2.");
    }
    setPendingAction(type);
    setShotCoordinates(null);
    if (type === "SUB") {
       setSubTeam("home");
       setSubIn(null);
       setSubOut(null);
    }
  };

  const confirmEvent = async (player: Player, team: "home" | "away") => {
    if (!pendingAction || !user || !matchId) return;

    // Validation: 5 Foul Limit
    let foulWeight = 0;
    if (pendingAction === "PF") foulWeight = 1;
    if (["TF", "U", "D", "GD"].includes(pendingAction)) foulWeight = 2; // Techs/Unsportsmanlike count heavily towards ejection

    if (foulWeight > 0) {
        const currentFouls = events.filter(e => e.playerId === player.id && ["PF", "TF", "U", "D", "GD", "FF"].includes(e.type)).reduce((acc, curr) => {
            if (["TF", "U", "D", "GD"].includes(curr.type)) return acc + 2;
            return acc + 1;
        }, 0);

        if (currentFouls >= 5 || (currentFouls + foulWeight > 5)) {
            alert(t("player_fouled_out") || "Player has fouled out (5 fouls) or committed a disqualifying foul. Cannot record more actions. Substitute immediately.");
            setPendingAction(null);
            return;
        }
    }

    const eventData = { 
        type: pendingAction, 
        playerId: player.id, 
        playerName: player.name, 
        team, 
        quarter, 
        time: formatTime(timeLeft), 
        timestamp: Date.now(),
        ...(shotCoordinates ? { coordinates: shotCoordinates } : {})
    };

    try {
        const savedEvent = await logEvent(eventData as Omit<MatchEvent, 'id' | 'synced'>);
        
        // Calculate the immediately new score to sync with DB as requested
        let pointsToAdd = 0;
        if (["1PT", "FTM"].includes(pendingAction)) pointsToAdd = 1;
        if (["2PT", "DNK"].includes(pendingAction)) pointsToAdd = 2;
        if (pendingAction === "3PT") pointsToAdd = 3;

        setEvents((prev) => {
          const newEvents = [savedEvent, ...prev];
          
          // If points were scored, immediately update the match document
          if (pointsToAdd > 0) {
              const newScore = newEvents.filter((e) => e.team === team).reduce((acc, e) => {
                  if (["1PT", "FTM"].includes(e.type)) return acc + 1;
                  if (["2PT", "DNK"].includes(e.type)) return acc + 2;
                  if (e.type === "3PT") return acc + 3;
                  return acc;
              }, 0);
              
              // 3x3 Sudden Death logic
              if (modality === "3x3 Relámpago" && newScore >= 21) {
                  setIsRunning(false);
                  playBuzzer();
                  alert(`¡${team === 'home' ? homeTeamName : awayTeamName} GANA POR REGLA DE 21 PUNTOS (SUDDEN DEATH)!`);
              }
              
              updateDoc(doc(db, "matches_v2", matchId), {
                  [team === "home" ? "homeScore" : "awayScore"]: newScore
              }).catch((err: any) => console.error("Score sync failed", err));
          }
          
          return newEvents;
        });

    } catch (e) {
        console.error("Local save failed", e);
    }

    setPendingAction(null);
    setShotCoordinates(null);
  };

  const confirmSub = async () => {
    if (!subIn || !subOut || !matchId) return;
    
    const arr = subTeam === "home" ? homePlayers : awayPlayers;
    const updated = arr.map(p => {
       if (p.id === subIn.id) return { ...p, isStarter: true };
       if (p.id === subOut.id) return { ...p, isStarter: false };
       return p;
    });

    if (subTeam === "home") setHomePlayers(updated);
    else setAwayPlayers(updated);

    const eventData = { 
        type: "SUB", 
        playerId: subIn.id, 
        playerName: `${subIn.name} IN, ${subOut.name} OUT`, 
        team: subTeam, 
        quarter, 
        time: formatTime(timeLeft), 
        timestamp: Date.now()
    };
    try {
        const savedEvent = await logEvent(eventData as Omit<MatchEvent, 'id' | 'synced'>);
        setEvents((prev) => [savedEvent, ...prev]);
        
        await updateDoc(doc(db, "matches_v2", matchId), {
           [subTeam === "home" ? "homePlayers" : "awayPlayers"]: updated
        });
    } catch (e) {
        console.error("Substitution save failed", e);
    }
    
    setPendingAction(null);
  };

  const calculateScore = (team: "home" | "away") => events.filter((e) => e.team === team).reduce((acc, e) => {
    if (["1PT", "FTM"].includes(e.type)) return acc + 1;
    if (["2PT", "DNK"].includes(e.type)) return acc + 2;
    if (e.type === "3PT") return acc + 3;
    return acc;
  }, 0);

  const statsList = [
      { id: "1PT", label: t("action_1pt") || "1 PT", color: "bg-emerald-500" },
      { id: "2PT", label: t("action_2pt") || "2 PT", color: "bg-emerald-500" },
      { id: "3PT", label: t("action_3pt") || "3 PT", color: "bg-emerald-500" },
      { id: "AST", label: t("action_ast") || "ASSIST", color: "bg-indigo-500" },
      { id: "OREB", label: t("action_oreb") || "O-REB", color: "bg-blue-500" },
      { id: "DREB", label: t("action_dreb") || "D-REB", color: "bg-blue-600" },
      { id: "STL", label: t("action_stl") || "STEAL", color: "bg-indigo-600" },
      { id: "BLK", label: t("action_blk") || "BLOCK", color: "bg-indigo-700" },
      { id: "TOV", label: t("action_tov") || "TURNOVER", color: "bg-red-400" },
      { id: "PF", label: "FOUL (P)", color: "bg-red-500" },
      { id: "TF", label: "TECH (T)", color: "bg-red-600" },
      { id: "U", label: "UNSPORTSMANLIKE (U)", color: "bg-red-700" },
      { id: "D", label: "DISQUALIFYING (D)", color: "bg-red-800" },
      { id: "SUB", label: t("action_sub") || "SUB", color: "bg-neutral-600" },
  ];

  const getTeamFouls = (team: "home" | "away") => {
      // 3x3 uses overall team fouls across the whole game, 5x5 uses per-quarter fouls
      const foulEvents = events.filter(e => e.team === team && ["PF", "TF", "U", "D", "GD", "FF"].includes(e.type));
      if (modality === "3x3 Relámpago") {
          return foulEvents.length;
      }
      return foulEvents.filter(e => e.quarter === quarter).length;
  };

  const handleFinishGame = () => {
    if (!matchId) return;
    setShowMatchReport(true);
  };

  const handleDefaultGame = async (winner: "home" | "away") => {
    if (!confirm(`¿Confirmar cierre por DEFAULT? El equipo ${winner === 'home' ? homeTeamName : awayTeamName} ganará 20-0.`)) return;
    if (!matchId || !user) return;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "matches_v2", matchId), {
        status: "completed",
        [winner === 'home' ? "homeScore" : "awayScore"]: 20,
        [winner === 'home' ? "awayScore" : "homeScore"]: 0,
        closureType: "default",
        notes: `Partido cerrado por incomparecencia. ${winner === 'home' ? awayTeamName : homeTeamName} no se presentó.`
      });
      alert("Partido cerrado por DEFAULT (20-0). Puedes exportar el Acta.");
      setShowActa(true);
    } catch (e) { console.error(e); }
  };

  const [showDefaultMenu, setShowDefaultMenu] = useState(false);
  const [isCasoEspecial, setIsCasoEspecial] = useState(false);

  const handleCasoEspecial = async () => {
    if (!matchId || !user) return;
    const confirmed = confirm("¿Marcar este partido como CASO ESPECIAL / ALTERCADO? Se generará un reporte para el comité disciplinario.");
    if (!confirmed) return;
    setIsCasoEspecial(true);
    try {
      // 1. Flag the match
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "matches_v2", matchId), {
        casoEspecial: true,
        casoFlaggedAt: new Date().toISOString()
      });

      // 2. Generate narrative report via DeepSeek AI
      const disqualifyingEvents = events.filter(e => ["U", "D", "GD", "TF"].includes(e.type));
      const prompt = `Eres el sistema de gestión de ligas Antigravity. Se ha marcado un partido como CASO ESPECIAL/ALTERCADO entre ${homeTeamName} y ${awayTeamName}. Genera un reporte narrativo BREVE (máx 120 palabras) para el comité disciplinario, describiendo el historial de faltas graves en el partido. Datos del partido: ${JSON.stringify(disqualifyingEvents)}.`;

      const res = await fetch("/api/ia/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.analysis) {
        alert(`📋 REPORTE DISCIPLINARIO:\n\n${data.analysis}`);
        await updateDoc(doc(db, "matches_v2", matchId), { disciplinaryReport: data.analysis });
      }
    } catch(e) { console.error(e); setIsCasoEspecial(false); }
  };

  const handleSignaturesComplete = async (signatures: { referee: string; homeCaptain: string; awayCaptain: string }) => {
      setIsFinishing(true);
      try {
          // Guardar firmas en Firestore y procesar estadísticas del partido
          if (matchId) {
             const { doc, updateDoc, writeBatch, increment } = await import("firebase/firestore");
             
             // 1. Marcar el partido como completado
             await updateDoc(doc(db, "matches_v2", matchId), {
                 status: "completed",
                 signatures
             });

             // 2. Acumular y agregar estadísticas a los perfiles de los jugadores
             const statsAccumulator: Record<string, any> = {};
             
             events.forEach(e => {
                 if (!e.playerId || e.type === "SUB") return;
                 
                 if (!statsAccumulator[e.playerId]) {
                     statsAccumulator[e.playerId] = { points: 0, assists: 0, rebounds: 0, blocks: 0, steals: 0, turnovers: 0, fouls: 0 };
                 }
                 
                 const p = statsAccumulator[e.playerId];
                 
                 if (["1PT", "FTM"].includes(e.type)) p.points += 1;
                 if (["2PT", "DNK"].includes(e.type)) p.points += 2;
                 if (e.type === "3PT") p.points += 3;
                 
                 if (e.type === "AST") p.assists += 1;
                 if (["OREB", "DREB"].includes(e.type)) p.rebounds += 1;
                 if (e.type === "BLK") p.blocks += 1;
                 if (e.type === "STL") p.steals += 1;
                 if (e.type === "TOV") p.turnovers += 1;
                 if (["PF", "TF", "U", "D", "GD", "FF"].includes(e.type)) p.fouls += 1;
             });

             const batch = writeBatch(db);
             Object.entries(statsAccumulator).forEach(([pId, stats]) => {
                 const playerRef = doc(db, "players", pId);
                 batch.update(playerRef, {
                     totalPoints: increment(stats.points),
                     totalAssists: increment(stats.assists),
                     totalRebounds: increment(stats.rebounds),
                     totalBlocks: increment(stats.blocks),
                     totalSteals: increment(stats.steals),
                     totalTurnovers: increment(stats.turnovers),
                     totalFouls: increment(stats.fouls),
                     gamesPlayed: increment(1)
                 });
             });
             
             await batch.commit().catch(err => console.error("Batch update stats limit error or missing players:", err));
          }

          // Generar el AI Report en background
          const res = await fetch("/api/ia/game-report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ matchId })
          });
          const data = await res.json();
          if (data.report) setGameReport(data.report);
      } catch (e) {
          console.error("Failed to finalize game:", e);
      } finally {
          setIsFinishing(false);
      }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-neutral-100">
      
      {/* Panel Izquierdo: ROSTER (Home & Away) */}
      <aside className="w-80 border-r border-neutral-200 bg-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black text-orange-600 uppercase tracking-wider">{homeTeamName}</h2>
                </div>
                {getTeamFouls("home") >= 4 && (
                    <div className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md text-center mb-2 animate-pulse">
                        {t("team_bonus") || "TEAM BONUS"}
                    </div>
                )}
                {homePlayers.length > 0 ? (
                    <>
                        <div className="mb-2">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t("starters")} ({homePlayers.filter(p => p.isStarter).length})</span>
                            {homePlayers.filter(p => p.isStarter).map(p => (
                                <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">{p.number}</span><span className="text-sm font-medium">{p.name}</span><span className="text-[10px] text-neutral-400 ml-auto">{p.position}</span></div>
                            ))}
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t("bench")} ({homePlayers.filter(p => !p.isStarter).length})</span>
                            {homePlayers.filter(p => !p.isStarter).map(p => (
                                <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">{p.number}</span><span className="text-sm text-neutral-500">{p.name}</span></div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-neutral-400 italic">{t("add_active_players")}</p>
                )}
            </div>
            <div className="border-t border-neutral-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black text-blue-600 uppercase tracking-wider">{awayTeamName}</h2>
                </div>
                {getTeamFouls("away") >= 4 && (
                    <div className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md text-center mb-2 animate-pulse">
                        {t("team_bonus") || "TEAM BONUS"}
                    </div>
                )}
                {awayPlayers.length > 0 ? (
                    <>
                        <div className="mb-2">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t("starters")}</span>
                            {awayPlayers.filter(p => p.isStarter).map(p => (
                                <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">{p.number}</span><span className="text-sm font-medium">{p.name}</span><span className="text-[10px] text-neutral-400 ml-auto">{p.position}</span></div>
                            ))}
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{t("bench")}</span>
                            {awayPlayers.filter(p => !p.isStarter).map(p => (
                                <div key={p.id} className="flex items-center gap-2 py-1.5"><span className="w-6 h-6 rounded bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">{p.number}</span><span className="text-sm text-neutral-500">{p.name}</span></div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="text-xs text-neutral-400 italic">{t("add_active_players")}</p>
                )}
            </div>
        </div>
      </aside>

      {/* Panel Central: Court & Timeline */}
      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-50">
        <div className="bg-neutral-900 px-6 py-4 text-white shadow-md flex justify-between items-center z-10">
          <div className="text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase">{homeTeamName}</div>
            <div className="text-4xl font-black">{calculateScore("home")}</div>
            {(() => { const tf = getTeamFouls("home"); const bonus = modality === "3x3 Relámpago" ? 7 : 4; return tf >= bonus ? <div className="text-[10px] font-black text-red-400 animate-pulse mt-0.5">BONUS</div> : <div className="text-[10px] text-neutral-600 mt-0.5">{tf} TF</div>; })()}
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5 flex gap-2 items-center justify-center">
              <span className="text-orange-400">Q{quarter}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-bold text-[9px]">{modality}</span>
              {category !== "Libre" && <span className="px-2 py-0.5 rounded-full bg-orange-600/70 text-white font-bold text-[9px]">{category}</span>}
            </div>
            <div className={`text-4xl font-black tracking-tighter mb-2 ${timeLeft === 0 ? 'text-red-500 animate-pulse' : ''}`}>{formatTime(timeLeft)}</div>
            
            {timeLeft === 0 && quarter < numPeriods ? (
              <button onClick={() => { setQuarter(quarter + 1); setTimeLeft(periodMinutes * 60); }} className="bg-orange-600 text-xs font-bold px-4 py-1.5 rounded-full uppercase transition-all shadow-md">
                Per. {quarter + 1} ›
              </button>
            ) : timeLeft === 0 && quarter === numPeriods ? (
              <button onClick={handleFinishGame} className="bg-red-600 text-xs font-bold px-4 py-1.5 rounded-full uppercase transition-all shadow-md">
                End Game
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsRunning(!isRunning)} className="bg-orange-600 p-2 rounded-full hover:bg-orange-500 transition-colors shadow">{isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}</button>
                <button onClick={() => { setTimeLeft(600); setIsRunning(false); }} className="bg-neutral-700 p-2 rounded-full hover:bg-neutral-600 transition-colors"><RotateCcw className="h-4 w-4" /></button>
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase">{awayTeamName}</div>
            <div className="text-4xl font-black">{calculateScore("away")}</div>
            {(() => { const tf = getTeamFouls("away"); const bonus = modality === "3x3 Relámpago" ? 7 : 4; return tf >= bonus ? <div className="text-[10px] font-black text-red-400 animate-pulse mt-0.5">BONUS</div> : <div className="text-[10px] text-neutral-600 mt-0.5">{tf} TF</div>; })()}
          </div>
        </div>

        {/* Half Court Graphic / Shot Chart */}
        <div className="h-64 border-b border-neutral-200 bg-white relative flex items-center justify-center overflow-hidden">
            <ShotChart 
              isCourtActive={isCourtActive} 
              actionType={pendingAction}
              onCoordinateSelected={(coords) => setShotCoordinates(coords)}
            />
        </div>

        {/* Game Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">{t("game_timeline")}</h3>
            <div className="space-y-3">
                <AnimatePresence>
                    {events.map((e, i) => (
                        <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1,y:0}} key={i} className="flex gap-4 items-center bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                            <span className="text-xs font-mono text-neutral-400 font-bold">{e.time}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${e.team === 'home' ? 'bg-orange-500' : 'bg-blue-500'}`}>{e.team === 'home' ? t('home').toUpperCase() : t('away').toUpperCase()}</span>
                            <span className="text-sm"><span className="font-bold text-neutral-900">{e.playerName}</span> • <span className="font-bold text-orange-600">{t(`action_${e.type.toLowerCase()}`) || e.type}</span></span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {events.length === 0 && <div className="text-center py-10 text-neutral-400 text-sm">{t("waiting_tipoff")}</div>}
            </div>
        </div>
      </main>

      {/* Panel Derecho: Stat Buttons */}
      <aside className="w-[320px] border-l border-neutral-200 bg-white p-6 overflow-y-auto flex flex-col">
        <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider mb-4">{t("record_action")}</h3>
        {/* Period Indicator */}
        <div className="flex items-center justify-between bg-neutral-50 rounded-xl p-3 mb-4 border border-neutral-100">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Período</div>
          <div className="flex items-center gap-1">
            {Array.from({ length: numPeriods }, (_, i) => (
              <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${i + 1 === quarter ? 'bg-orange-500 text-white' : i + 1 < quarter ? 'bg-neutral-300 text-neutral-500' : 'bg-neutral-100 text-neutral-300'}`}>{i + 1}</div>
            ))}
          </div>
          <div className="text-xs font-bold text-orange-600">{periodMinutes}' c/u</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            {statsList.map(stat => (
                <button 
                  key={stat.id} 
                  onClick={() => handleActionClick(stat.id)}
                  className={`flex items-center justify-center p-3.5 rounded-xl text-white font-black shadow-md transition-transform active:scale-95 hover:brightness-110 text-xs ${stat.color}`}
                >
                    {stat.label}
                </button>
            ))}
        </div>
        <div className="mt-auto pt-6 space-y-2">
            {/* Admin Special Actions */}
            <div className="flex gap-2">
              <button onClick={() => setShowDefaultMenu(!showDefaultMenu)} className="flex-1 flex justify-center items-center gap-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-black py-2.5 hover:bg-amber-200 transition-colors border border-amber-200">
                  ⚠️ Default 20-0
              </button>
              <button onClick={handleCasoEspecial} disabled={isCasoEspecial} className="flex-1 flex justify-center items-center gap-1 rounded-xl bg-red-100 text-red-700 text-xs font-black py-2.5 hover:bg-red-200 transition-colors border border-red-200 disabled:opacity-50">
                  {isCasoEspecial ? "✅ Flagged" : "🚨 Caso Especial"}
              </button>
            </div>
            {showDefaultMenu && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <p className="text-xs text-amber-800 font-bold mb-2 text-center">¿Quién gana por DEFAULT?</p>
                <div className="flex gap-2">
                  <button onClick={() => { handleDefaultGame("home"); setShowDefaultMenu(false); }} className="flex-1 text-xs font-black py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700">{homeTeamName}</button>
                  <button onClick={() => { handleDefaultGame("away"); setShowDefaultMenu(false); }} className="flex-1 text-xs font-black py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{awayTeamName}</button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowActa(true)} className="flex-none flex justify-center items-center gap-1 rounded-xl bg-indigo-600 text-white text-xs font-bold py-3 px-4 hover:bg-indigo-700 transition-colors">
                  📋 Acta FIBA
              </button>
              <button onClick={handleFinishGame} disabled={isFinishing || !matchId} className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-neutral-900 text-white text-sm font-bold py-3 disabled:bg-neutral-300">
                  {isFinishing ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("finish_game")}
              </button>
            </div>
        </div>
      </aside>

      {/* Popup: "Who performed this?" */}
      {pendingAction && pendingAction !== "SUB" && !isCourtActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl">
                  <h3 className="text-2xl font-black text-center mb-8">{t("who_recorded")} <span className="text-orange-600">{t(`action_${pendingAction.toLowerCase()}`) || pendingAction}</span>?</h3>
                  <div className="grid grid-cols-2 gap-8">
                      <div>
                          <h4 className="text-center font-bold text-orange-600 mb-4 bg-orange-50 py-2 rounded-lg">{homeTeamName} (ON COURT)</h4>
                          <div className="grid grid-cols-2 gap-2">
                              {homePlayers.filter(p => p.isStarter).map(p => (
                                  <button key={p.id} onClick={() => confirmEvent(p, "home")} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-orange-500 hover:bg-orange-50 transition-colors text-sm font-bold truncate">
                                      {p.number} - {p.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <h4 className="text-center font-bold text-blue-600 mb-4 bg-blue-50 py-2 rounded-lg">{awayTeamName} (ON COURT)</h4>
                          <div className="grid grid-cols-2 gap-2">
                              {awayPlayers.filter(p => p.isStarter).map(p => (
                                  <button key={p.id} onClick={() => confirmEvent(p, "away")} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm font-bold truncate">
                                      {p.number} - {p.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="mt-8 flex justify-center">
                      <button onClick={() => { setPendingAction(null); setShotCoordinates(null); }} className="px-6 py-2 rounded-full border border-neutral-300 font-bold text-neutral-500 hover:bg-neutral-100">{t("cancel")}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Popup: SUBSTITUTION */}
      {pendingAction === "SUB" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-3xl bg-white rounded-3xl p-8 shadow-2xl">
                  <h3 className="text-2xl font-black text-center mb-6">Make a Substitution</h3>
                  <div className="flex justify-center mb-6 bg-neutral-100 rounded-xl p-1 w-fit mx-auto">
                     <button onClick={() => { setSubTeam("home"); setSubIn(null); setSubOut(null); }} className={`px-6 py-2 rounded-lg font-bold text-sm ${subTeam === 'home' ? 'bg-white shadow' : 'text-neutral-500'}`}>{homeTeamName}</button>
                     <button onClick={() => { setSubTeam("away"); setSubIn(null); setSubOut(null); }} className={`px-6 py-2 rounded-lg font-bold text-sm ${subTeam === 'away' ? 'bg-white shadow' : 'text-neutral-500'}`}>{awayTeamName}</button>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                     <div>
                        <h4 className="font-bold text-red-500 mb-2">PLAYER IN (Bench)</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                           {(subTeam === "home" ? homePlayers : awayPlayers).filter(p => !p.isStarter).map(p => (
                              <button key={p.id} onClick={() => setSubIn(p)} className={`w-full text-left p-2 rounded-xl border text-sm font-bold ${subIn?.id === p.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'}`}>
                                 #{p.number} {p.name}
                              </button>
                           ))}
                        </div>
                     </div>
                     <div>
                        <h4 className="font-bold text-emerald-500 mb-2">PLAYER OUT (On Court)</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                           {(subTeam === "home" ? homePlayers : awayPlayers).filter(p => p.isStarter).map(p => (
                              <button key={p.id} onClick={() => setSubOut(p)} className={`w-full text-left p-2 rounded-xl border text-sm font-bold ${subOut?.id === p.id ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'}`}>
                                 #{p.number} {p.name}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 flex justify-center gap-4 border-t border-neutral-100 pt-6">
                      <button onClick={() => setPendingAction(null)} className="px-6 py-2 rounded-xl border border-neutral-300 font-bold text-neutral-600 hover:bg-neutral-100">{t("cancel")}</button>
                      <button onClick={confirmSub} disabled={!subIn || !subOut} className="px-8 py-2 rounded-xl bg-neutral-900 text-white font-black hover:bg-black disabled:opacity-50 tracking-wide">CONFIRM SUB</button>
                  </div>
              </div>
          </div>
      )}

      {/* Match Report & Signatures */}
      {showMatchReport && !gameReport && (
          <MatchReport 
              matchId={matchId!}
              homeTeam={homeTeamName}
              awayTeam={awayTeamName}
              homeScore={calculateScore("home")}
              awayScore={calculateScore("away")}
              onClose={() => setShowMatchReport(false)}
              onSignaturesComplete={handleSignaturesComplete}
          />
      )}

      {/* Loading State during Submission */}
      {isFinishing && (
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-white">
              <div className="h-16 w-16 border-4 border-white/20 border-t-orange-500 rounded-full animate-spin mb-6" />
              <h2 className="text-2xl font-black uppercase tracking-widest">{t("processing_report") || "Generating Official AI Report..."}</h2>
              <p className="text-neutral-400 mt-2">{t("please_wait") || "Please do not close this window."}</p>
          </div>
      )}

      {/* Final AI Game Report Modal */}
      {gameReport && (
          <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b border-neutral-100 flex justify-between items-center bg-emerald-600 text-white">
                      <div>
                        <h3 className="text-3xl font-black flex items-center gap-3"><CheckCircle className="h-8 w-8"/> {t("match_locked") || "Match Officially Locked"}</h3>
                        <p className="opacity-80 font-medium mt-1">Signatures verified. Box Score & AI Report generated.</p>
                      </div>
                      <button onClick={() => { setGameReport(null); setShowMatchReport(false); }} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="h-6 w-6"/></button>
                  </div>
                  <div className="p-10 overflow-y-auto prose prose-emerald max-w-none flex-1 font-sans text-neutral-800" dangerouslySetInnerHTML={{ __html: gameReport.replace(/\n\n/g, '<br/><br/>').replace(/\n- /g, '<br/>• ').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                  <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-4">
                      <button onClick={() => window.print()} className="px-8 py-3 rounded-xl bg-white text-emerald-600 border-2 border-emerald-600 font-black hover:bg-emerald-50 shadow-sm">{t("export_pdf") || "Export PDF"}</button>
                      <button onClick={() => { setGameReport(null); setShowMatchReport(false); }} className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 shadow-md shadow-emerald-600/20">{t("close") || "Close Dashboard"}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Digital FIBA Scoresheet (Acta Digital) */}
      {showActa && (
        <ActaDigital
          matchId={matchId || ""}
          homeTeam={homeTeamName}
          awayTeam={awayTeamName}
          homeScore={calculateScore("home")}
          awayScore={calculateScore("away")}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          events={events as any}
          modality={modality}
          category={category}
          onClose={() => setShowActa(false)}
        />
      )}

    </div>
  );
};

export default Scorekeeper;
