import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  Clock, 
  Plus, 
  LogIn, 
  Shield, 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  Mic2, 
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Share2,
  Check
} from "lucide-react";
import { Room, RoomSyncData } from "./types";

const LOGO_URL = "/logo.png";

// Colors from logo
const COLORS = {
  blue: "#0072bc",
  red: "#ed1c24",
  green: "#39b54a",
  yellow: "#ffcc00",
  white: "#ffffff",
  gray: "#f3f4f6"
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [view, setView] = useState<"home" | "create" | "join" | "room" | "admin">("home");
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Form states
  const [title, setTitle] = useState("");
  const [tutor, setTutor] = useState("");
  const [timeMinutes, setTimeMinutes] = useState(120);
  const [participantsText, setParticipantsText] = useState("");
  const [password, setPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#room-")) {
        const roomNum = parseInt(hash.replace("#room-", ""));
        if (!isNaN(roomNum)) {
          setSelectedRoomNumber(roomNum);
          setView("join");
        }
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("rooms:updated", fetchRooms);
    newSocket.on("room:created", (data) => {
      setIsCreator(true);
      fetchRoomDetails(data.roomNumber);
      setView("room");
    });
    newSocket.on("room:joined", (data) => {
      setIsCreator(data.isCreator);
      if (data.room) {
        setCurrentRoom(data.room);
      } else {
        fetchRoomDetails(data.roomNumber);
      }
      setView("room");
      window.location.hash = `room-${data.roomNumber}`;
    });
    newSocket.on("room:sync", (data: RoomSyncData) => {
      setCurrentRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...data
        };
      });
    });
    newSocket.on("room:closed", () => {
      setCurrentRoom(null);
      setView("home");
      window.location.hash = "";
      setError("A sala foi encerrada.");
    });
    newSocket.on("error", (data) => {
      setError(data.message);
    });

    fetchRooms();

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    }
  };

  const fetchRoomDetails = async (roomNumber: number) => {
    try {
      const res = await fetch("/api/rooms");
      const data: Room[] = await res.json();
      const room = data.find(r => r.room_number === roomNumber);
      if (room) setCurrentRoom(room);
    } catch (err) {
      console.error("Failed to fetch room details", err);
    }
  };

  const handleCreateRoom = () => {
    if (!selectedRoomNumber || !title || !tutor || !participantsText || password.length !== 6) {
      setError("Preencha todos os campos corretamente. A senha deve ter 6 dígitos.");
      return;
    }
    const participants = participantsText.split("\n").map(p => p.trim()).filter(p => p !== "");
    socket?.emit("room:create", {
      roomNumber: selectedRoomNumber,
      title,
      tutor,
      time: timeMinutes * 60,
      participants,
      password
    });
  };

  const handleJoinRoom = () => {
    if (!selectedRoomNumber || joinPassword.length !== 6) {
      setError("Selecione uma sala e digite a senha de 6 dígitos.");
      return;
    }
    socket?.emit("room:join", {
      roomNumber: selectedRoomNumber,
      password: joinPassword
    });
  };

  const handleTimerControl = (action: "start" | "pause" | "reset") => {
    if (!currentRoom) return;
    socket?.emit("room:timer_control", {
      roomNumber: currentRoom.room_number,
      action
    });
  };

  const handleSpeak = (participant: string) => {
    if (!currentRoom) return;
    socket?.emit("room:speak", {
      roomNumber: currentRoom.room_number,
      participant
    });
  };

  const handleNextSpeaker = () => {
    if (!currentRoom) return;
    socket?.emit("room:next_speaker", {
      roomNumber: currentRoom.room_number
    });
  };

  const handleUpdateTime = () => {
    if (!currentRoom) return;
    socket?.emit("room:update_time", {
      roomNumber: currentRoom.room_number,
      newTime: editTimeValue * 60
    });
    setIsEditingTime(false);
  };

  const handleCloseRoom = (roomNum?: number) => {
    const num = roomNum || currentRoom?.room_number;
    if (!num) return;
    socket?.emit("room:close", {
      roomNumber: num,
      adminPassword: adminMode ? adminPassword : null
    });
    if (adminMode) {
      setView("home");
      window.location.hash = "";
    }
  };

  const copyRoomLink = () => {
    if (!currentRoom) return;
    const url = `${window.location.origin}${window.location.pathname}#room-${currentRoom.room_number}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const renderHome = () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex flex-col items-center space-y-4 mb-12">
        <img src={LOGO_URL} alt="Logo" className="h-32 object-contain" referrerPolicy="no-referrer" />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Gestão de Tutorias</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Desenvolvido por Fabrício Luna</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("create")}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border-2 border-transparent hover:border-emerald-500 transition-all group"
        >
          <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full group-hover:bg-emerald-500 transition-colors">
            <Plus className="w-8 h-8 text-emerald-600 dark:text-emerald-400 group-hover:text-white" />
          </div>
          <span className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-200">Criar Nova Sala</span>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Configure uma nova sessão de tutoria</p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView("join")}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border-2 border-transparent hover:border-blue-500 transition-all group"
        >
          <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full group-hover:bg-blue-500 transition-colors">
            <LogIn className="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:text-white" />
          </div>
          <span className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-200">Entrar em Sala</span>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Participe de uma tutoria ativa</p>
        </motion.button>
      </div>

      <div className="flex justify-center mt-12">
        <button 
          onClick={() => setView("admin")}
          className="flex items-center space-x-2 px-6 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">Painel Admin</span>
        </button>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Nova Tutoria</h2>
        <button onClick={() => setView("home")} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <X className="w-6 h-6 text-slate-500" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Selecione a Sala</label>
          <div className="grid grid-cols-5 gap-2">
            {rooms.map((r) => (
              <button
                key={r.room_number}
                disabled={r.is_active}
                onClick={() => setSelectedRoomNumber(r.room_number)}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  r.is_active 
                    ? "bg-slate-100 dark:bg-slate-900 text-slate-300 dark:text-slate-700 cursor-not-allowed" 
                    : selectedRoomNumber === r.room_number
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-500"
                }`}
              >
                {r.room_number}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Título SP</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: SP 01 - Anatomia"
              className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Tutor</label>
            <input 
              type="text" 
              value={tutor}
              onChange={(e) => setTutor(e.target.value)}
              placeholder="Nome do Tutor"
              className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Tempo (minutos)</label>
            <input 
              type="number" 
              value={timeMinutes}
              onChange={(e) => setTimeMinutes(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Senha da Sala (6 dígitos)</label>
            <input 
              type="text" 
              maxLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all text-center tracking-widest"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Participantes (um por linha)</label>
          <textarea 
            rows={5}
            value={participantsText}
            onChange={(e) => setParticipantsText(e.target.value)}
            placeholder="João Silva&#10;Maria Oliveira&#10;..."
            className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-emerald-500 outline-none transition-all resize-none"
          />
        </div>

        <button
          onClick={handleCreateRoom}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 transition-all transform active:scale-95"
        >
          Criar Tutoria
        </button>
      </div>
    </div>
  );

  const renderJoin = () => (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Entrar em Sala</h2>
        <button onClick={() => setView("home")} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <X className="w-6 h-6 text-slate-500" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Selecione a Sala Ativa</label>
          <div className="grid grid-cols-5 gap-2">
            {rooms.map((r) => (
              <button
                key={r.room_number}
                disabled={!r.is_active}
                onClick={() => setSelectedRoomNumber(r.room_number)}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  !r.is_active 
                    ? "bg-slate-50 dark:bg-slate-900 text-slate-200 dark:text-slate-800 cursor-not-allowed" 
                    : selectedRoomNumber === r.room_number
                      ? "bg-blue-500 text-white shadow-md"
                      : "bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-500"
                }`}
              >
                {r.room_number}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Senha da Sala</label>
          <input 
            type="text" 
            maxLength={6}
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-blue-500 outline-none transition-all text-center tracking-widest"
          />
        </div>

        <button
          onClick={handleJoinRoom}
          className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all transform active:scale-95"
        >
          Acessar Sala
        </button>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500" />
          Painel Administrativo
        </h2>
        <button onClick={() => setView("home")} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
          <X className="w-6 h-6 text-slate-500" />
        </button>
      </div>

      {!adminMode ? (
        <div className="space-y-4">
          <input 
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Senha de Admin"
            className="w-full px-4 py-2 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:border-red-500 outline-none"
          />
          <button 
            onClick={() => {
              if (adminPassword === "luna123") setAdminMode(true);
              else setError("Senha de admin incorreta.");
            }}
            className="w-full py-3 bg-red-500 text-white font-bold rounded-xl"
          >
            Acessar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Clique em uma sala ativa para encerrá-la forçadamente.</p>
          <div className="grid grid-cols-2 gap-4">
            {rooms.filter(r => r.is_active).map(r => (
              <div key={r.room_number} className="p-4 border-2 border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-between bg-white dark:bg-slate-900">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">Sala {r.room_number}</p>
                  <p className="text-xs text-slate-400">{r.title}</p>
                </div>
                <button 
                  onClick={() => handleCloseRoom(r.room_number)}
                  className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ))}
            {rooms.filter(r => r.is_active).length === 0 && (
              <p className="col-span-2 text-center py-8 text-slate-400">Nenhuma sala ativa no momento.</p>
            )}
          </div>
          <button onClick={() => setAdminMode(false)} className="w-full py-2 text-slate-400 text-sm">Sair do Modo Admin</button>
        </div>
      )}
    </div>
  );

  const renderRoom = () => {
    if (!currentRoom) return null;

    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{currentRoom.title}</h2>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Users className="w-4 h-4" />
                <span className="font-medium">Tutor: {currentRoom.tutor}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={copyRoomLink}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full font-bold text-sm transition-all flex items-center gap-2"
              title="Copiar link da sala"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copiado!" : "Compartilhar"}
            </button>
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-bold text-sm">
              SALA {currentRoom.room_number}
            </div>
            {(isCreator || adminMode) && (
              <button 
                onClick={() => handleCloseRoom()}
                className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white rounded-full font-bold text-sm transition-all flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Encerrar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Panel: Timer & Speaking Order */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer Card */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center space-y-6">
              <div className="flex flex-col items-center">
                <div className={`text-8xl md:text-9xl font-black tabular-nums tracking-tighter ${currentRoom.remaining_time! < 60 ? "text-red-500 animate-pulse" : "text-slate-800 dark:text-white"}`}>
                  {formatTime(currentRoom.remaining_time!)}
                </div>
                
                {(isCreator || adminMode) && (
                  <div className="mt-2">
                    {!isEditingTime ? (
                      <button 
                        onClick={() => {
                          setEditTimeValue(Math.floor(currentRoom.remaining_time! / 60));
                          setIsEditingTime(true);
                        }}
                        className="text-xs font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        Editar Tempo
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={editTimeValue}
                          onChange={(e) => setEditTimeValue(Number(e.target.value))}
                          className="w-16 px-2 py-1 text-sm border-2 border-slate-100 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-blue-500"
                        />
                        <button 
                          onClick={handleUpdateTime}
                          className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600"
                        >
                          OK
                        </button>
                        <button 
                          onClick={() => setIsEditingTime(false)}
                          className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {(isCreator || adminMode) && (
                <div className="flex items-center gap-4">
                  {!currentRoom.timer_running ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTimerControl("start")}
                      className="flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20"
                    >
                      <Play className="w-6 h-6 fill-current" />
                      INICIAR
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTimerControl("pause")}
                      className="flex items-center gap-2 px-8 py-4 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 dark:shadow-amber-900/20"
                    >
                      <Pause className="w-6 h-6 fill-current" />
                      PAUSAR
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleTimerControl("reset")}
                    className="p-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </motion.button>
                </div>
              )}
            </div>

            {/* Speaking Order Card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b dark:border-slate-700 pb-4">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Mic2 className="w-5 h-5 text-blue-500" />
                  Fila de Fala
                </h3>
                <div className="flex items-center gap-4">
                  {(isCreator || adminMode) && currentRoom.speaking_order.length > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={handleNextSpeaker}
                      className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 text-white rounded-full text-xs font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-100 dark:shadow-blue-900/20"
                    >
                      PRÓXIMO
                      <ChevronRight className="w-3 h-3" />
                    </motion.button>
                  )}
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {currentRoom.speaking_order.length} EM ESPERA
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 min-h-[60px]">
                <AnimatePresence>
                  {currentRoom.speaking_order.map((name, index) => (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 w-full ${
                        index === 0 
                          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 shadow-sm" 
                          : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-slate-800 text-xs font-black shadow-sm dark:text-white">
                        {index + 1}
                      </span>
                      <span className="font-bold">{name}</span>
                      {index === 0 && <span className="text-[10px] font-black uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-full">Falando</span>}
                    </motion.div>
                  ))}
                </AnimatePresence>
                {currentRoom.speaking_order.length === 0 && (
                  <div className="w-full flex flex-col items-center justify-center py-4 text-slate-300 dark:text-slate-600">
                    <p className="text-sm font-medium italic">Ninguém na fila de fala...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Side Panel: Participants */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg space-y-6">
            <div className="border-b dark:border-slate-700 pb-4">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Participantes</h3>
              <p className="text-xs text-slate-400">Clique para adicionar à fila</p>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {currentRoom.participants.map((name) => {
                const isInQueue = currentRoom.speaking_order.includes(name);
                return (
                  <button
                    key={name}
                    disabled={!isCreator && !adminMode}
                    onClick={() => handleSpeak(name)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                      isInQueue 
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-md" 
                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    } ${(!isCreator && !adminMode) ? "cursor-default" : ""}`}
                  >
                    <span className="font-bold">{name}</span>
                    {isInQueue ? (
                      <div className="p-1 bg-blue-500 rounded-full">
                        <ChevronRight className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-slate-100 dark:border-slate-700" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-white transition-colors duration-300`}>
      <div className="max-w-6xl mx-auto pt-6 px-4 flex justify-end">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
            darkMode 
              ? "bg-slate-800 text-yellow-400 border-slate-700" 
              : "bg-white text-slate-600 border-slate-200"
          }`}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-sm font-bold uppercase tracking-wider">Alterar Tema</span>
        </button>
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
          >
            <span className="font-bold">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-600 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="py-12 px-4">
        {view === "home" && renderHome()}
        {view === "create" && renderCreate()}
        {view === "join" && renderJoin()}
        {view === "admin" && renderAdmin()}
        {view === "room" && renderRoom()}
      </main>

      <footer className="fixed bottom-0 w-full p-4 text-center text-slate-400 text-xs pointer-events-none">
        <p className="font-medium">Desenvolvido por Fabrício Luna</p>
      </footer>
    </div>
  );
}
