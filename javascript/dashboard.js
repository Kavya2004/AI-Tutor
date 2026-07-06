/**
 * javascript/dashboard.js
 * Dashboard panel — navigation + full data population.
 * Only the Dashboard panel is wired here. Other panels are stubs.
 */

const BACKEND = 'https://ai-tutor-53f1.onrender.com';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  activeLabSession: null,   // full LabSession doc
  classroomState:   null,   // last /classroom/:id/state response
  events:           [],     // last /events/:id response
  pollTimer:        null,
  prof: {
    name:  localStorage.getItem('prof_name')  || 'Professor',
    email: localStorage.getItem('prof_email') || '',
  },
};

// ── WebSocket realtime sync ────────────────────────────────────────────────
const ws = {
  socket:      null,
  labSessionId: null,
  retryDelay:  1000,
  retryTimer:  null,
  pingTimer:   null,

  connect(labSessionId) {
    if (this.socket && this.socket.readyState <= 1 && this.labSessionId === labSessionId) return;
    this.disconnect();
    this.labSessionId = labSessionId;
    const url = BACKEND.replace(/^http/, 'ws') + `/ws/professor/${labSessionId}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.retryDelay = 1000;
      // keepalive ping every 25 s
      this.pingTimer = setInterval(() => {
        if (this.socket?.readyState === 1) this.socket.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
    };

    this.socket.onmessage = (e) => {
      try { handleWsMessage(JSON.parse(e.data)); } catch (_) {}
    };

    this.socket.onclose = () => {
      clearInterval(this.pingTimer);
      // auto-reconnect with backoff (max 30 s)
      this.retryTimer = setTimeout(() => {
        if (this.labSessionId) this.connect(this.labSessionId);
      }, this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 30000);
    };

    this.socket.onerror = () => this.socket.close();
  },

  disconnect() {
    clearInterval(this.pingTimer);
    clearTimeout(this.retryTimer);
    if (this.socket) { this.socket.onclose = null; this.socket.close(); this.socket = null; }
    this.labSessionId = null;
  },
};

// ── WS message dispatcher ──────────────────────────────────────────────────
function handleWsMessage(msg) {
  // Server sends { type: 'classroom_update', ...payload } for full-state pushes
  // and { type: 'classroom_update', event, payload } for targeted events
  if (msg.type === 'pong') return;

  const event   = msg.event;    // targeted event name (may be undefined)
  const payload = msg.payload;  // event payload (may be undefined)

  // Full classroom state push (from pushClassroomState)
  if (!event && msg.tables !== undefined) {
    state.classroomState = msg;
    applyClassroomStateUpdate(msg);
    return;
  }

  switch (event) {
    case 'student_join':
      handleStudentJoin(payload);
      break;
    case 'student_leave':
      handleStudentLeave(payload);
      break;
    case 'chat_message':
    case 'ai_response':
    case 'hint_given':
      handleChatActivity(event, payload);
      break;
    case 'help_request':
      handleHelpRequest(payload);
      break;
    case 'help_resolved':
      handleHelpResolved(payload);
      break;
    case 'follow_up':
      handleFollowUp(payload);
      break;
    case 'assignment_distributed':
      handleAssignmentDistributed(payload);
      break;
    case 'broadcast_all':
    case 'broadcast_table':
    case 'broadcast_section':
      handleBroadcastSent(event, payload);
      break;
    default:
      // Unknown event — push to activity feed and refresh dashboard
      pushActivityItem({ icon: '⚡', label: event || 'update', detail: '' });
  }
}

// ── Surgical update helpers ────────────────────────────────────────────────

// Apply a full classroom state snapshot without re-fetching
function applyClassroomStateUpdate(cs) {
  if (!cs.labSession) return;
  state.classroomState = cs;
  state.activeLabSession = cs.labSession;
  renderHeader(cs);
  renderStatGrid(cs);
  renderHelpRequests(cs.tables || []);
  renderTableGrid(cs.tables || [], 'homeTableGrid');
  // Update badges
  $('badgeTables').textContent = (cs.tables || []).length;
  $('badgeStudents').textContent = cs.studentsTotal ?? 0;
  $('hdrOnline').textContent = `${cs.studentsOnline ?? 0} online`;
  // If Tables panel is open, refresh its grid too
  if ($('panel-tables').classList.contains('active')) {
    renderAllTables(cs.tables || []);
  }
}

function pushActivityItem({ icon, label, detail }) {
  const feed = $('recentActivityFeed');
  if (!feed) return;
  // Remove empty-state placeholder if present
  const empty = feed.querySelector('.empty-state');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = 'activity-item';
  item.innerHTML = `
    <div class="activity-icon">${icon}</div>
    <div class="activity-text"><strong>${label}</strong>${detail ? ` — ${detail}` : ''}</div>
    <div class="activity-time">just now</div>`;
  feed.insertBefore(item, feed.firstChild);
  // Keep feed to 12 items
  while (feed.children.length > 12) feed.removeChild(feed.lastChild);
  // Update event badge
  state.events.unshift({ type: label, payload: { message: detail }, createdAt: new Date().toISOString() });
}

function updateTableCardInGrid(tableNumber, updater) {
  // Update in state
  if (state.classroomState?.tables) {
    const t = state.classroomState.tables.find(t => t.tableNumber === tableNumber);
    if (t) updater(t);
  }
  // Re-render only the affected card in homeTableGrid and allTablesGrid
  ['homeTableGrid', 'allTablesGrid'].forEach(gridId => {
    const grid = $(gridId);
    if (!grid) return;
    const card = grid.querySelector(`[data-table="${tableNumber}"]`);
    if (!card || !state.classroomState?.tables) return;
    const t = state.classroomState.tables.find(t => t.tableNumber === tableNumber);
    if (!t) return;
    const newCard = document.createElement('div');
    newCard.innerHTML = (gridId === 'homeTableGrid')
      ? buildHomeTableCard(t)
      : buildTableCard(t, true);
    const replacement = newCard.firstElementChild;
    replacement.addEventListener('click', () => openTableDetail(tableNumber));
    card.replaceWith(replacement);
  });
}

// Minimal home-grid card builder (mirrors renderTableGrid inline template)
function buildHomeTableCard(t) {
  const onlineCount = (t.students || []).filter(s => s.online).length;
  const totalCount  = (t.students || []).length;
  const helpClass   = t.helpRequested ? 'help-requested' : '';
  const chips = (t.students || []).slice(0, 4).map(s =>
    `<div class="student-chip"><span class="dot ${s.online ? 'online' : 'offline'}"></span>${s.name || s.email?.split('@')[0] || '?'}</div>`
  ).join('');
  const more = totalCount > 4 ? `<div class="student-chip">+${totalCount - 4} more</div>` : '';
  return `
    <div class="table-card ${helpClass}" data-table="${t.tableNumber}">
      <div class="tc-title">Table ${t.tableNumber}${t.helpRequested ? '<span class="badge help" style="margin-left:6px">Help</span>' : ''}</div>
      <div class="tc-row"><span>Students</span><strong>${onlineCount} online / ${totalCount} total</strong></div>
      <div class="tc-row"><span>AI messages</span><strong>${t.chatMessageCount ?? 0}</strong></div>
      <div class="tc-row"><span>Last active</span><strong>${ago(t.lastActivity)}</strong></div>
      <div class="tc-students">${chips}${more}</div>
    </div>`;
}

// ── Per-event handlers ─────────────────────────────────────────────────────

function handleStudentJoin(payload) {
  const { name, email, tableNumber } = payload || {};
  pushActivityItem({ icon: '👋', label: 'Student joined', detail: name || email || '' });
  // Update online count in header
  if (state.classroomState) {
    state.classroomState.studentsOnline = (state.classroomState.studentsOnline || 0) + 1;
    state.classroomState.studentsTotal  = (state.classroomState.studentsTotal  || 0) + 1;
    $('hdrOnline').textContent = `${state.classroomState.studentsOnline} online`;
    $('badgeStudents').textContent = state.classroomState.studentsTotal;
    // Add student to table in state
    if (tableNumber && state.classroomState.tables) {
      let t = state.classroomState.tables.find(t => t.tableNumber === tableNumber);
      if (!t) {
        t = { tableNumber, students: [], chatMessageCount: 0, lastActivity: new Date().toISOString() };
        state.classroomState.tables.push(t);
      }
      if (!t.students.find(s => s.email === email)) {
        t.students.push({ name, email, online: true });
      } else {
        const s = t.students.find(s => s.email === email);
        if (s) s.online = true;
      }
      updateTableCardInGrid(tableNumber, () => {});
      renderStatGrid(state.classroomState);
    }
  }
}

function handleStudentLeave(payload) {
  const { name, email, tableNumber } = payload || {};
  pushActivityItem({ icon: '🚪', label: 'Student left', detail: name || email || '' });
  if (state.classroomState) {
    state.classroomState.studentsOnline = Math.max(0, (state.classroomState.studentsOnline || 1) - 1);
    $('hdrOnline').textContent = `${state.classroomState.studentsOnline} online`;
    if (tableNumber && state.classroomState.tables) {
      const t = state.classroomState.tables.find(t => t.tableNumber === tableNumber);
      if (t) {
        const s = t.students.find(s => s.email === email);
        if (s) s.online = false;
        updateTableCardInGrid(tableNumber, () => {});
      }
    }
    renderStatGrid(state.classroomState);
  }
}

function handleChatActivity(eventType, payload) {
  const { tableNumber, messageCount, preview } = payload || {};
  const icons = { chat_message: '💬', ai_response: '🤖', hint_given: '💡' };
  const labels = { chat_message: 'Chat message', ai_response: 'AI response', hint_given: 'Hint given' };
  pushActivityItem({ icon: icons[eventType], label: labels[eventType], detail: preview || '' });
  if (tableNumber && state.classroomState?.tables) {
    updateTableCardInGrid(tableNumber, t => {
      t.chatMessageCount = messageCount ?? (t.chatMessageCount || 0) + 1;
      t.lastActivity = new Date().toISOString();
    });
  }
  // If table detail is open for this table, refresh it
  if (tableNumber && tableState.selectedTable === tableNumber) {
    openTableDetail(tableNumber);
  }
}

function handleHelpRequest(payload) {
  const { tableNumber, name } = payload || {};
  pushActivityItem({ icon: '🆘', label: 'Help requested', detail: `Table ${tableNumber}` });
  const badge = $('badgeHelp');
  if (state.classroomState?.tables && tableNumber) {
    updateTableCardInGrid(tableNumber, t => { t.helpRequested = true; });
    const helpCount = state.classroomState.tables.filter(t => t.helpRequested).length;
    $('helpCount').textContent = helpCount;
    badge.textContent = helpCount;
    badge.style.display = '';
    renderHelpRequests(state.classroomState.tables);
  }
  // Toast alert
  toast(`🆘 Table ${tableNumber} is requesting help!`, 'error');
}

function handleHelpResolved(payload) {
  const { tableNumber } = payload || {};
  pushActivityItem({ icon: '✅', label: 'Help resolved', detail: `Table ${tableNumber}` });
  if (state.classroomState?.tables && tableNumber) {
    updateTableCardInGrid(tableNumber, t => { t.helpRequested = false; });
    const helpCount = state.classroomState.tables.filter(t => t.helpRequested).length;
    $('helpCount').textContent = helpCount;
    const badge = $('badgeHelp');
    badge.textContent = helpCount;
    if (helpCount === 0) badge.style.display = 'none';
    renderHelpRequests(state.classroomState.tables);
  }
}

function handleFollowUp(payload) {
  const { tableNumber } = payload || {};
  pushActivityItem({ icon: '🔖', label: 'Follow-up marked', detail: `Table ${tableNumber}` });
  if (state.classroomState?.tables && tableNumber) {
    updateTableCardInGrid(tableNumber, t => { t.followUp = true; });
  }
}

function handleAssignmentDistributed(payload) {
  const { fileCount } = payload || {};
  pushActivityItem({ icon: '📄', label: 'Assignment distributed', detail: `${fileCount} file(s)` });
  $('badgeAssignment').textContent = '✓';
  $('badgeAssignment').style.display = '';
  toast('Assignment distributed to all tables ✓', 'success');
  // Refresh assignment card if panel is open
  if ($('panel-assignments').classList.contains('active')) loadAssignmentsPanel();
}

function handleBroadcastSent(eventType, payload) {
  const labels = { broadcast_all: 'Broadcast sent', broadcast_table: 'Table message', broadcast_section: 'Section message' };
  pushActivityItem({ icon: '📢', label: labels[eventType] || 'Broadcast', detail: payload?.message || '' });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ago(dateStr) {
  if (!dateStr) return '—';
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function skeleton(lines = 3) {
  return Array.from({ length: lines }, () =>
    `<div style="height:14px;background:var(--gray-200);border-radius:6px;margin-bottom:8px;animation:pulse 1.2s infinite alternate"></div>`
  ).join('');
}

// ── Navigation ─────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.panel;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const panel = $(`panel-${target}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// ── API calls ──────────────────────────────────────────────────────────────
async function fetchLabSessions() {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions`);
  if (!r.ok) throw new Error(`lab-sessions ${r.status}`);
  return r.json();
}

async function fetchClassroomState(labSessionId) {
  const r = await fetch(`${BACKEND}/api/professor/classroom/${labSessionId}/state`);
  if (!r.ok) throw new Error(`classroom/state ${r.status}`);
  return r.json();
}

async function fetchEvents(labSessionId) {
  const r = await fetch(`${BACKEND}/api/professor/events/${labSessionId}`);
  if (!r.ok) throw new Error(`events ${r.status}`);
  return r.json();
}

// ── Loading skeletons ──────────────────────────────────────────────────────
function showDashboardLoading() {
  $('homeStatGrid').innerHTML    = Array.from({ length: 6 }, () =>
    `<div class="stat-card">${skeleton(2)}</div>`).join('');
  $('helpRequestList').innerHTML = skeleton(2);
  $('recentActivityFeed').innerHTML = skeleton(4);
  $('homeTableGrid').innerHTML   = Array.from({ length: 4 }, () =>
    `<div class="table-card">${skeleton(3)}</div>`).join('');
}

// ── Render: stat cards ─────────────────────────────────────────────────────
function renderStatGrid(cs) {
  const ls = cs.labSession;
  const tables = cs.tables || [];
  const helpCount = tables.filter(t => t.helpRequested).length;
  const disconnected = (cs.studentsTotal || 0) - (cs.studentsOnline || 0);
  const aiConvos = tables.reduce((s, t) => s + (t.chatMessageCount || 0), 0);

  const cards = [
    { label: 'Course',            value: ls.course,              sub: ls.labNumber,                        cls: 'maroon' },
    { label: 'Students Online',   value: cs.studentsOnline ?? 0, sub: `${cs.studentsTotal ?? 0} total`,    cls: 'green'  },
    { label: 'Disconnected',      value: disconnected,           sub: 'since session start',               cls: disconnected > 0 ? 'red' : '' },
    { label: 'Active Tables',     value: tables.length,          sub: `${ls.sections?.length ?? 0} sections`, cls: '' },
    { label: 'AI Conversations',  value: aiConvos,               sub: 'messages this session',             cls: '' },
    { label: 'Requesting Help',   value: helpCount,              sub: helpCount > 0 ? 'needs attention' : 'all clear', cls: helpCount > 0 ? 'red' : 'green' },
  ];

  $('homeStatGrid').innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>`).join('');
}

// ── Render: header pills ───────────────────────────────────────────────────
function renderHeader(cs) {
  const ls = cs.labSession;
  $('hdrCourse').textContent = `${ls.course} · ${ls.labNumber}`;
  $('hdrSessionStatus').textContent = ls.status === 'active' ? '🟢 Active' : '⏹ Ended';
  $('hdrSessionStatus').className = `hdr-pill ${ls.status === 'active' ? 'active' : 'ended'}`;
  $('hdrOnline').textContent = `${cs.studentsOnline ?? 0} online`;
}

// ── Render: help requests ──────────────────────────────────────────────────
function renderHelpRequests(tables) {
  const helping = tables.filter(t => t.helpRequested);
  $('helpCount').textContent = helping.length;

  const badge = $('badgeHelp');
  if (helping.length > 0) {
    badge.textContent = helping.length;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  if (helping.length === 0) {
    $('helpRequestList').innerHTML = `
      <div class="empty-state" style="padding:20px">
        <div class="es-icon">✅</div>
        <div class="es-title">No help requests</div>
      </div>`;
    return;
  }

  $('helpRequestList').innerHTML = helping.map(t => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;
      background:var(--red-light);border-radius:8px;margin-bottom:8px">
      <span style="font-size:20px">🆘</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;color:var(--red)">Table ${t.tableNumber}</div>
        <div style="font-size:12px;color:var(--gray-600)">
          ${t.students?.length ?? 0} student(s) · last active ${ago(t.lastActivity)}
        </div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="openBroadcastToTable(${t.tableNumber})">
        Reply
      </button>
    </div>`).join('');
}

// ── Render: recent activity feed ───────────────────────────────────────────
function renderActivityFeed(events) {
  if (!events.length) {
    $('recentActivityFeed').innerHTML = `
      <div class="empty-state" style="padding:20px">
        <div class="es-icon">📭</div>
        <div class="es-title">No activity yet</div>
      </div>`;
    return;
  }

  const iconMap = {
    student_join:            { icon: '👋', label: 'Student joined' },
    student_leave:           { icon: '🚪', label: 'Student left' },
    broadcast_all:           { icon: '📢', label: 'Broadcast sent' },
    broadcast_table:         { icon: '💬', label: 'Table message' },
    broadcast_section:       { icon: '📣', label: 'Section message' },
    assignment_distributed:  { icon: '📄', label: 'Assignment distributed' },
    help_request:            { icon: '🆘', label: 'Help requested' },
  };

  $('recentActivityFeed').innerHTML = events.slice(0, 12).map(e => {
    const meta = iconMap[e.type] || { icon: '⚡', label: e.type };
    const detail = e.payload?.message || e.payload?.name || '';
    return `
      <div class="activity-item">
        <div class="activity-icon">${meta.icon}</div>
        <div class="activity-text">
          <strong>${meta.label}</strong>${detail ? ` — ${detail}` : ''}
        </div>
        <div class="activity-time">${ago(e.createdAt)}</div>
      </div>`;
  }).join('');
}

// ── Render: table grid ─────────────────────────────────────────────────────
function renderTableGrid(tables, containerId) {
  const el = $(containerId);
  if (!tables.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🪑</div>
        <div class="es-title">No active tables</div>
        <div class="es-sub">Tables appear here once students join</div>
      </div>`;
    return;
  }

  el.innerHTML = tables
    .sort((a, b) => a.tableNumber - b.tableNumber)
    .map(t => {
      const onlineCount  = (t.students || []).filter(s => s.online).length;
      const totalCount   = (t.students || []).length;
      const helpClass    = t.helpRequested ? 'help-requested' : '';
      const chips = (t.students || []).slice(0, 4).map(s => `
        <div class="student-chip">
          <span class="dot ${s.online ? 'online' : 'offline'}"></span>
          ${s.name || s.email?.split('@')[0] || '?'}
        </div>`).join('');
      const more = totalCount > 4
        ? `<div class="student-chip">+${totalCount - 4} more</div>` : '';

      return `
        <div class="table-card ${helpClass}" data-table="${t.tableNumber}">
          <div class="tc-title">
            Table ${t.tableNumber}
            ${t.helpRequested ? '<span class="badge help" style="margin-left:6px">Help</span>' : ''}
          </div>
          <div class="tc-row">
            <span>Students</span>
            <strong>${onlineCount} online / ${totalCount} total</strong>
          </div>
          <div class="tc-row">
            <span>AI messages</span>
            <strong>${t.chatMessageCount ?? 0}</strong>
          </div>
          <div class="tc-row">
            <span>Last active</span>
            <strong>${ago(t.lastActivity)}</strong>
          </div>
          <div class="tc-students">${chips}${more}</div>
        </div>`;
    }).join('');

  // Badge counts
  $('badgeTables').textContent  = tables.length;
  const totalStudents = tables.reduce((s, t) => s + (t.students?.length ?? 0), 0);
  $('badgeStudents').textContent = totalStudents;
}

// ── Render: no active session state ───────────────────────────────────────
function renderNoSession() {
  $('homeStatGrid').innerHTML = `
    <div class="stat-card" style="grid-column:1/-1">
      <div class="empty-state">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active lab session</div>
        <div class="es-sub">Go to <strong>Lab Sessions</strong> to create one</div>
      </div>
    </div>`;
  $('helpRequestList').innerHTML = `<div class="empty-state" style="padding:20px"><div class="es-sub">No session active</div></div>`;
  $('recentActivityFeed').innerHTML = `<div class="empty-state" style="padding:20px"><div class="es-sub">No session active</div></div>`;
  $('homeTableGrid').innerHTML = '';
  $('hdrCourse').textContent = 'No session';
  $('hdrSessionStatus').textContent = '—';
  $('hdrSessionStatus').className = 'hdr-pill';
  $('hdrOnline').textContent = '0 online';
}

// ── Main dashboard refresh ─────────────────────────────────────────────────
async function refreshDashboard() {
  try {
    // 1. Find the active lab session
    const sessions = await fetchLabSessions();
    const active = sessions.find(s => s.status === 'active');

    if (!active) {
      state.activeLabSession = null;
      state.classroomState   = null;
      ws.disconnect();
      renderNoSession();
      return;
    }

    state.activeLabSession = active;

    // 2. Connect WS for realtime updates (no-op if already connected to same session)
    ws.connect(active._id);

    // 3. Fetch classroom state + events in parallel
    const [cs, events] = await Promise.all([
      fetchClassroomState(active._id),
      fetchEvents(active._id),
    ]);

    state.classroomState = cs;
    state.events = events;

    // 4. Render everything
    renderHeader(cs);
    renderStatGrid(cs);
    renderHelpRequests(cs.tables || []);
    renderActivityFeed(events);
    renderTableGrid(cs.tables || [], 'homeTableGrid');

  } catch (err) {
    console.error('[dashboard] refresh error:', err);
    toast(`Refresh failed: ${err.message}`, 'error');
  }
}

// ── Broadcast shortcut from help card ─────────────────────────────────────
window.openBroadcastToTable = function(tableNumber) {
  $('broadcastTarget').value = 'table';
  $('broadcastTargetDetail').style.display = '';
  $('broadcastTargetValue').value = tableNumber;
  $('broadcastModal').classList.add('open');
};

// ── Broadcast modal wiring ─────────────────────────────────────────────────
function initBroadcastModal() {
  const modal   = $('broadcastModal');
  const target  = $('broadcastTarget');
  const detail  = $('broadcastTargetDetail');

  target.addEventListener('change', () => {
    detail.style.display = target.value === 'all' ? 'none' : '';
  });

  $('broadcastModalClose').addEventListener('click',  () => modal.classList.remove('open'));
  $('broadcastCancelBtn').addEventListener('click',   () => modal.classList.remove('open'));
  $('globalBroadcastBtn').addEventListener('click',   () => {
    target.value = 'all';
    detail.style.display = 'none';
    $('broadcastMessage').value = '';
    modal.classList.add('open');
  });

  $('broadcastSendBtn').addEventListener('click', async () => {
    const message = $('broadcastMessage').value.trim();
    if (!message) { toast('Enter a message first', 'error'); return; }

    const type   = target.value;
    const tval   = $('broadcastTargetValue')?.value?.trim() || '';
    const labId  = state.activeLabSession?._id;

    if (!labId) { toast('No active session', 'error'); return; }

    try {
      $('broadcastSendBtn').disabled = true;
      $('broadcastSendBtn').textContent = 'Sending…';

      const r = await fetch(`${BACKEND}/api/professor/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labSessionId: labId, type, target: tval, message }),
      });
      if (!r.ok) throw new Error(await r.text());

      toast('Message sent ✓', 'success');
      modal.classList.remove('open');
      $('broadcastMessage').value = '';
      await refreshDashboard();
    } catch (err) {
      toast(`Send failed: ${err.message}`, 'error');
    } finally {
      $('broadcastSendBtn').disabled = false;
      $('broadcastSendBtn').textContent = 'Send';
    }
  });

  // Close on backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
}

// ── Auto-poll every 20 s while dashboard panel is visible ─────────────────
function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(() => {
    const dashPanel = $('panel-dashboard');
    if (dashPanel && dashPanel.classList.contains('active')) {
      refreshDashboard();
    }
  }, 20000);
}

function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
}

// ── Refresh button ─────────────────────────────────────────────────────────
function initRefreshBtn() {
  $('refreshOverviewBtn').addEventListener('click', () => {
    showDashboardLoading();
    refreshDashboard();
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initBroadcastModal();
  initRefreshBtn();
  initLabSessions();
  initAssignments();
  showDashboardLoading();
  refreshDashboard();
  startPolling();
});

// ════════════════════════════════════════════════════════════════════════════
// LAB SESSIONS PANEL
// ════════════════════════════════════════════════════════════════════════════

// ── API ───────────────────────────────────────────────────────────────────
async function apiCreateLabSession(payload) {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error((await r.json()).error || r.status);
  return r.json();
}

async function apiEndLabSession(id) {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions/${id}/end`, { method: 'PATCH' });
  if (!r.ok) throw new Error((await r.json()).error || r.status);
  return r.json();
}

async function apiArchiveLabSession(id) {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions/${id}/archive`, { method: 'PATCH' });
  if (!r.ok) throw new Error((await r.json()).error || r.status);
  return r.json();
}

async function apiDuplicateLabSession(id) {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions/${id}/duplicate`, { method: 'POST' });
  if (!r.ok) throw new Error((await r.json()).error || r.status);
  return r.json();
}

// ── Loading skeleton for the panel ────────────────────────────────────────
function showLabSessionsLoading() {
  $('activeSessionCard').innerHTML    = skeleton(3);
  $('previousSessionsList').innerHTML = skeleton(4);
}

// ── Render: active session card ────────────────────────────────────────────
function renderActiveSession(session) {
  const el = $('activeSessionCard');

  if (!session) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active session</div>
        <div class="es-sub">Use the form above to start one</div>
      </div>`;
    return;
  }

  const started = new Date(session.createdAt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  el.innerHTML = `
    <div style="display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap">

      <div style="flex:1; min-width:200px">
        <div style="font-size:22px; font-weight:700; color:var(--maroon); margin-bottom:4px">
          ${session.course} — ${session.labNumber}
        </div>
        <div style="font-size:13px; color:var(--gray-500); margin-bottom:12px">
          Started ${started}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px">
          <span class="badge active"><span class="pulse-dot"></span> Active</span>
          ${(session.sections || []).map(s =>
            `<span class="badge" style="background:var(--blue-light);color:var(--blue)">Section ${s}</span>`
          ).join('')}
        </div>
        <div style="font-size:13px; color:var(--gray-600)">
          <strong>${session.tables?.length ?? 0}</strong> tables configured
          &nbsp;·&nbsp;
          <strong>${session.sections?.length ?? 0}</strong> sections
        </div>
      </div>

      <div class="btn-row" style="flex-shrink:0; align-items:flex-start; padding-top:4px">
        <button class="btn btn-danger" id="endSessionBtn" data-id="${session._id}">
          ⏹ End Session
        </button>
        <button class="btn btn-secondary" id="archiveSessionBtn" data-id="${session._id}">
          🗄 Archive
        </button>
      </div>

    </div>`;

  // wire buttons
  $('endSessionBtn').addEventListener('click', () => confirmEndSession(session._id, session.course, session.labNumber));
  $('archiveSessionBtn').addEventListener('click', () => doArchiveSession(session._id));
}

// ── Render: previous sessions list ────────────────────────────────────────
function renderPreviousSessions(sessions) {
  const past = sessions.filter(s => s.status !== 'active');
  const el   = $('previousSessionsList');

  if (!past.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🕓</div>
        <div class="es-title">No previous sessions</div>
      </div>`;
    return;
  }

  el.innerHTML = past.map(s => {
    const date = new Date(s.createdAt).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const statusBadge = s.status === 'ended'
      ? `<span class="badge ended">Ended</span>`
      : `<span class="badge archived">Archived</span>`;

    return `
      <div style="display:flex; align-items:center; gap:12px;
        padding:12px 0; border-bottom:1px solid var(--gray-100);"
        data-session-id="${s._id}">

        <div style="flex:1; min-width:0">
          <div style="font-weight:600; font-size:14px; color:var(--gray-800)">
            ${s.course} — ${s.labNumber}
          </div>
          <div style="font-size:12px; color:var(--gray-400); margin-top:2px">
            ${date} &nbsp;·&nbsp;
            ${s.sections?.length ?? 0} sections &nbsp;·&nbsp;
            ${s.tables?.length ?? 0} tables
          </div>
        </div>

        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0">
          ${statusBadge}
          ${s.status === 'ended' ? `
            <button class="btn btn-secondary btn-sm" data-action="archive" data-id="${s._id}">🗄 Archive</button>
          ` : ''}
          <button class="btn btn-primary btn-sm" data-action="duplicate" data-id="${s._id}">⧉ Duplicate</button>
        </div>

      </div>`;
  }).join('');

  // wire action buttons via delegation
  el.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { action, id } = btn.dataset;
      if (action === 'archive')   await doArchiveSession(id);
      if (action === 'duplicate') await doDuplicateSession(id);
    });
  });
}

// ── Actions ────────────────────────────────────────────────────────────────
function confirmEndSession(id, course, labNumber) {
  // reuse the confirm modal pattern inline
  const confirmed = window.confirm(
    `End "${course} — ${labNumber}"?\n\nStudents will be disconnected. This cannot be undone.`
  );
  if (confirmed) doEndSession(id);
}

async function doEndSession(id) {
  const btn = $('endSessionBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Ending…'; }
  try {
    await apiEndLabSession(id);
    toast('Session ended', 'success');
    state.activeLabSession = null;
    await loadLabSessionsPanel();
    await refreshDashboard();
  } catch (err) {
    toast(`Failed to end session: ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '⏹ End Session'; }
  }
}

async function doArchiveSession(id) {
  try {
    await apiArchiveLabSession(id);
    toast('Session archived', 'success');
    await loadLabSessionsPanel();
    await refreshDashboard();
  } catch (err) {
    toast(`Failed to archive: ${err.message}`, 'error');
  }
}

async function doDuplicateSession(id) {
  try {
    await apiDuplicateLabSession(id);
    toast('Session duplicated and set as active ✓', 'success');
    await loadLabSessionsPanel();
    await refreshDashboard();
  } catch (err) {
    toast(`Failed to duplicate: ${err.message}`, 'error');
  }
}

// ── Load the full panel ────────────────────────────────────────────────────
async function loadLabSessionsPanel() {
  showLabSessionsLoading();
  try {
    const sessions = await fetchLabSessions();
    const active   = sessions.find(s => s.status === 'active') || null;
    renderActiveSession(active);
    renderPreviousSessions(sessions);
  } catch (err) {
    $('activeSessionCard').innerHTML    = `<div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>`;
    $('previousSessionsList').innerHTML = '';
    toast(`Could not load sessions: ${err.message}`, 'error');
  }
}

// ── Create session form ────────────────────────────────────────────────────
function initLabSessions() {
  $('createSessionBtn').addEventListener('click', async () => {
    const course    = $('inputCourse').value.trim();
    const labNumber = $('inputLabNumber').value.trim();
    const sections  = $('inputSections').value.trim()
      .split(',').map(s => s.trim()).filter(Boolean);
    const tablesPerSection = parseInt($('inputTables').value) || 0;

    if (!course)    { toast('Enter a course name', 'error'); $('inputCourse').focus();    return; }
    if (!labNumber) { toast('Enter a lab number',  'error'); $('inputLabNumber').focus(); return; }

    // Build flat table list: sections × tablesPerSection
    const tables = [];
    if (sections.length && tablesPerSection > 0) {
      sections.forEach((_, si) => {
        for (let t = 1; t <= tablesPerSection; t++) {
          tables.push(si * tablesPerSection + t);
        }
      });
    }

    const btn = $('createSessionBtn');
    btn.disabled    = true;
    btn.textContent = 'Starting…';

    try {
      await apiCreateLabSession({
        course,
        labNumber,
        sections,
        tables,
        createdBy: { name: state.prof.name, email: state.prof.email },
      });

      toast(`${course} ${labNumber} started ✓`, 'success');

      // clear form
      ['inputCourse','inputLabNumber','inputSections','inputTables']
        .forEach(id => { $(id).value = ''; });

      await loadLabSessionsPanel();
      await refreshDashboard();
    } catch (err) {
      toast(`Could not create session: ${err.message}`, 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Start Session';
    }
  });

  // Load panel data whenever the nav item is clicked
  document.querySelector('.nav-item[data-panel="lab-sessions"]')
    .addEventListener('click', loadLabSessionsPanel);
}

// ════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS PANEL
// ════════════════════════════════════════════════════════════════════════════

// ── In-memory staged files ─────────────────────────────────────────────────
// Each entry: { file: File, name, mimeType, size, dataUrl }
const stagedFiles = [];

// ── File type helpers ──────────────────────────────────────────────────────
const ACCEPTED = {
  'application/pdf':  { icon: '📄', label: 'PDF' },
  'image/png':        { icon: '🖼️', label: 'Image' },
  'image/jpeg':       { icon: '🖼️', label: 'Image' },
  'image/webp':       { icon: '🖼️', label: 'Image' },
  'image/gif':        { icon: '🖼️', label: 'Image' },
  'text/markdown':    { icon: '📝', label: 'Markdown' },
  'text/plain':       { icon: '📃', label: 'Text' },
};

// .md files often arrive as text/plain — normalise by extension
function normaliseMime(file) {
  if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) return 'text/markdown';
  return file.type || 'application/octet-stream';
}

function fileIcon(mime) {
  return (ACCEPTED[mime] || { icon: '📎' }).icon;
}

function fmtBytes(n) {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Read a File as base64 dataURL ──────────────────────────────────────────
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── Extract plain text from text/* and markdown files ─────────────────────
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ── Render the staged file list ────────────────────────────────────────────
function renderFileList() {
  const el  = $('uploadFileList');
  const btn = $('uploadAssignmentBtn');

  if (!stagedFiles.length) {
    el.innerHTML = '';
    btn.disabled = true;
    return;
  }

  btn.disabled = false;
  el.innerHTML = stagedFiles.map((f, i) => `
    <div class="file-row" data-index="${i}">
      <span class="file-icon">${fileIcon(f.mimeType)}</span>
      <span class="file-name">${f.name}</span>
      <span class="file-size">${fmtBytes(f.size)}</span>
      <button class="file-remove" data-index="${i}" title="Remove">✕</button>
    </div>`).join('');

  el.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      stagedFiles.splice(parseInt(btn.dataset.index), 1);
      renderFileList();
    });
  });
}

// ── Add files to the staged list (dedup by name) ───────────────────────────
async function stageFiles(fileList) {
  for (const file of fileList) {
    const mime = normaliseMime(file);
    if (!ACCEPTED[mime]) {
      toast(`${file.name}: unsupported type (${mime})`, 'error');
      continue;
    }
    if (stagedFiles.find(f => f.name === file.name)) continue; // skip duplicate
    const dataUrl = await readAsDataUrl(file);
    stagedFiles.push({ file, name: file.name, mimeType: mime, size: file.size, dataUrl });
  }
  renderFileList();
}

// ── Loading skeleton for the assignment card ───────────────────────────────
function showAssignmentLoading() {
  $('currentAssignmentCard').innerHTML = skeleton(3);
}

// ── Render: current assignment card ───────────────────────────────────────
function renderCurrentAssignment(assignment) {
  const el = $('currentAssignmentCard');

  if (!assignment) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">📭</div>
        <div class="es-title">No assignment uploaded yet</div>
        <div class="es-sub">Upload files above to distribute to all tables</div>
      </div>`;
    return;
  }

  const uploaded = new Date(assignment.createdAt).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const fileRows = (assignment.files || []).map(f => `
    <div class="file-row">
      <span class="file-icon">${fileIcon(f.mimeType)}</span>
      <span class="file-name">${f.name}</span>
      <span class="file-size">${fmtBytes(f.size || 0)}</span>
    </div>`).join('');

  const preview = assignment.extractedText
    ? `<div style="margin-top:14px">
         <div style="font-size:12px;font-weight:600;color:var(--gray-500);
           text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Extracted Content Preview</div>
         <pre style="background:var(--gray-50);border:1px solid var(--gray-200);
           border-radius:8px;padding:12px;font-size:12px;color:var(--gray-700);
           white-space:pre-wrap;max-height:180px;overflow-y:auto">${
             assignment.extractedText.slice(0, 800)
           }${assignment.extractedText.length > 800 ? '\n…' : ''}</pre>
       </div>`
    : '';

  el.innerHTML = `
    <div style="margin-bottom:10px">
      <span style="font-size:12px;color:var(--gray-500)">
        Uploaded ${uploaded} · distributed to all active tables
      </span>
      <span class="badge active" style="margin-left:8px">Live</span>
    </div>
    <div class="file-list">${fileRows}</div>
    ${preview}`;
}

// ── API: upload assignment ─────────────────────────────────────────────────
async function apiUploadAssignment(labSessionId, files, extractedText) {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions/${labSessionId}/assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files,
      extractedText,
      uploadedBy: { name: state.prof.name, email: state.prof.email },
    }),
  });
  if (!r.ok) throw new Error((await r.json()).error || r.status);
  return r.json();
}

// ── API: fetch current assignment ──────────────────────────────────────────
async function apiFetchAssignment(labSessionId) {
  const r = await fetch(`${BACKEND}/api/professor/lab-sessions/${labSessionId}/assignment`);
  if (!r.ok) throw new Error(`assignment ${r.status}`);
  return r.json(); // null if none
}

// ── Load the assignments panel ─────────────────────────────────────────────
async function loadAssignmentsPanel() {
  showAssignmentLoading();

  const labId = state.activeLabSession?._id;
  if (!labId) {
    $('currentAssignmentCard').innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active lab session</div>
        <div class="es-sub">Create a session first from <strong>Lab Sessions</strong></div>
      </div>`;
    $('uploadAssignmentBtn').disabled = true;
    $('uploadStatus').textContent = 'No active session';
    return;
  }

  $('uploadStatus').textContent = '';

  try {
    const assignment = await apiFetchAssignment(labId);
    renderCurrentAssignment(assignment);
  } catch (err) {
    $('currentAssignmentCard').innerHTML =
      `<div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>`;
  }
}

// ── Handle upload button click ─────────────────────────────────────────────
async function doUploadAssignment() {
  const labId = state.activeLabSession?._id;
  if (!labId) { toast('No active session — create one first', 'error'); return; }
  if (!stagedFiles.length) { toast('Add at least one file', 'error'); return; }

  const btn    = $('uploadAssignmentBtn');
  const status = $('uploadStatus');
  btn.disabled    = true;
  btn.textContent = 'Uploading…';
  status.textContent = '';

  try {
    // Build payload — strip the dataUrl prefix to get raw base64
    let extractedText = '';
    const filesPayload = await Promise.all(stagedFiles.map(async f => {
      const raw = f.dataUrl.split(',')[1] ?? f.dataUrl;

      // Extract text from plain-text and markdown files
      if (f.mimeType === 'text/plain' || f.mimeType === 'text/markdown') {
        try {
          const txt = await readAsText(f.file);
          extractedText += (extractedText ? '\n\n' : '') + `--- ${f.name} ---\n${txt}`;
        } catch (_) {}
      }

      return { name: f.name, mimeType: f.mimeType, data: raw, size: f.size };
    }));

    await apiUploadAssignment(labId, filesPayload, extractedText);

    toast(`${stagedFiles.length} file(s) uploaded & distributed ✓`, 'success');

    // Clear staged list
    stagedFiles.length = 0;
    renderFileList();

    // Update badge
    $('badgeAssignment').textContent = '✓';
    $('badgeAssignment').style.display = '';

    // Refresh the current assignment card
    await loadAssignmentsPanel();

  } catch (err) {
    toast(`Upload failed: ${err.message}`, 'error');
    status.textContent = `Error: ${err.message}`;
  } finally {
    btn.disabled    = false;
    btn.textContent = '📤 Upload & Distribute';
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
function initAssignments() {
  const zone      = $('uploadZone');
  const fileInput = $('assignmentFileInput');

  // Click zone → open file picker
  zone.addEventListener('click', () => fileInput.click());

  // File picker change
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length) await stageFiles(fileInput.files);
    fileInput.value = ''; // reset so same file can be re-added after removal
  });

  // Drag-and-drop
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) await stageFiles(e.dataTransfer.files);
  });

  // Upload button
  $('uploadAssignmentBtn').addEventListener('click', doUploadAssignment);

  // Load panel whenever nav item is clicked
  document.querySelector('.nav-item[data-panel="assignments"]')
    .addEventListener('click', loadAssignmentsPanel);
}

// ════════════════════════════════════════════════════════════════════════════
// SECTIONS PANEL
// ════════════════════════════════════════════════════════════════════════════

// ── API ───────────────────────────────────────────────────────────────────
async function fetchSections(labSessionId) {
  const r = await fetch(`${BACKEND}/api/professor/classroom/${labSessionId}/sections`);
  if (!r.ok) throw new Error(`sections ${r.status}`);
  return r.json(); // { sections: [{section, tables:[]}], labSession }
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function showSectionsLoading() {
  $('sectionsContainer').innerHTML = Array.from({ length: 2 }, () => `
    <div class="section-block">
      <div style="height:18px;width:120px;background:var(--gray-200);border-radius:6px;margin-bottom:12px;animation:pulse 1.2s infinite alternate"></div>
      <div class="table-grid">${Array.from({ length: 3 }, () =>
        `<div class="table-card">${skeleton(3)}</div>`).join('')}
      </div>
    </div>`).join('');
}

// ── Render a single table card (shared by Sections + Tables panels) ────────
function buildTableCard(t, clickable = true) {
  const online = (t.students || []).filter(s => s.online).length;
  const total  = (t.students || []).length;
  const helpCls = t.helpRequested ? 'help-requested' : '';
  const chips = (t.students || []).slice(0, 3).map(s => `
    <div class="student-chip">
      <span class="dot ${s.online ? 'online' : 'offline'}"></span>
      ${s.name || s.email?.split('@')[0] || '?'}
    </div>`).join('');
  const more = total > 3 ? `<div class="student-chip">+${total - 3}</div>` : '';

  return `
    <div class="table-card ${helpCls}${clickable ? ' clickable-card' : ''}" data-table="${t.tableNumber}">
      <div class="tc-title">
        Table ${t.tableNumber}
        ${t.helpRequested ? '<span class="badge help" style="margin-left:6px">Help</span>' : ''}
        ${t.followUp ? '<span class="badge" style="margin-left:4px;background:var(--yellow-light);color:#92400e">Follow-up</span>' : ''}
      </div>
      <div class="tc-row"><span>Students</span><strong>${online} online / ${total} total</strong></div>
      <div class="tc-row"><span>AI messages</span><strong>${t.chatMessageCount ?? 0}</strong></div>
      <div class="tc-row"><span>Hints given</span><strong>${t.hintCount ?? 0}</strong></div>
      <div class="tc-row"><span>Uploads</span><strong>${t.uploadCount ?? 0}</strong></div>
      <div class="tc-row"><span>Last active</span><strong>${ago(t.lastActivity)}</strong></div>
      <div class="tc-students">${chips}${more}</div>
    </div>`;
}

// ── Render sections ────────────────────────────────────────────────────────
function renderSections(data) {
  const el = $('sectionsContainer');

  if (!data.sections?.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🗂️</div>
        <div class="es-title">No sections found</div>
        <div class="es-sub">Create a lab session with sections to see them here</div>
      </div>`;
    return;
  }

  el.innerHTML = data.sections.map(sec => `
    <div class="section-block" style="margin-bottom:24px">
      <div style="font-size:15px;font-weight:700;color:var(--maroon);margin-bottom:12px;
        padding-bottom:8px;border-bottom:2px solid var(--maroon-light)">
        Section ${sec.section}
        <span style="font-size:12px;font-weight:400;color:var(--gray-500);margin-left:8px">
          ${sec.tables.length} table(s)
        </span>
      </div>
      <div class="table-grid">
        ${sec.tables.length
          ? sec.tables.map(t => buildTableCard(t, true)).join('')
          : `<div class="empty-state" style="grid-column:1/-1;padding:20px">
               <div class="es-sub">No tables active in this section</div>
             </div>`}
      </div>
    </div>`).join('');

  // Wire clicks → open table detail in Tables panel
  el.querySelectorAll('.table-card[data-table]').forEach(card => {
    card.addEventListener('click', () => {
      const tableNum = parseInt(card.dataset.table);
      openTableDetail(tableNum);
    });
  });
}

// ── Load sections panel ────────────────────────────────────────────────────
async function loadSectionsPanel() {
  const labId = state.activeLabSession?._id;
  if (!labId) {
    $('sectionsContainer').innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active lab session</div>
        <div class="es-sub">Create a session first from <strong>Lab Sessions</strong></div>
      </div>`;
    return;
  }

  showSectionsLoading();
  try {
    const data = await fetchSections(labId);
    renderSections(data);
  } catch (err) {
    $('sectionsContainer').innerHTML =
      `<div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>`;
    toast(`Could not load sections: ${err.message}`, 'error');
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
function initSections() {
  $('refreshSectionsBtn').addEventListener('click', loadSectionsPanel);
  document.querySelector('.nav-item[data-panel="sections"]')
    .addEventListener('click', loadSectionsPanel);
}

// ════════════════════════════════════════════════════════════════════════════
// TABLES PANEL
// ════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────
const tableState = { selectedTable: null };

// ── API ───────────────────────────────────────────────────────────────────
async function fetchTableDetail(labSessionId, tableNumber) {
  const r = await fetch(`${BACKEND}/api/professor/classroom/${labSessionId}/table/${tableNumber}`);
  if (!r.ok) throw new Error(`table detail ${r.status}`);
  return r.json();
}

async function apiResolveHelp(labSessionId, tableNumber) {
  const r = await fetch(`${BACKEND}/api/professor/classroom/${labSessionId}/table/${tableNumber}/resolve-help`, { method: 'POST' });
  if (!r.ok) throw new Error(`resolve-help ${r.status}`);
  return r.json();
}

async function apiMarkFollowUp(labSessionId, tableNumber) {
  const r = await fetch(`${BACKEND}/api/professor/classroom/${labSessionId}/table/${tableNumber}/follow-up`, { method: 'POST' });
  if (!r.ok) throw new Error(`follow-up ${r.status}`);
  return r.json();
}

// ── Loading skeleton ───────────────────────────────────────────────────────
function showTablesLoading() {
  $('allTablesGrid').innerHTML = Array.from({ length: 6 }, () =>
    `<div class="table-card">${skeleton(4)}</div>`).join('');
}

// ── Render all-tables grid ─────────────────────────────────────────────────
function renderAllTables(tables) {
  const el = $('allTablesGrid');
  if (!tables.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="es-icon">🪑</div>
        <div class="es-title">No active tables</div>
        <div class="es-sub">Tables appear once students join</div>
      </div>`;
    return;
  }

  el.innerHTML = tables
    .sort((a, b) => a.tableNumber - b.tableNumber)
    .map(t => buildTableCard(t, true)).join('');

  el.querySelectorAll('.table-card[data-table]').forEach(card => {
    card.addEventListener('click', () => openTableDetail(parseInt(card.dataset.table)));
  });
}

// ── Open table detail ──────────────────────────────────────────────────────
async function openTableDetail(tableNumber) {
  // Switch to Tables panel if not already there
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.nav-item[data-panel="tables"]').classList.add('active');
  $('panel-tables').classList.add('active');

  tableState.selectedTable = tableNumber;
  const detail = $('tableDetailCard');
  detail.style.display = '';
  $('tableDetailTitle').textContent = `Table ${tableNumber}`;

  // Show skeletons in detail sections
  $('tableDetailStudents').innerHTML = skeleton(2);
  $('tableDetailStatus').innerHTML   = skeleton(2);
  $('tableDetailChat').innerHTML     = skeleton(3);
  $('tableDetailUploads').innerHTML  = skeleton(1);
  $('tableDetailAI').innerHTML       = skeleton(3);

  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const labId = state.activeLabSession?._id;
  if (!labId) {
    $('tableDetailStudents').innerHTML = '<div class="empty-state"><div class="es-sub">No active session</div></div>';
    return;
  }

  try {
    const data = await fetchTableDetail(labId, tableNumber);
    renderTableDetail(data, tableNumber);
  } catch (err) {
    $('tableDetailStudents').innerHTML =
      `<div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>`;
    toast(`Could not load table detail: ${err.message}`, 'error');
  }
}

// ── Render table detail ────────────────────────────────────────────────────
function renderTableDetail(data, tableNumber) {
  const { attendance, chat, activity } = data;

  // Students
  const students = attendance?.students || [];
  const onlineEmails = new Set((activity || []).filter(a => !a.logoutTime).map(a => a.email));
  $('tableDetailStudents').innerHTML = students.length
    ? students.map(s => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;
          border-bottom:1px solid var(--gray-100)">
          <span class="dot ${onlineEmails.has(s.email) ? 'online' : 'offline'}"></span>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--gray-800)">${s.name}</div>
            <div style="font-size:11px;color:var(--gray-400)">${s.email}</div>
          </div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px"><div class="es-sub">No students joined</div></div>';

  // Status chips
  const helpRequested = (activity || []).some(a => a.helpRequested);
  $('tableDetailStatus').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0">
      <span class="badge ${onlineEmails.size > 0 ? 'active' : ''}">
        ${onlineEmails.size} online
      </span>
      <span class="badge">${chat?.messages?.length ?? 0} AI messages</span>
      ${helpRequested ? '<span class="badge help">Help requested</span>' : ''}
    </div>`;

  // Shared chat preview
  const msgs = chat?.messages || [];
  $('tableDetailChat').innerHTML = msgs.length
    ? msgs.slice(-10).map(m => `
        <div class="activity-item">
          <div class="activity-icon">${m.role === 'user' ? '👤' : '🤖'}</div>
          <div class="activity-text">
            ${m.userName ? `<strong>${m.userName}</strong> — ` : ''}
            ${m.content.slice(0, 120)}${m.content.length > 120 ? '…' : ''}
          </div>
          <div class="activity-time">${fmt(m.timestamp)}</div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px"><div class="es-sub">No messages yet</div></div>';

  // Uploaded files (inferred from chat messages referencing uploads)
  const uploadMsgs = msgs.filter(m => m.role === 'user' && /\[image\]|\[file\]|uploaded/i.test(m.content));
  $('tableDetailUploads').innerHTML = uploadMsgs.length
    ? uploadMsgs.map(m => `
        <div class="file-row">
          <span class="file-icon">🖼️</span>
          <span class="file-name">${m.content.slice(0, 60)}</span>
          <span class="file-size">${fmt(m.timestamp)}</span>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--gray-400);padding:4px 0">No uploads detected</div>';

  // AI conversation summary (bot messages)
  const botMsgs = msgs.filter(m => m.role === 'bot');
  $('tableDetailAI').innerHTML = botMsgs.length
    ? botMsgs.slice(-6).map(m => `
        <div class="activity-item">
          <div class="activity-icon">🤖</div>
          <div class="activity-text">${m.content.slice(0, 140)}${m.content.length > 140 ? '…' : ''}</div>
          <div class="activity-time">${fmt(m.timestamp)}</div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px"><div class="es-sub">No AI responses yet</div></div>';

  // Wire action buttons
  wireTableDetailActions(tableNumber);
}

// ── Wire professor action buttons ──────────────────────────────────────────
function wireTableDetailActions(tableNumber) {
  const labId = state.activeLabSession?._id;

  $('tableMessageBtn').onclick = () => {
    openBroadcastToTable(tableNumber);
  };

  $('tableObserveBtn').onclick = () => {
    toast(`Observer mode: join Table ${tableNumber} in the student view`, 'info');
  };

  $('tableCloseBtn').onclick = async () => {
    if (!labId) return;
    try {
      await apiMarkFollowUp(labId, tableNumber);
      toast(`Table ${tableNumber} marked for follow-up ✓`, 'success');
      await loadTablesPanel();
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
    }
  };

  $('tableEndBtn').onclick = async () => {
    if (!labId) return;
    try {
      await apiResolveHelp(labId, tableNumber);
      toast(`Help request resolved for Table ${tableNumber} ✓`, 'success');
      await loadTablesPanel();
      await refreshDashboard();
    } catch (err) {
      toast(`Failed: ${err.message}`, 'error');
    }
  };
}

// ── Load tables panel ──────────────────────────────────────────────────────
async function loadTablesPanel() {
  const labId = state.activeLabSession?._id;
  if (!labId) {
    $('allTablesGrid').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active lab session</div>
        <div class="es-sub">Create a session first from <strong>Lab Sessions</strong></div>
      </div>`;
    $('tableDetailCard').style.display = 'none';
    return;
  }

  showTablesLoading();
  try {
    const cs = await fetchClassroomState(labId);
    state.classroomState = cs;
    renderAllTables(cs.tables || []);
    // Re-render detail if one was open
    if (tableState.selectedTable !== null) {
      await openTableDetail(tableState.selectedTable);
    }
  } catch (err) {
    $('allTablesGrid').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1"><div class="es-sub">Error: ${err.message}</div></div>`;
    toast(`Could not load tables: ${err.message}`, 'error');
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
function initTables() {
  $('refreshTablesBtn').addEventListener('click', loadTablesPanel);
  $('tableDetailCloseBtn').addEventListener('click', () => {
    $('tableDetailCard').style.display = 'none';
    tableState.selectedTable = null;
  });
  // "New Table" is a no-op placeholder — tables are created via Lab Sessions
  $('newTableBtn').addEventListener('click', () => {
    toast('Tables are configured when creating a Lab Session', 'info');
  });

  document.querySelector('.nav-item[data-panel="tables"]')
    .addEventListener('click', loadTablesPanel);
}

// ── Add initSections + initTables to boot ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSections();
  initTables();
});

// ════════════════════════════════════════════════════════════════════════════
// STUDENTS PANEL
// ════════════════════════════════════════════════════════════════════════════

// ── Module state ──────────────────────────────────────────────────────────
const studentState = {
  all:      [],   // full roster from API
  filtered: [],   // after search/filter
  selected: null, // { email, name, tableNumber, section }
};

// ── API ───────────────────────────────────────────────────────────────────
async function fetchStudentRoster(labSessionId) {
  const r = await fetch(`${BACKEND}/api/professor/classroom/${labSessionId}/students`);
  if (!r.ok) throw new Error(`students ${r.status}`);
  return r.json(); // { students: [], labSession }
}

async function fetchStudentDetail(labSessionId, email) {
  const r = await fetch(
    `${BACKEND}/api/professor/classroom/${labSessionId}/student/${encodeURIComponent(email)}`
  );
  if (!r.ok) throw new Error(`student detail ${r.status}`);
  return r.json(); // { email, activity, tableNumber, messages }
}

async function apiMoveStudent(labSessionId, email, toTable) {
  const r = await fetch(
    `${BACKEND}/api/professor/classroom/${labSessionId}/student/${encodeURIComponent(email)}/move`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toTable }),
    }
  );
  if (!r.ok) throw new Error(`move ${r.status}`);
  return r.json();
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function showStudentsLoading() {
  $('studentsTableContainer').innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Email</th><th>Section</th>
        <th>Table</th><th>Status</th><th>Joined</th><th>Last Active</th>
      </tr></thead>
      <tbody>${Array.from({ length: 6 }, () => `
        <tr>${Array.from({ length: 7 }, () =>
          `<td><div style="height:13px;background:var(--gray-200);border-radius:4px;
            animation:pulse 1.2s infinite alternate"></div></td>`
        ).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Render student table ──────────────────────────────────────────────────
function renderStudentTable(students) {
  const el = $('studentsTableContainer');

  if (!students.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">👥</div>
        <div class="es-title">No students found</div>
        <div class="es-sub">Try adjusting your search or filters</div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Name</th><th>Email</th><th>Section</th>
        <th>Table</th><th>Status</th><th>Joined</th><th>Last Active</th>
      </tr></thead>
      <tbody>
        ${students.map(s => `
          <tr class="student-row" data-email="${s.email}" style="cursor:pointer">
            <td style="font-weight:600;color:var(--gray-800)">${s.name || '—'}</td>
            <td style="color:var(--gray-500);font-size:12px">${s.email}</td>
            <td><span class="badge" style="background:var(--blue-light);color:var(--blue)">
              ${s.section || '—'}
            </span></td>
            <td>Table ${s.tableNumber ?? '—'}</td>
            <td>
              <span class="badge ${s.online ? 'online' : 'offline'}">
                <span class="dot ${s.online ? 'online' : 'offline'}" style="display:inline-block;margin-right:4px"></span>
                ${s.online ? 'Online' : 'Offline'}
              </span>
            </td>
            <td style="font-size:12px;color:var(--gray-500)">${fmt(s.joinTime)}</td>
            <td style="font-size:12px;color:var(--gray-500)">${ago(s.lastActivity)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  el.querySelectorAll('.student-row').forEach(row => {
    row.addEventListener('click', () => {
      const s = students.find(x => x.email === row.dataset.email);
      if (s) openStudentDetail(s);
    });
  });
}

// ── Filter logic ──────────────────────────────────────────────────────────
function applyStudentFilters() {
  const query   = $('studentSearchInput').value.trim().toLowerCase();
  const section = $('studentFilterSection').value;
  const table   = $('studentFilterTable').value;
  const online  = $('studentFilterOnline').checked;

  studentState.filtered = studentState.all.filter(s => {
    if (query && !s.name?.toLowerCase().includes(query) && !s.email?.toLowerCase().includes(query)) return false;
    if (section && s.section !== section) return false;
    if (table && String(s.tableNumber) !== table) return false;
    if (online && !s.online) return false;
    return true;
  });

  renderStudentTable(studentState.filtered);
}

// ── Populate filter dropdowns ─────────────────────────────────────────────
function populateStudentFilters(students, labSession) {
  const sections = [...new Set(students.map(s => s.section).filter(Boolean))].sort();
  const tables   = [...new Set(students.map(s => s.tableNumber).filter(n => n != null))].sort((a, b) => a - b);

  $('studentFilterSection').innerHTML =
    `<option value="">All sections</option>` +
    sections.map(s => `<option value="${s}">Section ${s}</option>`).join('');

  $('studentFilterTable').innerHTML =
    `<option value="">All tables</option>` +
    tables.map(t => `<option value="${t}">Table ${t}</option>`).join('');
}

// ── Open student detail ───────────────────────────────────────────────────
async function openStudentDetail(s) {
  studentState.selected = s;

  $('studentDetailCard').style.display = '';
  $('studentDetailName').textContent = s.name || s.email;

  // Skeleton while loading
  $('studentDetailMeta').innerHTML   = skeleton(1);
  $('studentTimeline').innerHTML     = skeleton(3);
  $('studentChatHistory').innerHTML  = skeleton(3);
  $('studentUploads').innerHTML      = skeleton(1);

  $('studentDetailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });

  const labId = state.activeLabSession?._id;
  if (!labId) return;

  try {
    const detail = await fetchStudentDetail(labId, s.email);
    renderStudentDetail(s, detail);
  } catch (err) {
    $('studentDetailMeta').innerHTML =
      `<div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>`;
    toast(`Could not load student detail: ${err.message}`, 'error');
  }
}

// ── Render student detail ─────────────────────────────────────────────────
function renderStudentDetail(s, detail) {
  const { activity = [], messages = [] } = detail;
  const isOnline = s.online;
  const totalDuration = activity.reduce((sum, a) => sum + (a.durationSeconds || 0), 0);
  const userMsgs = messages.filter(m => m.role === 'user');
  const botMsgs  = messages.filter(m => m.role === 'bot');
  const hints    = botMsgs.filter(m => /hint/i.test(m.content));
  const uploads  = userMsgs.filter(m => /\[image\]|\[file\]|uploaded/i.test(m.content));

  // ── Meta chips ──
  $('studentDetailMeta').innerHTML = `
    <div class="detail-row">
      <span class="dr-label">Section</span>
      <span class="dr-value">${s.section || '—'}</span>
    </div>
    <div class="detail-row">
      <span class="dr-label">Table</span>
      <span class="dr-value">Table ${s.tableNumber ?? '—'}</span>
    </div>
    <div class="detail-row">
      <span class="dr-label">Status</span>
      <span class="dr-value">
        <span class="badge ${isOnline ? 'online' : 'offline'}">
          <span class="dot ${isOnline ? 'online' : 'offline'}" style="display:inline-block;margin-right:4px"></span>
          ${isOnline ? 'Online' : 'Offline'}
        </span>
      </span>
    </div>
    <div class="detail-row">
      <span class="dr-label">Joined</span>
      <span class="dr-value">${fmt(s.joinTime)}</span>
    </div>
    <div class="detail-row">
      <span class="dr-label">Time in session</span>
      <span class="dr-value">${totalDuration > 0 ? `${Math.round(totalDuration / 60)}m` : '—'}</span>
    </div>
    <div class="detail-row">
      <span class="dr-label">AI messages</span>
      <span class="dr-value">${userMsgs.length} sent · ${botMsgs.length} received</span>
    </div>
    <div class="detail-row">
      <span class="dr-label">Hints received</span>
      <span class="dr-value">${hints.length}</span>
    </div>
    <div class="detail-row">
      <span class="dr-label">Uploads</span>
      <span class="dr-value">${uploads.length}</span>
    </div>`;

  // ── Activity timeline ──
  const timelineItems = [];
  for (const a of activity) {
    timelineItems.push({ type: 'join',  time: a.loginTime,  label: 'Joined session' });
    if (a.logoutTime) timelineItems.push({ type: 'leave', time: a.logoutTime, label: `Left session (${a.durationSeconds ? Math.round(a.durationSeconds / 60) + 'm' : '—'})` });
  }
  // Add first few AI interactions as timeline events
  for (const m of userMsgs.slice(0, 4)) {
    timelineItems.push({ type: 'msg', time: m.timestamp, label: `Sent: ${m.content.slice(0, 60)}${m.content.length > 60 ? '…' : ''}` });
  }
  timelineItems.sort((a, b) => new Date(a.time) - new Date(b.time));

  $('studentTimeline').innerHTML = timelineItems.length
    ? timelineItems.map(item => `
        <div class="tl-item">
          <div class="tl-dot ${item.type}">
            ${item.type === 'join' ? '👋' : item.type === 'leave' ? '🚪' : '💬'}
          </div>
          <div class="tl-content"><strong>${item.label}</strong></div>
          <div class="tl-time">${fmt(item.time)}</div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px"><div class="es-sub">No activity recorded</div></div>';

  // ── AI conversation history ──
  $('studentChatHistory').innerHTML = messages.length
    ? messages.slice(-12).map(m => `
        <div class="activity-item">
          <div class="activity-icon">${m.role === 'user' ? '👤' : '🤖'}</div>
          <div class="activity-text">
            ${m.role === 'bot' && /hint/i.test(m.content)
              ? '<span class="badge" style="background:var(--yellow-light);color:#92400e;margin-right:4px">Hint</span>'
              : ''}
            ${m.content.slice(0, 130)}${m.content.length > 130 ? '…' : ''}
          </div>
          <div class="activity-time">${fmt(m.timestamp)}</div>
        </div>`).join('')
    : '<div class="empty-state" style="padding:12px"><div class="es-sub">No conversation yet</div></div>';

  // ── Uploaded work ──
  $('studentUploads').innerHTML = uploads.length
    ? uploads.map(m => `
        <div class="file-row">
          <span class="file-icon">🖼️</span>
          <span class="file-name">${m.content.slice(0, 70)}</span>
          <span class="file-size">${fmt(m.timestamp)}</span>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--gray-400);padding:4px 0">No uploads detected</div>';

  // ── Wire action buttons ──
  // Inject extra action buttons alongside the existing Move button
  const btnRow = $('moveStudentBtn').parentElement;
  if (!btnRow.querySelector('#sendStudentMsgBtn')) {
    const msgBtn = document.createElement('button');
    msgBtn.id = 'sendStudentMsgBtn';
    msgBtn.className = 'btn btn-secondary btn-sm';
    msgBtn.textContent = '💬 Send Message';
    btnRow.appendChild(msgBtn);

    const jumpBtn = document.createElement('button');
    jumpBtn.id = 'jumpToTableBtn';
    jumpBtn.className = 'btn btn-secondary btn-sm';
    jumpBtn.textContent = '🪑 Jump to Table';
    btnRow.appendChild(jumpBtn);
  }

  $('moveStudentBtn').onclick = () => openMoveStudentModal(s);

  $('sendStudentMsgBtn').onclick = () => {
    $('broadcastTarget').value = 'table';
    $('broadcastTargetDetail').style.display = '';
    $('broadcastTargetValue').value = s.tableNumber;
    $('broadcastMessage').value = '';
    $('broadcastModal').classList.add('open');
  };

  $('jumpToTableBtn').onclick = () => openTableDetail(s.tableNumber);
}

// ── Move student modal ────────────────────────────────────────────────────
function openMoveStudentModal(s) {
  $('moveStudentName').textContent = `${s.name} (${s.email})`;

  // Populate table options from current classroom state
  const tables = state.classroomState?.tables || [];
  const allTableNums = state.activeLabSession?.tables || [];
  const nums = allTableNums.length
    ? allTableNums
    : tables.map(t => t.tableNumber);

  $('moveToTable').innerHTML = nums
    .filter(n => n !== s.tableNumber)
    .map(n => `<option value="${n}">Table ${n}</option>`)
    .join('');

  $('moveStudentModal').classList.add('open');
}

// ── Load students panel ───────────────────────────────────────────────────
async function loadStudentsPanel() {
  const labId = state.activeLabSession?._id;
  if (!labId) {
    $('studentsTableContainer').innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active lab session</div>
        <div class="es-sub">Create a session first from <strong>Lab Sessions</strong></div>
      </div>`;
    $('studentDetailCard').style.display = 'none';
    return;
  }

  showStudentsLoading();
  try {
    const { students, labSession } = await fetchStudentRoster(labId);
    studentState.all      = students;
    studentState.filtered = students;
    populateStudentFilters(students, labSession);
    renderStudentTable(students);
    $('badgeStudents').textContent = students.length;
  } catch (err) {
    $('studentsTableContainer').innerHTML =
      `<div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>`;
    toast(`Could not load students: ${err.message}`, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function initStudents() {
  // Search + filter controls (injected into the card-header area via JS)
  const headerEl = $('panel-students').querySelector('.card-header');
  // Insert filter controls after the existing search input
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px';
  filterBar.innerHTML = `
    <select id="studentFilterSection" class="form-control" style="width:140px;margin:0">
      <option value="">All sections</option>
    </select>
    <select id="studentFilterTable" class="form-control" style="width:120px;margin:0">
      <option value="">All tables</option>
    </select>
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--gray-600);cursor:pointer;white-space:nowrap">
      <input type="checkbox" id="studentFilterOnline" /> Online only
    </label>
    <button class="btn btn-secondary btn-sm" id="refreshStudentsBtn">↻ Refresh</button>`;

  // Insert after card-header's last child
  const cardBody = $('studentsTableContainer').parentElement;
  cardBody.insertBefore(filterBar, $('studentsTableContainer'));

  // Wire search + filters
  $('studentSearchInput').addEventListener('input', applyStudentFilters);
  filterBar.addEventListener('change', applyStudentFilters);
  $('refreshStudentsBtn').addEventListener('click', loadStudentsPanel);

  // Close detail
  $('studentDetailCloseBtn').addEventListener('click', () => {
    $('studentDetailCard').style.display = 'none';
    studentState.selected = null;
  });

  // Move student modal
  const modal = $('moveStudentModal');
  $('moveStudentModalClose').addEventListener('click',  () => modal.classList.remove('open'));
  $('moveStudentCancelBtn').addEventListener('click',   () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  $('moveStudentConfirmBtn').addEventListener('click', async () => {
    const s     = studentState.selected;
    const toTable = parseInt($('moveToTable').value);
    const labId = state.activeLabSession?._id;
    if (!s || !toTable || !labId) return;

    $('moveStudentConfirmBtn').disabled = true;
    $('moveStudentConfirmBtn').textContent = 'Moving…';
    try {
      await apiMoveStudent(labId, s.email, toTable);
      toast(`${s.name} moved to Table ${toTable} ✓`, 'success');
      modal.classList.remove('open');
      await loadStudentsPanel();
      // Re-open detail with updated data
      const updated = studentState.all.find(x => x.email === s.email);
      if (updated) openStudentDetail(updated);
    } catch (err) {
      toast(`Move failed: ${err.message}`, 'error');
    } finally {
      $('moveStudentConfirmBtn').disabled = false;
      $('moveStudentConfirmBtn').textContent = 'Move';
    }
  });

  // Jump to table action — wired globally so renderStudentDetail can call it
  window.jumpToStudentTable = function(tableNumber) {
    openTableDetail(tableNumber);
  };

  // Nav click
  document.querySelector('.nav-item[data-panel="students"]')
    .addEventListener('click', loadStudentsPanel);
}

// ── Register in boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initStudents();
});

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS PANEL
// ════════════════════════════════════════════════════════════════════════════

// ── Chart instance registry — destroy before redraw ───────────────────────
const _charts = {};
function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── Shared Chart.js defaults ──────────────────────────────────────────────
const CHART_COLORS = {
  maroon:  '#881c1c',
  blue:    '#2563eb',
  green:   '#16a34a',
  yellow:  '#ca8a04',
  red:     '#dc2626',
  gray:    '#9ca3af',
  maroonA: 'rgba(136,28,28,0.15)',
  blueA:   'rgba(37,99,235,0.15)',
  greenA:  'rgba(22,163,74,0.15)',
};

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280', font: { size: 11 } } },
    y: { grid: { color: '#e5e7eb' }, ticks: { color: '#6b7280', font: { size: 11 } }, beginAtZero: true },
  },
};

function makeChart(id, config) {
  destroyChart(id);
  const canvas = $(id);
  if (!canvas) return;
  _charts[id] = new Chart(canvas, config);
}

// ── API ───────────────────────────────────────────────────────────────────
async function fetchAnalytics(labSessionId) {
  const r = await fetch(`${BACKEND}/api/professor/analytics/${labSessionId}`);
  if (!r.ok) throw new Error(`analytics ${r.status}`);
  return r.json();
}

// ── Skeleton: replace canvas wrappers with pulse blocks ───────────────────
function showAnalyticsLoading() {
  $('analyticsStatGrid').innerHTML = Array.from({ length: 6 }, () =>
    `<div class="stat-card">${skeleton(2)}</div>`).join('');

  [
    'analyticsOnlineWrap', 'analyticsParticipationWrap',
    'analyticsUploadsWrap', 'analyticsHintsWrap',
    'analyticsConfidenceWrap', 'analyticsActivityWrap',
    'analyticsDifficultWrap', 'analyticsInterventionWrap',
  ].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = `<div style="height:200px;background:var(--gray-100);border-radius:8px;
      animation:pulse 1.2s infinite alternate"></div>`;
  });

  $('chartMostActive').innerHTML    = skeleton(3);
  $('chartLeastActive').innerHTML   = skeleton(3);
  $('interventionList').innerHTML   = skeleton(2);
  $('difficultQuestions').innerHTML = skeleton(3);
}

// ── Render: summary stat cards ────────────────────────────────────────────
function renderAnalyticsStats(d) {
  const avgRtSec = d.avgResponseMs > 0 ? (d.avgResponseMs / 1000).toFixed(1) : '—';
  const cards = [
    { label: 'Students Online',      value: d.studentsOnline,        sub: `${d.studentsTotal} total`,          cls: 'green' },
    { label: 'Participation Rate',   value: `${d.participationRate}%`, sub: `${d.activeStudents} active`,      cls: d.participationRate >= 70 ? 'green' : 'red' },
    { label: 'Total AI Messages',    value: d.totalMessages,          sub: `avg ${d.avgMessagesPerTable}/table`, cls: '' },
    { label: 'Avg Response Time',    value: `${avgRtSec}s`,           sub: 'AI reply latency',                  cls: '' },
    { label: 'Avg Uploads / Table',  value: d.avgUploadsPerTable,     sub: 'files submitted',                   cls: '' },
    { label: 'Avg Hints / Table',    value: d.avgHintsPerTable,       sub: 'hint messages',                     cls: d.avgHintsPerTable > 3 ? 'red' : '' },
  ];
  $('analyticsStatGrid').innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>`).join('');
}

// ── Restore canvas after skeleton replaced it ─────────────────────────────
function restoreCanvas(wrapperId, canvasId) {
  const wrap = $(wrapperId);
  if (!wrap) return;
  wrap.innerHTML = `<canvas id="${canvasId}"></canvas>`;
}

// ── Chart 1: Students Online Over Time (line) ─────────────────────────────
function renderChartOnlineOverTime(data) {
  restoreCanvas('analyticsOnlineWrap', 'chartOnlineOverTime');
  if (!data.length) { $('analyticsOnlineWrap').innerHTML = emptyChartMsg(); return; }
  const labels = data.map(d => fmt(d.time));
  const values = data.map(d => d.count);
  makeChart('chartOnlineOverTime', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: CHART_COLORS.green,
        backgroundColor: CHART_COLORS.greenA,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        borderWidth: 2,
      }],
    },
    options: { ...BASE_OPTS, plugins: { legend: { display: false } } },
  });
}

// ── Chart 2: Participation doughnut ──────────────────────────────────────
function renderChartParticipation(d) {
  restoreCanvas('analyticsParticipationWrap', 'chartParticipation');
  const active   = d.activeStudents;
  const inactive = Math.max(0, d.studentsTotal - active);
  makeChart('chartParticipation', {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Inactive'],
      datasets: [{
        data: [active, inactive],
        backgroundColor: [CHART_COLORS.green, CHART_COLORS.gray],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: '#6b7280' } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
      },
    },
  });
}

// ── Chart 3: Uploads per table (bar) ─────────────────────────────────────
function renderChartUploads(tableStats) {
  restoreCanvas('analyticsUploadsWrap', 'chartUploads');
  const sorted = [...tableStats].sort((a, b) => a.tableNumber - b.tableNumber);
  if (!sorted.length) { $('analyticsUploadsWrap').innerHTML = emptyChartMsg(); return; }
  makeChart('chartUploads', {
    type: 'bar',
    data: {
      labels: sorted.map(t => `T${t.tableNumber}`),
      datasets: [{
        data: sorted.map(t => t.uploadCount),
        backgroundColor: CHART_COLORS.blue,
        borderRadius: 4,
      }],
    },
    options: BASE_OPTS,
  });
}

// ── Chart 4: Hints per table (bar) ────────────────────────────────────────
function renderChartHints(tableStats) {
  restoreCanvas('analyticsHintsWrap', 'chartHints');
  const sorted = [...tableStats].sort((a, b) => a.tableNumber - b.tableNumber);
  if (!sorted.length) { $('analyticsHintsWrap').innerHTML = emptyChartMsg(); return; }
  makeChart('chartHints', {
    type: 'bar',
    data: {
      labels: sorted.map(t => `T${t.tableNumber}`),
      datasets: [{
        data: sorted.map(t => t.hintCount),
        backgroundColor: CHART_COLORS.yellow,
        borderRadius: 4,
      }],
    },
    options: BASE_OPTS,
  });
}

// ── Chart 5: AI Confidence by table (horizontal bar) ─────────────────────
function renderChartConfidence(confidenceByTable) {
  restoreCanvas('analyticsConfidenceWrap', 'chartConfidence');
  if (!confidenceByTable.length) { $('analyticsConfidenceWrap').innerHTML = emptyChartMsg(); return; }
  const sorted = [...confidenceByTable].sort((a, b) => a.tableNumber - b.tableNumber);
  makeChart('chartConfidence', {
    type: 'bar',
    data: {
      labels: sorted.map(t => `T${t.tableNumber}`),
      datasets: [{
        data: sorted.map(t => t.confidence),
        backgroundColor: sorted.map(t =>
          t.confidence >= 80 ? CHART_COLORS.green :
          t.confidence >= 50 ? CHART_COLORS.yellow : CHART_COLORS.red
        ),
        borderRadius: 4,
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        ...BASE_OPTS.scales,
        y: { ...BASE_OPTS.scales.y, max: 100,
          ticks: { ...BASE_OPTS.scales.y.ticks, callback: v => `${v}%` } },
      },
    },
  });
}

// ── Chart 6: Table activity — total messages (bar) ────────────────────────
function renderChartTableActivity(tableStats) {
  restoreCanvas('analyticsActivityWrap', 'chartTableActivity');
  const sorted = [...tableStats].sort((a, b) => a.tableNumber - b.tableNumber);
  if (!sorted.length) { $('analyticsActivityWrap').innerHTML = emptyChartMsg(); return; }
  makeChart('chartTableActivity', {
    type: 'bar',
    data: {
      labels: sorted.map(t => `T${t.tableNumber}`),
      datasets: [
        {
          label: 'User',
          data: sorted.map(t => t.userMessages),
          backgroundColor: CHART_COLORS.maroon,
          borderRadius: 4,
        },
        {
          label: 'AI',
          data: sorted.map(t => t.botMessages),
          backgroundColor: CHART_COLORS.maroonA.replace('0.15', '0.5'),
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: '#6b7280' } },
      },
      scales: { ...BASE_OPTS.scales, x: { ...BASE_OPTS.scales.x, stacked: false } },
    },
  });
}

// ── Chart 7: Difficult questions (horizontal bar) ─────────────────────────
function renderChartDifficult(difficultQuestions) {
  restoreCanvas('analyticsDifficultWrap', 'chartDifficult');
  if (!difficultQuestions.length) { $('analyticsDifficultWrap').innerHTML = emptyChartMsg('No repeated questions yet'); return; }
  const top = difficultQuestions.slice(0, 6);
  makeChart('chartDifficult', {
    type: 'bar',
    data: {
      labels: top.map(q => q.question.slice(0, 30) + (q.question.length > 30 ? '…' : '')),
      datasets: [{
        data: top.map(q => q.count),
        backgroundColor: CHART_COLORS.red,
        borderRadius: 4,
      }],
    },
    options: {
      ...BASE_OPTS,
      indexAxis: 'y',
      scales: {
        x: { ...BASE_OPTS.scales.x, ticks: { ...BASE_OPTS.scales.x.ticks, stepSize: 1 } },
        y: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 } } },
      },
    },
  });
}

// ── Chart 8: Intervention frequency (bar) ────────────────────────────────
function renderChartIntervention(interventionStats) {
  restoreCanvas('analyticsInterventionWrap', 'chartIntervention');
  if (!interventionStats.length) { $('analyticsInterventionWrap').innerHTML = emptyChartMsg('No help requests recorded'); return; }
  makeChart('chartIntervention', {
    type: 'bar',
    data: {
      labels: interventionStats.map(t => `T${t.tableNumber}`),
      datasets: [
        {
          label: 'Help Requests',
          data: interventionStats.map(t => t.helpCount),
          backgroundColor: CHART_COLORS.red,
          borderRadius: 4,
        },
        {
          label: 'Resolved',
          data: interventionStats.map(t => t.resolvedCount),
          backgroundColor: CHART_COLORS.green,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...BASE_OPTS,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, color: '#6b7280' } },
      },
    },
  });
}

// ── CSS bar-chart rows (Most/Least active) ────────────────────────────────
function renderBarList(containerId, rows, maxVal) {
  const el = $(containerId);
  if (!rows.length) { el.innerHTML = emptyChartMsg(); return; }
  el.innerHTML = rows.map(t => {
    const pct = maxVal > 0 ? Math.round((t.total / maxVal) * 100) : 0;
    return `
      <div class="bar-row">
        <span class="bar-label">T${t.tableNumber}</span>
        <div class="bar-track">
          <div style="height:100%;width:${pct}%;background:var(--maroon);border-radius:5px;transition:width .4s"></div>
        </div>
        <span style="font-size:11px;color:var(--gray-600);width:28px;text-align:right;flex-shrink:0">${t.total}</span>
      </div>`;
  }).join('');
}

// ── Intervention list ─────────────────────────────────────────────────────
function renderInterventionList(tables) {
  const el = $('interventionList');
  if (!tables.length) {
    el.innerHTML = `<div class="empty-state" style="padding:16px">
      <div class="es-icon">✅</div><div class="es-title">All tables active</div></div>`;
    return;
  }
  el.innerHTML = tables.map(t => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
      border-bottom:1px solid var(--gray-100)">
      <span style="font-size:18px">⚠️</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;color:var(--gray-800)">Table ${t.tableNumber}</div>
        <div style="font-size:12px;color:var(--gray-400)">${t.total} message(s) — low engagement</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="openBroadcastToTable(${t.tableNumber})">
        Message
      </button>
    </div>`).join('');
}

// ── Difficult questions detail list ──────────────────────────────────────
function renderDifficultList(questions) {
  const el = $('difficultQuestions');
  if (!questions.length) {
    el.innerHTML = `<div class="empty-state" style="padding:16px">
      <div class="es-icon">📭</div><div class="es-title">No repeated questions yet</div></div>`;
    return;
  }
  el.innerHTML = questions.map((q, i) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:8px 0;
      border-bottom:1px solid var(--gray-100)">
      <span style="font-size:11px;font-weight:700;color:var(--maroon);
        background:var(--maroon-faint);border-radius:50%;width:22px;height:22px;
        display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</span>
      <div style="flex:1;font-size:13px;color:var(--gray-700)">${q.question}</div>
      <span class="badge" style="background:var(--red-light);color:var(--red);flex-shrink:0">
        ×${q.count}
      </span>
    </div>`).join('');
}

// ── Empty chart placeholder ───────────────────────────────────────────────
function emptyChartMsg(msg = 'No data yet') {
  return `<div class="empty-state" style="padding:40px 0">
    <div class="es-icon">📭</div><div class="es-title">${msg}</div></div>`;
}

// ── No-session guard ──────────────────────────────────────────────────────
function renderAnalyticsNoSession() {
  $('analyticsStatGrid').innerHTML = `
    <div class="stat-card" style="grid-column:1/-1">
      <div class="empty-state">
        <div class="es-icon">🧪</div>
        <div class="es-title">No active lab session</div>
        <div class="es-sub">Create a session first from <strong>Lab Sessions</strong></div>
      </div>
    </div>`;
  [
    'analyticsOnlineWrap','analyticsParticipationWrap',
    'analyticsUploadsWrap','analyticsHintsWrap',
    'analyticsConfidenceWrap','analyticsActivityWrap',
    'analyticsDifficultWrap','analyticsInterventionWrap',
    'chartMostActive','chartLeastActive','interventionList','difficultQuestions',
  ].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = '';
  });
}

// ── Main load ─────────────────────────────────────────────────────────────
async function loadAnalyticsPanel() {
  const labId = state.activeLabSession?._id;
  if (!labId) { renderAnalyticsNoSession(); return; }

  showAnalyticsLoading();

  try {
    const d = await fetchAnalytics(labId);

    renderAnalyticsStats(d);

    // Chart.js charts
    renderChartOnlineOverTime(d.onlineOverTime || []);
    renderChartParticipation(d);
    renderChartUploads(d.tableStats || []);
    renderChartHints(d.tableStats || []);
    renderChartConfidence(d.confidenceByTable || []);
    renderChartTableActivity(d.tableStats || []);
    renderChartDifficult(d.difficultQuestions || []);
    renderChartIntervention(d.interventionStats || []);

    // CSS bar lists
    const maxTotal = (d.mostActiveTables?.[0]?.total) || 1;
    renderBarList('chartMostActive',  d.mostActiveTables  || [], maxTotal);
    renderBarList('chartLeastActive', d.leastActiveTables || [], maxTotal);

    // Text lists
    renderInterventionList(d.tablesNeedingIntervention || []);
    renderDifficultList(d.difficultQuestions || []);

  } catch (err) {
    $('analyticsStatGrid').innerHTML =
      `<div class="stat-card" style="grid-column:1/-1">
         <div class="empty-state"><div class="es-sub">Error: ${err.message}</div></div>
       </div>`;
    toast(`Analytics failed: ${err.message}`, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function initAnalytics() {
  $('refreshAnalyticsBtn').addEventListener('click', loadAnalyticsPanel);
  document.querySelector('.nav-item[data-panel="analytics"]')
    .addEventListener('click', loadAnalyticsPanel);
}

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
});
