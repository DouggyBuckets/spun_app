# Spun — Mobile

The React Native / Expo client for Spun. See the [root README](../README.md) for the full project overview, tech stack, and backend setup.

## Running

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i`/`a` to launch a simulator/emulator. Set `EXPO_PUBLIC_API_URL` in a local `.env.local` file to point at your backend (defaults to `http://localhost:4000/api`).

## Structure

- `src/app` — screens, using Expo Router's file-based routing
- `src/components` — shared UI components
- `src/constants/theme.ts` — the app's design tokens (colors, spacing, radius, typography)
- `src/context` — auth state
- `src/api` — the API client and secure token storage
