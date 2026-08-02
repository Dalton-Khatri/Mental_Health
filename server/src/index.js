require('dotenv').config();

const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads'); // adjust if uploads/ isn't at server root
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const cors = require('cors');
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const weeklyAnalysisRoutes = require('./routes/weeklyAnalysisRoutes');

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