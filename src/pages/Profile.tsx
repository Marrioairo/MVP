import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { User, Shield, CreditCard, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Profile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTournaments = async () => {
      try {
        const q = query(collection(db, "tournaments_v2"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchTournaments();
  }, [user]);

  const handleUpgrade = async () => {
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: 'US' }),
      });
      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
       alert("Subscription system currently in test mode.");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Profile...</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 mb-8 flex items-center gap-6">
        <div className="h-24 w-24 rounded-full bg-neutral-100 flex items-center justify-center border-4 border-white shadow-md">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="h-full w-full rounded-full" />
          ) : (
            <User className="h-10 w-10 text-neutral-400" />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-black text-neutral-900">{user?.displayName || "Anonymous User"}</h1>
          <p className="text-neutral-500 font-medium">{user?.email || "No email linked"}</p>
          <div className="mt-3 flex gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200">Account Active</span>
            {!user?.isAnonymous && (
              <button onClick={handleUpgrade} className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg border border-orange-200 hover:bg-orange-200 flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
        <h2 className="text-xl font-bold flex items-center gap-2 border-b border-neutral-100 pb-4 mb-4">
          <Shield className="h-5 w-5 text-indigo-600" /> My Tournaments ({tournaments.length})
        </h2>
        <div className="space-y-4">
          {tournaments.map(t => (
            <div key={t.id} onClick={() => navigate("/tournaments")} className="flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 rounded-xl cursor-pointer border border-neutral-200 transition-colors">
              <div>
                <h3 className="font-bold text-neutral-900">{t.name}</h3>
                <p className="text-xs text-neutral-500 uppercase tracking-wide">{t.season} • {t.location || "Online"}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-neutral-400" />
            </div>
          ))}
          {tournaments.length === 0 && (
            <div className="py-8 text-center text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl">
              <p>No tournaments created yet.</p>
              <button onClick={() => navigate("/tournaments")} className="mt-4 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg text-sm">Create Tournament</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
