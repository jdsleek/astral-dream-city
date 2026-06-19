// Static server + order-email API for Astral Dream City
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');

// ── Brevo email config (set these as Railway variables) ──
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER = process.env.BREVO_SENDER || '';        // a Brevo-verified sender email
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Astral Dream City';
const ORDER_RECIPIENTS = (process.env.ORDER_RECIPIENTS ||
  'jdsleek@gmail.com,adetunji1182@gmail.com')
  .split(',').map(s => s.trim()).filter(Boolean);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webp': 'image/webp',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmt(n) { return '₦' + Number(n || 0).toLocaleString(); }

async function sendOrderEmail(order) {
  if (!BREVO_API_KEY || !BREVO_SENDER) {
    console.warn('Brevo not configured (BREVO_API_KEY / BREVO_SENDER missing) — skipping email.');
    return { skipped: true };
  }
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map(i =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${esc(i.n)}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">×${esc(i.q)}</td>` +
    `<td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${fmt(i.p * i.q)}</td></tr>`
  ).join('');
  const textLines = items.map(i => `  • ${i.n} ×${i.q} — ${fmt(i.p * i.q)}`).join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A0F3C">
      <h2 style="color:#3B1E8E">BASA Order — Astral Dream City</h2>
      <p><strong>Customer:</strong> ${esc(order.name)}<br>
         <strong>Phone:</strong> ${esc(order.phone)}<br>
         <strong>Pickup Time:</strong> ${esc(order.time || 'Not specified')}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <thead><tr>
          <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #3B1E8E">Item</th>
          <th style="padding:6px 12px;border-bottom:2px solid #3B1E8E">Qty</th>
          <th style="text-align:right;padding:6px 12px;border-bottom:2px solid #3B1E8E">Price</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:18px;font-weight:bold;color:#3B1E8E">Total: ${fmt(order.total)}</p>
      ${order.note ? `<p><strong>Special Requests:</strong> ${esc(order.note)}</p>` : ''}
      <p style="color:#7B6CA8">📍 LoveWorld School OPIC · 19th June 2026</p>
    </div>`;

  const text = `BASA Order — Astral Dream City\n\n` +
    `Customer: ${order.name}\nPhone: ${order.phone}\nPickup Time: ${order.time || 'Not specified'}\n\n` +
    `Order:\n${textLines}\n\nTotal: ${fmt(order.total)}\n` +
    (order.note ? `\nSpecial Requests: ${order.note}\n` : '') +
    `\n📍 LoveWorld School OPIC · 19th June 2026`;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER },
      to: ORDER_RECIPIENTS.map(email => ({ email })),
      replyTo: { email: BREVO_SENDER, name: BREVO_SENDER_NAME },
      subject: `BASA Order — ${order.name || 'New order'} — ${fmt(order.total)}`,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo ${res.status}: ${body}`);
  }
  return { sent: true };
}

// ── In-memory order store ──
const orders = [];
let orderSeq = 1;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ── CORS headers for API ──
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── POST /api/order ──
  if (req.method === 'POST' && url === '/api/order') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const order = JSON.parse(body || '{}');
        const record = {
          id: orderSeq++,
          at: new Date().toISOString(),
          name: order.name || '',
          phone: order.phone || '',
          time: order.time || 'Not specified',
          note: order.note || '',
          total: order.total || 0,
          items: Array.isArray(order.items) ? order.items : [],
          status: 'new',
        };
        orders.unshift(record);
        const result = await sendOrderEmail(order);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: record.id, ...result }));
      } catch (err) {
        console.error('Order failed:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // ── GET /api/orders (admin view) ──
  if (req.method === 'GET' && url === '/api/orders') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, orders, total: orders.length }));
    return;
  }

  // ── PATCH /api/orders/:id/status ──
  const statusMatch = req.method === 'PATCH' && url.match(/^\/api\/orders\/(\d+)\/status$/);
  if (statusMatch) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const id = parseInt(statusMatch[1]);
      const { status } = JSON.parse(body || '{}');
      const order = orders.find(o => o.id === id);
      if (order && status) order.status = status;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // ── GET /admin ──
  if (req.method === 'GET' && url === '/admin') {
    res.writeHead(302, { Location: '/admin.html' });
    res.end();
    return;
  }

  // ── Static files ──
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(idx);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Astral Dream City running on port ${PORT}`));
