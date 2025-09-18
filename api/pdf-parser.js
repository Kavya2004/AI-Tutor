import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url = 'https://www.probabilitycourse.com' } = req.body;
    
    // Scrape for PDF links
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const pdfLinks = [];
    $('a[href$=".pdf"]').each((i, el) => {
      pdfLinks.push($(el).attr('href'));
    });
    
    res.status(200).json({ 
      message: 'PDF links found',
      pdfs: pdfLinks,
      note: 'PDF content parsing requires additional libraries like pdf-parse'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}