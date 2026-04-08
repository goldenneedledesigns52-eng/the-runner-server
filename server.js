// server.js
// Simple WebSocket game server for "The Runner"

const http = require("http");
const WebSocket = require("ws");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

/**
 * In-memory game state
 * games = {
 *   CODE: {
 *     players: Set<ws>,
 *     roles: Map<ws, "runner" | "chaser" | "pending">,
 *     lastRunnerLocation: { lat, lng } | null,
 *     lastChaserLocation: { lat, lng } | null,
 *     waypointSelected: boolean
 *   }
 * }
 */
const games = {};

function getOrCreateGame(code) {
  if (!games[code]) {
    games[code] = {
      players: new Set(),
      roles: new Map(),
      lastRunnerLocation: null,
      lastChaserLocation: null,
      waypointSelected: false,
    };
  }
  return games[code];
}

function removePlayerFromGames(ws) {
  for (const [code, game] of Object.entries(games)) {
    if (game.players.has(ws)) {
      game.players.delete(ws);
      game.roles.delete(ws);

      if (game.players.size === 0) {
        delete games[code];
      }
    }
  }
}

function broadcastToGame(code, data) {
  const game = games[code];
  if (!game) return;

  const message = JSON.stringify(data);

  for (const player of game.players) {
    if (player.readyState === WebSocket.OPEN) {
      player.send(message);
    }
  }
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON:", raw);
    return null;
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (raw) => {
    const msg = parseMessage(raw);
    if (!msg || !msg.type) return;

    console.log("Received:", msg);

    switch (msg.type) {
      case "JOIN_GAME": {
        const code = String(msg.payload || "").toUpperCase();
        if (!code) return;

        const game = getOrCreateGame(code);
        game.players.add(ws);
        game.roles.set(ws, "pending");

        ws.gameCode = code;

        ws.send(
          JSON.stringify({
            type: "JOINED_GAME",
            payload: { code },
          })
        );
        break;
      }

      case "SET_ROLE": {
        // payload: {"code":"ABCD","role":"runner"|"chaser"}
        let payload;
        try {
          payload = JSON.parse(msg.payload);
        } catch {
          return;
        }
        const code = String(payload.code || "").toUpperCase();
        const role = payload.role;

        if (!code || !role) return;
        const game = getOrCreateGame(code);

        if (!game.players.has(ws)) {
          game.players.add(ws);
        }
        game.roles.set(ws, role);
        ws.gameCode = code;

        ws.send(
          JSON.stringify({
            type: "ROLE_SET",
            payload: { code, role },
          })
        );
        break;
      }

      case "RUNNER_LOCATION": {
        const code = ws.gameCode;
        if (!code || !games[code]) return;

        const { lat, lng } = msg;
        games[code].lastRunnerLocation = { lat, lng };

        broadcastToGame(code, {
          type: "RUNNER_LOCATION",
          lat,
          lng,
        });
        break;
      }

      case "CHASER_LOCATION": {
        const code = ws.gameCode;
        if (!code || !games[code]) return;

        const { lat, lng } = msg;
        games[code].lastChaserLocation = { lat, lng };

        broadcastToGame(code, {
          type: "CHASER_LOCATION",
          lat,
          lng,
        });
        break;
      }

      case "WAYPOINT_1_SELECTED": {
        const code = ws.gameCode;
        if (!code || !games[code]) return;

        games[code].waypointSelected = true;

        broadcastToGame(code, {
          type: "WAYPOINT_1_SELECTED",
        });
        break;
      }

      case "RUNNER_CAPTURED": {
        const code = ws.gameCode;
        if (!code || !games[code]) return;

        broadcastToGame(code, {
          type: "RUNNER_CAPTURED",
        });
        break;
      }

      case "RUNNER_WIN": {
        const code = ws.gameCode;
        if (!code || !games[code]) return;

        broadcastToGame(code, {
          type: "RUNNER_WIN",
        });
        break;
      }

      default:
        console.log("Unknown message type:", msg.type);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    removePlayerFromGames(ws);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    removePlayerFromGames(ws);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});