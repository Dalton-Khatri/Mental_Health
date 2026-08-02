// seedVectorData.js – populates ragCache.json from Prisma data
import prisma from '../../prismaClient.js';
import { getEmbedding } from './embedder.js';
import { upsertChunks } from './vectorStore.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper to create a chunk object for the vector store.
 * @param {string} id - unique identifier
 * @param {string} text - raw text content
 * @param {Array<number>} embedding - vector
 */
function makeChunk(id, text, embedding) {
  return { id, text, embedding };
}

async function seed() {
  console.log('Seeding vector data...');
  const chunks = [];

  // 1. WeeklyAnalysis entries – use transcript and summary fields
  const weekly = await prisma.weeklyAnalysis.findMany({
    select: { id: true, transcript: true, avgScores: true, peakScores: true },
  });
  for (const wa of weekly) {
    const textParts = [];
    if (wa.transcript) textParts.push(`Weekly transcript: ${wa.transcript}`);
    if (wa.avgScores) textParts.push(`Average scores: ${JSON.stringify(wa.avgScores)}`);
    if (wa.peakScores) textParts.push(`Peak scores: ${JSON.stringify(wa.peakScores)}`);
    const text = textParts.join('\n');
    const embedding = await getEmbedding(text);
    chunks.push(makeChunk(`weekly-${wa.id}`, text, embedding));
  }

  // 2. Screening entries – extract condition and cause labels + transcript
  const screenings = await prisma.screening.findMany({
    select: { id: true, conditionLabel: true, causeLabel: true, transcript: true },
  });
  for (const sc of screenings) {
    const text = `Screening condition: ${sc.conditionLabel || ''}\nCause: ${sc.causeLabel || ''}\nTranscript: ${sc.transcript || ''}`;
    const embedding = await getEmbedding(text);
    chunks.push(makeChunk(`screening-${sc.id}`, text, embedding));
  }

  // 3. (Optional) Add any static guidelines if a file exists
  // For demonstration we add a placeholder if you have a guidelines.txt
  // const guidelines = await import('fs').then(fs => fs.promises.readFile('guidelines.txt', 'utf-8').catch(() => null));
  // if (guidelines) {
  //   const embedding = await getEmbedding(guidelines);
  //   chunks.push(makeChunk('guidelines', guidelines, embedding));
  // }

  // Upsert all chunks into the JSON cache
  upsertChunks(chunks);
  console.log(`Seeded ${chunks.length} chunks into ragCache.json`);
}

// Run when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((e) => {
    console.error('Seeding failed', e);
    process.exit(1);
  });
}

export default seed;
