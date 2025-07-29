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

	initializeFileUpload();

	addMessage("Hi there! I'm your probability tutor! Ask me anything about probability and statistics!", 'bot');

	voiceEnabled = localStorage.getItem('autoSpeech') !== 'false';

	setTimeout(createVoiceToggle, 1500);
}
let uploadedFiles = [];

function initializeFileUpload() {
	const uploadButton = document.getElementById('uploadButton');
	const fileInput = document.getElementById('fileInput');

	if (uploadButton && fileInput) {
		uploadButton.addEventListener('click', () => fileInput.click());
		fileInput.addEventListener('change', handleFileSelect);
	}
}
async function getGeminiResponse(messages) {
	try {
	  // Use your Vercel API endpoint instead of direct Gemini call
	  const response = await fetch('/api/gemini', {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		},
		body: JSON.stringify({ messages })
	  });
  
	  if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
	  }
  
	  const data = await response.json();
	  return data.response || 'No response received from Gemini.';
  
	} catch (error) {
	  console.error('Error calling Gemini API:', error);
	  
	  // Provide user-friendly error messages
	  if (error.message.includes('fetch')) {
		throw new Error('Unable to connect to the AI service. Please check your internet connection.');
	  } else if (error.message.includes('429')) {
		throw new Error('Too many requests. Please wait a moment and try again.');
	  } else if (error.message.includes('401')) {
		throw new Error('API authentication failed. Please check your configuration.');
	  } else {
		throw new Error('AI service is temporarily unavailable. Please try again.');
	  }
	}
  }

function handleFileSelect(event) {
	const files = Array.from(event.target.files);

	files.forEach((file) => {
		if (isValidFileType(file)) {
			uploadedFiles.push(file);
			addFileToPreview(file);
		} else {
			addMessage(
				`File type "${file.type}" is not supported. Please upload PDF, PNG, JPG, or other image files.`,
				'bot'
			);
		}
	});

	event.target.value = '';
}

function isValidFileType(file) {
	const validTypes = [
		'application/pdf',
		'image/png',
		'image/jpeg',
		'image/jpg',
		'image/gif',
		'image/bmp',
		'image/tiff',
		'image/webp'
	];
	return validTypes.includes(file.type);
}

function addFileToPreview(file) {
	const filePreview = document.getElementById('filePreview');
	const fileItem = document.createElement('div');
	fileItem.className = 'file-item';
	fileItem.dataset.fileName = file.name;

	const fileIcon = getFileIcon(file.type);
	const fileName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;

	fileItem.innerHTML = `
        <span class="file-icon">${fileIcon}</span>
        <span class="file-name" title="${file.name}">${fileName}</span>
        <button class="remove-file" onclick="removeFile('${file.name}')">×</button>
    `;

	filePreview.appendChild(fileItem);
}

function getFileIcon(fileType) {
	if (fileType === 'application/pdf') return '📄';
	if (fileType.startsWith('image/')) return '🖼️';
	return '📎';
}

function removeFile(fileName) {
	uploadedFiles = uploadedFiles.filter((file) => file.name !== fileName);
	const fileItem = document.querySelector(`.file-item[data-file-name="${fileName}"]`);
	if (fileItem) {
		fileItem.remove();
	}
}

async function processFilesForTutor(files) {
	const processedFiles = [];

	for (const file of files) {
		try {
			if (file.type === 'application/pdf') {
				const base64 = await fileToBase64(file);
				processedFiles.push({
					name: file.name,
					type: 'pdf',
					content: `PDF file uploaded: ${file.name}. Please describe what you'd like me to help you with from this document.`
				});
			} else if (file.type.startsWith('image/')) {
				const base64 = await fileToBase64(file);
				const ocrText = await getOcrFromImage(base64);
				processedFiles.push({
					name: file.name,
					type: 'image',
					content:
						ocrText ||
						`Image uploaded: ${file.name}. No text was detected, but I can help explain any probability concepts you see in the image.`
				});
			}
		} catch (error) {
			console.error('Error processing file:', file.name, error);
			processedFiles.push({
				name: file.name,
				type: 'error',
				content: `Error processing ${file.name}. Please try uploading the file again.`
			});
		}
	}

	return processedFiles;
}

function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

async function getOcrFromImage(base64Image) {
	try {
		// UPDATE THIS URL to match your Render deployment:
		const response = await fetch('https://ai-tutor-53f1.onrender.com/api/ocr', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ image: base64Image })
		});

		if (!response.ok) throw new Error('OCR request failed');

		const data = await response.json();

		if (data.text && data.text.trim()) {
			return data.text;
		} else if (data.data?.value?.length > 0) {
			return data.data.value.map((entry) => entry.value).join(' ');
		} else {
			return 'No recognizable text found in image.';
		}
	} catch (error) {
		console.error('OCR Error:', error);
		return 'Error reading image text.';
	}
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

	if ((message || uploadedFiles.length > 0) && !isProcessing) {
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

	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.broadcastMessage(text, sender);
	}

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

	if (!voiceEnabled && window.voiceTutor) {
		window.voiceTutor.stopSpeaking();
	}
}

async function getOcrTextFromWhiteboardImage(board) {
	try {
		const canvas = document.getElementById(`${board}-whiteboard-canvas`);
		if (!canvas) {
			console.warn(`Canvas not found for ${board} board.`);
			return null;
		}

		const base64Image = canvas.toDataURL('image/png');
		const text = await getOcrFromImage(base64Image);
		return text;
	} catch (err) {
		console.error(`[Whiteboard OCR] Failed for ${board} board:`, err);
		return null;
	}
}

async function processUserMessage(message) {
	if (isProcessing || (!message.trim() && uploadedFiles.length === 0)) return;

	isProcessing = true;

	// Process uploaded files if any
	let processedFiles = [];
	if (uploadedFiles.length > 0) {
		processedFiles = await processFilesForTutor(uploadedFiles);
		// Clear uploaded files after processing
		uploadedFiles = [];
		document.getElementById('filePreview').innerHTML = '';
	}

	// Add user message (include file info if files were uploaded)
	let userMessage = message.trim();
	if (processedFiles.length > 0) {
		const fileNames = processedFiles.map((f) => f.name).join(', ');
		userMessage = userMessage || `I've uploaded these files: ${fileNames}`;

		// ADD THIS: Only add message locally if not in session (session will handle broadcasting)
		if (!window.sessionManager || !window.sessionManager.sessionId) {
			addMessage(userMessage, 'user');
		}

		// Add file contents to context
		processedFiles.forEach((file) => {
			context.push({
				role: 'user',
				content: `File: ${file.name}\nContent: ${file.content}`
			});
		});
	} else if (userMessage) {
		// ADD THIS: Only add message locally if not in session
		if (!window.sessionManager || !window.sessionManager.sessionId) {
			addMessage(userMessage, 'user');
		}
	}

	// ADD THIS: If in session, broadcast the user message
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.broadcastMessage(userMessage, 'user');
	} else {
		// Only add message locally if not already added above
		if (!processedFiles.length && userMessage) {
			addMessage(userMessage, 'user');
		}
	}

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
			ocrText = await getOcrTextFromWhiteboardImage(boardToCheck);
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

		let botResponse = await getGeminiResponse(context);

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

		// ADD THIS: Handle bot response for sessions
		if (window.sessionManager && window.sessionManager.sessionId) {
			// In session mode, broadcast bot response
			window.sessionManager.broadcastMessage(botResponse, 'bot');
		} else {
			// Not in session, add message locally
			addMessage(botResponse, 'bot');
		}

		if (whiteboardAction && targetBoard && window.tutorWhiteboard) {
			setTimeout(() => executeWhiteboardAction(whiteboardAction, targetBoard), 500);
		}
	} catch (error) {
		console.error('Error processing message:', error);
		let errorMessage = 'I apologize, but I encountered an issue. ';
		if (error.message.includes('fetch')) {
			errorMessage += "Unable to connect to the AI server. Please make sure it's running.";
		} else {
			errorMessage += 'Please try again or check your server logs.';
		}

		// ADD THIS: Handle error messages for sessions
		if (window.sessionManager && window.sessionManager.sessionId) {
			window.sessionManager.broadcastMessage(errorMessage, 'bot');
		} else {
			addMessage(errorMessage, 'bot');
		}
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

	// ADD THIS: Broadcast whiteboard action to session
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(
			JSON.stringify({
				type: 'whiteboard_action',
				action: actionType,
				targetBoard: targetBoard,
				userName: window.sessionManager.userName
			})
		);
	}

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
