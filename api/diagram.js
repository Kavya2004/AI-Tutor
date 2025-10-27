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
    const diagramPrompt = `Create precise mathematical diagrams using exact shapes. Use ONLY numbers in coordinates!

Question: ${question}

Available shapes:
- line: [x1, y1, x2, y2]
- circle: [centerX, centerY, radius] 
- rectangle: [x, y, width, height]
- triangle: [x1, y1, x2, y2, x3, y3]
- arrow: [x1, y1, x2, y2]
- axis: [xMin, xMax, yMin, yMax]
- grid: [xMin, xMax, yMin, yMax, spacing]
- polygon: [x1, y1, x2, y2, x3, y3, ...]
- ellipse: [centerX, centerY, radiusX, radiusY]
- desmos: {expressions: [{latex: "y=x^2", color: "#2d70b3"}], viewport: {left: -10, right: 10, bottom: -10, top: 10}}

Properties:
- color: "#2d70b3", "#388c46", "#6042a6", "#c74440"
- style: "solid", "dashed", "dotted"
- fill: true/false
- lineWidth: 1-5

For graphs, use desmos type with LaTeX expressions.
For geometric shapes, use exact coordinates.
Use grid and axis for mathematical contexts.

Example probability tree:
{
  "needsDiagram": true,
  "instructions": {
    "title": "Probability Tree",
    "elements": [
      {"type": "grid", "coordinates": [-5, 5, -3, 3, 1], "color": "#f0f0f0"},
      {"type": "axis", "coordinates": [-5, 5, -3, 3], "color": "#333"},
      {"type": "circle", "coordinates": [0, 0, 0.2], "color": "#2d70b3", "fill": true},
      {"type": "line", "coordinates": [0, 0, -2, 1], "color": "#333"},
      {"type": "line", "coordinates": [0, 0, 2, 1], "color": "#333"}
    ]
  }
}

Respond with valid JSON only!`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

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

    // Retry logic for 503 errors
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) break;
        
        if (response.status === 503 && attempts < maxAttempts - 1) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          continue;
        }
        
        throw new Error(`Gemini API error: ${response.status}`);
      } catch (error) {
        if (attempts === maxAttempts - 1) throw error;
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
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
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate diagram instructions',
      details: error.message,
      stack: error.stack
    });
  }
}