import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, Globe, Trash2, Settings as SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const Settings: React.FC = () => {
  const { logout, user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (confirm("Are you sure you want to delete your account? This action cannot be undone and will delete all your teams, matches, and players forever.")) {
      setLoading(true);
      try {
        await user.delete();
        navigate("/");
      } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') {
          alert("For security reasons, please log out and log back in before deleting your account.");
        } else {
          console.error("Failed to delete user", e);
          alert("Failed to delete account. You might need to contact support.");
        }
      }
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3 mb-8">
        <SettingsIcon className="h-8 w-8 text-neutral-500" /> {t('settings') || "Settings"}
      </h1>

      <div className="space-y-6">
        {/* Language Box */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <Globe className="h-5 w-5 text-indigo-500" /> Language Preferences
          </h2>
          <div className="flex gap-4">
            <button onClick={() => changeLanguage('en')} className={`px-4 py-2 rounded-xl font-bold border transition-colors ${i18n.language === 'en' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-neutral-200 hover:bg-neutral-50'}`}>English</button>
            <button onClick={() => changeLanguage('es')} className={`px-4 py-2 rounded-xl font-bold border transition-colors ${i18n.language === 'es' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-neutral-200 hover:bg-neutral-50'}`}>Español</button>
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 space-y-4">
          <h2 className="text-lg font-bold mb-4">Account Management</h2>
          
          <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors group">
            <span className="font-bold text-neutral-700 group-hover:text-neutral-900">Sign Out</span>
            <LogOut className="h-5 w-5 text-neutral-400 group-hover:text-black" />
          </button>

          <div className="pt-4 border-t border-neutral-100 mt-6">
            <h3 className="text-sm font-bold text-red-500 mb-2 uppercase tracking-wide">Danger Zone</h3>
            <button 
              onClick={handleDeleteAccount} 
              disabled={loading}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-colors group"
            >
              <span className="font-bold text-red-700">{loading ? "Processing..." : "Delete Account Forever"}</span>
              <Trash2 className="h-5 w-5 text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
