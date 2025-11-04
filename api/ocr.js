import { checkRateLimit, sanitizeInput, validateRequest, createErrorResponse } from '../middleware/security.js';
import { validateRuntimeKeys } from '../config/env-validator.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Apply rate limiting
    const rateLimitResult = checkRateLimit('ocr', req);
    if (!rateLimitResult.allowed) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
        });
    }
    
    try {
        // Validate request structure
        const validation = validateRequest(req, ['image']);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Invalid request', details: validation.errors });
        }

        // Sanitize input
        const { image } = sanitizeInput(req.body);
        
        if (!image || typeof image !== 'string') {
            return res.status(400).json({ error: 'Valid image data is required' });
        }

        // Validate image format
        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        // Validate API keys at runtime
        const keyValidation = validateRuntimeKeys(['MATHPIX_APP_ID', 'MATHPIX_APP_KEY']);
        if (!keyValidation.valid) {
            console.error('API key validation failed:', keyValidation.errors);
            return res.status(500).json({ error: 'API configuration error' });
        }
        
        // Log credentials securely (only lengths for debugging)
        console.log('OCR API credentials validated:', {
            appIdLength: process.env.MATHPIX_APP_ID?.length,
            appKeyLength: process.env.MATHPIX_APP_KEY?.length
        });
        
        const response = await fetch('https://api.mathpix.com/v3/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'app_id': process.env.MATHPIX_APP_ID,
                'app_key': process.env.MATHPIX_APP_KEY,
            },
            body: JSON.stringify({
                src: image,
                formats: ['text', 'latex_styled'],
                data_options: {
                    include_asciimath: true,
                    include_latex: true
                }
            })
        });

        const result = await response.json();
        
        // Log the full Mathpix response
        console.log('Mathpix response:', JSON.stringify(result, null, 2));
        
        if (result.error) {
            console.error('Mathpix error details:', result);
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
        
    } catch (error) {
        const errorResponse = createErrorResponse(error, true);
        res.status(500).json({
            error: 'OCR processing failed',
            ...errorResponse
        });
    }
}
