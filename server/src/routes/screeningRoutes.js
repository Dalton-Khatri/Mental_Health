const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../prismaClient');
const authMiddleware = require('../middleware/auth');

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
  if (!conditionLabel || !causeLabel) {
    return res.status(400).json({ error: 'Missing classifier result fields' });
  }

  try {
    const screening = await prisma.screening.create({
      data: {
        userId: req.userId,
        audioUrl: `/uploads/${req.file.filename}`,
        conditionLabel,
        conditionConfidence: parseFloat(conditionConfidence),
        causeLabel,
        causeConfidence: parseFloat(causeConfidence)
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

module.exports = router;