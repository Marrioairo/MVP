import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Compare from "./pages/Compare";
import Scorekeeper from "./pages/Scorekeeper";
import Stats from "./pages/Stats";
import Tournament from "./pages/Tournament";
import TournamentsAdmin from "./pages/TournamentsAdmin";
import TournamentMVP from "./pages/TournamentMVP";
import TeamsAdmin from "./pages/TeamsAdmin";
import TeamPage from "./pages/TeamPage";
import CreateGame from "./pages/CreateGame";
import Finances from "./pages/Finances";
import Scouting from "./pages/Scouting";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Agenda from "./pages/Agenda";
import Navbar from "./components/Navbar";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
            <Route path="/scorekeeper" element={<ProtectedRoute><Scorekeeper /></ProtectedRoute>} />
            <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
            <Route path="/tournaments" element={<ProtectedRoute><TournamentsAdmin /></ProtectedRoute>} />
            <Route path="/tournaments/:tournamentId/mvp" element={<ProtectedRoute><TournamentMVP /></ProtectedRoute>} />
            <Route path="/teams" element={<ProtectedRoute><TeamsAdmin /></ProtectedRoute>} />
            <Route path="/teams/:teamId" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
            <Route path="/create-game" element={<ProtectedRoute><CreateGame /></ProtectedRoute>} />
            <Route path="/enroll" element={<ProtectedRoute><Tournament /></ProtectedRoute>} />
            <Route path="/scouting" element={<ProtectedRoute><Scouting /></ProtectedRoute>} />
            <Route path="/finances" element={<ProtectedRoute><Finances /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}
