import { createServer } from "http";
import { Server } from "socket.io";

/* ---------- basic HTTP server & Socket.IO ---------- */
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io",
});

/* ---------- Room state kept in memory ---------- */
type RoomState = {
  players: string[];
  choices: Record<string, "C" | "D">;
  scores: Record<string, number>;
  round: number;
};

const rooms = new Map<string, RoomState>();

/* ---------- helpers ---------- */
function payoff(a: "C" | "D", b: "C" | "D"): [number, number] {
  const table: Record<string, [number, number]> = {
    CC: [3, 3],
    CD: [0, 5],
    DC: [5, 0],
    DD: [1, 1],
  };
  return table[`${a}${b}`];
}

/* ---------- socket handlers ---------- */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  /* log every incoming event */
  socket.onAny((ev, ...args) => {
    console.log(`📥 ${socket.id} → "${ev}"`, args);
  });

  /* CREATE ROOM */
  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    rooms.set(roomId, {
      players: [socket.id],
      choices: {},
      scores: { [socket.id]: 0 },
      round: 1,
    });
    socket.join(roomId);
    console.log(`⚙️ create-room from ${socket.id} → ${roomId}`);
    console.log("new room ID:", roomId);        // ← should now print in upper-case
    socket.emit("room-created", roomId);
  });

  /* JOIN ROOM */
  socket.on("join-room", (rawId: string) => {
    const roomId = rawId.trim().toUpperCase();
    const room   = rooms.get(roomId);

    console.log(`🔸 join-room "${roomId}" from ${socket.id}`);

    if (!room) {
      console.log("  🔺 room not found");
      socket.emit("join-error", "Room not found");
      return;
    }
    if (room.players.length >= 2) {
      console.log("  🔺 room full");
      socket.emit("join-error", "Room is full");
      return;
    }

    room.players.push(socket.id);
    room.scores[socket.id] = 0;
    socket.join(roomId);

    console.log(`  ✅ joined, players = ${room.players.length}`);
    io.to(roomId).emit("room-ready", room.players);
  });

  /* PLAYER CHOICE */
  socket.on("player-choice", ({ roomId, playerId, choice }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.choices[playerId] = choice;

    if (Object.keys(room.choices).length === 2) {
      const [p1, p2] = room.players;
      const c1 = room.choices[p1];
      const c2 = room.choices[p2];
      const [pts1, pts2] = payoff(c1, c2);

      room.scores[p1] += pts1;
      room.scores[p2] += pts2;

      io.to(roomId).emit("round-result", {
        choices: { [p1]: c1, [p2]: c2 },
        scores : room.scores,
        round  : room.round,
      });

      room.round += 1;
      room.choices = {};

      if (room.round > 5) {
        io.to(roomId).emit("game-over", room.scores);
        rooms.delete(roomId);
      }
    }
  });

  /* DISCONNECT CLEAN-UP */
  socket.on("disconnect", () => {
    rooms.forEach((room, id) => {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(p => p !== socket.id);
        delete room.scores[socket.id];
        delete room.choices[socket.id];
        console.log(`⚠️ ${socket.id} left room ${id} – players left:`, room.players.length);

        if (room.players.length === 0) {
          rooms.delete(id);
          console.log(`💥 removed empty room ${id}`);
        }
      }
    });
  });
});   //  <<<<<  missing brace/paren added here

/* ---------- start server ---------- */
const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () =>
  console.log("🚀 Socket.IO running on", PORT)
);
