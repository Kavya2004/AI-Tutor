// api/diagram.js - Cloud-based math diagram generator with Gemini AI
export default async function handler(req, res) {
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
    const { question, context } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Enhanced prompt for diagram generation
    const diagramPrompt = `You are a creative math diagram generator. You can draw ANYTHING by combining basic shapes and functions. Be creative!

Question: ${question}
${context ? `Context: ${context}` : ''}

Available tools: line, circle, rectangle, point, curve, axis, arrow, quadratic, function

For ANY mathematical concept, create a visual using these tools:
- Parabolas: {"type": "quadratic", "coordinates": [a, b, c, xMin, xMax]}
- Functions: {"type": "function", "coordinates": {"type": "sine|cosine|linear", "coefficients": [a,b,c], "domain": [min,max]}}
- Shapes: {"type": "circle|rectangle|line", "coordinates": [...]}
- Axes: {"type": "axis", "coordinates": [xMin, xMax, yMin, yMax]}

Respond with JSON:
{
  "needsDiagram": true,
  "instructions": {
    "title": "Title",
    "elements": [{"type": "...", "coordinates": [...], "color": "blue|red|green|black"}],
    "explanation": "What this shows"
  }
}

Be creative! You can draw anything - houses, trees, faces, abstract art - using these basic tools.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: diagramPrompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('No response generated from Gemini');
    }

    // Try to parse JSON response
    let diagramData;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) || 
                       generatedText.match(/```\n([\s\S]*?)\n```/) ||
                       [null, generatedText];
      
      diagramData = JSON.parse(jsonMatch[1] || generatedText);
    } catch (parseError) {
      // If JSON parsing fails, create a simple response
      diagramData = {
        needsDiagram: false,
        explanation: generatedText
      };
    }

    res.status(200).json(diagramData);

  } catch (error) {
    console.error('Error in diagram API:', error);
    res.status(500).json({ 
      error: 'Failed to generate diagram instructions',
      details: error.message 
    });
  }
}