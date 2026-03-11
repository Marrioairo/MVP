import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { motion } from "motion/react";
import { Trophy, Star, Sparkles, AlertCircle, ArrowLeft, Hexagon } from "lucide-react";

interface PlayerStat {
  id: string;
  name: string;
  number: string;
  teamId: string;
  totalPoints: number;
  totalRebounds: number;
  totalAssists: number;
  totalBlocks: number;
  totalSteals: number;
  totalTurnovers: number;
  total3PT?: number; // Might not exist if not strictly tracked, fallback to calculating or just MVP
}

const TournamentMVP: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tournamentName, setTournamentName] = useState("Tournament MVP");
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  // MVP AI State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !tournamentId) return;
    fetchTournamentData();
  }, [user, tournamentId]);

  const fetchTournamentData = async () => {
    if (!tournamentId) return;
    try {
      // 1. Get Tournament Name
      const tDoc = await getDoc(doc(db, "tournaments_v2", tournamentId));
      if (tDoc.exists()) {
        setTournamentName(tDoc.data().name);
      }

      // 2. Get Teams for this Tournament
      const qTeams = query(collection(db, "teams_v2"), where("tournamentId", "==", tournamentId));
      const snapTeams = await getDocs(qTeams);
      const teamIds = snapTeams.docs.map(t => t.id);

      // 3. Get Players for those Teams (Firestore limit 'in' query is 10)
      // Since teamIds can be > 10, we will fetch all user players and filter locally
      const qPlayers = query(collection(db, "players"), where("userId", "==", user!.uid));
      const snapPlayers = await getDocs(qPlayers);
      
      const tPlayers = snapPlayers.docs
        .map(p => ({ id: p.id, ...p.data() } as PlayerStat))
        .filter(p => teamIds.includes(p.teamId))
        .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

      setPlayers(tPlayers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getTopScorer = () => {
    if (players.length === 0) return null;
    return players[0]; // Already sorted by totalPoints
  };

  const generateMVPCandidates = async () => {
    if (players.length === 0) return;
    setIsEvaluating(true);
    setAiAnalysis(null);

    try {
      // Send the top 15 players maximum context so we don't blow token limits
      const topPlayersContext = players.slice(0, 15).map(p => ({
        name: p.name,
        pts: p.totalPoints || 0,
        ast: p.totalAssists || 0,
        reb: p.totalRebounds || 0,
        blk: p.totalBlocks || 0,
        stl: p.totalSteals || 0,
        tov: p.totalTurnovers || 0
      }));

      const payload = {
         prompt: `Based on the following player statistics gathered over the tournament, analyze their performance using advanced efficiency metrics (assuming standard basketball rules) and select exactly 3 MVP Candidates. For each candidate, provide a 2 sentence explanation of why they are nominated based on their stats. Finally, declare your ultimate #1 MVP prediction at the end. Make it sound like a professional NBA analyst report.`,
         matchData: topPlayersContext
      };

      const res = await fetch("/api/ia/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setAiAnalysis(data.choices?.[0]?.message?.content || data.reply || "No analysis returned by HoopsAI.");
    } catch (e) {
      console.error("AI Error:", e);
      setAiAnalysis("HoopsAI MVP Evaluation failed. Please check connection.");
    } finally {
      setIsEvaluating(false);
    }
  };

  if (loading) return <div className="p-10 text-center flex flex-col items-center gap-4"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>Loading MVP Engine...</div>;

  const topScorer = getTopScorer();

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate("/tournaments")} className="flex items-center gap-2 text-neutral-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Tournaments
        </button>

        <header className="mb-10 flex flex-col items-center text-center">
             <div className="h-20 w-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-600/30 transform rotate-3 mb-6">
                <Trophy className="h-10 w-10 text-white" />
             </div>
             <h1 className="text-4xl sm:text-5xl font-black tracking-tighter uppercase font-display bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 mb-2">
                MVP & Awards
             </h1>
             <p className="text-xl text-neutral-400 uppercase tracking-widest">{tournamentName}</p>
        </header>

        {players.length === 0 ? (
          <div className="bg-neutral-800 border border-neutral-700 rounded-3xl p-10 text-center">
            <AlertCircle className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Not Enough Data</h2>
            <p className="text-neutral-400 max-w-md mx-auto">There are no players or stats recorded for this tournament. Play some matches using HoopsAI Scorekeeper first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Automatic Stats Pillar */}
            <div className="lg:col-span-4 space-y-6">
               <div className="bg-white text-neutral-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                     <Hexagon className="h-24 w-24" />
                  </div>
                  <h3 className="text-sm font-black uppercase text-orange-600 tracking-widest mb-4">Top Scorer (Points)</h3>
                  {topScorer ? (
                    <div className="flex items-center gap-4">
                       <div className="h-16 w-16 bg-neutral-100 rounded-full border-4 border-white shadow-md flex items-center justify-center text-2xl font-black text-neutral-300">
                          {topScorer.number}
                       </div>
                       <div>
                          <div className="text-xl font-black">{topScorer.name}</div>
                          <div className="text-3xl font-black text-orange-600 mt-1">{topScorer.totalPoints || 0} <span className="text-sm text-neutral-500 uppercase">PTS</span></div>
                       </div>
                    </div>
                  ) : <span className="italic">N/A</span>}
               </div>

               <div className="bg-neutral-800 border border-neutral-700 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <h3 className="text-sm font-black uppercase text-neutral-400 tracking-widest mb-4">Player Pool</h3>
                  <div className="text-5xl font-black text-white">{players.length}</div>
                  <p className="text-neutral-400 text-sm mt-2">Eligible players across all active rosters.</p>
               </div>
            </div>

            {/* DeepSeek AI Engine */}
            <div className="lg:col-span-8">
               <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden min-h-[400px] flex flex-col">
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                     <div>
                       <h2 className="text-2xl font-black flex items-center gap-2 mb-2">
                         <Sparkles className="h-6 w-6 text-yellow-400" />
                         HoopsAI Premium Coach
                       </h2>
                       <p className="text-neutral-400">Launch the advanced AI evaluator to select 3 MVP candidates from the roster based on pure efficiency metrics.</p>
                     </div>
                  </div>

                  {!aiAnalysis && !isEvaluating && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                      <div className="h-20 w-20 bg-neutral-800 rounded-full flex items-center justify-center mb-6 border border-neutral-700">
                        <Star className="h-10 w-10 text-neutral-600" />
                      </div>
                      <button 
                        onClick={generateMVPCandidates}
                        className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl shadow-[0_0_30px_rgba(234,88,12,0.4)] transition-all flex items-center gap-3 uppercase tracking-widest"
                      >
                         <Sparkles className="h-5 w-5" /> Execute AI Selection
                      </button>
                    </div>
                  )}

                  {isEvaluating && (
                    <div className="flex-1 flex flex-col items-center justify-center py-10">
                      <div className="h-16 w-16 mb-6 relative">
                         <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin"></div>
                         <div className="absolute inset-0 border-r-4 border-yellow-400 rounded-full animate-[spin_1.5s_linear_infinite]"></div>
                      </div>
                      <h3 className="text-xl font-bold text-white animate-pulse">DeepSeek Analyzing Stats...</h3>
                      <p className="text-neutral-500 mt-2">Crunching box scores and efficiency ratings.</p>
                    </div>
                  )}

                  {aiAnalysis && !isEvaluating && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-950/50 p-6 md:p-8 rounded-2xl border border-neutral-800 font-serif leading-relaxed text-neutral-300 relative">
                       <div className="absolute top-0 right-0 p-4 opacity-5">
                          <Trophy className="h-32 w-32" />
                       </div>
                       <pre className="whitespace-pre-wrap font-sans text-sm md:text-base">{aiAnalysis}</pre>
                       
                       <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-end">
                         <button onClick={generateMVPCandidates} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-bold rounded-lg transition-colors">
                           Recalculate Candidates
                         </button>
                       </div>
                    </motion.div>
                  )}
               </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentMVP;
