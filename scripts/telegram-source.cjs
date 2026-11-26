// Fallback source for the GalleryInfo sync: the public Telegram channel @galleryinfo_ir.
//
// galleryinfo.ir can become unreachable from servers outside Iran (its DNS and web host
// sit on one Iranian IP). The channel posts every exhibition with links to
// galleryinfo.ir/Gallery/fa/<id> and /Event/fa/<id>, so the IDs match our data exactly.
// This module turns those posts into objects shaped like the GalleryInfo API
// (GetMoreEvents) so the rest of sync-galleryinfo.cjs can process them unchanged.

const https = require('https');

const CHANNEL = 'galleryinfo_ir';
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const MONTH_RE = new RegExp(MONTHS.join('|'));

function httpGet(url, { timeout = 20000, maxBytes = 15 * 1024 * 1024, binary = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept-Language': 'fa,en;q=0.8'
      },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        return resolve({ status: res.statusCode, location: res.headers.location || '', body: binary ? Buffer.alloc(0) : '' });
      }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) { req.destroy(new Error('Response too large')); return; }
        chunks.push(c);
      });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, location: '', body: binary ? buf : buf.toString('utf-8') });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`Timeout after ${timeout}ms: ${url}`)));
  });
}

function toEnDigits(s) {
  return String(s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

// Bidi marks, zero-width spaces and soft hyphens Telegram posts carry (keeps ZWNJ, which Persian needs).
const INVISIBLE_RE = /[\u00ad\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, '')).replace(INVISIBLE_RE, '').replace(/\s+/g, ' ').trim();
}

// Message HTML -> plain text with markers for the links we care about.
function messageToText(html) {
  let t = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?blockquote[^>]*>/gi, '\n');
  t = t.replace(/<a[^>]+href="https?:\/\/(?:www\.)?galleryinfo\.ir\/gallery\/fa\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (m, id, txt) => `⟦G|${id}|${stripTags(txt)}⟧`);
  t = t.replace(/<a[^>]+href="https?:\/\/(?:www\.)?galleryinfo\.ir\/event\/fa\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (m, id, txt) => `⟦E|${id}|${stripTags(txt)}⟧`);
  t = t.replace(/<a[^>]+href="(https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps)[^"]*)"[^>]*>[\s\S]*?<\/a>/gi,
    (m, url) => `⟦M|${decodeEntities(url)}⟧`);
  t = decodeEntities(t.replace(/<[^>]+>/g, '')).replace(INVISIBLE_RE, '');
  return t.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).join('\n');
}

// "۲۹ آبان ماه الی ۸ آذر ماه ۱۴۰۵" -> { start: {d,m,y}, end: {d,m,y} }
function parseDateRange(line, fallbackYear) {
  const s = toEnDigits(line).replace(/ماه/g, ' ');
  const tokens = s.match(new RegExp(`\\d+|${MONTHS.join('|')}`, 'g')) || [];
  const dates = [];
  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      const n = parseInt(tok, 10);
      if (n >= 1300 && n <= 1499) {
        // A year belongs to the date right before it; earlier dates get theirs below.
        if (dates.length && !dates[dates.length - 1].y) dates[dates.length - 1].y = n;
      } else if (n >= 1 && n <= 31) {
        dates.push({ d: n, m: 0, y: 0 });
      }
    } else {
      const m = MONTHS.indexOf(tok) + 1;
      for (let i = dates.length - 1; i >= 0 && !dates[i].m; i--) dates[i].m = m;
    }
  }
  if (dates.length < 2) return null; // an end date is required, otherwise the event would never expire
  const start = dates[0];
  const end = dates[dates.length - 1];
  if (!end.m) return null;
  if (!start.m) start.m = end.m;
  if (!end.y) end.y = fallbackYear;
  if (!start.y) start.y = start.m > end.m ? end.y - 1 : end.y;
  return { start, end };
}

function parseHours(lines) {
  let fallback = null;
  for (const l of lines) {
    const m = toEnDigits(l).match(/ساعت\s*(\d{1,2}(?::\d{2})?)\s*(?:الی|تا|-)\s*(\d{1,2}(?::\d{2})?)/);
    if (!m) continue;
    if (/افتتاحیه|جمعه/.test(l)) return { start: m[1], end: m[2] };
    if (!fallback) fallback = { start: m[1], end: m[2] };
  }
  return fallback;
}

function cleanTitle(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const q = t.match(/«([^»]+)»/) || t.match(/"([^"]+)"/);
  if (q) return q[1].replace(/^\u200c+|\u200c+$/g, '').trim();
  return t.replace(/^ن?\s*م?ایش(?:گاه)?\s*(?:انفرادی|گروهی)?\s*/, '').trim() || t;
}

function currentPersianYear() {
  try {
    const y = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', timeZone: 'Asia/Tehran' })
      .formatToParts(new Date()).find((p) => p.type === 'year');
    return parseInt(y.value, 10) || 1405;
  } catch {
    return 1405;
  }
}

// Parse one t.me/s/<channel> page. Returns { posts: [{postId, date, photo, events}], minPostId }.
function parseChannelPage(html, fallbackYear = currentPersianYear()) {
  const posts = [];
  const parts = html.split(`data-post="${CHANNEL}/`);
  let minPostId = Infinity;
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const postId = parseInt(chunk, 10);
    if (!Number.isFinite(postId)) continue;
    minPostId = Math.min(minPostId, postId);

    const textMatch = chunk.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/);
    if (!textMatch) continue;
    const text = messageToText(textMatch[1]);
    if (/#video_report|گزارش (?:ویدیویی|تصویری)/.test(text)) continue;

    const photoMatch = chunk.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/) ||
                       chunk.match(/tgme_widget_message_video_thumb[^>]*background-image:url\('([^']+)'\)/);
    const dateMatch = chunk.match(/<time[^>]+datetime="([^"]+)"/);

    // Persian part ends where the English copy starts.
    const enIdx = text.search(/\bPresents?:|\bpresents?:/);
    const fa = enIdx > 0 ? text.slice(0, enIdx) : text;
    const faLines = fa.split('\n');

    const addressLine = faLines.find((l) => l.includes('📍')) || '';
    const mapMatch = text.match(/⟦M\|([^⟧]+)⟧/);
    const address = addressLine.replace(/⟦M\|[^⟧]+⟧/g, '').replace(/📍/g, '').replace(/\(نقشه\)/g, '').trim();
    const hours = parseHours(faLines);

    const events = [];
    const markerRe = /⟦([GE])\|(\d+)\|([^⟧]*)⟧/g;
    const markers = [];
    let mm;
    while ((mm = markerRe.exec(fa))) markers.push({ kind: mm[1], id: parseInt(mm[2], 10), text: mm[3], index: mm.index, end: markerRe.lastIndex });

    let gallery = null;
    for (let k = 0; k < markers.length; k++) {
      const mk = markers[k];
      if (mk.kind === 'G') { gallery = mk; continue; }
      if (!gallery) continue;

      // Title: the whole line the event link sits on (Telegram sometimes splits the link text).
      const lineStart = fa.lastIndexOf('\n', mk.index) + 1;
      const lineEndIdx = fa.indexOf('\n', mk.end);
      const titleLine = fa.slice(lineStart, lineEndIdx < 0 ? fa.length : lineEndIdx)
        .replace(/⟦[GE]\|\d+\|([^⟧]*)⟧/g, '$1');

      const nextIdx = k + 1 < markers.length ? markers[k + 1].index : fa.length;
      const blockLines = fa.slice(lineEndIdx < 0 ? fa.length : lineEndIdx, nextIdx)
        .split('\n').map((l) => l.trim()).filter(Boolean);
      const stop = blockLines.findIndex((l) => /ساعات بازدید|⏰|📍/.test(l));
      const lines = stop >= 0 ? blockLines.slice(0, stop) : blockLines;

      const dateIdx = lines.findIndex((l) => MONTH_RE.test(l) && /[0-9۰-۹]/.test(l));
      if (dateIdx < 0) continue;
      const range = parseDateRange(lines[dateIdx], fallbackYear);
      if (!range) continue;

      const TYPE_LINE = /^نمایش(?:گاه)?\s*(?:انفرادی|گروهی)/;
      const typeLines = lines.slice(0, dateIdx).filter((l) => TYPE_LINE.test(l));
      const people = lines.slice(0, dateIdx).filter((l) => !TYPE_LINE.test(l));
      const plain = people.find((l) => !/[:：]/.test(l));
      const artist = (plain || (people[0] || '').replace(/^[^:：]+[:：]\s*/, '')).trim();
      const isGroup = /گروهی/.test(titleLine) || typeLines.some((l) => /گروهی/.test(l));

      events.push({
        Id: mk.id,
        GalleryId: gallery.id,
        GalleryName: gallery.text,
        Title: cleanTitle(titleLine),
        Names: artist,
        SD: range.start.d, SM: range.start.m, SMN: MONTHS[range.start.m - 1], SY: range.start.y,
        SDE: range.end.d, SME: range.end.m, SMNE: MONTHS[range.end.m - 1], SYE: range.end.y,
        StartT: hours ? hours.start : '',
        EndT: hours ? hours.end : '',
        Poster1: `/Images/Events/Event_${mk.id}.jpg`,
        _type: isGroup ? 'نمایشگاه گروهی' : 'نمایشگاه انفرادی',
        _source: 'telegram',
        _address: address,
        _mapUrl: mapMatch ? mapMatch[1] : '',
        _photo: photoMatch ? photoMatch[1] : '',
        _postId: postId
      });
    }
    posts.push({ postId, date: dateMatch ? dateMatch[1] : '', photo: photoMatch ? photoMatch[1] : '', events });
  }
  return { posts, minPostId: Number.isFinite(minPostId) ? minPostId : null };
}

// Read recent channel pages (newest first) until maxAgeDays is covered.
async function fetchTelegramEvents({ maxAgeDays = 45, maxPages = 30, log = console } = {}) {
  const byId = new Map();
  let before = null;
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
  for (let page = 0; page < maxPages; page++) {
    const url = `https://t.me/s/${CHANNEL}${before ? `?before=${before}` : ''}`;
    const res = await httpGet(url);
    if (res.status !== 200) throw new Error(`Telegram HTTP ${res.status}`);
    const { posts, minPostId } = parseChannelPage(res.body);
    if (!posts.length || !minPostId) break;
    for (const p of posts) {
      for (const e of p.events) if (!byId.has(e.Id) || byId.get(e.Id)._postId < e._postId) byId.set(e.Id, e);
    }
    const oldest = posts.reduce((min, p) => (p.date && Date.parse(p.date) < min ? Date.parse(p.date) : min), Infinity);
    if (oldest < cutoff || minPostId <= 1 || minPostId === before) break;
    before = minPostId;
    await new Promise((r) => setTimeout(r, 400));
  }
  log.log(`[Telegram] Parsed ${byId.size} exhibitions from @${CHANNEL}`);
  return [...byId.values()];
}

// maps.app.goo.gl short link -> { lat, lng } (only accepted inside Iran's bounding box).
async function resolveMapCoords(url) {
  let current = url;
  for (let hop = 0; hop < 4 && current; hop++) {
    const m = current.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
              current.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
              decodeURIComponent(current).match(/[?&](?:q|ll|query|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat > 25 && lat < 40 && lng > 44 && lng < 64) return { lat, lng };
      return null;
    }
    if (!/^https:\/\//.test(current)) return null;
    try {
      const res = await httpGet(current, { timeout: 10000, maxBytes: 2 * 1024 * 1024 });
      if (res.location) { current = new URL(res.location, current).toString(); continue; }
      const body = String(res.body || '');
      const inBody = body.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || body.match(/@(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/);
      current = inBody ? `@${inBody[1]},${inBody[2]}` : null;
    } catch {
      return null;
    }
  }
  return null;
}

function detectImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

async function downloadImage(url) {
  if (!/^https:\/\/[a-z0-9.-]*telesco\.pe\//i.test(url) && !/^https:\/\/[a-z0-9.-]*telegram\.org\//i.test(url)) return null;
  const res = await httpGet(url, { binary: true, timeout: 20000, maxBytes: 10 * 1024 * 1024 });
  if (res.status !== 200) return null;
  return detectImage(res.body) ? res.body : null;
}

module.exports = { fetchTelegramEvents, parseChannelPage, parseDateRange, resolveMapCoords, downloadImage, messageToText };
