import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database("tutorias.db");

// Inicialização das tabelas para o 2º Período
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    room_number INTEGER PRIMARY KEY,
    title TEXT,
    password TEXT,
    is_active INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS templates (
    name TEXT PRIMARY KEY,
    participants TEXT
  );
`);

// Configuração das 10 salas padrão da FMS
for (let i = 1; i <= 10; i++) {
  db.prepare("INSERT OR IGNORE INTO rooms (room_number) VALUES (?)").run(i);
}

const app = express();
app.use(express.json());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// --- API: GRUPOS ---
app.get("/api/templates", (req, res) => {
  const data = db.prepare("SELECT * FROM templates").all();
  res.json(data);
});

app.post("/api/templates", (req, res) => {
  const { name, participants } = req.body;
  db.prepare("INSERT OR REPLACE INTO templates (name, participants) VALUES (?, ?)").run(name, participants);
  res.json({ success: true });
});

app.delete("/api/templates/:name", (req, res) => {
  db.prepare("DELETE FROM templates WHERE name = ?").run(req.params.name);
  res.json({ success: true });
});

// --- API: SALAS ---
app.get("/api/rooms", (req, res) => {
  const data = db.prepare("SELECT * FROM rooms").all();
  res.json(data.map((r: any) => ({ ...r, is_active: !!r.is_active })));
});

// --- SOCKET.IO ---
io.on("connection", (socket) => {
  socket.on("room:create", (data) => {
    db.prepare(`UPDATE rooms SET title=?, password=?, is_active=1 WHERE room_number=?`)
      .run(data.title, data.password, data.roomNumber);
    io.emit("rooms:updated");
  });

  socket.on("room:close", ({ roomNumber }) => {
    db.prepare("UPDATE rooms SET is_active=0 WHERE room_number=?").run(roomNumber);
    io.emit("rooms:updated");
  });
});

// Servir arquivos estáticos (evita o 404)
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

httpServer.listen(3000, "0.0.0.0", () => console.log("Servidor FMS Online na porta 3000"));