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
    const diagramPrompt = `Create a simple diagram using basic shapes. Use ONLY numbers in coordinates - no Math expressions!

Question: ${question}

Available shapes:
- line: [x1, y1, x2, y2]
- circle: [centerX, centerY, radius] 
- rectangle: [x, y, width, height]
- triangle: [x1, y1, x2, y2, x3, y3]

IMPORTANT: Use only simple numbers like 1, 2, 3, etc. NO Math.sqrt() or calculations!

Example house:
{
  "needsDiagram": true,
  "instructions": {
    "title": "Simple House",
    "elements": [
      {"type": "rectangle", "coordinates": [0, 0, 4, 3], "color": "black"},
      {"type": "triangle", "coordinates": [0, 3, 2, 5, 4, 3], "color": "red"}
    ]
  }
}

Respond with valid JSON only!`;

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
      let jsonText = generatedText;
      const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) || 
                       generatedText.match(/```\n([\s\S]*?)\n```/);
      
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
      
      // Clean up common JSON issues
      jsonText = jsonText
        .replace(/Math\.sqrt\(3\)/g, '1.732') // Replace Math expressions
        .replace(/\*Math\.sqrt\(3\)/g, '*1.732')
        .replace(/,\s*\]/g, ']') // Remove trailing commas
        .replace(/,\s*\}/g, '}');
      
      diagramData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // If JSON parsing fails, create a simple response
      diagramData = {
        needsDiagram: false,
        explanation: 'Failed to parse diagram instructions: ' + generatedText
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