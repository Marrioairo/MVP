import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Trophy, Shield, Users, CheckCircle, AlertCircle, Play } from "lucide-react";

const CreateGame: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  
  const [selectedTournament, setSelectedTournament] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");

  // New Multimodal Engine States
  const [modality, setModality] = useState<"5x5 FIBA" | "3x3 Relámpago" | "Formativa">("5x5 FIBA");
  const [category, setCategory] = useState<string>("Libre");
  // Custom Period Engine (Class Match:: n periods x minutes)
  const [numPeriods, setNumPeriods] = useState<number>(4);
  const [periodMinutes, setPeriodMinutes] = useState<number>(10);
  
  const [homeActive, setHomeActive] = useState<{ id: string, name: string, isStarter: boolean, number: string, position: string }[]>([]);
  const [awayActive, setAwayActive] = useState<{ id: string, name: string, isStarter: boolean, number: string, position: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchBaseData = async () => {
      const tQ = query(collection(db, "tournaments_v2"), where("userId", "==", user.uid));
      const tSnap = await getDocs(tQ);
      setTournaments(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const tmQ = query(collection(db, "teams_v2"), where("userId", "==", user.uid));
      const tmSnap = await getDocs(tmQ);
      setTeams(tmSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const pQ = query(collection(db, "players"), where("userId", "==", user.uid));
      const pSnap = await getDocs(pQ);
      setPlayers(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchBaseData();
  }, [user]);

  // Filter teams by tournament
  const availableTeams = teams.filter(t => t.tournamentId === selectedTournament);

  // Filter players by team
  const homeRoster = players.filter(p => p.teamId === homeTeam);
  const awayRoster = players.filter(p => p.teamId === awayTeam);

  useEffect(() => {
    setHomeActive([]);
    setAwayActive([]);
  }, [homeTeam, awayTeam]);

  const togglePlayerActive = (p: any, isHome: boolean) => {
    const list = isHome ? homeActive : awayActive;
    const setList = isHome ? setHomeActive : setAwayActive;
    
    if (list.find(x => x.id === p.id)) {
      setList(list.filter(x => x.id !== p.id));
    } else {
      if (list.length >= 12) return alert("Roster full (12 players max)");
      setList([...list, { id: p.id, name: p.name, number: p.number || "", position: p.position || "G", isStarter: false }]);
    }
  };

  const toggleStarter = (id: string, isHome: boolean) => {
    const list = isHome ? homeActive : awayActive;
    const setList = isHome ? setHomeActive : setAwayActive;
    
    const isCurrentlyStarter = list.find(x => x.id === id)?.isStarter;
    const startersCount = list.filter(x => x.isStarter).length;
    
    if (!isCurrentlyStarter && startersCount >= 5) {
      return alert("Only 5 starters allowed on the court.");
    }
    
    setList(list.map(x => x.id === id ? { ...x, isStarter: !x.isStarter } : x));
  };

  const handleCreateGame = async () => {
    const homeStarters = homeActive.filter(p => p.isStarter).length;
    const awayStarters = awayActive.filter(p => p.isStarter).length;

    // Validate active starter requirements purely based on game modality
    const requiredStarters = modality === "3x3 Relámpago" ? 3 : 5;

    if (homeStarters !== requiredStarters || awayStarters !== requiredStarters) {
      return alert(`Modalidad ${modality} requiere ${requiredStarters} iniciales. Local: ${homeStarters}, Visita: ${awayStarters}`);
    }

    if (!user) return;

    try {
      const matchData = {
        userId: user.uid,
        tournamentId: selectedTournament,
        homeTeamId: homeTeam,
        awayTeamId: awayTeam,
        homeTeamName: teams.find(t => t.id === homeTeam)?.name || "Home",
        awayTeamName: teams.find(t => t.id === awayTeam)?.name || "Away",
        homePlayers: homeActive,
        awayPlayers: awayActive,
        modality, 
        category,
        numPeriods,
        periodMinutes,
        status: "in_progress",
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, "matches_v2"), matchData);
      navigate(`/scorekeeper?matchId=${docRef.id}`);
    } catch (e) {
      console.error(e);
      alert("Error creating game");
    }
  };

  const renderRosterSelection = (roster: any[], activeList: any[], isHome: boolean) => {
    const requiredStarters = modality === "3x3 Relámpago" ? 3 : 5;
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
        <h3 className="font-bold mb-4 flex justify-between items-center text-lg">
          {isHome ? "Home Team" : "Away Team"} Roster
          <span className="text-sm font-normal text-neutral-500">{activeList.length}/12 Active | {activeList.filter(p => p.isStarter).length}/{requiredStarters} Starters</span>
        </h3>
        {roster.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">No players found for this team.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {roster.map(p => {
              const activeInfo = activeList.find(x => x.id === p.id);
              const isActive = !!activeInfo;
              const isStarter = activeInfo?.isStarter;
              
              return (
                <div key={p.id} className={`flex items-center justify-between p-3 border rounded-xl ${isStarter ? 'border-orange-500 bg-orange-50' : isActive ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => togglePlayerActive(p, isHome)} className={`w-5 h-5 rounded border flex items-center justify-center ${isActive ? 'bg-black border-black text-white' : 'border-neutral-300'}`}>
                      {isActive && <CheckCircle className="w-3 h-3" />}
                    </button>
                    <div>
                      <span className="font-bold text-sm">#{p.number} {p.name}</span>
                    </div>
                  </div>
                  {isActive && (
                    <button onClick={() => toggleStarter(p.id, isHome)} className={`text-xs px-3 py-1 rounded-full font-bold ${isStarter ? 'bg-orange-500 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                      {isStarter ? 'Starter' : 'Bench'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-neutral-900 flex items-center gap-3">
          <Play className="h-8 w-8 text-orange-600" /> Create Game
        </h1>
        <p className="mt-2 text-neutral-600">Select teams, assign 12-man game rosters, and start scoring.</p>
      </header>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div>
           <label className="block text-sm font-bold text-neutral-700 mb-2">Tournament</label>
           <select value={selectedTournament} onChange={e => { setSelectedTournament(e.target.value); setHomeTeam(""); setAwayTeam(""); }} className="w-full rounded-xl border-neutral-300 bg-neutral-50 p-3">
             <option value="">-- Select Tournament --</option>
             {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
           </select>
        </div>
        <div>
           <label className="block text-sm font-bold text-neutral-700 mb-2">Home Team</label>
           <select disabled={!selectedTournament} value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="w-full rounded-xl border-neutral-300 bg-neutral-50 p-3">
             <option value="">-- Select Home --</option>
             {availableTeams.filter(t => t.id !== awayTeam).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
           </select>
        </div>
        <div>
           <label className="block text-sm font-bold text-neutral-700 mb-2">Away Team</label>
           <select disabled={!selectedTournament} value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="w-full rounded-xl border-neutral-300 bg-neutral-50 p-3">
             <option value="">-- Select Away --</option>
             {availableTeams.filter(t => t.id !== homeTeam).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
           </select>
        </div>
        <div>
           <label className="block text-sm font-bold text-neutral-700 mb-2">FIBA Modality</label>
           <select value={modality} onChange={e => setModality(e.target.value as any)} className="w-full rounded-xl border-neutral-300 bg-orange-50 font-bold text-orange-800 p-3 border-orange-200">
             <option value="5x5 FIBA">5x5 Profesional / FIBA</option>
             <option value="3x3 Relámpago">FIBA 3x3 Relámpago</option>
             <option value="Formativa">Formativa (Minibasket)</option>
           </select>
        </div>
        <div>
           <label className="block text-sm font-bold text-neutral-700 mb-2">Category (Age)</label>
           <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border-neutral-300 bg-neutral-50 p-3">
               <option value="Pañales">Pañales (U6)</option>
               <option value="U8">Micro (U8)</option>
               <option value="U10">Mini (U10)</option>
               <option value="U12">Pasarela (U12)</option>
               <option value="U15">Cadete (U15)</option>
               <option value="U18">Juvenil (U18)</option>
               <option value="Libre">Libre / Abierta</option>
               <option value="Master">Master (+40/+50)</option>
           </select>
        </div>
        {/* Custom Period Engine */}
        <div className="col-span-full mt-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-5 border border-orange-200">
          <h3 className="text-sm font-black text-orange-800 uppercase tracking-widest mb-4">⏱ Motor de Períodos Personalizado</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-2">Número de Períodos</label>
              <input
                type="number" min={1} max={8} value={numPeriods}
                onChange={e => setNumPeriods(Number(e.target.value))}
                className="w-full rounded-xl border border-orange-300 bg-white p-3 text-center text-lg font-black text-orange-700 focus:ring-2 focus:ring-orange-400"
              />
              <p className="text-[10px] text-neutral-400 mt-1 text-center">1 – 8 períodos</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-600 mb-2">Minutos por Período</label>
              <input
                type="number" min={1} max={20} value={periodMinutes}
                onChange={e => setPeriodMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-orange-300 bg-white p-3 text-center text-lg font-black text-orange-700 focus:ring-2 focus:ring-orange-400"
              />
              <p className="text-[10px] text-neutral-400 mt-1 text-center">1 – 20 min</p>
            </div>
            <div className="col-span-2 flex items-center justify-center bg-white rounded-xl border border-orange-200 p-3">
              <div className="text-center">
                <div className="text-3xl font-black text-orange-700">{numPeriods} × {periodMinutes}<span className="text-sm font-bold text-neutral-500 ml-1">min</span></div>
                <div className="text-xs text-neutral-500 mt-1">Duración total: <b className="text-neutral-800">{numPeriods * periodMinutes} minutos</b> ({modality === "3x3 Relámpago" ? "o hasta 21 pts" : `${numPeriods} cuartos`})</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {homeTeam && awayTeam && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {renderRosterSelection(homeRoster, homeActive, true)}
          {renderRosterSelection(awayRoster, awayActive, false)}
        </div>
      )}

      {homeTeam && awayTeam && (
        <div className="flex justify-end border-t border-neutral-200 pt-6">
          <button 
            onClick={handleCreateGame}
            className="flex items-center gap-2 px-8 py-4 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20 text-lg"
          >
            Start Match & Go to Scorekeeper <Play className="h-5 w-5 fill-current" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateGame;
