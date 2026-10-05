// Bước 5: Gửi email duyệt qua Gmail SMTP (nodemailer)
// Env cần: GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO (xem .env.example)
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

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

const { GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO, EMAIL_FROM_NAME } = process.env;
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('[mailer] Thiếu GMAIL_USER / GMAIL_APP_PASSWORD (xem .env.example)');
  process.exit(1);
}

const date = process.argv[2] || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const emailJson = path.join(__dirname, '..', 'outputs', date, 'email.json');
const mail = JSON.parse(fs.readFileSync(emailJson, 'utf8'));

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

async function send() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"${EMAIL_FROM_NAME || 'Trend Bot'}" <${GMAIL_USER}>`,
        to: EMAIL_TO || GMAIL_USER,
        subject: mail.subject,
        text: mail.text ?? '',
        html: mail.html ?? '',
        attachments: mail.attachments ?? [],
      });
      console.log(`[mailer] ĐÃ GỬI ${info.messageId} → ${EMAIL_TO || GMAIL_USER}`);
      return;
    } catch (e) {
      console.error(`[mailer] lần ${attempt}: ${e.message}`);
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
}

send().catch(e => { console.error('[mailer] GỬI THẤT BẠN sau 3 lần:', e.message); process.exit(1); });
