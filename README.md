# ShipShow Daily

A daily demo leaderboard platform where users can showcase their products through 30-second demos, earn credits by watching others' demos, and boost their own demos for more visibility.

## Features

- 🎥 30-second product demo videos
- 💰 Credit system - earn by watching, spend to boost
- 🏆 Daily leaderboard rankings
- 🏷️ Tag-based categorization
- ⭐ Favorite demos
- 📊 Analytics and tracking

## Tech Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon)
- **Authentication**: Clerk
- **Payments**: Stripe
- **Storage**: Google Cloud Storage
- **Deployment**: Vercel

## Documentation

- [Clerk Authentication Setup](./CLERK-SETUP.md)
- [Google Cloud Storage Setup](./GOOGLE-CLOUD-SETUP.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Adding Demo Videos](./RUN-SEED-DEMOS.md)

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run database migrations: `npm run db:push`
5. Start development server: `npm run dev`

## Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk backend API key
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk frontend key
- `STRIPE_SECRET_KEY` - Stripe API key
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key
- Google Cloud Storage credentials (see documentation)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run seed:demos` - Add sample demo videos
- `npm run db:push` - Apply database migrations

## License

MIT

---

Last updated: January 2025
