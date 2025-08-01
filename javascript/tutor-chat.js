let isProcessing = false;
let context = [
	{
		role: 'system',
		content: `You are a friendly probability and statistics tutor with AI diagram generation capabilities.

Instructions:
- Respond naturally but BRIEFLY to the student's question
- For ANY mathematical diagram, use [GENERATE_DIAGRAM: description] - this will create the actual visual
- Examples: [GENERATE_DIAGRAM: parabola y = x²], [GENERATE_DIAGRAM: normal distribution curve], [GENERATE_DIAGRAM: sine wave from 0 to 2π]
- The AI will automatically draw the diagram on the teacher whiteboard
- Do NOT use old commands like [TEACHER_BOARD:] - always use [GENERATE_DIAGRAM:] for visuals`
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
	const filePreview = document.getElementById('filePreview');

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

	// Show file preview container if files are uploaded
	if (uploadedFiles.length > 0) {
		filePreview.style.display = 'flex';
	}

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
        <span class="file-name" title="${file.name}" onclick="viewFile('${file.name}')" style="cursor: pointer; color: #007bff;">${fileName}</span>
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
	
	// Hide file preview container if no files remain
	const filePreview = document.getElementById('filePreview');
	if (uploadedFiles.length === 0) {
		filePreview.style.display = 'none';
	}
}

function viewFile(fileName) {
	const file = uploadedFiles.find(f => f.name === fileName);
	if (!file) return;

	const modal = document.createElement('div');
	modal.className = 'file-viewer-modal';
	modal.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0,0,0,0.8);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
	`;

	const content = document.createElement('div');
	content.style.cssText = `
		background: white;
		border-radius: 8px;
		max-width: 90%;
		max-height: 90%;
		overflow: auto;
		position: relative;
	`;

	const closeBtn = document.createElement('button');
	closeBtn.innerHTML = '×';
	closeBtn.style.cssText = `
		position: absolute;
		top: 10px;
		right: 15px;
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		z-index: 1;
	`;
	closeBtn.onclick = () => modal.remove();

	if (file.type.startsWith('image/')) {
		const img = document.createElement('img');
		img.src = URL.createObjectURL(file);
		img.style.cssText = 'max-width: 100%; max-height: 100%; display: block;';
		content.appendChild(img);
	} else if (file.type === 'application/pdf') {
		const iframe = document.createElement('iframe');
		iframe.src = URL.createObjectURL(file);
		iframe.style.cssText = 'width: 80vw; height: 80vh; border: none;';
		content.appendChild(iframe);
	}

	content.appendChild(closeBtn);
	modal.appendChild(content);
	document.body.appendChild(modal);

	modal.onclick = (e) => {
		if (e.target === modal) modal.remove();
	};
}

async function processFilesForTutor(files) {
	const processedFiles = [];

	for (const file of files) {
		try {
			const base64 = await fileToBase64(file);
			if (file.type === 'application/pdf') {
				processedFiles.push({
					name: file.name,
					type: 'pdf',
					data: base64,
					content: `PDF file uploaded: ${file.name}. Please describe what you'd like me to help you with from this document.`
				});
			} else if (file.type.startsWith('image/')) {
				const ocrText = await getOcrFromImage(base64);
				processedFiles.push({
					name: file.name,
					type: file.type,
					data: base64,
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

function addMessage(text, sender, files = []) {
	const chatMessages = document.getElementById('chatMessages');
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${sender}-message slide-in`;

	const avatar = document.createElement('div');
	avatar.className = 'message-avatar';
	avatar.innerHTML = sender === 'bot' ? '🤖' : '👤';

	const content = document.createElement('div');
	content.className = 'message-content';
	content.innerHTML = text.replace(/\n/g, '<br>');

	if (files && files.length > 0) {
		const filesDiv = document.createElement('div');
		filesDiv.className = 'message-files';
		filesDiv.style.cssText = 'margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;';
		
		files.forEach(file => {
			const fileSpan = document.createElement('span');
			fileSpan.className = 'message-file';
			fileSpan.style.cssText = 'background: #e3f2fd; padding: 4px 8px; border-radius: 12px; font-size: 12px; cursor: pointer; color: #1976d2;';
			fileSpan.innerHTML = `${getFileIcon(file.type)} ${file.name}`;
			fileSpan.onclick = () => viewUploadedFile(file);
			filesDiv.appendChild(fileSpan);
		});
		
		content.appendChild(filesDiv);
	}

	messageDiv.appendChild(avatar);
	messageDiv.appendChild(content);
	chatMessages.appendChild(messageDiv);
	chatMessages.scrollTop = chatMessages.scrollHeight;

	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.broadcastMessage(text, sender, files);
	}

	if (sender === 'bot' && window.voiceTutor && voiceEnabled) {
		window.voiceTutor.handleBotResponse(text);
	}
}

function viewUploadedFile(file) {
	if (file.data) {
		const modal = document.createElement('div');
		modal.className = 'file-viewer-modal';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0,0,0,0.8);
			z-index: 10000;
			display: flex;
			align-items: center;
			justify-content: center;
		`;

		const content = document.createElement('div');
		content.style.cssText = `
			background: white;
			border-radius: 8px;
			max-width: 90%;
			max-height: 90%;
			overflow: auto;
			position: relative;
		`;

		const closeBtn = document.createElement('button');
		closeBtn.innerHTML = '×';
		closeBtn.style.cssText = `
			position: absolute;
			top: 10px;
			right: 15px;
			background: none;
			border: none;
			font-size: 24px;
			cursor: pointer;
			z-index: 1;
		`;
		closeBtn.onclick = () => modal.remove();

		if (file.type.startsWith('image/')) {
			const img = document.createElement('img');
			img.src = file.data;
			img.style.cssText = 'max-width: 100%; max-height: 100%; display: block;';
			content.appendChild(img);
		} else if (file.type === 'application/pdf') {
			const iframe = document.createElement('iframe');
			iframe.src = file.data;
			iframe.style.cssText = 'width: 80vw; height: 80vh; border: none;';
			content.appendChild(iframe);
		}

		content.appendChild(closeBtn);
		modal.appendChild(content);
		document.body.appendChild(modal);

		modal.onclick = (e) => {
			if (e.target === modal) modal.remove();
		};
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
		const canvas = board === 'teacher' ? 
		document.getElementById('teacherWhiteboard') : 
		document.getElementById('studentWhiteboard');
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
	let fileData = [];
	if (uploadedFiles.length > 0) {
		// Store file data for display
		for (const file of uploadedFiles) {
			const base64 = await fileToBase64(file);
			fileData.push({ name: file.name, type: file.type, data: base64 });
		}
		processedFiles = await processFilesForTutor(uploadedFiles);
		// Clear uploaded files after processing
		uploadedFiles = [];
		const filePreview = document.getElementById('filePreview');
		filePreview.innerHTML = '';
		filePreview.style.display = 'none';
	}

	// Prepare user message (include file info if files were uploaded)
	let userMessage = message.trim();
	if (processedFiles.length > 0) {
		const fileNames = processedFiles.map((f) => f.name).join(', ');
		userMessage = userMessage || `I've uploaded these files: ${fileNames}`;

		// Add file contents to context
		processedFiles.forEach((file) => {
			context.push({
				role: 'user',
				content: `File: ${file.name}\nContent: ${file.content}`
			});
		});
	}

	// Handle message display/broadcasting (only once!)
	if (window.sessionManager && window.sessionManager.sessionId) {
		// In session mode, broadcast user message
		window.sessionManager.broadcastMessage(userMessage, 'user', fileData);
	} else {
		// Not in session, add message locally
		addMessage(userMessage, 'user', fileData);
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

		// Add user message to context for AI
		context.push({ role: 'user', content: message });

		// Get AI response
		let botResponse = await getGeminiResponse(context);

		// Add bot response to context
		context.push({ role: 'assistant', content: botResponse });

		// Manage context size
		const maxContextMessages = 18;
		if (context.length > maxContextMessages) {
			context = [context[0], ...context.slice(-(maxContextMessages - 1))];
		}

		// Check for whiteboard actions and diagram generation
		let whiteboardAction = null;
		let targetBoard = null;
		let diagramRequest = null;
		
		const diagramMatch = botResponse.match(/\[GENERATE_DIAGRAM:\s*([^\]]+)\]/);
		const teacherMatch = botResponse.match(/\[TEACHER_BOARD:\s*([^\]]+)\]/);
		const studentMatch = botResponse.match(/\[STUDENT_BOARD:\s*([^\]]+)\]/);

		if (diagramMatch) {
			diagramRequest = diagramMatch[1].trim();
			targetBoard = 'teacher';
			botResponse = botResponse.replace(/\[GENERATE_DIAGRAM:[^\]]+\]/, '').trim();
			botResponse += '\n\n[Generating diagram...]';
		} else if (teacherMatch) {
			// Convert old syntax to new diagram generation
			diagramRequest = teacherMatch[1].trim();
			targetBoard = 'teacher';
			botResponse = botResponse.replace(/\[TEACHER_BOARD:[^\]]+\]/, '').trim();
			botResponse += '\n\n[Generating diagram...]';
		} else if (studentMatch) {
			whiteboardAction = studentMatch[1];
			targetBoard = 'student';
			botResponse = botResponse.replace(/\[STUDENT_BOARD:[^\]]+\]/, '').trim();
			botResponse += '\n\n[Setting up student whiteboard...]';
		}

		// Handle bot response display/broadcasting
		if (window.sessionManager && window.sessionManager.sessionId) {
			// In session mode, broadcast bot response
			window.sessionManager.broadcastMessage(botResponse, 'bot');
		} else {
			// Not in session, add message locally
			addMessage(botResponse, 'bot');
		}

		// Execute whiteboard action or generate diagram
		if (diagramRequest && targetBoard) {
			setTimeout(() => generateAIDiagram(diagramRequest, targetBoard), 500);
		} else if (whiteboardAction && targetBoard && window.tutorWhiteboard) {
			setTimeout(() => executeWhiteboardAction(whiteboardAction, targetBoard), 500);
		}

	} catch (error) {
		console.error('Error processing message:', error);
		
		// Create user-friendly error message
		let errorMessage = 'I apologize, but I encountered an issue. ';
		
		if (error.message.includes('Cannot reach the API')) {
			errorMessage += 'The API endpoint is not responding. Please check your deployment.';
		} else if (error.message.includes('API endpoint not found')) {
			errorMessage += 'The API endpoint is missing. Make sure /api/gemini.js exists.';
		} else if (error.message.includes('API authentication failed')) {
			errorMessage += 'Please check your GEMINI_API_KEY environment variable.';
		} else if (error.message.includes('Server error')) {
			errorMessage += 'Please check your server logs and API configuration.';
		} else {
			errorMessage += 'Please try again or check the browser console for details.';
		}

		// Handle error message display/broadcasting
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
// AI Diagram Generation Function
async function generateAIDiagram(description, targetBoard = 'teacher') {
	try {
		if (!window.diagramRenderer) {
			console.error('Diagram renderer not available');
			return;
		}

		const result = await window.diagramRenderer.generateDiagram(description, targetBoard);
		
		if (result.success) {
			// Switch to the target whiteboard
			if (window.switchWhiteboard) {
				window.switchWhiteboard(targetBoard);
			}
			
			// Broadcast diagram action to session if in session mode
			if (window.sessionManager && window.sessionManager.sessionId && window.sessionManager.ws) {
				console.log('Broadcasting diagram to session:', description);
				window.sessionManager.ws.send(
					JSON.stringify({
						type: 'diagram_generated',
						description: description,
						targetBoard: targetBoard,
						userName: window.sessionManager.userName
					})
				);
			} else {
				console.log('Not in session or WebSocket not ready');
			}
			
			console.log('Diagram generated successfully:', result.message);
		} else {
			console.warn('Diagram generation failed:', result.message);
			// Fallback to text explanation
			addMessage(`Diagram note: ${result.message}`, 'bot');
		}
	} catch (error) {
		console.error('Error generating AI diagram:', error);
		addMessage('Sorry, I encountered an issue generating the diagram. Let me explain in text instead.', 'bot');
	}
}

// Global function for whiteboard OCR integration
window.addOcrMessageToChat = function(ocrText, boardType) {
    const message = `I wrote on the ${boardType} whiteboard: "${ocrText}"`;
    
    // Add to chat input
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        const currentValue = chatInput.value || '';
        const newValue = currentValue ? `${currentValue}\n\n${message}` : message;
        chatInput.value = newValue;
        
        // Trigger events
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Auto-send if possible
        setTimeout(() => {
            if (!isProcessing) {
                handleSendMessage();
            }
        }, 100);
    }
};