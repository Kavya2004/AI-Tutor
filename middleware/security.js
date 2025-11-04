// Security middleware for API endpoints
const rateLimitMap = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
    gemini: { requests: 10, window: 60000 }, // 10 requests per minute
    ocr: { requests: 5, window: 60000 },     // 5 requests per minute
    search: { requests: 20, window: 60000 }   // 20 requests per minute
};

// Get client identifier
function getClientId(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           req.ip || 
           'unknown';
}

// Rate limiting function
export function checkRateLimit(endpoint, req) {
    const clientId = getClientId(req);
    const key = `${endpoint}:${clientId}`;
    const limit = RATE_LIMITS[endpoint];
    
    if (!limit) {
        return { allowed: true };
    }

    const now = Date.now();
    const windowStart = now - limit.window;

    // Get existing requests for this client
    let requests = rateLimitMap.get(key) || [];
    
    // Filter out old requests
    requests = requests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (requests.length >= limit.requests) {
        const retryAfter = Math.ceil((requests[0] + limit.window - now) / 1000);
        return { 
            allowed: false, 
            retryAfter,
            remaining: 0
        };
    }

    // Add current request
    requests.push(now);
    rateLimitMap.set(key, requests);
    
    return { 
        allowed: true, 
        remaining: limit.requests - requests.length 
    };
}

// Sanitize input data
export function sanitizeInput(data) {
    if (typeof data === 'string') {
        return data.trim().substring(0, 10000); // Limit string length
    }
    if (Array.isArray(data)) {
        return data.slice(0, 50).map(sanitizeInput); // Limit array size
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof key === 'string' && key.length < 100) {
                sanitized[key] = sanitizeInput(value);
            }
        }
        return sanitized;
    }
    return data;
}

// Validate request structure
export function validateRequest(req, requiredFields = []) {
    const errors = [];

    // Check content type for POST requests
    if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
        errors.push('Content-Type must be application/json');
    }

    // Check required fields
    for (const field of requiredFields) {
        if (!req.body || req.body[field] === undefined || req.body[field] === null) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    // Check body size (rough estimate)
    const bodyStr = JSON.stringify(req.body || {});
    if (bodyStr.length > 1000000) { // 1MB limit
        errors.push('Request body too large');
    }

    return { valid: errors.length === 0, errors };
}

// Secure error response
export function createErrorResponse(error, includeDetails = false) {
    const response = {
        error: 'An error occurred',
        timestamp: new Date().toISOString()
    };

    if (includeDetails && process.env.NODE_ENV !== 'production') {
        response.details = error.message;
    }

    // Log error securely (without sensitive data)
    console.error('API Error:', {
        message: error.message,
        timestamp: response.timestamp,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });

    return response;
}

// Clean up rate limit map periodically
setInterval(() => {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(l => l.window));
    
    for (const [key, requests] of rateLimitMap.entries()) {
        const validRequests = requests.filter(time => now - time < maxWindow);
        if (validRequests.length === 0) {
            rateLimitMap.delete(key);
        } else {
            rateLimitMap.set(key, validRequests);
        }
    }
}, 300000); // Clean every 5 minutes