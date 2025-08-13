// Fallback content for common probability topics
const fallbackContent = {
  'probability': {
    title: 'Introduction to Probability',
    content: 'Probability measures the likelihood of events occurring, ranging from 0 (impossible) to 1 (certain).'
  },
  'bayes': {
    title: 'Bayes Theorem', 
    content: 'Bayes theorem describes the probability of an event based on prior knowledge of conditions related to the event.'
  },
  'normal distribution': {
    title: 'Normal Distribution',
    content: 'The normal distribution is a bell-shaped curve that describes many natural phenomena.'
  },
  'binomial': {
    title: 'Binomial Distribution',
    content: 'The binomial distribution models the number of successes in a fixed number of independent trials.'
  }
};

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
      
      let results = [];
      
      // Try Google Custom Search first
      if (apiKey && cx) {
        try {
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
          const response = await fetch(searchUrl);
          
          if (response.ok) {
            const data = await response.json();
            if (data.items) {
              results = data.items.slice(0, 3).map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet,
                note: 'If link is unavailable, the content below provides the key concepts.'
              }));
            }
          }
        } catch (searchError) {
          console.warn('Google Search failed, using fallback:', searchError.message);
        }
      }
      
      // If no results or search failed, provide fallback content
      if (results.length === 0) {
        const queryLower = query.toLowerCase();
        const matchedTopic = Object.keys(fallbackContent).find(topic => 
          queryLower.includes(topic)
        );
        
        if (matchedTopic) {
          const fallback = fallbackContent[matchedTopic];
          results = [{
            title: fallback.title,
            link: 'Reference content available below',
            snippet: fallback.content
          }];
        } else {
          results = [{
            title: 'Probability Concepts',
            link: 'Built-in reference',
            snippet: 'This topic relates to fundamental probability and statistics concepts. Let me help explain the key principles.'
          }];
        }
      }
  
      res.status(200).json({ results });
    } catch (error) {
      console.error('Search API Error:', error);
      
      // Provide fallback even on complete failure
      const fallbackResults = [{
        title: 'Probability Reference',
        link: 'Built-in content',
        snippet: 'I can help explain probability and statistics concepts based on my training. What specific topic would you like to explore?'
      }];
      
      res.status(200).json({ results: fallbackResults });
    }
  }
  