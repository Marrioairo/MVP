import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db, storage } from "../lib/firebase";
import { collection, addDoc, query, where, getDocs, Timestamp, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Trophy, Plus, Settings, UserPlus, Camera, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

interface Player { id: string; name: string; number: string; }

interface TournamentData {
  id: string;
  name: string;
  format: "knockout" | "league";
  teams: string[];
  enrolledPlayers?: { id: string; name: string; photoURL: string }[];
  status: "upcoming" | "ongoing" | "completed";
}

const Tournament: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState<"knockout" | "league">("knockout");

  // Enrollment State
  const [enrollingTournament, setEnrollingTournament] = useState<TournamentData | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [photoOption, setPhotoOption] = useState<"real" | "generic">("real");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

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

    const fetchPlayers = async () => {
      const q = query(collection(db, "players"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      setAvailablePlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player)));
    };

    fetchTournaments();
    fetchPlayers();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;

    const newTournament = {
      userId: user.uid,
      name: newName,
      format: newFormat,
      teams: [],
      enrolledPlayers: [],
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

  const handleEnrollPlayer = async () => {
    if (!selectedPlayerId || !enrollingTournament || !user) return;
    
    setIsUploading(true);
    try {
      let photoURL = "";
      if (uploadFile) {
        const fileRef = ref(storage, `tournaments/${enrollingTournament.id}/${selectedPlayerId}_${Date.now()}`);
        await uploadBytes(fileRef, uploadFile);
        photoURL = await getDownloadURL(fileRef);
      }

      const player = availablePlayers.find(p => p.id === selectedPlayerId);
      if (!player) return;

      const enrollmentData = {
        id: player.id,
        name: player.name,
        photoURL,
        enrolledAt: Timestamp.now()
      };

      const tournamentRef = doc(db, "tournaments", enrollingTournament.id);
      await updateDoc(tournamentRef, {
        enrolledPlayers: arrayUnion(enrollmentData)
      });

      // Update local state
      setTournaments(tournaments.map(t => 
        t.id === enrollingTournament.id 
          ? { ...t, enrolledPlayers: [...(t.enrolledPlayers || []), enrollmentData] } 
          : t
      ));

      setEnrollingTournament(null);
      setSelectedPlayerId("");
      setUploadFile(null);
      setPhotoOption("real");
      alert("Player enrolled successfully! 🏀");
    } catch (error) {
      console.error("Enrollment error:", error);
      alert("Error enrolling player. Check console.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">{t("tournaments")}</h1>
          <p className="mt-2 text-neutral-500">{t("tournaments_desc")}</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 transition-all"
        >
          <Plus className="h-4 w-4" />
          {t("create_tournament")}
        </button>
      </div>

      {isCreating && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("new_tournament")}</h2>
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">{t("tournament_name")}</label>
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
              <label className="mb-1 block text-sm font-medium text-neutral-700">{t("format")}</label>
              <select
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value as "knockout" | "league")}
                className="w-full rounded-xl border border-neutral-200 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
              >
                <option value="knockout">{t("knockout")}</option>
                <option value="league">{t("league")}</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-800"
              >
                {t("save")}
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
          <h3 className="text-lg font-bold text-neutral-900">{t("no_tournaments_yet")}</h3>
          <p className="mt-1 max-w-sm text-neutral-500">{t("create_first_tournament")}</p>
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
                <p className="text-sm text-neutral-500">{tournament.teams.length} {t("teams_enrolled")}</p>
                
                <div className="mt-6 flex items-center gap-2">
                  <button onClick={() => setEnrollingTournament(tournament)} className="flex items-center justify-center gap-2 flex-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 transition-all shadow-sm">
                    <UserPlus className="h-4 w-4" />
                    {t("enroll")}
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

      {/* Enrollment Modal */}
      <AnimatePresence>
        {enrollingTournament && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-lg bg-white rounded-[32px] p-8 shadow-2xl overflow-hidden relative">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-black text-neutral-900 leading-tight">{t("enroll_player")}</h3>
                  <p className="text-sm text-neutral-500 font-medium">{enrollingTournament.name}</p>
                </div>
                <button onClick={() => setEnrollingTournament(null)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors"><X className="h-5 w-5"/></button>
              </div>

              <div className="space-y-6">
                {/* Player Selection */}
                <div>
                  <label className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2 block">{t("choose_athlete")}</label>
                  <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} className="w-full rounded-2xl border-2 border-neutral-100 bg-neutral-50 px-4 py-3 outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-neutral-700">
                    <option value="">{t("select_from_roster")}</option>
                    {availablePlayers.map(p => (
                      <option key={p.id} value={p.id}>{p.number} - {p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Photo Upload Area */}
                <div>
                  <div className="flex bg-neutral-100 rounded-xl p-1 mb-4">
                    <button onClick={() => setPhotoOption("real")} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${photoOption === 'real' ? 'bg-white shadow-sm text-orange-600' : 'text-neutral-500 hover:text-neutral-700'}`}>{t("real_photo")}</button>
                    <button onClick={() => { setPhotoOption("generic"); setUploadFile(null); }} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${photoOption === 'generic' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>{t("generic_avatar")}</button>
                  </div>

                  {photoOption === "real" ? (
                    <div>
                      <label className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2 block">{t("upload_image")}</label>
                      <div className="relative group">
                        <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="hidden" id="photo-upload" />
                        <label htmlFor="photo-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-200 rounded-2xl cursor-pointer hover:border-orange-500 hover:bg-orange-50/50 transition-all overflow-hidden bg-neutral-50">
                          {uploadFile ? (
                            <div className="flex flex-col items-center">
                              <Check className="h-8 w-8 text-emerald-500 mb-2" />
                              <span className="text-sm font-bold text-neutral-600">{uploadFile.name}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Camera className="h-8 w-8 text-neutral-400 mb-2 group-hover:text-orange-500 transition-colors" />
                              <span className="text-sm font-bold text-neutral-500 group-hover:text-orange-500">{t("tap_to_upload")}</span>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2 block">{t("generic_photo_selected")}</label>
                      <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-100 rounded-2xl bg-neutral-50">
                        <div className="h-16 w-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center shadow-inner border-2 border-white">
                          <UserPlus className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-bold text-neutral-400 mt-2">{t("no_photo_required")}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={handleEnrollPlayer} disabled={!selectedPlayerId || isUploading} className={`w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${isUploading ? 'bg-neutral-300' : 'bg-neutral-900 hover:bg-black active:scale-[0.98]'}`}>
                  {isUploading ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </>
                  ) : (
                    <>{t("register_player")}</>
                  )}
                </button>
              </div>

              {/* List of already enrolled players */}
              {enrollingTournament.enrolledPlayers && enrollingTournament.enrolledPlayers.length > 0 && (
                <div className="mt-8 pt-6 border-t border-neutral-100">
                  <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">{t("enrolled_players")} ({enrollingTournament.enrolledPlayers.length})</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {enrollingTournament.enrolledPlayers.map(p => (
                      <div key={p.id} className="flex flex-col items-center gap-1">
                        <div className="h-12 w-12 rounded-full bg-neutral-100 overflow-hidden border-2 border-white shadow-sm ring-1 ring-neutral-100">
                          {p.photoURL ? <img src={p.photoURL} alt={p.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-orange-100" />}
                        </div>
                        <span className="text-[10px] font-bold text-neutral-500 truncate w-full text-center">{p.name.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tournament;
