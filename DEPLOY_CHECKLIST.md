# CourtVision AI: Deployment Checklist & Production Guide

## 1. Environment Variables
Ensure the following are set in your production environment (Vercel, GCP, etc.):
- `DEEPSEK_API_KEY`: Your DeepSeek API key.
- `STRIPE_SECRET_KEY`: Your Stripe secret key.
- `VITE_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key.
- `VITE_FIREBASE_API_KEY`: Your Firebase API key.
- `VITE_FIREBASE_AUTH_DOMAIN`: Your Firebase auth domain.
- `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID.
- `VITE_FIREBASE_STORAGE_BUCKET`: Your Firebase storage bucket.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase messaging sender ID.
- `VITE_FIREBASE_APP_ID`: Your Firebase app ID.
- `APP_URL`: The URL of your deployed application.

## 2. Security & Rate Limiting
- [ ] Implement rate limiting on `/api/ia/analyze` to prevent abuse.
- [ ] Ensure `process.env.DEEPSEK_API_KEY` is never exposed in client-side code.
- [ ] Use `SameSite: 'none'` and `Secure: true` for cookies if using them for sessions.
- [ ] Configure CORS to only allow requests from your production domain.

## 3. Database & Storage
- [ ] Set up Firestore Security Rules to restrict access to user-specific data.
- [ ] Enable Firestore indexing for `updatedAt` and `userId` queries.
- [ ] Configure Firebase Storage for player/team images if needed.

## 4. Stripe Integration
- [ ] Create products and prices in the Stripe Dashboard.
- [ ] Set up a Webhook endpoint in Stripe to listen for `checkout.session.completed`.
- [ ] Update user subscription status in Firestore upon successful payment.

## 5. Performance & Monitoring
- [ ] Enable Sentry or LogRocket for error tracking.
- [ ] Use Google Analytics 4 (GA4) for user behavior analysis.
- [ ] Optimize images and assets for faster loading.
- [ ] Ensure the Service Worker is correctly caching core assets for PWA support.

## 6. Final QA
- [ ] Test the Scorekeeper timer and event logging on a tablet device.
- [ ] Verify AI analysis generation with real match data.
- [ ] Test the Stripe checkout flow in "Test Mode".
- [ ] Check PWA installation on Android and iOS.
- [ ] Verify Admin Panel access for authorized users only.
