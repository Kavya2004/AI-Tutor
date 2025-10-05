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
    
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const urlPlaceholder = 'URLPROTECTED'; 
    let urlMap = new Map();
    let placeholderIndex = 0;

    let result = text.replace(urlRegex, (url) => {
        const placeholder = `${urlPlaceholder}${placeholderIndex++}`;
        urlMap.set(placeholder, url);
        return placeholder;
    });

    // Convert markdown-style formatting
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // **bold**
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>'); // *italic*
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>'); // `code`
    result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>'); // ~~strikethrough~~

    for (const [latex, unicode] of Object.entries(symbolMap)) {
        result = result.replace(new RegExp(latex.replace('\\', '\\\\'), 'g'), unicode);
    }
    
    result = result.replace(/\^{([^}]+)}/g, (match, content) => {
        return content.split('').map(char => superscriptMap[char] || char).join('');
    });
    result = result.replace(/\^([a-zA-Z0-9+\-=()])/g, (match, char) => {
        return superscriptMap[char] || char;
    });
    
    result = result.replace(/_{([^}]+)}/g, (match, content) => {
        return content.split('').map(char => subscriptMap[char] || char).join('');
    });
    result = result.replace(/_([a-zA-Z0-9+\-=()])/g, (match, char) => {
        return subscriptMap[char] || char;
    });
    
    // Restore URLs as clickable links
    for (const [placeholder, url] of urlMap) {
        result = result.replace(new RegExp(placeholder, 'g'), `<a href="${url}" target="_blank">${url}</a>`);
    }
    
    return result;
}

window.convertLatexToUnicode = convertLatexToUnicode;