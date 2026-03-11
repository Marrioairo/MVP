import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { motion } from "motion/react";
import { Trophy, Plus, Settings, Trash2, Edit2, X, Check, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface Tournament {
  id: string;
  name: string;
  location: string;
  season: string;
  startDate: string;
  endDate: string;
  userId: string;
}

const TournamentsAdmin: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    location: "",
    season: new Date().getFullYear().toString(),
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (!user) return;
    fetchTournaments();
  }, [user]);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "tournaments_v2"), where("userId", "==", user!.uid));
      const snap = await getDocs(q);
      setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const payload = { ...formData, userId: user.uid, createdAt: Timestamp.now() };
      const docRef = await addDoc(collection(db, "tournaments_v2"), payload);
      setTournaments([...tournaments, { id: docRef.id, ...payload }]);
      setIsCreating(false);
      resetForm();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await updateDoc(doc(db, "tournaments_v2", editingId), formData);
      setTournaments(tournaments.map(t => t.id === editingId ? { ...t, ...formData } : t));
      setEditingId(null);
      resetForm();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tournament? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "tournaments_v2", id));
      setTournaments(tournaments.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", location: "", season: new Date().getFullYear().toString(), startDate: "", endDate: "" });
  };

  const openEdit = (t: Tournament) => {
    setEditingId(t.id);
    setFormData({ name: t.name, location: t.location || "", season: t.season || "", startDate: t.startDate || "", endDate: t.endDate || "" });
  };

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleCreatePrompt = () => {
    // Basic MVP Logic: Limit free users to 1 tournament
    const isPremium = false; // Note: In production, check user.claims.stripeRole or userDoc.isPremium

    if (!isPremium && tournaments.length >= 1) {
      setShowUpgradeModal(true);
      return;
    }
    setIsCreating(true);
  };

  if (loading) return <div className="p-8 text-center text-neutral-500">Loading tournaments...</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-orange-600" /> Tournament Management
          </h1>
          <p className="mt-2 text-neutral-600">Create and edit regional or national basketball tournaments.</p>
        </div>
        {!isCreating && !editingId && (
          <button onClick={handleCreatePrompt} className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all">
            <Plus className="h-5 w-5" /> New Tournament
          </button>
        )}
      </header>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-8 text-center">
            <div className="mx-auto h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
              <Trophy className="h-8 w-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-black text-neutral-900 mb-2">Upgrade to Premium</h2>
            <p className="text-neutral-500 mb-8">You've reached the limit of 1 tournament for free accounts. Upgrade to unlock unlimited tournaments, AI tactical advice for your coaches, and automatic MVP NBA-style selection.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => window.location.hash = "#/profile"} className="w-full rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all">
                View Upgrade Options
              </button>
              <button onClick={() => setShowUpgradeModal(false)} className="w-full rounded-xl bg-neutral-100 py-3 text-sm font-bold text-neutral-600 hover:bg-neutral-200 transition-all">
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {(isCreating || editingId) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8 border border-neutral-200">
          <div className="p-6 bg-neutral-50 border-b border-neutral-100 flex justify-between items-center">
            <h2 className="text-xl font-black">{editingId ? "Edit Tournament" : "Create Tournament"}</h2>
            <button onClick={() => { setIsCreating(false); setEditingId(null); resetForm(); }} className="p-2 hover:bg-neutral-200 rounded-full"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={editingId ? handleUpdate : handleCreate} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Tournament Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-3 bg-neutral-50" placeholder="e.g. Summer League 2026" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Location</label>
              <input type="text" required value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-3 bg-neutral-50" placeholder="e.g. Los Angeles, CA" />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-700 mb-2">Season</label>
              <input type="text" required value={formData.season} onChange={e => setFormData({ ...formData, season: e.target.value })} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-3 bg-neutral-50" placeholder="e.g. 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">Start Date</label>
                <input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-3 bg-neutral-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-2">End Date</label>
                <input type="date" required value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} className="w-full rounded-xl border-neutral-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 p-3 bg-neutral-50" />
              </div>
            </div>
            <div className="md:col-span-2 pt-4 flex justify-end gap-3">
              <button type="button" onClick={() => { setIsCreating(false); setEditingId(null); resetForm(); }} className="px-6 py-3 font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors">Cancel</button>
              <button type="submit" className="flex items-center gap-2 px-8 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors shadow-md">
                <Check className="h-5 w-5" /> {editingId ? "Save Changes" : "Create Tournament"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map(t => (
          <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-neutral-900 leading-tight">{t.name}</h3>
                  <p className="text-sm font-medium text-neutral-500">{t.season}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6 flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Location:</span>
                <span className="font-bold text-neutral-900">{t.location}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Dates:</span>
                <span className="font-bold text-neutral-900">{t.startDate} - {t.endDate}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-neutral-100">
              <button onClick={() => window.location.hash = `#/tournaments/${t.id}/mvp`} className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl transition-all shadow-md shadow-orange-600/20">
                <Star className="h-4 w-4" /> Select MVP (AI)
              </button>
              <div className="flex gap-2">
                <button onClick={() => openEdit(t)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl transition-colors">
                  <Edit2 className="h-4 w-4" /> Edit
                </button>
                <button onClick={() => handleDelete(t.id)} className="flex items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {tournaments.length === 0 && !isCreating && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-neutral-300 rounded-3xl">
            <Trophy className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-neutral-900 mb-2">No tournaments yet</h3>
            <p className="text-neutral-500 mb-6">Create your first tournament to get started.</p>
            <button onClick={handleCreatePrompt} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-700 transition-all">
              <Plus className="h-5 w-5" /> Create Tournament
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentsAdmin;
