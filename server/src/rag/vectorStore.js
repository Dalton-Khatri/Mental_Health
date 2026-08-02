import fs from 'fs';
import path from 'path';

// Load cache from JSON file on startup
const cachePath = path.resolve(__dirname, 'ragCache.json');
let cache = [];
try {
  const data = fs.readFileSync(cachePath, 'utf-8');
  cache = JSON.parse(data);
} catch (e) {
  console.warn('RAG cache not found, starting empty');
  cache = [];
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function upsertChunks(chunks) {
  const map = new Map(cache.map(c => [c.id, c]));
  chunks.forEach(c => map.set(c.id, c));
  cache = Array.from(map.values());
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

export function search(queryEmbedding, topK = 5) {
  const scored = cache.map(item => ({
    id: item.id,
    text: item.text,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function getAll() {
  return cache;
}
