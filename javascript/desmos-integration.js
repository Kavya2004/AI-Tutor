
class DesmosIntegration {
    constructor() {
        this.calculator = null;
        this.isInitialized = false;
        this.currentBoardType = 'teacher';
        this.graphContainer = null;
    }

    async initialize(boardType = 'teacher') {
        this.currentBoardType = boardType;
        

        if (!window.Desmos) {
            await this.loadDesmosAPI();
        }


        this.createGraphContainer(boardType);
        

        this.calculator = window.Desmos.GraphingCalculator(this.graphContainer, {
            keypad: false,
            expressions: false,
            settingsMenu: false,
            zoomButtons: false,
            expressionsTopbar: false,
            pointsOfInterest: true,
            trace: true,
            border: false,
            lockViewport: false,
            showGrid: true,
            showXAxis: true,
            showYAxis: true,
            xAxisNumbers: true,
            yAxisNumbers: true
        });

        this.isInitialized = true;
        this.setupEventListeners();
        
        return this.calculator;
    }

    async loadDesmosAPI() {
        return new Promise((resolve, reject) => {
            if (window.Desmos) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://www.desmos.com/api/v1.7/calculator.js?apikey=dcb31709b452b1cf9dc26972add0fda6';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createGraphContainer(boardType) {
        const panel = document.getElementById(boardType + 'Panel');
        if (!panel) return;


        const existing = panel.querySelector('.desmos-container');
        if (existing) {
            existing.remove();
        }


        this.graphContainer = document.createElement('div');
        this.graphContainer.className = 'desmos-container';
        this.graphContainer.style.cssText = `
            position: absolute;
            top: 80px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            z-index: 1000;
            display: none;
        `;


        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1001;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            font-size: 16px;
        `;
        closeBtn.onclick = () => this.hideGraph();

        this.graphContainer.appendChild(closeBtn);
        panel.appendChild(this.graphContainer);
    }

    setupEventListeners() {
        if (!this.calculator) return;


        this.calculator.observeEvent('change', () => {
            this.captureGraphToCanvas();
        });
    }

    showGraph() {
        if (this.graphContainer) {
            this.graphContainer.style.display = 'block';
            if (this.calculator) {
                this.calculator.resize();
            }
        }
    }

    hideGraph() {
        if (this.graphContainer) {
            this.graphContainer.style.display = 'none';
        }
    }

    async plotFunction(expression, options = {}) {
        if (!this.isInitialized) {
            await this.initialize(this.currentBoardType);
        }

        const config = {
            id: 'graph-' + Date.now(),
            latex: expression,
            color: options.color || '#2d70b3',
            lineStyle: options.lineStyle || 'SOLID',
            lineWidth: options.lineWidth || 2.5,
            ...options
        };

        this.calculator.setExpression(config);
        this.showGraph();
        
        return config.id;
    }

    async plotMultipleFunctions(expressions) {
        if (!this.isInitialized) {
            await this.initialize(this.currentBoardType);
        }

        const colors = ['#2d70b3', '#388c46', '#6042a6', '#000000', '#c74440'];
        
        expressions.forEach((expr, index) => {
            const config = {
                id: 'graph-' + Date.now() + '-' + index,
                latex: typeof expr === 'string' ? expr : expr.latex,
                color: (typeof expr === 'object' && expr.color) ? expr.color : colors[index % colors.length],
                lineStyle: (typeof expr === 'object' && expr.lineStyle) ? expr.lineStyle : 'SOLID',
                lineWidth: (typeof expr === 'object' && expr.lineWidth) ? expr.lineWidth : 2.5
            };
            
            this.calculator.setExpression(config);
        });

        this.showGraph();
    }

    setViewport(xmin, xmax, ymin, ymax) {
        if (this.calculator) {
            this.calculator.setMathBounds({
                left: xmin,
                right: xmax,
                bottom: ymin,
                top: ymax
            });
        }
    }

    addPoint(x, y, label = '', options = {}) {
        if (!this.calculator) return;

        const config = {
            id: 'point-' + Date.now(),
            latex: `(${x}, ${y})`,
            color: options.color || '#000000',
            size: options.size || 9,
            style: options.style || 'POINT',
            label: label,
            showLabel: !!label,
            ...options
        };

        this.calculator.setExpression(config);
    }

    clearGraph() {
        if (this.calculator) {
            this.calculator.setBlank();
        }
    }

    async captureGraphToCanvas() {
        if (!this.calculator || !this.graphContainer) return;

        try {
    
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = this.currentBoardType === 'teacher' ? window.teacherCanvas : window.studentCanvas;
            const ctx = this.currentBoardType === 'teacher' ? window.teacherCtx : window.studentCtx;
            
            if (!canvas || !ctx) return;

    
            const screenshot = await this.calculator.asyncScreenshot({
                width: canvas.width,
                height: canvas.height,
                targetPixelRatio: 1
            });

    
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
        
                if (typeof window.isAnythingDrawn !== 'undefined') {
                    window.isAnythingDrawn = true;
                }
            };
            img.src = screenshot;

        } catch (error) {
            console.error('Failed to capture graph:', error);
        }
    }

    // Preset graph types
    async plotQuadratic(a = 1, b = 0, c = 0) {
        const expression = `y = ${a}x^2 + ${b}x + ${c}`;
        return this.plotFunction(expression, { color: '#2d70b3' });
    }

    async plotLinear(m = 1, b = 0) {
        const expression = `y = ${m}x + ${b}`;
        return this.plotFunction(expression, { color: '#388c46' });
    }

    async plotSine(amplitude = 1, frequency = 1, phase = 0, vertical = 0) {
        const expression = `y = ${amplitude}\\sin(${frequency}x + ${phase}) + ${vertical}`;
        return this.plotFunction(expression, { color: '#6042a6' });
    }

    async plotCosine(amplitude = 1, frequency = 1, phase = 0, vertical = 0) {
        const expression = `y = ${amplitude}\\cos(${frequency}x + ${phase}) + ${vertical}`;
        return this.plotFunction(expression, { color: '#c74440' });
    }

    async plotExponential(base = Math.E, coefficient = 1, horizontal = 0, vertical = 0) {
        const expression = base === Math.E ? 
            `y = ${coefficient}e^{x + ${horizontal}} + ${vertical}` :
            `y = ${coefficient} \\cdot ${base}^{x + ${horizontal}} + ${vertical}`;
        return this.plotFunction(expression, { color: '#ff6600' });
    }

    async plotLogarithmic(base = Math.E, coefficient = 1, horizontal = 0, vertical = 0) {
        const expression = base === Math.E ?
            `y = ${coefficient}\\ln(x + ${horizontal}) + ${vertical}` :
            `y = ${coefficient}\\log_{${base}}(x + ${horizontal}) + ${vertical}`;
        return this.plotFunction(expression, { color: '#9900cc' });
    }

    // Statistical plots
    async plotNormalDistribution(mean = 0, stdDev = 1) {
        const expression = `y = \\frac{1}{${stdDev}\\sqrt{2\\pi}}e^{-\\frac{1}{2}\\left(\\frac{x-${mean}}{${stdDev}}\\right)^2}`;
        return this.plotFunction(expression, { color: '#2d70b3' });
    }

    async plotScatterPlot(points) {
        if (!Array.isArray(points)) return;
        
        points.forEach((point, index) => {
            if (Array.isArray(point) && point.length >= 2) {
                this.addPoint(point[0], point[1], point[2] || '', {
                    color: '#2d70b3',
                    size: 8
                });
            }
        });
    }
}

// Initialize Desmos integration
window.desmosIntegration = new DesmosIntegration();

// Export for use in other modules
window.DesmosIntegration = DesmosIntegration;