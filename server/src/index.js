require('dotenv').config();
const cors = require('cors');
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');

const app = express();
app.use(cors());

app.use(express.json());
app.use('/uploads', express.static('uploads')); // so saved audio files can be played back if needed

app.use('/api/auth', authRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/assessments', assessmentRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));