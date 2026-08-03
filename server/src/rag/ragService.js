// ragService.js – core RAG logic
import { getEmbedding } from './embedder.js';
import { search, getAll } from './vectorStore.js';

// OpenAI ChatCompletion – primary LLM
async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.warn('OpenAI API warning:', data?.error?.message || 'LLM request failed');
    throw new Error(data?.error?.message || 'LLM request failed');
  }
  return data.choices[0].message.content;
}

// Gemini ChatCompletion – secondary LLM
async function callGemini(messages, apiKey) {
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  const payload = {
    contents,
    ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage }] } } : {})
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Gemini LLM request failed');
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

// Simple moderation using OpenAI moderation endpoint
async function moderate(content) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;
  try {
    const resp = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: content }),
    });
    const data = await resp.json();
    return data.results?.[0]?.flagged ?? false;
  } catch (err) {
    return false;
  }
}

function generateFallbackResponse(userMessage, retrievedTexts) {
  if (retrievedTexts && retrievedTexts.trim()) {
    return `Based on our health resources:\n\n${retrievedTexts}\n\nPlease reach out if you have any questions or need further guidance.`;
  }
  return `Thank you for reaching out. I am here to support your mental well-being. If you are experiencing stress or anxiety, take a moment for deep breathing and gentle self-care. Feel free to share more about how you're feeling.`;
}

// MentalBERT Local AI Engine (Python backend)
async function callMentalBERTBackend(userMessage, history = []) {
  const response = await fetch('http://localhost:8000/api/chat-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, history })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'MentalBERT backend failed');
  }
  return data.reply;
}

/**
 * Process a user message and return the assistant reply.
 * @param {string} userMessage – raw user text
 * @param {Array<{role:string, content:string}>} [history] – optional prior chat history
 */
export async function processMessage(userMessage, history = []) {
  // moderation
  if (await moderate(userMessage)) {
    return 'I’m sorry, I can’t help with that request.';
  }

  // embed user query
  const queryEmbedding = await getEmbedding(userMessage);

  // retrieve top‑k relevant chunks
  const topChunks = search(queryEmbedding, 5);
  const retrievedTexts = topChunks.map((c) => c.text).filter(Boolean).join('\n---\n');

  // build system prompt
  const systemPrompt = `You are a helpful mental‑health assistant. Use only the provided context to answer the user. If the context does not contain enough information, answer politely that you don\'t have enough data. Do not give medical advice beyond the data.\n\nContext:\n${retrievedTexts}`;

  // compose message list for LLM
  const messages = [{ role: 'system', content: systemPrompt }];
  // include last 5 messages from history (if any)
  const recent = history.slice(-5);
  messages.push(...recent);
  messages.push({ role: 'user', content: userMessage });

  // 1. Try OpenAI if valid key configured
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-') && !process.env.OPENAI_API_KEY.includes('PLFfv')) {
    try {
      return await callOpenAI(messages);
    } catch (err) {
      console.warn('OpenAI API call failed:', err.message);
    }
  }

  // 2. Try Gemini if valid key configured
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith('AIza')) {
    try {
      return await callGemini(messages, process.env.GEMINI_API_KEY);
    } catch (err) {
      console.warn('Gemini API call failed:', err.message);
    }
  }

  // 3. MentalBERT Local AI Engine (Python backend)
  try {
    return await callMentalBERTBackend(userMessage, history);
  } catch (err) {
    console.warn('MentalBERT AI backend call failed:', err.message);
  }

  // 4. Static fallback
  return generateFallbackResponse(userMessage, retrievedTexts);
}

export { getAll as getVectorCache };
