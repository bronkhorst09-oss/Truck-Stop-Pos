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

function appError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function tillBalance(data, method) {
  const sales = (data?.["truck-pos-transactions"] || [])
    .filter((transaction) => transaction.status !== "void" && transaction.paymentMethod === method)
    .reduce((sum, transaction) => sum + Number(transaction.totals?.total || 0), 0);
  const collections = (data?.["truck-pos-collections"] || [])
    .filter((collection) => collection.method === method)
    .reduce((sum, collection) => sum + Number(collection.amount || 0), 0);
  return sales - collections;
}

function money(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

function validateNewCollections(incoming, existing) {
  const incomingData = incoming || {};
  const existingData = existing || {};
  const existingCollectionIds = new Set((existingData["truck-pos-collections"] || []).map((collection) => collection.id));
  const newCollections = (incomingData["truck-pos-collections"] || [])
    .filter((collection) => collection?.id && !existingCollectionIds.has(collection.id))
    .sort((a, b) => itemTime(a) - itemTime(b));
  if (!newCollections.length) return;

  const balanceData = {
    ...existingData,
    ...incomingData,
    "truck-pos-transactions": mergeById(incomingData["truck-pos-transactions"], existingData["truck-pos-transactions"]),
    "truck-pos-collections": existingData["truck-pos-collections"] || []
  };
  const balances = {
    Cash: tillBalance(balanceData, "Cash"),
    Card: tillBalance(balanceData, "Card")
  };

  newCollections.forEach((collection) => {
    const method = collection.method;
    const amount = Number(collection.amount || 0);
    if (!["Cash", "Card"].includes(method) || amount <= 0) {
      throw appError("Invalid till collection. Please check the type and amount.", 409);
    }
    if (amount > balances[method] + 0.005) {
      throw appError(`${method} collection blocked. Available ${method.toLowerCase()} balance is ${money(Math.max(0, balances[method]))}. Refresh Till and try again.`, 409);
    }
    balances[method] -= amount;
  });
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
    const existing = readFileData();
    validateNewCollections(data, existing);
    const merged = mergeData(data, existing);
    writeFileData(merged);
    return merged;
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query("select data from pos_store where id = $1 for update", ["main"]);
    const existing = result.rows[0]?.data || {};
    validateNewCollections(data, existing);
    const merged = mergeData(data, existing);
    await client.query(
      `insert into pos_store (id, data, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (id)
       do update set data = excluded.data, updated_at = now()`,
      ["main", JSON.stringify(merged)]
    );
    await client.query("commit");
    return merged;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
    const status = error.statusCode || 500;
    const message = error.message || "Server error";
    const type = status >= 400 && status < 500 ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
    send(res, status, type.includes("json") ? JSON.stringify({ ok: false, error: message }) : message, type);
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
