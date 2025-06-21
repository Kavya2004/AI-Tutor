// Notes functionality for the tutor interface
class NotebookManager {
    constructor() {
        this.currentMode = 'write'; // 'write' or 'draw'
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupNotebook());
        } else {
            this.setupNotebook();
        }
    }

    setupNotebook() {
        // Initialize canvas for drawing
        this.canvas = document.getElementById('notesCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.setupCanvas();
            this.setupDrawingEvents();
        }

        // Setup mode toggle buttons
        this.setupModeButtons();
        
        // Setup control buttons
        this.setupControlButtons();

        // Set initial mode
        this.setMode('write');
    }

    setupCanvas() {
        // Set canvas size
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            
            // Set drawing styles
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    setupDrawingEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    setupModeButtons() {
        const writeBtn = document.getElementById('writeModeBtn');
        const drawBtn = document.getElementById('drawModeBtn');

        if (writeBtn) {
            writeBtn.addEventListener('click', () => this.setMode('write'));
        }
        if (drawBtn) {
            drawBtn.addEventListener('click', () => this.setMode('draw'));
        }
    }

    setupControlButtons() {
        const clearBtn = document.getElementById('clearNotesButton');
        const saveBtn = document.getElementById('saveNotesButton');
        const expandBtn = document.getElementById('expandNotesButton');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearNotes());
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveNotes());
        }
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.expandNotes());
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        const writeArea = document.getElementById('studentNotes');
        const drawArea = document.getElementById('notesCanvas');
        const writeBtn = document.getElementById('writeModeBtn');
        const drawBtn = document.getElementById('drawModeBtn');

        if (mode === 'write') {
            if (writeArea) writeArea.style.display = 'block';
            if (drawArea) drawArea.style.display = 'none';
            if (writeBtn) writeBtn.classList.add('active');
            if (drawBtn) drawBtn.classList.remove('active');
        } else {
            if (writeArea) writeArea.style.display = 'none';
            if (drawArea) drawArea.style.display = 'block';
            if (writeBtn) writeBtn.classList.remove('active');
            if (drawBtn) drawBtn.classList.add('active');
        }
    }

    startDrawing(e) {
        if (this.currentMode !== 'draw') return;
        
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing || this.currentMode !== 'draw') return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();

        this.lastX = currentX;
        this.lastY = currentY;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    clearNotes() {
        if (confirm('Are you sure you want to clear all notes?')) {
            // Clear text area
            const textArea = document.getElementById('studentNotes');
            if (textArea) textArea.value = '';

            // Clear canvas
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
    }

    saveNotes() {
        const textContent = document.getElementById('studentNotes')?.value || '';
        const timestamp = new Date().toLocaleString();
        
        // Create a simple download
        const content = `Probability & Stats Notes - ${timestamp}\n\n${textContent}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `probability-notes-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    expandNotes() {
        const notesPanel = document.getElementById('notesPanel');
        if (notesPanel) {
            notesPanel.classList.toggle('expanded');
        }
    }
}

// Initialize the notebook manager
const notebookManager = new NotebookManager();

// Enhanced switchWhiteboard function to handle notes
function switchWhiteboard(type) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Hide all panels
    document.querySelectorAll('.whiteboard-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Show selected panel and activate tab
    const selectedTab = document.getElementById(`${type}Tab`);
    const selectedPanel = document.getElementById(`${type}Panel`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedPanel) selectedPanel.classList.add('active');
    
    // If switching to notes, ensure proper setup
    if (type === 'notes') {
        // Resize canvas if needed
        setTimeout(() => {
            if (notebookManager.canvas) {
                const container = notebookManager.canvas.parentElement;
                notebookManager.canvas.width = container.clientWidth;
                notebookManager.canvas.height = container.clientHeight;
            }
        }, 100);
    }
}