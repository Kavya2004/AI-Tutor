// Smart Graph Generator - Interprets user requests and generates appropriate graphs
class SmartGraphGenerator {
    constructor() {
        this.graphPatterns = {
            quadratic: /(?:quadratic|parabola|x\^2|x²|y\s*=.*x\^2)/i,
            linear: /(?:linear|line|slope|y\s*=.*x(?!\^))/i,
            sine: /(?:sine|sin|sinusoidal)/i,
            cosine: /(?:cosine|cos)/i,
            exponential: /(?:exponential|exp|e\^|growth|decay)/i,
            logarithmic: /(?:logarithm|log|ln)/i,
            polynomial: /(?:polynomial|cubic|x\^3|x³)/i,
            circle: /(?:circle|x\^2\s*\+\s*y\^2)/i,
            hyperbola: /(?:hyperbola|xy\s*=)/i,
            normal: /(?:normal distribution|bell curve|gaussian)/i,
            scatter: /(?:scatter|plot points|data points)/i
        };
        
        this.functionExtractor = /y\s*=\s*([^,\n]+)/gi;
        this.equationExtractor = /([xy]\^?\d*[\+\-\*/\d\s]*=[\+\-\*/\d\s]*[xy]\^?\d*)/gi;
    }

    async processUserRequest(text, boardType = 'teacher') {

        
        // Extract mathematical expressions
        const expressions = this.extractExpressions(text);

        
        if (expressions.length > 0) {
            return await this.generateFromExpressions(expressions, boardType);
        }
        
        // Detect graph type from patterns
        const graphType = this.detectGraphType(text);

        
        if (graphType) {
            return await this.generateFromType(graphType, text, boardType);
        }
        
        // Try to generate a general mathematical visualization
        return await this.generateGeneralGraph(text, boardType);
    }

    extractExpressions(text) {
        const expressions = [];
        
        // Extract y = ... expressions
        let match;
        this.functionExtractor.lastIndex = 0;
        while ((match = this.functionExtractor.exec(text)) !== null) {
            expressions.push({
                type: 'function',
                expression: match[1].trim(),
                full: match[0]
            });
        }
        
        // Extract general equations
        this.equationExtractor.lastIndex = 0;
        while ((match = this.equationExtractor.exec(text)) !== null) {
            expressions.push({
                type: 'equation',
                expression: match[1].trim(),
                full: match[0]
            });
        }
        
        return expressions;
    }

    detectGraphType(text) {
        for (const [type, pattern] of Object.entries(this.graphPatterns)) {
            if (pattern.test(text)) {
                return type;
            }
        }
        return null;
    }

    async generateFromExpressions(expressions, boardType) {
        try {
            if (!window.desmosIntegration) {
                throw new Error('Desmos integration not available');
            }

            await window.desmosIntegration.initialize(boardType);
            
            const processedExpressions = expressions.map(expr => {
                let latex = this.convertToLatex(expr.expression);
                return {
                    latex: latex,
                    color: this.getColorForExpression(expr.expression)
                };
            });

            if (processedExpressions.length === 1) {
                await window.desmosIntegration.plotFunction(
                    processedExpressions[0].latex,
                    { color: processedExpressions[0].color }
                );
            } else {
                await window.desmosIntegration.plotMultipleFunctions(processedExpressions);
            }

            return {
                success: true,
                message: `Generated graph for: ${expressions.map(e => e.full).join(', ')}`,
                type: 'expressions'
            };
        } catch (error) {

            return {
                success: false,
                message: 'Failed to generate graph from expressions: ' + error.message
            };
        }
    }

    async generateFromType(graphType, text, boardType) {
        try {
            if (!window.desmosIntegration) {
                throw new Error('Desmos integration not available');
            }

            await window.desmosIntegration.initialize(boardType);
            
            let result;
            
            switch (graphType) {
                case 'quadratic':
                    result = await this.generateQuadratic(text, boardType);
                    break;
                case 'linear':
                    result = await this.generateLinear(text, boardType);
                    break;
                case 'sine':
                    result = await this.generateSine(text, boardType);
                    break;
                case 'cosine':
                    result = await this.generateCosine(text, boardType);
                    break;
                case 'exponential':
                    result = await this.generateExponential(text, boardType);
                    break;
                case 'logarithmic':
                    result = await this.generateLogarithmic(text, boardType);
                    break;
                case 'normal':
                    result = await this.generateNormalDistribution(text, boardType);
                    break;
                case 'circle':
                    result = await this.generateCircle(text, boardType);
                    break;
                default:
                    result = await this.generateDefault(graphType, boardType);
            }

            return {
                success: true,
                message: `Generated ${graphType} graph`,
                type: graphType,
                ...result
            };
        } catch (error) {

            return {
                success: false,
                message: 'Failed to generate graph: ' + error.message
            };
        }
    }

    async generateQuadratic(text, boardType) {
        // Extract coefficients if provided
        const aMatch = text.match(/a\s*=\s*([-\d\.]+)/i);
        const bMatch = text.match(/b\s*=\s*([-\d\.]+)/i);
        const cMatch = text.match(/c\s*=\s*([-\d\.]+)/i);
        
        const a = aMatch ? parseFloat(aMatch[1]) : 1;
        const b = bMatch ? parseFloat(bMatch[1]) : 0;
        const c = cMatch ? parseFloat(cMatch[1]) : 0;
        
        await window.desmosIntegration.plotQuadratic(a, b, c);
        
        // Set appropriate viewport
        window.desmosIntegration.setViewport(-10, 10, -10, 10);
        
        return { coefficients: { a, b, c } };
    }

    async generateLinear(text, boardType) {
        // Extract slope and y-intercept
        const mMatch = text.match(/(?:slope|m)\s*=\s*([-\d\.]+)/i);
        const bMatch = text.match(/(?:intercept|b)\s*=\s*([-\d\.]+)/i);
        
        const m = mMatch ? parseFloat(mMatch[1]) : 1;
        const b = bMatch ? parseFloat(bMatch[1]) : 0;
        
        await window.desmosIntegration.plotLinear(m, b);
        
        window.desmosIntegration.setViewport(-10, 10, -10, 10);
        
        return { slope: m, intercept: b };
    }

    async generateSine(text, boardType) {
        // Extract amplitude, frequency, phase
        const ampMatch = text.match(/(?:amplitude|A)\s*=\s*([-\d\.]+)/i);
        const freqMatch = text.match(/(?:frequency|f|period)\s*=\s*([-\d\.]+)/i);
        const phaseMatch = text.match(/(?:phase|shift)\s*=\s*([-\d\.]+)/i);
        
        const amplitude = ampMatch ? parseFloat(ampMatch[1]) : 1;
        const frequency = freqMatch ? parseFloat(freqMatch[1]) : 1;
        const phase = phaseMatch ? parseFloat(phaseMatch[1]) : 0;
        
        await window.desmosIntegration.plotSine(amplitude, frequency, phase);
        
        window.desmosIntegration.setViewport(-2*Math.PI, 2*Math.PI, -amplitude*1.5, amplitude*1.5);
        
        return { amplitude, frequency, phase };
    }

    async generateCosine(text, boardType) {
        const ampMatch = text.match(/(?:amplitude|A)\s*=\s*([-\d\.]+)/i);
        const freqMatch = text.match(/(?:frequency|f|period)\s*=\s*([-\d\.]+)/i);
        const phaseMatch = text.match(/(?:phase|shift)\s*=\s*([-\d\.]+)/i);
        
        const amplitude = ampMatch ? parseFloat(ampMatch[1]) : 1;
        const frequency = freqMatch ? parseFloat(freqMatch[1]) : 1;
        const phase = phaseMatch ? parseFloat(phaseMatch[1]) : 0;
        
        await window.desmosIntegration.plotCosine(amplitude, frequency, phase);
        
        window.desmosIntegration.setViewport(-2*Math.PI, 2*Math.PI, -amplitude*1.5, amplitude*1.5);
        
        return { amplitude, frequency, phase };
    }

    async generateExponential(text, boardType) {
        const baseMatch = text.match(/(?:base|b)\s*=\s*([-\d\.]+)/i);
        const coeffMatch = text.match(/(?:coefficient|a)\s*=\s*([-\d\.]+)/i);
        
        const base = baseMatch ? parseFloat(baseMatch[1]) : Math.E;
        const coefficient = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
        
        await window.desmosIntegration.plotExponential(base, coefficient);
        
        window.desmosIntegration.setViewport(-5, 5, -2, 10);
        
        return { base, coefficient };
    }

    async generateLogarithmic(text, boardType) {
        const baseMatch = text.match(/(?:base|b)\s*=\s*([-\d\.]+)/i);
        const coeffMatch = text.match(/(?:coefficient|a)\s*=\s*([-\d\.]+)/i);
        
        const base = baseMatch ? parseFloat(baseMatch[1]) : Math.E;
        const coefficient = coeffMatch ? parseFloat(coeffMatch[1]) : 1;
        
        await window.desmosIntegration.plotLogarithmic(base, coefficient);
        
        window.desmosIntegration.setViewport(0.1, 10, -5, 5);
        
        return { base, coefficient };
    }

    async generateNormalDistribution(text, boardType) {
        const meanMatch = text.match(/(?:mean|μ|mu)\s*=\s*([-\d\.]+)/i);
        const stdMatch = text.match(/(?:std|σ|sigma|deviation)\s*=\s*([-\d\.]+)/i);
        
        const mean = meanMatch ? parseFloat(meanMatch[1]) : 0;
        const stdDev = stdMatch ? parseFloat(stdMatch[1]) : 1;
        
        await window.desmosIntegration.plotNormalDistribution(mean, stdDev);
        
        const range = stdDev * 4;
        window.desmosIntegration.setViewport(mean - range, mean + range, -0.1, 0.5);
        
        return { mean, stdDev };
    }

    async generateCircle(text, boardType) {
        const radiusMatch = text.match(/(?:radius|r)\s*=\s*([-\d\.]+)/i);
        const centerXMatch = text.match(/(?:center|h)\s*=\s*([-\d\.]+)/i);
        const centerYMatch = text.match(/(?:center|k)\s*=\s*([-\d\.]+)/i);
        
        const radius = radiusMatch ? parseFloat(radiusMatch[1]) : 5;
        const centerX = centerXMatch ? parseFloat(centerXMatch[1]) : 0;
        const centerY = centerYMatch ? parseFloat(centerYMatch[1]) : 0;
        
        const expression = `(x - ${centerX})^2 + (y - ${centerY})^2 = ${radius * radius}`;
        await window.desmosIntegration.plotFunction(expression);
        
        const range = radius * 1.5;
        window.desmosIntegration.setViewport(
            centerX - range, centerX + range,
            centerY - range, centerY + range
        );
        
        return { radius, centerX, centerY };
    }

    async generateDefault(graphType, boardType) {
        // Generate a default example for the graph type
        const defaults = {
            polynomial: 'y = x^3 - 3x^2 + 2x + 1',
            hyperbola: 'xy = 1',
            circle: 'x^2 + y^2 = 25'
        };
        
        const expression = defaults[graphType] || 'y = x';
        await window.desmosIntegration.plotFunction(expression);
        
        return { expression };
    }

    async generateGeneralGraph(text, boardType) {
        // Try to create a relevant mathematical visualization
        try {
            if (!window.desmosIntegration) {
                throw new Error('Desmos integration not available');
            }

            await window.desmosIntegration.initialize(boardType);
            
            // Default to a simple coordinate system with some basic functions
            await window.desmosIntegration.plotMultipleFunctions([
                { latex: 'y = x', color: '#2d70b3' },
                { latex: 'y = x^2', color: '#388c46' },
                { latex: 'y = \\sin(x)', color: '#6042a6' }
            ]);
            
            window.desmosIntegration.setViewport(-10, 10, -10, 10);
            
            return {
                success: true,
                message: 'Generated general mathematical visualization',
                type: 'general'
            };
        } catch (error) {

            return {
                success: false,
                message: 'Failed to generate graph: ' + error.message
            };
        }
    }

    convertToLatex(expression) {
        // Convert common mathematical notation to LaTeX
        let latex = expression
            .replace(/\^(\d+)/g, '^{$1}')  // x^2 -> x^{2}
            .replace(/\*\*/g, '^')         // ** -> ^
            .replace(/\bsin\b/g, '\\sin')  // sin -> \sin
            .replace(/\bcos\b/g, '\\cos')  // cos -> \cos
            .replace(/\btan\b/g, '\\tan')  // tan -> \tan
            .replace(/\bln\b/g, '\\ln')    // ln -> \ln
            .replace(/\blog\b/g, '\\log')  // log -> \log
            .replace(/\bsqrt\b/g, '\\sqrt') // sqrt -> \sqrt
            .replace(/\bpi\b/g, '\\pi')    // pi -> \pi
            .replace(/\be\b/g, 'e')        // e -> e
            .replace(/\*/g, '\\cdot')      // * -> \cdot (for multiplication)
            .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}'); // sqrt(x) -> \sqrt{x}
        
        return latex;
    }

    getColorForExpression(expression) {
        // Assign colors based on expression characteristics
        const colors = ['#2d70b3', '#388c46', '#6042a6', '#c74440', '#ff6600'];
        
        if (expression.includes('sin')) return '#2d70b3';
        if (expression.includes('cos')) return '#388c46';
        if (expression.includes('x^2') || expression.includes('x²')) return '#6042a6';
        if (expression.includes('exp') || expression.includes('e^')) return '#c74440';
        if (expression.includes('log') || expression.includes('ln')) return '#ff6600';
        
        // Default color rotation
        const hash = expression.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        return colors[Math.abs(hash) % colors.length];
    }

    // Quick graph generation methods
    async quickLinear(slope = 1, intercept = 0, boardType = 'teacher') {
        await window.desmosIntegration.initialize(boardType);
        await window.desmosIntegration.plotLinear(slope, intercept);
        return { success: true, type: 'linear', slope, intercept };
    }

    async quickQuadratic(a = 1, b = 0, c = 0, boardType = 'teacher') {
        await window.desmosIntegration.initialize(boardType);
        await window.desmosIntegration.plotQuadratic(a, b, c);
        return { success: true, type: 'quadratic', a, b, c };
    }

    async quickTrig(type = 'sine', amplitude = 1, frequency = 1, boardType = 'teacher') {
        await window.desmosIntegration.initialize(boardType);
        
        if (type === 'sine') {
            await window.desmosIntegration.plotSine(amplitude, frequency);
        } else {
            await window.desmosIntegration.plotCosine(amplitude, frequency);
        }
        
        return { success: true, type, amplitude, frequency };
    }
}

// Initialize smart graph generator
window.smartGraphGenerator = new SmartGraphGenerator();

// Export for use in other modules
window.SmartGraphGenerator = SmartGraphGenerator;