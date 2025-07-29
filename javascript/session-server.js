const express = require("express");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors({ origin: "https://ai-tutor-teal-one.vercel.app" }));
app.use(express.json());

const sessions = new Map();
const sessionConnections = new Map();

class TutorSession {
  constructor(sessionId, hostName, isPublic = true, sessionTitle = '') {
    this.sessionId = sessionId;
    this.hostName = hostName;
    this.isPublic = isPublic;           
    this.sessionTitle = sessionTitle;
    this.participants = new Map();
    this.messages = [];
    this.whiteboardActions = [];
    this.createdAt = new Date();
    this.lastActivity = new Date();

    this.participants.set(hostName, {
      userName: hostName,
      avatar: "👨‍🏫", 
      color: "#007bff", 
      isHost: true,
      joinedAt: new Date(),
      lastSeen: new Date(),
    });
  }

  addParticipant(userName, avatar = "👤", color = "#6c757d") {
    this.participants.set(userName, {
      userName,
      avatar,
      color,
      isHost: false,
      joinedAt: new Date(),
      lastSeen: new Date(),
    });
    this.lastActivity = new Date();
  }

  removeParticipant(userName) {
    this.participants.delete(userName);
    this.lastActivity = new Date();
  }

  addMessage(message, sender, userName) {
    const messageObj = {
      id: uuidv4(),
      message,
      sender,
      userName,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(messageObj);
    this.lastActivity = new Date();
    return messageObj;
  }

  addWhiteboardAction(action, targetBoard, userName) {
    const actionObj = {
      id: uuidv4(),
      action,
      targetBoard,
      userName,
      timestamp: new Date().toISOString(),
    };
    this.whiteboardActions.push(actionObj);
    this.lastActivity = new Date();
    return actionObj;
  }

  getParticipantsList() {
    return Array.from(this.participants.values());
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      hostName: this.hostName,
      isPublic: this.isPublic,           
      sessionTitle: this.sessionTitle,
      participants: this.getParticipantsList(),
      messages: this.messages,
      whiteboardActions: this.whiteboardActions,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
    };
  }
}

function generateSessionId() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function broadcastToSession(sessionId, message, excludeWs = null) {
  const connections = sessionConnections.get(sessionId) || [];
  connections.forEach(({ ws, userName }) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error broadcasting to ${userName}:`, error);
      }
    }
  });
}

app.post("/api/sessions/create", (req, res) => {
  const { hostName, avatar, color, isPublic = true, sessionTitle } = req.body;  

  if (!hostName || hostName.trim().length === 0) {
    return res.status(400).json({ error: "Host name is required" });
  }

  const sessionId = generateSessionId();
  const session = new TutorSession(sessionId, hostName.trim(), isPublic, sessionTitle);  

  session.participants.set(hostName.trim(), {
    userName: hostName.trim(),
    avatar: avatar || "👨‍🏫",
    color: color || "#007bff",
    isHost: true,
    joinedAt: new Date(),
    lastSeen: new Date(),
  });

  sessions.set(sessionId, session);
  sessionConnections.set(sessionId, []);

  console.log(`Session created: ${sessionId} by ${hostName}`);

  res.json({
    sessionId,
    message: "Session created successfully",
    session: session.toJSON(),
  });
});

app.post("/api/sessions/:sessionId/join", (req, res) => {
  const { sessionId } = req.params;
  const { userName, avatar, color } = req.body;

  if (!userName || userName.trim().length === 0) {
    return res.status(400).json({ error: "User name is required" });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  if (session.participants.has(userName.trim())) {
    return res.status(400).json({ error: "User name already taken in this session" });
  }

  session.addParticipant(userName.trim(), avatar, color);

  console.log(`${userName} joined session: ${sessionId}`);

  res.json({
    message: "Joined session successfully",
    session: session.toJSON(),
  });
});

app.get("/api/sessions/public", (req, res) => {
  const publicSessions = Array.from(sessions.values())
    .filter(session => session.isPublic)
    .map(session => ({
      sessionId: session.sessionId,
      sessionTitle: session.sessionTitle,
      hostName: session.hostName,
      participantCount: session.participants.size,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    }));

  res.json(publicSessions);
});

app.get("/api/sessions/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json(session.toJSON());
});

app.get("/api/sessions/:sessionId/download", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const sessionData = {
    ...session.toJSON(),
    exportedAt: new Date().toISOString(),
    format: "Probability Tutor Session Export",
  };

  res.json(sessionData);
});

app.get("/api/sessions", (req, res) => {
  const activeSessions = Array.from(sessions.values()).map((session) => ({
    sessionId: session.sessionId,
    hostName: session.hostName,
    participantCount: session.participants.size,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  }));

  res.json(activeSessions);
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.pathname.split("/")[2];

  if (!sessionId) {
    ws.close(1008, "Session ID required");
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    ws.close(1008, "Session not found");
    return;
  }

  let userName = null;
  let isHost = false;

  if (!sessionConnections.has(sessionId)) {
    sessionConnections.set(sessionId, []);
  }

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "join":
          userName = message.userName;
          isHost = message.isHost;
          if (session.participants.has(userName)) {
            const participant = session.participants.get(userName);
            participant.avatar = message.avatar || participant.avatar;
            participant.color = message.color || participant.color;
            participant.lastSeen = new Date();
          }
          sessionConnections.get(sessionId).push({ ws, userName });
        
          broadcastToSession(
            sessionId,
            {
              type: "participant_joined",
              userName: userName,
              timestamp: new Date().toISOString(),
            },
            ws,
          );
        
          ws.send(
            JSON.stringify({
              type: "session_info",
              sessionTitle: session.sessionTitle,
              isPublic: session.isPublic,
              participants: session.getParticipantsList(),
            }),
          );
        
          ws.send(
            JSON.stringify({
              type: "participants_update",
              participants: session.getParticipantsList(),
            }),
          );
        
          console.log(`${userName} connected to session ${sessionId}`);
          break;

        case "message":
          if (userName) {
            const messageObj = session.addMessage(
              message.message,
              message.sender,
              userName,
            );

            broadcastToSession(sessionId, {
              type: "message",
              message: message.message,
              sender: message.sender,
              userName: userName,
              timestamp: messageObj.timestamp,
            });

            console.log(
              `Message in session ${sessionId} from ${userName}: ${message.message.substring(0, 50)}...`,
            );
          }
          break;

        case "whiteboard_action":
          if (userName) {
            const actionObj = session.addWhiteboardAction(
              message.action,
              message.targetBoard,
              userName,
            );

            broadcastToSession(
              sessionId,
              {
                type: "whiteboard_action",
                action: message.action,
                targetBoard: message.targetBoard,
                userName: userName,
                timestamp: actionObj.timestamp,
              },
              ws,
            );

            console.log(
              `Whiteboard action in session ${sessionId} from ${userName}: ${message.action}`,
            );
          }
          break;

        case "leave":
          if (userName) {
            session.removeParticipant(userName);

            broadcastToSession(
              sessionId,
              {
                type: "participant_left",
                userName: userName,
                timestamp: new Date().toISOString(),
              },
              ws,
            );

            console.log(`${userName} left session ${sessionId}`);
          }
          break;
        case "profile_update":
          if (userName && session.participants.has(userName)) {
            const participant = session.participants.get(userName);
            participant.avatar = message.avatar || participant.avatar;
            participant.color = message.color || participant.color;
            participant.lastSeen = new Date();

            broadcastToSession(sessionId, {
              type: "participants_update",
              participants: session.getParticipantsList(),
            });
          }
          break;
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    if (userName) {
      const connections = sessionConnections.get(sessionId) || [];
      const index = connections.findIndex((conn) => conn.ws === ws);
      if (index > -1) {
        connections.splice(index, 1);
      }

      session.removeParticipant(userName);

      broadcastToSession(sessionId, {
        type: "participant_left",
        userName: userName,
        timestamp: new Date().toISOString(),
      });

      console.log(`${userName} disconnected from session ${sessionId}`);

      if (session.participants.size === 0) {
        sessions.delete(sessionId);
        sessionConnections.delete(sessionId);
        console.log(`Session ${sessionId} cleaned up (empty)`);
      }
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

setInterval(
  () => {
    const now = new Date();
    const maxInactiveTime = 24 * 60 * 60 * 1000; 

    sessions.forEach((session, sessionId) => {
      if (now - session.lastActivity > maxInactiveTime) {
        sessions.delete(sessionId);
        sessionConnections.delete(sessionId);
        console.log(`Session ${sessionId} cleaned up (inactive)`);
      }
    });
  },
  60 * 60 * 1000,
); 

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Session server running on port ${PORT}`);
  console.log(
    `WebSocket endpoint: wss://ai-tutor-53f1.onrender.com/sessions/{sessionId}`,
  );
});

module.exports = { app, server };