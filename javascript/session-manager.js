class SessionManager {
    constructor() {
      this.currentSession = null;
      this.isHost = false;
      this.userName = localStorage.getItem("tutorUserName") || null;
      this.participants = new Map();
      this.sessionMessages = [];
      this.ws = null;
      this.sessionId = null;
  
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
  
      // Store the original session-related click handler
      const originalSessionHandler = () => {
        const userName = document.getElementById("userNameInput").value.trim();
        const sessionId = document.getElementById("sessionIdInput").value.trim();
  
        if (!userName) {
          alert("Please enter your name");
          return;
        }
  
        this.userName = userName;
        localStorage.setItem("tutorUserName", userName);
  
        if (sessionId) {
          this.joinSession(sessionId);
        } else {
          this.createNewSession();
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
  
      // Color selection
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
                  <h4>Session Participants</h4>
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
        const response = await fetch(
          "http://localhost:5001/api/sessions/create",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hostName: this.userName,
              avatar: this.selectedAvatar,
              color: this.selectedColor,
              timestamp: new Date().toISOString(),
            }),
          },
        );
  
        const data = await response.json();
        this.sessionId = data.sessionId;
        this.isHost = true;
        this.connectToSession();
        this.updateSessionUI();
  
        this.addSystemMessage(
          `Session created! Share this link with others: ${window.location.origin}${window.location.pathname}?session=${this.sessionId}`,
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
  
      if (action === "join") {
        title.textContent = "Join Session";
        confirmBtn.textContent = "Join Session";
        sessionInput.style.display = "block";
        sessionInput.setAttribute("placeholder", "Enter Session ID");
      } else {
        title.textContent = "Create Session";
        confirmBtn.textContent = "Create Session";
        sessionInput.style.display = "none";
      }
  
      modal.style.display = "flex";
      document.getElementById("userNameInput").focus();
      this.setupCustomization();
    }
  
    async joinSession(sessionId) {
      try {
        const response = await fetch(
          `http://localhost:5001/api/sessions/${sessionId}/join`,
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
          throw new Error("Session not found");
        }
  
        const data = await response.json();
        this.sessionId = sessionId;
        this.isHost = false;
        this.sessionMessages = data.messages || [];
  
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
  
      this.ws = new WebSocket(`ws://localhost:5001/sessions/${this.sessionId}`);
  
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
        const data = JSON.parse(event.data);
        this.handleSessionMessage(data);
      };
  
      this.ws.onclose = () => {
        console.log("Disconnected from session");
        if (this.currentSession) {
          setTimeout(() => this.connectToSession(), 3000); 
        }
      };
  
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
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
        case "profile_update":
          if (userName && session.participants.has(userName)) {
            const participant = session.participants.get(userName);
  
            if (message.newUserName && message.newUserName !== userName) {
              session.participants.delete(userName);
              session.participants.set(message.newUserName, {
                ...participant,
                userName: message.newUserName,
                avatar: message.avatar || participant.avatar,
                color: message.color || participant.color,
              });
  
              const connections = sessionConnections.get(sessionId) || [];
              const connection = connections.find(
                (conn) => conn.userName === userName,
              );
              if (connection) {
                connection.userName = message.newUserName;
              }
  
              userName = message.newUserName;
            } else {
              participant.avatar = message.avatar || participant.avatar;
              participant.color = message.color || participant.color;
            }
  
            broadcastToSession(sessionId, {
              type: "participants_update",
              participants: session.getParticipantsList(),
            });
          }
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
  
      if (this.sessionId) {
        sessionIdDisplay.textContent = `Session: ${this.sessionId}`;
        participantsList.style.display = "block";
  
        document.getElementById("createSessionBtn").style.display = "none";
        document.getElementById("joinSessionBtn").style.display = "none";
        document.getElementById("leaveSessionBtn").style.display = "inline-block";
        document.getElementById("shareSessionBtn").style.display = "inline-block";
        document.getElementById("downloadSessionBtn").style.display =
          "inline-block";
      } else {
        participantsList.style.display = "none";
  
        document.getElementById("createSessionBtn").style.display =
          "inline-block";
        document.getElementById("joinSessionBtn").style.display = "inline-block";
        document.getElementById("leaveSessionBtn").style.display = "none";
        document.getElementById("shareSessionBtn").style.display = "none";
        document.getElementById("downloadSessionBtn").style.display = "none";
      }
    }
  
    shareSession() {
      const link = `${window.location.origin}${window.location.pathname}?session=${this.sessionId}`;
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
          `http://localhost:5001/api/sessions/${this.sessionId}/download`,
        );
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
        alert("Failed to download session");
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
  
      // Update URL
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
  }
  window.sessionManager = new SessionManager();