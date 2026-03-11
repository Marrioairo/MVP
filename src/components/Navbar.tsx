import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, LogOut, LayoutDashboard, MessageSquare, ShieldCheck, TrendingUp, Zap, Globe, Trophy, BarChart3, Calendar, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

const Navbar: React.FC = () => {
  const { user, loginWithGoogle, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white font-bold">
              H
            </div>
            <span className="text-xl font-bold tracking-tight">HoopsAI</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors"
          >
            <Globe className="h-4 w-4" />
            {i18n.language?.toUpperCase() || 'EN'}
          </button>

          {user ? (
            <>
              <Link to="/create-game" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <Zap className="h-4 w-4" />
                {t('create_game') || "New Game"}
              </Link>
              <Link to="/chat" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <MessageSquare className="h-4 w-4" />
                {t('ai_analyst')}
              </Link>
              <Link to="/agenda" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <Calendar className="h-4 w-4" />
                {t('agenda') || "Agenda"}
              </Link>
              <Link to="/stats" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <TrendingUp className="h-4 w-4" />
                {t('stats')}
              </Link>
              <Link to="/tournaments" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <Trophy className="h-4 w-4" />
                Torneos
              </Link>
              <Link to="/teams" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <ShieldCheck className="h-4 w-4" />
                Equipos
              </Link>
              <Link to="/finances" className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                <DollarSign className="h-4 w-4" />
                Finanzas
              </Link>
              <Link to="/scouting" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <BarChart3 className="h-4 w-4" />
                Scouting
              </Link>
              <Link to="/dashboard" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <LayoutDashboard className="h-4 w-4" />
                {t('dashboard')}
              </Link>
              {user.email === "marrioairocastro@gmail.com" && (
                <Link to="/admin" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-indigo-600 transition-colors">
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <div className="h-4 w-px bg-neutral-200 mx-1" />
              <div className="relative group">
                <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <img src={user.photoURL || ""} alt={user.displayName || ""} className="h-8 w-8 rounded-full border border-neutral-200" referrerPolicy="no-referrer" />
                </Link>
                {/* Simple dropdown indicator */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-neutral-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col overflow-hidden">
                  <Link to="/profile" className="px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 border-b border-neutral-100">My Profile</Link>
                  <Link to="/settings" className="px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50 text-left">Settings</Link>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-all"
            >
              <LogIn className="h-4 w-4" />
              Get Started
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
