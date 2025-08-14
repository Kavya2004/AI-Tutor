// Fallback content with textbook knowledge
const fallbackContent = {
  'probability': {
    title: 'Introduction to Probability - Chapter 1',
    content: 'Probability measures the likelihood of events occurring, ranging from 0 (impossible) to 1 (certain). Key concepts include sample spaces, events, and the basic probability rules.'
  },
  'bayes': {
    title: 'Bayes Theorem - Chapter 3', 
    content: 'Bayes theorem: P(A|B) = P(B|A)P(A)/P(B). This describes how to update probabilities based on new evidence.'
  },
  'normal distribution': {
    title: 'Normal Distribution - Chapter 5',
    content: 'The normal distribution N(μ,σ²) is bell-shaped with mean μ and variance σ². About 68% of values fall within 1 standard deviation of the mean.'
  },
  'binomial': {
    title: 'Binomial Distribution - Chapter 4',
    content: 'For n independent trials with success probability p: P(X=k) = C(n,k)p^k(1-p)^(n-k). Mean = np, Variance = np(1-p).'
  },
  'conditional': {
    title: 'Conditional Probability - Chapter 2',
    content: 'P(A|B) = P(A∩B)/P(B). The probability of A given that B has occurred.'
  },
  'independence': {
    title: 'Independence - Chapter 2',
    content: 'Events A and B are independent if P(A∩B) = P(A)P(B), or equivalently P(A|B) = P(A).'
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
              results = data.items.slice(0, 3).map(item => {
                // Fix common URL format issues
                let fixedLink = item.link
                  .replace(/₁/g, '_1_')
                  .replace(/₂/g, '_2_')
                  .replace(/₃/g, '_3_')
                  .replace(/₄/g, '_4_')
                  .replace(/₅/g, '_5_')
                  .replace(/basicdefinitions/g, '0_0_introduction');
                
                return {
                  title: item.title,
                  link: fixedLink,
                  snippet: item.snippet
                };
              });
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
  