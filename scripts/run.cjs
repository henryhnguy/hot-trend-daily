// Orchestrator: collect → generate (LLM) → images → email → send
// Nếu lỗi: gửi email thông báo lỗi (nếu có cấu hình SMTP) rồi thoát mã 1
const { spawnSync } = require('child_process');
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

const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const STEP = ['collect.cjs', 'generate.cjs', 'images.cjs', 'email.cjs', 'mailer.cjs'];

function runStep(file) {
  console.log(`\n===== ${file} =====`);
  const r = spawnSync(process.execPath, [path.join(__dirname, file), date], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) throw new Error(`Bước ${file} thất bại (exit ${r.status})`);
}

function sendFailureEmail(errMsg) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return; // không có SMTP thì bỏ qua
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
    transporter.sendMail({
      from: `"Trend Bot (lỗi)" <${GMAIL_USER}>`,
      to: EMAIL_TO || GMAIL_USER,
      subject: `[Trend Bot] LỖI chạy hằng ngày — ${date}`,
      text: `Pipeline hằng ngày thất bại ngày ${date}.\n\n${errMsg}\n\nXem log GitHub Actions (nếu chạy trên Actions) hoặc chạy lại: node scripts/run.cjs`,
    }).then(() => console.log('[run] đã gửi email báo lỗi'));
  } catch (e) { console.error('[run] không gửi được email báo lỗi:', e.message); }
}

(async () => {
  try {
    for (const file of STEP) runStep(file);
    console.log(`\n✅ PIPELINE HOÀN TẤT ${date} — email duyệt đã gửi`);
  } catch (e) {
    console.error('\n❌ PIPELINE THẤT BẠI:', e.message);
    sendFailureEmail(e.message);
    process.exit(1);
  }
})();
