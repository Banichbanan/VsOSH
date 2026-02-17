import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function asList(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIso(date = new Date()) {
  return date.toISOString();
}

function formatDateRu(isoString) {
  if (!isoString) {
    return "—";
  }

  try {
    return new Date(isoString).toLocaleString("ru-RU", { hour12: false });
  } catch {
    return String(isoString);
  }
}

function normalizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function shortStatusText(state, note = "") {
  const ready = state?.status === "ready";
  const value = ready ? "ЕСТЬ" : "НЕТ";
  const autoLabel = "CLOUD";
  const statusLabel = String(state?.statusLabel || "Неизвестно");
  const checkedAt = formatDateRu(state?.lastCheckedAt);

  const lines = [
    `Источник: ${autoLabel}`,
    `Результаты: ${value}`,
    `Статус: ${statusLabel}`,
    `Проверено: ${checkedAt}`,
  ];

  if (note) {
    lines.push(`Примечание: ${note}`);
  }

  return `${lines.join("\n")}\n`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusTheme(status) {
  if (status === "ready") {
    return {
      bg: "linear-gradient(135deg,#0c6e4f,#0d8f6f)",
      border: "rgba(123,245,189,0.7)",
      title: "Результаты опубликованы",
    };
  }

  if (status === "error") {
    return {
      bg: "linear-gradient(135deg,#6d1f37,#86334b)",
      border: "rgba(255,145,173,0.8)",
      title: "Ошибка проверки",
    };
  }

  if (status === "auth_required") {
    return {
      bg: "linear-gradient(135deg,#2d4b8a,#24406d)",
      border: "rgba(141,188,255,0.85)",
      title: "Требуется авторизация",
    };
  }

  return {
    bg: "linear-gradient(135deg,#7b293d,#8f3552)",
    border: "rgba(255,146,170,0.8)",
    title: "Ожидание результатов",
  };
}

function buildWatchHtml(state, token, { note = "", title = "Cloud статус ВсОШ" } = {}) {
  const theme = statusTheme(state?.status);
  const resultLabel = state?.status === "ready" ? "ЕСТЬ" : "НЕТ";
  const checkedAt = formatDateRu(state?.lastCheckedAt);
  const statusLabel = String(state?.statusLabel || "Неизвестно");
  const message = String(state?.message || "");
  const encodedToken = encodeURIComponent(token || "");

  const statusLink = `/watch/view?token=${encodedToken}`;
  const checkLink = `/watch/view?token=${encodedToken}&check=1`;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="Cache-Control" content="no-store" />
  <title>Vsosh Cloud Watch</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;
      color: #eef3ff;
      background: radial-gradient(circle at top,#1d2c5c 0%,#0f1733 52%,#0a0f24 100%);
      padding: 16px;
    }
    .card {
      border-radius: 18px;
      padding: 14px;
      background: ${theme.bg};
      border: 1px solid ${theme.border};
      box-shadow: 0 10px 28px rgba(0,0,0,0.35);
    }
    h1 { margin: 0 0 6px; font-size: 18px; line-height: 1.2; }
    .big { margin: 4px 0; font-size: 28px; font-weight: 800; line-height: 1.1; }
    .sub { margin: 4px 0 0; font-size: 14px; opacity: .95; }
    .meta {
      margin-top: 12px;
      padding: 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(191,205,255,0.34);
      font-size: 14px;
      line-height: 1.45;
    }
    .note {
      margin-top: 10px;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 13px;
      background: rgba(255,192,111,0.2);
      border: 1px solid rgba(255,204,128,0.45);
      color: #ffe8bf;
    }
    .actions {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    a {
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 38px;
      padding: 8px 10px;
      border-radius: 12px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      background: rgba(147,172,255,0.34);
      border: 1px solid rgba(184,198,255,0.48);
    }
    a.primary {
      background: linear-gradient(135deg,#ff8c3b,#ff5e47);
      border-color: rgba(255,183,128,0.62);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <div class="big">${escapeHtml(resultLabel)}</div>
    <div class="sub">${escapeHtml(theme.title)}</div>
    <div class="meta">
      Статус: <b>${escapeHtml(statusLabel)}</b><br/>
      Проверено: <b>${escapeHtml(checkedAt)}</b><br/>
      Комментарий: <b>${escapeHtml(message || "—")}</b>
      ${note ? `<div class="note">${escapeHtml(note)}</div>` : ""}
    </div>
    <div class="actions">
      <a class="primary" href="${checkLink}">Обновить</a>
      <a href="${statusLink}">Только статус</a>
    </div>
  </div>
</body>
</html>`;
}

const config = {
  appName: process.env.APP_NAME || "Vsosh Cloud Agent",
  targetUrl:
    process.env.TARGET_URL ||
    "https://my.sirius.online/activity-page/cpm:vsosh-region-law-2026",
  pendingTexts: [
    process.env.PENDING_TEXT || "Ожидание результатов",
    ...asList(process.env.PENDING_TEXT_VARIANTS, []),
  ].filter(Boolean),
  autoChecksEnabled: asBoolean(process.env.CLOUD_AUTO_CHECKS_ENABLED, false),
  checkIntervalMs: Math.max(5000, asNumber(process.env.CLOUD_CHECK_INTERVAL_MS, 30000)),
  checkTimeoutMs: Math.max(5000, asNumber(process.env.CLOUD_CHECK_TIMEOUT_MS, 25000)),
  navigationSettleMs: Math.max(500, asNumber(process.env.CLOUD_NAVIGATION_SETTLE_MS, 1800)),
  readyConfirmChecks: Math.max(1, asNumber(process.env.READY_CONFIRM_CHECKS, 2)),
  headless: asBoolean(process.env.CLOUD_HEADLESS, true),
  watchToken: String(process.env.CLOUD_WATCH_TOKEN || "").trim(),
  port: Math.max(1, asNumber(process.env.PORT || process.env.CLOUD_PORT, 8080)),
  userDataDir: path.resolve(__dirname, ".data", "playwright"),
};

const STATUS = {
  INITIALIZING: "initializing",
  PENDING: "pending",
  READY: "ready",
  AUTH_REQUIRED: "auth_required",
  VERIFYING: "verifying",
  ERROR: "error",
};

const STATUS_LABELS = {
  [STATUS.INITIALIZING]: "Инициализация",
  [STATUS.PENDING]: "Ожидание результатов",
  [STATUS.READY]: "Результаты опубликованы",
  [STATUS.AUTH_REQUIRED]: "Нужна авторизация",
  [STATUS.VERIFYING]: "Проверка/загрузка",
  [STATUS.ERROR]: "Ошибка проверки",
};

const authTextPatterns = [/авторизац/i, /войти/i, /sign in/i, /log in/i, /login/i];
const challengePatterns = [
  /ваш браузер не смог пройти проверку/i,
  /enable javascript/i,
  /js.?challenge/i,
  /проверку браузера/i,
];

class CloudVsoshMonitor {
  constructor(cfg) {
    this.config = cfg;
    this.context = null;
    this.page = null;
    this.intervalId = null;
    this.checkPromise = null;
    this.readyStreak = 0;

    this.state = {
      status: STATUS.INITIALIZING,
      statusLabel: STATUS_LABELS[STATUS.INITIALIZING],
      message: "Запуск cloud-монитора",
      checkCount: 0,
      inFlight: false,
      lastCheckedAt: null,
      nextCheckAt: null,
      lastChangeAt: toIso(),
      lastError: null,
    };
  }

  getState() {
    return structuredClone(this.state);
  }

  updateState(partial) {
    const previous = this.state.status;
    this.state = { ...this.state, ...partial };
    if (partial.status && partial.status !== previous) {
      this.state.lastChangeAt = toIso();
    }
  }

  nextCheckIso(from = Date.now()) {
    return toIso(new Date(from + this.config.checkIntervalMs));
  }

  evaluatePage({ text, url }) {
    const normalized = normalizeText(text);
    const lowerText = normalized.toLowerCase();
    const lowerUrl = String(url || "").toLowerCase();

    if (challengePatterns.some((pattern) => pattern.test(normalized))) {
      return {
        status: STATUS.VERIFYING,
        message: "Сработала anti-bot проверка браузера",
      };
    }

    if (
      lowerUrl.includes("/login") ||
      lowerUrl.includes("/auth") ||
      authTextPatterns.some((pattern) => pattern.test(normalized))
    ) {
      return {
        status: STATUS.AUTH_REQUIRED,
        message: "На cloud-сервере нужна авторизация в Sirius",
      };
    }

    const hasPending = this.config.pendingTexts.some((value) => {
      const pattern = String(value || "").trim().toLowerCase();
      return pattern && lowerText.includes(pattern);
    });

    if (hasPending) {
      this.readyStreak = 0;
      return {
        status: STATUS.PENDING,
        message: "Результатов пока нет",
      };
    }

    this.readyStreak += 1;
    if (this.readyStreak < this.config.readyConfirmChecks) {
      return {
        status: STATUS.VERIFYING,
        message: `Подтверждение публикации (${this.readyStreak}/${this.config.readyConfirmChecks})`,
      };
    }

    return {
      status: STATUS.READY,
      message: "Факт публикации результатов подтвержден",
    };
  }

  async ensureBrowser() {
    if (this.context && this.page) {
      return;
    }

    await fs.mkdir(this.config.userDataDir, { recursive: true });
    this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
      headless: this.config.headless,
      viewport: { width: 1360, height: 900 },
    });

    this.page =
      this.context.pages()[0] ||
      (await this.context.newPage({
        viewport: { width: 1360, height: 900 },
      }));
  }

  async runCheck(trigger = "interval") {
    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.checkPromise = this.performCheck(trigger).finally(() => {
      this.checkPromise = null;
    });

    return this.checkPromise;
  }

  async performCheck(trigger = "interval") {
    const startedAt = Date.now();
    this.updateState({
      inFlight: true,
      message:
        trigger === "manual" ? "Ручная проверка cloud..." : "Автоматическая cloud-проверка...",
    });

    try {
      await this.ensureBrowser();

      await this.page.goto(this.config.targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.config.checkTimeoutMs,
      });

      await this.page.waitForTimeout(this.config.navigationSettleMs);
      const [url, text] = await Promise.all([this.page.url(), this.page.locator("body").innerText()]);

      const evaluated = this.evaluatePage({ text, url });
      this.updateState({
        status: evaluated.status,
        statusLabel: STATUS_LABELS[evaluated.status],
        message: evaluated.message,
        inFlight: false,
        checkCount: this.state.checkCount + 1,
        lastCheckedAt: toIso(new Date(startedAt)),
        nextCheckAt: this.nextCheckIso(startedAt),
        lastError: evaluated.status === STATUS.ERROR ? evaluated.message : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.readyStreak = 0;
      this.updateState({
        status: STATUS.ERROR,
        statusLabel: STATUS_LABELS[STATUS.ERROR],
        message: "Ошибка cloud-проверки",
        inFlight: false,
        checkCount: this.state.checkCount + 1,
        lastCheckedAt: toIso(new Date(startedAt)),
        nextCheckAt: this.nextCheckIso(startedAt),
        lastError: message,
      });
    }
  }

  async start() {
    if (!this.config.autoChecksEnabled) {
      this.updateState({
        status: STATUS.INITIALIZING,
        statusLabel: "Ручной режим",
        message: "Проверка запускается только по кнопке (watch/check)",
        inFlight: false,
        nextCheckAt: null,
      });
      return;
    }

    await this.runCheck("startup");
    this.intervalId = setInterval(() => {
      void this.runCheck("interval");
    }, this.config.checkIntervalMs);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}

const monitor = new CloudVsoshMonitor(config);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function tokenMatches(urlObj) {
  const incoming = String(urlObj.searchParams.get("token") || "").trim();
  return incoming && incoming === config.watchToken;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/health") {
      sendText(res, 200, "ok\n");
      return;
    }

    if (pathname === "/status") {
      sendJson(res, 200, {
        ok: true,
        service: config.appName,
        state: monitor.getState(),
      });
      return;
    }

    if (pathname === "/check") {
      await monitor.runCheck("manual");
      sendJson(res, 200, {
        ok: true,
        state: monitor.getState(),
      });
      return;
    }

    if (pathname.startsWith("/watch/")) {
      if (!config.watchToken) {
        sendText(res, 500, "watch token is not configured\n");
        return;
      }

      if (!tokenMatches(url)) {
        sendText(res, 401, "unauthorized\n");
        return;
      }

      if (pathname === "/watch/status") {
        const state = monitor.getState();
        const asJson = url.searchParams.get("format") === "json";
        if (asJson) {
          sendJson(res, 200, {
            ok: true,
            resultsReady: state.status === "ready",
            state,
          });
          return;
        }

        sendText(res, 200, shortStatusText(state));
        return;
      }

      if (pathname === "/watch/check") {
        await monitor.runCheck("manual");
        const state = monitor.getState();
        const asJson = url.searchParams.get("format") === "json";
        if (asJson) {
          sendJson(res, 200, {
            ok: true,
            resultsReady: state.status === "ready",
            state,
          });
          return;
        }

        sendText(res, 200, shortStatusText(state));
        return;
      }

      if (pathname === "/watch/view") {
        if (url.searchParams.get("check") === "1") {
          await monitor.runCheck("manual");
        }

        const state = monitor.getState();
        sendHtml(res, 200, buildWatchHtml(state, config.watchToken));
        return;
      }
    }

    sendText(
      res,
      404,
      "Not found. Use /health, /status, /check, /watch/status, /watch/check, /watch/view\n",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendText(res, 500, `error: ${message}\n`);
  }
});

async function bootstrap() {
  await monitor.start();
  server.listen(config.port, () => {
    console.log(`[cloud-agent] started on :${config.port}`);
    console.log(`[cloud-agent] target: ${config.targetUrl}`);
    console.log(`[cloud-agent] interval: ${Math.round(config.checkIntervalMs / 1000)} sec`);
  });
}

async function shutdown(signal) {
  console.log(`[cloud-agent] ${signal} received, stopping...`);
  try {
    await monitor.stop();
  } catch (_error) {
    // ignore
  }
  await new Promise((resolve) => server.close(() => resolve()));
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

bootstrap().catch((error) => {
  console.error("[cloud-agent] failed to start:", error);
  process.exit(1);
});
