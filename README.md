# Cinematic Vault - Serverless Movie Tracker

A full-stack, responsive movie logging application running entirely serverless on **Cloudflare Workers** and persisting data in a **Cloudflare D1 (SQLite)** database, featuring premium glassmorphism design, user credentials login, and TMDb metadata lookups.

## Features
- **Serverless Backend**: Built using the fast, Express-style `Hono` routing framework on Cloudflare Workers.
- **Serverless SQLite**: Uses Cloudflare's D1 SQL database for robust and structured server persistence.
- **Username & Password Auth**: Secure password hashing with `bcryptjs` and stateless Web Crypto-based `jsonwebtoken` (JWT) authentication.
- **Premium Aesthetics**: Dark glassmorphic components, high-quality Outfit & Inter typography, responsive layouts, micro-animations, dynamic toast alerts, and interactive states.
- **TMDb Poster Search Integration**: Pulls movie posters and resolves title typos automatically.

## How to Deploy
1. **Initialize D1 database** on Cloudflare:
   ```bash
   npx wrangler d1 create movies_db
   ```
2. **Setup D1 Database Schema**:
   ```bash
   npx wrangler d1 execute movies_db --remote --file=schema.sql
   ```
3. **Deploy to Cloudflare**:
   ```bash
   npx wrangler deploy
   ```
