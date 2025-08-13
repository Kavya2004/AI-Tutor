// Link validation utility for textbook references
class LinkValidator {
    constructor() {
        this.checkedLinks = new Map(); // Cache for checked links
    }

    // Check if a link is accessible
    async isLinkValid(url) {
        // Return cached result if available
        if (this.checkedLinks.has(url)) {
            return this.checkedLinks.get(url);
        }

        try {
            // Use a simple fetch with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors' // Handle CORS issues
            });
            
            clearTimeout(timeoutId);
            
            // For no-cors mode, we can't check status, so assume valid if no error
            const isValid = true;
            this.checkedLinks.set(url, isValid);
            return isValid;
            
        } catch (error) {
            console.warn(`Link validation failed for ${url}:`, error.message);
            this.checkedLinks.set(url, false);
            return false;
        }
    }

    // Process textbook references in bot messages
    async processTextbookReferences(messageText) {
        // Look for URLs in the message
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = messageText.match(urlRegex) || [];
        
        let processedText = messageText;
        
        for (const url of urls) {
            const isValid = await this.isLinkValid(url);
            
            if (!isValid) {
                // Replace broken link with helpful message
                const linkText = this.extractLinkText(url);
                const replacement = `📚 ${linkText} (Link temporarily unavailable - concept explained below)`;
                processedText = processedText.replace(url, replacement);
            }
        }
        
        return processedText;
    }

    // Extract meaningful text from URL
    extractLinkText(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            
            // Extract section name from path
            const sections = pathname.split('/').filter(s => s.length > 0);
            if (sections.length > 0) {
                const lastSection = sections[sections.length - 1];
                // Convert URL-friendly names to readable text
                return lastSection
                    .replace(/[-_]/g, ' ')
                    .replace(/\.(html?|php)$/i, '')
                    .replace(/\b\w/g, l => l.toUpperCase());
            }
            
            return 'Textbook Reference';
        } catch {
            return 'Textbook Reference';
        }
    }

    // Add helpful context for broken links
    addBrokenLinkContext(messageText) {
        if (messageText.includes('temporarily unavailable')) {
            return messageText + '\n\n💡 *Note: I can explain these concepts directly if you have questions about the material.*';
        }
        return messageText;
    }
}

// Create global instance
window.linkValidator = new LinkValidator();

// Function to process bot messages with link validation
window.processBotMessageWithLinkValidation = async function(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        return messageText;
    }
    
    try {
        let processedText = await window.linkValidator.processTextbookReferences(messageText);
        processedText = window.linkValidator.addBrokenLinkContext(processedText);
        return processedText;
    } catch (error) {
        console.warn('Link validation error:', error);
        return messageText; // Return original text if validation fails
    }
};