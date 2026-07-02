/**
 * chat-history-manager.js
 * Client-side singleton — manages the slide-in history sidebar and
 * MongoDB persistence via the Render Express backend.
 *
 * Render base URL (Express backend):
 *   https://ai-tutor-53f1.onrender.com
 */

(function () {
  const RENDER_BASE = "https://ai-tutor-53f1.onrender.com";

  // ─── State ────────────────────────────────────────────────────────────────
  let _email = null;
  let _conversationId = null;
  let _titleSaved = false;
  let _initialized = false;

  // Queue for messages that arrive before init() is called or before
  // the first conversation is created.
  let _pendingMessages = [];
  let _flushTimer = null;

  // ── In-class state ──────────────────────────────────────────────────────
  let _inClassConvoId = null;
  let _inClassTitleSaved = false;
  let _inClassPendingMessages = [];
  let _inClassFlushTimer = null;

  // ─── Public API ───────────────────────────────────────────────────────────
  const manager = {
    /** Call once the student email is known (after gate closes). */
    async init(email) {
      _email = email;
      _initialized = true;
      _buildUI();
      await _loadList();
      // Start a fresh conversation for this session
      await _createConversation();
      // Flush any messages that arrived before init completed
      _scheduleFlush();

      // If in-class mode, also init the shared in-class chat record
      if (window._inClassMode) {
        await manager.initInClass();
      }
    },

    /**
     * Initialize the shared in-class chat record.
     * Tries to reuse an existing record first; if none, creates one.
     */
    async initInClass() {
      const sessionId = window._inClassSessionId;
      if (!sessionId) return;

      try {
        const res = await fetch(`${RENDER_BASE}/api/in-class/chat/by-session/${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          _inClassConvoId = data._id;
          console.log('[chat-history] Reusing in-class chat record:', _inClassConvoId);
        } else {
          // First student — create the shared record
          const createRes = await fetch(`${RENDER_BASE}/api/in-class/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              tableNumber:   window._inClassTableNumber   || null,
              sessionNumber: window._inClassSessionNumber || null,
            }),
          });
          if (createRes.ok) {
            const created = await createRes.json();
            _inClassConvoId = created._id;
            console.log('[chat-history] Created in-class chat record:', _inClassConvoId);
          }
        }
      } catch (err) {
        console.warn('[chat-history] initInClass failed:', err.message);
      }
    },

    /** Queue a single message {role, content, userName?} for persistence. */
    appendMessage(msg) {
      const msgObj = { ...msg, timestamp: new Date().toISOString() };

      if (window._inClassMode) {
        // In-class: include userName so the shared record is attributed
        _inClassPendingMessages.push(msgObj);
        _scheduleInClassFlush();
      } else {
        _pendingMessages.push(msgObj);
        _scheduleFlush();
      }
    },

    /**
     * After the first user+bot exchange, generate a 4-7 word title
     * via /api/gemini (Vercel) and save it to MongoDB via Render.
     */
    async autoTitle(userMsg, botMsg) {
      if (window._inClassMode) {
        // In-class: update the shared record title
        if (_inClassTitleSaved || !_inClassConvoId) return;
        _inClassTitleSaved = true;
        try {
          const prompt = `Given this first exchange in a tutoring session, write a short 4-7 word title that summarises the topic. Reply with ONLY the title, nothing else.\n\nStudent: ${userMsg}\nTutor: ${botMsg}`;
          const res = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
          });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const data = await res.json();
          const title = (data.response || '').trim().replace(/^["']|["']$/g, '').slice(0, 80);
          if (!title) return;
          await fetch(`${RENDER_BASE}/api/in-class/chat/${_inClassConvoId}/title`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          });
        } catch (err) {
          console.warn('[chat-history] in-class autoTitle failed:', err.message);
          _inClassTitleSaved = false;
        }
        return;
      }

      if (_titleSaved || !_conversationId || !_email) return;
      _titleSaved = true; // set immediately to prevent duplicate calls

      try {
        const prompt = `Given this first exchange in a tutoring session, write a short 4-7 word title that summarises the topic. Reply with ONLY the title, nothing else.\n\nStudent: ${userMsg}\nTutor: ${botMsg}`;

        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!res.ok) throw new Error(`Gemini status ${res.status}`);
        const data = await res.json();
        const title = (data.response || "")
          .trim()
          .replace(/^["']|["']$/g, "")
          .slice(0, 80);
        if (!title) return;

        await fetch(
          `${RENDER_BASE}/api/chat-history/${_conversationId}/title`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          },
        );

        // Refresh sidebar so the new title shows up
        await _loadList();
        _renderList();
      } catch (err) {
        // non-critical — fail silently
        console.warn("[chat-history] autoTitle failed:", err.message);
        _titleSaved = false; // allow retry
      }
    },
  };

  // Expose globally
  window.chatHistoryManager = manager;

  // ─── Conversation helpers ─────────────────────────────────────────────────
  let _conversations = [];

  async function _createConversation() {
    if (!_email) return;
    try {
      const res = await fetch(`${RENDER_BASE}/api/chat-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: _email }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      _conversationId = data._id;
      _titleSaved = false;
    } catch (err) {
      console.warn("[chat-history] createConversation failed:", err.message);
    }
  }

  async function _loadList() {
    if (!_email) return;
    try {
      const res = await fetch(
        `${RENDER_BASE}/api/chat-history?email=${encodeURIComponent(_email)}`,
      );
      if (!res.ok) return;
      _conversations = await res.json();
    } catch (err) {
      console.warn("[chat-history] loadList failed:", err.message);
    }
  }

  // ─── Flush queue ──────────────────────────────────────────────────────────
  function _scheduleFlush() {
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(_flush, 800);
  }

  async function _flush() {
    _flushTimer = null;
    if (!_conversationId || _pendingMessages.length === 0) return;

    const batch = _pendingMessages.splice(0);
    try {
      const res = await fetch(
        `${RENDER_BASE}/api/chat-history/${_conversationId}/messages`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: batch }),
        },
      );
      if (!res.ok) {
        // Put messages back so we can retry
        _pendingMessages = [...batch, ..._pendingMessages];
      }
    } catch (err) {
      _pendingMessages = [...batch, ..._pendingMessages];
      console.warn("[chat-history] flush failed:", err.message);
    }
  }

  // ── In-class flush ──────────────────────────────────────────────────────
  function _scheduleInClassFlush() {
    if (_inClassFlushTimer) clearTimeout(_inClassFlushTimer);
    _inClassFlushTimer = setTimeout(_flushInClassQueue, 800);
  }

  async function _flushInClassQueue() {
    _inClassFlushTimer = null;
    if (!_inClassConvoId && window._inClassMode) {
      // Might not be initialised yet — retry after a short delay
      await manager.initInClass();
    }
    if (!_inClassConvoId || _inClassPendingMessages.length === 0) return;

    const batch = _inClassPendingMessages.splice(0);
    try {
      const res = await fetch(`${RENDER_BASE}/api/in-class/chat/${_inClassConvoId}/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: batch }),
      });
      if (!res.ok) {
        _inClassPendingMessages = [...batch, ..._inClassPendingMessages];
      }
    } catch (err) {
      _inClassPendingMessages = [...batch, ..._inClassPendingMessages];
      console.warn('[chat-history] in-class flush failed:', err.message);
    }
  }

  // ─── Load & replay a past conversation ────────────────────────────────────
  async function _loadConversation(id) {
    try {
      const res = await fetch(`${RENDER_BASE}/api/chat-history/${id}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const convo = await res.json();

      // Clear current chat
      const chatMessages = document.getElementById("chatMessages");
      if (chatMessages) chatMessages.innerHTML = "";

      // Reset context to system prompt only
      if (window._resetChatContext) window._resetChatContext();

      // Replay messages silently (no persistence, no broadcast)
      const msgs = convo.messages || [];
      msgs.forEach((msg) => {
        if (window._addMessageSilent) {
          window._addMessageSilent(msg.content, msg.role);
        }
      });

      // Rebuild AI context so the tutor remembers the thread
      if (window._rebuildContext) window._rebuildContext(msgs);

      // Switch current conversation to the loaded one
      _conversationId = id;
      _titleSaved = true; // don't overwrite existing title

      _setActiveItem(id);
      _closeSidebar();
    } catch (err) {
      console.warn("[chat-history] loadConversation failed:", err.message);
    }
  }

  async function _deleteConversation(id) {
    try {
      await fetch(`${RENDER_BASE}/api/chat-history/${id}`, {
        method: "DELETE",
      });
      _conversations = _conversations.filter((c) => c._id !== id);
      _renderList();
      // If deleted the active one, start a fresh conversation
      if (id === _conversationId) {
        await _newChat();
      }
    } catch (err) {
      console.warn("[chat-history] delete failed:", err.message);
    }
  }

  async function _newChat() {
    // Clear screen
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) chatMessages.innerHTML = "";
    if (window._resetChatContext) window._resetChatContext();
    if (window.addMessage)
      window.addMessage(
        "Hi there! I'm your physics tutor! Ask me anything about physics!",
        "bot",
      );

    // Create a new DB conversation
    await _createConversation();

    // Refresh sidebar
    await _loadList();
    _renderList();
    _closeSidebar();
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  function _buildUI() {
    // Don't build twice
    if (document.getElementById("chatHistorySidebar")) return;

    // Dim overlay
    const overlay = document.createElement("div");
    overlay.id = "chatHistoryOverlay";
    overlay.addEventListener("click", _closeSidebar);
    document.body.appendChild(overlay);

    // Sidebar
    const sidebar = document.createElement("div");
    sidebar.id = "chatHistorySidebar";
    sidebar.innerHTML = `
      <div class="ch-sidebar-header">
        <h3>💬 Chat History</h3>
        <button class="ch-new-btn" id="chNewBtn">＋ New Chat</button>
        <button class="ch-close-btn" id="chCloseBtn">×</button>
      </div>
      <div class="ch-list" id="chList"></div>
    `;
    document.body.appendChild(sidebar);

    sidebar.querySelector("#chNewBtn").addEventListener("click", _newChat);
    sidebar
      .querySelector("#chCloseBtn")
      .addEventListener("click", _closeSidebar);

    // Wire up the sign-out bar that is already in the HTML header
    _activateSignOutBar();
  }

  function _activateSignOutBar() {
    // The bar is already in tutor.html as .tutor-header-topbar / #signOutBar
    const bar = document.getElementById("signOutBar");
    if (!bar) return;

    // Populate email
    const emailEl = document.getElementById("sobEmail");
    if (emailEl) emailEl.textContent = _email || "";

    // Show the bar
    bar.classList.add("visible");

    // Wire buttons (guard against double-binding)
    const histBtn = document.getElementById("chatHistoryToggleBtn");
    const signBtn = document.getElementById("signOutBtn");
    if (histBtn && !histBtn.dataset.wired) {
      histBtn.dataset.wired = "1";
      histBtn.addEventListener("click", _toggleSidebar);
    }
    if (signBtn && !signBtn.dataset.wired) {
      signBtn.dataset.wired = "1";
      signBtn.addEventListener("click", _signOut);
    }
  }

  function _renderList() {
    const list = document.getElementById("chList");
    if (!list) return;

    if (!_conversations.length) {
      list.innerHTML =
        '<div class="ch-empty">No past conversations yet.<br>Start chatting to save history!</div>';
      return;
    }

    list.innerHTML = "";
    _conversations.forEach((convo) => {
      const item = document.createElement("div");
      item.className =
        "ch-item" + (convo._id === _conversationId ? " active" : "");
      item.dataset.id = convo._id;

      const date = new Date(convo.updatedAt || convo.createdAt);
      const dateStr = _formatDate(date);

      item.innerHTML = `
        <span class="ch-item-title">${_escHtml(convo.title || "Untitled")}</span>
        <span class="ch-item-date">${dateStr}</span>
        <button class="ch-delete-btn" title="Delete conversation">🗑</button>
      `;

      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("ch-delete-btn")) {
          e.stopPropagation();
          if (confirm("Delete this conversation?"))
            _deleteConversation(convo._id);
          return;
        }
        _loadConversation(convo._id);
      });

      list.appendChild(item);
    });
  }

  function _setActiveItem(id) {
    document.querySelectorAll(".ch-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === id);
    });
  }

  function _toggleSidebar() {
    const sidebar = document.getElementById("chatHistorySidebar");
    const overlay = document.getElementById("chatHistoryOverlay");
    if (!sidebar) return;
    const isOpen = sidebar.classList.contains("open");
    if (!isOpen) {
      _loadList().then(() => _renderList());
    }
    sidebar.classList.toggle("open");
    overlay && overlay.classList.toggle("visible");
  }

  function _closeSidebar() {
    const sidebar = document.getElementById("chatHistorySidebar");
    const overlay = document.getElementById("chatHistoryOverlay");
    sidebar && sidebar.classList.remove("open");
    overlay && overlay.classList.remove("visible");
  }

  async function _signOut() {
    // Record logout
    if (window._activityId) {
      try {
        await fetch(`${RENDER_BASE}/api/user-activity/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityId: window._activityId }),
        });
      } catch (_) {}
    }
    window.location.reload();
  }

  // ─── Utilities ────────────────────────────────────────────────────────────
  function _formatDate(date) {
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function _escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
