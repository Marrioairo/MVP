import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { BarChart2, Download, Filter, Search, TrendingUp, Users, Calendar, Trophy, Medal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MatchStats {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  timestamp: any;
  events: any[];
}

interface PlayerStats {
  id: string;
  name: string;
  number: string;
  teamId: string;
  totalPoints?: number;
  totalAssists?: number;
  totalRebounds?: number;
  totalBlocks?: number;
  totalSteals?: number;
  totalTurnovers?: number;
  totalFouls?: number;
  gamesPlayed?: number;
}

const Stats: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<"leaderboard" | "matches">("leaderboard");
  
  const [matches, setMatches] = useState<MatchStats[]>([]);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [sortBy, setSortBy] = useState<keyof PlayerStats>("totalPoints");

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch Matches
        const qMatches = query(collection(db, "matches_v2"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
        const snapMatches = await getDocs(qMatches);
        setMatches(snapMatches.docs.map(doc => ({ id: doc.id, ...doc.data() } as MatchStats)));

        // Fetch Top Players for Leaderboard
        const qPlayers = query(collection(db, "players"), where("userId", "==", user.uid), orderBy(sortBy, "desc"), limit(50));
        const snapPlayers = await getDocs(qPlayers);
        setPlayers(snapPlayers.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerStats)));
        
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, sortBy]);

  const exportData = (match: MatchStats) => {
    const data = JSON.stringify(match, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match-${match.id}.json`;
    a.click();
  };

  const filteredMatches = matches.filter(m => 
    m.homeTeam?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.awayTeam?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPlayers = players.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-neutral-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">{t('advanced_stats') || "Global Statistics"}</h1>
            <p className="text-neutral-500">Analyze team performances and global player leaderboards.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border border-neutral-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 w-full sm:w-64"
              />
            </div>
          </div>
        </header>

        {/* Custom Tabs */}
        <div className="flex gap-4 border-b border-neutral-200 mb-8 pb-1 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab("leaderboard")} 
            className={`flex items-center gap-2 px-4 py-2 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${activeTab === 'leaderboard' ? 'border-orange-600 text-orange-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            <Trophy className="h-4 w-4" /> Global Leaderboard
          </button>
          <button 
            onClick={() => setActiveTab("matches")} 
            className={`flex items-center gap-2 px-4 py-2 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${activeTab === 'matches' ? 'border-orange-600 text-orange-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}
          >
            <Calendar className="h-4 w-4" /> Match History
          </button>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
          </div>
        ) : activeTab === "leaderboard" ? (
          // PLAYER LEADERBOARD TAB
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <h2 className="text-xl font-black flex items-center gap-2"><Medal className="h-5 w-5 text-yellow-500" /> Top Performers</h2>
                 <p className="text-sm text-neutral-500">Accumulated statistics from all official finalized matches.</p>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-neutral-400 uppercase">Sort By:</span>
                 <select 
                   value={sortBy} 
                   onChange={(e) => setSortBy(e.target.value as keyof PlayerStats)}
                   className="bg-neutral-50 border border-neutral-200 text-sm font-bold rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                 >
                   <option value="totalPoints">Points (PTS)</option>
                   <option value="totalAssists">Assists (AST)</option>
                   <option value="totalRebounds">Rebounds (REB)</option>
                   <option value="totalSteals">Steals (STL)</option>
                   <option value="totalBlocks">Blocks (BLK)</option>
                   <option value="gamesPlayed">Games Played (GP)</option>
                 </select>
               </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500 font-bold">
                    <th className="p-4 pl-6 w-16 text-center">Rank</th>
                    <th className="p-4">Player</th>
                    <th className="p-4 text-center cursor-pointer hover:bg-neutral-100 transition-colors" title="Games Played">GP</th>
                    <th className="p-4 text-center cursor-pointer hover:bg-neutral-100 transition-colors" title="Points">PTS</th>
                    <th className="p-4 text-center cursor-pointer hover:bg-neutral-100 transition-colors" title="Assists">AST</th>
                    <th className="p-4 text-center cursor-pointer hover:bg-neutral-100 transition-colors" title="Rebounds">REB</th>
                    <th className="p-4 text-center cursor-pointer hover:bg-neutral-100 transition-colors" title="Steals">STL</th>
                    <th className="p-4 text-center cursor-pointer hover:bg-neutral-100 transition-colors" title="Blocks">BLK</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredPlayers.length > 0 ? filteredPlayers.map((p, index) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                        key={p.id} className="border-b border-neutral-100 hover:bg-orange-50/50 transition-colors group"
                      >
                        <td className="p-4 pl-6 text-center">
                          {index === 0 ? <span className="bg-yellow-100 text-yellow-700 w-8 h-8 rounded-full flex items-center justify-center font-black mx-auto text-sm">1</span> :
                           index === 1 ? <span className="bg-neutral-200 text-neutral-600 w-8 h-8 rounded-full flex items-center justify-center font-black mx-auto text-sm">2</span> :
                           index === 2 ? <span className="bg-orange-200 text-orange-800 w-8 h-8 rounded-full flex items-center justify-center font-black mx-auto text-sm">3</span> :
                           <span className="text-neutral-400 font-bold w-8 h-8 flex items-center justify-center mx-auto">{index + 1}</span>}
                        </td>
                        <td className="p-4 font-bold text-neutral-900 group-hover:text-orange-600 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-neutral-100 flex items-center justify-center text-xs font-black text-neutral-500">{p.number || "-"}</div>
                            {p.name}
                          </div>
                        </td>
                        <td className="p-4 text-center font-medium text-neutral-600">{p.gamesPlayed || 0}</td>
                        <td className={`p-4 text-center font-black ${sortBy === 'totalPoints' ? 'text-orange-600 text-lg bg-orange-50/30' : 'text-neutral-900'}`}>{p.totalPoints || 0}</td>
                        <td className={`p-4 text-center font-black ${sortBy === 'totalAssists' ? 'text-indigo-600 text-lg bg-indigo-50/30' : 'text-neutral-700'}`}>{p.totalAssists || 0}</td>
                        <td className={`p-4 text-center font-black ${sortBy === 'totalRebounds' ? 'text-blue-600 text-lg bg-blue-50/30' : 'text-neutral-700'}`}>{p.totalRebounds || 0}</td>
                        <td className={`p-4 text-center font-black ${sortBy === 'totalSteals' ? 'text-emerald-600 text-lg bg-emerald-50/30' : 'text-neutral-700'}`}>{p.totalSteals || 0}</td>
                        <td className={`p-4 text-center font-black ${sortBy === 'totalBlocks' ? 'text-rose-600 text-lg bg-rose-50/30' : 'text-neutral-700'}`}>{p.totalBlocks || 0}</td>
                      </motion.tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-neutral-500">
                          <Users className="h-10 w-10 mx-auto text-neutral-300 mb-3" />
                          <p className="font-bold">No player stats found.</p>
                          <p className="text-sm">Finish a match in the Scorekeeper to populate the leaderboard.</p>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        ) : filteredMatches.length === 0 ? (
          // EMPTY MATCHES TAB
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-neutral-200 shadow-sm">
            <BarChart2 className="h-12 w-12 text-neutral-300 mb-4" />
            <h3 className="text-lg font-bold text-neutral-900">No matches found</h3>
            <p className="text-neutral-500">Start recording matches in the Scorekeeper to see your match history here.</p>
          </div>
        ) : (
          // MATCH HISTORY TAB
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
             <AnimatePresence>
              {filteredMatches.map((match) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                      <Calendar className="h-3 w-3" />
                      {match.timestamp ? new Date(match.timestamp?.seconds * 1000).toLocaleDateString() : 'Unknown Date'}
                    </div>
                    <button 
                      onClick={() => exportData(match)}
                      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-50 hover:text-orange-600 transition-all"
                      title="Export Data JSON"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <div className="text-center flex-1 overflow-hidden">
                      <div className="h-12 w-12 rounded-full bg-neutral-100 mx-auto mb-2 flex items-center justify-center text-xl font-bold text-neutral-600 shadow-sm border border-neutral-200">
                        {match.homeTeam?.[0] || "?"}
                      </div>
                      <div className="text-sm font-bold text-neutral-900 truncate px-1">{match.homeTeam || "Home"}</div>
                    </div>
                    <div className="px-4 py-2 bg-neutral-900 rounded-xl text-2xl font-black text-white shadow-inner">
                      {match.homeScore || 0} <span className="text-neutral-500 text-lg mx-1">-</span> {match.awayScore || 0}
                    </div>
                    <div className="text-center flex-1 overflow-hidden">
                      <div className="h-12 w-12 rounded-full bg-neutral-100 mx-auto mb-2 flex items-center justify-center text-xl font-bold text-neutral-600 shadow-sm border border-neutral-200">
                        {match.awayTeam?.[0] || "?"}
                      </div>
                      <div className="text-sm font-bold text-neutral-900 truncate px-1">{match.awayTeam || "Away"}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-orange-50 p-3 border border-orange-100">
                      <div className="text-[10px] font-bold text-orange-600 uppercase">Total Events</div>
                      <div className="text-lg font-black text-neutral-800">{match.events?.length || 0}</div>
                    </div>
                    <div className="rounded-2xl bg-blue-50 p-3 border border-blue-100">
                      <div className="text-[10px] font-bold text-blue-600 uppercase">Offensive RTG</div>
                      <div className="text-lg font-black text-neutral-800">
                         {match.events?.length ? Math.round(((match.homeScore || 0) / match.events.length) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
