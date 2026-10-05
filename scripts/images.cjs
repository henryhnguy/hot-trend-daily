// Bước 3: Tải ảnh minh họa cho từng bài (og:image của bài báo nguồn, có fallback ảnh khác trong trang)
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

function candidateImages(html) {
  const list = [];
  const og = extractMeta(html);
  if (og) list.push(og);
  for (const m of html.matchAll(/https?:\/\/[^"' ]+?\.(?:jpe?g|png)(?:\?[^"' ]*)?/g)) list.push(m[0]);
  return [...new Set(list)].filter(u => !/logo|icon|favicon|avatar|banner|static\//i.test(u));
}

async function downloadImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: new URL(url).origin }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!/image\/(jpe?g|png|webp)/.test(type)) throw new Error(`content-type không phải ảnh: ${type}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10 * 1024) throw new Error('ảnh quá nhỏ (<10KB), có thể là placeholder');
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return { buf, ext };
}

(async () => {
  for (const p of posts.posts) {
    const url = p.source_url;
    if (!url) { console.log(`[images] bài ${p.n}: không có source_url, bỏ qua`); continue; }
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      const candidates = candidateImages(await res.text());
      let done = false, lastErr = 'không có ứng viên ảnh';
      for (const c of candidates.slice(0, 5)) {
        try {
          const { buf, ext } = await downloadImage(c);
          const file = `bai-${p.n}.${ext}`;
          fs.writeFileSync(path.join(outDir, file), buf);
          p.image_file = file;
          console.log(`[images] bài ${p.n}: đã tải ${file} (${Math.round(buf.length / 1024)}KB)`);
          done = true;
          break;
        } catch (e) { lastErr = e.message; }
      }
      if (!done) throw new Error(lastErr);
    } catch (e) {
      console.warn(`[images] bài ${p.n}: LẤY ẢNH THẤT BẠI — ${e.message} (email sẽ gửi không ảnh cho bài này)`);
      p.image_file = null;
    }
  }
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2));
})();
