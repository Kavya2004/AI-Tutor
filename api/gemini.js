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
  const rateLimitResult = checkRateLimit('gemini', req);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter
    });
  }

  try {
      // Validate request structure
      const validation = validateRequest(req, ['messages']);
      if (!validation.valid) {
          return res.status(400).json({ error: 'Invalid request', details: validation.errors });
      }

      // Sanitize input
      const { messages } = sanitizeInput(req.body);
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: 'Valid messages array is required' });
      }

      // Validate messages structure
      for (const msg of messages) {
          if (!msg.role || !msg.content || typeof msg.content !== 'string') {
              return res.status(400).json({ error: 'Invalid message format' });
          }
      }

      // Validate API keys at runtime
      const keyValidation = validateRuntimeKeys(['GEMINI_API_KEY']);
      if (!keyValidation.valid) {

          return res.status(500).json({ error: 'API configuration error' });
      }

      const apiKey = process.env.GEMINI_API_KEY;

       const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

      const geminiMessages = messages
          .filter(msg => msg.role !== 'system')
          .map(msg => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
          }));

      const systemMessage = messages.find(msg => msg.role === 'system');
      if (systemMessage && geminiMessages.length > 0) {
          if (geminiMessages[0].role === 'user') {
              geminiMessages[0].parts[0].text = `${systemMessage.content}\n\nUser: ${geminiMessages[0].parts[0].text}`;
          }
      }

      const requestBody = {
          contents: geminiMessages,
          generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 65536,
          }
      };


      
      const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
          const errorText = await response.text();

          
          if (response.status === 404) {
              throw new Error('Gemini API endpoint not found. Check the model name.');
          } else if (response.status === 401 || response.status === 403) {
              throw new Error('Invalid API key or insufficient permissions.');
          } else {
              throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
          }
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {

          throw new Error('No response generated from Gemini');
      }


      res.status(200).json({ response: generatedText });

  } catch (error) {
      const errorResponse = createErrorResponse(error, true);
      res.status(500).json({
          error: 'Failed to get response from Gemini',
          ...errorResponse
      });
  }
}