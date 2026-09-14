# Spun

A social rating and review app for music — think a Letterboxd-style diary, but for albums and songs instead of movies.

Rate and review any album or song, log what you've listened to, build ranked lists, follow other listeners, and see what's popular across the community. Built as a full-stack, cross-platform project: a REST API backend and a native iOS/Android mobile client.

## Features

- Rate albums and songs (half-star precision), with separate track-by-track ratings on top of the album rating
- Write reviews, like other people's reviews, and see community averages next to your own rating
- Log listens to build a running listening history, separate from formal ratings
- Ranked and unranked lists, a "listen later" queue, and four pinned favorite albums per profile
- Follow other users and get an activity feed of what they're rating, reviewing, and logging
- Popular Albums and Popular Reviews for discovery when you don't have many follows yet
- Send album/song recommendations directly to another user
- Block and report tools for community safety
- In-app account deletion, with cascading removal of all associated data

## Tech stack

**Backend** — Node.js, Express, TypeScript, PostgreSQL (raw `pg`, no ORM), Zod for request validation, JWT auth with bcrypt password hashing. Deployed to Fly.io with a managed Neon Postgres database. Album/song/artist catalog data comes from the Spotify Web API, imported and cached on first lookup. Profile photo uploads go through Cloudinary.

**Mobile** — React Native + Expo (Expo Router for file-based navigation), TypeScript, a custom design system (theme tokens, shared components) built on top of React Native primitives. Ships to the App Store and Play Store via EAS Build.

**Data model** — a normalized Postgres schema of 20+ tables covering users, the music catalog (artists/albums/songs, with a many-to-many credits model), ratings, reviews and likes, lists, follows, recommendations, an aggregated activity feed, and a blocking/reporting system for trust & safety.

## Project structure

```
backend/    Express API (see backend/src/modules for feature-organized routes)
mobile/     Expo/React Native app (see mobile/src/app for screens, file-based routing)
schema.sql  Full Postgres schema
```

## Running locally

**Backend**

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT secret, Spotify + Cloudinary credentials
npm install
npm run dev             # http://localhost:4000
```

A local Postgres instance can be started with `docker-compose up` from the repo root, seeded from `schema.sql`.

**Mobile**

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go, or run on a simulator/emulator. Set `EXPO_PUBLIC_API_URL` in `mobile/.env.local` to point at your backend.
