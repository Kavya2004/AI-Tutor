export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image } = req.body;
        
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
        res.status(200).json(result);
        
    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: 'OCR processing failed' });
    }
}