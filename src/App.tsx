import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Plus, LogIn, Play, Pause, RotateCcw, X, 
  Mic2, LogOut, Moon, Sun, Check, ChevronRight, Stethoscope, ShieldAlert, Hand
} from "lucide-react";

const LOGO_URL = "/logo.png";

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [myName, setMyName] = useState("");
  const [view, setView] = useState<"home" | "create" | "join" | "room" | "globalAdmin">("home");
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  const [formData, setFormData] = useState({ 
    roomNumber: 1, title: "", tutor: "", time: 120, adminPassword: "", participantPassword: "", joinName: "", joinPassword: "", globalAdminPassword: ""
  });

  useEffect(() => {
    const root = window.document.documentElement;
    darkMode ? root.classList.add("dark") : root.classList.remove("dark");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    const updateRooms = () => fetch("/api/rooms").then(r => r.json()).then(setRooms);
    
    newSocket.on("rooms:updated", updateRooms);
    
    newSocket.on("room:created", (data) => { 
      setIsCreator(true); 
      setFormData(prev => ({ ...prev, joinPassword: formData.adminPassword })); 
      socket?.emit("room:join", { roomNumber: data.roomNumber, name: "Admin", password: formData.adminPassword });
    });

    newSocket.on("room:joined", (data) => { 
      setIsCreator(data.isCreator); 
      setMyName(data.name);
      setCurrentRoom(data.room); 
      setView("room"); 
    });

    newSocket.on("room:sync", (data) => setCurrentRoom((prev: any) => ({ ...prev, ...data })));
    
    newSocket.on("room:closed", () => { 
      if(view === "room") {
        setView("home"); 
        setCurrentRoom(null); 
        setError("A tutoria foi encerrada pelo Tutor ou Administrador."); 
      }
    });

    newSocket.on("error", (d) => setError(d.message));

    updateRooms();
    return () => { newSocket.disconnect(); };
  }, [formData.adminPassword, view]);

  const handleCreate = () => {
    if(!formData.title || !formData.tutor || formData.adminPassword.length !== 4 || formData.participantPassword.length !== 4) {
      setError("Preencha todos os campos. As senhas devem ter 4 dígitos.");
      return;
    }
    socket?.emit("room:create", { ...formData, time: formData.time * 60 });
  };

  const handleJoin = (selectedRoom: number) => {
    if(!formData.joinPassword) {
      setError("Digite a senha para entrar.");
      return;
    }
    socket?.emit("room:join", { roomNumber: selectedRoom, name: formData.joinName, password: formData.joinPassword });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const pageTransition = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 }, transition: { duration: 0.3 } };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 overflow-x-hidden relative">
      
      {/* Background Decorativo */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-600/10 blur-[100px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-600/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col">
        
        {/* Header */}
        <header className="py-6 flex justify-between items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 cursor-pointer" onClick={() => setView("home")}>
            <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center shrink-0 p-1">
              <img src={LOGO_URL} alt="Logo FMS" className="w-full h-full object-contain" />
            </div>
            <div className="hidden md:block border-l-2 border-slate-300 dark:border-slate-700 pl-4">
              <h1 className="font-black text-xl md:text-2xl tracking-tight text-blue-800 dark:text-blue-400 leading-tight whitespace-nowrap">
                GESTÃO DE TUTORIA
              </h1>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-3">
            <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onClick={() => setView("globalAdmin")} className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" title="Painel Global de Administração">
              <ShieldAlert size={22} />
            </motion.button>
            <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onClick={() => setDarkMode(!darkMode)} className="p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-yellow-400">
              {darkMode ? <Sun size={22} /> : <Moon size={22} />}
            </motion.button>
          </div>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 font-medium">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-600 rounded-full transition-colors"><X size={16} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 py-8 flex flex-col">
          <AnimatePresence mode="wait">
            
            {/* View: HOME */}
            {view === "home" && (
              <motion.div key="home" {...pageTransition} className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
                <div className="text-center mb-12">
                  <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-500 dark:from-blue-400 dark:to-blue-200 mb-4">Bem-vindo à Tutoria</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg">Organize o tempo de fala e a dinâmica das sessões metodológicas.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  <motion.button whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setView("create")} className="group relative p-10 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/50 dark:border-slate-700 hover:border-emerald-500/50 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="h-20 w-20 mx-auto bg-emerald-100 dark:bg-emerald-900/40 rounded-3xl flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300"><Plus size={40} /></div>
                    <h3 className="text-2xl font-bold mb-2">Criar Nova Sessão</h3>
                    <p className="text-slate-500 dark:text-slate-400">Coordenador/Tutor: Configure as senhas e abra a sala.</p>
                  </motion.button>
                  <motion.button whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setView("join")} className="group relative p-10 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/50 dark:border-slate-700 hover:border-blue-500/50 transition-all overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="h-20 w-20 mx-auto bg-blue-100 dark:bg-blue-900/40 rounded-3xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300"><LogIn size={40} /></div>
                    <h3 className="text-2xl font-bold mb-2">Entrar em Sala</h3>
                    <p className="text-slate-500 dark:text-slate-400">Aluno: Veja as salas ativas e entre para pedir a palavra.</p>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* View: GLOBAL ADMIN */}
            {view === "globalAdmin" && (
              <motion.div key="globalAdmin" {...pageTransition} className="max-w-xl mx-auto w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-red-200 dark:border-red-900/30">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl"><ShieldAlert size={28}/></div>
                  <h2 className="text-3xl font-black text-red-600 dark:text-red-400">Painel Global</h2>
                </div>
                
                {formData.globalAdminPassword !== "luna123" ? (
                  <div className="space-y-4">
                    <p className="text-slate-500 font-medium">Acesso restrito à Coordenação.</p>
                    <input type="password" placeholder="Senha do Sistema" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 outline-none text-center" onChange={e => setFormData({...formData, globalAdminPassword: e.target.value})} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-slate-500 font-medium mb-4">Salas Ativas no Servidor:</p>
                    <div className="space-y-3">
                      {rooms.filter(r => r.is_active).map(r => (
                        <div key={r.room_number} className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                          <div>
                            <p className="font-bold text-lg">Sala {r.room_number} - {r.title}</p>
                            <p className="text-xs text-slate-500">Tutor: {r.tutor} | Participantes: {(r.participants || []).length}</p>
                          </div>
                          <button onClick={() => socket?.emit("room:close", { roomNumber: r.room_number })} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors">Forçar Fim</button>
                        </div>
                      ))}
                      {rooms.filter(r => r.is_active).length === 0 && <p className="text-center py-8 text-slate-400 italic">Nenhuma sala ativa no momento.</p>}
                    </div>
                  </div>
                )}
                <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button onClick={() => { setView("home"); setFormData({...formData, globalAdminPassword: ""}); }} className="w-full py-4 text-slate-500 font-bold hover:text-slate-700 transition-colors">Voltar</button>
                </div>
              </motion.div>
            )}

            {/* View: CREATE */}
            {view === "create" && (
              <motion.div key="create" {...pageTransition} className="max-w-xl mx-auto w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-700">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl"><Plus size={28}/></div>
                  <h2 className="text-3xl font-black">Abrir Tutoria</h2>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Sala Física</label>
                    <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({...formData, roomNumber: Number(e.target.value)})}>
                      {rooms.map(r => <option key={r.room_number} value={r.room_number} disabled={r.is_active}>Sala {r.room_number} {r.is_active ? "(Ocupada)" : ""}</option>)}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">Título do SP</label>
                      <input placeholder="Ex: SP 02" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">Nome do Tutor</label>
                      <input placeholder="Dr. / Dra." className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => setFormData({...formData, tutor: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-2 uppercase tracking-wide">Senha do Coordenador (Admin)</label>
                      <input placeholder="Ex: 1234" maxLength={4} type="password" pattern="\d*" className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-red-500 text-center tracking-widest font-bold" onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
                      <p className="text-[10px] text-slate-400 mt-1">Use para comandar a sala.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-500 mb-2 uppercase tracking-wide">Senha da Sala (Alunos)</label>
                      <input placeholder="Ex: 0000" maxLength={4} type="password" pattern="\d*" className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 text-center tracking-widest font-bold" onChange={e => setFormData({...formData, participantPassword: e.target.value})} />
                      <p className="text-[10px] text-slate-400 mt-1">Repasse para a turma entrar.</p>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button onClick={() => setView("home")} className="flex-1 py-4 font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
                    <button onClick={handleCreate} className="flex-[2] py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-2xl shadow-lg hover:-translate-y-1 transition-all">Abrir Sala</button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* View: JOIN */}
            {view === "join" && (
              <motion.div key="join" {...pageTransition} className="max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-4 mb-8 justify-center">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl"><LogIn size={28}/></div>
                  <h2 className="text-3xl font-black">Salas Abertas</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {rooms.filter(r => r.is_active).map(r => (
                    <div key={r.room_number} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-[2rem] shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                      <div className="mb-6">
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-full uppercase">Sala {r.room_number}</span>
                          <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md"><Users size={12}/> {(r.participants || []).length}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-tight mb-1">{r.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm flex items-center gap-1"><Stethoscope size={14} /> Tutor: {r.tutor}</p>
                      </div>
                      
                      <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <input placeholder="Seu Nome (Aluno)" className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-sm" onChange={e => setFormData({...formData, joinName: e.target.value})} />
                        <div className="flex gap-2">
                          <input placeholder="Senha" type="password" maxLength={4} className="w-1/2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none text-center tracking-widest text-sm font-bold" onChange={e => setFormData({...formData, joinPassword: e.target.value})} />
                          <button onClick={() => handleJoin(r.room_number)} className="w-1/2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-colors shadow-md">Entrar</button>
                        </div>
                        <p className="text-[10px] text-center text-slate-400 mt-2">Dica: O Coordenador pode deixar o nome em branco e usar a Senha Admin.</p>
                      </div>
                    </div>
                  ))}
                  {rooms.filter(r => r.is_active).length === 0 && (
                    <div className="col-span-full py-16 text-center bg-white/50 dark:bg-slate-800/50 rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-slate-700">
                      <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">Nenhuma tutoria ocorrendo no momento.</p>
                    </div>
                  )}
                </div>
                
                <div className="text-center">
                  <button onClick={() => setView("home")} className="px-8 py-3 font-bold text-slate-500 hover:text-slate-700 bg-white/50 dark:bg-slate-800/50 rounded-full transition-colors">Voltar ao Início</button>
                </div>
              </motion.div>
            )}

            {/* View: ROOM */}
            {view === "room" && currentRoom && (
              <motion.div key="room" {...pageTransition} className="flex flex-col gap-6 w-full">
                
                {/* Cabeçalho da Sala */}
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-lg border border-white/50 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-full uppercase tracking-wider">SALA {currentRoom.room_number}</span>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white">{currentRoom.title}</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2"><Stethoscope size={18} /> Tutor: <span className="text-slate-700 dark:text-slate-200 font-bold">{currentRoom.tutor}</span></p>
                  </div>
                  
                  {isCreator && (
                    <button onClick={() => socket?.emit("room:close", { roomNumber: currentRoom.room_number })} className="flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white font-bold rounded-xl transition-all shadow-sm">
                      <LogOut size={18} /> Encerrar Tutoria
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Coluna Esquerda: Cronômetro e Botões */}
                  <div className="lg:col-span-2 flex flex-col gap-6">
                    
                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-8 md:p-12 rounded-[2rem] shadow-xl border border-white/50 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute top-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
                        <motion.div className="h-full bg-blue-500" initial={{ width: '100%' }} animate={{ width: `${(currentRoom.remaining_time / currentRoom.initial_time) * 100}%` }} transition={{ duration: 1 }} />
                      </div>

                      <div className={`text-7xl md:text-[8rem] font-black tabular-nums tracking-tighter transition-colors duration-300 ${currentRoom.remaining_time < 60 ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-white'}`}>
                        {formatTime(currentRoom.remaining_time)}
                      </div>
                      
                      {isCreator ? (
                        <div className="flex gap-4 mt-8">
                          <button onClick={() => socket?.emit("room:timer_control", { roomNumber: currentRoom.room_number, action: currentRoom.timer_running ? "pause" : "start" })} className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${currentRoom.timer_running ? 'bg-amber-500 shadow-amber-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`}>
                            {currentRoom.timer_running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {currentRoom.timer_running ? 'PAUSAR' : 'INICIAR'}
                          </button>
                          <button onClick={() => socket?.emit("room:timer_control", { roomNumber: currentRoom.room_number, action: "reset" })} className="p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="Zerar Tempo"><RotateCcw /></button>
                        </div>
                      ) : (
                        <div className="mt-8 w-full max-w-sm">
                          <button onClick={() => socket?.emit("room:speak", { roomNumber: currentRoom.room_number, participant: myName })} className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-lg transition-all shadow-xl hover:-translate-y-1 active:scale-95 ${currentRoom.speaking_order.includes(myName) ? 'bg-red-500 text-white shadow-red-500/30' : 'bg-blue-600 text-white shadow-blue-600/30'}`}>
                            <Hand fill="currentColor" size={24} className={currentRoom.speaking_order.includes(myName) ? "" : "animate-bounce"} />
                            {currentRoom.speaking_order.includes(myName) ? "ABAIXAR A MÃO (SAIR DA FILA)" : "PEDIR A VEZ DE FALA"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Fila Principal */}
                    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-lg border border-white/50 dark:border-slate-700 flex-1">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-3"><div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400"><Mic2 size={20} /></div> Ordem de Fala</h3>
                        {isCreator && currentRoom.speaking_order.length > 0 && (
                          <button onClick={() => socket?.emit("room:next_speaker", { roomNumber: currentRoom.room_number })} className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-md transition-colors">
                            PASSAR A VEZ <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <AnimatePresence>
                          {currentRoom.speaking_order.map((name: string, i: number) => (
                            <motion.div key={name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} className={`p-4 rounded-2xl flex items-center gap-4 transition-colors ${i === 0 ? 'bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 border-2 border-emerald-400 shadow-md' : 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shadow-sm ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>{i + 1}</div>
                              <span className={`text-lg font-bold ${i === 0 ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{name} {name === myName && "(Você)"}</span>
                              {i === 0 && <span className="ml-auto flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 font-black px-3 py-1.5 rounded-full uppercase tracking-wider animate-pulse"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> Falando</span>}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {currentRoom.speaking_order.length === 0 && (
                          <div className="py-8 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Mic2 size={32} className="mb-2 opacity-20" />
                            <p className="font-medium text-sm">Ninguém pediu a vez.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Participantes Presentes */}
                  <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] shadow-lg border border-white/50 dark:border-slate-700 max-h-[800px] flex flex-col">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><Users size={20} /></div>
                      Alunos na Sala <span className="text-sm font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md ml-auto">{currentRoom.participants.length}</span>
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {currentRoom.participants.length === 0 && <p className="text-slate-400 text-center text-sm italic py-4">Aguardando alunos entrarem...</p>}
                      {currentRoom.participants.map((name: string) => {
                        const isInQueue = currentRoom.speaking_order.includes(name);
                        return (
                          <div key={name} className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all ${isInQueue ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50'}`}>
                            <span className={`font-bold text-sm ${isInQueue ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{name} {name === myName && "(Você)"}</span>
                            {isInQueue && <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm"><Check size={12} className="text-white font-bold" /></div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}