# Chapter-Specific Quiz Feature

## Overview
The quiz system now supports creating quizzes based on specific chapters from probabilitycourse.com. When users mention chapter names in their quiz requests, the system will generate targeted quizzes focusing on that chapter's content.

## How It Works

### 1. Automatic Chapter Detection
The system automatically detects chapter-related keywords in user messages:
- Chapter numbers: "Chapter 1", "Ch 2", "Ch. 3"
- Topic names: "Basic Concepts", "Conditional Probability", "Random Variables"
- Specific concepts: "Bayes Rule", "Central Limit Theorem", "Independence"

### 2. Quiz Generation Methods
1. **Sample Quizzes**: Pre-built quizzes for common chapters (immediate response)
2. **AI Generation**: Custom quizzes generated via Gemini API for specific topics

### 3. User Interaction Methods

#### Via Chat Commands
Users can type any of these in the chat:
- "Create a quiz on Chapter 1"
- "I want a quiz about conditional probability"
- "Test me on Bayes Rule"
- "Quiz me on basic concepts"

#### Via Quiz Button Menu
- Click the 🧠 Quiz button
- Select "✨ Create Custom Quiz (Chapter-specific)"
- Enter chapter name or topic

#### Via Direct Function Calls
```javascript
// Start a chapter-specific quiz
startQuiz('Chapter 1');
startQuiz('conditional probability');
startQuiz('bayes rule');
```

## Available Sample Quizzes
- **Chapter 1**: Basic Concepts, Sample Space, Probability Axioms
- **Conditional Probability**: P(A|B), Independence, Bayes' Theorem
- **General Probability**: Basic probability calculations
- **Statistics**: Central tendency, distributions, hypothesis testing

## Technical Implementation

### Key Files Modified
1. `quiz-integration.js`: Enhanced with chapter detection and AI generation
2. `quiz-system.js`: Added sample chapter-specific quizzes
3. `tutor-chat.js`: Integrated quiz command handling
4. `quiz-demo.html`: Added test functionality

### Chapter Detection Logic
```javascript
detectChapterRequest(topic) {
    const chapterKeywords = [
        'chapter', 'basic concepts', 'conditional probability',
        'random variables', 'bayes', 'independence', 
        'central limit', 'expectation', 'variance'
    ];
    return chapterKeywords.some(keyword => 
        topic.toLowerCase().includes(keyword)
    );
}
```

### AI Prompt Enhancement
For chapter-specific requests, the system uses enhanced prompts:
```
"Create a 5-question multiple choice quiz specifically about 
'[CHAPTER NAME]' from probabilitycourse.com. Focus on the key 
concepts, formulas, and examples typically covered in this 
chapter from probability theory textbooks and the 
probabilitycourse.com website."
```

## Testing
1. Open `tutor.html` or `quiz-demo.html`
2. Try these test commands:
   - "Quiz me on Chapter 1"
   - "Create a quiz about conditional probability"
   - "Test me on Bayes Rule"
3. Use the quiz button menu for interactive selection

## Future Enhancements
- More pre-built chapter quizzes
- Integration with actual probabilitycourse.com content scraping
- Difficulty level selection
- Progress tracking across chapters
- Adaptive questioning based on performance