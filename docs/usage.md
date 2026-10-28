# synora-test — Hướng dẫn sử dụng chi tiết

> Tài liệu đầy đủ cho `synora-test`.  
> Xem [../README.md](../README.md) để có overview và quick-start.

---

## Mục lục

1. [Cài đặt](#1-cài-đặt)
2. [Ghi test (codegen)](#2-ghi-test-codegen)
3. [Chạy test (run)](#3-chạy-test-run)
4. [Cấu trúc file YAML](#4-cấu-trúc-file-yaml)
5. [Danh sách lệnh (commands)](#5-danh-sách-lệnh-commands)
6. [Locators — chỉ định phần tử](#6-locators--chỉ-định-phần-tử)
7. [Biến & nội suy (variables)](#7-biến--nội-suy-variables)
8. [Quản lý dữ liệu test (data)](#8-quản-lý-dữ-liệu-test-data)
9. [Data-driven với `loop:`](#9-data-driven-với-loop)
10. [Điều kiện rẽ nhánh `runIf:`](#10-điều-kiện-rẽ-nhánh-runif)
11. [Chạy song song (parallel)](#11-chạy-song-song-parallel)
12. [Reports — HTML, JSON, Trace, Screenshot](#12-reports--html-json-trace-screenshot)
13. [Kiểm thử API](#13-kiểm-thử-api)
14. [JS Helpers](#14-js-helpers)
15. [Test Suite — nhiều group, song song & nối tiếp](#15-test-suite--nhiều-group-song-song--nối-tiếp)
16. [Ví dụ hoàn chỉnh](#16-ví-dụ-hoàn-chỉnh)

---

## 1. Cài đặt

```bash
# Cài từ npm
npm install -g synora-test
npx playwright install chromium

# Hoặc từ source (dev local)
git clone https://github.com/huyngo92/synora-test.git
cd synora-test
npm install
npm link

# Kiểm tra
synora-test --help
```

---

## 2. Ghi test (codegen)

Mở trình duyệt, thực hiện thao tác, xuất ra file YAML tự động:

```bash
# Mở trình ghi, in YAML ra terminal
synora-test codegen https://example.com

# Ghi vào file cụ thể (thư mục tự tạo nếu chưa có)
synora-test codegen --output flows/login.yaml https://example.com

# Domain mapping tùy chỉnh
synora-test codegen --domain-mapping ./mapping.json https://example.com
```

> **Lưu ý mạng nội bộ (SSL tự ký):** `synora-test codegen` đã tắt kiểm tra SSL, không cần thêm cờ gì.

---

## 3. Chạy test (run)

```bash
# Chạy 1 file
synora-test run flows/login.yaml

# Chạy với trình duyệt hiển thị, chậm lại 300ms/bước
synora-test run flows/login.yaml --headed --slow 300

# Chạy toàn bộ folder
synora-test run flows/

# Chọn trình duyệt
synora-test run flows/ --browser firefox
synora-test run flows/ --browser webkit

# Override base URL
synora-test run flows/ --base-url https://staging.synora

# Tăng timeout (ms)
synora-test run flows/ --timeout 60000

# Chạy song song 3 flow cùng lúc
synora-test run flows/ --parallel 3
synora-test run flows/ -p 3
```

### Tất cả options

| Flag | Mặc định | Mô tả |
|------|----------|-------|
| `--headed` | headless | Hiển thị cửa sổ trình duyệt |
| `--slow <ms>` | `0` | Thêm delay (ms) giữa các bước |
| `--browser <name>` | `chromium` | `chromium` / `firefox` / `webkit` |
| `--timeout <ms>` | `30000` | Timeout mỗi action (ms) |
| `--base-url <url>` | — | Ghi đè `config.baseUrl` trong tất cả flow |
| `--parallel <n>` / `-p <n>` | `1` | Số flow chạy đồng thời |
| `--trace <mode>` | off | `on` / `retain-on-failure` |
| `--screenshot <mode>` | `only-on-failure` | `on` / `off` / `only-on-failure` |
| `--output-dir <dir>` | `test-results` | Thư mục lưu kết quả |
| `--no-report` | — | Bỏ qua file HTML/JSON report |

---

## 4. Cấu trúc file YAML

```yaml
# --- Phần header (config) ---
appId: browser          # luôn là "browser" với web test
name: Tên flow          # mô tả
tags:
  - web
  - login
config:
  baseUrl: https://example.com    # URL gốc
  data: ./data/users.json         # file dữ liệu (tuỳ chọn)

# --- Phần steps (ngăn cách bởi ---) ---
---
- openLink: ${config.baseUrl}/login

- tapOn: "Tên đăng nhập"
- inputText: admin

- tapOn:
    role: button
    name: "Đăng nhập"

- assertVisible: "Chào mừng"
```

---

## 5. Danh sách lệnh (commands)

| Lệnh | Ví dụ | Mô tả |
|------|-------|-------|
| `openLink` | `openLink: https://example.com` | Mở URL |
| `tapOn` | `tapOn: "Login"` | Click vào phần tử |
| `doubleTapOn` | `doubleTapOn: "item"` | Double-click |
| `inputText` | `inputText: hello@world.com` | Nhập văn bản (xóa trước khi nhập) |
| `clearText` | `clearText: { css: "#field" }` | Xóa nội dung input |
| `pressKey` | `pressKey: Enter` | Nhấn phím |
| `scroll` | `scroll: down` / `scroll: up` | Cuộn trang |
| `hover` | `hover: "Menu"` | Di chuột qua phần tử |
| `check` | `check: "Ghi nhớ"` | Tick checkbox |
| `uncheck` | `uncheck: "Đăng ký"` | Bỏ tick checkbox |
| `selectOption` | `selectOption: { text: "Dropdown", option: "Lựa chọn A" }` | Chọn option trong `<select>` |
| `wait` | `wait: 1000` | Chờ (ms) |
| `waitForVisible` | `waitForVisible: "Spinner"` | Chờ phần tử xuất hiện |
| `waitForHidden` | `waitForHidden: "Loading"` | Chờ phần tử biến mất |
| `assertVisible` | `assertVisible: "Chào mừng"` | Kiểm tra phần tử hiển thị |
| `assertNotVisible` | `assertNotVisible: "Lỗi"` | Kiểm tra phần tử không hiển thị |
| `assertText` | `assertText: "Đăng nhập thành công"` | Kiểm tra văn bản |
| `assertTitle` | `assertTitle: "Dashboard"` | Kiểm tra tiêu đề trang |
| `assertUrl` | `assertUrl: /dashboard` | Kiểm tra URL chứa chuỗi |
| `assertScreenshot` | `assertScreenshot: login-page` | So sánh ảnh chụp màn hình |
| `api` | xem [Kiểm thử API](#13-kiểm-thử-api) | Gọi HTTP API |
| `call` | `call: helpers/custom.js#myFn` | Gọi JS helper |
| `capture` | `capture: { "vars.myVar": "document.title" }` | Lưu giá trị vào biến |
| `loop` | xem [loop:](#9-data-driven-với-loop) | Lặp qua mảng dữ liệu |
| `runIf` | xem [runIf:](#10-điều-kiện-rẽ-nhánh-runif) | Rẽ nhánh if / else theo biến |

---

## 6. Locators — chỉ định phần tử

Một lệnh như `tapOn` có thể nhận **chuỗi** hoặc **object**:

```yaml
# Chuỗi inline — tìm theo text hiển thị (exact match)
- tapOn: "Đăng nhập"

# Object với props
- tapOn:
    role: button          # ARIA role
    name: "Đăng nhập"     # accessible name
    nth: 0                # phần tử thứ N (0-based), nếu có nhiều match

- tapOn:
    text: "Tên đăng nhập"  # tìm theo text

- tapOn:
    label: "Email"         # tìm theo label liên kết

- tapOn:
    css: "input[name=\"username\"]"   # CSS selector

- tapOn:
    id: "submit-btn"       # data-testid hoặc id

- tapOn:
    xpath: "//button[@type='submit']"  # XPath
```

### Thứ tự ưu tiên selector (codegen tạo ra)

| Ưu tiên | Prop | Ghi chú |
|---------|------|---------|
| 1 | `role` + `name` | ARIA — ưu tiên cao nhất |
| 2 | `text` | Text hiển thị |
| 3 | `label` | Associated label |
| 4 | `id` / `testid` | `data-testid` hoặc `id` attribute |
| 5 | `css` | CSS selector (fallback) |

---

## 7. Biến & nội suy (variables)

| Cú pháp | Giải thích |
|---------|-----------|
| `${key}` | Giá trị trong data hoặc config |
| `${a.b.c}` | Nested path |
| `${data.users[0].name}` | Phần tử mảng |
| `${MY_ENV_VAR}` | Biến môi trường (`process.env.MY_ENV_VAR`) |
| `${KEY:-default}` | Dùng default nếu key không tồn tại |
| `${config.baseUrl}` | Truy cập config của flow |
| `${loop.index}` | Chỉ số vòng lặp (chỉ dùng trong `loop:`) |

```yaml
config:
  baseUrl: ${BASE_URL:-https://staging.synora}
---
- openLink: ${config.baseUrl}/login
- inputText: ${admin.username}
- inputText: ${MY_PASSWORD}
```

---

## 8. Quản lý dữ liệu test (data)

### File đơn

```yaml
config:
  data: ./data/users.json    # merge vào vars trực tiếp
```

`users.json`:
```json
{
  "admin": { "username": "admin@synora.com", "password": "Admin@123" },
  "viewer": { "username": "viewer@synora.com", "password": "Viewer@123" }
}
```

Sử dụng: `${admin.username}`, `${viewer.password}`

---

### Nhiều file (có namespace)

```yaml
config:
  data:
    - file: ./data/accounts.json
      as: accounts       # → vars.accounts
    - file: ./data/products.json
      as: products       # → vars.products
    - ./data/config.json # không có as → merge trực tiếp vào vars
```

Sử dụng: `${accounts[0].username}`, `${products[1].name}`

---

### Định dạng file hỗ trợ

| Định dạng | Lưu ý |
|-----------|-------|
| `.json` | Object hoặc Array |
| `.csv` | Tự động parse, kết quả là array of objects |

---

## 9. Data-driven với `loop:`

Lặp qua từng phần tử của một mảng:

```yaml
config:
  data:
    - file: ./data/users.json   # [{ "username": "u1", "role": "admin" }, ...]
      as: users
---
- openLink: ${config.baseUrl}/login

- loop:
    over: users         # tên biến chứa mảng (vars.users)
    as: row             # tên biến cho mỗi phần tử (vars.row)
    steps:
      - tapOn:
          css: "input[name=\"username\"]"
      - inputText: ${row.username}

      - tapOn:
          css: "input[name=\"password\"]"
      - inputText: ${row.password}

      - tapOn:
          role: button
          name: "Đăng nhập"

      - assertVisible: ${row.role}

      # loop.index = 0, 1, 2, ...
      - assertUrl: /home
```

---

## 10. Điều kiện rẽ nhánh `runIf:`

Chạy một nhóm bước **chỉ khi điều kiện đúng** — và nhóm khác khi sai (tùy chọn).

### Cú pháp cơ bản

```yaml
- runIf:
    condition: '"${status}" === "APPROVED"'   # biểu thức JS (${...} được resolve trước)
    then:                                        # chạy khi condition = true
      - tapOn: "Continue"
      - assertVisible: "Success"
    else:                                        # chạy khi condition = false (tuỳ chọn)
      - tapOn: "Cancel"
```

### Các loại điều kiện

#### So sánh chuỗi — wrap biến trong `"..."`

```yaml
- runIf:
    condition: '"${status}" === "APPROVED"'
    then:
      - assertVisible: "Approved Label"
    else:
      - assertVisible: "Pending Label"
```

#### So sánh số — không cần nháy

```yaml
# Lấy retryCount từ biến đã capture
- runIf:
    condition: '${retryCount} < 3'
    then:
      - wait: 2000
      - tapOn: "Retry"
```

#### Kết hợp nhiều điều kiện

```yaml
- runIf:
    condition: '"${responseCode}" === "200" && ${itemCount} > 0'
    then:
      - tapOn: "Proceed"
```

#### Kiểm tra biến không rỗng

```yaml
- runIf:
    condition: '"${capturedToken}" !== "" && "${capturedToken}" !== "undefined"'
    then:
      - tapOn: "Continue with token"
```

#### Truy cập nested object qua `vars.`

```yaml
- runIf:
    condition: 'vars.user.role === "admin"'
    then:
      - tapOn: "Admin Panel"
```

### Chỉ có `then`, không có `else`

Nếu condition false thì bỏ qua, không báo lỗi:

```yaml
- runIf:
    condition: '"${errorMsg}" !== ""'
    then:
      - assertVisible: "${errorMsg}"
```

### Kết hợp với `capture:` và `api:`

```yaml
# Gọi API lấy trạng thái đơn hàng
- api:
    method: GET
    url: ${config.baseUrl}/api/orders/${orderId}
    capture:
      order.status: body.status

# Rẽ nhánh dựa vào kết quả
- runIf:
    condition: '"${order.status}" === "PENDING"'
    then:
      - tapOn: "Approve Order"
      - assertVisible: "Order approved"
    else:
      - assertVisible: "${order.status}"
```

### Lưu ý

| Điểm | Giải thích |
|------|------------|
| `${...}` resolve trước | `${status}` → giá trị thực → rồi mới eval JS |
| Chuỗi cần dấu `""` | Nếu không quote: `${status} === APPROVED` → lỗi `APPROVED is not defined` |
| `vars.` truy cập trực tiếp | `vars.user.name` không qua interpolation, an toàn hơn với giá trị có ký tự đặc biệt |
| Lỗi eval → throw | Nếu biểu thức JS sai cú pháp, step sẽ throw lỗi rõ ràng |
| Branch steps đầy đủ | `then`/`else` hỗ trợ tất cả lệnh: `api`, `call`, `capture`, `loop`, mọi web command |

---

## 11. Chạy song song (parallel)

```bash
# Chạy 3 flow đồng thời
synora-test run flows/ --parallel 3

# Kết hợp các flag khác
synora-test run flows/ -p 4 --browser chromium --timeout 60000 --base-url https://staging.synora
```

Mỗi flow chạy trong **browser context độc lập** — không chia sẻ cookie, session, hay state.

> **Lưu ý:** Nếu máy ít RAM, tránh đặt `--parallel` quá cao (mỗi context ≈ 50–100 MB).

---

## 12. Reports — HTML, JSON, Trace, Screenshot

Mặc định sau mỗi lần `synora-test run`, kết quả được lưu vào thư mục `test-results/`:

```
test-results/
├── report.html          ← mở bằng trình duyệt
├── report.json          ← dữ liệu thô
├── screenshots/
│   └── flows_login-admin.png
└── traces/
    └── flows_login-admin.zip
```

### Cấu trúc report.json

```json
{
  "summary": {
    "total": 3,
    "passed": 2,
    "failed": 1,
    "duration": 12450,
    "timestamp": "2026-05-08T10:00:00.000Z"
  },
  "results": [
    {
      "name": "flows/login-admin.yaml",
      "passed": true,
      "duration": 4200
    },
    {
      "name": "flows/checkout.yaml",
      "passed": false,
      "duration": 5100,
      "error": "Timeout 30000ms exceeded waiting for locator...",
      "screenshot": "screenshots/flows_checkout.png",
      "traceFile": "traces/flows_checkout.zip"
    }
  ]
}
```

### Các flag liên quan đến report

```bash
# Trace: chỉ lưu khi fail
synora-test run flows/ --trace retain-on-failure

# Trace: luôn lưu
synora-test run flows/ --trace on

# Screenshot: luôn chụp (kể cả khi pass)
synora-test run flows/ --screenshot on

# Tắt screenshot
synora-test run flows/ --screenshot off

# Đổi thư mục output
synora-test run flows/ --output-dir my-results

# Tắt report (chỉ in ra console)
synora-test run flows/ --no-report

# Xem trace sau khi chạy
npx playwright show-trace test-results/traces/flows_login-admin.zip
```

### Hành vi mặc định

|  | Khi pass | Khi fail |
|--|----------|----------|
| Screenshot | ❌ | ✅ lưu PNG |
| Trace | ❌ | ❌ (cần `--trace`) |
| HTML Report | ✅ | ✅ |
| JSON Report | ✅ | ✅ |

### Convert report.json → JUnit XML (Jenkins / Azure DevOps)

```js
// scripts/to-junit.js
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('test-results/report.json', 'utf8'));

const cases = report.results.map(r => {
  if (r.passed) return `  <testcase name="${r.name}" time="${(r.duration/1000).toFixed(2)}" />`;
  return `  <testcase name="${r.name}" time="${(r.duration/1000).toFixed(2)}">
    <failure message="${(r.error ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" />
  </testcase>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="synora-test" tests="${report.summary.total}" failures="${report.summary.failed}" time="${(report.summary.duration/1000).toFixed(2)}">
${cases}
</testsuite>`;

fs.writeFileSync('test-results/report.xml', xml);
console.log('Written: test-results/report.xml');
```

```bash
node scripts/to-junit.js
```

### Convert report.json → CSV (Excel / Google Sheets)

```js
// scripts/to-csv.js
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('test-results/report.json', 'utf8'));

const lines = [
  'name,passed,duration_s,error',
  ...report.results.map(r =>
    `"${r.name}",${r.passed},${((r.duration ?? 0) / 1000).toFixed(2)},"${(r.error ?? '').replace(/"/g, '""')}"`
  ),
];

fs.writeFileSync('test-results/report.csv', lines.join('\n'));
console.log('Written: test-results/report.csv');
```

---

## 13. Kiểm thử API

Gọi HTTP API trực tiếp trong YAML flow:

```yaml
- api:
    method: POST                          # GET / POST / PUT / PATCH / DELETE
    url: ${config.baseUrl}/api/auth/login
    headers:
      Content-Type: application/json
    body:
      username: ${admin.username}
      password: ${admin.password}
    assert:
      status: 200                         # kiểm tra status code
      body: "token"                       # kiểm tra body chứa chuỗi
    capture:
      auth.token: body.token              # lưu body.token vào vars["auth.token"]
```

Sau khi `capture auth.token`, các bước UI tiếp theo có thể dùng `${auth.token}`.

---

## 14. JS Helpers

Gọi hàm JS tùy chỉnh khi logic phức tạp hơn YAML:

```yaml
- call: helpers/login-api.js#loginAndSetCookie
```

```js
// helpers/login-api.js
const { AuthService } = require('synora-test');

module.exports.loginAndSetCookie = async function(page, context, vars, opts) {
  const auth = new AuthService(context, vars.config.baseUrl);
  await auth.login('/api/auth/login', {
    username: vars.admin.username,
    password: vars.admin.password,
  });

  // Inject token vào cookie của browser
  await context.addCookies([{
    name: 'access_token',
    value: auth.token,
    domain: new URL(vars.config.baseUrl).hostname,
    path: '/',
  }]);
};
```

Hàm helper nhận đầu vào `(page, context, vars, opts)` trong đó `vars` là toàn bộ variable map.

### BaseService & AuthService

```js
const { BaseService, AuthService } = require('synora-test');

// BaseService — HTTP client thuần
const svc = new BaseService(context, 'https://api.example.com');
const res = await svc.get('/users');
await svc.assertStatus(res, 200);
await svc.assertBodyContains(res, 'admin');

// AuthService — kế thừa BaseService, quản lý token
const auth = new AuthService(context, baseUrl);
await auth.login('/api/auth/login', { username, password });
// auth.token đã có sau login

// Tạo service tự động inject Authorization header
const authorizedSvc = auth.createAuthorizedService('/api');
const me = await authorizedSvc.get('/me');   // → Authorization: Bearer <token>
```

---

## 15. Test Suite — nhiều group, song song & nối tiếp

Khi cần tổ chức nhiều flow thành các nhóm (có thứ tự, điều kiện, hoặc song song), dùng `synora-test suite`.

### Cấu trúc file suite

```yaml
# suites/regression.yaml
name: Full Regression Suite

config:
  browser: chromium
  headed: false
  timeout: 45000
  baseUrl: ${BASE_URL:-https://staging.synora}
  trace: retain-on-failure
  screenshot: only-on-failure
  outputDir: test-results

groups:
  # Group 1 — chạy tuần tự (sequential)
  - name: "Authentication"
    flows:
      - flows/login-admin.yaml
      - flows/login-user.yaml

  # Group 2 — chạy 3 flow cùng lúc (parallel)
  - name: "Core Features"
    parallel: 3
    flows:
      - flows/search.yaml
      - flows/checkout.yaml
      - flows/profile.yaml

  # Group 3 — chỉ chạy nếu group trước PASS
  - name: "Cleanup"
    dependsOn: pass
    flows:
      - flows/logout.yaml
```

### Chạy suite

```bash
# Cơ bản
synora-test suite suites/regression.yaml

# Override một số option
synora-test suite suites/regression.yaml --headed --slow 200
synora-test suite suites/regression.yaml --base-url https://prod.synora --trace on
synora-test suite suites/regression.yaml --output-dir ci-results
```

### Output console

```
═══════════════════════════════════
  Suite: Full Regression Suite
  Groups: 3
═══════════════════════════════════

┌─ Group: Authentication  [2 flow(s), sequential]
  ▶  flows/login-admin.yaml
  ✅ PASSED: flows/login-admin.yaml
  ▶  flows/login-user.yaml
  ✅ PASSED: flows/login-user.yaml
└─ Authentication: 2/2 passed  (6.3s)

┌─ Group: Core Features  [3 flow(s), parallel=3]
  ▶  flows/search.yaml
  ▶  flows/checkout.yaml
  ▶  flows/profile.yaml
  ✅ PASSED: flows/search.yaml
  ❌ FAILED: flows/checkout.yaml
  ✅ PASSED: flows/profile.yaml
└─ Core Features: 2/3 passed  (8.1s)

⏭  Skipped (dependsOn: pass): Cleanup

═══════════════════════════════════
Suite Results: 4/5 passed, 1 failed
📊 HTML:    test-results/report.html
📄 JSON:    test-results/report.json
```

### Cấu trúc report.json của suite

```json
{
  "suite": "Full Regression Suite",
  "summary": { "total": 5, "passed": 4, "failed": 1, "duration": 14400, "timestamp": "..." },
  "groups": [
    {
      "name": "Authentication",
      "skipped": false,
      "summary": { "total": 2, "passed": 2, "failed": 0, "duration": 6300 },
      "results": [
        { "name": "flows/login-admin.yaml", "passed": true, "duration": 3100 },
        { "name": "flows/login-user.yaml",  "passed": true, "duration": 3200 }
      ]
    },
    {
      "name": "Cleanup",
      "skipped": true,
      "summary": { "total": 0, "passed": 0, "failed": 0, "duration": 0 },
      "results": []
    }
  ]
}
```

### Các thuộc tính của group

| Thuộc tính | Mặc định | Mô tả |
|------------|----------|-------|
| `name` | — | Tên hiển thị |
| `parallel` | `1` | Số flow chạy đồng thời trong group |
| `dependsOn: pass` | — | Bỏ qua group nếu group liền trước có flow fail |
| `flows` | — | Danh sách path đến file `.yaml` hoặc thư mục |

> `flows:` có thể trỏ đến thư mục — tất cả `.yaml` trong thư mục sẽ được thu thập và sắp xếp theo tên.

### Suite-level data — chia sẻ dữ liệu cho tất cả flow

```yaml
# suites/regression.yaml
name: Full Regression Suite

config:
  browser: chromium
  timeout: 45000
  baseUrl: ${BASE_URL:-https://staging.synora}

data:
  - ./data/accounts.json          # merge vào top-level vars
  - file: ./data/products.json
    as: products                  # → ${products[0].name}
  - ./data/config.json

groups:
  - name: "Login Tests"
    flows:
      - flows/login-admin.yaml
      - flows/login-user.yaml
```

**Quy tắc ưu tiên dữ liệu:**

| Nguồn | Ưu tiên |
|-------|---------|
| Suite-level `data:` | Thấp nhất — bị ghi đè bởi flow |
| `config.data:` trong từng flow | Ghi đè suite-level |
| `set:` trong flow | Cao nhất |

---

### Giữ session đăng nhập giữa các lần chạy — `config.userDataDir`

Dùng khi app cần đăng nhập qua SSO/MFA **thủ công** (không thể script hoá bằng `tapOn`/`inputText`) — ví dụ SSO Microsoft. Khai báo `userDataDir` trong `config:` của suite:

```yaml
config:
  headed: true             # bắt buộc ở lần chạy đầu để tự đăng nhập
  timeout: 600000          # đủ thời gian đăng nhập thủ công (kể cả MFA)
  userDataDir: ../.auth-profiles/my-app   # path tương đối theo thư mục chứa file suite
```

Khi có `userDataDir`, suite dùng `launchPersistentContext` (hồ sơ browser thật lưu trên đĩa: cookie, localStorage, IndexedDB...) thay vì tạo context mới mỗi lần chạy. Lần đầu chạy `headed`, người dùng tự đăng nhập trong lúc flow đang `waitForVisible` chờ phần tử sau-login; các lần chạy sau tái sử dụng session đã lưu, không cần đăng nhập lại.

Lưu ý:
- Toàn bộ suite (mọi group, mọi flow) dùng chung **một** context/page xuyên suốt — nếu một group khai `parallel > 1`, nó sẽ tự động bị ép chạy tuần tự (kèm cảnh báo) vì không thể mở nhiều context song song trên cùng một profile.
- Thư mục `userDataDir` chứa dữ liệu phiên đăng nhập thật (cookie/token) — **phải** được thêm vào `.gitignore`, không commit lên git.
- Không chạy 2 lần suite cùng `userDataDir` đồng thời — Chromium sẽ báo lỗi vì profile bị lock, giống việc mở 2 Chrome cùng một hồ sơ.

---

## 16. Ví dụ hoàn chỉnh

Kịch bản: **Đăng nhập CRM → Tạo khách hàng mới → Kiểm tra danh sách → Đăng xuất**

### Cấu trúc thư mục ví dụ

```
flows/
├── login.yaml
├── create-customer.yaml
├── check-customer-list.yaml
└── logout.yaml
data/
└── accounts.json
suites/
└── smoke.yaml
```

### `data/accounts.json`

```json
{
  "admin": {
    "username": "admin@synora.com",
    "password": "Admin@123"
  },
  "newCustomer": {
    "name": "Nguyễn Văn A",
    "phone": "0901234567",
    "email": "nguyenvana@example.com"
  }
}
```

### `flows/login.yaml`

```yaml
appId: browser
name: Đăng nhập CRM
config:
  baseUrl: ${BASE_URL:-https://staging.synora}
  data: ./data/accounts.json
---
- openLink: ${config.baseUrl}/login

- tapOn:
    label: "Email"
- inputText: ${admin.username}

- tapOn:
    label: "Mật khẩu"
- inputText: ${admin.password}

- tapOn:
    role: button
    name: "Đăng nhập"

- assertVisible: "Dashboard"
- assertUrl: /dashboard
```

### `flows/create-customer.yaml`

```yaml
appId: browser
name: Tạo khách hàng mới
config:
  baseUrl: ${BASE_URL:-https://staging.synora}
  data: ./data/accounts.json
---
# Đăng nhập trước qua API (nhanh hơn qua UI)
- api:
    method: POST
    url: ${config.baseUrl}/api/auth/login
    body:
      username: ${admin.username}
      password: ${admin.password}
    assert:
      status: 200
    capture:
      auth.token: body.token

# Inject token vào browser
- call: helpers/set-auth-cookie.js#setToken

# Điều hướng đến trang tạo khách hàng
- openLink: ${config.baseUrl}/customers/new

- tapOn:
    label: "Tên khách hàng"
- inputText: ${newCustomer.name}

- tapOn:
    label: "Số điện thoại"
- inputText: ${newCustomer.phone}

- tapOn:
    label: "Email"
- inputText: ${newCustomer.email}

- tapOn:
    role: button
    name: "Lưu"

- assertVisible: "Tạo khách hàng thành công"
- assertUrl: /customers
```

### `flows/check-customer-list.yaml`

```yaml
appId: browser
name: Kiểm tra danh sách khách hàng
config:
  baseUrl: ${BASE_URL:-https://staging.synora}
  data: ./data/accounts.json
---
- call: helpers/set-auth-cookie.js#setToken

- openLink: ${config.baseUrl}/customers

- assertVisible: "Nguyễn Văn A"
- assertVisible: "0901234567"

- tapOn: "Nguyễn Văn A"
- assertUrl: /customers/
- assertVisible: "nguyenvana@example.com"
```

### `flows/logout.yaml`

```yaml
appId: browser
name: Đăng xuất
config:
  baseUrl: ${BASE_URL:-https://staging.synora}
---
- tapOn:
    id: "user-menu"

- tapOn: "Đăng xuất"

- assertVisible: "Đăng nhập"
- assertUrl: /login
```

### `suites/smoke.yaml` — gộp tất cả lại

```yaml
name: CRM Smoke Test Suite

config:
  browser: chromium
  timeout: 45000
  baseUrl: ${BASE_URL:-https://staging.synora}
  trace: retain-on-failure
  screenshot: only-on-failure
  outputDir: test-results

groups:
  - name: "Authentication"
    flows:
      - flows/login.yaml

  - name: "Customer Management"
    dependsOn: pass
    flows:
      - flows/create-customer.yaml
      - flows/check-customer-list.yaml

  - name: "Teardown"
    dependsOn: pass
    flows:
      - flows/logout.yaml
```

### Chạy

```bash
# Chạy toàn bộ smoke suite
synora-test suite suites/smoke.yaml

# Chạy nhanh với giao diện (debug)
synora-test suite suites/smoke.yaml --headed --slow 300

# Chạy trên môi trường production (chỉ đọc)
BASE_URL=https://crm.synora.com synora-test suite suites/smoke.yaml
```

