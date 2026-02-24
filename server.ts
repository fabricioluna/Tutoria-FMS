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

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY,
    room_number INTEGER UNIQUE,
    title TEXT,
    tutor TEXT,
    initial_time INTEGER,
    remaining_time INTEGER,
    participants TEXT,
    password TEXT,
    is_active INTEGER DEFAULT 0,
    creator_socket_id TEXT,
    speaking_order TEXT DEFAULT '[]',
    timer_running INTEGER DEFAULT 0,
    last_tick INTEGER
  )
`);

// Ensure 10 rooms exist
for (let i = 1; i <= 10; i++) {
  db.prepare("INSERT OR IGNORE INTO rooms (room_number) VALUES (?)").run(i);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  // API Routes
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
    console.log("User connected:", socket.id);

    socket.on("room:create", (data) => {
      const { roomNumber, title, tutor, time, participants, password } = data;
      
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      if (room.is_active) {
        socket.emit("error", { message: "Sala já está ocupada." });
        return;
      }

      db.prepare(`
        UPDATE rooms SET 
          title = ?, 
          tutor = ?, 
          initial_time = ?, 
          remaining_time = ?, 
          participants = ?, 
          password = ?, 
          is_active = 1, 
          creator_socket_id = ?,
          speaking_order = '[]',
          timer_running = 0
        WHERE room_number = ?
      `).run(title, tutor, time, time, JSON.stringify(participants), password, socket.id, roomNumber);

      io.emit("rooms:updated");
      socket.emit("room:created", { roomNumber });
      socket.join(`room-${roomNumber}`);
    });

    socket.on("room:join", (data) => {
      const { roomNumber, password } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      
      if (!room || !room.is_active) {
        socket.emit("error", { message: "Sala não encontrada ou inativa." });
        return;
      }

      if (room.password !== password) {
        socket.emit("error", { message: "Senha incorreta." });
        return;
      }

      socket.join(`room-${roomNumber}`);
      
      const roomData = {
        ...room,
        participants: room.participants ? JSON.parse(room.participants) : [],
        speaking_order: room.speaking_order ? JSON.parse(room.speaking_order) : [],
        is_active: !!room.is_active,
        timer_running: !!room.timer_running
      };

      socket.emit("room:joined", { 
        roomNumber, 
        isCreator: room.creator_socket_id === socket.id,
        room: roomData
      });
    });

    socket.on("room:timer_control", (data) => {
      const { roomNumber, action } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      
      if (!room) return;

      let newRunning = room.timer_running;
      let newRemaining = room.remaining_time;
      const now = Date.now();

      if (action === "start") {
        newRunning = 1;
        db.prepare("UPDATE rooms SET timer_running = 1, last_tick = ? WHERE room_number = ?").run(now, roomNumber);
      } else if (action === "pause") {
        newRunning = 0;
        db.prepare("UPDATE rooms SET timer_running = 0 WHERE room_number = ?").run(roomNumber);
      } else if (action === "reset") {
        newRunning = 0;
        newRemaining = room.initial_time;
        db.prepare("UPDATE rooms SET timer_running = 0, remaining_time = ?, speaking_order = '[]' WHERE room_number = ?").run(newRemaining, roomNumber);
      }

      io.to(`room-${roomNumber}`).emit("room:sync", {
        timer_running: !!newRunning,
        remaining_time: newRemaining,
        speaking_order: action === "reset" ? [] : JSON.parse(room.speaking_order)
      });
    });

    socket.on("room:speak", (data) => {
      const { roomNumber, participant } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      if (!room) return;

      let order = JSON.parse(room.speaking_order);
      if (!order.includes(participant)) {
        order.push(participant);
      } else {
        order = order.filter(p => p !== participant);
      }

      db.prepare("UPDATE rooms SET speaking_order = ? WHERE room_number = ?").run(JSON.stringify(order), roomNumber);
      io.to(`room-${roomNumber}`).emit("room:sync", {
        speaking_order: order
      });
    });

    socket.on("room:next_speaker", (data) => {
      const { roomNumber } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      if (!room) return;

      let order = JSON.parse(room.speaking_order);
      if (order.length > 0) {
        order.shift(); // Remove the first speaker
      }

      db.prepare("UPDATE rooms SET speaking_order = ? WHERE room_number = ?").run(JSON.stringify(order), roomNumber);
      io.to(`room-${roomNumber}`).emit("room:sync", {
        speaking_order: order
      });
    });

    socket.on("room:close", (data) => {
      const { roomNumber, adminPassword } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      
      if (!room) return;

      const isCreator = room.creator_socket_id === socket.id;
      const isAdmin = adminPassword === "luna123";

      if (isCreator || isAdmin) {
        db.prepare(`
          UPDATE rooms SET 
            is_active = 0, 
            title = NULL, 
            tutor = NULL, 
            initial_time = NULL, 
            remaining_time = NULL, 
            participants = NULL, 
            password = NULL, 
            creator_socket_id = NULL,
            speaking_order = '[]',
            timer_running = 0
          WHERE room_number = ?
        `).run(roomNumber);
        
        io.to(`room-${roomNumber}`).emit("room:closed");
        io.emit("rooms:updated");
      }
    });

    socket.on("room:update_time", (data) => {
      const { roomNumber, newTime } = data;
      const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
      if (!room) return;

      db.prepare("UPDATE rooms SET remaining_time = ?, initial_time = ? WHERE room_number = ?").run(newTime, newTime, roomNumber);
      
      io.to(`room-${roomNumber}`).emit("room:sync", {
        remaining_time: newTime,
        initial_time: newTime
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Timer Tick Logic
  setInterval(() => {
    const runningRooms = db.prepare("SELECT * FROM rooms WHERE timer_running = 1").all();
    const now = Date.now();

    for (const room of runningRooms) {
      const elapsed = Math.floor((now - room.last_tick) / 1000);
      if (elapsed >= 1) {
        const newRemaining = Math.max(0, room.remaining_time - elapsed);
        const newRunning = newRemaining > 0 ? 1 : 0;
        
        db.prepare("UPDATE rooms SET remaining_time = ?, last_tick = ?, timer_running = ? WHERE room_number = ?")
          .run(newRemaining, now, newRunning, room.room_number);

        io.to(`room-${room.room_number}`).emit("room:sync", {
          remaining_time: newRemaining,
          timer_running: !!newRunning
        });
      }
    }
  }, 1000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
