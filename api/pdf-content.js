const fetch = require('node-fetch');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;
    
    // 1. Find PDFs on probabilitycourse.com
    const response = await fetch('https://www.probabilitycourse.com');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const pdfLinks = [];
    $('a[href$=".pdf"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      pdfLinks.push({
        url: href.startsWith('http') ? href : `https://www.probabilitycourse.com${href}`,
        title: text || 'PDF Document'
      });
    });
    
    // 2. Extract content from matching PDFs
    const results = [];
    for (const pdfLink of pdfLinks.slice(0, 3)) { // Limit to 3 PDFs
      try {
        const pdfResponse = await fetch(pdfLink.url);
        const pdfBuffer = await pdfResponse.buffer();
        const pdfData = await pdfParse(pdfBuffer);
        
        // Search within PDF content
        if (pdfData.text.toLowerCase().includes(query.toLowerCase())) {
          const snippet = extractRelevantSnippet(pdfData.text, query);
          results.push({
            title: `📄 ${pdfLink.title}`,
            url: pdfLink.url,
            snippet: snippet,
            content: pdfData.text.substring(0, 2000) // First 2000 chars
          });
        }
      } catch (pdfError) {
        console.warn(`Failed to parse PDF ${pdfLink.url}:`, pdfError.message);
        results.push({
          title: `📄 ${pdfLink.title}`,
          url: pdfLink.url,
          snippet: 'PDF document from ProbabilityCourse.com'
        });
      }
    }
    
    res.status(200).json({ pdfs: results });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function extractRelevantSnippet(text, query, maxLength = 200) {
  const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());
  if (queryIndex === -1) return text.substring(0, maxLength);
  
  const start = Math.max(0, queryIndex - 50);
  const end = Math.min(text.length, queryIndex + query.length + 150);
  return text.substring(start, end);
}