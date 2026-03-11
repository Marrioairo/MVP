import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { motion } from "motion/react";
import { ArrowLeft, Plus, UserMinus, Pencil, Star, Shield, Users } from "lucide-react";
import { Player } from "../lib/types";

const TeamPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [team, setTeam] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    number: "",
    position: "G",
    age: "",
    height: "",
    weight: ""
  });

  useEffect(() => {
    if (!user || !teamId) return;
    const fetchData = async () => {
      try {
        const teamDoc = await getDoc(doc(db, "teams_v2", teamId));
        if (teamDoc.exists()) {
          setTeam({ id: teamDoc.id, ...teamDoc.data() });
        } else {
          alert("Team not found");
          navigate("/teams");
        }

        const q = query(collection(db, "players"), where("teamId", "==", teamId));
        const snap = await getDocs(q);
        setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchData();
  }, [user, teamId, navigate]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !teamId) return;
    
    // VALIDATION: Max 24 players limit
    if (players.length >= 24) {
      alert("Error: Maximum 24 players allowed per team.");
      return;
    }

    // Auto assign active / starter statuses
    const startersCount = players.filter(p => p.isStarter).length;
    const activeCount = players.filter(p => p.isActive).length;
    let isStarter = false;
    let isActive = false;
    if (startersCount < 5) { isStarter = true; isActive = true; }
    else if (activeCount < 12) { isStarter = false; isActive = true; }

    try {
      const payload = { ...formData, teamId, userId: user.uid, isStarter, isActive };
      const docRef = await addDoc(collection(db, "players"), payload);
      setPlayers([...players, { id: docRef.id, ...payload } as Player]);
      setIsAdding(false);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    try {
      await updateDoc(doc(db, "players", editingPlayer.id), formData);
      setPlayers(players.map(p => p.id === editingPlayer.id ? { ...p, ...formData } : p));
      setEditingPlayer(null);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm("Remove this player from the team?")) return;
    try {
      await deleteDoc(doc(db, "players", id));
      setPlayers(players.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (player: Player) => {
    const startersCount = players.filter(p => p.isStarter).length;
    const activeCount = players.filter(p => p.isActive).length;

    let newIsStarter = player.isStarter;
    let newIsActive = player.isActive;

    if (player.isStarter) {
      newIsStarter = false;
      newIsActive = true;
    } else if (player.isActive && !player.isStarter) {
      newIsActive = false;
      newIsStarter = false;
    } else {
      if (startersCount < 5) { newIsStarter = true; newIsActive = true; }
      else if (activeCount < 12) { newIsStarter = false; newIsActive = true; }
      else return alert("Game roster is full (max 12 active players). Demote someone first.");
    }

    try {
      await updateDoc(doc(db, "players", player.id), { isActive: newIsActive, isStarter: newIsStarter });
      setPlayers(players.map(p => p.id === player.id ? { ...p, isActive: newIsActive, isStarter: newIsStarter } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", number: "", position: "G", age: "", height: "", weight: "" });
  };

  if (loading) return <div className="p-10 text-center">Loading team data...</div>;
  if (!team) return null;

  const activePlayers = players.filter(p => p.isActive);
  const startersCount = players.filter(p => p.isStarter).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button onClick={() => navigate("/teams")} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 mb-6 font-medium">
        <ArrowLeft className="h-4 w-4" /> Back to Teams
      </button>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 mb-8 flex items-center gap-6">
        {team.logo ? (
          <img src={team.logo} alt={team.name} className="h-20 w-20 rounded-full object-cover border-4 border-indigo-50" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center border-4 border-indigo-100">
            <Shield className="h-10 w-10" />
          </div>
        )}
        <div>
          <h1 className="text-3xl font-black text-neutral-900">{team.name}</h1>
          <p className="text-neutral-500 font-medium">Coach: {team.coach || "N/A"}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600"/> Team Roster</h2>
            <p className="text-sm text-neutral-500">Database: {players.length}/24 | Game Day: {activePlayers.length}/12 (Starters: {startersCount}/5)</p>
          </div>
          
          <button 
            onClick={() => { setIsAdding(!isAdding); setEditingPlayer(null); resetForm(); }}
            disabled={players.length >= 24} 
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add Player
          </button>
        </div>

        {/* Add/Edit Form Overlay */}
        {(isAdding || editingPlayer) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 bg-neutral-50 p-6 rounded-2xl border border-neutral-200">
            <h3 className="font-bold mb-4">{editingPlayer ? "Edit Player" : "New Player"}</h3>
            <form onSubmit={editingPlayer ? handleUpdatePlayer : handleAddPlayer} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-neutral-500 uppercase">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase">Number</label>
                <input required type="text" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase">Position</label>
                <select value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} className="w-full mt-1 p-2 border rounded-lg bg-white">
                  <option value="G">Guard (G)</option><option value="F">Forward (F)</option><option value="C">Center (C)</option>
                </select>
              </div>
              <div className="col-span-full flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => { setIsAdding(false); setEditingPlayer(null); resetForm(); }} className="px-4 py-2 font-bold text-neutral-600 hover:bg-neutral-200 rounded-lg">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-black">{editingPlayer ? "Save" : "Add Player"}</button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {players.map(p => (
            <div key={p.id} className={`flex items-center justify-between p-4 border rounded-2xl ${p.isStarter ? 'border-orange-500 bg-orange-50' : p.isActive ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 bg-white'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${p.isStarter ? 'bg-orange-500 text-white' : p.isActive ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                  {p.number}
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900">{p.name}</h4>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{p.position} • {p.isStarter ? 'Starter' : p.isActive ? 'Bench' : 'Inactive'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleStatus(p)} title="Toggle Role" className={`p-2 rounded-lg ${p.isStarter ? 'bg-orange-500 text-white' : p.isActive ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}`}><Star className="h-4 w-4" /></button>
                <button onClick={() => { setEditingPlayer(p); setFormData({ name: p.name, number: p.number, position: p.position, age: p.age || "", height: p.height || "", weight: p.weight || "" }); }} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-lg"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDeletePlayer(p.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><UserMinus className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {players.length === 0 && (
             <div className="col-span-full py-12 text-center text-neutral-400">
               <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
               <p>No players added to this team yet.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamPage;
