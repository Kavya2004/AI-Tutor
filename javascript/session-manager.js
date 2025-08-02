class SessionManager {
  constructor() {
    this.currentSession = null;
    this.isHost = false;
    this.userName = localStorage.getItem("tutorUserName") || null;
    this.participants = new Map();
    this.sessionMessages = [];
    this.ws = null;
    this.sessionId = null;
    this.currentSessionTitle = null;
    this.initializeSessionUI();
    this.selectedAvatar = "👨‍🎓";
    this.selectedColor = "#3498db";
    window.addEventListener("resize", () => this.handleResize());
    window.addEventListener("orientationchange", () => {
      setTimeout(() => this.handleResize(), 100);
    });
  }

  initializeSessionUI() {
    this.createSessionButton();
    this.createSessionModal();
    this.createParticipantsList();
    this.createPublicSessionsList(); 

    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session");
    if (sessionId) {
      this.joinSessionFromURL(sessionId);
    }
  }

  createSessionButton() {
    const chatHeader = document.querySelector(".chat-container");
    if (!chatHeader) return;

    const sessionControls = document.createElement("div");
    sessionControls.className = "session-controls";
    sessionControls.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 8px;
            border: 1px solid #ddd;
            width: 100%;
            box-sizing: border-box;
            resize: both;
            overflow: auto;
        `;
    sessionControls.innerHTML = `
            <button id="createSessionBtn" class="session-btn create-session">
                👥 Create Session
            </button>
            <button id="customizeProfileBtn" class="session-btn">
            🎨 Customize Profile
        </button>

            <button id="joinSessionBtn" class="session-btn join-session">
                🔗 Join Session
            </button>
            <button id="leaveSessionBtn" class="session-btn leave-session" style="display: none;">
                🚪 Leave Session
            </button>
            <button id="shareSessionBtn" class="session-btn share-session" style="display: none;">
                📤 Share Link
            </button>
            <button id="downloadSessionBtn" class="session-btn download-session" style="display: none;">
                💾 Download
            </button>
        `;

    chatHeader.insertBefore(sessionControls, chatHeader.firstChild);

    document
      .getElementById("createSessionBtn")
      .addEventListener("click", () => this.createSession());
    document
      .getElementById("customizeProfileBtn")
      .addEventListener("click", () => {
        this.showCustomizationModal();
      });

    document
      .getElementById("joinSessionBtn")
      .addEventListener("click", () => this.showJoinModal());
    document
      .getElementById("leaveSessionBtn")
      .addEventListener("click", () => this.leaveSession());
    document
      .getElementById("shareSessionBtn")
      .addEventListener("click", () => this.shareSession());
    document
      .getElementById("downloadSessionBtn")
      .addEventListener("click", () => this.downloadSession());
  }

  createPublicSessionsList() {
    const sessionControls = document.querySelector(".session-controls");
    
    const publicSessionsBtn = document.createElement("button");
    publicSessionsBtn.id = "publicSessionsBtn";
    publicSessionsBtn.className = "session-btn";
    publicSessionsBtn.textContent = "🌐 Browse Public Sessions";
    publicSessionsBtn.addEventListener("click", () => this.showPublicSessions());
    
    const joinBtn = document.getElementById("joinSessionBtn");
    joinBtn.parentNode.insertBefore(publicSessionsBtn, joinBtn.nextSibling);
  }
  
  async showPublicSessions() {
    try {
      const response = await fetch("https://ai-tutor-53f1.onrender.com/api/sessions/public");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const publicSessions = await response.json();
      
      if (publicSessions.length === 0) {
        alert("No public sessions available right now.");
        return;
      }
      
      this.showPublicSessionsModal(publicSessions);
      
    } catch (error) {
      console.error("Error fetching public sessions:", error);
      alert("Failed to load public sessions. Please try again later.");
    }
  }

  showPublicSessionsModal(publicSessions) {
    const modalHTML = `
      <div id="publicSessionsModal" class="session-modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Public Sessions</h3>
            <button class="close-modal" onclick="document.getElementById('publicSessionsModal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="public-sessions-list">
              ${publicSessions.map(session => `
                <div class="public-session-item" data-session-id="${session.sessionId}">
                  <div class="session-details">
                    <div class="session-title">${session.sessionTitle || 'Untitled Session'}</div>
                    <div class="session-meta">
                      <span class="host-name">Host: ${session.hostName}</span>
                      <span class="participant-count">${session.participantCount} participants</span>
                    </div>
                  </div>
                  <div class="join-arrow">→</div>
                </div>
              `).join('')}
            </div>
            ${!this.userName ? '<p class="join-note">Click any session to join!</p>' : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const sessionItems = document.querySelectorAll('.public-session-item');
    sessionItems.forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.dataset.sessionId;
        document.getElementById('publicSessionsModal').remove();
        
        if (!this.userName) {
          this.showNameModal("join");
          setTimeout(() => {
            document.getElementById("sessionIdInput").value = sessionId;
          }, 100);
        } else {
          this.joinSession(sessionId);
        }
      });
    });
  }

  createSessionModal() {
    const modal = document.createElement("div");
    modal.id = "sessionModal";
    modal.className = "session-modal";
    modal.innerHTML = `
    <div class="modal-content">
        <div class="modal-header">
            <h3 id="modalTitle">Join Session</h3>
            <button class="close-modal" onclick="this.closest('.session-modal').style.display='none'">×</button>
        </div>
        <div class="modal-body">
            <input type="text" id="userNameInput" placeholder="Your name..." maxlength="20">
            <input type="text" id="sessionIdInput" placeholder="Session ID (optional)" style="display: none;">
            <input type="text" id="sessionTitleInput" placeholder="Session title (e.g., 'Probability Basics')" maxlength="50" style="display: none;">
            <div class="session-privacy" id="sessionPrivacy" style="display: none;">
                <label>
                    <input type="checkbox" id="publicSessionCheckbox" checked> Make this session public
                </label>
                <small>Public sessions can be joined by anyone</small>
            </div>
            
            <div class="customization-section">
                <h4>Choose Your Avatar</h4>
                <div class="avatar-selection" id="avatarSelection">
                    <div class="avatar-option" data-avatar="👨‍🎓">👨‍🎓</div>
                    <div class="avatar-option" data-avatar="👩‍🎓">👩‍🎓</div>
                    <div class="avatar-option" data-avatar="🧑‍💻">🧑‍💻</div>
                    <div class="avatar-option" data-avatar="👨‍💻">👨‍💻</div>
                    <div class="avatar-option" data-avatar="👩‍💻">👩‍💻</div>
                    <div class="avatar-option" data-avatar="🧑‍🔬">🧑‍🔬</div>
                    <div class="avatar-option" data-avatar="👨‍🔬">👨‍🔬</div>
                    <div class="avatar-option" data-avatar="👩‍🔬">👩‍🔬</div>
                    <div class="avatar-option" data-avatar="🧑‍🏫">🧑‍🏫</div>
                    <div class="avatar-option" data-avatar="👨‍🏫">👨‍🏫</div>
                    <div class="avatar-option" data-avatar="👩‍🏫">👩‍🏫</div>
                    <div class="avatar-option" data-avatar="🤓">🤓</div>
                </div>
                
                <h4>Choose Your Color</h4>
                <div class="color-selection" id="colorSelection">
                    <div class="color-option" data-color="#e74c3c" style="background: #e74c3c;"></div>
                    <div class="color-option" data-color="#3498db" style="background: #3498db;"></div>
                    <div class="color-option" data-color="#2ecc71" style="background: #2ecc71;"></div>
                    <div class="color-option" data-color="#9b59b6" style="background: #9b59b6;"></div>
                    <div class="color-option" data-color="#f39c12" style="background: #f39c12;"></div>
                    <div class="color-option" data-color="#e91e63" style="background: #e91e63;"></div>
                    <div class="color-option" data-color="#1abc9c" style="background: #1abc9c;"></div>
                    <div class="color-option" data-color="#6c5ce7" style="background: #6c5ce7;"></div>
                </div>
                
                <div class="preview-section">
                    <div class="preview-avatar" id="previewAvatar" style="background: #3498db;">👨‍🎓</div>
                    <div class="preview-text">Preview: This is how you'll appear to others</div>
                </div>
            </div>
            
            <div class="modal-buttons">
                <button id="confirmSessionBtn" class="session-btn">Join Session</button>
                <button onclick="this.closest('.session-modal').style.display='none'" class="session-btn cancel">Cancel</button>
            </div>
        </div>
    </div>
    `;

    document.body.appendChild(modal);

    const originalSessionHandler = () => {
      const userName = document.getElementById("userNameInput").value.trim();
      const sessionId = document.getElementById("sessionIdInput").value.trim();
      const sessionTitle = document.getElementById("sessionTitleInput").value.trim();     
      const isPublic = document.getElementById("publicSessionCheckbox").checked;
      if (!userName) {
        alert("Please enter your name");
        return;
      }

      this.userName = userName;
      localStorage.setItem("tutorUserName", userName);

      if (sessionId) {
        this.joinSession(sessionId);
      } else {
        this.createNewSessionWithParams(sessionTitle, isPublic);
      }

      modal.style.display = "none";
    };

    document.getElementById("confirmSessionBtn").onclick =
      originalSessionHandler;
  }

  setupCustomization() {
    const avatarOptions = document.querySelectorAll(".avatar-option");
    const colorOptions = document.querySelectorAll(".color-option");
    const previewAvatar = document.getElementById("previewAvatar");

    avatarOptions[0].classList.add("selected");
    colorOptions[1].classList.add("selected");

    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        avatarOptions.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        this.selectedAvatar = option.dataset.avatar;
        previewAvatar.textContent = this.selectedAvatar;
      });
    });

    colorOptions.forEach((option) => {
      option.addEventListener("click", () => {
        colorOptions.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        this.selectedColor = option.dataset.color;
        previewAvatar.style.background = this.selectedColor;
      });
    });
  }

  createParticipantsList() {
    const chatMessages = document.getElementById("chatMessages");
    const participantsList = document.createElement("div");
    participantsList.id = "participantsList";
    participantsList.className = "participants-list";
    participantsList.style.cssText = `
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    margin-bottom: 10px;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
    resize: vertical;
    max-height: 300px;
  `;
    participantsList.innerHTML = `
            <div class="participants-header">
                <h4 id="sessionTitleHeader">Session Participants</h4>
                <div class="session-info">
                    <span id="sessionIdDisplay"></span>
                    <span id="participantCount">0 participants</span>
                </div>
            </div>
            <div class="participants-container" id="participantsContainer"></div>
        `;
  
    chatMessages.parentNode.insertBefore(participantsList, chatMessages);
    participantsList.style.display = "none";
  }

  async createSession() {
    if (!this.userName) {
      this.showNameModal("create");
      return;
    }
    this.createNewSession();
  }

  async createNewSession() {
    try {
      const sessionTitle = document.getElementById("sessionTitleInput").value.trim();     
      const isPublic = document.getElementById("publicSessionCheckbox").checked;         
      
      const response = await fetch(
        "https://ai-tutor-53f1.onrender.com/api/sessions/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
            isPublic: isPublic,              
            sessionTitle: sessionTitle,      
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.sessionId = data.sessionId;
      this.isHost = true;
      this.connectToSession();
      this.currentSessionTitle = sessionTitle || null;
      this.updateSessionUI();

      this.addSystemMessage(
        `Session created! Share this link with others: https://ai-tutor-teal-one.vercel.app/tutor.html?session=${this.sessionId}`,
      );
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Failed to create session. Please try again.");
    }
  }

  async createNewSessionWithParams(sessionTitle, isPublic) {
    try {
      const response = await fetch(
        "https://ai-tutor-53f1.onrender.com/api/sessions/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
            isPublic: isPublic,              
            sessionTitle: sessionTitle,      
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      this.sessionId = data.sessionId;
      this.isHost = true;
      this.connectToSession();
      this.updateSessionUI();
  
      this.addSystemMessage(
        `Session created! Share this link with others: https://ai-tutor-teal-one.vercel.app/tutor.html?session=${this.sessionId}`,
      );
    } catch (error) {
      console.error("Error creating session:", error);
      alert("Failed to create session. Please try again.");
    }
  }

  showJoinModal() {
    if (!this.userName) {
      this.showNameModal("join");
      return;
    }

    const sessionId = prompt("Enter Session ID:");
    if (sessionId) {
      this.joinSession(sessionId);
    }
  }

  showNameModal(action) {
    const modal = document.getElementById("sessionModal");
    const title = document.getElementById("modalTitle");
    const confirmBtn = document.getElementById("confirmSessionBtn");
    const sessionInput = document.getElementById("sessionIdInput");
    const titleInput = document.getElementById("sessionTitleInput");     
    const privacyDiv = document.getElementById("sessionPrivacy");

    if (action === "join") {
      title.textContent = "Join Session";
      confirmBtn.textContent = "Join Session";
      sessionInput.style.display = "block";
      titleInput.style.display = "none";           
      privacyDiv.style.display = "none"; 
      sessionInput.setAttribute("placeholder", "Enter Session ID");
    } else {
      title.textContent = "Create Session";
      confirmBtn.textContent = "Create Session";
      sessionInput.style.display = "none";
      titleInput.style.display = "block";         
      privacyDiv.style.display = "block";          
    }

    modal.style.display = "flex";
    document.getElementById("userNameInput").focus();
    this.setupCustomization();
  }

  async joinSession(sessionId) {
    try {
      const response = await fetch(
        `https://ai-tutor-53f1.onrender.com/api/sessions/${sessionId}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
            timestamp: new Date().toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.sessionId = sessionId;
      this.isHost = false;
      this.sessionMessages = data.messages || [];
      this.currentSessionTitle = data.session?.sessionTitle || null;
      this.connectToSession();
      this.updateSessionUI();
      this.loadSessionHistory();

      this.addSystemMessage(`${this.userName} joined the session`);
    } catch (error) {
      console.error("Error joining session:", error);
      alert("Failed to join session. Please check the session ID.");
    }
  }

  joinSessionFromURL(sessionId) {
    if (!this.userName) {
      setTimeout(() => {
        this.showNameModal("join");
        document.getElementById("sessionIdInput").value = sessionId;
        document.getElementById("sessionIdInput").style.display = "none";
      }, 500);
    } else {
      this.joinSession(sessionId);
    }
  }

  connectToSession() {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(`wss://ai-tutor-53f1.onrender.com/sessions/${this.sessionId}`);

    this.ws.onopen = () => {
      console.log("Connected to session");
      this.ws.send(
        JSON.stringify({
          type: "join",
          userName: this.userName,
          avatar: this.selectedAvatar,
          color: this.selectedColor,
          isHost: this.isHost,
        }),
      );
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSessionMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from session");
      if (this.currentSession) {
        setTimeout(() => this.connectToSession(), 3000); 
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      alert("WebSocket connection failed. Please try again.");
    };
  }

  handleSessionMessage(data) {
    switch (data.type) {
      case "message":
        this.addSharedMessage(
          data.message,
          data.sender,
          data.timestamp,
          data.userName,
        );
        break;
      case "participant_joined":
        const participant = this.participants.get(data.userName);
        this.addParticipant(data.userName, participant);

        this.addSystemMessage(`${data.userName} joined the session`);
        break;
      case "participant_left":
        this.removeParticipant(data.userName);
        this.addSystemMessage(`${data.userName} left the session`);
        break;
      case "participants_update":
        this.updateParticipants(data.participants);
        break;
      case "whiteboard_action":
        this.handleSharedWhiteboardAction(data);
        break;
      case "diagram_generated":
        this.handleSharedDiagram(data);
        break;
      case "whiteboard_draw":
        const canvas = data.boardType === "teacher" ? window.teacherCanvas : window.studentCanvas;
        const ctx = data.boardType === "teacher" ? window.teacherCtx : window.studentCtx;
      
        if (canvas && ctx) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
      
          const x = data.x * scaleX;
          const y = data.y * scaleY;
      
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        break;        
      case "whiteboard_clear":
        this.handleSharedWhiteboardClear(data);
        break;
      case "profile_update":
        if (data.userName && this.participants.has(data.userName)) {
          const participant = this.participants.get(data.userName);

          participant.avatar = data.avatar || participant.avatar;
          participant.color = data.color || participant.color;

          this.renderParticipants();
        }
        break;
      case "session_info":
        this.currentSessionTitle = data.sessionTitle;
        this.updateSessionUI();
        this.updateParticipants(data.participants);
        break;
    }
  }

  shareMessage(message, sender = "user") {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "message",
          message: message,
          sender: sender,
          userName: this.userName,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  addSharedMessage(message, sender, timestamp, userName) {
    const chatMessages = document.getElementById("chatMessages");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message shared-message slide-in`;

    const participant = this.participants.get(userName);

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    if (sender === "bot") {
      avatar.innerHTML = "🤖";
      avatar.style.background = "#6c757d";
    } else {
      avatar.innerHTML = participant?.avatar || "👤";
      avatar.style.background = participant?.color || "#6c757d";
    }

    const content = document.createElement("div");
    content.className = "message-content";

    const time = new Date(timestamp).toLocaleTimeString();

    content.innerHTML = `
            <div class="message-header">
                <span class="message-author">${userName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${message.replace(/\n/g, "<br>")}</div>
        `;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  addSystemMessage(message) {
    const chatMessages = document.getElementById("chatMessages");
    const messageDiv = document.createElement("div");
    messageDiv.className = "message system-message";
    messageDiv.innerHTML = `<div class="system-content">📢 ${message}</div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  updateParticipants(participants) {
    this.participants.clear();
    participants.forEach((p) => this.participants.set(p.userName, p));
    this.renderParticipants();
  }

  addParticipant(userName, participantData = null) {
    if (participantData) {
      this.participants.set(userName, participantData);
    } else if (!this.participants.has(userName)) {
      this.participants.set(userName, {
        userName,
        avatar: "👤",
        color: "#6c757d",
        joinedAt: new Date().toISOString(),
      });
    }
    this.renderParticipants();
  }

  removeParticipant(userName) {
    this.participants.delete(userName);
    this.renderParticipants();
  }

  renderParticipants() {
    const container = document.getElementById("participantsContainer");
    const count = document.getElementById("participantCount");

    container.innerHTML = "";
    count.textContent = `${this.participants.size} participant${this.participants.size !== 1 ? "s" : ""}`;

    this.participants.forEach((participant, userName) => {
      const participantDiv = document.createElement("div");
      participantDiv.className = "participant-item";
      participantDiv.innerHTML = `
            <div class="participant-info">
                <div class="participant-avatar" style="background: ${participant.color || "#6c757d"};">
                    ${participant.avatar || "👤"}
                </div>
                <div class="participant-details">
                    <span class="participant-name">${userName}</span>
                    <span class="participant-role">${userName === this.userName ? "(You)" : ""}</span>
                </div>
            </div>
        `;
      container.appendChild(participantDiv);
    });
  }
  handleResize() {
    const sessionControls = document.querySelector(".session-controls");
    const participantsList = document.querySelector(".participants-list");

    if (sessionControls) {
      const chatContainer = document.querySelector(".chat-container");
      if (chatContainer) {
        const containerWidth = chatContainer.offsetWidth;
        if (containerWidth < 600) {
          sessionControls.style.flexDirection = "column";
        } else {
          sessionControls.style.flexDirection = "row";
        }
      }
    }

    if (participantsList) {
      const windowHeight = window.innerHeight;
      const maxHeight = Math.max(120, windowHeight * 0.2);
      const container = participantsList.querySelector(
        ".participants-container",
      );
      if (container) {
        container.style.maxHeight = `${maxHeight}px`;
      }
    }
  }
  updateSessionUI() {
    const sessionIdDisplay = document.getElementById("sessionIdDisplay");
    const participantsList = document.getElementById("participantsList");
    const titleHeader = document.getElementById("sessionTitleHeader");
  
    if (this.sessionId) {
      let displayText = `Session: ${this.sessionId}`;
      if (this.currentSessionTitle) {
        displayText = `${this.currentSessionTitle} (${this.sessionId})`;
      }
      sessionIdDisplay.textContent = displayText;
      
      participantsList.style.display = "block";
  
      if (titleHeader) {
        titleHeader.textContent = this.currentSessionTitle || 'Session Participants';
      }
  
      document.getElementById("createSessionBtn").style.display = "none";
      document.getElementById("joinSessionBtn").style.display = "none";
      document.getElementById("leaveSessionBtn").style.display = "inline-block";
      document.getElementById("shareSessionBtn").style.display = "inline-block";
      document.getElementById("downloadSessionBtn").style.display = "inline-block";
    } else {
      participantsList.style.display = "none";
      
      if (titleHeader) {
        titleHeader.textContent = 'Session Participants';
      }
  
      document.getElementById("createSessionBtn").style.display = "inline-block";
      document.getElementById("joinSessionBtn").style.display = "inline-block";
      document.getElementById("leaveSessionBtn").style.display = "none";
      document.getElementById("shareSessionBtn").style.display = "none";
      document.getElementById("downloadSessionBtn").style.display = "none";
    }
  }

  shareSession() {
    const link = `https://ai-tutor-teal-one.vercel.app/tutor.html?session=${this.sessionId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        alert("Session link copied to clipboard!");
      })
      .catch(() => {
        prompt("Copy this link to share:", link);
      });
  }

  async downloadSession() {
    try {
      const response = await fetch(
        `https://ai-tutor-53f1.onrender.com/api/sessions/${this.sessionId}/download`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tutor-session-${this.sessionId}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading session:", error);
      alert("Failed to download session. Please try again.");
    }
  }

  leaveSession() {
    if (this.ws) {
      this.ws.send(
        JSON.stringify({
          type: "leave",
          userName: this.userName,
        }),
      );
      this.ws.close();
    }

    this.currentSession = null;
    this.sessionId = null;
    this.isHost = false;
    this.participants.clear();
    this.sessionMessages = [];

    this.updateSessionUI();
    this.addSystemMessage("You left the session");

    const url = new URL(window.location);
    url.searchParams.delete("session");
    window.history.replaceState({}, "", url);
  }

  showCustomizationModal() {
    const modal = document.getElementById("sessionModal");
    const title = document.getElementById("modalTitle");
    const confirmBtn = document.getElementById("confirmSessionBtn");
    const sessionInput = document.getElementById("sessionIdInput");
    const nameInput = document.getElementById("userNameInput");

    title.textContent = "Customize Your Profile";
    confirmBtn.textContent = "Save Changes";
    sessionInput.style.display = "none";

    if (this.userName) {
      nameInput.value = this.userName;
    }

    modal.style.display = "flex";
    this.setupCustomization();

    confirmBtn.onclick = () => {
      const enteredName = nameInput.value.trim();

      if (enteredName && enteredName !== this.userName) {
        this.userName = enteredName;
        localStorage.setItem("tutorUserName", enteredName);
      }

      const selectedAvatarEl = document.querySelector(
        ".avatar-option.selected",
      );
      const selectedColorEl = document.querySelector(".color-option.selected");

      this.selectedAvatar =
        selectedAvatarEl?.dataset.avatar || this.selectedAvatar;
      this.selectedColor = selectedColorEl?.dataset.color || this.selectedColor;

      const current = this.participants.get(this.userName);
      if (current) {
        current.avatar = this.selectedAvatar;
        current.color = this.selectedColor;
      }

      this.renderParticipants();

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "profile_update",
            userName: this.userName,
            avatar: this.selectedAvatar,
            color: this.selectedColor,
          }),
        );
      }

      modal.style.display = "none";
    };
  }

  loadSessionHistory() {
    const chatMessages = document.getElementById("chatMessages");
    chatMessages.innerHTML = ""; 

    this.sessionMessages.forEach((msg) => {
      this.addSharedMessage(msg.message, msg.sender, msg.timestamp);
    });
  }

  broadcastMessage(message, sender) {
    if (this.sessionId) {
      this.shareMessage(message, sender);
    }
  }

  handleSharedWhiteboardAction(data) {
    // Execute the whiteboard action for other participants
    if (window.tutorWhiteboard && data.action && data.targetBoard) {
      setTimeout(() => {
        if (window.switchWhiteboard) {
          window.switchWhiteboard(data.targetBoard);
        }
        
        switch (data.action) {
          case 'probability_scale':
            if (window.tutorWhiteboard.drawProbabilityScale) {
              window.tutorWhiteboard.drawProbabilityScale(data.targetBoard);
            }
            break;
          case 'distribution':
            if (window.tutorWhiteboard.drawSampleDistribution) {
              window.tutorWhiteboard.drawSampleDistribution(data.targetBoard);
            }
            break;
          case 'normal_curve':
            if (window.tutorWhiteboard.drawNormalCurve) {
              window.tutorWhiteboard.drawNormalCurve(data.targetBoard);
            }
            break;
          case 'tree_diagram':
            if (window.tutorWhiteboard.drawTreeDiagram) {
              window.tutorWhiteboard.drawTreeDiagram(data.targetBoard);
            }
            break;
          case 'clear_board':
            if (window.tutorWhiteboard.clearWhiteboard) {
              window.tutorWhiteboard.clearWhiteboard(data.targetBoard);
            }
            break;
        }
      }, 100);
    }
  }

  handleSharedDiagram(data) {
    console.log('Received shared diagram:', data);
    // Generate the same diagram for other participants
    if (window.diagramRenderer && data.description && data.targetBoard) {
      setTimeout(async () => {
        console.log('Generating shared diagram:', data.description);
        if (window.switchWhiteboard) {
          window.switchWhiteboard(data.targetBoard);
        }
        
        try {
          await window.diagramRenderer.generateDiagram(data.description, data.targetBoard);
          console.log('Shared diagram generated successfully');
        } catch (error) {
          console.error('Error generating shared diagram:', error);
        }
      }, 100);
    } else {
      console.log('Missing requirements for shared diagram:', {
        diagramRenderer: !!window.diagramRenderer,
        description: data.description,
        targetBoard: data.targetBoard
      });
    }
  }

  handleSharedWhiteboardClear(data) {
    // Clear the whiteboard for other participants
    if (window.tutorWhiteboard && data.targetBoard) {
      setTimeout(() => {
        if (window.tutorWhiteboard.clearWhiteboard) {
          window.tutorWhiteboard.clearWhiteboard(data.targetBoard);
        }
      }, 100);
    }
  }
}
window.sessionManager = new SessionManager();