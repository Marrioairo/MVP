import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trophy, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ScheduledMatch {
  id: string;
  tournamentId: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  date: any; // Firestore Timestamp
  location: string;
  status: "scheduled" | "completed";
}

interface Team { id: string; name: string; tournamentId: string; }
interface Tournament { id: string; name: string; }

const Agenda: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // New Match Form
  const [selectedTournament, setSelectedTournament] = useState("");
  const [selectedHome, setSelectedHome] = useState("");
  const [selectedAway, setSelectedAway] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [matchLocation, setMatchLocation] = useState("Main Court");

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch tournaments
      const qTournaments = query(collection(db, "tournaments"), where("userId", "==", user.uid));
      const snapTournaments = await getDocs(qTournaments);
      const fetchedTournaments = snapTournaments.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
      setTournaments(fetchedTournaments);

      // Fetch Teams
      const qTeams = query(collection(db, "teams_v2"), where("userId", "==", user.uid));
      const snapTeams = await getDocs(qTeams);
      setTeams(snapTeams.docs.map(d => ({ id: d.id, ...d.data() } as Team)));

      // Fetch Scheduled Matches
      const qMatches = query(collection(db, "matches_v2"), where("userId", "==", user.uid), orderBy("date", "asc"));
      const snapMatches = await getDocs(qMatches);
      setMatches(snapMatches.docs.filter(doc => doc.data().status === "scheduled").map(doc => ({ id: doc.id, ...doc.data() } as ScheduledMatch)));
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedHome || !selectedAway || selectedHome === selectedAway || !matchDate || !matchTime) return;

    try {
      const dt = new Date(`${matchDate}T${matchTime}`);
      const homeTeam = teams.find(t => t.id === selectedHome);
      const awayTeam = teams.find(t => t.id === selectedAway);

      if (!homeTeam || !awayTeam) return;

      const payload = {
        userId: user.uid,
        tournamentId: selectedTournament,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        date: Timestamp.fromDate(dt),
        location: matchLocation,
        status: "scheduled" as const,
        homeScore: 0,
        awayScore: 0,
        events: []
      };

      const docRef = await addDoc(collection(db, "matches_v2"), payload);
      setMatches([...matches, { id: docRef.id, ...payload }]);
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
              <CalendarIcon className="h-8 w-8 text-orange-600" />
              League Calendar
            </h1>
            <p className="text-neutral-500">Schedule weekend matches and orchestrate your tournaments.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all"
          >
            <Plus className="h-5 w-5" /> Schedule Match
          </button>
        </header>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-neutral-200 shadow-sm">
            <CalendarIcon className="h-16 w-16 text-neutral-200 mb-4" />
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Your Calendar is Empty</h3>
            <p className="text-neutral-500 max-w-md mx-auto">Click "Schedule Match" to set up your upcoming league games for Sunday. All players and organizers will see this global schedule.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {matches.map((match, i) => {
                const jsDate = match.date?.seconds ? new Date(match.date.seconds * 1000) : new Date();
                const day = jsDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                const time = jsDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                    key={match.id} 
                    className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-orange-600"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2 bg-orange-50 text-orange-700 font-bold text-xs uppercase px-3 py-1 rounded-full border border-orange-100">
                        <Clock className="h-3 w-3" /> {time}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-neutral-900">{day}</div>
                        <div className="flex items-center justify-end gap-1 text-xs text-neutral-500 mt-1">
                          <MapPin className="h-3 w-3" /> {match.location}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 mb-6">
                      <div className="text-center flex-1">
                        <div className="h-14 w-14 rounded-full bg-neutral-100 border-2 border-white shadow-sm mx-auto mb-2 flex items-center justify-center text-xl font-black text-neutral-400">
                           {match.homeTeamName[0]}
                        </div>
                        <div className="font-bold text-neutral-900 text-sm truncate px-2">{match.homeTeamName}</div>
                      </div>
                      
                      <div className="px-4 py-2 bg-neutral-900 rounded-xl text-white font-black text-xs uppercase tracking-widest">
                        VS
                      </div>

                      <div className="text-center flex-1">
                        <div className="h-14 w-14 rounded-full bg-neutral-100 border-2 border-white shadow-sm mx-auto mb-2 flex items-center justify-center text-xl font-black text-neutral-400">
                           {match.awayTeamName[0]}
                        </div>
                        <div className="font-bold text-neutral-900 text-sm truncate px-2">{match.awayTeamName}</div>
                      </div>
                    </div>

                    <button className="w-full bg-neutral-100 hover:bg-orange-600 hover:text-white text-neutral-700 font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                      <Trophy className="h-4 w-4" /> Start Official Game
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Modal Schedule Match */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
              <div className="bg-neutral-900 px-6 py-5 flex items-center justify-between">
                <h2 className="text-xl font-black text-white flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-orange-500"/> Schedule New Match</h2>
                <button onClick={() => setShowModal(false)} className="rounded-full bg-neutral-800 p-2 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors">
                  &times;
                </button>
              </div>
              <form onSubmit={handleScheduleMatch} className="p-6 space-y-5">
                
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">League / Tournament</label>
                  <select required value={selectedTournament} onChange={(e) => setSelectedTournament(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all">
                    <option value="">Select Tournament...</option>
                    {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Home Team</label>
                    <select required value={selectedHome} onChange={(e) => setSelectedHome(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all">
                      <option value="">Select Home...</option>
                      {teams.filter(t => !selectedTournament || t.tournamentId === selectedTournament).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Away Team</label>
                    <select required value={selectedAway} onChange={(e) => setSelectedAway(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all">
                      <option value="">Select Away...</option>
                      {teams.filter(t => !selectedTournament || t.tournamentId === selectedTournament).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Date (e.g., Sunday)</label>
                    <input type="date" required value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Time</label>
                    <input type="time" required value={matchTime} onChange={(e) => setMatchTime(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Court / Venue</label>
                  <input type="text" placeholder="e.g. Main Court" required value={matchLocation} onChange={(e) => setMatchLocation(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
                </div>

                <div className="mt-6">
                  <button type="submit" className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all flex items-center justify-center gap-2">
                    <CalendarIcon className="h-5 w-5" /> Confirm Schedule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Agenda;
