import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { motion } from "motion/react";
import { Shield, Plus, Trash2, Edit2, X, Check, Image as ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tournament } from "./TournamentsAdmin";

export interface Team {
  id: string;
  name: string;
  logo: string;
  coach: string;
  tournamentId: string;
  userId: string;
}

const TeamsAdmin: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    logo: "",
    coach: "",
    tournamentId: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const tQ = query(collection(db, "tournaments_v2"), where("userId", "==", user.uid));
        const tSnap = await getDocs(tQ);
        const fetchedTournaments = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
        setTournaments(fetchedTournaments);

        const q = query(collection(db, "teams_v2"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const payload = { ...formData, userId: user.uid, createdAt: Timestamp.now() };
      const docRef = await addDoc(collection(db, "teams_v2"), payload);
      setTeams([...teams, { id: docRef.id, ...payload }]);
      setIsCreating(false);
      resetForm();
      // Instantly redirect to the new team page to fulfill prompt req
      window.location.hash = `#/teams/${docRef.id}`;
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await updateDoc(doc(db, "teams_v2", editingId), formData);
      setTeams(teams.map(t => t.id === editingId ? { ...t, ...formData } : t));
      setEditingId(null);
      resetForm();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "teams_v2", id));
      setTeams(teams.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", logo: "", coach: "", tournamentId: tournaments[0]?.id || "" });
  };

  const openEdit = (t: Team) => {
    setEditingId(t.id);
    setFormData({ name: t.name, logo: t.logo || "", coach: t.coach || "", tournamentId: t.tournamentId || "" });
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">Loading teams...</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-indigo-600" /> Team Management
          </h1>
          <p className="mt-2 text-neutral-600">Register and manage teams within your tournaments.</p>
        </div>
        {!isCreating && !editingId && (
          <button onClick={() => { setIsCreating(true); resetForm(); }} disabled={tournaments.length === 0} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="h-5 w-5" /> New Team
          </button>
        )}
      </header>

      {tournaments.length === 0 && !loading && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl mb-8 border border-yellow-200">
          <strong>Notice:</strong> You must create a Tournament first before you can register any Teams.
        </div>
      )}

      {(isCreating || editingId) && tournaments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8 border border-neutral-200">
          <div className="p-6 bg-neutral-50 border-b border-neutral-100 flex justify-between items-center">
            <h2 className="text-xl font-black">{editingId ? "Edit Team" : "Register Team"}</h2>
            <button onClick={() => { setIsCreating(false); setEditingId(null); resetForm(); }} className="p-2 hover:bg-neutral-200 rounded-full"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={editingId ? handleUpdate : handleCreate} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Team Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-neutral-50" placeholder="e.g. Lakers" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Tournament Assignment</label>
              <select required value={formData.tournamentId} onChange={e => setFormData({...formData, tournamentId: e.target.value})} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-neutral-50">
                <option value="" disabled>Select a tournament...</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.season})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Coach Name</label>
              <input type="text" required value={formData.coach} onChange={e => setFormData({...formData, coach: e.target.value})} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-neutral-50" placeholder="e.g. Phil Jackson" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Logo URL (Optional)</label>
              <input type="url" value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-neutral-50" placeholder="https://..." />
            </div>
            <div className="md:col-span-2 pt-4 flex justify-end gap-3 border-t border-neutral-100">
              <button type="button" onClick={() => { setIsCreating(false); setEditingId(null); resetForm(); }} className="px-6 py-3 font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
              <button type="submit" className="flex items-center gap-2 px-8 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-md">
                <Check className="h-5 w-5" /> {editingId ? "Save Changes" : "Register Team"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(t => {
          const tournament = tournaments.find(tour => tour.id === t.tournamentId);
          return (
          <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 flex flex-col hover:shadow-md transition-shadow">
            <div 
              className="flex items-center gap-4 mb-4 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.location.hash = `#/teams/${t.id}`}
            >
              {t.logo ? (
                 <img src={t.logo} alt={t.name} className="h-14 w-14 rounded-full object-cover border-2 border-indigo-100" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center border-2 border-indigo-100">
                  <Shield className="h-7 w-7" />
                </div>
              )}
              <div>
                <h3 className="font-black text-xl text-neutral-900 leading-tight hover:underline">{t.name}</h3>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{tournament?.name || "Unknown Tournament"}</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-6 flex-1 bg-neutral-50 p-4 rounded-2xl">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Coach:</span>
                <span className="font-bold text-neutral-900">{t.coach || "N/A"}</span>
              </div>
            </div>

            <div className="flex gap-2 border-t border-neutral-100 pt-4">
              <button onClick={() => openEdit(t)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors">
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button onClick={() => handleDelete(t.id)} className="flex items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )})}
        {teams.length === 0 && !isCreating && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-neutral-300 rounded-3xl">
            <Shield className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-neutral-900 mb-2">No teams registered</h3>
            <p className="text-neutral-500 mb-6">Create your first team and assign it to a tournament.</p>
            <button onClick={() => { setIsCreating(true); resetForm(); }} disabled={tournaments.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white hover:bg-indigo-700 transition-all disabled:opacity-50">
              <Plus className="h-5 w-5" /> Register Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamsAdmin;
