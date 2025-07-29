// api/gemini.js (create this file in your Vercel project)
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
  
    try {
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }
  
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
      }
  
      const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
  
      // Convert messages to Gemini format
      const geminiMessages = messages
        .filter(msg => msg.role !== 'system') // Gemini doesn't use system messages the same way
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
  
      // Add system message as context if it exists
      const systemMessage = messages.find(msg => msg.role === 'system');
      if (systemMessage && geminiMessages.length > 0) {
        // Prepend system context to first user message
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
          maxOutputTokens: 1024,
        }
      };
  
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
  
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', response.status, errorData);
        throw new Error(`Gemini API error: ${response.status}`);
      }
  
      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!generatedText) {
        throw new Error('No response generated from Gemini');
      }
  
      res.status(200).json({ response: generatedText });
  
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      res.status(500).json({ 
        error: 'Failed to get response from Gemini',
        details: error.message 
      });
    }
  }