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

- `MINCFO_EMBED_SHARED_SECRET`: required MinCFO shared secret used to sign embed launch tokens
- `MINCFO_BASE_URL`: MinCFO app base URL
- `MINCFO_PARTNER_ID`: partner id, currently `onio`
- `MINCFO_RETURN_TO_PARTNER_URL`: return URL back to this app

You can start from `.env.example`.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3001/economy`.
