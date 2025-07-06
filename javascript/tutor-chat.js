let isProcessing = false;
let context = [
	{
		role: 'system',
		content: `You are a friendly probability and statistics tutor with access to two whiteboards:
1. TEACHER WHITEBOARD - Use this to demonstrate concepts, draw examples, show solutions
2. STUDENT WHITEBOARD - Use this for student practice, exercises, or when asking students to work

Instructions:
- Respond naturally but BRIEFLY to the student's question
- If you need to draw/demonstrate concepts, add [TEACHER_BOARD: action_name]
- If you want the student to practice/work, add [STUDENT_BOARD: action_name]
- Available actions: probability_scale, distribution, normal_curve, tree_diagram, clear_board`
	}
];

let voiceEnabled = true;

document.addEventListener('DOMContentLoaded', function () {
	initializeChat();
});

function initializeChat() {
	window.processUserMessage = processUserMessage;
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
	
	if (isProcessing || !message.trim()) return;

	isProcessing = true;
	addMessage(message, 'user');
	showLoading();

	try {
		let boardToCheck = null;
		if (/student board|student whiteboard/i.test(message)) {
			boardToCheck = 'student';
		} else if (/teacher board|teacher whiteboard/i.test(message)) {
			boardToCheck = 'teacher';
		}

		let ocrText = null;
		if (boardToCheck) {
			ocrText = await getOcrTextFromWhiteboardWithLlava(boardToCheck);
			console.log(`[DEBUG] OCR result from ${boardToCheck} board:`, ocrText);

			const latestOcrSummary = ocrText
				? `The ${boardToCheck} whiteboard contains: "${ocrText}"`
				: `The ${boardToCheck} whiteboard is currently blank.`;

			context = context.filter(
				(entry) => !(entry.role === 'system' && entry.content.startsWith(`The ${boardToCheck} whiteboard`))
			);

			context.splice(1, 0, {
				role: 'system',
				content: latestOcrSummary
			});
		}

		context.push({ role: 'user', content: message });

		const response = await fetch('http://localhost:11434/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'llama3',
				messages: context,
				temperature: 0.7,
				max_tokens: 200,
				stream: false
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Server error: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		console.log('Received response:', data);

		let botResponse = data.message?.content?.trim() || '';
		if (!botResponse || botResponse.length < 5) {
			botResponse = `I understand you're asking about "${message}". Let me help explain this probability concept! Could you be more specific about what aspect you'd like me to demonstrate?`;
		}

		context.push({ role: 'assistant', content: botResponse });

		const maxContextMessages = 18;
		if (context.length > maxContextMessages) {
			context = [context[0], ...context.slice(-(maxContextMessages - 1))];
		}

		let whiteboardAction = null;
		let targetBoard = null;
		const teacherMatch = botResponse.match(/\[TEACHER_BOARD:\s*(\w+)\]/);
		const studentMatch = botResponse.match(/\[STUDENT_BOARD:\s*(\w+)\]/);

		if (teacherMatch) {
			whiteboardAction = teacherMatch[1];
			targetBoard = 'teacher';
			botResponse = botResponse.replace(/\[TEACHER_BOARD:\s*\w+\]/, '').trim();
			botResponse += '\n\n[Drawing on teacher whiteboard...]';
		} else if (studentMatch) {
			whiteboardAction = studentMatch[1];
			targetBoard = 'student';
			botResponse = botResponse.replace(/\[STUDENT_BOARD:\s*\w+\]/, '').trim();
			botResponse += '\n\n[Setting up student whiteboard...]';
		}

		addMessage(botResponse, 'bot');

		if (whiteboardAction && targetBoard && window.tutorWhiteboard) {
			setTimeout(() => executeWhiteboardAction(whiteboardAction, targetBoard), 500);
		}
	} catch (error) {
		console.error('Error processing message:', error);
		let errorMessage = 'I apologize, but I encountered an issue. ';
		if (error.message.includes('fetch')) {
			errorMessage += 'Unable to connect to the AI server. Please make sure it’s running.';
		} else {
			errorMessage += 'Please try again or check your server logs.';
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

	if (window.switchWhiteboard) {
		window.switchWhiteboard(targetBoard);
	}

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
