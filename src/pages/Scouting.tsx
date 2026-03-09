import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { motion } from "motion/react";
import { BarChart3, Activity, Target, Shield, AlertTriangle } from "lucide-react";

interface PlayerStats {
  id: string;
  name: string;
  points: number;
  assists: number;
  rebounds: number;
  turnovers: number;
  steals: number;
  blocks: number;
  fouls: number;
  possessions: number;
}

const Scouting: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

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
            rebounds: 0, turnovers: 0, steals: 0, blocks: 0,
            fouls: 0, possessions: 0
          };
        });

        // Fetch all events across all matches for this user (Requires proper indexing if scaled)
        const matchesQ = query(collection(db, "matches"), where("userId", "==", user.uid));
        const matchesSnap = await getDocs(matchesQ);
        
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
               if (["OREB", "DREB"].includes(e.type)) p.rebounds += 1;
               if (e.type === "TOV") p.turnovers += 1;
               if (e.type === "STL") p.steals += 1;
               if (e.type === "BLK") p.blocks += 1;
               if (["PF", "TF"].includes(e.type)) p.fouls += 1;
               
               // Rough possession estimate: FGA + TOV
               if (["1PT", "2PT", "3PT", "DNK", "FTM", "TOV"].includes(e.type)) {
                   p.possessions += 1;
               }
             }
           });
        }

        setStats(Object.values(playerMap).sort((a,b) => b.points - a.points));
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
          <BarChart3 className="h-8 w-8 text-orange-600" /> Professional Scouting
        </h1>
        <p className="mt-2 text-neutral-600">Advanced player analytics and performance trends.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden text-sm">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-neutral-50 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">PTS</th>
                <th className="px-6 py-4">REB</th>
                <th className="px-6 py-4">AST</th>
                <th className="px-6 py-4 bg-orange-50 text-orange-800">Off Rtg <span className="block text-[8px] opacity-70">Pts per 100 Pos</span></th>
                <th className="px-6 py-4 bg-orange-50 text-orange-800">AST/TOV <span className="block text-[8px] opacity-70">Decision Quality</span></th>
                <th className="px-6 py-4">STL</th>
                <th className="px-6 py-4">BLK</th>
                <th className="px-6 py-4">TOV</th>
                <th className="px-6 py-4 text-red-600">Fouls</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
                {stats.map((p, i) => (
                    <motion.tr initial={{opacity:0, y:10}} animate={{opacity:1,y:0}} transition={{delay: i*0.05}} key={p.id} className="hover:bg-neutral-50 font-medium">
                        <td className="px-6 py-4 font-bold text-neutral-900">{p.name}</td>
                        <td className="px-6 py-4">{p.points}</td>
                        <td className="px-6 py-4">{p.rebounds}</td>
                        <td className="px-6 py-4">{p.assists}</td>
                        <td className="px-6 py-4 bg-orange-50/50 font-bold text-orange-600">{calculateOffRtg(p)}</td>
                        <td className="px-6 py-4 bg-orange-50/50 font-bold text-orange-600">{calculateAstTov(p)}</td>
                        <td className="px-6 py-4">{p.steals}</td>
                        <td className="px-6 py-4">{p.blocks}</td>
                        <td className="px-6 py-4">{p.turnovers}</td>
                        <td className="px-6 py-4 text-red-500">{p.fouls}</td>
                    </motion.tr>
                ))}
                {stats.length === 0 && (
                    <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-neutral-500">
                            <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            No data available. Record matches to generate scouting reports.
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
                <h3 className="font-bold text-neutral-900 mb-1">Offensive Rating</h3>
                <p className="text-sm text-neutral-500">Measures the team's points per 100 ball possessions. Values above 110 are excellent.</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Shield className="w-6 h-6"/></div>
            <div>
                <h3 className="font-bold text-neutral-900 mb-1">AST/TOV Ratio</h3>
                <p className="text-sm text-neutral-500">Evaluates decision making. A ratio {'>'}  2.0 indicates superb ball protection.</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-start gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl"><AlertTriangle className="w-6 h-6"/></div>
            <div>
                <h3 className="font-bold text-neutral-900 mb-1">Foul Trouble</h3>
                <p className="text-sm text-neutral-500">DeepSeek AI will warn the live coach if a player accumulates fouls too quickly.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Scouting;
