let teacherCanvas, teacherCtx, studentCanvas, studentCtx;

// Make canvas variables globally accessible for diagram renderer
window.teacherCanvas = null;
window.teacherCtx = null;
window.studentCanvas = null;
window.studentCtx = null;
let isDrawing = false;
let isDrawingMode = false;
let teacherDrawingMode = false;
let studentDrawingMode = false;
let currentPath = [];
let isExpanded = false;
let recogTimer = null;
let isAnythingDrawn = false;
let activeWhiteboard = 'teacher'; // Track which whiteboard is active

document.addEventListener('DOMContentLoaded', function () {
	initializeWhiteboards();
	setupWhiteboardControls();
});

function setupWhiteboardControls() {
	// Teacher whiteboard controls
	const clearTeacherButton = document.getElementById('clearTeacherButton');
	const drawTeacherButton = document.getElementById('drawTeacherButton');
	const expandTeacherButton = document.getElementById('expandTeacherButton');

	// Student whiteboard controls
	const clearStudentButton = document.getElementById('clearStudentButton');
	const drawStudentButton = document.getElementById('drawStudentButton');
	const expandStudentButton = document.getElementById('expandStudentButton');

	if (clearTeacherButton) {
		clearTeacherButton.addEventListener('click', () => clearWhiteboard('teacher'));
	}

	if (drawTeacherButton) {
		drawTeacherButton.addEventListener('click', () => toggleDrawing('teacher'));
	}

	if (expandTeacherButton) {
		expandTeacherButton.addEventListener('click', toggleWhiteboardSize);
	}

	if (clearStudentButton) {
		clearStudentButton.addEventListener('click', () => clearWhiteboard('student'));
	}

	if (drawStudentButton) {
		drawStudentButton.addEventListener('click', () => toggleDrawing('student'));
	}

	if (expandStudentButton) {
		expandStudentButton.addEventListener('click', toggleWhiteboardSize);
	}

	setupResizeHandle();
}

function getOcrServerUrl() {
    return ''; // ✅ Use same origin (your Vercel app)
}

async function runOcrAndFillChat(boardType) {
	try {
		console.log(`[OCR] Starting OCR for ${boardType} whiteboard...`);
		
		// Get the correct canvas using the global variables from your whiteboard code
		const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
		if (!canvas) {
			console.error(`[OCR] Canvas not found for ${boardType}`);
			return;
		}

		console.log(`[OCR] Found canvas:`, {
			id: canvas.id,
			width: canvas.width,
			height: canvas.height
		});

		// Check canvas dimensions first
		if (canvas.width === 0 || canvas.height === 0) {
			console.log(`[OCR] Canvas has zero dimensions: ${canvas.width}x${canvas.height}`);
			return;
		}

		// Check if canvas has any content
		const ctx = canvas.getContext('2d');
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		let hasContent = false;
		for (let i = 0; i < imageData.data.length; i += 4) {
			const r = imageData.data[i];
			const g = imageData.data[i + 1]; 
			const b = imageData.data[i + 2];
			const a = imageData.data[i + 3];
			
			// Check for any non-white, non-transparent pixels
			if (a > 0 && (r < 250 || g < 250 || b < 250)) {
				hasContent = true;
				break;
			}
		}

		if (!hasContent) {
			console.log(`[OCR] Canvas appears to be empty`);
			return;
		}

		// Convert canvas to base64 image
		const dataUrl = canvas.toDataURL('image/png', 0.8);
		console.log(`[OCR] Canvas data URL length:`, dataUrl.length);
		
		// Get the correct server URL
		const serverUrl = getOcrServerUrl();
		console.log(`[OCR] Using server URL:`, serverUrl);
		
		// Send to your OCR server
		const response = await fetch('/api/ocr', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				image: dataUrl
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OCR request failed: ${response.status} - ${errorText}`);
		}

		const result = await response.json();
		console.log('[OCR] Raw result:', result);

		// Extract the recognized text from Mathpix response
// Extract the recognized text from Mathpix response
let ocrText = '';
if (result.text) {
    ocrText = result.text;
} else if (result.latex_styled) {
    ocrText = result.latex_styled;
} else if (result.data && Array.isArray(result.data)) {
    ocrText = result.data.map(item => item.value || '').join(' ');
} else if (result.error) {
    console.error('[OCR] Server returned error:', result.error);
    showOcrError(`OCR Error: ${result.error}`);
    return;
} else {
    console.log('[OCR] Unexpected response format:', result);
    ocrText = JSON.stringify(result); // Fallback to see what we got
}

		if (ocrText.trim()) {
			console.log('[OCR] Recognized text:', ocrText);
			await sendOcrToChat(ocrText, boardType);
		} else {
			console.log('[OCR] No text recognized');
		}

	} catch (error) {
		console.error('[OCR] Error:', error);
		showOcrError(`Failed to process whiteboard: ${error.message}`);
	}
}

// Send OCR result to chat system
async function sendOcrToChat(ocrText, boardType) {
	const message = `I wrote on the ${boardType} whiteboard: "${ocrText}"`;
	
	console.log('[OCR->CHAT]', message);
	
	const chatInput = document.querySelector('#chatInput') || // This matches your HTML
	document.querySelector('#messageInput') ||
	document.querySelector('[data-testid="chat-input"]') ||
	document.querySelector('textarea[placeholder*="message"]') ||
	document.querySelector('input[type="text"]') ||
	document.querySelector('textarea');
	if (chatInput) {
		// Add the OCR text to the chat input
		const currentValue = chatInput.value || '';
		const newValue = currentValue ? `${currentValue}\n\n${message}` : message;
		chatInput.value = newValue;
		
		// Trigger input events to notify React/Vue/etc if needed
		chatInput.dispatchEvent(new Event('input', { bubbles: true }));
		chatInput.dispatchEvent(new Event('change', { bubbles: true }));
		
		const sendButton = document.querySelector('#sendButton') || 
		document.querySelector('[data-testid="send-button"]') ||
		document.querySelector('button[type="submit"]') ||
		document.querySelector('.send-button');
		if (sendButton && !sendButton.disabled) {
			console.log('[OCR] Auto-sending message...');
			setTimeout(() => sendButton.click(), 100);
		} else {
			console.log('[OCR] Send button not found or disabled, message added to input');
			// Show a notification that the text was added
			showOcrSuccess(`Text "${ocrText}" added to chat input`);
		}
	} else {
		console.log('[OCR] Chat input not found, trying to call global functions...');
		
		// Try to call global functions that might exist in your chat system
		if (typeof window.addOcrMessageToChat === 'function') {
			window.addOcrMessageToChat(ocrText, boardType);
		} else if (typeof window.addMessageToChat === 'function') {
			window.addMessageToChat(message);
		} else if (typeof window.sendMessage === 'function') {
			window.sendMessage(message);
		} else {
			// Show the OCR result in a notification
			showOcrSuccess(`Recognized text: "${ocrText}"`);
		}
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
// Show success notification
function showOcrSuccess(message) {
	const notification = document.createElement('div');
	notification.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: #28a745;
		color: white;
		padding: 12px 16px;
		border-radius: 8px;
		z-index: 10000;
		font-size: 14px;
		max-width: 300px;
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
	`;
	notification.textContent = message;
	
	document.body.appendChild(notification);
	
	// Remove after 4 seconds
	setTimeout(() => {
		if (notification.parentNode) {
			notification.parentNode.removeChild(notification);
		}
	}, 4000);
}

// Show error notification
function showOcrError(message) {
	const errorDiv = document.createElement('div');
	errorDiv.style.cssText = `
		position: fixed;
		top: 20px;
		right: 20px;
		background: #dc3545;
		color: white;
		padding: 12px 16px;
		border-radius: 8px;
		z-index: 10000;
		font-size: 14px;
		max-width: 300px;
		box-shadow: 0 4px 6px rgba(0,0,0,0.1);
	`;
	errorDiv.textContent = message;
	
	document.body.appendChild(errorDiv);
	
	// Remove after 5 seconds
	setTimeout(() => {
		if (errorDiv.parentNode) {
			errorDiv.parentNode.removeChild(errorDiv);
		}
	}, 5000);
}

// Debug function to help troubleshoot
function debugWhiteboardOcr() {
	console.log('=== WHITEBOARD OCR DEBUG ===');
	console.log('teacherCanvas:', teacherCanvas);
	console.log('studentCanvas:', studentCanvas);
	console.log('isDrawingMode:', isDrawingMode);
	console.log('isAnythingDrawn:', isAnythingDrawn);
	
	// Test OCR on both canvases
	if (teacherCanvas) {
		console.log('Testing teacher canvas OCR...');
		runOcrAndFillChat('teacher');
	}
	
	if (studentCanvas) {
		console.log('Testing student canvas OCR...');
		runOcrAndFillChat('student');
	}
}

// Make debug function available globally
window.debugWhiteboardOcr = debugWhiteboardOcr;

// Also export the OCR functions for external use
window.runOcrAndFillChat = runOcrAndFillChat;
function initializeWhiteboards() {
	// Initialize teacher whiteboard
	teacherCanvas = document.getElementById('teacherWhiteboard');
	if (teacherCanvas) {
		teacherCtx = teacherCanvas.getContext('2d');
		setupCanvas(teacherCanvas, teacherCtx, 'teacher');
		// Make globally accessible
		window.teacherCanvas = teacherCanvas;
		window.teacherCtx = teacherCtx;
	}

	// Initialize student whiteboard
	studentCanvas = document.getElementById('studentWhiteboard');
	if (studentCanvas) {
		studentCtx = studentCanvas.getContext('2d');
		setupCanvas(studentCanvas, studentCtx, 'student');
		// Make globally accessible
		window.studentCanvas = studentCanvas;
		window.studentCtx = studentCtx;
	}

	if (!teacherCanvas || !studentCanvas) {
		console.error('Whiteboard canvases not found');
		return;
	}

	resizeCanvases();
	window.addEventListener('resize', resizeCanvases);

	updateDrawButtons();
	updateExpandButton();
}

function setupCanvas(canvas, ctx, boardType) {
	canvas.addEventListener('mousedown', (e) => startDrawing(e, boardType));
	canvas.addEventListener('mousemove', (e) => draw(e, boardType));
	canvas.addEventListener('mouseup', () => stopDrawing(boardType));
	canvas.addEventListener('mouseout', () => stopDrawing(boardType));

	canvas.addEventListener('touchstart', (e) => handleTouchStart(e, boardType));
	canvas.addEventListener('touchmove', (e) => handleTouchMove(e, boardType));
	canvas.addEventListener('touchend', () => stopDrawing(boardType));

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
}

function switchWhiteboard(boardType) {
	const teacherPanel = document.getElementById('teacherPanel');
	const studentPanel = document.getElementById('studentPanel');
	const teacherTab = document.getElementById('teacherTab');
	const studentTab = document.getElementById('studentTab');

	if (boardType === 'teacher') {
		teacherPanel.classList.add('active');
		studentPanel.classList.remove('active');
		teacherTab.classList.add('active');
		studentTab.classList.remove('active');
		activeWhiteboard = 'teacher';
	} else {
		studentPanel.classList.add('active');
		teacherPanel.classList.remove('active');
		studentTab.classList.add('active');
		teacherTab.classList.remove('active');
		activeWhiteboard = 'student';
	}

	// Resize canvases after switching
	setTimeout(resizeCanvases, 100);
}

function setupResizeHandle() {
	const chatSection = document.querySelector('.chat-section');
	const whiteboardSection = document.querySelector('.whiteboard-section');

	if (!chatSection || !whiteboardSection) {
		console.error('Chat or whiteboard section not found');
		return;
	}

	let resizeHandle = document.querySelector('.resize-handle');
	if (!resizeHandle) {
		resizeHandle = document.createElement('div');
		resizeHandle.className = 'resize-handle';
		resizeHandle.innerHTML = '⋮⋮';
		chatSection.appendChild(resizeHandle);
	}

	let isResizing = false;
	let startX = 0;
	let startWidth = 0;

	resizeHandle.addEventListener('mousedown', (e) => {
		isResizing = true;
		startX = e.clientX;
		startWidth = parseInt(window.getComputedStyle(chatSection).width, 10);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';

		resizeHandle.style.background = '#337810';
		resizeHandle.style.color = 'white';

		e.preventDefault();
		e.stopPropagation();
	});

	document.addEventListener('mousemove', (e) => {
		if (!isResizing) return;

		const deltaX = e.clientX - startX;
		const newWidth = startWidth + deltaX;
		const minWidth = 250;
		const maxWidth = window.innerWidth - 300;

		if (newWidth >= minWidth && newWidth <= maxWidth) {
			chatSection.style.flexBasis = newWidth + 'px';
			chatSection.style.width = newWidth + 'px';

			requestAnimationFrame(() => {
				resizeCanvases();
			});
		}

		e.preventDefault();
	});

	document.addEventListener('mouseup', () => {
		if (isResizing) {
			isResizing = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			resizeHandle.style.background = '#ddd';
			resizeHandle.style.color = '#666';
		}
	});
}

function toggleWhiteboardSize() {
	const whiteboardSection = document.querySelector('.whiteboard-section');
	const chatSection = document.querySelector('.chat-section');

	if (!whiteboardSection || !chatSection) {
		console.error('Required sections not found');
		return;
	}

	if (!isExpanded) {
		chatSection.style.flexBasis = '50px';
		chatSection.style.width = '50px';
		chatSection.style.minWidth = '50px';
		isExpanded = true;
	} else {
		chatSection.style.flexBasis = '400px';
		chatSection.style.width = '400px';
		chatSection.style.minWidth = '200px';
		isExpanded = false;
	}

	updateExpandButton();

	setTimeout(() => {
		resizeCanvases();
	}, 50);
}

function updateExpandButton() {
	const expandTeacherButton = document.getElementById('expandTeacherButton');
	const expandStudentButton = document.getElementById('expandStudentButton');

	if (expandTeacherButton) {
		expandTeacherButton.textContent = isExpanded ? '⬅️ Shrink' : '➡️ Expand';
		expandTeacherButton.title = isExpanded ? 'Shrink whiteboard' : 'Expand whiteboard';
	}

	if (expandStudentButton) {
		expandStudentButton.textContent = isExpanded ? '⬅️ Shrink' : '➡️ Expand';
		expandStudentButton.title = isExpanded ? 'Shrink whiteboard' : 'Expand whiteboard';
	}
}

function handleTouchStart(e, boardType) {
	e.preventDefault();
	const touch = e.touches[0];
	const mouseEvent = new MouseEvent('mousedown', {
		clientX: touch.clientX,
		clientY: touch.clientY
	});
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e, boardType) {
	e.preventDefault();
	const touch = e.touches[0];
	const mouseEvent = new MouseEvent('mousemove', {
		clientX: touch.clientX,
		clientY: touch.clientY
	});
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	canvas.dispatchEvent(mouseEvent);
}

function resizeCanvases() {
	resizeCanvas(teacherCanvas, 'teacher');
	resizeCanvas(studentCanvas, 'student');
}

function resizeCanvas(canvas, boardType) {
	if (!canvas) return;

	const panel = document.getElementById(boardType + 'Panel');
	if (!panel) return;

	const container = panel.querySelector('.whiteboard-container') || panel;
	const containerRect = container.getBoundingClientRect();
	const newWidth = Math.floor(containerRect.width);
	const newHeight = Math.floor(containerRect.height - 60); // Account for header

	if (canvas.width !== newWidth || canvas.height !== newHeight) {
		// Save current canvas content
		const imageData = canvas.toDataURL();
		
		// Resize canvas
		canvas.width = newWidth;
		canvas.height = newHeight;

		const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 4;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		
		// Restore canvas content
		if (imageData && imageData !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIAAAUAAY27m/MAAAAASUVORK5CYII=') {
			const img = new Image();
			img.onload = () => ctx.drawImage(img, 0, 0);
			img.src = imageData;
		}
	}
}

function clearWhiteboard(boardType) {
	// In sessions, only host can clear teacher whiteboard
	if (window.sessionManager && window.sessionManager.sessionId && 
		boardType === 'teacher' && !window.sessionManager.isHost) {
		alert('Only the session host can clear the teacher whiteboard');
		return;
	}

	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Broadcast clear action to session
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(
			JSON.stringify({
				type: 'whiteboard_clear',
				targetBoard: boardType,
				userName: window.sessionManager.userName
			})
		);
	}
}
function broadcastDiagramAction(diagramName, boardType = 'teacher') {
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(JSON.stringify({
			type: "whiteboard_action",
			action: diagramName, 
			targetBoard: boardType,
			userName: window.sessionManager.userName
		}));
	}
}

function toggleDrawing(boardType) {
	if (boardType === 'teacher') {
		teacherDrawingMode = !teacherDrawingMode;
		isDrawingMode = teacherDrawingMode;
		if (teacherCanvas) {
			teacherCanvas.style.cursor = teacherDrawingMode ? 'crosshair' : 'default';
		}
	} else {
		studentDrawingMode = !studentDrawingMode;
		isDrawingMode = studentDrawingMode;
		if (studentCanvas) {
			studentCanvas.style.cursor = studentDrawingMode ? 'crosshair' : 'default';
		}
	}
	
	updateDrawButtons();
	
	// Only run OCR when stopping drawing mode
	const currentMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	if (!currentMode && isAnythingDrawn) {
		clearTimeout(recogTimer);
		recogTimer = setTimeout(() => {
			runOcrAndFillChat(boardType);
			isAnythingDrawn = false;
		}, 500);
	}
	
	console.log(`[DRAW] Drawing mode ${currentMode ? 'ENABLED' : 'DISABLED'} for ${boardType}`);
}

function updateDrawButtons() {
	const drawTeacherButton = document.getElementById('drawTeacherButton');
	const drawStudentButton = document.getElementById('drawStudentButton');

	if (drawTeacherButton) {
		drawTeacherButton.style.background = isDrawingMode ? '#337810' : 'white';
		drawTeacherButton.style.color = isDrawingMode ? 'white' : '#333';
		drawTeacherButton.textContent = isDrawingMode ? 'Stop Draw' : 'Draw';
	}

	if (drawStudentButton) {
		drawStudentButton.style.background = isDrawingMode ? '#337810' : 'white';
		drawStudentButton.style.color = isDrawingMode ? 'white' : '#333';
		drawStudentButton.textContent = isDrawingMode ? 'Stop Draw' : 'Draw';
	}
}

function startDrawing(e, boardType) {
	const currentMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	if (!currentMode) return;

	isDrawing = true;
	isAnythingDrawn = true;
	clearTimeout(recogTimer);

	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;

	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;

	currentPath = [{ x, y }];
	ctx.beginPath();
	ctx.moveTo(x, y);
}

function draw(e, boardType) {
	const currentMode = boardType === 'teacher' ? teacherDrawingMode : studentDrawingMode;
	if (!isDrawing || !currentMode) return;

	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;

	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;

	currentPath.push({ x, y });
	ctx.lineTo(x, y);
	ctx.stroke();

	// Broadcast this point to other participants
	if (window.sessionManager && window.sessionManager.sessionId) {
		window.sessionManager.ws.send(JSON.stringify({
			type: 'whiteboard_draw',
			boardType,
			x, y,
			userName: window.sessionManager.userName
		}));
	}
}


function stopDrawing(boardType) {
	isDrawing = false;
	currentPath = [];
	// OCR only triggers when drawing mode is turned OFF, not on every stroke
}

// Drawing functions that can work on either whiteboard
function drawProbabilityScale(boardType = 'teacher') {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerY = height / 2;
	const scaleLength = width * 0.8;
	const startX = (width - scaleLength) / 2;

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(startX, centerY);
	ctx.lineTo(startX + scaleLength, centerY);
	ctx.stroke();

	ctx.font = '16px Arial';
	ctx.textAlign = 'center';
	ctx.fillStyle = '#333';

	for (let i = 0; i <= 10; i++) {
		const x = startX + (scaleLength * i) / 10;
		const probability = i / 10;

		ctx.beginPath();
		ctx.moveTo(x, centerY - 10);
		ctx.lineTo(x, centerY + 10);
		ctx.stroke();

		ctx.fillText(probability.toFixed(1), x, centerY + 30);
	}

	ctx.font = '18px Arial';
	ctx.fillText('Impossible', startX, centerY - 30);
	ctx.fillText('Certain', startX + scaleLength, centerY - 30);
	ctx.fillText('Probability Scale', width / 2, 50);

	setTimeout(() => {
		drawEventOnScale(startX, scaleLength, centerY, 0.5, 'Fair Coin Heads', '#337810', ctx);
		drawEventOnScale(startX, scaleLength, centerY, 0.167, 'Rolling a 6', '#014148', ctx);
		drawEventOnScale(startX, scaleLength, centerY, 1, 'Sun Rising Tomorrow', '#73c3f6', ctx);
	}, 1000);
}

function drawEventOnScale(startX, scaleLength, centerY, probability, label, color, ctx) {
	if (!ctx) return;
	const x = startX + scaleLength * probability;

	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = 2;

	ctx.beginPath();
	ctx.moveTo(x, centerY - 50);
	ctx.lineTo(x, centerY - 20);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(x - 5, centerY - 25);
	ctx.lineTo(x, centerY - 20);
	ctx.lineTo(x + 5, centerY - 25);
	ctx.stroke();

	ctx.font = '14px Arial';
	ctx.textAlign = 'center';
	ctx.fillText(label, x, centerY - 60);
}

function drawSampleDistribution(boardType = 'teacher') {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const centerY = height / 2;

	const bars = [
		{ value: 1, frequency: 2, color: '#337810' },
		{ value: 2, frequency: 5, color: '#337810' },
		{ value: 3, frequency: 8, color: '#337810' },
		{ value: 4, frequency: 12, color: '#014148' },
		{ value: 5, frequency: 15, color: '#014148' },
		{ value: 6, frequency: 18, color: '#014148' },
		{ value: 7, frequency: 15, color: '#014148' },
		{ value: 8, frequency: 12, color: '#014148' },
		{ value: 9, frequency: 8, color: '#337810' },
		{ value: 10, frequency: 5, color: '#337810' },
		{ value: 11, frequency: 2, color: '#337810' }
	];

	const barWidth = 60;
	const maxHeight = 150;
	const maxFreq = Math.max(...bars.map((b) => b.frequency));

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX - 400, centerY + 100);
	ctx.lineTo(centerX + 400, centerY + 100);
	ctx.moveTo(centerX - 350, centerY + 100);
	ctx.lineTo(centerX - 350, centerY - 100);
	ctx.stroke();

	bars.forEach((bar, index) => {
		setTimeout(() => {
			const x = centerX - 300 + index * 55;
			const barHeight = (bar.frequency / maxFreq) * maxHeight;
			const y = centerY + 100 - barHeight;

			ctx.fillStyle = bar.color;
			ctx.fillRect(x, y, 40, barHeight);

			ctx.fillStyle = '#333';
			ctx.font = '14px Arial';
			ctx.textAlign = 'center';
			ctx.fillText(bar.value, x + 20, centerY + 120);
			ctx.fillText(bar.frequency, x + 20, y - 5);
		}, index * 200);
	});

	ctx.fillStyle = '#333';
	ctx.font = '20px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('Sample Distribution', centerX, 50);

	ctx.font = '16px Arial';
	ctx.fillText('Value', centerX, height - 20);

	ctx.save();
	ctx.translate(50, centerY);
	ctx.rotate(-Math.PI / 2);
	ctx.textAlign = 'center';
	ctx.fillText('Frequency', 0, 0);
	ctx.restore();
}

function drawNormalCurve(boardType = 'teacher') {
	broadcastDiagramAction("drawNormalCurve", boardType);
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const centerY = height / 2;

	ctx.strokeStyle = '#333';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX - 300, centerY + 100);
	ctx.lineTo(centerX + 300, centerY + 100);
	ctx.moveTo(centerX, centerY + 100);
	ctx.lineTo(centerX, centerY - 150);
	ctx.stroke();

	ctx.strokeStyle = '#014148';
	ctx.lineWidth = 3;
	ctx.beginPath();

	const mean = 0;
	const stdDev = 1;
	const scale = 80;

	for (let x = -4; x <= 4; x += 0.1) {
		const xPixel = centerX + x * scale;
		const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
		const yPixel = centerY + 100 - y * 200;

		if (x === -4) {
			ctx.moveTo(xPixel, yPixel);
		} else {
			ctx.lineTo(xPixel, yPixel);
		}
	}
	ctx.stroke();

	ctx.strokeStyle = '#337810';
	ctx.lineWidth = 2;
	ctx.setLineDash([5, 5]);

	for (let i = -3; i <= 3; i++) {
		if (i === 0) continue;
		const x = centerX + i * scale;
		ctx.beginPath();
		ctx.moveTo(x, centerY + 100);
		ctx.lineTo(x, centerY - 50);
		ctx.stroke();

		ctx.fillStyle = '#337810';
		ctx.font = '14px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(`${i}σ`, x, centerY + 120);
	}

	ctx.setLineDash([]);

	ctx.fillStyle = '#333';
	ctx.font = '20px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('Normal Distribution Curve', centerX, 50);

	ctx.strokeStyle = '#ff6b6b';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(centerX, centerY + 100);
	ctx.lineTo(centerX, centerY - 50);
	ctx.stroke();

	ctx.fillStyle = '#ff6b6b';
	ctx.fillText('μ (mean)', centerX, centerY + 135);
}

function drawTreeDiagram(boardType = 'teacher') {
	const ctx = boardType === 'teacher' ? teacherCtx : studentCtx;
	const canvas = boardType === 'teacher' ? teacherCanvas : studentCanvas;
	if (!ctx || !canvas) return;

	clearWhiteboard(boardType);

	const width = canvas.width;
	const height = canvas.height;
	const centerX = width / 2;
	const startY = 100;

	ctx.fillStyle = '#333';
	ctx.font = '20px Arial';
	ctx.textAlign = 'center';
	ctx.fillText('Probability Tree Diagram', centerX, 50);

	ctx.fillStyle = '#014148';
	ctx.beginPath();
	ctx.arc(centerX, startY, 8, 0, 2 * Math.PI);
	ctx.fill();

	const firstLevel = [
		{ x: centerX - 200, y: startY + 100, label: 'A (0.6)', prob: '0.6' },
		{ x: centerX + 200, y: startY + 100, label: 'B (0.4)', prob: '0.4' }
	];

	firstLevel.forEach((branch) => {
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(centerX, startY);
		ctx.lineTo(branch.x, branch.y);
		ctx.stroke();

		ctx.fillStyle = '#014148';
		ctx.beginPath();
		ctx.arc(branch.x, branch.y, 8, 0, 2 * Math.PI);
		ctx.fill();

		ctx.fillStyle = '#333';
		ctx.font = '16px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(branch.label, branch.x, branch.y - 20);

		const midX = (centerX + branch.x) / 2;
		const midY = (startY + branch.y) / 2;
		ctx.fillText(branch.prob, midX, midY - 10);
	});

	const secondLevel = [
		{ fromX: centerX - 200, fromY: startY + 100, x: centerX - 300, y: startY + 200, label: 'C|A (0.7)', prob: '0.7' },
		{ fromX: centerX - 200, fromY: startY + 100, x: centerX - 100, y: startY + 200, label: 'D|A (0.3)', prob: '0.3' },
		{ fromX: centerX + 200, fromY: startY + 100, x: centerX + 100, y: startY + 200, label: 'C|B (0.2)', prob: '0.2' },
		{ fromX: centerX + 200, fromY: startY + 100, x: centerX + 300, y: startY + 200, label: 'D|B (0.8)', prob: '0.8' }
	];

	secondLevel.forEach((branch) => {
		ctx.strokeStyle = '#337810';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(branch.fromX, branch.fromY);
		ctx.lineTo(branch.x, branch.y);
		ctx.stroke();

		ctx.fillStyle = '#337810';
		ctx.beginPath();
		ctx.arc(branch.x, branch.y, 6, 0, 2 * Math.PI);
		ctx.fill();

		ctx.fillStyle = '#333';
		ctx.font = '14px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(branch.label, branch.x, branch.y + 25);

		const midX = (branch.fromX + branch.x) / 2;
		const midY = (branch.fromY + branch.y) / 2;
		ctx.fillText(branch.prob, midX + 15, midY);
	});

	const finalProbs = [
		{ x: centerX - 300, y: startY + 250, text: 'P(A∩C) = 0.42' },
		{ x: centerX - 100, y: startY + 250, text: 'P(A∩D) = 0.18' },
		{ x: centerX + 100, y: startY + 250, text: 'P(B∩C) = 0.08' },
		{ x: centerX + 300, y: startY + 250, text: 'P(B∩D) = 0.32' }
	];

	ctx.fillStyle = '#ff6b6b';
	ctx.font = '14px Arial';
	finalProbs.forEach((prob) => {
		ctx.fillText(prob.text, prob.x, prob.y);
	});
}

// Export functions for external use
window.tutorWhiteboard = {
	clearWhiteboard,
	toggleDrawing,
	toggleWhiteboardSize,
	drawProbabilityScale,
	drawSampleDistribution,
	drawNormalCurve,
	drawTreeDiagram,
	switchWhiteboard
};

// Make switchWhiteboard globally available
window.switchWhiteboard = switchWhiteboard;

