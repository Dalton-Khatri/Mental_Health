import express from 'express';
import multer from 'multer';
import path from 'path';
import prisma from '../prismaClient.js';
import authMiddleware from '../middleware/auth.js';
import fs from 'fs';
import FormData from 'form-data';

const router = express.Router();

// Where uploaded audio files get saved, and how they're named
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Every route below this line requires a valid login token
router.use(authMiddleware);

// SAVE a new screening (audio + classifier result)
router.post('/', upload.single('audio'), async (req, res) => {
  const { conditionLabel, conditionConfidence, causeLabel, causeConfidence } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  let condLabel = conditionLabel || 'Normal';
  let condConfidence = conditionConfidence ? parseFloat(conditionConfidence) : 0.88;
  let cLabel = causeLabel || 'None';
  let cConfidence = causeConfidence ? parseFloat(causeConfidence) : 0.90;
  let transcript = null;

  // Query the Python service to analyze the screening audio
  try {
    
    const pythonForm = new FormData();
    const fileBuffer = fs.readFileSync(req.file.path);
    pythonForm.append('file', new Blob([fileBuffer]), req.file.originalname);

    const pyRes = await fetch('http://localhost:8000/api/screening', {
      method: 'POST',
      body: pythonForm
    });

    if (pyRes.ok) {
      const pyData = await pyRes.json();
      condLabel = pyData.conditionLabel || condLabel;
      condConfidence = pyData.conditionConfidence != null ? parseFloat(pyData.conditionConfidence) : condConfidence;
      cLabel = pyData.causeLabel || cLabel;
      cConfidence = pyData.causeConfidence != null ? parseFloat(pyData.causeConfidence) : cConfidence;
      transcript = pyData.transcript || null;
    } else {
      console.error('Python screening service returned an error:', await pyRes.text());
    }
  } catch (err) {
    console.error('Failed to reach Python screening service:', err.message);
  }

  try {
    const screening = await prisma.screening.create({
      data: {
        userId: req.userId,
        audioUrl: `/uploads/${req.file.filename}`,
        conditionLabel: condLabel,
        conditionConfidence: condConfidence,
        causeLabel: cLabel,
        causeConfidence: cConfidence,
        transcript: transcript
      }
    });

    res.status(201).json(screening);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save screening' });
  }
});

// GET this user's screening history (optionally filter by ?days=7)
router.get('/', async (req, res) => {
  const { days } = req.query;

  const where = { userId: req.userId };
  if (days) {
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: since };
  }

  try {
    const screenings = await prisma.screening.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(screenings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch screenings' });
  }
});

export default router;