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

// Sample quiz data
const sampleQuizzes = {
    probability: {
        title: "Probability Basics",
        questions: [
            {
                question: "What is the probability of getting heads when flipping a fair coin?",
                options: ["0.25", "0.5", "0.75", "1.0"],
                correct: 1
            },
            {
                question: "If you roll a standard die, what's the probability of getting an even number?",
                options: ["1/6", "2/6", "3/6", "4/6"],
                correct: 2
            },
            {
                question: "What is the sum of all probabilities in a probability distribution?",
                options: ["0", "0.5", "1", "Depends on the distribution"],
                correct: 2
            }
        ]
    },
    statistics: {
        title: "Statistics Fundamentals",
        questions: [
            {
                question: "What measure of central tendency is most affected by outliers?",
                options: ["Mean", "Median", "Mode", "Range"],
                correct: 0
            },
            {
                question: "In a normal distribution, what percentage of data falls within one standard deviation?",
                options: ["68%", "95%", "99.7%", "50%"],
                correct: 0
            },
            {
                question: "What does a p-value represent in hypothesis testing?",
                options: [
                    "The probability the null hypothesis is true",
                    "The probability of observing the data given the null hypothesis is true",
                    "The probability the alternative hypothesis is true",
                    "The confidence level"
                ],
                correct: 1
            }
        ]
    },
    'chapter1': {
        title: "Chapter 1: Basic Concepts",
        questions: [
            {
                question: "What is a sample space in probability theory?",
                options: [
                    "The set of all possible outcomes of an experiment",
                    "A subset of outcomes we're interested in",
                    "The probability of an event occurring",
                    "The number of trials in an experiment"
                ],
                correct: 0
            },
            {
                question: "Which of the following is NOT a probability axiom?",
                options: [
                    "P(A) ≥ 0 for any event A",
                    "P(S) = 1 where S is the sample space",
                    "P(A ∪ B) = P(A) + P(B) for disjoint events",
                    "P(A) = 1 - P(A') where A' is the complement of A"
                ],
                correct: 3
            },
            {
                question: "In a Venn diagram, what does the intersection of two circles represent?",
                options: [
                    "Events that cannot occur together",
                    "Events that occur together",
                    "The union of two events",
                    "The complement of an event"
                ],
                correct: 1
            }
        ]
    },
    'conditional': {
        title: "Conditional Probability",
        questions: [
            {
                question: "What does P(A|B) represent?",
                options: [
                    "The probability of A and B occurring together",
                    "The probability of A given that B has occurred",
                    "The probability of A or B occurring",
                    "The probability of A occurring before B"
                ],
                correct: 1
            },
            {
                question: "When are two events A and B independent?",
                options: [
                    "When P(A|B) = P(A)",
                    "When P(A ∩ B) = 0",
                    "When P(A ∪ B) = P(A) + P(B)",
                    "When A and B cannot occur together"
                ],
                correct: 0
            },
            {
                question: "Bayes' theorem is used to find:",
                options: [
                    "P(A ∩ B) from P(A) and P(B)",
                    "P(A|B) from P(B|A), P(A), and P(B)",
                    "P(A ∪ B) from P(A) and P(B)",
                    "The independence of two events"
                ],
                correct: 1
            }
        ]
    }
};

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