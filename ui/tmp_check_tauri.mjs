import { chromium } from "playwright";

const TOKEN = "fba06478c8ba35f757ea617f797c03b31e7299ad1ed8c64c";
const URL = "http://127.0.0.1:19002/#token=" + TOKEN + "&gatewayUrl=ws%3A%2F%2F127.0.0.1%3A19002";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  return {
    hasTauri: Boolean(window.__TAURI__),
    hasTauriInternals: Boolean(window.__TAURI_INTERNALS__),
    hostname: window.location.hostname,
    hash: window.location.hash,
    href: window.location.href,
    localStorageToken: (() => {
      try {
        const raw = localStorage.getItem("openclawcn-ui-settings");
        if (raw) {
          const p = JSON.parse(raw);
          return p.token || "(empty)";
        }
        return "(no settings)";
      } catch { return "(error)"; }
    })(),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
