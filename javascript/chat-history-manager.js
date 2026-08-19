/**
 * chat-history-manager.js
 * Manages per-user conversation persistence and the left sidebar UI.
 *
 * Public API (window.chatHistoryManager):
 *   .init(email)                        — at-home login; loads sidebar + starts fresh convo
 *   .initInClass(email)                 — in-class login; finds/creates shared session record
 *   .getCurrentConvoId()                — active conversation _id
 *   .appendMessage(role, txt, userName) — saves one message to the active convo
 *   .autoTitle(userMsg, botMsg)         — generates + saves title after first exchange
 *   .loadConversation(id)               — switches to a past conversation
 *   .startNewConversation()             — creates a new blank conversation
 */

(function () {
  const BACKEND = 'https://ai-tutor-53f1.onrender.com';

  // ─── State ────────────────────────────────────────────────────────────────
  let _email = null;
  let _currentId = null;
  let _titleSet = false;
  let _messageQueue = [];
  let _writing = false;
  let _sidebarVisible = false;
  let _ready = false;

  // In-class state (declared early so renderConvoList can reference it)
  let _inClassMode = false;
  let _inClassConvoId = null;
  let _inClassSessionId = null;
  let _inClassSessionTitle = null;
  let _inClassTableNumber = null;
  let _inClassSessionNumber = null;
  let _inClassWriting = false;
  let _inClassQueue = [];
  let _inClassReady = false;
  let _inClassTitleSet = false;

  // ─── DOM helpers ──────────────────────────────────────────────────────────
  function getSidebar()   { return document.getElementById('chatHistorySidebar'); }
  function getConvoList() { return document.getElementById('convoList'); }

  // ─── API wrappers ─────────────────────────────────────────────────────────
  // NOTE: All mutating requests (POST, PATCH, DELETE) require both
  //   Content-Type: application/json  AND  X-Requested-With: XMLHttpRequest
  // to satisfy the server-side csrfGuard (CWE-352).

  const CSRF_HEADERS = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  async function apiGet(path) {
    const r = await fetch(`${BACKEND}${path}`);
    if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
    return r.json();
  }

  async function apiPost(path, body) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: CSRF_HEADERS,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
    return r.json();
  }

  async function apiPatch(path, body) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'PATCH',
      headers: CSRF_HEADERS,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${path} → ${r.status}`);
    return r.json();
  }

  async function apiDelete(path) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'DELETE',
      headers: CSRF_HEADERS,
      body: JSON.stringify({}),
    });
    if (!r.ok) throw new Error(`DELETE ${path} → ${r.status}`);
    return r.json();
  }

  // ─── Sidebar UI ───────────────────────────────────────────────────────────
  function buildSidebar(inClassMode) {
    if (document.getElementById('chatHistorySidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'chatHistorySidebar';
    sidebar.className = 'ch-sidebar ch-sidebar--closed';
    sidebar.innerHTML = `
      <div class="ch-sidebar__header">
        <span class="ch-sidebar__title">${inClassMode ? '🏫 Class Sessions' : '💬 Conversations'}</span>
        <button class="ch-sidebar__close" id="chSidebarClose" title="Close">✕</button>
      </div>
      <button class="ch-new-btn" id="chNewBtn">＋ New Chat</button>
      <div class="ch-convo-list" id="convoList"></div>
    `;
    document.body.appendChild(sidebar);

    // History toggle button — insert into the sign-out topbar
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'chToggleBtn';
    toggleBtn.innerHTML = '📋 History';
    toggleBtn.style.cssText = `
      padding: 5px 14px; font-size: 12px; font-weight: 600;
      background: rgba(255,255,255,0.15); color: #fff;
      border: 1px solid rgba(255,255,255,0.35); border-radius: 6px;
      cursor: pointer; transition: background 0.15s; white-space: nowrap;
    `;
    toggleBtn.onmouseover = () => toggleBtn.style.background = 'rgba(255,255,255,0.28)';
    toggleBtn.onmouseout  = () => toggleBtn.style.background = 'rgba(255,255,255,0.15)';
    toggleBtn.addEventListener('click', toggleSidebar);

    // Insert before the sign-out button in the signOutBar
    const signOutBar = document.getElementById('signOutBar');
    if (signOutBar) {
      signOutBar.insertBefore(toggleBtn, signOutBar.querySelector('#signOutBtn'));
    }

    document.getElementById('chSidebarClose').addEventListener('click', closeSidebar);
    const newBtn = document.getElementById('chNewBtn');
    if (newBtn) newBtn.addEventListener('click', () => window.chatHistoryManager.startNewConversation());
  }

  function toggleSidebar() { _sidebarVisible ? closeSidebar() : openSidebar(); }

  function openSidebar() {
    const s = getSidebar(); if (!s) return;
    s.classList.remove('ch-sidebar--closed');
    s.classList.add('ch-sidebar--open');
    _sidebarVisible = true;
  }

  function closeSidebar() {
    const s = getSidebar(); if (!s) return;
    s.classList.remove('ch-sidebar--open');
    s.classList.add('ch-sidebar--closed');
    _sidebarVisible = false;
  }

  function renderConvoList(convos) {
    const list = getConvoList(); if (!list) return;
    list.innerHTML = '';
    if (convos.length === 0) {
      list.innerHTML = '<p class="ch-empty">No conversations yet.</p>';
      return;
    }
    convos.forEach(c => {
      const activeId = _inClassMode ? _inClassConvoId : _currentId;
      const item = document.createElement('div');
      item.className = 'ch-convo-item' + (c._id === activeId ? ' ch-convo-item--active' : '');
      item.dataset.id = c._id;
      const date = new Date(c.updatedAt);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      item.innerHTML = `
        <div class="ch-convo-item__body">
          <span class="ch-convo-item__title">${escapeHtml(c.title || 'Conversation')}</span>
          <span class="ch-convo-item__date">${dateStr} · ${timeStr}</span>
        </div>
        <button class="ch-convo-item__del" data-id="${c._id}" title="Delete">🗑</button>`;
      item.querySelector('.ch-convo-item__body').addEventListener('click', () => {
        window.chatHistoryManager.loadConversation(c._id);
        closeSidebar();
      });
      item.querySelector('.ch-convo-item__del').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this conversation?')) return;
        await deleteConversation(c._id);
      });
      list.appendChild(item);
    });
  }

  function markActiveInList(id) {
    document.querySelectorAll('.ch-convo-item').forEach(el => {
      el.classList.toggle('ch-convo-item--active', el.dataset.id === id);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Conversation actions ─────────────────────────────────────────────────
  async function loadConvoList() {
    try {
      if (_inClassMode) {
        const list = await apiGet(`/api/in-class/chat?email=${encodeURIComponent(_email)}`);
        // Sort newest first
        list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        renderConvoList(list);
      } else {
        const list = await apiGet(`/api/chat-history?email=${encodeURIComponent(_email)}`);
        renderConvoList(list);
      }
    } catch (e) {
      console.warn('[chat-history] loadConvoList failed:', e.message);
    }
  }

  async function createNewConvo() {
    try {
      const doc = await apiPost('/api/chat-history', { email: _email });
      _currentId = doc._id;
      _titleSet = false;
      return doc;
    } catch (e) {
      console.warn('[chat-history] createNewConvo failed:', e.message);
      _currentId = null;
      return null;
    }
  }

  async function deleteConversation(id) {
    try {
      const path = _inClassMode ? `/api/in-class/chat/${id}` : `/api/chat-history/${id}`;
      await apiDelete(path);
      const activeId = _inClassMode ? _inClassConvoId : _currentId;
      if (activeId === id) { await startNewConversation(); }
      else { await loadConvoList(); }
    } catch (e) { console.warn('[chat-history] delete failed:', e.message); }
  }

  // ─── Message persistence (debounced batching) ─────────────────────────────
  async function flushQueue() {
    if (_writing || _messageQueue.length === 0 || !_currentId || !_ready) return;
    _writing = true;
    const batch = _messageQueue.splice(0, _messageQueue.length);
    try {
      await apiPatch(`/api/chat-history/${_currentId}/messages`, { messages: batch });
    } catch (e) {
      console.warn('[chat-history] flush failed:', e.message);
      _messageQueue.unshift(...batch);
    }
    _writing = false;
    if (_messageQueue.length > 0) flushQueue();
  }

  // ─── Auto-title ───────────────────────────────────────────────────────────
  async function autoTitle(userMsg, botMsg) {
    if (_titleSet || !_currentId) return;
    // Set immediately to prevent duplicate calls on concurrent messages
    _titleSet = true;
    try {
      const prompt = `Given this physics tutoring exchange, generate a short 4-7 word descriptive title (no quotes, no punctuation at end):\nStudent: ${userMsg}\nTutor: ${botMsg.substring(0, 300)}`;
      const r = await fetch('/api/gemini', {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Generate a very short title (4-7 words, no quotes). Return ONLY the title text.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      const data = await r.json();
      const title = (data.response || '').trim().replace(/^["']|["']$/g, '').substring(0, 60) || 'Physics Discussion';
      await apiPatch(`/api/chat-history/${_currentId}/title`, { title });
      // Reload sidebar so the new title shows with correct sort order
      await loadConvoList();
      markActiveInList(_currentId);
    } catch (e) {
      console.warn('[chat-history] autoTitle failed:', e.message);
      // Do NOT reset _titleSet here — let the title remain as the default
      // "New Conversation" rather than retrying on every subsequent message.
    }
  }

  // ─── Load a past conversation ─────────────────────────────────────────────
  async function loadConversation(id) {
    try {
      // Use the correct endpoint based on current mode
      const endpoint = _inClassMode
        ? `/api/in-class/chat/${id}`
        : `/api/chat-history/${id}`;
      const doc = await apiGet(endpoint);

      if (_inClassMode) {
        _inClassConvoId = id;
        _inClassTitleSet = true; // existing convo already has a title
      } else {
        _currentId = id;
        _titleSet = true; // existing convo already has a title
      }

      // Clear chat UI
      const chatMessages = document.getElementById('chatMessages');
      if (chatMessages) chatMessages.innerHTML = '';

      // Restore the tutor-chat context array (keep only the system prompt)
      if (window._resetChatContext) window._resetChatContext();

      // Replay messages in the UI (silent = no DB persistence, no broadcast)
      doc.messages.forEach(msg => {
        if (window._addMessageSilent) {
          window._addMessageSilent(msg.content, msg.role === 'user' ? 'user' : 'bot', msg.files || []);
        }
      });

      // Rebuild AI context from stored messages for continuity
      if (window._rebuildContext) window._rebuildContext(doc.messages);

      markActiveInList(id);
    } catch (e) {
      console.warn('[chat-history] loadConversation failed:', e.message);
    }
  }

  async function createNewInClassConvo() {
    try {
      const doc = await apiPost('/api/in-class/chat', {
        sessionId:     _inClassSessionId,
        sessionTitle:  _inClassSessionTitle,
        tableNumber:   _inClassTableNumber,
        sessionNumber: _inClassSessionNumber,
        dateKey:       (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
        email:         (_email || '').trim().toLowerCase(),
        title:         new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      });
      _inClassConvoId = doc._id;
      _inClassTitleSet = false;
      return doc;
    } catch (e) {
      console.warn('[in-class chat] createNewInClassConvo failed:', e.message);
      _inClassConvoId = null;
      return null;
    }
  }

  // ─── Start a brand-new conversation ───────────────────────────────────────
  async function startNewConversation() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) chatMessages.innerHTML = '';
    if (window._resetChatContext) window._resetChatContext();
    if (window.addMessage) {
      window.addMessage("Hi there! I'm your physics tutor! Ask me anything about physics!", 'bot');
    }
    if (_inClassMode) {
      _inClassReady = false;
      await createNewInClassConvo();
      await loadConvoList();
      _inClassReady = true;
      markActiveInList(_inClassConvoId);
      if (_inClassQueue.length > 0) flushInClassQueue();
    } else {
      _ready = false;
      await createNewConvo();
      await loadConvoList();
      _ready = true;
      markActiveInList(_currentId);
      if (_messageQueue.length > 0) flushQueue();
    }
  }

  // ─── Init (at-home) ───────────────────────────────────────────────────────
  async function init(email) {
    _email = email;
    console.log('[chat-history] init started for', email);
    buildSidebar(false);
    await loadConvoList();
    await createNewConvo();
    _ready = true;
    console.log('[chat-history] init done, _currentId:', _currentId);
    markActiveInList(_currentId);
    if (_messageQueue.length > 0) flushQueue();
  }


  // ─── In-Class mode ────────────────────────────────────────────────────────
  // When a student is in-class, all chat history is stored in the separate
  // in-class DB under /api/in-class/chat. We switch the endpoints here.

  async function inClassApiPost(path, body) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'POST',
      headers: CSRF_HEADERS,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
    return r.json();
  }

  async function inClassApiPatch(path, body) {
    const r = await fetch(`${BACKEND}${path}`, {
      method: 'PATCH',
      headers: CSRF_HEADERS,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`PATCH ${path} → ${r.status}`);
    return r.json();
  }

  async function flushInClassQueue() {
    if (_inClassWriting || _inClassQueue.length === 0 || !_inClassConvoId || !_inClassReady) return;
    _inClassWriting = true;
    const batch = _inClassQueue.splice(0, _inClassQueue.length);
    try {
      await inClassApiPatch(`/api/in-class/chat/${_inClassConvoId}/messages`, { messages: batch });
    } catch (e) {
      console.warn('[in-class chat] flush failed:', e.message);
      _inClassQueue.unshift(...batch);
    }
    _inClassWriting = false;
    if (_inClassQueue.length > 0) flushInClassQueue();
  }

  async function initInClass(email) {
    _inClassMode = true;
    _email = email;
    _inClassSessionId     = window._inClassSessionId     || '';
    _inClassSessionTitle  = window._inClassSessionTitle  || '';
    _inClassTableNumber   = Number(window._inClassTableNumber  || 0);
    _inClassSessionNumber = Number(window._inClassSessionNumber || 0);

    console.log('[in-class chat] init for', email, _inClassSessionTitle);

    // Build the history sidebar (in-class variant — same as Home Mode)
    buildSidebar(true);

    try {
      // Load past conversations into the sidebar first
      await loadConvoList();

      // Always create a fresh conversation on login — previous ones stay in History.
      // This mirrors Home Mode init() exactly.
      await createNewInClassConvo();
      _inClassReady = true;

      console.log('[in-class chat] init done, _inClassConvoId:', _inClassConvoId);
      markActiveInList(_inClassConvoId);

      if (_inClassQueue.length > 0) flushInClassQueue();
    } catch (e) {
      console.warn('[in-class chat] init failed:', e.message);
    }
  }

  async function autoTitleInClass(userMsg, botMsg) {
    if (_inClassTitleSet || !_inClassConvoId) return;
    // Set immediately to prevent duplicate calls
    _inClassTitleSet = true;
    try {
      const prompt = `Given this physics tutoring exchange, generate a short 4-7 word descriptive title (no quotes, no punctuation at end):\nStudent: ${userMsg}\nTutor: ${botMsg.substring(0, 300)}`;
      const r = await fetch('/api/gemini', {
        method: 'POST',
        headers: CSRF_HEADERS,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Generate a very short title (4-7 words, no quotes). Return ONLY the title text.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      const data = await r.json();
      const title = (data.response || '').trim().replace(/^["']|["']$/g, '').substring(0, 60) || 'In-Class Discussion';
      await inClassApiPatch(`/api/in-class/chat/${_inClassConvoId}/title`, { title });
      // Reload sidebar so the new title appears
      await loadConvoList();
      markActiveInList(_inClassConvoId);
    } catch (e) {
      console.warn('[in-class chat] autoTitle failed:', e.message);
      // Do NOT reset _inClassTitleSet — avoid retry storms on failure
    }
  }


  // ─── Public API ───────────────────────────────────────────────────────────
  window.chatHistoryManager = {
    init,
    initInClass,
    getCurrentConvoId: () => _inClassMode ? _inClassConvoId : _currentId,
    isInClassMode: () => _inClassMode,
    appendMessage(role, content, userName) {
      if (_inClassMode) {
        // For in-class, every message goes into the shared session record.
        // userName identifies who said it in the shared transcript.
        _inClassQueue.push({ role, content, userName: userName || _email || '', timestamp: new Date() });
        setTimeout(flushInClassQueue, 800);
      } else {
        _messageQueue.push({ role, content, timestamp: new Date() });
        setTimeout(flushQueue, 800);
      }
    },
    autoTitle(userMsg, botMsg) {
      if (_inClassMode) {
        autoTitleInClass(userMsg, botMsg);
      } else {
        autoTitle(userMsg, botMsg);
      }
    },
    loadConversation,
    startNewConversation,
    refreshList: loadConvoList,
  };

})();
