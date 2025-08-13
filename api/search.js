export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
  
      const apiKey = process.env.GOOGLE_CSE_API_KEY;
      const cx = process.env.GOOGLE_CSE_ID;
  
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
  
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error(`Search request failed: ${response.statusText}`);
  
      const data = await response.json();
      if (!data.items) return res.status(200).json({ results: [] });
  
      const results = data.items.slice(0, 3).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      }));
  
      res.status(200).json({ results });
    } catch (error) {
      console.error('Search API Error:', error);
      res.status(500).json({ error: error.message });
    }
  }
  