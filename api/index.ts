import type { VercelRequest, VercelResponse } from '@vercel/node';
import pg from 'pg';
const { Pool } = pg;

// ─── Lazy DB Pool ──────────────────────────────────────────────────────────────
let pool: InstanceType<typeof Pool> | null = null;
const getPool = () => {
  if (!pool && process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });
      pool.on('error', () => { pool = null; });
    } catch { pool = null; }
  }
  return pool;
};

// ─── DeepSeek Helper (inline to avoid import issues) ──────────────────────────
const callDeepSeek = async (prompt: string, system: string): Promise<string> => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === 'sk_xxx') {
    throw new Error(
      'DEEPSEEK_API_KEY is invalid or missing. ' +
      'Go to Vercel → Settings → Environment Variables and set a real key from platform.deepseek.com'
    );
  }
  const baseUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
  const model   = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`DeepSeek API error ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
};

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── /api/health ─────────────────────────────────────────────────────────────
  if (url.includes('/api/health')) {
    let dbStatus = 'not_configured';
    if (process.env.DATABASE_URL) {
      try {
        await getPool()?.query('SELECT NOW()');
        dbStatus = 'connected';
      } catch (e: any) { dbStatus = `error: ${e.message}`; }
    }
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const aiStatus = (!apiKey || apiKey === 'sk_xxx') ? '❌ missing_or_invalid_key' : '✅ configured';
    return res.status(200).json({ status: 'ok', db: dbStatus, ai: aiStatus, ts: new Date().toISOString() });
  }

  // ── /api/ia/analyze ─────────────────────────────────────────────────────────
  if (url.includes('/api/ia/analyze') && req.method === 'POST') {
    const { prompt, mode, matchData } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    let systemPrompt = 'You are HoopsAI, a professional basketball tactical analyst. Answer in the same language as the user.';
    if (mode === 'support') {
      systemPrompt = 'You are HoopsAI Support. Help users learn how to use the app: recording matches, exporting data, managing rosters.';
    }
    const context = matchData && Object.keys(matchData).length > 0
      ? `Match Context: ${JSON.stringify(matchData)}\n\nUser: ${prompt}`
      : prompt;

    try {
      const data = await callDeepSeek(context, systemPrompt);
      return res.status(200).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: 'AI failed', message: e.message });
    }
  }

  // ── /api/events (POST) ──────────────────────────────────────────────────────
  if (url.includes('/api/events') && req.method === 'POST') {
    const event = req.body;
    try {
      await getPool()?.query(
        'INSERT INTO events (data, created_at) VALUES ($1, NOW())',
        [JSON.stringify(event)]
      );
    } catch { /* DB unavailable — non-fatal */ }
    return res.status(201).json({ status: 'ok' });
  }

  // ── fallback ─────────────────────────────────────────────────────────────────
  return res.status(404).json({ error: 'Not found', url });
}
