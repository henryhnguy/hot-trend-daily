// Bước 4: Dựng email.json (HTML tổng hợp + 3 bài + đính kèm ảnh)
const fs = require('fs');
const path = require('path');

const date = process.argv[2] || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const outDir = path.join(__dirname, '..', 'outputs', date);
const result = JSON.parse(fs.readFileSync(path.join(outDir, 'posts.json'), 'utf8'));

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const box = (bg, border) => `background:${bg};border-left:4px solid ${border};padding:14px 18px;margin:14px 0;border-radius:6px`;

const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:auto;color:#222;line-height:1.55">
  <div style="background:#1a73e8;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">🔔 [Duyệt bài] Trend &amp; 3 bài đăng Facebook — ${esc(date)}</h2>
    <p style="margin:6px 0 0;font-size:13px">hot-trend-daily bot</p>
  </div>
  <div style="background:#fff8e1;border:1px solid #f0d47a;padding:10px 18px;font-size:13px">
    ⚠️ <b>Chưa đăng bất cứ gì lên Facebook.</b> Trả lời email này <b>"Duyệt bài 1/2/3"</b> (hoặc góp ý chỉnh sửa) — bài chỉ được đăng sau khi bạn xác nhận.
  </div>

  <h3 style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">1️⃣ TỔNG KẾT HOT TREND THEO TỪNG NỀN TẢNG</h3>
  ${Object.entries(result.summaries).map(([k, v]) =>
    `<div style="${box('#f6f9ff', '#9db9e8')}"><b style="color:#0d47a1">${esc(k)}</b><ul style="margin:6px 0;padding-left:20px">${v.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}

  <h3 style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">2️⃣ 3 CHỦ ĐỀ ĐƯỢC QUAN TÂM NHIỀU NHẤT</h3>
  ${result.topics.map(t => `<div style="${box('#eef7ee', '#4caf50')}">
    <b>${esc(['🥇', '🥈', '🥉'][t.rank - 1] || '')} ${esc(t.title)}</b><br>
    <span style="font-size:13px">Lý do: ${esc(t.reason)}</span><br>
    <a href="${esc(t.source_url)}" style="font-size:12px">${esc(t.source_url)}</a>
  </div>`).join('')}

  <h3 style="color:#1a73e8;border-bottom:2px solid #1a73e8;padding-bottom:6px">3️⃣ NỘI DUNG 3 BÀI ĐĂNG (sẵn sàng dán lên page)</h3>
  ${result.posts.map(p => `<div style="${box('#fdf3f3', '#e53935')}">
    <p style="margin:0 0 8px"><b>BÀI ${p.n}</b> — ${esc(p.topic_title)}<br>
    🕐 Khung giờ đề xuất: <b>${esc(p.timing)}</b>
    ${p.image_file ? ` &nbsp;|&nbsp; 🖼️ Ảnh đính kèm: <b>${esc(p.image_file)}</b>` : ' &nbsp;|&nbsp; ⚠️ không có ảnh minh họa'}</p>
    <div style="background:#fff;border:1px dashed #ccc;padding:14px;border-radius:6px;font-size:14px;white-space:pre-wrap">${esc(p.body_markdown)}
${esc((p.hashtags || []).join(' '))}</div>
  </div>`).join('')}

  <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
  <p style="font-size:12px;color:#888">
    Kết quả đầy đủ lưu trong repo: outputs/${esc(date)}/ (tong-hop.md, bai-1..3.md, posts.json, ảnh).<br>
    ${esc(result.notes || '')}
  </p>
</div>`;

const email = {
  subject: `[Duyệt bài] Trend & 3 bài đăng Facebook — ${date}`,
  text: `Tổng hợp trend + 3 bài đăng Facebook chờ duyệt (${date}). Mở email bằng trình đọc HTML để xem đầy đủ.`,
  html,
  attachments: result.posts
    .filter(p => p.image_file && fs.existsSync(path.join(outDir, p.image_file)))
    .map(p => ({ filename: p.image_file, path: path.join(outDir, p.image_file) })),
};

fs.writeFileSync(path.join(outDir, 'email.json'), JSON.stringify(email, null, 2));
console.log(`[email] đã dựng email.json (${html.length} ký tự HTML, ${email.attachments.length} ảnh đính kèm)`);
