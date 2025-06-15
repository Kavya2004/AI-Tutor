let canvas, ctx;
let isDrawing = false;
let isDrawingMode = false;
let currentPath = [];

document.addEventListener('DOMContentLoaded', function() {
	initializeWhiteboard();
	setupWhiteboardControls();
});

function setupWhiteboardControls() {
	const clearButton = document.getElementById('clearButton');
	const drawButton = document.getElementById('drawButton');
	const chartButton = document.getElementById('chartButton');
	
	if (clearButton) {
		clearButton.addEventListener('click', clearWhiteboard);
	}
	
	if (drawButton) {
		drawButton.addEventListener('click', toggleDrawing);
	}
	
	if (chartButton) {
		chartButton.addEventListener('click', drawSampleDistribution);
	}
}

function initializeWhiteboard() {
	canvas = document.getElementById('whiteboard');
	if (!canvas) {
		console.error('Whiteboard canvas not found');
		return;
	}
	
	ctx = canvas.getContext('2d');
	resizeCanvas();
	window.addEventListener('resize', resizeCanvas);
	
	canvas.addEventListener('mousedown', startDrawing);
	canvas.addEventListener('mousemove', draw);
	canvas.addEventListener('mouseup', stopDrawing);
	canvas.addEventListener('mouseout', stopDrawing);
	
	canvas.addEventListener('touchstart', handleTouchStart);
	canvas.addEventListener('touchmove', handleTouchMove);
	canvas.addEventListener('touchend', stopDrawing);
	
	ctx.strokeStyle = '#333';
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	
	updateDrawButton();
}

function handleTouchStart(e) {
	e.preventDefault();
	const touch = e.touches[0];
	const rect = canvas.getBoundingClientRect();
	const mouseEvent = new MouseEvent('mousedown', {
		clientX: touch.clientX,
		clientY: touch.clientY
	});
	canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
	e.preventDefault();
	const touch = e.touches[0];
	const rect = canvas.getBoundingClientRect();
	const mouseEvent = new MouseEvent('mousemove', {
		clientX: touch.clientX,
		clientY: touch.clientY
	});
	canvas.dispatchEvent(mouseEvent);
}

function resizeCanvas() {
	const container = document.querySelector('.whiteboard-container');
	if (!container) return;
	
	canvas.width = container.clientWidth;
	canvas.height = container.clientHeight;
	
	ctx.strokeStyle = '#333';
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
}

function clearWhiteboard() {
	if (!ctx) return;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function toggleDrawing() {
	isDrawingMode = !isDrawingMode;
	canvas.style.cursor = isDrawingMode ? 'crosshair' : 'default';
	updateDrawButton();
}

function updateDrawButton() {
	const drawButton = document.getElementById('drawButton');
	if (drawButton) {
		drawButton.style.background = isDrawingMode ? '#337810' : 'white';
		drawButton.style.color = isDrawingMode ? 'white' : '#333';
		drawButton.textContent = isDrawingMode ? 'Stop Draw' : 'Draw';
	}
}

function startDrawing(e) {
	if (!isDrawingMode) return;
	
	isDrawing = true;
	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	
	currentPath = [{ x, y }];
	ctx.beginPath();
	ctx.moveTo(x, y);
}

function draw(e) {
	if (!isDrawing || !isDrawingMode) return;
	
	const rect = canvas.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	
	currentPath.push({ x, y });
	ctx.lineTo(x, y);
	ctx.stroke();
}

function stopDrawing() {
	isDrawing = false;
	currentPath = [];
}

function drawProbabilityScale() {
	if (!ctx) return;
	clearWhiteboard();
	
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
		const x = startX + (scaleLength * i / 10);
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
		drawEventOnScale(startX, scaleLength, centerY, 0.5, 'Fair Coin Heads', '#337810');
		drawEventOnScale(startX, scaleLength, centerY, 0.167, 'Rolling a 6', '#014148');
		drawEventOnScale(startX, scaleLength, centerY, 1, 'Sun Rising Tomorrow', '#73c3f6');
	}, 1000);
}

function drawEventOnScale(startX, scaleLength, centerY, probability, label, color) {
	if (!ctx) return;
	const x = startX + (scaleLength * probability);
	
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

function drawSampleDistribution() {
	if (!ctx) return;
	clearWhiteboard();
	
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
	const maxFreq = Math.max(...bars.map(b => b.frequency));
	
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
			const x = centerX - 300 + (index * 55);
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

function drawNormalCurve() {
	if (!ctx) return;
	clearWhiteboard();
	
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
		const xPixel = centerX + (x * scale);
		const y = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
				  Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
		const yPixel = centerY + 100 - (y * 200);
		
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
		const x = centerX + (i * scale);
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

function drawTreeDiagram() {
	if (!ctx) return;
	clearWhiteboard();
	
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
	
	firstLevel.forEach(branch => {
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
	
	secondLevel.forEach(branch => {
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
	finalProbs.forEach(prob => {
		ctx.fillText(prob.text, prob.x, prob.y);
	});
}

window.tutorWhiteboard = {
	clearWhiteboard,
	toggleDrawing,
	drawProbabilityScale,
	drawSampleDistribution,
	drawNormalCurve,
	drawTreeDiagram
};