import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("Socket.IO server is running");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).substr(2, 6);
    rooms.set(roomId, {
      players: [socket.id],
      choices: {},
      scores: { [socket.id]: 0 },
      round: 1,
    });
    socket.join(roomId);
    console.log(`⚙️ Received create-room from ${socket.id}`);
    console.log(`⚙️ Emitting room-created → ${roomId}`);
    socket.emit("room-created", roomId);
  });

  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.players.length === 1) {
      room.players.push(socket.id);
      room.scores[socket.id] = 0;
      socket.join(roomId);
      io.to(roomId).emit("room-ready", room.players);
    }
  });

  socket.on("player-choice", ({ roomId, playerId, choice }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.choices[playerId] = choice;

    if (Object.keys(room.choices).length === 2) {
      const [p1, p2] = room.players;
      const c1 = room.choices[p1];
      const c2 = room.choices[p2];

      const matrix = {
        CC: [3, 3],
        CD: [0, 5],
        DC: [5, 0],
        DD: [1, 1],
      };

      const result = matrix[`${c1}${c2}`];

      room.scores[p1] += result[0];
      room.scores[p2] += result[1];

      io.to(roomId).emit("round-result", {
        choices: { [p1]: c1, [p2]: c2 },
        scores: { ...room.scores },
        round: room.round,
      });

      room.round += 1;
      room.choices = {};

      if (room.round > 5) {
        io.to(roomId).emit("game-over", room.scores);
        rooms.delete(roomId);
      }
    }
  });
});

httpServer.listen(3001, () => {
  console.log("🚀 Socket.IO server is running at http://localhost:3001");
});
