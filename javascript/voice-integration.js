// voice-integration.js
class VoiceTutor {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isProcessing = false;
        this.currentUtterance = null;
        this.voices = [];
        this.preferredVoice = null;
        
        this.initializeVoiceRecognition();
        this.initializeVoiceSynthesis();
        this.setupVoiceControls();
    }

    initializeVoiceRecognition() {
        // Check if browser supports speech recognition
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            this.showVoiceError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        // Create speech recognition instance
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition settings
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        // Set up event handlers
        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.isListening = true;
            this.updateVoiceButton();
            this.showVoiceStatus('Listening... Speak your question!');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log('Voice input received:', transcript);
            this.handleVoiceInput(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Voice recognition error:', event.error);
            this.isListening = false;
            this.updateVoiceButton();
            
            let errorMessage = 'Voice recognition error: ';
            switch(event.error) {
                case 'no-speech':
                    errorMessage += 'No speech detected. Please try again.';
                    break;
                case 'audio-capture':
                    errorMessage += 'Microphone not available. Please check permissions.';
                    break;
                case 'not-allowed':
                    errorMessage += 'Microphone access denied. Please enable microphone permissions.';
                    break;
                default:
                    errorMessage += event.error;
            }
            this.showVoiceError(errorMessage);
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            this.isListening = false;
            this.updateVoiceButton();
            this.hideVoiceStatus();
        };
    }

    initializeVoiceSynthesis() {
        // Load available voices
        const loadVoices = () => {
            this.voices = this.synthesis.getVoices();
            
            // Find a good English voice
            this.preferredVoice = this.voices.find(voice => 
                voice.lang.startsWith('en') && 
                (voice.name.includes('Female') || voice.name.includes('Samantha') || voice.name.includes('Karen'))
            ) || this.voices.find(voice => voice.lang.startsWith('en')) || this.voices[0];
            
            console.log('Available voices:', this.voices.length);
            console.log('Selected voice:', this.preferredVoice?.name);
        };

        // Load voices immediately and also on voiceschanged event
        loadVoices();
        this.synthesis.onvoiceschanged = loadVoices;
    }

    setupVoiceControls() {
        // Create voice control buttons if they don't exist
        this.createVoiceButtons();
    }

    createVoiceButtons() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) {
            console.log('Chat input not found, retrying in 1 second...');
            setTimeout(() => this.createVoiceButtons(), 1000);
            return;
        }

        const inputContainer = chatInput.parentElement;
        
        // Check if voice controls already exist
        if (document.getElementById('voiceControls')) {
            console.log('Voice controls already exist');
            return;
        }

        // Modify the input container to be flex
        inputContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
        `;

        // Ensure chat input takes remaining space
        chatInput.style.flex = '1';

        // Create voice controls container (inline with input)
        const voiceControls = document.createElement('div');
        voiceControls.id = 'voiceControls';
        voiceControls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        // Voice input button (smaller and aligned with send button)
        const voiceInputBtn = document.createElement('button');
        voiceInputBtn.id = 'voiceInputBtn';
        voiceInputBtn.title = 'Click to speak your question';
        voiceInputBtn.style.cssText = `
            width: 36px;
            height: 36px;
            border: 2px solid #6b7d4f;
            border-radius: 50%;
            background: white url("images/mic.png") no-repeat center center;
            background-size: 16px 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            flex-shrink: 0;
        `;
        voiceInputBtn.addEventListener('click', () => this.toggleVoiceInput());

        // Stop speaking button (smaller and inline)
        const stopSpeakingBtn = document.createElement('button');
        stopSpeakingBtn.id = 'stopSpeakingBtn';
        stopSpeakingBtn.innerHTML = '⏹️';
        stopSpeakingBtn.title = 'Stop speaking';
        stopSpeakingBtn.style.cssText = `
            width: 36px;
            height: 36px;
            border: 2px solid #ff6b6b;
            border-radius: 50%;
            background: white;
            color: #ff6b6b;
            cursor: pointer;
            font-size: 12px;
            display: none;
            transition: all 0.3s ease;
            flex-shrink: 0;
        `;
        stopSpeakingBtn.addEventListener('click', () => this.stopSpeaking());

        // Auto-speech toggle button (compact)
        const autoSpeechBtn = document.createElement('button');
        autoSpeechBtn.id = 'autoSpeechBtn';
        const autoSpeechEnabled = localStorage.getItem('autoSpeech') !== 'false';
        autoSpeechBtn.innerHTML = autoSpeechEnabled ? '🔊' : '🔇';
        autoSpeechBtn.title = autoSpeechEnabled ? 'Auto-speech ON (click to disable)' : 'Auto-speech OFF (click to enable)';
        autoSpeechBtn.style.cssText = `
        width: 36px;
        height: 36px;
        border: 2px solid ${autoSpeechEnabled ? '#6b7d4f' : '#ccc'};
        border-radius: 50%;
        background: white;
        color: ${autoSpeechEnabled ? '#6b7d4f' : '#666'};
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    `;
    
        autoSpeechBtn.addEventListener('click', () => this.toggleAutoSpeech());

        // Voice status indicator (compact)
        const voiceStatus = document.createElement('div');
        voiceStatus.id = 'voiceStatus';
        voiceStatus.style.cssText = `
            padding: 4px 8px;
            border-radius: 12px;
            background: #e8f5e8;
            color: #337810;
            font-size: 11px;
            display: none;
            animation: pulse 1.5s infinite;
            white-space: nowrap;
            position: absolute;
            top: -30px;
            left: 0;
            z-index: 1000;
        `;

        // Make voice controls container relative for status positioning
        voiceControls.style.position = 'relative';

        voiceControls.appendChild(voiceInputBtn);
        voiceControls.appendChild(stopSpeakingBtn);
        voiceControls.appendChild(autoSpeechBtn);
        voiceControls.appendChild(voiceStatus);
        
        inputContainer.appendChild(voiceControls);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            /* Pulsing animation for listening state */
            @keyframes micPulse {
                0% { transform: translateY(0) scale(1); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
                50% { transform: translateY(-1px) scale(1.05); box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4); }
                100% { transform: translateY(0) scale(1); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
            }
        `;
        document.head.appendChild(style);
        
        console.log('Voice controls created successfully');
    }

    toggleVoiceInput() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    toggleAutoSpeech() {
        const currentSetting = localStorage.getItem('autoSpeech') !== 'false';
        const newSetting = !currentSetting;
        localStorage.setItem('autoSpeech', newSetting.toString());
        
        const autoSpeechBtn = document.getElementById('autoSpeechBtn');
        if (autoSpeechBtn) {
            autoSpeechBtn.innerHTML = newSetting ? '🔊' : '🔇';
            autoSpeechBtn.title = newSetting ? 'Auto-speech ON (click to disable)' : 'Auto-speech OFF (click to enable)';
            autoSpeechBtn.style.borderColor = newSetting ? '#6b7d4f' : '#ccc';
            autoSpeechBtn.style.color = newSetting ? '#6b7d4f' : '#666';
        }
        
        this.showVoiceStatus(newSetting ? 'Auto-speech enabled' : 'Auto-speech disabled');
        setTimeout(() => this.hideVoiceStatus(), 2000);
    }

    startListening() {
        if (!this.recognition) {
            this.showVoiceError('Voice recognition not available');
            return;
        }

        if (this.isListening) return;

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start voice recognition:', error);
            this.showVoiceError('Failed to start voice recognition. Please try again.');
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    handleVoiceInput(transcript) {
        console.log('Processing voice input:', transcript);
        
        // Put the transcript in the chat input
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = transcript;
        }
    
        // Show what was heard
        this.showVoiceStatus(`Heard: "${transcript}"`);
        
        // Automatically send the message by clicking the send button
        // This ensures the normal message flow is followed
        setTimeout(() => {
            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.click(); // This will read from the input field
            }
            this.hideVoiceStatus();
        }, 1000);
    }

    speakText(text) {
        // Stop any current speech
        this.stopSpeaking();

        if (!this.synthesis) {
            console.error('Speech synthesis not available');
            return;
        }

        // Clean the text (remove whiteboard commands and extra formatting)
        const cleanText = text
            .replace(/\[.*?\]/g, '') // Remove whiteboard commands
            .replace(/\n+/g, ' ') // Replace newlines with spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();

        if (!cleanText) return;

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        
        // Configure the utterance
        if (this.preferredVoice) {
            this.currentUtterance.voice = this.preferredVoice;
        }
        this.currentUtterance.rate = 0.9; // Slightly slower for better comprehension
        this.currentUtterance.pitch = 1.0;
        this.currentUtterance.volume = 0.8;

        // Set up event handlers
        this.currentUtterance.onstart = () => {
            console.log('Started speaking');
            this.showStopButton();
        };

        this.currentUtterance.onend = () => {
            console.log('Finished speaking');
            this.hideStopButton();
            this.currentUtterance = null;
        };

        this.currentUtterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            this.hideStopButton();
            this.currentUtterance = null;
        };

        // Start speaking
        this.synthesis.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
        this.currentUtterance = null;
        this.hideStopButton();
    }

    updateVoiceButton() {
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (!voiceBtn) return;

        if (this.isListening) {
            // Listening state - red background with pulsing animation
            voiceBtn.style.background = '#ff6b6b url("images/mic.png") no-repeat center center';
            voiceBtn.style.backgroundSize = '16px 16px';
            voiceBtn.style.borderColor = '#ff6b6b';
            voiceBtn.style.animation = 'micPulse 1s infinite';
        } else {
            // Default state - white background with green border
            voiceBtn.style.background = 'white url("images/mic.png") no-repeat center center';
            voiceBtn.style.backgroundSize = '16px 16px';
            voiceBtn.style.borderColor = '#6b7d4f';
            voiceBtn.style.animation = 'none';
            voiceBtn.style.transform = 'translateY(0) scale(1)';
            voiceBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
        }
    }

    showStopButton() {
        const stopBtn = document.getElementById('stopSpeakingBtn');
        if (stopBtn) {
            stopBtn.style.display = 'block';
        }
    }

    hideStopButton() {
        const stopBtn = document.getElementById('stopSpeakingBtn');
        if (stopBtn) {
            stopBtn.style.display = 'none';
        }
    }

    showVoiceStatus(message) {
        const status = document.getElementById('voiceStatus');
        if (status) {
            status.textContent = message;
            status.style.display = 'block';
        }
    }

    hideVoiceStatus() {
        const status = document.getElementById('voiceStatus');
        if (status) {
            status.style.display = 'none';
        }
    }

    showVoiceError(message) {
        const status = document.getElementById('voiceStatus');
        if (status) {
            status.textContent = message;
            status.style.background = '#ffe8e8';
            status.style.color = '#ff6b6b';
            status.style.display = 'block';
            
            // Hide after 3 seconds
            setTimeout(() => {
                this.hideVoiceStatus();
                status.style.background = '#e8f5e8';
                status.style.color = '#337810';
            }, 3000);
        }
    }

    // Method to handle automatic speech for bot responses
    handleBotResponse(text) {
        // Check if user wants automatic speech
        const autoSpeech = localStorage.getItem('autoSpeech') !== 'false'; // Default to true
        
        if (autoSpeech) {
            // Small delay to let the message appear first
            setTimeout(() => {
                this.speakText(text);
            }, 300);
        }
    }
}

// Initialize voice tutor when DOM is loaded
let voiceTutor = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing voice tutor...');
    
    // Small delay to ensure other scripts are loaded
    setTimeout(() => {
        voiceTutor = new VoiceTutor();
        
        // Make it globally available
        window.voiceTutor = voiceTutor;
        
        console.log('Voice tutor initialized');
    }, 1000);
});

// Fallback initialization if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // DOMContentLoaded has not fired yet
} else {
    // DOMContentLoaded has already fired
    console.log('DOM already loaded, initializing voice tutor immediately...');
    setTimeout(() => {
        if (!voiceTutor) {
            voiceTutor = new VoiceTutor();
            window.voiceTutor = voiceTutor;
            console.log('Voice tutor initialized (fallback)');
        }
    }, 500);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceTutor;
}