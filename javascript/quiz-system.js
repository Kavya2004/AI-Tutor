class QuizSystem {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.timeStarted = null;
        this.init();
    }

    init() {
        this.createQuizModal();
        this.bindEvents();
    }

    createQuizModal() {
        const modalHTML = `
            <div id="quizModal" class="quiz-modal">
                <div class="quiz-container">
                    <button class="quiz-close" onclick="quizSystem.closeQuiz()">&times;</button>
                    <div class="quiz-header">
                        <h2 class="quiz-title" id="quizTitle">Quiz</h2>
                        <div class="quiz-progress">
                            <div class="quiz-progress-bar" id="progressBar"></div>
                        </div>
                    </div>
                    <div class="quiz-content" id="quizContent">
                        <!-- Quiz content will be dynamically inserted here -->
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {
        // Close modal when clicking outside
        document.getElementById('quizModal').addEventListener('click', (e) => {
            if (e.target.id === 'quizModal') {
                this.closeQuiz();
            }
        });
    }

    startQuiz(quizData) {
        this.currentQuiz = quizData;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
        this.timeStarted = new Date();
        
        document.getElementById('quizTitle').textContent = quizData.title;
        document.getElementById('quizModal').style.display = 'block';
        
        this.showQuestion();
    }

    showQuestion() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;
        
        document.getElementById('progressBar').style.width = progress + '%';
        
        const questionHTML = `
            <div class="question-container">
                <div class="question-number">
                    Question ${this.currentQuestionIndex + 1} of ${this.currentQuiz.questions.length}
                </div>
                <div class="question-text">${question.question}</div>
                <div class="options-container" id="optionsContainer">
                    ${question.options.map((option, index) => `
                        <div class="option" data-index="${index}" onclick="quizSystem.selectOption(${index})">
                            ${option}
                        </div>
                    `).join('')}
                </div>
                <div class="quiz-controls">
                    <button class="quiz-btn quiz-btn-secondary" onclick="quizSystem.previousQuestion()" 
                            ${this.currentQuestionIndex === 0 ? 'style="visibility: hidden;"' : ''}>
                        Previous
                    </button>
                    <button class="quiz-btn quiz-btn-primary" id="nextBtn" onclick="quizSystem.nextQuestion()" disabled>
                        ${this.currentQuestionIndex === this.currentQuiz.questions.length - 1 ? 'Finish Quiz' : 'Next'}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quizContent').innerHTML = questionHTML;
        
        // Restore previous answer if exists
        if (this.userAnswers[this.currentQuestionIndex] !== undefined) {
            this.selectOption(this.userAnswers[this.currentQuestionIndex], false);
        }
    }

    selectOption(optionIndex, animate = true) {
        // Clear previous selections
        document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        
        // Select new option
        const selectedOption = document.querySelector(`[data-index="${optionIndex}"]`);
        selectedOption.classList.add('selected');
        
        if (animate) {
            selectedOption.style.transform = 'scale(0.98)';
            setTimeout(() => {
                selectedOption.style.transform = 'scale(1)';
            }, 100);
        }
        
        // Store answer
        this.userAnswers[this.currentQuestionIndex] = optionIndex;
        
        // Enable next button
        document.getElementById('nextBtn').disabled = false;
    }

    nextQuestion() {
        if (this.userAnswers[this.currentQuestionIndex] === undefined) return;
        
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.showQuestion();
        } else {
            this.finishQuiz();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.showQuestion();
        }
    }

    finishQuiz() {
        this.calculateScore();
        this.showResults();
    }

    calculateScore() {
        this.score = 0;
        this.userAnswers.forEach((answer, index) => {
            if (answer === this.currentQuiz.questions[index].correct) {
                this.score++;
            }
        });
    }

    showResults() {
        const percentage = Math.round((this.score / this.currentQuiz.questions.length) * 100);
        const timeElapsed = Math.round((new Date() - this.timeStarted) / 1000);
        
        let message = '';
        if (percentage >= 90) message = 'Excellent work! 🎉';
        else if (percentage >= 70) message = 'Good job! 👍';
        else if (percentage >= 50) message = 'Not bad, keep practicing! 📚';
        else message = 'Keep studying, you\'ll get there! 💪';
        
        const resultsHTML = `
            <div class="quiz-results">
                <div class="score-display">${percentage}%</div>
                <div class="score-message">${message}</div>
                <div class="results-breakdown">
                    <div class="breakdown-item">
                        <span>Correct Answers:</span>
                        <span>${this.score} / ${this.currentQuiz.questions.length}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Time Taken:</span>
                        <span>${Math.floor(timeElapsed / 60)}:${(timeElapsed % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div class="breakdown-item">
                        <span>Accuracy:</span>
                        <span>${percentage}%</span>
                    </div>
                </div>
                <div class="quiz-controls">
                    <button class="quiz-btn quiz-btn-secondary" onclick="quizSystem.reviewAnswers()">
                        Review Answers
                    </button>
                    <button class="quiz-btn quiz-btn-primary" onclick="quizSystem.closeQuiz()">
                        Close Quiz
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quizContent').innerHTML = resultsHTML;
        document.getElementById('progressBar').style.width = '100%';
    }

    reviewAnswers() {
        this.currentQuestionIndex = 0;
        this.showReview();
    }

    showReview() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const userAnswer = this.userAnswers[this.currentQuestionIndex];
        const correctAnswer = question.correct;
        
        const reviewHTML = `
            <div class="question-container">
                <div class="question-number">
                    Review ${this.currentQuestionIndex + 1} of ${this.currentQuiz.questions.length}
                </div>
                <div class="question-text">${question.question}</div>
                <div class="options-container">
                    ${question.options.map((option, index) => {
                        let className = 'option';
                        if (index === correctAnswer) className += ' correct';
                        else if (index === userAnswer && index !== correctAnswer) className += ' incorrect';
                        return `<div class="${className}">${option}</div>`;
                    }).join('')}
                </div>
                <div class="quiz-controls">
                    <button class="quiz-btn quiz-btn-secondary" onclick="quizSystem.previousReview()" 
                            ${this.currentQuestionIndex === 0 ? 'style="visibility: hidden;"' : ''}>
                        Previous
                    </button>
                    <button class="quiz-btn quiz-btn-primary" onclick="quizSystem.nextReview()">
                        ${this.currentQuestionIndex === this.currentQuiz.questions.length - 1 ? 'Back to Results' : 'Next'}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('quizContent').innerHTML = reviewHTML;
    }

    nextReview() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.showReview();
        } else {
            this.showResults();
        }
    }

    previousReview() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.showReview();
        }
    }

    closeQuiz() {
        document.getElementById('quizModal').style.display = 'none';
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.score = 0;
    }
}

// Sample quiz data - removed default quizzes, keeping only custom quiz structure
const sampleQuizzes = {};

// Initialize quiz system
const quizSystem = new QuizSystem();

// Make functions and data globally available
window.startQuiz = startQuiz;
window.getChapterKey = getChapterKey;
window.sampleQuizzes = sampleQuizzes;

// Function to start a quiz (can be called from chat or buttons)
function startQuiz(quizType) {
    // Check for chapter-specific quizzes first
    const chapterKey = getChapterKey(quizType);
    if (sampleQuizzes[chapterKey]) {
        quizSystem.startQuiz(sampleQuizzes[chapterKey]);
        return;
    }
    
    if (sampleQuizzes[quizType]) {
        quizSystem.startQuiz(sampleQuizzes[quizType]);
    }
}

// Helper function to map chapter names to quiz keys
function getChapterKey(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('chapter 1') || lowerInput.includes('basic concept')) {
        return 'chapter1';
    }
    if (lowerInput.includes('conditional') || lowerInput.includes('bayes')) {
        return 'conditional';
    }
    
    return input.toLowerCase();
}