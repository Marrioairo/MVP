import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, LogOut, LayoutDashboard, MessageSquare, ShieldCheck, TrendingUp, Zap, Globe, Trophy } from "lucide-react";
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
              <Link to="/scorekeeper" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <Zap className="h-4 w-4" />
                {t('scorekeeper')}
              </Link>
              <Link to="/chat" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <MessageSquare className="h-4 w-4" />
                {t('ai_analyst')}
              </Link>
              <Link to="/stats" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <TrendingUp className="h-4 w-4" />
                {t('stats')}
              </Link>
              <Link to="/tournaments" className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-orange-600 transition-colors">
                <Trophy className="h-4 w-4" />
                Torneos
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
              <button
                onClick={logout}
                className="flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
              <img src={user.photoURL || ""} alt={user.displayName || ""} className="h-8 w-8 rounded-full border border-neutral-200" referrerPolicy="no-referrer" />
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
