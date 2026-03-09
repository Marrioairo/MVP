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
// import { getDeepSeek, DeepSeekService } from "./src/lib/deepseek";
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // SSE Endpoint for Live Match Updates
  app.get("/api/events/sse", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

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
    } catch (err) {
      console.error("DB Error:", err);
      res.status(500).json({ error: "Failed to save event" });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
