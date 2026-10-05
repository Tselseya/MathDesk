// MathDesk Guard: paste into a new n8n "Code" node (Run Once for All Items) placed between
// "MathDesk Webhook" and "Route by Mode". It validates the request and applies abuse limits.
// It never calls an external service; it only adds a `guard` object to the item for the IF node that follows.

const CFG = {
  allowedModes: ['solve', 'learn', 'practice', 'deskbot'],
  allowedMime: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  maxMessageChars: 4000,        // keep in sync with src/lib/limits.ts
  maxImages: 2,
  maxImageBytes: 1200000,       // per image (decoded)
  maxTotalImageBytes: 2000000,  // all images in one request
  windowMs: 10 * 60 * 1000,     // rolling window per visitor
  perIpMax: 30,                 // requests per window per visitor
  perIpImageMax: 10,            // image requests per window per visitor
  dailyGlobalMax: 3000,         // all visitors together, per UTC day
  dailyImageGlobalMax: 400,
  maxTrackedIps: 5000,
};

const item = $input.first().json;
const body = item && item.body && typeof item.body === 'object' && !Array.isArray(item.body) ? item.body : {};
const now = Date.now();

function out(ok, status, message, retryAfter, used) {
  return [{ json: { ...item, guard: { ok, status, message, retryAfter: retryAfter || 0, used: used || 0 } } }];
}

// --- who is calling? ngrok appends the real client address as the LAST entry of X-Forwarded-For.
const headers = (item && item.headers) || {};
const forwarded = String(headers['x-forwarded-for'] || '').split(',').map((part) => part.trim()).filter(Boolean);
const ip = forwarded.length ? forwarded[forwarded.length - 1] : String(headers['x-real-ip'] || 'unknown');
// If the address cannot be determined, everyone shares one bucket, so give that bucket a much larger allowance.
const scale = ip === 'unknown' ? 10 : 1;

// --- 1) basic shape (cheap checks first)
if (!CFG.allowedModes.includes(body.mode)) return out(false, 400, 'Unknown request type.');
if (typeof body.message !== 'string') return out(false, 400, 'Message must be text.');
if (body.message.length > CFG.maxMessageChars) return out(false, 413, 'Message is too long.');

const images = body.images === undefined ? [] : body.images;
if (!Array.isArray(images)) return out(false, 400, 'Images must be a list.');
const wantsImages = images.length > 0;
if (wantsImages && !['solve', 'learn'].includes(body.mode)) return out(false, 400, 'Images are not supported for this request type.');
if (images.length > CFG.maxImages) return out(false, 413, 'Too many images.');
if (!wantsImages && !body.message.trim()) return out(false, 400, 'Message is empty.');

let totalBytes = 0;
for (const image of images) {
  if (!image || typeof image !== 'object') return out(false, 400, 'Bad image.');
  if (!CFG.allowedMime.includes(image.mimeType)) return out(false, 400, 'Unsupported image type.');
  if (typeof image.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) return out(false, 400, 'Bad image data.');
  const padding = image.data.endsWith('==') ? 2 : image.data.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((image.data.length * 3) / 4) - padding;
  if (bytes > CFG.maxImageBytes) return out(false, 413, 'Image is too large.');
  totalBytes += bytes;
}
if (totalBytes > CFG.maxTotalImageBytes) return out(false, 413, 'Images are too large together.');

// --- 2) rate limits (kept in workflow static data; only persists for production executions)
const store = $getWorkflowStaticData('global');
store.visitors = store.visitors || {};
const today = new Date(now).toISOString().slice(0, 10);
if (!store.day || store.day.date !== today) store.day = { date: today, total: 0, images: 0 };

if (store.day.total >= CFG.dailyGlobalMax || (wantsImages && store.day.images >= CFG.dailyImageGlobalMax)) {
  return out(false, 429, 'Daily capacity reached.', 3600);
}

const record = store.visitors[ip] || { hits: [], imageHits: [] };
record.hits = record.hits.filter((time) => now - time < CFG.windowMs);
record.imageHits = record.imageHits.filter((time) => now - time < CFG.windowMs);
const hitLimit = record.hits.length >= CFG.perIpMax * scale;
const imageLimit = wantsImages && record.imageHits.length >= CFG.perIpImageMax * scale;
if (hitLimit || imageLimit) {
  const oldest = Math.min(...(imageLimit ? record.imageHits : record.hits));
  store.visitors[ip] = record;
  return out(false, 429, 'Too many requests.', Math.max(1, Math.ceil((oldest + CFG.windowMs - now) / 1000)), record.hits.length);
}
record.hits.push(now);
if (wantsImages) record.imageHits.push(now);
store.visitors[ip] = record;
store.day.total += 1;
if (wantsImages) store.day.images += 1;

// forget visitors that have been quiet for a window, and cap memory
const ips = Object.keys(store.visitors);
if (ips.length > CFG.maxTrackedIps / 2) {
  for (const key of ips) {
    const r = store.visitors[key];
    if (!r.hits.some((time) => now - time < CFG.windowMs)) delete store.visitors[key];
  }
  const remaining = Object.keys(store.visitors);
  if (remaining.length > CFG.maxTrackedIps) {
    remaining.sort((a, b) => Math.max(...store.visitors[a].hits) - Math.max(...store.visitors[b].hits))
      .slice(0, remaining.length - CFG.maxTrackedIps)
      .forEach((key) => delete store.visitors[key]);
  }
}

return out(true, 200, 'ok', 0, record.hits.length);
