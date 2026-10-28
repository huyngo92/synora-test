# synora-test — YAML-first Web & API Test Automation

> **CLI test runner** nhẹ, xây dựng trên [Playwright](https://playwright.dev/).  
> Viết test bằng YAML dễ đọc — gọi JS helper cho logic phức tạp — test API ngay trong flow.

---

## Cài Đặt

```bash
# Cài từ npm (global)
npm install -g synora-test
npx playwright install chromium   # tải browser cho Playwright (chỉ cần 1 lần)

# Hoặc cài vào project
npm install --save-dev synora-test
npx synora-test --help

# Từ source (dev local)
git clone https://github.com/huyngo92/synora-test.git
cd synora-test
npm install
npm link

# Kiểm tra
synora-test --help
```

---

## Quick Start

### 1. Ghi test tự động (codegen)

```bash
# Mở trình duyệt, thao tác, xuất YAML ra terminal
synora-test codegen https://example.com

# Ghi vào file
synora-test codegen --output flows/login.yaml https://example.com
```

### 2. Chạy test

```bash
# Chạy 1 flow
synora-test run flows/login.yaml

# Chạy có giao diện, chậm 300ms/bước (debug)
synora-test run flows/login.yaml --headed --slow 300

# Chạy toàn bộ thư mục, 3 flow song song
synora-test run flows/ --parallel 3
```

### 3. Ví dụ nhanh

```bash
synora-test run examples/google-search.yaml --headed
```

---

## CLI Reference

### `synora-test codegen [url]`

| Flag | Mô tả |
|------|-------|
| `--output <file>` | Ghi YAML vào file (thư mục tự tạo nếu chưa có) |
| `--domain-mapping <file>` | File JSON ánh xạ domain tùy chỉnh |

### `synora-test run <file|dir>`

| Flag | Mặc định | Mô tả |
|------|----------|-------|
| `--headed` | headless | Hiển thị cửa sổ trình duyệt |
| `--slow <ms>` | `0` | Delay (ms) giữa các bước |
| `--browser <name>` | `chromium` | `chromium` / `firefox` / `webkit` |
| `--timeout <ms>` | `30000` | Timeout mỗi action |
| `--base-url <url>` | — | Ghi đè `config.baseUrl` của tất cả flow |
| `--parallel <n>` / `-p <n>` | `1` | Số flow chạy đồng thời |
| `--trace <mode>` | off | `on` / `retain-on-failure` |
| `--screenshot <mode>` | `only-on-failure` | `on` / `off` / `only-on-failure` |
| `--output-dir <dir>` | `test-results` | Thư mục lưu kết quả |
| `--no-report` | — | Bỏ qua file HTML/JSON report |

### `synora-test suite <file>`

Chạy nhiều nhóm flow với thứ tự, điều kiện, và song song linh hoạt.

```bash
synora-test suite suites/regression.yaml
synora-test suite suites/regression.yaml --headed --base-url https://staging.synora
```

---

## Cấu Trúc File YAML

```yaml
appId: browser
name: Login Flow
config:
  baseUrl: ${BASE_URL:-https://example.com}
  data: ./data/users.json       # file dữ liệu đơn
  # data:                       # hoặc nhiều file
  #   - file: ./data/accounts.json
  #     as: accounts
  #   - file: ./data/products.json
  #     as: products
---
- openLink: ${config.baseUrl}/login

- tapOn: "Tên đăng nhập"
- inputText: ${admin.username}

- tapOn: "Mật khẩu"
- inputText: ${admin.password}

- tapOn:
    role: button
    name: "Đăng nhập"

- assertVisible: "Dashboard"
```

---

## Các Lệnh Hỗ Trợ (Commands)

| Lệnh | Ví dụ |
|------|-------|
| `openLink` | `openLink: https://example.com` |
| `tapOn` | `tapOn: "Login"` hoặc `tapOn: { role: button, name: Login }` |
| `doubleTapOn` | `doubleTapOn: "item name"` |
| `inputText` | `inputText: hello@world.com` |
| `clearText` | `clearText: { css: "#field" }` |
| `pressKey` | `pressKey: Enter` |
| `scroll` | `scroll: down` / `scroll: up` |
| `hover` | `hover: "Menu"` |
| `check` | `check: "Ghi nhớ đăng nhập"` |
| `uncheck` | `uncheck: "Đăng ký nhận tin"` |
| `selectOption` | `selectOption: { text: "Dropdown", option: "Lựa chọn A" }` |
| `wait` | `wait: 1000` |
| `waitForVisible` | `waitForVisible: "Spinner"` |
| `waitForHidden` | `waitForHidden: "Loading"` |
| `assertVisible` | `assertVisible: "Chào mừng"` |
| `assertNotVisible` | `assertNotVisible: "Lỗi"` |
| `assertText` | `assertText: "Đăng nhập thành công"` |
| `assertTitle` | `assertTitle: "Dashboard"` |
| `assertUrl` | `assertUrl: /dashboard` |
| `assertScreenshot` | `assertScreenshot: login-page` |
| `api` | Gọi HTTP API (xem docs/usage.md) |
| `call` | `call: helpers/custom.js#myFn` |
| `capture` | `capture: { "vars.myVar": "document.title" }` |
| `loop` | Lặp qua mảng dữ liệu (xem docs/usage.md) |
| `runIf` | Rẽ nhánh if / else theo biến (xem docs/usage.md) |

---

## Locators

```yaml
- tapOn: "Đăng nhập"                     # text hiển thị

- tapOn:
    role: button
    name: "Đăng nhập"                    # ARIA role + name

- tapOn:
    label: "Email"                        # associated label

- tapOn:
    css: "input[name=\"username\"]"       # CSS selector

- tapOn:
    id: "submit-btn"                      # data-testid hoặc id

- tapOn:
    xpath: "//button[@type='submit']"     # XPath
```

---

## Nội Suy Biến (Variable Interpolation)

| Cú pháp | Giải thích |
|---------|-----------|
| `${key}` | Giá trị trong data hoặc config |
| `${a.b.c}` | Nested path |
| `${data.users[0].name}` | Phần tử mảng |
| `${MY_ENV_VAR}` | Biến môi trường |
| `${KEY:-default}` | Default nếu key không tồn tại |
| `${loop.index}` | Chỉ số vòng lặp (chỉ trong `loop:`) |

---

## Tài Liệu Chi Tiết

Xem [docs/usage.md](./docs/usage.md) để có hướng dẫn đầy đủ:

- Quản lý dữ liệu test (single file, multi-file, CSV)
- Data-driven với `loop:`
- Điều kiện rẽ nhánh `runIf:` (if / else)
- Chạy song song (`--parallel`)
- Reports: HTML, JSON, Trace, Screenshot
- Kiểm thử API (`api:`)
- JS Helpers & `BaseService` / `AuthService`
- Test Suite — nhóm flow, song song, `dependsOn`
- Ví dụ hoàn chỉnh
