// Integration with existing tutor chat system
class QuizIntegration {
    constructor() {
        this.init();
    }

    init() {
        this.addQuizButton();
        this.enhanceChatWithQuizCommands();
    }

    addQuizButton() {
        // Add quiz button to the tutor interface
        const chatContainer = document.querySelector('.chat-input-container');
        if (chatContainer) {
            const quizButton = document.createElement('button');
            quizButton.innerHTML = '🧠 Quiz';
            quizButton.className = 'quiz-trigger-btn';
            quizButton.title = 'Start a quiz';
            quizButton.onclick = () => this.showQuizMenu();
            
            // Insert before the send button
            const sendButton = document.getElementById('sendButton');
            chatContainer.insertBefore(quizButton, sendButton);
            
            // Add styles for the button
            const style = document.createElement('style');
            style.textContent = `
                .quiz-trigger-btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 10px 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-right: 8px;
                    transition: all 0.2s ease;
                }
                .quiz-trigger-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                }
                .quiz-menu {
                    position: absolute;
                    bottom: 60px;
                    right: 0;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                    padding: 15px;
                    min-width: 200px;
                    z-index: 100;
                }
                .quiz-menu-item {
                    display: block;
                    width: 100%;
                    padding: 10px 15px;
                    border: none;
                    background: none;
                    text-align: left;
                    cursor: pointer;
                    border-radius: 8px;
                    margin-bottom: 5px;
                    transition: background 0.2s;
                }
                .quiz-menu-item:hover {
                    background: #f0f0f0;
                }
            `;
            document.head.appendChild(style);
        }
    }

    showQuizMenu() {
        // Remove existing menu if any
        const existingMenu = document.querySelector('.quiz-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'quiz-menu';
        menu.innerHTML = `
            <button class="quiz-menu-item" onclick="startQuiz('probability'); this.parentElement.remove();">
                📊 Probability Quiz
            </button>
            <button class="quiz-menu-item" onclick="startQuiz('statistics'); this.parentElement.remove();">
                📈 Statistics Quiz
            </button>
            <button class="quiz-menu-item" onclick="quizIntegration.createCustomQuiz(); this.parentElement.remove();">
                ✨ Create Custom Quiz
            </button>
        `;

        const chatContainer = document.querySelector('.chat-input-container');
        chatContainer.style.position = 'relative';
        chatContainer.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && !e.target.classList.contains('quiz-trigger-btn')) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    enhanceChatWithQuizCommands() {
        // Listen for quiz-related messages in chat
        const originalSendMessage = window.sendMessage;
        if (originalSendMessage) {
            window.sendMessage = (message) => {
                if (this.handleQuizCommands(message)) {
                    return; // Quiz command handled, don't send to chat
                }
                originalSendMessage(message);
            };
        }
    }

    handleQuizCommands(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('quiz') || lowerMessage.includes('test') || lowerMessage.includes('assessment')) {
            if (lowerMessage.includes('probability')) {
                startQuiz('probability');
                return true;
            } else if (lowerMessage.includes('statistics') || lowerMessage.includes('stats')) {
                startQuiz('statistics');
                return true;
            } else {
                this.showQuizMenu();
                return true;
            }
        }
        
        return false;
    }

    createCustomQuiz() {
        // This could integrate with the AI to generate custom quizzes
        const topic = prompt('What topic would you like to be quizzed on?');
        if (topic) {
            this.generateAIQuiz(topic);
        }
    }

    async generateAIQuiz(topic) {
        try {
            // Show loading
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'flex';
            }

            // Call your existing Gemini API
            const response = await fetch('/api/gemini.js', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: `Create a 5-question multiple choice quiz about "${topic}". Return ONLY a JSON object in this exact format:
{
  "title": "${topic} Quiz",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0
    }
  ]
}
Make sure the "correct" field contains the index (0-3) of the correct answer. Do not include any other text, just the JSON.`
                    }]
                })
            });

            const data = await response.json();
            
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }

            // Parse AI response and create quiz
            try {
                // Clean the response to extract JSON
                let jsonStr = data.response.trim();
                if (jsonStr.includes('```json')) {
                    jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
                } else if (jsonStr.includes('```')) {
                    jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
                }
                
                const quizData = JSON.parse(jsonStr);
                quizSystem.startQuiz(quizData);
            } catch (e) {
                console.log('JSON parse failed, using fallback parser');
                const fallbackQuiz = this.parseAIResponseToQuiz(data.response, topic);
                quizSystem.startQuiz(fallbackQuiz);
            }
        } catch (error) {
            console.error('Error generating AI quiz:', error);
            alert('Sorry, there was an error generating the quiz. Please try again.');
            
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
        }
    }

    parseAIResponseToQuiz(aiResponse, topic) {
        // Simple parser for AI-generated quiz content
        const lines = aiResponse.split('\n').filter(line => line.trim());
        const questions = [];
        
        let currentQuestion = null;
        let options = [];
        
        lines.forEach(line => {
            line = line.trim();
            if (line.match(/^\d+\./)) {
                // New question
                if (currentQuestion) {
                    questions.push({
                        question: currentQuestion,
                        options: [...options],
                        correct: 0 // Default to first option
                    });
                }
                currentQuestion = line.replace(/^\d+\.\s*/, '');
                options = [];
            } else if (line.match(/^[A-D]\)/)) {
                // Option
                options.push(line.replace(/^[A-D]\)\s*/, ''));
            }
        });
        
        // Add last question
        if (currentQuestion && options.length > 0) {
            questions.push({
                question: currentQuestion,
                options: [...options],
                correct: 0
            });
        }
        
        return {
            title: `${topic} Quiz`,
            questions: questions.slice(0, 5) // Limit to 5 questions
        };
    }
}

// Initialize quiz integration
const quizIntegration = new QuizIntegration();