import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();          // bare server
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io",
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", () => {
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    socket.join(roomId);
    console.log("⚙️ Emitting room-created →", roomId);
    socket.emit("room-created", roomId);
  });

  /* keep your join-room / player-choice handlers here */
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () =>
  console.log("🚀 Socket.IO running on", PORT)
);
