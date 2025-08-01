class VoiceTutor {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isProcessing = false;
        this.currentUtterance = null;
        this.voices = [];
        this.preferredVoice = null;
        this.speechSettings = {
            pitch: parseFloat(localStorage.getItem('speechPitch')) || 1.0,
            rate: parseFloat(localStorage.getItem('speechRate')) || 0.9,
            volume: parseFloat(localStorage.getItem('speechVolume')) || 0.8
        };
        
        this.initializeVoiceRecognition();
        this.initializeVoiceSynthesis();
        this.setupVoiceControls();
    }

    initializeVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            this.showVoiceError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

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
        const loadVoices = () => {
            this.voices = this.synthesis.getVoices();
            
            this.preferredVoice = this.voices.find(voice => 
                voice.lang.startsWith('en') && 
                (voice.name.includes('Female') || voice.name.includes('Samantha') || voice.name.includes('Karen'))
            ) || this.voices.find(voice => voice.lang.startsWith('en')) || this.voices[0];
            
            console.log('Available voices:', this.voices.length);
            console.log('Selected voice:', this.preferredVoice?.name);
        };

        loadVoices();
        this.synthesis.onvoiceschanged = loadVoices;
    }

    setupVoiceControls() {
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
        
        if (document.getElementById('voiceControls')) {
            console.log('Voice controls already exist');
            return;
        }

        inputContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
        `;

        chatInput.style.flex = '1';

        const voiceControls = document.createElement('div');
        voiceControls.id = 'voiceControls';
        voiceControls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
        `;

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

        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'settingsBtn';
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.title = 'Adjust speech settings';
        settingsBtn.style.cssText = `
            width: 36px;
            height: 36px;
            border: 2px solid #6b7d4f;
            border-radius: 50%;
            background: white;
            color: #6b7d4f;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
        `;
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Settings button clicked');
            this.toggleSettingsMenu();
        });

        const settingsContainer = document.createElement('div');
        settingsContainer.id = 'speechSettings';
        settingsContainer.style.cssText = `
            display: none;
            position: absolute;
            bottom: 48px; /* Position above the button */
            right: 0;
            background: #ffffff;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #ccc;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
            z-index: 1001;
            flex-direction: column;
            gap: 8px;
            width: 220px;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
        `;

        const createSlider = (id, label, min, max, step, value, onChange) => {
            const sliderContainer = document.createElement('div');
            sliderContainer.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
            `;
            const labelEl = document.createElement('label');
            labelEl.htmlFor = id;
            labelEl.textContent = label;
            labelEl.style.width = '50px';
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = id;
            slider.min = min;
            slider.max = max;
            slider.step = step;
            slider.value = value;
            slider.style.width = '100px';
            
            const valueDisplay = document.createElement('span');
            valueDisplay.id = `${id}Value`;
            valueDisplay.textContent = value.toFixed(1);
            
            slider.addEventListener('input', () => {
                valueDisplay.textContent = slider.value;
                onChange(slider.value);
                console.log(`${label} set to ${slider.value}`);
            });
            
            sliderContainer.appendChild(labelEl);
            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(valueDisplay);
            return sliderContainer;
        };

        const pitchSlider = createSlider(
            'pitchSlider',
            'Pitch:',
            0.5,
            2.0,
            0.1,
            this.speechSettings.pitch,
            (value) => {
                this.speechSettings.pitch = parseFloat(value);
                localStorage.setItem('speechPitch', value);
            }
        );

        const rateSlider = createSlider(
            'rateSlider',
            'Speed:',
            0.5,
            2.0,
            0.1,
            this.speechSettings.rate,
            (value) => {
                this.speechSettings.rate = parseFloat(value);
                localStorage.setItem('speechRate', value);
            }
        );

        const volumeSlider = createSlider(
            'volumeSlider',
            'Volume:',
            0.1,
            1.0,
            0.1,
            this.speechSettings.volume,
            (value) => {
                this.speechSettings.volume = parseFloat(value);
                localStorage.setItem('speechVolume', value);
            }
        );

        settingsContainer.appendChild(pitchSlider);
        settingsContainer.appendChild(rateSlider);
        settingsContainer.appendChild(volumeSlider);

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

        voiceControls.appendChild(voiceInputBtn);
        voiceControls.appendChild(stopSpeakingBtn);
        voiceControls.appendChild(autoSpeechBtn);
        voiceControls.appendChild(settingsBtn);
        voiceControls.appendChild(settingsContainer);
        voiceControls.appendChild(voiceStatus);
        
        inputContainer.appendChild(voiceControls);
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            @keyframes micPulse {
                0% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-1px) scale(1.05); box-shadow: 0 4px 10px rgba(255,0,0,0.3); }
                100% { transform: translateY(0) scale(1); }
            }
            
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            #speechSettings.show {
                display: flex;
                opacity: 1;
                transform: translateY(0);
                animation: fadeInUp 0.2s ease forwards;
            }
        `;
        document.head.appendChild(style);

        document.addEventListener('click', (e) => {
            if (!settingsContainer.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsContainer.style.display = 'none';
                settingsContainer.classList.remove('show');
                console.log('Settings menu closed due to click outside');
            }
        });
        
        console.log('Voice controls created successfully');
    }

    toggleSettingsMenu() {
        const settingsContainer = document.getElementById('speechSettings');
        if (settingsContainer) {
            const isVisible = settingsContainer.style.display === 'flex';
            settingsContainer.style.display = isVisible ? 'none' : 'flex';
            if (!isVisible) {
                settingsContainer.classList.add('show');
            } else {
                settingsContainer.classList.remove('show');
            }
            console.log(`Settings menu toggled to ${isVisible ? 'hidden' : 'visible'}`);
        } else {
            console.error('Settings container not found');
        }
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
        
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = transcript;
        }
    
        this.showVoiceStatus(`Heard: "${transcript}"`);
        
        setTimeout(() => {
            const sendButton = document.getElementById('sendButton');
            if (sendButton) {
                sendButton.click();
            }
            this.hideVoiceStatus();
        }, 1000);
    }

    speakText(text) {
        this.stopSpeaking();

        if (!this.synthesis) {
            console.error('Speech synthesis not available');
            return;
        }

        const cleanText = text
            .replace(/\[.*?\]/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) return;

        this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
        
        if (this.preferredVoice) {
            this.currentUtterance.voice = this.preferredVoice;
        }
        this.currentUtterance.rate = this.speechSettings.rate;
        this.currentUtterance.pitch = this.speechSettings.pitch;
        this.currentUtterance.volume = this.speechSettings.volume;

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
            voiceBtn.style.background = '#ff6b6b url("images/mic.png") no-repeat center center';
            voiceBtn.style.backgroundSize = '16px 16px';
            voiceBtn.style.borderColor = '#ff6b6b';
            voiceBtn.style.animation = 'micPulse 1s infinite';
        } else {
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
            
            setTimeout(() => {
                this.hideVoiceStatus();
                status.style.background = '#e8f5e8';
                status.style.color = '#337810';
            }, 3000);
        }
    }

    handleBotResponse(text) {
        const autoSpeech = localStorage.getItem('autoSpeech') !== 'false';
        if (autoSpeech) {
            setTimeout(() => {
                this.speakText(text);
            }, 300);
        }
    }
}

let voiceTutor = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing voice tutor...');
    
    setTimeout(() => {
        voiceTutor = new VoiceTutor();
        window.voiceTutor = voiceTutor;
        console.log('Voice tutor initialized');
    }, 1000);
});

if (document.readyState === 'loading') {
} else {
    console.log('DOM already loaded, initializing voice tutor immediately...');
    setTimeout(() => {
        if (!voiceTutor) {
            voiceTutor = new VoiceTutor();
            window.voiceTutor = voiceTutor;
            console.log('Voice tutor initialized (fallback)');
        }
    }, 500);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceTutor;
}