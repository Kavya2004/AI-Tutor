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
            pitch: parseFloat(localStorage.getItem('speechPitch')) || 0.8,
            rate: parseFloat(localStorage.getItem('speechRate')) || 0.75,
            volume: parseFloat(localStorage.getItem('speechVolume')) || 0.9
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
            
            // Priority order for more natural-sounding voices
            const preferredVoiceNames = [
                'Samantha', 'Karen', 'Victoria', 'Allison', 'Ava', 'Susan', 'Joanna', 'Salli',
                'Google US English', 'Microsoft Zira', 'Microsoft Hazel', 'Alex',
                'Natural', 'Premium', 'Enhanced'
            ];
            
            // Find the best available voice
            this.preferredVoice = null;
            
            // First, try to find premium/natural voices
            for (const voiceName of preferredVoiceNames) {
                const voice = this.voices.find(v => 
                    v.lang.startsWith('en') && 
                    (v.name.includes(voiceName) || v.name.toLowerCase().includes(voiceName.toLowerCase()))
                );
                if (voice) {
                    this.preferredVoice = voice;
                    break;
                }
            }
            
            // Fallback to any English voice that sounds natural
            if (!this.preferredVoice) {
                this.preferredVoice = this.voices.find(voice => 
                    voice.lang.startsWith('en') && 
                    (voice.name.toLowerCase().includes('female') || 
                     voice.name.toLowerCase().includes('woman') ||
                     voice.localService === false) // Often higher quality
                );
            }
            
            // Final fallback
            if (!this.preferredVoice) {
                this.preferredVoice = this.voices.find(voice => voice.lang.startsWith('en')) || this.voices[0];
            }
            
            console.log('Available voices:', this.voices.length);
            console.log('Selected voice:', this.preferredVoice?.name, '| Local:', this.preferredVoice?.localService);
        };

        loadVoices();
        this.synthesis.onvoiceschanged = loadVoices;
    }

    setupVoiceControls() {
        this.createVoiceButtons();
    }

    createVoiceButtons() {
        // Voice controls are now integrated into session controls
        this.createSettingsMenu();
    }

    createSettingsMenu() {

        // Create settings menu attached to chat container
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer || document.getElementById('speechSettings')) return;

        const settingsContainer = document.createElement('div');
        settingsContainer.id = 'speechSettings';
        settingsContainer.style.cssText = `
            display: none;
            position: absolute;
            bottom: 60px;
            right: 20px;
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
                const displayValue = label === 'Pitch:' || label === 'Speed:' ? 
                    parseFloat(slider.value).toFixed(2) : 
                    parseFloat(slider.value).toFixed(1);
                valueDisplay.textContent = displayValue;
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
            0.7,
            1.3,
            0.05,
            this.speechSettings.pitch,
            (value) => {
                this.speechSettings.pitch = parseFloat(value);
                localStorage.setItem('speechPitch', value);
            }
        );

        const rateSlider = createSlider(
            'rateSlider',
            'Speed:',
            0.6,
            1.4,
            0.05,
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

        // Add stop button to chat input area
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer && !document.getElementById('stopSpeakingBtn')) {
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
            inputContainer.appendChild(stopSpeakingBtn);
        }

        chatContainer.appendChild(settingsContainer);

        
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

        const processedText = this.preprocessTextForSpeech(text);
        if (!processedText) return;

        // Split long text into chunks for more natural delivery
        const chunks = this.splitTextIntoChunks(processedText);
        this.speakChunks(chunks, 0);
    }

    preprocessTextForSpeech(text) {
        let cleanText = text
            // Remove markdown and formatting
            .replace(/\[.*?\]/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/#{1,6}\s/g, '')
            
            // Improve mathematical expressions
            .replace(/\b(\d+)\/(\d+)\b/g, '$1 over $2')
            .replace(/\b(\d+)\^(\d+)\b/g, '$1 to the power of $2')
            .replace(/\bx\^2\b/g, 'x squared')
            .replace(/\bx\^3\b/g, 'x cubed')
            .replace(/\b√(\d+)\b/g, 'square root of $1')
            
            // Add natural pauses
            .replace(/([.!?])\s+/g, '$1... ')
            .replace(/([,;:])\s+/g, '$1, ')
            .replace(/\n+/g, '... ')
            
            // Improve number reading
            .replace(/\b(\d{4})\b/g, (match) => {
                const num = parseInt(match);
                if (num >= 1000 && num <= 9999) {
                    const thousands = Math.floor(num / 1000);
                    const remainder = num % 1000;
                    if (remainder === 0) return `${thousands} thousand`;
                    if (remainder < 100) return `${thousands} thousand ${remainder}`;
                    return `${thousands} thousand ${remainder}`;
                }
                return match;
            })
            
            // Clean up spacing
            .replace(/\s+/g, ' ')
            .trim();

        // Add emphasis to important words
        cleanText = cleanText
            .replace(/\b(important|note|remember|key|crucial|essential)\b/gi, (match) => `${match.toLowerCase()},`)
            .replace(/\b(however|but|although|therefore|thus|consequently)\b/gi, (match) => `, ${match.toLowerCase()},`);

        return cleanText;
    }

    splitTextIntoChunks(text, maxLength = 200) {
        if (text.length <= maxLength) return [text];
        
        const sentences = text.split(/([.!?]\s+)/);
        const chunks = [];
        let currentChunk = '';
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            if (currentChunk.length + sentence.length <= maxLength) {
                currentChunk += sentence;
            } else {
                if (currentChunk.trim()) chunks.push(currentChunk.trim());
                currentChunk = sentence;
            }
        }
        
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        return chunks.filter(chunk => chunk.length > 0);
    }

    speakChunks(chunks, index) {
        if (index >= chunks.length) {
            this.hideStopButton();
            this.currentUtterance = null;
            return;
        }

        const chunk = chunks[index];
        this.currentUtterance = new SpeechSynthesisUtterance(chunk);
        
        if (this.preferredVoice) {
            this.currentUtterance.voice = this.preferredVoice;
        }
        
        // Slightly randomize speech parameters for more natural sound
        const baseRate = this.speechSettings.rate;
        const basePitch = this.speechSettings.pitch;
        
        this.currentUtterance.rate = baseRate + (Math.random() - 0.5) * 0.1;
        this.currentUtterance.pitch = basePitch + (Math.random() - 0.5) * 0.1;
        this.currentUtterance.volume = this.speechSettings.volume;

        if (index === 0) {
            this.currentUtterance.onstart = () => {
                console.log('Started speaking');
                this.showStopButton();
            };
        }

        this.currentUtterance.onend = () => {
            console.log(`Finished chunk ${index + 1}/${chunks.length}`);
            
            // Add a small pause between chunks for natural flow
            setTimeout(() => {
                if (this.currentUtterance) { // Check if not cancelled
                    this.speakChunks(chunks, index + 1);
                }
            }, 200);
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
        const autoSpeech = localStorage.getItem('autoSpeech') === 'true';
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