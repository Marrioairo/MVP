import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { motion } from "motion/react";
import { BarChart3, Activity, Target, Shield, AlertTriangle, Zap, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import ShotHeatmap, { ShotData } from "../components/ShotHeatmap";

interface PlayerStats {
  id: string;
  name: string;
  points: number;
  assists: number;
  rebounds: number;
  oReb: number;
  dReb: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  possessions: number;
}

const Scouting: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [shots, setShots] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [predictionModal, setPredictionModal] = useState<{
    isOpen: boolean;
    player: PlayerStats | null;
    text: string | null;
    loading: boolean;
  }>({ isOpen: false, player: null, text: null, loading: false });

  const handlePredict = async (p: PlayerStats) => {
    setPredictionModal({ isOpen: true, player: p, text: null, loading: true });
    try {
      const res = await fetch("/api/ia/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerStats: p }),
      });
      const data = await res.json();
      setPredictionModal(m => ({ ...m, text: data.prediction, loading: false }));
    } catch (e) {
      console.error(e);
      setPredictionModal(m => ({ ...m, text: "Failed to generate prediction.", loading: false }));
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch all players
        const playersQ = query(collection(db, "players"), where("userId", "==", user.uid));
        const playersSnap = await getDocs(playersQ);
        const playerMap: Record<string, PlayerStats> = {};
        
        playersSnap.docs.forEach(doc => {
          const data = doc.data();
          playerMap[doc.id] = {
            id: doc.id, name: data.name, points: 0, assists: 0, 
            rebounds: 0, oReb: 0, dReb: 0, turnovers: 0, steals: 0, blocks: 0,
            fouls: 0, possessions: 0
          };
        });

        // Fetch all events across all matches for this user (Requires proper indexing if scaled)
        const matchesQ = query(collection(db, "matches"), where("userId", "==", user.uid));
        const matchesSnap = await getDocs(matchesQ);
        const allShotsData: ShotData[] = [];
        
        for (const matchDoc of matchesSnap.docs) {
           const eventsQ = collection(db, "matches", matchDoc.id, "events");
           const eventsSnap = await getDocs(eventsQ);
           
           eventsSnap.docs.forEach(eDoc => {
             const e = eDoc.data();
             if (e.playerId && playerMap[e.playerId]) {
               const p = playerMap[e.playerId];
               if (["1PT", "FTM"].includes(e.type)) p.points += 1;
               if (["2PT", "DNK"].includes(e.type)) p.points += 2;
               if (e.type === "3PT") p.points += 3;
               if (e.type === "AST") p.assists += 1;
               if (e.type === "OREB") { p.rebounds += 1; p.oReb += 1; }
               if (e.type === "DREB") { p.rebounds += 1; p.dReb += 1; }
               if (e.type === "TOV") p.turnovers += 1;
               if (e.type === "STL") p.steals += 1;
               if (e.type === "BLK") p.blocks += 1;
               if (["PF", "TF"].includes(e.type)) p.fouls += 1;
               
               // Rough possession estimate: FGA + TOV
               if (["1PT", "2PT", "3PT", "DNK", "FTM", "TOV"].includes(e.type)) {
                   p.possessions += 1;
               }

               if (e.coordinates && ["1PT", "2PT", "3PT", "DNK", "FTM"].includes(e.type)) {
                   allShotsData.push({
                       x: e.coordinates.x,
                       y: e.coordinates.y,
                       type: e.type,
                       made: true
                   });
               }
             }
           });
        }

        setStats(Object.values(playerMap).sort((a,b) => b.points - a.points));
        setShots(allShotsData);
      } catch (e) {
        console.error("Error fetching scouting data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [user]);

  const calculateOffRtg = (p: PlayerStats) => {
    if (p.possessions === 0) return "0.0";
    return ((p.points / p.possessions) * 100).toFixed(1);
  };

  const calculateAstTov = (p: PlayerStats) => {
    if (p.turnovers === 0) return p.assists > 0 ? "Infinite" : "0.0";
    return (p.assists / p.turnovers).toFixed(2);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 max-h-[calc(100vh-64px)] overflow-y-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-orange-600" /> {t("scouting")}
        </h1>
        <p className="mt-2 text-neutral-600">{t("scouting_desc")}</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden text-sm">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                <th className="px-6 py-4">{t("player")}</th>
                <th className="px-6 py-4">{t("pts")}</th>
                <th className="px-6 py-4">{t("reb")} <span className="text-[10px] text-neutral-400 font-normal ml-1">(O/D)</span></th>
                <th className="px-6 py-4">{t("ast")}</th>
                <th className="px-6 py-4 bg-orange-50 text-orange-800">{t("off_rtg")} <span className="block text-[8px] opacity-70">{t("pts_per_100")}</span></th>
                <th className="px-6 py-4 bg-orange-50 text-orange-800">{t("ast_tov")} <span className="block text-[8px] opacity-70">{t("decision_quality")}</span></th>
                <th className="px-6 py-4">{t("stl")}</th>
                <th className="px-6 py-4">{t("blk")}</th>
                <th className="px-6 py-4">{t("tov")}</th>
                <th className="px-6 py-4 text-red-600">{t("fouls")}</th>
                <th className="px-6 py-4 text-indigo-600">AI Predict</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
                {stats.map((p, i) => (
                    <motion.tr initial={{opacity:0, y:10}} animate={{opacity:1,y:0}} transition={{delay: i*0.05}} key={p.id} className="hover:bg-neutral-50 font-medium">
                        <td className="px-6 py-4 font-bold text-neutral-900">{p.name}</td>
                        <td className="px-6 py-4">{p.points}</td>
                        <td className="px-6 py-4">{p.rebounds} <span className="text-xs text-neutral-400 ml-1">({p.oReb}/{p.dReb})</span></td>
                        <td className="px-6 py-4">{p.assists}</td>
                        <td className="px-6 py-4 bg-orange-50/50 font-bold text-orange-600">{calculateOffRtg(p)}</td>
                        <td className={`px-6 py-4 font-bold ${parseFloat(calculateAstTov(p)) >= 2.0 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50/50 text-orange-600'}`}>{calculateAstTov(p)}</td>
                        <td className="px-6 py-4">{p.steals}</td>
                        <td className="px-6 py-4">{p.blocks}</td>
                        <td className="px-6 py-4">{p.turnovers}</td>
                        <td className={`px-6 py-4 ${p.fouls >= 3 ? 'bg-red-50 text-red-600 font-bold' : 'text-red-500'}`}>{p.fouls} {p.fouls >= 3 && '⚠️'}</td>
                        <td className="px-6 py-4">
                            <button onClick={() => handlePredict(p)} className="p-2 bg-neutral-900 text-white rounded-lg hover:bg-indigo-600 transition-colors shadow-md" title="AI Performance Prediction">
                                <Zap className="h-4 w-4" />
                            </button>
                        </td>
                    </motion.tr>
                ))}
                {stats.length === 0 && (
                    <tr>
                        <td colSpan={11} className="px-6 py-12 text-center text-neutral-500">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            {t("no_data")}
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Target className="w-6 h-6"/></div>
            <div>
                <h3 className="font-bold text-neutral-900 mb-1">{t("offensive_rating_title")}</h3>
                <p className="text-sm text-neutral-500">{t("offensive_rating_desc")}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Shield className="w-6 h-6"/></div>
            <div>
                <h3 className="font-bold text-neutral-900 mb-1">{t("ast_tov_ratio_title")}</h3>
                <p className="text-sm text-neutral-500">{t("ast_tov_ratio_desc")}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl"><AlertTriangle className="w-6 h-6"/></div>
            <div>
                <h3 className="font-bold text-neutral-900 mb-1">{t("foul_trouble_title")}</h3>
                <p className="text-sm text-neutral-500">{t("foul_trouble_desc")}</p>
            </div>
        </div>
      </div>

      <div className="mt-8">
          <ShotHeatmap shots={shots} />
      </div>

      {/* AI Prediction Modal */}
      {predictionModal.isOpen && predictionModal.player && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-indigo-600 text-white">
                      <h3 className="text-xl font-black flex items-center gap-2"><Zap className="h-5 w-5 fill-white"/> {predictionModal.player.name} - Performance Forecast</h3>
                      <button onClick={() => setPredictionModal({ isOpen: false, player: null, text: null, loading: false })} className="p-2 hover:bg-indigo-500 rounded-full transition-colors"><X className="h-5 w-5"/></button>
                  </div>
                  <div className="p-8 overflow-y-auto w-full prose prose-indigo max-w-none flex-1 font-sans text-sm text-neutral-800">
                      {predictionModal.loading ? (
                          <div className="flex flex-col items-center justify-center py-10">
                              <Zap className="h-10 w-10 text-indigo-500 animate-pulse mb-4" />
                              <p className="font-bold text-lg text-neutral-500 animate-pulse">DeepSeek AI is analyzing...</p>
                          </div>
                      ) : (
                          <div dangerouslySetInnerHTML={{ __html: (predictionModal.text || "").replace(/\n\n/g, '<br/><br/>').replace(/\n- /g, '<br/>• ').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                      )}
                  </div>
                  <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                      <button onClick={() => setPredictionModal({ isOpen: false, player: null, text: null, loading: false })} className="px-6 py-2 rounded-xl bg-neutral-900 text-white font-bold hover:bg-black">Close Forecast</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Scouting;
