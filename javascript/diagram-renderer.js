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
                const errorText = await response.text().catch(() => 'Unknown error');
                console.error('Diagram API error:', response.status, errorText);
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const diagramData = await response.json().catch(err => {
                console.error('Failed to parse diagram response:', err);
                throw new Error('Invalid response from diagram API');
            });
            
            if (!diagramData.needsDiagram) {
                return { success: false, message: diagramData.explanation || 'No diagram needed' };
            }

            if (!diagramData.instructions || !diagramData.instructions.elements) {
                return { success: false, message: 'Invalid diagram instructions received' };
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
        
        // Always clear previous diagram
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.diagramData = null;
        
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
        
        // Store diagram data for redrawing on resize
        this.canvas.diagramData = instructions;
        
        // Mark that something was drawn for OCR detection
        if (typeof window.isAnythingDrawn !== 'undefined') {
            window.isAnythingDrawn = true;
        }
    }

    async renderElement(element) {
        const { type, coordinates, label, color, style, fill } = element;
        
        // Set element styles
        this.ctx.strokeStyle = color || '#333';
        this.ctx.fillStyle = fill || color || '#333';
        this.ctx.lineWidth = element.lineWidth || 2;
        
        if (style === 'dashed') this.ctx.setLineDash([8, 4]);
        else if (style === 'dotted') this.ctx.setLineDash([2, 3]);
        else this.ctx.setLineDash([]);

        switch (type) {
            case 'line':
                this.renderPreciseLine(coordinates);
                break;
            case 'circle':
                this.renderPreciseCircle(coordinates, fill);
                break;
            case 'rectangle':
                this.renderPreciseRectangle(coordinates, fill);
                break;
            case 'point':
                this.renderPoint(coordinates, label);
                break;
            case 'curve':
                this.renderSmoothCurve(coordinates);
                break;
            case 'axis':
                this.renderPreciseAxis(coordinates);
                break;
            case 'arrow':
                this.renderPreciseArrow(coordinates);
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
            case 'triangle':
                this.renderPreciseTriangle(coordinates, fill);
                break;
            case 'polygon':
                this.renderPolygon(coordinates, fill);
                break;
            case 'ellipse':
                this.renderEllipse(coordinates, fill);
                break;
            case 'grid':
                this.renderGrid(coordinates);
                break;
            case 'table':
                this.renderTable(coordinates, element.data);
                break;
            case 'desmos':
                if (coordinates && coordinates.expressions) {
                    await this.renderDesmosGraph(coordinates);
                }
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

    renderPreciseTriangle([x1, y1, x2, y2, x3, y3], fill = false) {
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1 * 20) + 0.5, Math.round(y1 * 20) + 0.5);
        this.ctx.lineTo(Math.round(x2 * 20) + 0.5, Math.round(y2 * 20) + 0.5);
        this.ctx.lineTo(Math.round(x3 * 20) + 0.5, Math.round(y3 * 20) + 0.5);
        this.ctx.closePath();
        if (fill) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    renderPolygon(points, fill = false) {
        if (points.length < 6) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0] * 20, points[1] * 20);
        
        for (let i = 2; i < points.length; i += 2) {
            this.ctx.lineTo(points[i] * 20, points[i + 1] * 20);
        }
        
        this.ctx.closePath();
        if (fill) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    renderEllipse([centerX, centerY, radiusX, radiusY], fill = false) {
        this.ctx.beginPath();
        this.ctx.ellipse(centerX * 20, centerY * 20, radiusX * 20, radiusY * 20, 0, 0, 2 * Math.PI);
        if (fill) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    renderGrid([xMin, xMax, yMin, yMax, spacing = 1]) {
        this.ctx.save();
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 0.5;
        
        // Vertical lines
        for (let x = xMin; x <= xMax; x += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * 20, yMin * 20);
            this.ctx.lineTo(x * 20, yMax * 20);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = yMin; y <= yMax; y += spacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(xMin * 20, y * 20);
            this.ctx.lineTo(xMax * 20, y * 20);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    renderPreciseLine([x1, y1, x2, y2]) {
        this.ctx.beginPath();
        this.ctx.moveTo(Math.round(x1 * 20) + 0.5, Math.round(y1 * 20) + 0.5);
        this.ctx.lineTo(Math.round(x2 * 20) + 0.5, Math.round(y2 * 20) + 0.5);
        this.ctx.stroke();
    }

    renderPreciseCircle([centerX, centerY, radius], fill = false) {
        this.ctx.beginPath();
        this.ctx.arc(centerX * 20, centerY * 20, radius * 20, 0, 2 * Math.PI);
        if (fill) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    renderPreciseRectangle([x, y, width, height], fill = false) {
        const px = Math.round(x * 20) + 0.5;
        const py = Math.round(y * 20) + 0.5;
        const pw = Math.round(width * 20);
        const ph = Math.round(height * 20);
        
        if (fill) {
            this.ctx.fillRect(px, py, pw, ph);
        }
        this.ctx.strokeRect(px, py, pw, ph);
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



    renderPreciseArrow([x1, y1, x2, y2]) {
        // Draw line
        this.renderPreciseLine([x1, y1, x2, y2]);
        
        // Draw arrowhead
        const angle = Math.atan2((y2 - y1) * 20, (x2 - x1) * 20);
        const headLength = 12;
        const headAngle = Math.PI / 6;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x2 * 20, y2 * 20);
        this.ctx.lineTo(
            x2 * 20 - headLength * Math.cos(angle - headAngle),
            y2 * 20 - headLength * Math.sin(angle - headAngle)
        );
        this.ctx.moveTo(x2 * 20, y2 * 20);
        this.ctx.lineTo(
            x2 * 20 - headLength * Math.cos(angle + headAngle),
            y2 * 20 - headLength * Math.sin(angle + headAngle)
        );
        this.ctx.stroke();
    }

    renderPreciseAxis([xMin, xMax, yMin, yMax]) {
        this.ctx.save();
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1.5;
        
        // X-axis
        this.ctx.beginPath();
        this.ctx.moveTo(xMin * 20, 0.5);
        this.ctx.lineTo(xMax * 20, 0.5);
        this.ctx.stroke();
        
        // Y-axis
        this.ctx.beginPath();
        this.ctx.moveTo(0.5, yMin * 20);
        this.ctx.lineTo(0.5, yMax * 20);
        this.ctx.stroke();
        
        // Add tick marks and labels
        this.addAxisLabels(xMin, xMax, yMin, yMax);
        this.ctx.restore();
    }

    renderSmoothCurve(points) {
        if (points.length < 4) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0] * 20, points[1] * 20);
        
        // Use quadratic curves for smoothness
        for (let i = 2; i < points.length - 2; i += 2) {
            const cpx = (points[i] + points[i + 2]) / 2 * 20;
            const cpy = (points[i + 1] + points[i + 3]) / 2 * 20;
            this.ctx.quadraticCurveTo(points[i] * 20, points[i + 1] * 20, cpx, cpy);
        }
        
        // Final point
        if (points.length >= 4) {
            this.ctx.lineTo(points[points.length - 2] * 20, points[points.length - 1] * 20);
        }
        
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

    async renderDesmosGraph(config) {
        try {
            // Load Desmos API if not available
            if (!window.Desmos) {
                await this.loadDesmosAPI();
            }

            // Create visible container for Desmos
            const container = document.createElement('div');
            container.style.cssText = `
                position: absolute;
                width: ${this.canvas.width}px;
                height: ${this.canvas.height}px;
                z-index: -1;
            `;
            document.body.appendChild(container);

            // Initialize calculator
            const calculator = window.Desmos.GraphingCalculator(container, {
                expressions: false,
                settingsMenu: false,
                zoomButtons: false,
                showGrid: true,
                showXAxis: true,
                showYAxis: true
            });

            // Add expressions
            if (config.expressions) {
                config.expressions.forEach((expr, i) => {
                    calculator.setExpression({
                        id: 'expr' + i,
                        latex: expr.latex || expr,
                        color: expr.color || '#2d70b3'
                    });
                });
            }

            // Set viewport
            if (config.viewport) {
                calculator.setMathBounds(config.viewport);
            } else {
                calculator.setMathBounds({left: -10, right: 10, bottom: -5, top: 5});
            }

            // Wait and capture
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const screenshot = await calculator.asyncScreenshot({
                width: this.canvas.width,
                height: this.canvas.height
            });

            // Draw to canvas
            const img = new Image();
            img.onload = () => {
                this.ctx.save();
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.drawImage(img, 0, 0);
                this.ctx.restore();
            };
            img.src = screenshot;

            // Cleanup
            calculator.destroy();
            document.body.removeChild(container);

        } catch (error) {
            console.error('Desmos failed, using fallback:', error);
            this.parseAndRenderFunction(config.expressions?.[0]?.latex || 'y=\\sin(x)', '#2d70b3');
        }
    }

    parseAndRenderFunction(latex, color = '#2d70b3') {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        
        // Parse coefficients and parameters from LaTeX
        if (latex.includes('sin')) {
            const ampMatch = latex.match(/(\d*\.?\d*)\\?sin/);
            const freqMatch = latex.match(/sin\((\d*\.?\d*)\*?x/);
            const amp = ampMatch ? parseFloat(ampMatch[1]) || 1 : 1;
            const freq = freqMatch ? parseFloat(freqMatch[1]) || 1 : 1;
            this.renderParametricSine(amp, freq);
        } else if (latex.includes('cos')) {
            const ampMatch = latex.match(/(\d*\.?\d*)\\?cos/);
            const freqMatch = latex.match(/cos\((\d*\.?\d*)\*?x/);
            const amp = ampMatch ? parseFloat(ampMatch[1]) || 1 : 1;
            const freq = freqMatch ? parseFloat(freqMatch[1]) || 1 : 1;
            this.renderParametricCosine(amp, freq);
        } else if (latex.includes('x^2') || latex.includes('x^{2}')) {
            const aMatch = latex.match(/([-\d*\.?\d*])\*?x\^/);
            const bMatch = latex.match(/\+\s*([-\d*\.?\d*])\*?x(?!\^)/);
            const cMatch = latex.match(/\+\s*([-\d*\.?\d*])(?!.*x)/);
            const a = aMatch ? parseFloat(aMatch[1]) : 1;
            const b = bMatch ? parseFloat(bMatch[1]) : 0;
            const c = cMatch ? parseFloat(cMatch[1]) : 0;
            this.renderQuadratic([a, b, c]);
        } else {
            // Linear or other
            const mMatch = latex.match(/([-\d*\.?\d*])\*?x/);
            const bMatch = latex.match(/\+\s*([-\d*\.?\d*])(?!.*x)/);
            const m = mMatch ? parseFloat(mMatch[1]) : 1;
            const b = bMatch ? parseFloat(bMatch[1]) : 0;
            this.renderLinearFunction(m, b);
        }
        
        // Always add axes
        this.renderPreciseAxis([-10, 10, -5, 5]);
    }

    renderParametricSine(amplitude = 1, frequency = 1) {
        this.ctx.beginPath();
        let first = true;
        for (let x = -10; x <= 10; x += 0.1) {
            const y = amplitude * Math.sin(frequency * x);
            const px = x * 20;
            const py = y * 30;
            
            if (first) {
                this.ctx.moveTo(px, py);
                first = false;
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        this.ctx.stroke();
    }

    renderParametricCosine(amplitude = 1, frequency = 1) {
        this.ctx.beginPath();
        let first = true;
        for (let x = -10; x <= 10; x += 0.1) {
            const y = amplitude * Math.cos(frequency * x);
            const px = x * 20;
            const py = y * 30;
            
            if (first) {
                this.ctx.moveTo(px, py);
                first = false;
            } else {
                this.ctx.lineTo(px, py);
            }
        }
        this.ctx.stroke();
    }

    renderLinearFunction(slope = 1, intercept = 0) {
        this.ctx.beginPath();
        const x1 = -10, y1 = slope * x1 + intercept;
        const x2 = 10, y2 = slope * x2 + intercept;
        this.ctx.moveTo(x1 * 20, y1 * 20);
        this.ctx.lineTo(x2 * 20, y2 * 20);
        this.ctx.stroke();
    }

    renderTable(coordinates, data) {
        if (!data || !data.rows) return;
        
        const [x, y, cellWidth, cellHeight] = coordinates;
        
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#333';
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        
        const startX = this.canvas.width/2 - (data.rows[0].length * cellWidth)/2;
        const startY = this.canvas.height/2 - (data.rows.length * cellHeight)/2;
        
        data.rows.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const cellX = startX + (colIndex * cellWidth);
                const cellY = startY + (rowIndex * cellHeight);
                
                // Draw cell border
                this.ctx.strokeRect(cellX, cellY, cellWidth, cellHeight);
                
                // Draw cell text
                this.ctx.fillText(cell, cellX + cellWidth/2, cellY + cellHeight/2 + 5);
            });
        });
        
        this.ctx.restore();
    }

    async loadDesmosAPI() {
        return new Promise((resolve, reject) => {
            if (window.Desmos) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://www.desmos.com/api/v1.9/calculator.js';
            script.onload = () => {
                console.log('Desmos API loaded successfully');
                resolve();
            };
            script.onerror = (e) => {
                console.error('Failed to load Desmos API:', e);
                reject(e);
            };
            document.head.appendChild(script);
        });
    }
}

// Initialize global diagram renderer
window.diagramRenderer = new DiagramRenderer();