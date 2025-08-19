class NotebookManager {
    constructor() {
        this.currentMode = 'write';   // 'write' or 'draw'
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.savedImage = null;

        this.penSize = 2;
        this.penColor = '#333';
        this.isEraser = false;   // 🧽 eraser mode flag

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupNotebook());
        } else {
            this.setupNotebook();
        }
    }

    setupNotebook() {
        this.canvas = document.getElementById('notesCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.setupCanvas();
            this.setupDrawingEvents();
        }

        this.setupModeButtons();
        this.setupControlButtons();
        this.setupPenControls();
        this.setupEraserButton();  // 🧽 hook eraser
        this.setMode('write');
    }

    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;

            this.applyPenSettings();
            this.restoreCanvasState();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    setupPenControls() {
        const sizeInput = document.getElementById('penSize');
        const colorInput = document.getElementById('penColor');
        const sizeDisplay = document.getElementById('penSizeDisplay');
    
        if (sizeInput) {
            sizeInput.addEventListener('input', (e) => {
                this.penSize = e.target.value;
                if (sizeDisplay) {
                    sizeDisplay.textContent = this.penSize;
                }
                this.applyPenSettings();
            });
        }
    
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                this.penColor = e.target.value;
                this.applyPenSettings();
            });
        }
    }

    setupEraserButton() {
        const eraserBtn = document.getElementById('eraserNotesButton');
        if (eraserBtn) {
            eraserBtn.addEventListener('click', () => {
                this.isEraser = !this.isEraser; // toggle eraser
                eraserBtn.classList.toggle('active', this.isEraser);
                this.applyPenSettings();
            });
        }
    }
    
    applyPenSettings() {
        if (this.ctx) {
            this.ctx.lineWidth = this.penSize;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
    
            if (this.isEraser) {
                this.ctx.globalCompositeOperation = 'destination-out'; // ✨ true erase
            } else {
                this.ctx.globalCompositeOperation = 'source-over'; // ✨ normal draw
                this.ctx.strokeStyle = this.penColor;
            }
        }
    }
    


    setupDrawingEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
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

        if (writeBtn) writeBtn.addEventListener('click', () => this.setMode('write'));
        if (drawBtn) drawBtn.addEventListener('click', () => this.setMode('draw'));
    }

    setupControlButtons() {
        const clearBtn = document.getElementById('clearNotesButton');
        const saveBtn = document.getElementById('saveNotesButton');
        const expandBtn = document.getElementById('expandNotesButton');

        if (clearBtn) clearBtn.addEventListener('click', () => this.clearNotes());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveNotes());
        if (expandBtn) expandBtn.addEventListener('click', () => this.expandNotes());
    }

    saveCanvasState() {
        if (this.canvas) {
            this.savedImage = this.canvas.toDataURL();
        }
    }

    restoreCanvasState() {
        if (this.canvas && this.savedImage) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
            };
            img.src = this.savedImage;
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        const writeArea = document.getElementById('studentNotes');
        const drawArea = document.getElementById('notesCanvas');
        const writeBtn = document.getElementById('writeModeBtn');
        const drawBtn = document.getElementById('drawModeBtn');

        if (!writeArea || !drawArea) return;

        if (mode === 'write') {
            writeArea.removeAttribute('disabled');
            drawArea.style.pointerEvents = 'none';
            if (writeBtn) writeBtn.classList.add('active');
            if (drawBtn) drawBtn.classList.remove('active');
        } else {
            writeArea.setAttribute('disabled', true);
            drawArea.style.pointerEvents = 'auto';
            if (writeBtn) writeBtn.classList.remove('active');
            if (drawBtn) drawBtn.classList.add('active');
        }

        writeArea.style.display = 'block';
        drawArea.style.display = 'block';
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
            const textArea = document.getElementById('studentNotes');
            if (textArea) textArea.value = '';
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            this.savedImage = null;
        }
    }

    saveNotes() {
        const textContent = document.getElementById('studentNotes')?.value || '';
        const timestamp = new Date().toLocaleString();

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
        if (notesPanel) notesPanel.classList.toggle('expanded');
    }
}

// Initialize
const notebookManager = new NotebookManager();

function switchWhiteboard(type) {
    if (notebookManager && notebookManager.canvas) {
        notebookManager.saveCanvasState();
    }

    document.querySelectorAll('.tab-button').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.whiteboard-panel').forEach(panel => panel.classList.remove('active'));

    const selectedTab = document.getElementById(`${type}Tab`);
    const selectedPanel = document.getElementById(`${type}Panel`);

    if (selectedTab) selectedTab.classList.add('active');
    if (selectedPanel) selectedPanel.classList.add('active');

    if (type === 'notes') {
        setTimeout(() => {
            if (notebookManager.canvas) {
                const container = notebookManager.canvas.parentElement;
                notebookManager.canvas.width = container.clientWidth;
                notebookManager.canvas.height = container.clientHeight;
                notebookManager.restoreCanvasState();
            }
        }, 100);
    }
}
