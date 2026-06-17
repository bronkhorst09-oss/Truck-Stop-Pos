const http = require("http");
const fs = require("fs");
const path = require("path");
let pg = null;

try {
  pg = require("pg");
} catch (error) {
  pg = null;
}

const root = __dirname;
const dataFile = path.join(root, "pos-data.json");
const port = Number(process.env.PORT || 4175);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL || "";
const allowFileStorage = process.env.ALLOW_FILE_STORAGE === "true" || process.env.NODE_ENV !== "production";
const requireDatabase = !allowFileStorage;
const useDatabase = Boolean(databaseUrl && pg);
const pool = useDatabase ? new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
}) : null;
let databaseReady = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readFileData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch (error) {
    return {};
  }
}

function writeFileData(data) {
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dataFile);
}

function itemTime(item) {
  return Date.parse(item?.updatedAt || item?.voidedAt || item?.deletedAt || item?.date || "") || 0;
}

function mergeById(incomingList, existingList) {
  const merged = new Map();
  [...(Array.isArray(existingList) ? existingList : []), ...(Array.isArray(incomingList) ? incomingList : [])].forEach((item) => {
    if (!item) return;
    const key = item.id || JSON.stringify(item);
    const current = merged.get(key);
    if (!current || itemTime(item) >= itemTime(current)) {
      merged.set(key, item);
    }
  });
  return Array.from(merged.values()).sort((a, b) => itemTime(b) - itemTime(a));
}

function deletedIdsFrom(...snapshots) {
  return Array.from(new Set(snapshots.flatMap((snapshot) => snapshot?.["truck-pos-deleted-payments"] || [])));
}

function mergeData(incoming, existing) {
  const incomingData = incoming || {};
  const existingData = existing || {};
  const deletedPayments = deletedIdsFrom(incomingData, existingData);
  return {
    ...existingData,
    ...incomingData,
    "truck-pos-transactions": mergeById(incomingData["truck-pos-transactions"], existingData["truck-pos-transactions"]),
    "truck-pos-payments": mergeById(incomingData["truck-pos-payments"], existingData["truck-pos-payments"]).filter((payment) => !deletedPayments.includes(payment.id)),
    "truck-pos-deleted-payments": deletedPayments,
    "truck-pos-collections": mergeById(incomingData["truck-pos-collections"], existingData["truck-pos-collections"]),
    "truck-pos-meta": {
      ...(existingData["truck-pos-meta"] || {}),
      ...(incomingData["truck-pos-meta"] || {}),
      lastSavedAt: new Date().toISOString()
    }
  };
}

async function initDatabase() {
  if (!pool) return;
  await pool.query(`
    create table if not exists pos_store (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);

  const existing = await pool.query("select id from pos_store where id = $1", ["main"]);
  if (!existing.rowCount) {
    await pool.query(
      `insert into pos_store (id, data, updated_at)
       values ($1, $2::jsonb, now())`,
      ["main", JSON.stringify(readFileData())]
    );
  }
}

async function readData() {
  if (requireDatabase && !databaseReady) {
    throw new Error("Database is required but not connected");
  }
  if (!pool || !databaseReady) return readFileData();
  const result = await pool.query("select data from pos_store where id = $1", ["main"]);
  return result.rows[0]?.data || {};
}

async function writeData(data) {
  if (requireDatabase && !databaseReady) {
    throw new Error("Database is required but not connected");
  }
  if (!pool || !databaseReady) {
    const merged = mergeData(data, readFileData());
    writeFileData(merged);
    return merged;
  }
  const existing = await readData();
  const merged = mergeData(data, existing);
  await pool.query(
    `insert into pos_store (id, data, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (id)
     do update set data = excluded.data, updated_at = now()`,
    ["main", JSON.stringify(merged)]
  );
  return merged;
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/app-data.js") {
      send(res, 200, `window.__POS_DATA__ = ${JSON.stringify(await readData())};`, "application/javascript; charset=utf-8");
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/data") {
      send(res, 200, JSON.stringify(await readData()), "application/json; charset=utf-8");
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      send(res, 200, JSON.stringify({
        ok: databaseReady || !requireDatabase,
        storage: databaseReady ? "postgresql" : "local-file",
        databaseConfigured: Boolean(databaseUrl),
        databaseReady,
        requireDatabase,
        nodeEnv: process.env.NODE_ENV || ""
      }), "application/json; charset=utf-8");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/data") {
      const body = await readBody(req);
      const data = await writeData(JSON.parse(body || "{}"));
      send(res, 200, JSON.stringify({ ok: true, data }), "application/json; charset=utf-8");
      return;
    }

    if (req.method !== "GET") {
      send(res, 405, "Method not allowed");
      return;
    }

    const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(root, requested));
    if (!filePath.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        send(res, 404, "Not found");
        return;
      }
      const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      send(res, 200, content, type);
    });
  } catch (error) {
    send(res, 500, error.message || "Server error");
  }
});

async function initDatabaseWithRetry() {
  if (!pg && requireDatabase) {
    throw new Error("PostgreSQL dependency 'pg' is not installed. Check package.json and Render build logs.");
  }
  if (!databaseUrl && requireDatabase) {
    throw new Error("DATABASE_URL is required in production. Set it to the Render Internal Database URL.");
  }
  if (!pool) return;
  const attempts = 8;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await initDatabase();
      databaseReady = true;
      return;
    } catch (error) {
      console.error(`Database connection attempt ${attempt}/${attempts} failed:`, error.message);
      if (attempt === attempts) {
        if (requireDatabase) {
          throw new Error("Database unavailable after retries. Check DATABASE_URL and database status in Render.");
        }
        console.error("Database unavailable. Starting with local file storage fallback.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
    }
  }
}

initDatabaseWithRetry()
  .then(() => {
    server.listen(port, host, () => {
      const storage = databaseReady ? "PostgreSQL" : "local file";
      console.log(`Truck Stop POS server running at http://${host}:${port} using ${storage} storage`);
    });
  })
  .catch((error) => {
    console.error("Failed to start POS server:", error);
    process.exit(1);
  });
