const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const root = __dirname;
const port = process.env.PORT || 4173;
const storageRoot = path.join(root, 'storage');
const logDir = path.join(storageRoot, 'logs');
const pdfDir = path.join(storageRoot, 'pdfs');
const tmpDir = path.join(storageRoot, 'tmp');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
};

async function ensureDirectories() {
  await Promise.all([
    fsp.mkdir(logDir, { recursive: true }),
    fsp.mkdir(pdfDir, { recursive: true }),
    fsp.mkdir(tmpDir, { recursive: true }),
  ]);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function safeJoin(base, targetPath) {
  const normalized = path.normalize(path.join(base, targetPath));
  if (!normalized.startsWith(base)) {
    return null;
  }
  return normalized;
}

function generatePdf(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', ['fill_pdf.py', inputPath, outputPath], { cwd: root });
    let stderr = '';
    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || stdout || `fill_pdf failed with code ${code}`));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/meetings/submit') {
      await ensureDirectories();
      const rawBody = await readBody(req);
      const meeting = JSON.parse(rawBody || '{}');
      const meetingId = meeting.id || crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const payload = { ...meeting, id: meetingId, serverSavedAt: timestamp };

      const inputPath = path.join(tmpDir, `${meetingId}.json`);
      const outputPath = path.join(pdfDir, `${meetingId}.pdf`);
      const logPath = path.join(logDir, `${meetingId}.json`);

      await fsp.writeFile(inputPath, JSON.stringify(payload, null, 2), 'utf8');
      await generatePdf(inputPath, outputPath);
      await fsp.writeFile(logPath, JSON.stringify({ ...payload, pdfFile: `${meetingId}.pdf` }, null, 2), 'utf8');

      sendJson(res, 200, {
        ok: true,
        id: meetingId,
        savedAt: timestamp,
        pdfUrl: `/storage/pdfs/${meetingId}.pdf`,
        logUrl: `/storage/logs/${meetingId}.json`,
      });
      return;
    }

    const requestPath = req.url === '/' ? '/index.html' : decodeURIComponent((req.url || '').split('?')[0]);
    const filePath = safeJoin(root, requestPath);

    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Internal Server Error' });
  }
});

ensureDirectories().then(() => {
  server.listen(port, () => {
    console.log(`TBM app running at http://localhost:${port}`);
  });
});
