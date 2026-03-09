import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Timer, Users, UserPlus, Play, Pause, RotateCcw, ChevronRight, Save, FileJson, FileText, AlertCircle, Download } from "lucide-react";

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

interface MatchEvent {
  id?: string;
  type: "1PT" | "2PT" | "3PT" | "REB_OFF" | "REB_DEF" | "AST" | "STL" | "BLK" | "TO" | "FOUL" | "SUB";
  playerId: string;
  playerName?: string;
  team: "home" | "away";
  quarter: number;
  time: string;
  timestamp: any;
}

const Scorekeeper: React.FC = () => {
  const { user } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);
  const [quarter, setQuarter] = useState(1);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([
    { id: "h1", name: "J. Smith", number: "23", position: "G" },
    { id: "h2", name: "A. Johnson", number: "15", position: "F" },
    { id: "h3", name: "M. Brown", number: "0", position: "G" },
    { id: "h4", name: "D. Davis", number: "34", position: "C" },
    { id: "h5", name: "K. Thompson", number: "11", position: "F" },
  ]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([
    { id: "a1", name: "L. James", number: "6", position: "F" },
    { id: "a2", name: "S. Curry", number: "30", position: "G" },
    { id: "a3", name: "K. Durant", number: "7", position: "F" },
    { id: "a4", name: "N. Jokic", number: "15", position: "C" },
    { id: "a5", name: "L. Doncic", number: "77", position: "G" },
  ]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away" | null>(null);

  // Add Player Modal State
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [addingToTeam, setAddingToTeam] = useState<"home" | "away" | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [newPlayerPosition, setNewPlayerPosition] = useState("G");

  const handleAddPlayer = () => {
    if (!newPlayerName || !newPlayerNumber) return;
    const newPlayer: Player = {
      id: `new_${Date.now()}`,
      name: newPlayerName,
      number: newPlayerNumber,
      position: newPlayerPosition,
    };
    if (addingToTeam === "home") {
      setHomePlayers([...homePlayers, newPlayer]);
    } else {
      setAwayPlayers([...awayPlayers, newPlayer]);
    }
    setIsAddPlayerModalOpen(false);
    setNewPlayerName("");
    setNewPlayerNumber("");
    setNewPlayerPosition("G");
  };

  const timerRef = useRef<any>(null);

  // SSE Listener for remote updates (if any)
  useEffect(() => {
    const eventSource = new EventSource("/api/events/sse");
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Remote Event Received:", data);
      // Optional: sync state if multiple people are scoring
    };
    return () => eventSource.close();
  }, []);

  // Timer Logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEvent = async (type: MatchEvent["type"]) => {
    if (!selectedPlayer || !selectedTeam || !user) return;

    const newEvent: MatchEvent = {
      type,
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      team: selectedTeam,
      quarter,
      time: formatTime(timeLeft),
      timestamp: Timestamp.now(),
    };

    setEvents((prev) => [newEvent, ...prev]);
    
    // Save to Local API (which broadcasts via SSE)
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvent, matchId }),
      });
    } catch (e) {
      console.error("Failed to sync event:", e);
    }

    // Save to Firestore
    if (matchId) {
      await addDoc(collection(db, "matches", matchId, "events"), newEvent);
    }

    setSelectedPlayer(null);
    setSelectedTeam(null);
  };

  const exportCSV = () => {
    const headers = ["Time", "Quarter", "Team", "Player", "Type"];
    const rows = events.map(e => [e.time, e.quarter, e.team, e.playerName, e.type]);
    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match-stats-${matchId || "live"}.csv`;
    a.click();
  };

  const startNewMatch = async () => {
    if (!user) return;
    const docRef = await addDoc(collection(db, "matches"), {
      userId: user.uid,
      homeTeam: "Home Team",
      awayTeam: "Away Team",
      status: "live",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    setMatchId(docRef.id);
  };

  const calculateScore = (team: "home" | "away") => {
    return events
      .filter((e) => e.team === team)
      .reduce((acc, e) => {
        if (e.type === "1PT") return acc + 1;
        if (e.type === "2PT") return acc + 2;
        if (e.type === "3PT") return acc + 3;
        return acc;
      }, 0);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-neutral-100">
      {/* Left Sidebar: Roster */}
      <aside className="w-80 flex-col border-r border-neutral-200 bg-white p-4 hidden lg:flex overflow-y-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Home Roster</h2>
            <button 
              onClick={() => { setAddingToTeam("home"); setIsAddPlayerModalOpen(true); }} 
              className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              title="Add Home Player"
            >
              <UserPlus className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {homePlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPlayer(p); setSelectedTeam("home"); }}
                className={`flex w-full items-center justify-between rounded-xl border p-3 transition-all ${
                  selectedPlayer?.id === p.id ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-neutral-100 hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-600">
                    {p.number}
                  </span>
                  <span className="text-sm font-medium text-neutral-800">{p.name}</span>
                </div>
                <span className="text-[10px] font-bold text-neutral-400">{p.position}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Away Roster</h2>
            <button 
              onClick={() => { setAddingToTeam("away"); setIsAddPlayerModalOpen(true); }} 
              className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              title="Add Away Player"
            >
              <UserPlus className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {awayPlayers.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPlayer(p); setSelectedTeam("away"); }}
                className={`flex w-full items-center justify-between rounded-xl border p-3 transition-all ${
                  selectedPlayer?.id === p.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-neutral-100 hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-600">
                    {p.number}
                  </span>
                  <span className="text-sm font-medium text-neutral-800">{p.name}</span>
                </div>
                <span className="text-[10px] font-bold text-neutral-400">{p.position}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Area: Controls & Live Feed */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar: Score & Timer */}
        <div className="bg-neutral-900 px-8 py-6 text-white shadow-xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="text-center">
              <div className="text-xs font-bold text-neutral-400 uppercase mb-1">Home</div>
              <div className="text-5xl font-black tabular-nums">{calculateScore("home")}</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2 w-2 rounded-full ${isRunning ? "bg-red-500 animate-pulse" : "bg-neutral-600"}`} />
                <span className="text-xs font-bold text-neutral-400 uppercase">Quarter {quarter}</span>
              </div>
              <div className="text-6xl font-black tracking-tighter tabular-nums mb-4">
                {formatTime(timeLeft)}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsRunning(!isRunning)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                    isRunning ? "bg-neutral-700 hover:bg-neutral-600" : "bg-orange-600 hover:bg-orange-500"
                  }`}
                >
                  {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
                </button>
                <button 
                  onClick={() => { setTimeLeft(600); setIsRunning(false); }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="text-center">
              <div className="text-xs font-bold text-neutral-400 uppercase mb-1">Away</div>
              <div className="text-5xl font-black tabular-nums">{calculateScore("away")}</div>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { type: "1PT", label: "+1 FT", color: "bg-emerald-600" },
                { type: "2PT", label: "+2 FG", color: "bg-emerald-600" },
                { type: "3PT", label: "+3 FG", color: "bg-emerald-600" },
                { type: "REB_OFF", label: "Off Reb", color: "bg-blue-600" },
                { type: "REB_DEF", label: "Def Reb", color: "bg-blue-600" },
                { type: "AST", label: "Assist", color: "bg-indigo-600" },
                { type: "STL", label: "Steal", color: "bg-indigo-600" },
                { type: "BLK", label: "Block", color: "bg-indigo-600" },
                { type: "TO", label: "Turnover", color: "bg-red-600" },
                { type: "FOUL", label: "Foul", color: "bg-red-600" },
              ].map((action) => (
                <button
                  key={action.type}
                  disabled={!selectedPlayer}
                  onClick={() => handleEvent(action.type as any)}
                  className={`flex flex-col items-center justify-center rounded-2xl p-6 text-white shadow-lg transition-all active:scale-95 disabled:opacity-30 disabled:grayscale ${action.color} hover:brightness-110`}
                >
                  <span className="text-lg font-black">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Live Feed */}
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-600 uppercase tracking-wider">Play-by-Play Feed</h3>
                {!matchId && (
                  <button 
                    onClick={startNewMatch}
                    className="text-xs font-bold text-orange-600 hover:text-orange-500 flex items-center gap-1"
                  >
                    <Save className="h-3 w-3" /> Start Recording
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
                <AnimatePresence initial={false}>
                  {events.map((e, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 px-6 py-3 text-sm"
                    >
                      <span className="w-12 font-mono text-neutral-400">{e.time}</span>
                      <span className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white ${e.team === "home" ? "bg-orange-500" : "bg-blue-500"}`}>
                        {e.team === "home" ? "H" : "A"}
                      </span>
                      <span className="flex-1 text-neutral-800">
                        <span className="font-bold">{e.playerName}</span> recorded a <span className="font-bold text-orange-600">{e.type}</span>
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400">Q{e.quarter}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {events.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-sm">No events recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Export Options */}
        <div className="border-t border-neutral-200 bg-white px-8 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  const data = JSON.stringify(events, null, 2);
                  const blob = new Blob([data], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `match-${matchId || "live"}.json`;
                  a.click();
                }}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                <FileJson className="h-3.5 w-3.5" /> Export JSON
              </button>
              <button 
                onClick={exportCSV}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                <FileText className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
            <div className="text-xs text-neutral-400">
              {selectedPlayer ? `Selected: ${selectedPlayer.name} (#${selectedPlayer.number})` : "Select a player to record an action"}
            </div>
          </div>
        </div>
      </main>

      {/* Add Player Modal */}
      {isAddPlayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-neutral-900">Add Player to {addingToTeam === "home" ? "Home" : "Away"} Team</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="e.g. M. Jordan"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Number</label>
                  <input
                    type="text"
                    value={newPlayerNumber}
                    onChange={(e) => setNewPlayerNumber(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="e.g. 23"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700">Position</label>
                  <select
                    value={newPlayerPosition}
                    onChange={(e) => setNewPlayerPosition(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                  >
                    <option value="G">Guard (G)</option>
                    <option value="F">Forward (F)</option>
                    <option value="C">Center (C)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsAddPlayerModalOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                disabled={!newPlayerName || !newPlayerNumber}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scorekeeper;
