import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store game rooms by code
const games = {}; 
// games[code] = { runnerSocketId, chasers: Set(socketIds) }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Player joins a game code
  socket.on("join_game", ({ code, role }) => {
    if (!games[code]) {
      games[code] = { runnerSocketId: null, chasers: new Set() };
    }

    if (role === "runner") {
      games[code].runnerSocketId = socket.id;
    } else if (role === "chaser") {
      games[code].chasers.add(socket.id);
    }

    socket.join(code);
    console.log(`Socket ${socket.id} joined game ${code} as ${role}`);
  });

  // Runner sends location update
  socket.on("runner_location_update", ({ code, lat, lng }) => {
    io.to(code).emit("runner_location_update", { lat, lng });
  });

  // Server tells chasers the runner was captured
  socket.on("runner_captured", ({ code }) => {
    io.to(code).emit("runner_captured");
  });

  // Server tells chasers the runner finished all waypoints
  socket.on("runner_finished_waypoints", ({ code }) => {
    io.to(code).emit("runner_finished_waypoints");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Render uses PORT environment variable
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});