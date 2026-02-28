# Coolify Kanban Board

A simple Kanban board backed by PostgreSQL, designed for Coolify.

## Run locally

```bash
export DATABASE_URL="postgres://user:password@host:5432/postgres"
npm start
```

Open `http://localhost:3000`.

## Deploy in Coolify

1. Create a new app from this repository.
2. Set the build pack to Node.js.
3. Keep start command as `npm start`.
4. Expose port `3000`.
5. Add environment variable `DATABASE_URL` using your Coolify PostgreSQL connection string.

## API endpoints

- `GET /api/health` database connectivity check
- `GET /api/cards` list all cards
- `POST /api/cards` create a card
- `PATCH /api/cards/:id` update card title/description/status/position
- `DELETE /api/cards/:id` delete card
- `POST /api/reorder` reorder cards within a lane
