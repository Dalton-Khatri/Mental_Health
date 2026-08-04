import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', 'uploads'); // adjust if uploads/ isn't at server root
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

import cors from 'cors';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import screeningRoutes from './routes/screeningRoutes.js';
import assessmentRoutes from './routes/assessmentRoutes.js';
import weeklyAnalysisRoutes from './routes/weeklyAnalysisRoutes.js';

const app = express();
app.use(cors());

app.use(express.json());
app.use('/uploads', express.static('uploads')); // so saved audio files can be played back if needed

app.use('/api/auth', authRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/weekly-analysis', weeklyAnalysisRoutes);

// Register RAG chat endpoint
import chatRouter from './rag/chatController.js';
app.use('/api/chat', chatRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));