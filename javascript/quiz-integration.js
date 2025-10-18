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
        // Directly show topic input popup instead of menu
        this.createCustomQuiz();
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
            // Check for chapter-specific requests
            const chapterMatch = this.extractChapterFromMessage(message);
            if (chapterMatch) {
                this.generateAIQuiz(chapterMatch);
                return true;
            } else {
                this.showQuizMenu();
                return true;
            }
        }
        
        return false;
    }

    createCustomQuiz() {
        // Show a better popup for topic selection
        const popup = document.createElement('div');
        popup.className = 'topic-popup';
        popup.innerHTML = `
            <div class="topic-popup-content">
                <h3>🧠 Create Custom Quiz</h3>
                <p>What topic or chapter would you like to be quizzed on?</p>
                <input type="text" id="topicInput" placeholder="e.g., Chapter 1, Conditional Probability, Bayes Theorem..." />
                <div class="topic-suggestions">
                    <button onclick="document.getElementById('topicInput').value='Chapter 1 - Basic Concepts'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 1</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 2 - Combinatorial Analysis'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 2</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 3 - Discrete Random Variables'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 3</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 4 - Continuous Random Variables'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 4</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 5 - Joint Distributions'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 5</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 6 - Limit Theorems'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 6</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 7 - Statistical Inference'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 7</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 8 - Estimation'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 8</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 9 - Bayesian Inference'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 9</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 10 - Introduction to Random Processes'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 10</button>
                    <button onclick="document.getElementById('topicInput').value='Chapter 11 - Some Important Random Processes'; this.parentElement.parentElement.querySelector('.topic-btn-primary').click();">Chapter 11</button>
                </div>
                <div class="topic-buttons">
                    <button class="topic-btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove();">Cancel</button>
                    <button class="topic-btn-primary" onclick="quizIntegration.handleTopicSubmit();">Create Quiz</button>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .topic-popup {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .topic-popup-content {
                background: white;
                padding: 25px;
                border-radius: 15px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            .topic-popup-content h3 {
                margin: 0 0 15px 0;
                color: #337810;
                text-align: center;
            }
            .topic-popup-content p {
                margin: 0 0 15px 0;
                color: #666;
                text-align: center;
            }
            #topicInput {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                margin-bottom: 15px;
                box-sizing: border-box;
            }
            #topicInput:focus {
                border-color: #337810;
                outline: none;
            }
            .topic-suggestions {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            .topic-suggestions button {
                padding: 6px 12px;
                border: 1px solid #ddd;
                background: #f8f9fa;
                border-radius: 15px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            .topic-suggestions button:hover {
                background: #337810;
                color: white;
                border-color: #337810;
            }
            .topic-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            .topic-btn-secondary, .topic-btn-primary {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            }
            .topic-btn-secondary {
                background: #f8f9fa;
                color: #666;
            }
            .topic-btn-secondary:hover {
                background: #e9ecef;
            }
            .topic-btn-primary {
                background: #337810;
                color: white;
            }
            .topic-btn-primary:hover {
                background: #2a6209;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(popup);
        
        // Focus input
        setTimeout(() => {
            document.getElementById('topicInput').focus();
        }, 100);
        
        // Handle Enter key
        document.getElementById('topicInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleTopicSubmit();
            }
        });
    }
    
    handleTopicSubmit() {
        const topic = document.getElementById('topicInput').value.trim();
        if (topic) {
            document.querySelector('.topic-popup').remove();
            this.generateAIQuiz(topic);
        }
    }

    async generateAIQuiz(topic) {
        try {
            // Check if we have a sample quiz for this topic first
            const chapterKey = window.getChapterKey ? window.getChapterKey(topic) : topic.toLowerCase();
            if (window.sampleQuizzes && window.sampleQuizzes[chapterKey]) {
                quizSystem.startQuiz(window.sampleQuizzes[chapterKey]);
                return;
            }
            
            // Show loading with quiz-specific timing
            if (window.showLoadingForQuiz) {
                window.showLoadingForQuiz();
            } else {
                const loadingIndicator = document.getElementById('loadingIndicator');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'flex';
                }
            }

            // Enhanced prompt for chapter-specific content
            const isChapterRequest = this.detectChapterRequest(topic);
            let promptContent;
            
            if (isChapterRequest) {
                promptContent = `Create a 5-question multiple choice quiz about "${topic}" from probabilitycourse.com. Use these sample formats:

SAMPLE FORMATS:
1. "Let X be a continuous random variable with PDF f(x) = 2C/x² for 2 ≤ x ≤ 4. What is C?"
2. "If S = {1,2,...,20} and A = {3,4,5}, what is A ∩ B^c?"
3. "A fair coin is tossed three times. Let X be the number of heads. What is P(X=1)?"
4. Joint probability tables and calculations

Use readable mathematical notation (not LaTeX) and university-level concepts.

Return ONLY a JSON object:
{
  "title": "${topic} Quiz",
  "questions": [
    {
      "question": "Question with readable math like P(X=1) = 1/4?",
      "options": ["1/2", "1/4", "3/4", "1"],
      "correct": 1
    }
  ]
}`;
            } else {
                promptContent = `Create a 5-question multiple choice quiz about "${topic}". Use readable mathematical notation (like 1/2, P(X=1), etc.) instead of LaTeX.

Return ONLY a JSON object:
{
  "title": "${topic} Quiz",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0
    }
  ]
}`;
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
                        content: promptContent
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

    detectChapterRequest(topic) {
        const chapterKeywords = [
            'chapter', 'ch ', 'ch.', 'section', 'sec ', 'sec.',
            'basic concepts', 'sample space', 'probability axioms',
            'conditional probability', 'independence', 'bayes',
            'random variables', 'discrete', 'continuous',
            'expectation', 'variance', 'moment generating',
            'joint distributions', 'marginal', 'covariance',
            'limit theorems', 'central limit', 'law of large numbers',
            'markov chains', 'poisson process', 'brownian motion'
        ];
        
        const lowerTopic = topic.toLowerCase();
        return chapterKeywords.some(keyword => lowerTopic.includes(keyword));
    }

    extractChapterFromMessage(message) {
        const lowerMessage = message.toLowerCase();
        
        // Common chapter patterns
        const patterns = [
            /chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i,
            /ch\s*\.?\s*(\d+)/i,
            /(basic concepts?|sample space|probability axioms?)/i,
            /(conditional probability|independence|bayes)/i,
            /(random variables?|discrete|continuous)/i,
            /(expectation|variance|moment generating)/i,
            /(joint distributions?|marginal|covariance)/i,
            /(limit theorems?|central limit|law of large numbers)/i,
            /(markov chains?|poisson process|brownian motion)/i,
            /(pdf|cdf|probability density|cumulative)/i,
            /(pmf|joint pmf|marginal)/i,
            /(set theory|venn diagram|intersection|union)/i
        ];
        
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[0];
            }
        }
        
        return null;
    }
}

// Initialize quiz integration
const quizIntegration = new QuizIntegration();