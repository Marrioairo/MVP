import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { getDeepSeek, DeepSeekService } from "./src/lib/deepseek";
import { getPriceUSD } from "./src/lib/pricing";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// SSE Clients storage
let sseClients: any[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

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
  app.post("/api/events", (req, res) => {
    const event = req.body;
    // In a real app, save to DB here
    console.log("New Event:", event);
    broadcastEvent(event);
    res.status(201).json({ status: "ok" });
  });

  // DeepSeek AI Analysis
  app.post("/api/ia/analyze", async (req, res) => {
    try {
      const { matchData, promptType } = req.body;
      const deepSeek = getDeepSeek();
      
      const prompts = DeepSeekService.getPrompts();
      const prompt = prompts[promptType as keyof typeof prompts] || prompts.summary;
      
      const systemInstruction = "You are HoopsAI, a professional basketball tactical analyst. Analyze the provided match data and give strategic insights.";
      const fullPrompt = `Match Data: ${JSON.stringify(matchData)}\n\nAnalysis Request: ${prompt}`;

      const result = await deepSeek.requestCompletion(fullPrompt, systemInstruction);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Checkout Session with Regional Pricing
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { countryCode } = req.body;
      const amount = getPriceUSD(countryCode);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { 
                name: "HoopsAI Pro Subscription",
                description: "Advanced analytics and live scorekeeping"
              },
              unit_amount: amount * 100, // Convert to cents
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 30, // 1 month free
        },
        success_url: `${process.env.APP_URL}/dashboard?success=true`,
        cancel_url: `${process.env.APP_URL}/pricing`,
      });
      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Stripe Webhook
  app.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        // Update user subscription in DB
        console.log("Subscription completed for:", session.customer_email);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
