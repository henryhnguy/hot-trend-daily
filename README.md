# hot-trend-daily 🔥

Tự động hóa hằng ngày (20:00 giờ Việt Nam): **lọc hot trend mạng xã hội VN → tổng hợp theo nền tảng → chọn 3 chủ đề quan tâm nhất → soạn 3 bài Facebook kèm ảnh minh họa → gửi email duyệt trước khi đăng**.

Chạy trên **GitHub Actions** (miễn phí) hoặc chạy local. Kết quả mỗi ngày được commit vào thư mục `outputs/<ngày>/` làm archive.

## Kiến trúc

```
RSS/Google Trends → collect.cjs → generate.cjs (LLM) → images.cjs → email.cjs → mailer.cjs
   (dữ liệu)         (collect.json)   (posts.json,       (ảnh bai-N)   (email.json)  (Gmail SMTP)
                                          bài .md)
```

| Bước | Script | Việc |
|------|--------|------|
| 1 | `scripts/collect.cjs` | Lấy Google Trends VN + tin mới từ VnExpress, Dân Trí, Thanh Niên, Kenh14 qua RSS |
| 2 | `scripts/generate.cjs` | Gọi LLM (GLM/OpenAI/Gemini — mọi API tương thích OpenAI) để tổng hợp, chọn 3 chủ đề, soạn 3 bài |
| 3 | `scripts/images.cjs` | Tự lấy ảnh minh họa từ og:image của bài báo nguồn cho từng bài |
| 4 | `scripts/email.cjs` | Dựng email HTML: tổng kết + 3 chủ đề + nội dung đầy đủ 3 bài + ảnh đính kèm |
| 5 | `scripts/mailer.cjs` | Gửi Gmail (thử lại 3 lần). Lỗi pipeline → gửi email báo lỗi |

**Bot KHÔNG tự đăng Facebook** — dừng ở email chờ duyệt. Bài duyệt xong sẽ đăng thủ công hoặc qua phiên làm việc có người.

## Thiết lập trên GitHub (khuyến nghị)

### Bước 1 — Tạo repo và push
```bash
git init && git add -A && git commit -m "hot-trend-daily v1"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```
(hoặc dùng GitHub CLI: `gh repo create hot-trend-daily --private --source . --push`)

### Bước 2 — Thêm Secrets (Settings → Secrets and variables → Actions)

| Secret | Giá trị |
|--------|---------|
| `GMAIL_USER` | Gmail gửi thư, ví dụ `hainguyenck@gmail.com` |
| `GMAIL_APP_PASSWORD` | App Password 16 ký tự ([tạo tại đây](https://myaccount.google.com/apppasswords), cần bật 2-Step Verification) |
| `EMAIL_TO` | Email nhận thư duyệt |
| `LLM_API_KEY` | API key của LLM |
| `LLM_BASE_URL` | `https://api.z.ai/api/paas/v4` (GLM) • `https://api.openai.com/v1` • `https://generativelanguage.googleapis.com/v1beta/openai` (Gemini) |
| `LLM_MODEL` | `glm-4.6` • `gpt-4o-mini` • `gemini-2.5-flash` … |
| `EMAIL_FROM_NAME` | (tùy chọn) tên người gửi |

### Bước 3 — Kích hoạt
- Action tự chạy lúc **13:00 UTC = 20:00 giờ VN** hằng ngày (lịch trong `.github/workflows/daily.yml`)
- Chạy tay ngay: tab **Actions → hot-trend-daily → Run workflow**
- Kết quả nằm ở `outputs/<ngày>/` (bot tự commit) + email duyệt trong hộp thư

### Lưu ý GitHub Actions
- Cron có thể trễ vài phút so với 20:00 (giới hạn của GitHub).
- Repo **private**: tốn ~2-3 phút Actions/ngày (gói free 2.000 phút/tháng là dư). Repo **public**: miễn phí không giới hạn, nhưng GitHub tắt schedule nếu repo 60 ngày không có hoạt động — pipeline tự commit mỗi ngày nên gần như không bao giờ bị.
- Đổi giờ chạy: sửa dòng `cron` (giờ Việt Nam = UTC+7).

## Chạy local (thử nghiệm/khẩn cấp)

```bash
npm install
cp .env.example .env    # điền giá trị
node scripts/run.cjs    # hoặc: npm run collect / generate / send (từng bước)
```

## Bảo mật
- App Password và API key **không bao giờ nằm trong code** — chỉ trong Secrets (GitHub) hoặc `.env` (local, đã gitignore).
- `config.json`, `.env`, `node_modules` đã đưa vào `.gitignore`.

## Sửa nội dung/thang đo
- **`preferences.md`** — tiêu chí biên tập của page (thứ hạng ưu tiên chủ đề, giọng văn, ràng buộc) — tự động nạp vào prompt mỗi lần chạy. Sửa file này để đổi "gu" chọn bài.
- Prompt để chọn chủ đề + viết bài nằm trong `scripts/generate.cjs` (hằng số `SYSTEM`).
- Danh sách nguồn RSS nằm trong `scripts/collect.cjs` (hằng số `FEEDS`).
