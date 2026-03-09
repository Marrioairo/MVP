import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
// Final deployment build trigger
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import pg from 'pg';
const { Pool } = pg;

// Import local libs (ensure paths match your repo structure)
// Note: You might need to adjust these imports if they rely on other files
import { getDeepSeek, DeepSeekService } from "./src/lib/deepseek";
// import { getPriceUSD } from "./src/lib/pricing";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// SSE Clients storage
let sseClients: any[] = [];

const app = express();
app.use(express.json());

// SSE Endpoint for Live Match Updates
app.get("/api/events/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // res.flushHeaders(); // May not be needed on Vercel

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on("close", () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Broadcast Event Helper
const broadcastEvent = (data: any) => {
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

// Match Events API
app.post("/api/events", async (req, res) => {
  const event = req.body;
  try {
    // Persistence with Postgres
    await pool.query(
      'INSERT INTO events (data, created_at) VALUES ($1, NOW())',
      [JSON.stringify(event)]
    );
    console.log("New Event Saved to Postgres:", event);
    broadcastEvent(event);
    res.status(201).json({ status: "ok" });

    // Proactive AI Trigger (Non-blocking)
    if (["TOV", "PF"].includes(event.type) && event.matchId) {
      pool.query(
        "SELECT data FROM events WHERE data::text LIKE $1",
        [`%"matchId":"${event.matchId}"%`]
      ).then(async (result) => {
        let count = 0;
        result.rows.forEach(row => {
          const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          if (d.type === event.type && d.team === event.team) count++;
        });

        // Thresholds
        if (event.type === 'TOV' && count >= 10 && count % 5 === 0) {
           const deepSeek = getDeepSeek();
           const aiPrompt = `Team ${event.team === 'home' ? 'Home' : 'Away'} just committed their ${count}th turnover. As an expert basketball coach, provide a very short (1 sentence) tactical advice to slow the pace and improve passing.`;
           const response = await deepSeek.requestCompletion(aiPrompt, "You are an expert basketball coach AI providing live tactical advice.");
           broadcastEvent({ type: "AI_SUGGESTION", message: response, team: event.team });
        } else if (event.type === 'PF' && count >= 10 && count % 5 === 0) {
           const deepSeek = getDeepSeek();
           const aiPrompt = `Team ${event.team === 'home' ? 'Home' : 'Away'} just committed their ${count}th foul. Give a 1 sentence defensive adjustment advice to avoid fouling.`;
           const response = await deepSeek.requestCompletion(aiPrompt, "You are an expert basketball coach AI providing live tactical advice.");
           broadcastEvent({ type: "AI_SUGGESTION", message: response, team: event.team });
        }
      }).catch(e => console.error("Proactive AI trigger error:", e));
    }

  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Failed to save event" });
  }
});

// AI Analyst API
app.post("/api/ia/analyze", async (req, res) => {
  try {
    const { prompt, mode, matchData } = req.body;
    const deepSeek = getDeepSeek();
    
    let systemPrompt = "You are HoopsAI, a professional basketball tactical analyst.";
    if (mode === "support") {
      systemPrompt = "You are HoopsAI Support, a helpful assistant for the HoopsAI application. Help users learn how to use the app, like recording matches, exporting data, and managing rosters.";
    }

    // Add match context if available
    const contextPrompt = matchData && Object.keys(matchData).length > 0 
      ? `Context (Current Match Data): ${JSON.stringify(matchData)}\n\nUser Question: ${prompt}`
      : prompt;

    const response = await deepSeek.requestCompletion(contextPrompt, systemPrompt);
    res.json(response);
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "Failed to get AI response", message: error.message });
  }
});

// API Routes
app.get("/api/health", async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Only start the server if not running on Vercel
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
