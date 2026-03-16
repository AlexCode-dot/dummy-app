# Onio Dummy

Minimal Next.js partner-platform simulator for testing an embedded MinCFO integration locally.

## Routes

- `/economy`: main simulator page

## Local assumptions

- MinCFO app is running at `http://localhost:3000`
- This simulator runs at `http://localhost:3001`
- Token minting is proxied through this app to `POST http://localhost:3000/embed/launch`

## Environment

Set these env vars in `.env.local` for local development and in your deployment platform config for production:

- `MINCFO_EMBED_SHARED_SECRET`: must be `dev-test-embed-secret` for the `dummy-app` partner flow
- `NEXT_PUBLIC_MINCFO_BASE_URL`: MinCFO app base URL used by the browser iframe flow

The simulator always launches MinCFO through `/embed/partner/dummy-app/start?...` and always sets
`returnToPartner=https://dummy-app-liart.vercel.app/economy`.

You can start from `.env.example`.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3001/economy`.
