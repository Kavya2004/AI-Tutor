let isProcessing = false;
let context = [];
let voiceEnabled = true;

document.addEventListener('DOMContentLoaded', function () {
	initializeChat();
});

function initializeChat() {
	const sendButton = document.getElementById('sendButton');
	const chatInput = document.getElementById('chatInput');

	if (sendButton) {
		sendButton.addEventListener('click', handleSendMessage);
	}

	if (chatInput) {
		chatInput.addEventListener('keypress', handleKeyPress);
	}

	addMessage("Hi there! I'm your probability tutor! Ask me anything about probability and statistics!", 'bot');
	

	voiceEnabled = localStorage.getItem('autoSpeech') !== 'false';
	
	setTimeout(createVoiceToggle, 1500); 
}

function createVoiceToggle() {
	const chatHeader = document.querySelector('.chat-header') || document.querySelector('h2');
	if (!chatHeader || document.getElementById('voiceToggle')) return;

	const toggleBtn = document.createElement('button');
	toggleBtn.id = 'voiceToggle';
	toggleBtn.innerHTML = voiceEnabled ? '🔊 Voice On' : '🔇 Voice Off';
	toggleBtn.style.cssText = `
		padding: 5px 10px;
		margin-left: 10px;
		border: 1px solid #ccc;
		border-radius: 15px;
		background: ${voiceEnabled ? '#337810' : '#666'};
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.3s ease;
	`;
	toggleBtn.addEventListener('click', toggleVoiceResponse);
	
	chatHeader.appendChild(toggleBtn);
}

function handleKeyPress(event) {
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		handleSendMessage();
	}
}

function handleSendMessage() {
	const input = document.getElementById('chatInput');
	const message = input.value.trim();
	if (message && !isProcessing) {
		processUserMessage(message);
		input.value = '';
	}
}

function addMessage(text, sender) {
	const chatMessages = document.getElementById('chatMessages');
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${sender}-message slide-in`;

	// Create message structure
	const avatar = document.createElement('div');
	avatar.className = 'message-avatar';
	avatar.innerHTML = sender === 'bot' ? '🤖' : '👤';

	const content = document.createElement('div');
	content.className = 'message-content';
	content.innerHTML = text.replace(/\n/g, '<br>');

	messageDiv.appendChild(avatar);
	messageDiv.appendChild(content);
	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;

	// ADD THIS: Trigger voice response for bot messages
	if (sender === 'bot' && window.voiceTutor && voiceEnabled) {
		window.voiceTutor.handleBotResponse(text);
	}
}

function showLoading() {
	const loadingIndicator = document.getElementById('loadingIndicator');
	if (loadingIndicator) {
		loadingIndicator.style.display = 'flex';
	}
}

function hideLoading() {
	const loadingIndicator = document.getElementById('loadingIndicator');
	if (loadingIndicator) {
		loadingIndicator.style.display = 'none';
	}
}
function toggleVoiceResponse() {
    voiceEnabled = !voiceEnabled;
    localStorage.setItem('autoSpeech', voiceEnabled.toString());
    
    const toggleBtn = document.getElementById('voiceToggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = voiceEnabled ? '🎤' : '🔇';
        toggleBtn.title = voiceEnabled ? 'Voice On - Click to disable' : 'Voice Off - Click to enable';
        toggleBtn.style.background = voiceEnabled ? '#337810' : '#666';
        toggleBtn.style.borderColor = voiceEnabled ? '#337810' : '#666';
    }
    
    // Stop current speech if disabling
    if (!voiceEnabled && window.voiceTutor) {
        window.voiceTutor.stopSpeaking();
    }
}

async function processUserMessage(message) {
	window.processUserMessage = processUserMessage;
	if (isProcessing || !message.trim()) return;

	isProcessing = true;
	addMessage(message, 'user');
	showLoading();

	try {
		// Enhanced tutor prompt with whiteboard decision making
		const tutorPrompt = `You are a friendly probability and statistics tutor. 

		IMPORTANT: Only provide probability/statistics help when the question is actually about probability or statistics topics. For other subjects (like basic math, general questions), give a brief, helpful answer and gently redirect to probability topics.
		
		For probability/statistics questions, you have access to two whiteboards:
		1. TEACHER WHITEBOARD - Use this to demonstrate concepts, draw examples, show solutions
		2. STUDENT WHITEBOARD - Use this for student practice, exercises, or when asking students to work
		
		Instructions for probability/statistics questions:
		- Respond naturally to the student's question
		- If you need to draw/demonstrate concepts, add [TEACHER_BOARD: action_name] 
		- If you want the student to practice/work, add [STUDENT_BOARD: action_name]
		- Available actions: probability_scale, distribution, normal_curve, tree_diagram, clear_board
		
		For non-probability questions:
		- Answer briefly and helpfully
		- Gently suggest exploring probability topics instead
		
		Student Question: ${message}
		
		Determine if this is a probability/statistics question first, then respond appropriately.`;
		console.log('Sending request to server...');

		const response = await fetch('http://localhost:8000/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'tinyllama',
				messages: [
					{
						role: 'system',
						content: 'You are a friendly probability and statistics tutor with dual whiteboard capabilities. Be helpful and educational.'
					},
					{ role: 'user', content: tutorPrompt }
				],
				temperature: 0.7,
				max_tokens: 200
			})
		});

		console.log('Response status:', response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Server error response:', errorText);
			throw new Error(`Server error: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		console.log('Received data:', data);

		let botResponse = '';
		if (data.choices && data.choices[0] && data.choices[0].message) {
			botResponse = data.choices[0].message.content.trim();
		} else {
			console.error('Invalid response structure:', data);
			throw new Error('Invalid response format from server');
		}

		// Better fallback response
		if (!botResponse || botResponse.length < 5) {
			botResponse = `I understand you're asking about "${message}". Let me help explain this probability concept! Could you be more specific about what aspect you'd like me to demonstrate?`;
		}

		// Add to context for next interaction (keep last 4 messages)
		context.push({ role: 'user', content: message });
		context.push({ role: 'assistant', content: botResponse });
		if (context.length > 8) {
			context = context.slice(-8);
		}

		// Parse whiteboard actions
		let whiteboardAction = null;
		let targetBoard = null;

		// Check for teacher board actions
		const teacherMatch = botResponse.match(/\[TEACHER_BOARD:\s*(\w+)\]/);
		if (teacherMatch) {
			whiteboardAction = teacherMatch[1];
			targetBoard = 'teacher';
			botResponse = botResponse.replace(/\[TEACHER_BOARD:\s*\w+\]/, '').trim();
			botResponse += '\n\n[Drawing on teacher whiteboard...]';
		}

		// Check for student board actions
		const studentMatch = botResponse.match(/\[STUDENT_BOARD:\s*(\w+)\]/);
		if (studentMatch) {
			whiteboardAction = studentMatch[1];
			targetBoard = 'student';
			botResponse = botResponse.replace(/\[STUDENT_BOARD:\s*\w+\]/, '').trim();
			botResponse += '\n\n[Setting up student whiteboard...]';
		}

		// Auto-suggest whiteboard actions based on keywords if not explicitly specified
		if (!whiteboardAction) {
			const lowerMessage = message.toLowerCase();
			if (lowerMessage.includes('show me') || lowerMessage.includes('demonstrate') || lowerMessage.includes('example')) {
				targetBoard = 'teacher';
				if (lowerMessage.includes('probability scale') || lowerMessage.includes('scale')) {
					whiteboardAction = 'probability_scale';
					botResponse += '\n\n[Demonstrating on teacher whiteboard...]';
				} else if (lowerMessage.includes('distribution') || lowerMessage.includes('histogram')) {
					whiteboardAction = 'distribution';
					botResponse += '\n\n[Drawing distribution on teacher whiteboard...]';
				} else if (lowerMessage.includes('normal') || lowerMessage.includes('bell curve')) {
					whiteboardAction = 'normal_curve';
					botResponse += '\n\n[Drawing normal curve on teacher whiteboard...]';
				} else if (lowerMessage.includes('tree') || lowerMessage.includes('conditional')) {
					whiteboardAction = 'tree_diagram';
					botResponse += '\n\n[Drawing tree diagram on teacher whiteboard...]';
				}
			} else if (lowerMessage.includes('practice') || lowerMessage.includes('try') || lowerMessage.includes('your turn')) {
				targetBoard = 'student';
				botResponse += '\n\n[Student practice area ready...]';
			}
		}

		addMessage(botResponse, 'bot');

		// Execute whiteboard action if available
		if (whiteboardAction && targetBoard && window.tutorWhiteboard) {
			setTimeout(() => executeWhiteboardAction(whiteboardAction, targetBoard), 500);
		}

	} catch (error) {
		console.error('Error processing message:', error);
		let errorMessage = 'I apologize, but I encountered an issue. ';

		if (error.name === 'AbortError') {
			errorMessage += 'The request took too long to process. Please try asking a shorter or simpler question.';
		} else if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
			errorMessage += 'I cannot connect to the AI server. Please make sure the server is running on localhost:8000 and try again.';
		} else if (error.message.includes('Server error')) {
			errorMessage += 'The AI server encountered an error. Please check the server logs and try again.';
		} else {
			errorMessage += 'Please try rephrasing your question or check if the server is running properly.';
		}

		addMessage(errorMessage, 'bot');
	}

	hideLoading();
	isProcessing = false;
}

function executeWhiteboardAction(actionType, targetBoard) {
	if (!window.tutorWhiteboard) {
		console.log('Whiteboard not available');
		return;
	}

	console.log(`Executing ${actionType} on ${targetBoard} whiteboard`);

	// Switch to the target whiteboard first
	if (window.switchWhiteboard) {
		window.switchWhiteboard(targetBoard);
	}

	// Execute the action on the appropriate whiteboard
	switch (actionType) {
		case 'probability_scale':
			if (window.tutorWhiteboard.drawProbabilityScale) {
				window.tutorWhiteboard.drawProbabilityScale(targetBoard);
			}
			break;
		case 'distribution':
			if (window.tutorWhiteboard.drawSampleDistribution) {
				window.tutorWhiteboard.drawSampleDistribution(targetBoard);
			}
			break;
		case 'normal_curve':
			if (window.tutorWhiteboard.drawNormalCurve) {
				window.tutorWhiteboard.drawNormalCurve(targetBoard);
			}
			break;
		case 'tree_diagram':
			if (window.tutorWhiteboard.drawTreeDiagram) {
				window.tutorWhiteboard.drawTreeDiagram(targetBoard);
			}
			break;
		case 'clear_board':
			if (window.tutorWhiteboard.clearWhiteboard) {
				window.tutorWhiteboard.clearWhiteboard(targetBoard);
			}
			break;
		default:
			console.log('Unknown whiteboard action:', actionType);
	}
}

function handleDiceResult(result) {
	const message = `I rolled a ${result}! What does this tell us about probability?`;
	processUserMessage(message);
}