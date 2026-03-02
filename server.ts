import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("tutorias.db");

// Criação da tabela base
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY,
    room_number INTEGER UNIQUE,
    title TEXT,
    tutor TEXT,
    initial_time INTEGER,
    remaining_time INTEGER,
    participants TEXT DEFAULT '[]',
    password TEXT,
    is_active INTEGER DEFAULT 0,
    creator_socket_id TEXT,
    speaking_order TEXT DEFAULT '[]',
    timer_running INTEGER DEFAULT 0,
    last_tick INTEGER
  )
`);

// Atualização automática do banco para suportar as duas senhas
try { db.prepare("ALTER TABLE rooms ADD COLUMN admin_password TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE rooms ADD COLUMN participant_password TEXT").run(); } catch (e) {}

for (let i = 1; i <= 10; i++) {
  db.prepare("INSERT OR IGNORE INTO rooms (room_number) VALUES (?)").run(i);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
  });

  app.use(express.json());

  app.get("/api/rooms", (req, res) => {
    const rooms = db.prepare("SELECT * FROM rooms").all();
    res.json(rooms.map(r => ({
      ...r,
      participants: r.participants ? JSON.parse(r.participants) : [],
      speaking_order: r.speaking_order ? JSON.parse(r.speaking_order) : [],
      is_active: !!r.is_active,
      timer_running: !!r.timer_running
    })));
  });

  io.on("connection", (socket) => {
    
    // CRIAR SALA
    socket.on("room:create", (data) => {
      const { roomNumber, title, tutor, time, adminPassword, participantPassword } = data;
      db.prepare(`
        UPDATE rooms SET 
          title = ?, tutor = ?, initial_time = ?, remaining_time = ?, 
          participants = '[]', admin_password = ?, participant_password = ?, is_active = 1, 
          speaking_order = '[]', timer_running = 0
        WHERE room_number = ?
      `).run(title, tutor, time, time, adminPassword, participantPassword, roomNumber);
      io.emit("rooms:updated");
      socket.emit("room:created", { roomNumber });
    });

    // ENTRAR NA SALA (Admin ou Participante)
    socket.on("room:join", (data) => {
      const { roomNumber, name, password } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      
      if (!room || !room.is_active) {
        socket.emit("error", { message: "Sala inativa ou não encontrada." });
        return;
      }

      let isCreator = false;
      if (password === room.admin_password) {
        isCreator = true; // Logou como Tutor/Admin
      } else if (password === room.participant_password) {
        isCreator = false; // Logou como Aluno
        if (!name || name.trim() === "") {
          socket.emit("error", { message: "Digite seu nome para entrar." });
          return;
        }
      } else {
        socket.emit("error", { message: "Senha incorreta." });
        return;
      }

      let participants = JSON.parse(room.participants);
      
      // Adiciona o nome à lista se for aluno e ainda não estiver na lista
      if (!isCreator && name && !participants.includes(name.trim())) {
        participants.push(name.trim());
        db.prepare("UPDATE rooms SET participants = ? WHERE room_number = ?").run(JSON.stringify(participants), roomNumber);
      }

      socket.join(`room-${roomNumber}`);
      
      // Retorna os dados para quem entrou
      socket.emit("room:joined", { 
        roomNumber, 
        isCreator,
        name: isCreator ? "Admin" : name.trim(),
        room: { ...room, participants, speaking_order: JSON.parse(room.speaking_order), is_active: true }
      });

      // Atualiza a tela de todos na sala com o novo participante
      io.to(`room-${roomNumber}`).emit("room:sync", { participants });
      io.emit("rooms:updated");
    });

    // CONTROLE DE TEMPO
    socket.on("room:timer_control", (data) => {
      const { roomNumber, action } = data;
      if (action === "start") db.prepare("UPDATE rooms SET timer_running = 1, last_tick = ? WHERE room_number = ?").run(Date.now(), roomNumber);
      else if (action === "pause") db.prepare("UPDATE rooms SET timer_running = 0 WHERE room_number = ?").run(roomNumber);
      else if (action === "reset") db.prepare("UPDATE rooms SET timer_running = 0, remaining_time = initial_time WHERE room_number = ?").run(roomNumber);
      
      const updated = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      io.to(`room-${roomNumber}`).emit("room:sync", { timer_running: !!updated.timer_running, remaining_time: updated.remaining_time });
    });

    // PEDIR A VEZ DE FALA
    socket.on("room:speak", (data) => {
      const { roomNumber, participant } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      if (!room) return;
      
      let order = JSON.parse(room.speaking_order);
      if (!order.includes(participant)) {
        order.push(participant); // Entra na fila
      } else {
        order = order.filter((p: string) => p !== participant); // Sai da fila
      }
      
      db.prepare("UPDATE rooms SET speaking_order = ? WHERE room_number = ?").run(JSON.stringify(order), roomNumber);
      io.to(`room-${roomNumber}`).emit("room:sync", { speaking_order: order });
    });

    // ADMIN PASSA A VEZ
    socket.on("room:next_speaker", (data) => {
      const { roomNumber } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      if (!room) return;
      
      let order = JSON.parse(room.speaking_order);
      order.shift(); // Remove o primeiro
      
      db.prepare("UPDATE rooms SET speaking_order = ? WHERE room_number = ?").run(JSON.stringify(order), roomNumber);
      io.to(`room-${roomNumber}`).emit("room:sync", { speaking_order: order });
    });

    // ENCERRAR SALA (Local ou Global)
    socket.on("room:close", (data) => {
      db.prepare("UPDATE rooms SET is_active = 0, participants = '[]', speaking_order = '[]', timer_running = 0 WHERE room_number = ?").run(data.roomNumber);
      io.to(`room-${data.roomNumber}`).emit("room:closed");
      io.emit("rooms:updated");
    });
  });

  // Loop do Cronômetro
  setInterval(() => {
    const runningRooms = db.prepare("SELECT * FROM rooms WHERE timer_running = 1").all();
    const now = Date.now();
    for (const room of runningRooms) {
      const elapsed = Math.floor((now - room.last_tick) / 1000);
      if (elapsed >= 1) {
        const newRemaining = Math.max(0, room.remaining_time - elapsed);
        db.prepare("UPDATE rooms SET remaining_time = ?, last_tick = ?, timer_running = ? WHERE room_number = ?")
          .run(newRemaining, now, newRemaining > 0 ? 1 : 0, room.room_number);
        io.to(`room-${room.room_number}`).emit("room:sync", { remaining_time: newRemaining, timer_running: newRemaining > 0 });
      }
    }
  }, 1000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

startServer();