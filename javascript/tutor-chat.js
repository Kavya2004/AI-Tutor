let isProcessing = false;
let context = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

function initializeChat() {
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');
    
    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', handleKeyPress);
    }
    
    addMessage("Hi there! I'm your probability tutor! Ask me anything about probability and statistics!", 'bot');
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendMessage();
    }
}

function handleSendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message && !isProcessing) {
        processUserMessage(message);
        input.value = '';
    }
}

function addMessage(text, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message slide-in`;
    
    // Create message structure
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'bot' ? '🤖' : '👤';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text.replace(/\n/g, '<br>');
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

async function processUserMessage(message) {
    if (isProcessing || !message.trim()) return;

    isProcessing = true;
    addMessage(message, 'user');
    showLoading();

    try {
        // Create a proper tutor prompt with better formatting
        const tutorPrompt = `You are a friendly probability and statistics tutor. Please explain the following question in simple, clear terms suitable for a student:

Question: ${message}

Please provide a concise but helpful explanation focusing on the key concepts.`;

        // Increase timeout to 30 seconds and add better error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        console.log('Sending request to server...');
        
        const response = await fetch('http://localhost:8000/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
                messages: [{ 
                    role: 'user', 
                    content: tutorPrompt 
                }],
                temperature: 0.7,  // Higher temperature for more natural responses
                max_tokens: 200    // Increased token limit for better responses
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Received data:', data);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid response structure:', data);
            throw new Error('Invalid response format from server');
        }

        let botResponse = data.choices[0].message.content.trim();
        
        // Better fallback response
        if (!botResponse || botResponse.length < 5) {
            botResponse = `I understand you're asking about "${message}". Let me try to help! This relates to probability and statistics concepts. Could you be more specific about what aspect you'd like me to explain?`;
        }

        // Add to context for next interaction (keep last 4 messages)
        context.push({ role: 'user', content: message });
        context.push({ role: 'assistant', content: botResponse });
        if (context.length > 8) {
            context = context.slice(-8);
        }

        // Check for whiteboard actions
        let action = null;
        const actionMatch = botResponse.match(/\[ACTION:\s*(\w+)\]/);
        if (actionMatch) {
            action = { type: actionMatch[1] };
            botResponse = botResponse.replace(/\[ACTION:\s*\w+\]/, '').trim();
        }

        // Suggest whiteboard actions for common topics
        if (!action) {
            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('probability scale') || lowerMessage.includes('scale')) {
                action = { type: 'draw_probability_scale' };
                botResponse += "\n\n[Drawing probability scale on whiteboard...]";
            } else if (lowerMessage.includes('distribution') || lowerMessage.includes('histogram')) {
                action = { type: 'draw_distribution' };
                botResponse += "\n\n[Drawing distribution on whiteboard...]";
            } else if (lowerMessage.includes('normal') || lowerMessage.includes('bell curve')) {
                action = { type: 'draw_normal_curve' };
                botResponse += "\n\n[Drawing normal curve on whiteboard...]";
            } else if (lowerMessage.includes('tree') || lowerMessage.includes('conditional')) {
                action = { type: 'draw_tree_diagram' };
                botResponse += "\n\n[Drawing tree diagram on whiteboard...]";
            }
        }

        addMessage(botResponse, 'bot');
        
        // Execute whiteboard action if available
        if (action && window.tutorWhiteboard) {
            setTimeout(() => executeWhiteboardAction(action.type), 500);
        }

    } catch (error) {
        console.error('Error processing message:', error);
        let errorMessage = 'I apologize, but I encountered an issue. ';
        
        if (error.name === 'AbortError') {
            errorMessage += 'The request took too long to process. Please try asking a shorter or simpler question.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
            errorMessage += 'I cannot connect to the AI server. Please make sure the server is running on localhost:8000 and try again.';
        } else if (error.message.includes('Server error')) {
            errorMessage += 'The AI server encountered an error. Please check the server logs and try again.';
        } else {
            errorMessage += 'Please try rephrasing your question or check if the server is running properly.';
        }
        
        addMessage(errorMessage, 'bot');
    }

    hideLoading();
    isProcessing = false;
}

function executeWhiteboardAction(actionType) {
    if (!window.tutorWhiteboard) {
        console.log('Whiteboard not available');
        return;
    }

    switch(actionType) {
        case 'draw_probability_scale':
            if (window.tutorWhiteboard.drawProbabilityScale) {
                window.tutorWhiteboard.drawProbabilityScale();
            }
            break;
        case 'draw_distribution':
            if (window.tutorWhiteboard.drawSampleDistribution) {
                window.tutorWhiteboard.drawSampleDistribution();
            }
            break;
        case 'draw_normal_curve':
            if (window.tutorWhiteboard.drawNormalCurve) {
                window.tutorWhiteboard.drawNormalCurve();
            }
            break;
        case 'draw_tree_diagram':
            if (window.tutorWhiteboard.drawTreeDiagram) {
                window.tutorWhiteboard.drawTreeDiagram();
            }
            break;
        default:
            console.log('Unknown whiteboard action:', actionType);
    }
}

function handleDiceResult(result) {
    const message = `I rolled a ${result}! What does this tell us about probability?`;
    processUserMessage(message);
}