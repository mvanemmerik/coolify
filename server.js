import express from "express";
import { join } from "node:path";
import { Pool } from "pg";

const port = Number(process.env.PORT || 3000);
const publicDir = join(process.cwd(), "public");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false
});

const app = express();

app.use(express.json());
app.use(express.static(publicDir));

function cleanText(value) {
  return String(value || "").trim();
}

function isValidLength(value, max) {
  return value.length <= max;
}

function validStatus(value) {
  return ["todo", "doing", "done"].includes(value);
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kanban_cards (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('todo', 'doing', 'done')),
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_kanban_cards_status_position
    ON kanban_cards(status, position, id);
  `);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/cards", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, description, status, position FROM kanban_cards ORDER BY status, position, id"
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Unable to load cards." });
  }
});

app.post("/api/cards", async (req, res) => {
  const title = cleanText(req.body?.title);
  const description = cleanText(req.body?.description);
  const status = cleanText(req.body?.status) || "todo";

  if (!title) {
    res.status(400).json({ error: "Title is required." });
    return;
  }

  if (!validStatus(status)) {
    res.status(400).json({ error: "Invalid status." });
    return;
  }

  if (!isValidLength(title, 120) || !isValidLength(description, 300)) {
    res.status(400).json({ error: "Card content is too long." });
    return;
  }

  try {
    const next = await pool.query(
      "SELECT COALESCE(MAX(position), -1) + 1 AS position FROM kanban_cards WHERE status = $1",
      [status]
    );
    const position = Number(next.rows[0].position);

    const result = await pool.query(
      `INSERT INTO kanban_cards (title, description, status, position)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, description, status, position`,
      [title, description, status, position]
    );

    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Unable to create card." });
  }
});

app.patch("/api/cards/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid card id." });
    return;
  }

  const updates = [];
  const values = [];

  if (typeof req.body?.title === "string") {
    const title = cleanText(req.body.title);
    if (!title) {
      res.status(400).json({ error: "Title cannot be empty." });
      return;
    }
    if (!isValidLength(title, 120)) {
      res.status(400).json({ error: "Title is too long." });
      return;
    }
    updates.push(`title = $${updates.length + 1}`);
    values.push(title);
  }

  if (typeof req.body?.description === "string") {
    const description = cleanText(req.body.description);
    if (!isValidLength(description, 300)) {
      res.status(400).json({ error: "Description is too long." });
      return;
    }
    updates.push(`description = $${updates.length + 1}`);
    values.push(description);
  }

  if (typeof req.body?.status === "string") {
    const status = cleanText(req.body.status);
    if (!validStatus(status)) {
      res.status(400).json({ error: "Invalid status." });
      return;
    }
    updates.push(`status = $${updates.length + 1}`);
    values.push(status);
  }

  if (typeof req.body?.position === "number" && Number.isInteger(req.body.position) && req.body.position >= 0) {
    updates.push(`position = $${updates.length + 1}`);
    values.push(req.body.position);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: "No valid updates provided." });
    return;
  }

  updates.push("updated_at = NOW()");
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE kanban_cards
       SET ${updates.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, title, description, status, position`,
      values
    );

    if (!result.rowCount) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Unable to update card." });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid card id." });
    return;
  }

  try {
    const result = await pool.query("DELETE FROM kanban_cards WHERE id = $1", [id]);
    if (!result.rowCount) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Unable to delete card." });
  }
});

app.post("/api/reorder", async (req, res) => {
  const status = cleanText(req.body?.status);
  const orderedIds = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (!validStatus(status)) {
    res.status(400).json({ error: "Invalid status." });
    return;
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    res.status(400).json({ error: "Duplicate card ids are not allowed." });
    return;
  }

  let client;

  try {
    client = await pool.connect();

    if (orderedIds.length > 0) {
      const idsResult = await client.query("SELECT id FROM kanban_cards WHERE id = ANY($1::bigint[])", [orderedIds]);
      if (idsResult.rows.length !== orderedIds.length) {
        res.status(400).json({ error: "One or more card ids do not exist." });
        return;
      }
    }

    await client.query("BEGIN");

    await client.query("UPDATE kanban_cards SET status = $1, updated_at = NOW() WHERE id = ANY($2::bigint[])", [
      status,
      orderedIds
    ]);

    for (let index = 0; index < orderedIds.length; index += 1) {
      await client.query(
        "UPDATE kanban_cards SET position = $1, updated_at = NOW() WHERE id = $2",
        [index, orderedIds[index]]
      );
    }

    const remainingResult = await client.query(
      "SELECT id FROM kanban_cards WHERE status = $1 AND id <> ALL($2::bigint[]) ORDER BY position, id",
      [status, orderedIds]
    );
    for (let index = 0; index < remainingResult.rows.length; index += 1) {
      await client.query("UPDATE kanban_cards SET position = $1, updated_at = NOW() WHERE id = $2", [
        orderedIds.length + index,
        remainingResult.rows[index].id
      ]);
    }

    await client.query("COMMIT");
    res.status(204).end();
  } catch {
    if (client) {
      await client.query("ROLLBACK");
    }
    res.status(500).json({ error: "Unable to reorder cards." });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get("*", (_req, res) => {
  res.sendFile(join(publicDir, "index.html"));
});

await ensureSchema();

app.listen(port, "0.0.0.0", () => {
  console.log(`Kanban app running at http://0.0.0.0:${port}`);
});
