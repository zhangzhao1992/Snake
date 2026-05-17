const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname);
const dataDir = path.join(root, "data");
const scoresFile = path.join(dataDir, "scores.json");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

let writeQueue = Promise.resolve();

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error("Body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function cleanRecord(record) {
  const name = String(record?.name || "").trim().replace(/\s+/g, " ").slice(0, 16) || "玩家1";
  const score = Math.max(0, Math.min(1000000, Math.floor(Number(record?.score) || 0)));
  const date = record?.date && !Number.isNaN(Date.parse(record.date)) ? record.date : new Date().toISOString();
  return { name, score, date };
}

function sortScores(scores) {
  return scores
    .map(cleanRecord)
    .sort((a, b) => b.score - a.score || new Date(a.date) - new Date(b.date))
    .slice(0, 100);
}

async function readScores() {
  try {
    const text = await fs.readFile(scoresFile, "utf8");
    return sortScores(JSON.parse(text));
  } catch {
    return [];
  }
}

async function writeScores(scores) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(scoresFile, JSON.stringify(sortScores(scores), null, 2), "utf8");
}

async function addScore(record) {
  writeQueue = writeQueue.then(async () => {
    const scores = await readScores();
    scores.push(cleanRecord(record));
    const sorted = sortScores(scores);
    await writeScores(sorted);
    return sorted;
  });
  return writeQueue;
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.resolve(root, `.${requested}`);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/scores" && req.method === "GET") {
      json(res, 200, { scores: await readScores() });
      return;
    }

    if (url.pathname === "/api/scores" && req.method === "POST") {
      const body = await readBody(req);
      const scores = await addScore(JSON.parse(body || "{}"));
      json(res, 201, { scores });
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch {
    json(res, 400, { error: "Bad request" });
  }
});

server.listen(port, () => {
  console.log(`Snake game server running at http://localhost:${port}`);
});
