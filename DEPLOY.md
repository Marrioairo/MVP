# HoopsAI Deployment Guide (Vercel)

This guide outlines the steps to deploy HoopsAI to Vercel.

## Prerequisites
- A Vercel account.
- A GitHub repository with your code.
- Stripe account (for subscriptions).
- DeepSeek API key.
- Firebase project.

## Environment Variables
Set the following variables in your Vercel project settings:

```env
NODE_ENV=production
DATABASE_URL=postgres://user:pass@host:5432/dbname
DEEPSEEK_API_KEY=sk_xxx
DEEPSEEK_API_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
NEXTAUTH_SECRET=your_nextauth_secret
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APP_URL=https://your-app.vercel.app
```

## Deployment Steps
1. Push your code to GitHub.
2. Import the project in Vercel.
3. Configure the environment variables.
4. Vercel will automatically detect the Next.js project and deploy it.
5. Set up the Stripe Webhook to point to `https://your-app.vercel.app/api/webhooks/stripe`.

## Database Migration
If you are using a PostgreSQL database, ensure you run the `schema.sql` against your production database.
