import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { motion } from "motion/react";
import { LayoutDashboard, MessageSquare, CreditCard, Settings, TrendingUp, Clock, Zap, Globe, Users, Plus, Star, UserMinus, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getPriceUSD } from "../lib/pricing";
import { Player } from "../lib/types";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ totalMatches: 0, totalEvents: 0, plan: "Free" });
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [topLineups, setTopLineups] = useState<any[]>([]);
  const [regionPrice, setRegionPrice] = useState(15);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", position: "G", height: "", weight: "", age: "", teamId: "" });
  const [editForm, setEditForm] = useState({ name: "", number: "", position: "G", height: "", weight: "", age: "", teamId: "" });

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const q = query(collection(db, "matches"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      setStats(prev => ({ ...prev, totalMatches: snapshot.size }));

      const recentQ = query(q, orderBy("createdAt", "desc"), limit(5));
      const recentSnapshot = await getDocs(recentQ);
      setRecentMatches(recentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch Roster
      const rosterQ = query(collection(db, "players"), where("userId", "==", user.uid));
      const rosterSnapshot = await getDocs(rosterQ);
      const fetchedPlayers = rosterSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      setPlayers(fetchedPlayers);

      // Fetch Teams
      const teamsQ = query(collection(db, "teams_v2"), where("userId", "==", user.uid));
      const teamsSnapshot = await getDocs(teamsQ);
      setTeams(teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch Lineup Analytics
      try {
          const { calculateLineupStats } = await import("../lib/analytics");
          let allEvents: any[] = [];
          for (const matchDoc of recentSnapshot.docs) { 
             const eventsQ = collection(db, "matches", matchDoc.id, "events");
             const eventsSnap = await getDocs(eventsQ);
             allEvents.push(...eventsSnap.docs.map(e => e.data()));
          }
          const lineups = calculateLineupStats(allEvents, "home", fetchedPlayers);
          setTopLineups(lineups.slice(0, 3));
      } catch (e) {
          console.error("Lineup stats error:", e);
      }
    };

    fetchStats();

    // Detect region for pricing display
    const countryCode = navigator.language.toUpperCase().split('-')[1] || 'US';
    setRegionPrice(getPriceUSD(countryCode));
  }, [user]);

  const handleUpgrade = async () => {
    try {
      const countryCode = navigator.language.toUpperCase().split('-')[1] || 'US';
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error("Stripe error:", error);
    }
  };

  const handleAddPlayer = async () => {
    if (!user || !newPlayer.name || !newPlayer.number || !newPlayer.teamId) return alert("Name, number, and team are required.");
    
    // Validate team roster limit (max 24)
    const teamPlayersCount = players.filter(p => p.teamId === newPlayer.teamId).length;
    if (teamPlayersCount >= 24) return alert("Roster full for this team (Max 24 players)");
    
    // Auto-assign as starter/bench if slots available, else inactive
    const startersCount = players.filter(p => p.isStarter).length;
    const benchCount = players.filter(p => p.isActive && !p.isStarter).length;
    
    let isStarter = false;
    let isActive = false;
    
    if (startersCount < 5) { isStarter = true; isActive = true; }
    else if (benchCount < 7) { isStarter = false; isActive = true; }

    try {
      const { addDoc, collection } = await import("firebase/firestore");
      const docRef = await addDoc(collection(db, "players"), {
        ...newPlayer,
        userId: user.uid,
        isActive,
        isStarter
      });
      setPlayers([...players, { id: docRef.id, ...newPlayer, isActive, isStarter } as Player]);
      setNewPlayer({ name: "", number: "", position: "G", height: "", weight: "", age: "", teamId: newPlayer.teamId });
      setIsAddingPlayer(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer || !editForm.name || !editForm.number) return;

    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "players", editingPlayer.id), {
        name: editForm.name,
        number: editForm.number,
        position: editForm.position,
        height: editForm.height,
        weight: editForm.weight,
        age: editForm.age,
        teamId: editForm.teamId
      });
      setPlayers(players.map(p => p.id === editingPlayer.id ? { ...p, ...editForm } : p));
      setEditingPlayer(null);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const togglePlayerStatus = async (player: Player) => {
    const startersCount = players.filter(p => p.isStarter).length;
    const activeCount = players.filter(p => p.isActive).length;

    let newIsStarter = player.isStarter;
    let newIsActive = player.isActive;

    if (player.isStarter) {
      // Demote to bench
      newIsStarter = false;
      newIsActive = true;
    } else if (player.isActive && !player.isStarter) {
      // Demote to inactive
      newIsActive = false;
      newIsStarter = false;
    } else {
      // Promote from inactive
      if (startersCount < 5) { newIsStarter = true; newIsActive = true; }
      else if (activeCount < 12) { newIsStarter = false; newIsActive = true; }
      else return alert("Game roster is full (12 players max). Demote someone first.");
    }

    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "players", player.id), { isActive: newIsActive, isStarter: newIsStarter });
      setPlayers(players.map(p => p.id === player.id ? { ...p, isActive: newIsActive, isStarter: newIsStarter } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const deletePlayer = async (id: string) => {
    if (!confirm("Are you sure you want to remove this player?")) return;
    try {
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "players", id));
      setPlayers(players.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const activePlayers = players.filter(p => p.isActive);
  const startersCount = players.filter(p => p.isStarter).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-neutral-900">{t('dashboard')}</h1>
        <p className="mt-2 text-neutral-600">Welcome back, {user?.displayName}. Here's your team's performance overview.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Matches Recorded", value: stats.totalMatches, icon: LayoutDashboard, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Win Prediction Accuracy", value: "84.2%", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Current Plan", value: stats.plan, icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "AI Insights Generated", value: "342", icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.color} mb-4`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-neutral-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Recent Matches</h2>
            <div className="divide-y divide-neutral-100">
              {recentMatches.length > 0 ? (
                recentMatches.map((match) => (
                  <div key={match.id} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500">
                        <LayoutDashboard className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{match.homeTeam} vs {match.awayTeam}</p>
                        <p className="text-xs text-neutral-500">{new Date(match.createdAt?.toDate()).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="text-sm font-medium text-orange-600 hover:text-orange-500">View Stats</button>
                  </div>
                ))
              ) : (
                <p className="py-4 text-sm text-neutral-500">No recent matches found.</p>
              )}
            </div>
          </div>

          {/* Roster Management Section */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Users className="h-5 w-5 text-orange-600"/> My Team Roster</h2>
                <p className="text-xs text-neutral-500">Database: {players.length}/24 | Game Day: {activePlayers.length}/12 (Starters: {startersCount}/5)</p>
              </div>
              <button onClick={() => setIsAddingPlayer(!isAddingPlayer)} disabled={players.length >= 24} className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 disabled:opacity-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {isAddingPlayer && (
              <div className="mb-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="Name" value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} className="flex-1 rounded-lg border px-3 py-1.5 text-sm" />
                  <input type="text" placeholder="#" value={newPlayer.number} onChange={e => setNewPlayer({...newPlayer, number: e.target.value})} className="w-16 rounded-lg border px-3 py-1.5 text-sm" />
                  <select value={newPlayer.position} onChange={e => setNewPlayer({...newPlayer, position: e.target.value})} className="rounded-lg border px-3 py-1.5 text-sm bg-white">
                    <option value="G">G</option><option value="F">F</option><option value="C">C</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Height (e.g. 6ft 2in)" value={newPlayer.height} onChange={e => setNewPlayer({...newPlayer, height: e.target.value})} className="flex-1 rounded-lg border px-3 py-1.5 text-sm" />
                  <input type="text" placeholder="Weight (lbs)" value={newPlayer.weight} onChange={e => setNewPlayer({...newPlayer, weight: e.target.value})} className="w-24 rounded-lg border px-3 py-1.5 text-sm" />
                  <input type="number" placeholder="Age" value={newPlayer.age} onChange={e => setNewPlayer({...newPlayer, age: e.target.value})} className="w-20 rounded-lg border px-3 py-1.5 text-sm" />
                </div>
                <div className="flex gap-2 items-center">
                  <select value={newPlayer.teamId} onChange={e => setNewPlayer({...newPlayer, teamId: e.target.value})} className="flex-1 rounded-lg border px-3 py-1.5 text-sm bg-white" required>
                     <option value="" disabled>Select Team...</option>
                     {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={handleAddPlayer} disabled={!newPlayer.teamId || !newPlayer.name || !newPlayer.number} className="px-6 py-1.5 bg-neutral-900 text-white text-sm font-bold rounded-lg hover:bg-neutral-800 disabled:opacity-50">Add</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
              {players.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-3 border rounded-xl ${p.isStarter ? 'border-orange-500 bg-orange-50' : p.isActive ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-black/5 text-black/60 flex items-center justify-center text-xs font-bold">{p.number}</span>
                    <div>
                      <p className="text-sm font-bold text-neutral-900 leading-tight">{p.name} {p.teamId ? <span className="text-neutral-400 font-normal">({teams.find(t => t.id === p.teamId)?.name || "No Team"})</span> : ""}</p>
                      <p className="text-[10px] uppercase font-bold text-neutral-500">{p.position} • {p.height ? `${p.height}` : '-'} • {p.weight ? `${p.weight}lbs` : '-'} • Age {p.age || '-'} • {p.isStarter ? 'Starter' : p.isActive ? 'Bench' : 'Inactive'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingPlayer(p); setEditForm({ name: p.name, number: p.number, position: p.position, height: p.height || "", weight: p.weight || "", age: p.age || "", teamId: p.teamId || "" }); }} title="Edit Player" className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => togglePlayerStatus(p)} title="Change Role" className={`p-1.5 rounded-lg ${p.isStarter ? 'bg-orange-500 text-white' : p.isActive ? 'bg-blue-500 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                      <Star className="h-3 w-3" />
                    </button>
                    <button onClick={() => deletePlayer(p.id)} title="Remove Player" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><UserMinus className="h-3 w-3"/></button>
                  </div>
                </div>
              ))}
              {players.length === 0 && <p className="text-sm text-neutral-500 col-span-2 text-center py-4">No players in database. Add up to 24.</p>}
            </div>
          </div>
        </div>

        {/* Subscription / Upgrade & Analytics */}
        <div className="space-y-6">
          
          {/* Top Lineups (Quintetos Ideales) */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-orange-500" /> {t("quintetos_ideales") || "Quintetos Ideales"}
            </h2>
            <div className="space-y-4">
               {topLineups.length > 0 ? (
                   topLineups.map((lineup, i) => (
                       <div key={i} className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                           <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">Lineup #{i+1}</span>
                               <span className={`text-sm font-black ${lineup.netRating >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                   {lineup.netRating >= 0 ? '+' : ''}{lineup.netRating}
                               </span>
                           </div>
                           <div className="flex flex-wrap gap-1">
                               {lineup.lineupNames.map((name: string, idx: number) => (
                                   <span key={idx} className="text-[10px] font-bold bg-white border border-neutral-200 px-1.5 py-0.5 rounded text-neutral-600">
                                       {name}
                                   </span>
                               ))}
                           </div>
                       </div>
                   ))
               ) : (
                   <p className="text-sm text-neutral-400 italic">Play games to generate lineup data.</p>
               )}
            </div>
          </div>

          <div className="rounded-2xl bg-orange-600 p-6 text-white shadow-lg">
            <h2 className="text-lg font-bold">HoopsAI Pro</h2>
            <p className="mt-2 text-sm text-orange-100">Get advanced tactical insights, unlimited match recording, and regional pricing.</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold bg-orange-700/50 w-fit px-2 py-1 rounded">
              <Globe className="h-3 w-3" />
              Regional Price: ${regionPrice}/mo
            </div>
            <ul className="mt-4 space-y-2 text-sm text-orange-100">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                DeepSeek AI Tactical Analysis
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                CSV/JSON Data Export
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                1 Month Free Trial
              </li>
            </ul>
            <button 
              onClick={handleUpgrade}
              className="mt-6 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-all"
            >
              Upgrade Now
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Quick Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Language</span>
                <span className="text-xs font-bold text-neutral-400 uppercase">EN / ES</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Email Notifications</span>
                <div className="h-5 w-10 rounded-full bg-orange-600 p-1 flex justify-end">
                  <div className="h-3 w-3 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">Edit Player</h3>
              <button onClick={() => setEditingPlayer(null)} className="p-2 hover:bg-neutral-100 rounded-full"><X className="h-5 w-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase">Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase">Number</label>
                  <input type="text" value={editForm.number} onChange={e => setEditForm({...editForm, number: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase">Position</label>
                  <select value={editForm.position} onChange={e => setEditForm({...editForm, position: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors bg-white">
                    <option value="G">G</option><option value="F">F</option><option value="C">C</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase">Height</label>
                  <input type="text" value={editForm.height} onChange={e => setEditForm({...editForm, height: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors" placeholder="e.g. 6ft 2in" />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase">Weight</label>
                  <input type="text" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors" placeholder="lbs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase">Age</label>
                  <input type="number" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase">Team Assignment</label>
                  <select value={editForm.teamId} onChange={e => setEditForm({...editForm, teamId: e.target.value})} className="w-full mt-1 px-4 py-2 rounded-xl border border-neutral-200 focus:border-orange-500 transition-colors bg-white">
                    <option value="" disabled>Select Team...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleUpdatePlayer} className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold mt-4 hover:bg-neutral-800">Save Changes</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
