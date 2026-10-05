// Bước 2: Gọi LLM để tổng hợp trend, chọn 3 chủ đề, soạn 3 bài Facebook
// Đầu vào:  outputs/<date>/collect.json
// Đầu ra:   outputs/<date>/posts.json, tong-hop.md, bai-1.md, bai-2.md, bai-3.md
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;
if (!LLM_API_KEY || !LLM_BASE_URL || !LLM_MODEL) {
  console.error('[generate] Thiếu LLM_BASE_URL / LLM_API_KEY / LLM_MODEL (xem .env.example)');
  process.exit(1);
}

const date = process.argv[2] || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const outDir = path.join(__dirname, '..', 'outputs', date);
const collect = JSON.parse(fs.readFileSync(path.join(outDir, 'collect.json'), 'utf8'));

const SYSTEM = `Bạn là biên tập viên nội dung mạng xã hội Việt Nam cho một fanpage Facebook mảng "Tin nóng – xã hội".
Nhiệm vụ: đọc dữ liệu trend/tin tức được cung cấp và trả về JSON đúng schema.

QUY TẮC:
- CHỈ dùng thông tin có trong dữ liệu được cung cấp. TUYỆT ĐỐI KHÔNG bịa số liệu, tên người, sự kiện.
- Với phần "TikTok" và "X + Threads" không có dữ liệu trực tiếp: suy luận hợp lý TỪ tin tức được cung cấp + văn hóa nền tảng, và giữ ước lượng khiêm tốn (không nêu số liệu cụ thể).
- Bài đăng: tiếng Việt, giọng tin tức trung lập – an toàn (không phỏng đoán chưa kiểm chứng, không nội dung chính trị nhạy cảm), hook mở đầu mạnh, thân bài 150–250 từ, có CTA, kết thúc bằng 3–5 hashtag. body_markdown là VĂN BẢN THƯỜNG (không cú pháp markdown), xuống dòng bằng \\n.
- Mỗi bài ghi source_url là link bài báo nguồn trong dữ liệu (để hệ thống tự lấy ảnh minh họa).
- Trả về CHỈ MỘT khối JSON, không bọc markdown fence, không giải thích.

SCHEMA:
{
  "summaries": {
    "Google Trends VN": ["điểm 1", "điểm 2", ...5-8 điểm, có kèm số liệu approx_traffic nếu có],
    "Facebook": ["...", ...],
    "TikTok": ["...", ...],
    "X + Threads": ["...", ...]
  },
  "topics": [
    {"rank": 1, "title": "...", "reason": "1-2 câu lý do dựa trên tín hiệu độ nóng", "source_url": "link bài báo nguồn"},
    {"rank": 2, ...}, {"rank": 3, ...}
  ],
  "posts": [
    {"n": 1, "topic_title": "...", "body_markdown": "toàn văn bài đăng", "hashtags": ["#tag"], "timing": "khung giờ đăng + lý do ngắn", "source_url": "link bài báo nguồn"},
    {"n": 2, ...}, {"n": 3, ...}
  ],
  "notes": "ghi chú cho người duyệt (nếu có)"
}`;

const USER = `Dữ liệu thu thập ngày ${collect.date} (giờ Việt Nam):

## GOOGLE TRENDS VN (top keywords + lưu lượng tìm kiếm)
${JSON.stringify(collect.trends, null, 1)}

## TIN TỨC MỚI NHẤT (RSS các báo: ${collect.news.length} bài)
${JSON.stringify(collect.news.slice(0, 70), null, 1)}

Trả về JSON theo schema ở trên. 3 topics chọn theo độ quan tâm tổng hợp (ưu tiên chủ đề xuất hiện ở nhiều nguồn + tín hiệu tăng trưởng rõ).`;

async function callModel(model) {
  const res = await fetch(LLM_BASE_URL.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LLM_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 16000,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: USER }],
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-flash-latest'];

async function callLLM() {
  const models = [LLM_MODEL, ...FALLBACK_MODELS.filter(m => m !== LLM_MODEL)];
  let lastErr;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[generate] gọi model: ${model} (lần ${attempt})`);
        return await callModel(model);
      } catch (e) {
        lastErr = e;
        const code = +(e.message.match(/HTTP (\d+)/) || [])[1] || 0;
        if (code === 400 || code === 401 || code === 403) throw e; // lỗi key/cấu hình → dừng
        if (code === 404) { console.warn(`[generate] model ${model} không khả dụng → chuyển model kế`); break; }
        console.warn(`[generate] ${e.message.slice(0, 140)} — thử lại sau ${15 * attempt}s`);
        await new Promise(r => setTimeout(r, 15000 * attempt));
      }
    }
  }
  throw lastErr;
}

function parseJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.slice(start, end + 1));
}

(async () => {
  console.log(`[generate] gọi LLM: ${LLM_MODEL} @ ${LLM_BASE_URL}`);
  const raw = await callLLM();
  const result = parseJson(raw);

  if (!result.summaries || !Array.isArray(result.topics) || !Array.isArray(result.posts)) {
    throw new Error('JSON trả về thiếu trường bắt buộc (summaries/topics/posts)');
  }

  fs.writeFileSync(path.join(outDir, 'posts.json'), JSON.stringify(result, null, 2));

  // tong-hop.md
  const tongHop = [
    `# TỔNG HỢP HOT TREND — ${collect.date}`, '',
    ...Object.entries(result.summaries).map(([k, v]) =>
      [`## ${k}`, ...v.map(x => `- ${x}`), ''].join('\n')),
    `# ✅ 3 CHỦ ĐỀ ĐƯỢC QUAN TÂM NHIỀU NHẤT`, '',
    ...result.topics.map(t => `## ${['🥇', '🥈', '🥉'][t.rank - 1] || ''} ${t.title}\n**Lý do:** ${t.reason}\n**Nguồn:** ${t.source_url}\n`),
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'tong-hop.md'), tongHop);

  // bai-N.md
  for (const p of result.posts) {
    const md = [
      `# BÀI ${p.n} — ${p.topic_title}`, '',
      `**Nguồn:** ${p.source_url}`, `**Khung giờ đăng đề xuất:** ${p.timing}`, '',
      '---', '', '## NỘI DUNG ĐĂNG (copy nguyên khối)', '', p.body_markdown, '',
      (p.hashtags || []).join(' '),
    ].join('\n');
    fs.writeFileSync(path.join(outDir, `bai-${p.n}.md`), md);
  }

  console.log(`[generate] OK: ${result.posts.length} bài, ${result.topics.length} chủ đề → ${outDir}`);
})();
