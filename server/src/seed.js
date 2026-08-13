import prisma from './prismaClient.js';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Starting DB seeding...');

  // Create demo user
  const email = 'demo@lucid.com';
  const plainPassword = 'demo12345';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // Clean old seeding user if exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log('Removing old demo user data...');
    try {
      await prisma.weeklyAnalysis.deleteMany({ where: { userId: existingUser.id } });
      await prisma.assessmentResponse.deleteMany({ where: { assessment: { userId: existingUser.id } } });
      await prisma.assessment.deleteMany({ where: { userId: existingUser.id } });
      await prisma.screening.deleteMany({ where: { userId: existingUser.id } });
      await prisma.emergencyContact.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { email } });
    } catch (e) {
      console.log('Ignore cleaning error:', e.message);
    }
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Demo User',
      passwordHash: hashedPassword,
      isVerified: true
    }
  });

  console.log(`Created User: ${user.email} (ID: ${user.id})`);

  // Add emergency contact
  await prisma.emergencyContact.create({
    data: {
      userId: user.id,
      name: 'Jane Doe',
      phone: '+9779812345678',
      relation: 'Family',
      isPrimary: true
    }
  });

  // Generate 7 days of historical screenings
  const now = new Date();
  const mockScreenings = [
    {
      offsetDays: 6,
      condition: 'Normal',
      conf: 0.92,
      cause: 'No reason',
      causeConf: 0.95,
      transcript: 'I had a quiet day, just caught up on some reading and felt relaxed.'
    },
    {
      offsetDays: 5,
      condition: 'Stress',
      conf: 0.81,
      cause: 'Jobs and careers',
      causeConf: 0.76,
      transcript: 'Work has been extremely busy today with lots of deadlines crashing together.'
    },
    {
      offsetDays: 4,
      condition: 'Anxiety',
      conf: 0.78,
      cause: 'Jobs and careers',
      causeConf: 0.65,
      transcript: 'I am worried I might fail the project evaluation because the presentation is coming up.'
    },
    {
      offsetDays: 3,
      condition: 'Depression',
      conf: 0.68,
      cause: 'Alienation',
      causeConf: 0.58,
      transcript: 'I spent the weekend alone, feeling disconnected and lonely. I did not talk to anyone.'
    },
    {
      offsetDays: 2,
      condition: 'Normal',
      conf: 0.85,
      cause: 'No reason',
      causeConf: 0.90,
      transcript: 'I went out for a walk in the evening and started feeling a bit better.'
    },
    {
      offsetDays: 1,
      condition: 'Stress',
      conf: 0.74,
      cause: 'Relationship',
      causeConf: 0.70,
      transcript: 'Had a small argument with my family, feeling slightly tense but manageable.'
    },
    {
      offsetDays: 0,
      condition: 'Normal',
      conf: 0.89,
      cause: 'No reason',
      causeConf: 0.92,
      transcript: 'Today is fine. I did some breathing exercises and feel grounded.'
    }
  ];

  for (const s of mockScreenings) {
    const entryDate = new Date(now.getTime() - s.offsetDays * 24 * 60 * 60 * 1000);
    await prisma.screening.create({
      data: {
        userId: user.id,
        audioUrl: '/uploads/demo-audio.webm',
        conditionLabel: s.condition,
        conditionConfidence: s.conf,
        causeLabel: s.cause,
        causeConfidence: s.causeConf,
        transcript: s.transcript,
        createdAt: entryDate
      }
    });
  }
  console.log('Mock Screenings seeded.');

  // Create a Mock Assessment
  const assessment = await prisma.assessment.create({
    data: {
      userId: user.id,
      combinedAudioUrl: '/uploads/demo-assessment-combined.wav',
      totalDuration: 124.5,
      conditionLabel: 'Stress',
      conditionConfidence: 0.78,
      causeLabel: 'Jobs and careers',
      causeConfidence: 0.71,
      depressionPrediction: 'Not Depressed',
      depressionConfidence: 0.42,
      transcript: 'Overall I feel highly pressured by my studies and exams, but I am coping with exercises.',
      createdAt: now
    }
  });

  // Create Assessment Responses
  const mockResponses = [
    { qId: 'q1', cat: 'mood', text: 'Feeling slightly overwhelmed recently.', dur: 22.0 },
    { qId: 'q2', cat: 'sleep', text: 'I woke up multiple times last night.', dur: 30.5 },
    { qId: 'q3', cat: 'energy', text: 'Energy is average, but focus is dropping.', dur: 20.0 },
    { qId: 'q4', cat: 'appetite', text: 'Appetite has been normal.', dur: 15.0 },
    { qId: 'q5', cat: 'self-worth', text: 'Feeling okay, just stressed about timelines.', dur: 37.0 }
  ];

  for (const r of mockResponses) {
    await prisma.assessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        questionId: r.qId,
        category: r.cat,
        questionText: `System Prompt for ${r.cat}`,
        audioUrl: '/uploads/demo-q-audio.webm',
        duration: r.dur,
        hadFollowUp: false,
        timestamp: now
      }
    });
  }
  console.log('Mock Assessment and responses seeded.');

  // Create a Weekly Analysis entry
  await prisma.weeklyAnalysis.create({
    data: {
      userId: user.id,
      weekStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      weekEnd: now,
      entryCount: 8,
      avgScores: { Normal: 0.88, Stress: 0.77, Anxiety: 0.78, Depression: 0.68 },
      peakScores: { Normal: 0.92, Stress: 0.81, Anxiety: 0.78, Depression: 0.68 },
      dominantCondition: 'Normal',
      trend: 'stable',
      status: 'processed'
    }
  });
  console.log('Mock Weekly Analysis seeded.');

  console.log('DB seeding completed successfully!');
}

seed().catch(e => {
  console.error('Error during DB seed:', e);
  process.exit(1);
});
