import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { Trophy, Plus, Settings } from "lucide-react";
import { motion } from "motion/react";

interface TournamentData {
  id: string;
  name: string;
  format: "knockout" | "league";
  teams: string[];
  status: "upcoming" | "ongoing" | "completed";
}

const Tournament: React.FC = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState<"knockout" | "league">("knockout");

  useEffect(() => {
    if (!user) return;
    const fetchTournaments = async () => {
      const q = query(collection(db, "tournaments"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const data: TournamentData[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as TournamentData);
      });
      setTournaments(data);
    };
    fetchTournaments();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;

    const newTournament = {
      userId: user.uid,
      name: newName,
      format: newFormat,
      teams: [],
      status: "upcoming",
      createdAt: Timestamp.now(),
    };

    try {
      const docRef = await addDoc(collection(db, "tournaments"), newTournament);
      setTournaments([...tournaments, { id: docRef.id, ...newTournament } as TournamentData]);
      setIsCreating(false);
      setNewName("");
    } catch (error) {
      console.error("Error creating tournament:", error);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Tournaments</h1>
          <p className="mt-2 text-neutral-500">Manage your leagues and knockout events.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          Create Tournament
        </button>
      </div>

      {isCreating && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">New Tournament</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Tournament Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="e.g. Summer Pro-Am"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Format</label>
              <select
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value as "knockout" | "league")}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
              >
                <option value="knockout">Knockout (Bracket)</option>
                <option value="league">League (Standings)</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
              >
                Save
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {tournaments.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">No tournaments yet</h3>
          <p className="mt-1 max-w-sm text-neutral-500">Create your first tournament to start tracking teams, brackets, and standings.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <div key={tournament.id} className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className={`h-5 w-5 ${tournament.format === 'knockout' ? 'text-orange-500' : 'text-blue-500'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      {tournament.format}
                    </span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    tournament.status === 'upcoming' ? 'bg-neutral-100 text-neutral-600' :
                    tournament.status === 'ongoing' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {tournament.status.toUpperCase()}
                  </span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-neutral-900">{tournament.name}</h3>
                <p className="text-sm text-neutral-500">{tournament.teams.length} Teams Enrolled</p>
                
                <div className="mt-6 flex items-center gap-2">
                  <button className="flex-1 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-900 hover:bg-neutral-200 transition-colors">
                    Manage
                  </button>
                  <button className="flex items-center justify-center rounded-xl bg-neutral-100 p-2 text-neutral-600 hover:bg-neutral-200 transition-colors">
                    <Settings className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-orange-500 to-orange-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tournament;
