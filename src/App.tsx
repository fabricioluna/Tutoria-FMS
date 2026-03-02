import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { Plus, LogIn, Shield, X, UsersRound, Save, Trash2, Moon, Sun, Download, LogOut } from "lucide-react";

const LOGO_URL = "/logo.png";

export default function App() {
  const [view, setView] = useState<"home" | "create" | "join" | "room" | "admin" | "groups">("home");
  const [rooms, setRooms] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados dos formulários
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [pass, setPass] = useState(""); // Senha de 3 dígitos
  const [gName, setGName] = useState("");
  const [gList, setGList] = useState("");

  const refreshData = async () => {
    try {
      const [rRes, tRes] = await Promise.all([fetch("/api/rooms"), fetch("/api/templates")]);
      if (rRes.ok) setRooms(await rRes.json());
      if (tRes.ok) setTemplates(await tRes.json());
    } catch (e) { console.error("Erro na sincronia", e); }
  };

  useEffect(() => {
    refreshData();
    const socket = io();
    socket.on("rooms:updated", refreshData);
    socket.on("room:closed", () => { setView("home"); setCurrentRoom(null); });
    return () => { socket.disconnect(); };
  }, []);

  // Recarrega dados sempre que mudar de tela
  useEffect(() => { refreshData(); }, [view]);

  const handleSaveGroup = async () => {
    if (!gName || !gList) return setError("Preencha o nome e a lista!");
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: gName, participants: gList })
    });
    setGName(""); setGList(""); refreshData();
    setError("Grupo Salvo!");
  };

  const deleteTemplate = async (name: string) => {
    await fetch(`/api/templates/${name}`, { method: "DELETE" });
    refreshData();
  };

  const renderHome = () => (
    <div className="max-w-4xl mx-auto text-center space-y-12">
      <img src={LOGO_URL} className="h-28 mx-auto" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button onClick={()=>setView("create")} className="p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border-b-4 border-emerald-500 transition-all active:scale-95"><Plus className="mx-auto mb-2 text-emerald-500"/>Criar Sala</button>
        <button onClick={()=>setView("join")} className="p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border-b-4 border-blue-500 transition-all active:scale-95"><LogIn className="mx-auto mb-2 text-blue-500"/>Entrar</button>
        <button onClick={()=>setView("groups")} className="p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border-b-4 border-purple-500 transition-all active:scale-95"><UsersRound className="mx-auto mb-2 text-purple-500"/>Grupos</button>
      </div>
      <button onClick={()=>setView("admin")} className="text-slate-400 flex items-center gap-2 mx-auto uppercase text-[10px] tracking-widest"><Shield className="w-3 h-3"/> Painel de Controle</button>
    </div>
  );

  return (
    <div className={darkMode ? "dark min-h-screen bg-slate-950 text-white" : "min-h-screen bg-slate-50 text-slate-900"}>
      <nav className="p-4 flex justify-between items-center max-w-6xl mx-auto">
        <span className="font-black text-blue-600 tracking-tighter">FMS TUTORIA</span>
        <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow">
          {darkMode ? <Sun className="text-yellow-400 w-5 h-5"/> : <Moon className="w-5 h-5"/>}
        </button>
      </nav>

      <AnimatePresence>
        {error && <motion.div initial={{y:-50}} animate={{y:0}} exit={{y:-50}} className="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full z-50 shadow-xl text-sm font-bold">{error}</motion.div>}
      </AnimatePresence>

      <main className="py-10 px-4">
        {view === "home" && renderHome()}

        {view === "groups" && (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Gerenciar Grupos</h2><button onClick={()=>setView("home")}><X/></button></div>
            <input placeholder="Nome do Grupo (Ex: Tutoria 9)" value={gName} onChange={e=>setGName(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-900 outline-none focus:border-purple-500" />
            <textarea placeholder="Lista de nomes (um por linha)..." rows={8} value={gList} onChange={e=>setGList(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-900 resize-none outline-none focus:border-purple-500" />
            <button onClick={handleSaveGroup} className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl flex justify-center gap-2 hover:bg-purple-700 transition-colors"><Save/> Salvar Grupo de Tutoria</button>
          </div>
        )}

        {view === "create" && (
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Configurar Tutoria</h2><button onClick={()=>setView("home")}><X/></button></div>
            <div className="grid grid-cols-5 gap-2">
              {rooms.map(r => (
                <button key={r.room_number} onClick={()=>setSelectedRoom(r.room_number)} className={`p-2 rounded-lg font-bold transition-all ${r.is_active ? "bg-slate-100 text-slate-300 cursor-not-allowed" : selectedRoom===r.room_number ? "bg-emerald-500 text-white shadow-md" : "border dark:border-slate-700 hover:border-emerald-500"}`}>{r.room_number}</button>
              ))}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-tighter">Importar Grupo:</p>
              <div className="flex flex-wrap gap-2">
                {templates.length > 0 ? templates.map(t => (
                  <button key={t.name} onClick={()=>setParticipants(t.participants)} className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:border-blue-500 transition-colors"><Download className="w-3 h-3"/> {t.name}</button>
                )) : <p className="text-[10px] text-slate-400 italic">Nenhum grupo cadastrado.</p>}
              </div>
            </div>
            <input placeholder="Título do Problema (SP)" value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-900 outline-none focus:border-emerald-500" />
            <textarea placeholder="Lista de participantes..." rows={4} value={participants} onChange={e=>setParticipants(e.target.value)} className="w-full p-3 border rounded-xl dark:bg-slate-900 resize-none outline-none focus:border-emerald-500" />
            <input placeholder="Senha (3 dígitos)" maxLength={3} value={pass} onChange={e=>setPass(e.target.value.replace(/\D/g,''))} className="w-full p-3 border rounded-xl text-center tracking-widest font-black text-2xl dark:bg-slate-900 outline-none" />
            <button onClick={() => io().emit("room:create", { roomNumber: selectedRoom, title, password: pass, time: 7200 })} className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-600 transition-all">Iniciar Tutoria</button>
          </div>
        )}

        {view === "admin" && (
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl space-y-8">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-red-600 flex items-center gap-2"><Shield/> Gestão do Sistema</h2><button onClick={()=>setView("home")}><X/></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold border-b dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase">Salas Ativas</h3>
                {rooms.filter(r=>r.is_active).map(r=>(
                  <div key={r.room_number} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 shadow-sm">
                    <span className="font-bold text-xs uppercase">Sala {r.room_number} - {r.title}</span>
                    <button onClick={()=>io().emit("room:close", {roomNumber: r.room_number})} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <h3 className="font-bold border-b dark:border-slate-700 pb-2 flex items-center gap-2 text-sm uppercase">Grupos de Tutoria</h3>
                {templates.map(t=>(
                  <div key={t.name} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 shadow-sm">
                    <span className="font-bold text-xs uppercase">{t.name}</span>
                    <button onClick={()=>deleteTemplate(t.name)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="text-center text-slate-400 text-[10px] py-10 uppercase tracking-widest font-medium">Faculdade Medicina do Sertão - 2026</footer>
    </div>
  );
}