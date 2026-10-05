// Bước 1: Thu thập trend + tin tức từ RSS các nguồn Việt Nam
// Kết quả: outputs/<YYYY-MM-DD>/collect.json
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const FEEDS = [
  { name: 'google-trends-vn', url: 'https://trends.google.com/trending/rss?geo=VN', kind: 'trends' },
  { name: 'vnexpress-moi-nhat', url: 'https://vnexpress.net/rss/tin-moi-nhat.rss', kind: 'news' },
  { name: 'vnexpress-noi-bat', url: 'https://vnexpress.net/rss/tin-noi-bat.rss', kind: 'news' },
  { name: 'vnexpress-the-thao', url: 'https://vnexpress.net/rss/the-thao.rss', kind: 'news' },
  { name: 'vnexpress-giai-tri', url: 'https://vnexpress.net/rss/giai-tri.rss', kind: 'news' },
  { name: 'dantri', url: 'https://dantri.com.vn/rss/home.rss', kind: 'news' },
  { name: 'thanhnien', url: 'https://thanhnien.vn/rss/home.rss', kind: 'news' },
];

function stripCdata(s) { return (s ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').trim(); }

function parseItems(xml, kind) {
  const items = [];
  for (const chunk of xml.split('<item>').slice(1)) {
    const title = stripCdata((chunk.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = stripCdata((chunk.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
    const desc = stripCdata((chunk.match(/<description>([\s\S]*?)<\/description>/) || [])[1])
      .replace(/<[^>]+>/g, '').slice(0, 220);
    const traffic = stripCdata((chunk.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/) || [])[1]);
    if (!title) continue;
    const it = { title, link, desc };
    if (kind === 'trends' && traffic) it.approx_traffic = traffic;
    items.push(it);
  }
  return items;
}

async function fetchText(url, timeoutMs = 25000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchFeed(feed) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const xml = await fetchText(feed.url);
      return { ...feed, ok: true, items: parseItems(xml, feed.kind).slice(0, feed.kind === 'trends' ? 12 : 100) };
    } catch (e) {
      if (attempt === 2) return { ...feed, ok: false, error: String(e.message || e) };
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

(async () => {
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const outDir = path.join(__dirname, '..', 'outputs', date);
  fs.mkdirSync(outDir, { recursive: true });

  const results = await Promise.all(FEEDS.map(fetchFeed));
  const data = {
    date,
    collected_at: new Date().toISOString(),
    trends: results.find(r => r.name === 'google-trends-vn')?.items ?? [],
    news: results.filter(r => r.kind === 'news').flatMap(r =>
      r.ok ? r.items.map(i => ({ ...i, source: r.name })) : []),
    feed_status: results.map(r => ({ name: r.name, ok: r.ok, items: r.items?.length ?? 0, error: r.error })),
  };

  fs.writeFileSync(path.join(outDir, 'collect.json'), JSON.stringify(data, null, 2));
  console.log(`[collect] ${date}: ${data.trends.length} trend keywords, ${data.news.length} headlines`);
  console.log(`[collect] feeds: ${data.feed_status.map(f => `${f.name}=${f.ok ? 'ok' : 'FAIL'}`).join(', ')}`);
  if (data.trends.length === 0) { console.error('[collect] KHÔNG có dữ liệu Google Trends'); process.exit(1); }
})();
