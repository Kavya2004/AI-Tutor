import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import geminiHandler from './api/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// API routes
app.post('/api/gemini', geminiHandler);

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'tutor.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});