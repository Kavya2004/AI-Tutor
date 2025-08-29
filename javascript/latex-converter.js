function convertLatexToUnicode(text) {
    // Basic superscript conversion
    const superscriptMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
    };
    
    // Basic subscript conversion
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
        'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
        'v': 'ᵥ', 'x': 'ₓ'
    };
    
    // Greek letters and symbols
    const symbolMap = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
        '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
        '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
        '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
        '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
        '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
        '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
        '\\Psi': 'Ψ', '\\Omega': 'Ω',
        '\\infty': '∞', '\\pm': '±', '\\mp': '∓',
        '\\times': '×', '\\div': '÷', '\\cdot': '·',
        '\\leq': '≤', '\\geq': '≥', '\\neq': '≠',
        '\\approx': '≈', '\\equiv': '≡', '\\propto': '∝',
        '\\subset': '⊂', '\\supset': '⊃', '\\in': '∈',
        '\\notin': '∉', '\\cup': '∪', '\\cap': '∩',
        '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
        '\\sqrt': '√', '\\partial': '∂', '\\nabla': '∇'
    };
    
    // Protect URLs from LaTeX processing
    const urlRegex = /https:\/\/www\.probabilitycourse\.com\/chapter\d+\/[\w_.-]+/g;
    const urlPlaceholder = '__URL_PROTECTED__';
    let urlMap = new Map();
    let placeholderIndex = 0;

    // Step 1: Extract and replace URLs with placeholders
    let result = text.replace(urlRegex, (url) => {
        const placeholder = `${urlPlaceholder}${placeholderIndex++}`;
        urlMap.set(placeholder, url);
        return placeholder;
    });

    // Step 2: Convert Greek letters and symbols
    for (const [latex, unicode] of Object.entries(symbolMap)) {
        result = result.replace(new RegExp(latex.replace('\\', '\\\\'), 'g'), unicode);
    }
    
    // Step 3: Convert superscripts (^{...} or ^single_char)
    result = result.replace(/\^{([^}]+)}/g, (match, content) => {
        return content.split('').map(char => superscriptMap[char] || char).join('');
    });
    result = result.replace(/\^([a-zA-Z0-9+\-=()])/g, (match, char) => {
        return superscriptMap[char] || char;
    });
    
    // Step 4: Convert subscripts (_{...} or _single_char)
    result = result.replace(/_{([^}]+)}/g, (match, content) => {
        return content.split('').map(char => subscriptMap[char] || char).join('');
    });
    result = result.replace(/_([a-zA-Z0-9+\-=()])/g, (match, char) => {
        return subscriptMap[char] || char;
    });
    
    // Step 5: Restore protected URLs
    for (const [placeholder, url] of urlMap) {
        result = result.replace(placeholder, url);
    }
    
    return result;
}

window.convertLatexToUnicode = convertLatexToUnicode;