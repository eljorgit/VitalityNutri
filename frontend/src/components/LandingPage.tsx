import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { Github, ExternalLink, Sparkles, PlayCircle, LogIn, UserPlus, X, Calendar, ChefHat, ShoppingCart, Languages, FileText, ShieldCheck, Clock } from "lucide-react";
import { SpainFlag, UKFlag } from "./Flags";
import BrandLogo from "./BrandLogo";
import { setStoredLang, SupportedLang } from "../i18n/config";
import { version } from "@/package.json";

export const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { login, register, demoLogin } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = () => {
    const current = i18n.language?.startsWith("es") ? "es" : "en";
    const nextLang: SupportedLang = current === "es" ? "en" : "es";
    i18n.changeLanguage(nextLang);
    setStoredLang(nextLang);
  };

  const isSpanish = i18n.language?.startsWith("es");

  const handleDemoClick = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await demoLogin();
    } catch (err: any) {
      setError(err.message || (isSpanish ? "Error al iniciar sesión en modo demo." : "Failed to start demo session."));
    } finally {
      setDemoLoading(false);
    }
  };

  const openAuth = (selectedTab: "login" | "register") => {
    setTab(selectedTab);
    setError(null);
    setIsAuthModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password, firstName, surname);
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      setError(err.message || (isSpanish ? "Ha ocurrido un error en la autenticación." : "Authentication failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar with Login Buttons */}
      <header className="border-b border-slate-200 backdrop-blur-md sticky top-0 z-40 bg-white/90 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <BrandLogo className="w-7 h-7 filter drop-shadow-md" />
          <div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              VitalityNutri
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            title={isSpanish ? "Switch to English" : "Cambiar a Español"}
          >
            {isSpanish ? (
              <>
                <SpainFlag className="w-4 h-3 rounded-xs shadow-xs" />
                <span className="hidden sm:inline">ES</span>
              </>
            ) : (
              <>
                <UKFlag className="w-4 h-3 rounded-xs shadow-xs" />
                <span className="hidden sm:inline">EN</span>
              </>
            )}
          </button>

          {/* Sign In */}
          <button
            type="button"
            onClick={() => openAuth("login")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5 text-slate-500" />
            <span>{t("landing.open_auth_login", "Iniciar Sesión")}</span>
          </button>

          {/* Register Button */}
          <button
            type="button"
            onClick={() => openAuth("register")}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t("landing.open_auth_register", "Crear Cuenta")}</span>
          </button>
        </div>
      </header>


      {/* Main Landing Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex-1 flex flex-col justify-center space-y-16">
        
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
            <Sparkles size={14} />
            <span>{t("landing.badge", "Nutrición Inteligente con IA")}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900">
            {t("landing.hero_title_prefix", "Planificación Nutricional Inteligente y ")}
            <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
              {t("landing.hero_title_highlight", "Saludable")}
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto">
            {t("landing.hero_description", "VitalityNutri transforma pautas nutricionales en PDF en calendarios interactivos, libros de recetas guiados paso a paso, estrategias de Batch Cooking y listas de la compra sincronizadas.")}
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleDemoClick}
              disabled={demoLoading}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {demoLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span>{t("landing.demo_loading", "Iniciando Demostración...")}</span>
                </>
              ) : (
                <>
                  <PlayCircle size={20} />
                  <span>{t("landing.demo_button", "Probar Demostración Inmediata (1 Clic)")}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => openAuth("register")}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <UserPlus size={18} className="text-emerald-500" />
              <span>{t("landing.open_auth_register", "Crear Cuenta Gratuita")}</span>
            </button>
          </div>
        </section>


        {/* Stats Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1 shadow-sm">
            <div className="flex items-center justify-center text-emerald-600 mb-2">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-xl font-black text-slate-900">{t("landing.stats_days_title", "7 Días de Plan")}</p>
            <p className="text-xs text-slate-500">{t("landing.stats_days_desc", "Planificación completa de lunes a domingo")}</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1 shadow-sm">
            <div className="flex items-center justify-center text-teal-600 mb-2">
              <ChefHat className="w-6 h-6" />
            </div>
            <p className="text-xl font-black text-slate-900">{t("landing.stats_meals_title", "28 Comidas")}</p>
            <p className="text-xs text-slate-500">{t("landing.stats_meals_desc", "Desayuno, comida, merienda y cena")}</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1 shadow-sm">
            <div className="flex items-center justify-center text-cyan-600 mb-2">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-xl font-black text-slate-900">{t("landing.stats_time_title", "60% Ahorro")}</p>
            <p className="text-xs text-slate-500">{t("landing.stats_time_desc", "Menos tiempo cocinando con Batch Cooking")}</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-1 shadow-sm">
            <div className="flex items-center justify-center text-emerald-600 mb-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-xl font-black text-slate-900">{t("landing.stats_privacy_title", "100% Privado")}</p>
            <p className="text-xs text-slate-500">{t("landing.stats_privacy_desc", "Tus datos seguros y cifrados")}</p>
          </div>
        </section>


        {/* Capabilities Showcase */}
        <section className="space-y-8 max-w-6xl mx-auto w-full">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
              {t("landing.capabilities_heading", "Capacidades de la Plataforma")}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {t("landing.capabilities_subheading", "Diseñado para transformar pautas nutricionales en hábitos sostenibles")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Card 1: AI Diet Extraction */}
            <div className="p-6 rounded-3xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 shadow-sm space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t("landing.cap1_title", "Extracción Inteligente de Dietas")}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.cap1_desc", "Sube tu pauta en PDF o imagen y nuestra IA estructura ingredientes, recetas, porciones y calorías al instante.")}
              </p>
            </div>

            {/* Card 2: Interactive Calendar */}
            <div className="p-6 rounded-3xl bg-white border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 shadow-sm space-y-3">
              <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t("landing.cap2_title", "Planificador Semanal Interactivo")}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.cap2_desc", "Vista clara de lunes a domingo con control de comidas completadas y seguimiento de progreso diario.")}
              </p>
            </div>

            {/* Card 3: Batch Cooking */}
            <div className="p-6 rounded-3xl bg-white border border-slate-100 hover:border-cyan-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 shadow-sm space-y-3">
              <div className="w-12 h-12 bg-cyan-50 border border-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600">
                <ChefHat className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t("landing.cap3_title", "Estrategia Batch Cooking Optimizada")}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.cap3_desc", "Cronograma de preparación simultánea optimizado para fogones, horno, microondas y freidora de aire.")}
              </p>
            </div>

            {/* Card 4: Dynamic Scaling */}
            <div className="p-6 rounded-3xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 shadow-sm space-y-3">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t("landing.cap4_title", "Recetario con Escalado Dinámico")}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.cap4_desc", "Ajusta las porciones por número de comensales con recálculo automático de ingredientes y macronutrientes.")}
              </p>
            </div>

            {/* Card 5: Smart Grocery List */}
            <div className="p-6 rounded-3xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 shadow-sm space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t("landing.cap5_title", "Lista de la Compra Consolidada")}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.cap5_desc", "Consolidación de ingredientes por pasillos de supermercado y sincronización con lo ya cocinado.")}
              </p>
            </div>

            {/* Card 6: Multilingual & Offline PWA */}
            <div className="p-6 rounded-3xl bg-white border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all duration-200 hover:-translate-y-1 shadow-sm space-y-3">
              <div className="w-12 h-12 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center text-teal-600">
                <Languages className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {t("landing.cap6_title", "Bilingüe & PWA Offline-First")}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.cap6_desc", "Traducción fluida entre español e inglés y acceso total sin conexión gracias a la tecnología PWA.")}
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-teal-50 border border-emerald-100 max-w-5xl mx-auto w-full text-center space-y-6 shadow-sm">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              {t("landing.cta_banner_title", "¿Listo para simplificar tu alimentación semanal?")}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {t("landing.cta_banner_desc", "Accede con un solo clic al modo demostración o crea tu cuenta para digitalizar tus propias dietas.")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleDemoClick}
              disabled={demoLoading}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-md shadow-emerald-100 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <PlayCircle size={18} />
              <span>{t("landing.demo_button", "Probar Demostración Inmediata (1 Clic)")}</span>
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <UserPlus size={18} className="text-emerald-500" />
              <span>{t("landing.open_auth_register", "Crear Cuenta")}</span>
            </button>
          </div>
        </section>

      </main>


      {/* Auth Modal (Sign In / Register) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full relative">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Tab Selector */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
              <button
                type="button"
                onClick={() => { setTab("login"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tab === "login"
                    ? "bg-emerald-500 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t("landing.tab_login", "Sign In")}
              </button>
              <button
                type="button"
                onClick={() => { setTab("register"); setError(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tab === "register"
                    ? "bg-emerald-500 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t("landing.tab_register", "Create Account")}
              </button>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === "register" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t("landing.label_firstname", "First Name")}
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t("landing.placeholder_firstname", "María")}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t("landing.label_surname", "Surname")}
                    </label>
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder={t("landing.placeholder_surname", "Gómez")}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t("landing.label_email", "Email Address")}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("landing.placeholder_email", "usuario@vitalitynutri.com")}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t("landing.label_password", "Password")}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>{t("landing.btn_processing", "Processing...")}</span>
                  </>
                ) : tab === "login" ? (
                  <>
                    <LogIn size={18} />
                    <span>{t("landing.btn_login", "Sign In to My Account")}</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    <span>{t("landing.btn_register", "Register for Free")}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full mt-auto bg-slate-50 border-t border-slate-200 select-none transition-colors">
        <div className="flex flex-col md:flex-row items-center w-full px-6 py-6 max-w-7xl mx-auto gap-4 md:gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-extrabold text-emerald-600 text-lg">VitalityNutri</span>
            <p className="text-xs text-slate-500">{t("footer.tagline")}</p>
          </div>
          <div className="flex items-center gap-5 md:ml-auto">
            <a
              href="https://github.com/eljorgit/VitalityNutri"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
            >
              <Github size={16} />
              <span>{t("footer.github")}</span>
            </a>
            <span className="text-slate-300">|</span>
            <a
              href="https://malvioapps.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors"
            >
              <ExternalLink size={14} />
              <span>MalvioApps</span>
            </a>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center w-full px-6 pb-6 gap-1 sm:gap-3 max-w-7xl mx-auto border-t border-slate-200 pt-4 text-slate-500">
          <span className="text-[11px] font-medium flex items-center gap-1.5">
            <span className="flex items-center gap-1 font-mono text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {t("footer.version", { version })}
            </span>
            <span className="opacity-40">|</span>
            <a
              href="https://github.com/eljorgit/VitalityNutri/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-600 transition-colors"
            >
              {t("footer.license")}
            </a>
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            {i18n.language?.startsWith("es") ? (
              <>
                Diseñado con IA por{" "}
                <a
                  href="https://www.linkedin.com/in/jorgerc02/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-emerald-600 underline decoration-slate-300 underline-offset-2 transition-colors font-semibold"
                >
                  Jorge
                </a>{" "}
                de{" "}
                <a
                  href="https://malvioapps.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-emerald-600 underline decoration-slate-300 underline-offset-2 transition-colors font-semibold"
                >
                  MalvioApps
                </a>
              </>
            ) : (
              <>
                Crafted with AI by{" "}
                <a
                  href="https://www.linkedin.com/in/jorgerc02/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-emerald-600 underline decoration-slate-300 underline-offset-2 transition-colors font-semibold"
                >
                  Jorge
                </a>{" "}
                from{" "}
                <a
                  href="https://malvioapps.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-700 hover:text-emerald-600 underline decoration-slate-300 underline-offset-2 transition-colors font-semibold"
                >
                  MalvioApps
                </a>
              </>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
};
