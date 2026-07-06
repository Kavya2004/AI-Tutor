/**
 * lib/professor-ws.js
 * Shared store for professor WebSocket connections.
 * Imported by server.js (to register sockets) and
 * routes/professor.js (to push classroom_update events).
 */

// labSessionId (string) -> Set<WebSocket>
export const professorConnections = new Map();

export function broadcastToProfessors(labSessionId, payload) {
  const conns = professorConnections.get(String(labSessionId));
  if (!conns || !conns.size) return;
  const msg = JSON.stringify({ type: 'classroom_update', ...payload });
  conns.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}
