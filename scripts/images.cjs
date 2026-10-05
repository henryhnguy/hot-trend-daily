// Bước 3: Tải ảnh minh họa cho từng bài (từ og:image của bài báo nguồn)
// Đầu vào:  outputs/<date>/posts.json
// Đầu ra:   outputs/<date>/bai-N.<jpg|png|webp> + cập nhật posts.json (image_file)
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const date = process.argv[2] || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const outDir = path.join(__dirname, '..', 'outputs', date);
const postsPath = path.join(outDir, 'posts.json');
const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

function extractMeta(html) {
  const patterns = [
    /property="og:image"[^>]*content="([^"]+)"/,
    /content="([^"]+)"[^>]*property="og:image"/,
    /name="twitter:image"[^>]*content="([^"]+)"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: new URL(url).origin }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!/image\/(jpe?g|png|webp)/.test(type)) throw new Error(`content-type không phải ảnh: ${type}`);
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10 * 1024) throw new Error('ảnh quá nhỏ (<10KB), có thể là placeholder');
  return { buf, ext };
}

(async () => {
  for (const p of posts.posts) {
    const url = p.source_url;
    if (!url) { console.log(`[images] bài ${p.n}: không có source_url, bỏ qua`); continue; }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      const img = extractMeta(await res.text());
      if (!img) throw new Error('không tìm thấy og:image');
      const { buf, ext } = await fetchImage(img);
      const file = `bai-${p.n}.${ext}`;
      fs.writeFileSync(path.join(outDir, file), buf);
      p.image_file = file;
      console.log(`[images] bài ${p.n}: đã tải ${file} (${Math.round(buf.length / 1024)}KB) từ ${new URL(url).hostname}`);
    } catch (e) {
      console.warn(`[images] bài ${p.n}: LẤY ẢNH THẤT BẠI — ${e.message} (email sẽ gửi không ảnh cho bài này)`);
      p.image_file = null;
    }
  }
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
})();
