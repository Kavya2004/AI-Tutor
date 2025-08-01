// diagram-renderer.js - Cloud-based math diagram renderer
class DiagramRenderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    async generateDiagram(question, targetBoard = 'teacher') {
        try {
            // Get diagram instructions from Gemini
            const response = await fetch('/api/diagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const diagramData = await response.json();
            
            if (!diagramData.needsDiagram) {
                return { success: false, message: diagramData.explanation || 'No diagram needed' };
            }

            // Render the diagram
            this.setupCanvas(targetBoard);
            await this.renderDiagram(diagramData.instructions);
            
            return { 
                success: true, 
                message: diagramData.instructions.explanation || 'Diagram generated successfully' 
            };

        } catch (error) {
            console.error('Diagram generation error:', error);
            return { success: false, message: 'Failed to generate diagram: ' + error.message };
        }
    }

    setupCanvas(targetBoard) {
        const canvasId = targetBoard === 'teacher' ? 'teacherWhiteboard' : 'studentWhiteboard';
        this.canvas = document.getElementById(canvasId);
        
        if (!this.canvas) {
            throw new Error(`Canvas ${canvasId} not found`);
        }

        this.ctx = this.canvas.getContext('2d');
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set up coordinate system (center origin)
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(1, -1); // Flip Y axis for mathematical coordinates
    }

    async renderDiagram(instructions) {
        if (!instructions || !instructions.elements) {
            throw new Error('Invalid diagram instructions');
        }

        // Set default styles
        this.ctx.strokeStyle = '#333';
        this.ctx.fillStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.font = '14px Arial';

        // Render each element
        for (const element of instructions.elements) {
            await this.renderElement(element);
        }

        // Add title if provided
        if (instructions.title) {
            this.renderTitle(instructions.title);
        }

        // Add annotations
        if (instructions.annotations) {
            this.renderAnnotations(instructions.annotations);
        }

        this.ctx.restore();
        
        // Mark that something was drawn for OCR detection
        if (typeof window.isAnythingDrawn !== 'undefined') {
            window.isAnythingDrawn = true;
        }
    }

    async renderElement(element) {
        const { type, coordinates, label, color, style } = element;
        
        // Set element styles
        if (color) this.ctx.strokeStyle = color;
        if (style === 'dashed') this.ctx.setLineDash([5, 5]);
        else if (style === 'dotted') this.ctx.setLineDash([2, 2]);
        else this.ctx.setLineDash([]);

        switch (type) {
            case 'line':
                this.renderLine(coordinates);
                break;
            case 'circle':
                this.renderCircle(coordinates);
                break;
            case 'rectangle':
                this.renderRectangle(coordinates);
                break;
            case 'point':
                this.renderPoint(coordinates, label);
                break;
            case 'curve':
                this.renderCurve(coordinates);
                break;
            case 'axis':
                this.renderAxis(coordinates);
                break;
            case 'arrow':
                this.renderArrow(coordinates);
                break;
            case 'parabola':
                this.renderParabola(coordinates);
                break;
            case 'function':
                this.renderFunction(coordinates);
                break;
            case 'quadratic':
                this.renderQuadratic(coordinates);
                break;
        }

        // Add label if provided
        if (label && type !== 'point') {
            this.renderLabel(coordinates, label);
        }
    }

    renderQuadratic([a, b, c, xMin, xMax]) {
        this.ctx.beginPath();
        let first = true;
        
        for (let x = xMin || -5; x <= (xMax || 5); x += 0.1) {
            const y = a * x * x + (b || 0) * x + (c || 0);
            
            if (first) {
                this.ctx.moveTo(x * 20, y * 20);
                first = false;
            } else {
                this.ctx.lineTo(x * 20, y * 20);
            }
        }
        this.ctx.stroke();
    }

    renderLine([x1, y1, x2, y2]) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1 * 20, y1 * 20);
        this.ctx.lineTo(x2 * 20, y2 * 20);
        this.ctx.stroke();
    }

    renderCircle([centerX, centerY, radius]) {
        this.ctx.beginPath();
        this.ctx.arc(centerX * 20, centerY * 20, radius * 20, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    renderRectangle([x, y, width, height]) {
        this.ctx.strokeRect(x * 20, y * 20, width * 20, height * 20);
    }

    renderPoint([x, y], label) {
        this.ctx.beginPath();
        this.ctx.arc(x * 20, y * 20, 3, 0, 2 * Math.PI);
        this.ctx.fill();
        
        if (label) {
            this.ctx.save();
            this.ctx.scale(1, -1);
            this.ctx.fillText(label, x * 20 + 5, -y * 20 + 5);
            this.ctx.restore();
        }
    }

    renderCurve(points) {
        if (points.length < 4) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0] * 20, points[1] * 20);
        
        // Handle smooth curves with quadratic bezier
        if (points.length >= 6) {
            for (let i = 2; i < points.length - 2; i += 2) {
                const cpx = points[i] * 20;
                const cpy = points[i + 1] * 20;
                const x = points[i + 2] * 20;
                const y = points[i + 3] * 20;
                this.ctx.quadraticCurveTo(cpx, cpy, x, y);
            }
        } else {
            for (let i = 2; i < points.length; i += 2) {
                this.ctx.lineTo(points[i] * 20, points[i + 1] * 20);
            }
        }
        this.ctx.stroke();
    }

    renderAxis([xMin, xMax, yMin, yMax]) {
        // X-axis
        this.ctx.beginPath();
        this.ctx.moveTo(xMin * 20, 0);
        this.ctx.lineTo(xMax * 20, 0);
        this.ctx.stroke();
        
        // Y-axis
        this.ctx.beginPath();
        this.ctx.moveTo(0, yMin * 20);
        this.ctx.lineTo(0, yMax * 20);
        this.ctx.stroke();
        
        // Add tick marks and labels
        this.addAxisLabels(xMin, xMax, yMin, yMax);
    }

    renderArrow([x1, y1, x2, y2]) {
        // Draw line
        this.renderLine([x1, y1, x2, y2]);
        
        // Draw arrowhead
        const angle = Math.atan2((y2 - y1) * 20, (x2 - x1) * 20);
        const headLength = 10;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x2 * 20, y2 * 20);
        this.ctx.lineTo(
            x2 * 20 - headLength * Math.cos(angle - Math.PI / 6),
            y2 * 20 - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(x2 * 20, y2 * 20);
        this.ctx.lineTo(
            x2 * 20 - headLength * Math.cos(angle + Math.PI / 6),
            y2 * 20 - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    renderParabola([a, h, k, xMin, xMax]) {
        this.ctx.beginPath();
        let first = true;
        
        for (let x = xMin; x <= xMax; x += 0.1) {
            const y = a * (x - h) * (x - h) + k;
            
            if (first) {
                this.ctx.moveTo(x * 20, y * 20);
                first = false;
            } else {
                this.ctx.lineTo(x * 20, y * 20);
            }
        }
        this.ctx.stroke();
    }

    renderFunction(params) {
        const { type, coefficients, domain } = params;
        const [xMin, xMax] = domain || [-10, 10];
        
        this.ctx.beginPath();
        let first = true;
        
        for (let x = xMin; x <= xMax; x += 0.1) {
            let y;
            
            switch (type) {
                case 'linear':
                    y = coefficients[0] * x + coefficients[1];
                    break;
                case 'quadratic':
                    y = coefficients[0] * x * x + coefficients[1] * x + coefficients[2];
                    break;
                case 'sine':
                    y = coefficients[0] * Math.sin(coefficients[1] * x + coefficients[2]);
                    break;
                case 'cosine':
                    y = coefficients[0] * Math.cos(coefficients[1] * x + coefficients[2]);
                    break;
                default:
                    continue;
            }
            
            if (first) {
                this.ctx.moveTo(x * 20, y * 20);
                first = false;
            } else {
                this.ctx.lineTo(x * 20, y * 20);
            }
        }
        this.ctx.stroke();
    }

    addAxisLabels(xMin, xMax, yMin, yMax) {
        this.ctx.save();
        this.ctx.scale(1, -1);
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        // X-axis labels
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            if (x !== 0) {
                this.ctx.fillText(x.toString(), x * 20, 15);
            }
        }
        
        // Y-axis labels
        this.ctx.textAlign = 'right';
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            if (y !== 0) {
                this.ctx.fillText(y.toString(), -5, -y * 20 + 5);
            }
        }
        
        this.ctx.restore();
    }

    renderTitle(title) {
        this.ctx.save();
        this.ctx.scale(1, -1);
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(title, 0, -this.canvas.height / 2 + 30);
        this.ctx.restore();
    }

    renderAnnotations(annotations) {
        this.ctx.save();
        this.ctx.scale(1, -1);
        this.ctx.font = '12px Arial';
        
        annotations.forEach((annotation, index) => {
            this.ctx.fillText(
                annotation, 
                -this.canvas.width / 2 + 10, 
                this.canvas.height / 2 - 30 - (index * 20)
            );
        });
        
        this.ctx.restore();
    }

    renderLabel([x, y], label) {
        this.ctx.save();
        this.ctx.scale(1, -1);
        this.ctx.font = '12px Arial';
        this.ctx.fillText(label, x * 20 + 5, -y * 20 - 5);
        this.ctx.restore();
    }
}

// Initialize global diagram renderer
window.diagramRenderer = new DiagramRenderer();