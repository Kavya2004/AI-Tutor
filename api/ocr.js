export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: 'Image data is required' });
        }
        
        // Log the actual credential values (first few chars only for security)
        console.log('Using credentials:', {
            appId: process.env.MATHPIX_APP_ID?.substring(0, 8) + '...',
            appKey: process.env.MATHPIX_APP_KEY?.substring(0, 8) + '...',
            appIdLength: process.env.MATHPIX_APP_ID?.length,
            appKeyLength: process.env.MATHPIX_APP_KEY?.length
        });
        
        const response = await fetch('https://api.mathpix.com/v3/text', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'app_id': process.env.MATHPIX_APP_ID,
                'app_key': process.env.MATHPIX_APP_KEY,
            },
            body: JSON.stringify({
                src: image,
                formats: ['text', 'latex_styled'],
                data_options: {
                    include_asciimath: true,
                    include_latex: true
                }
            })
        });

        const result = await response.json();
        
        // Log the full Mathpix response
        console.log('Mathpix response:', JSON.stringify(result, null, 2));
        
        if (result.error) {
            console.error('Mathpix error details:', result);
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
        
    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: 'OCR processing failed', details: error.message });
    }
}
