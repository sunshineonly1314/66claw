import { chromium } from "playwright";

const TOKEN = "fba06478c8ba35f757ea617f797c03b31e7299ad1ed8c64c";
const OUT = "d:/codeknowledge/clawdbot-main/clawdbot-main";

const tabs = ["chat", "overview", "model-config", "channels", "agents", "skills", "extensions", "config"];

async function doScreenshots(page, label, makeUrl) {
  for (const tab of tabs) {
    const url = makeUrl(tab);
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/tmp_cmp_${label}_${tab}.png`, fullPage: false });
    console.log(`${label}/${tab} done`);
  }
}

const browser = await chromium.launch({ headless: true });

// Gateway (same as what Tauri WebView shows)
const ctx1 = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const p1 = await ctx1.newPage();
await doScreenshots(p1, "gw", (tab) =>
  `http://127.0.0.1:19002/${tab}#token=${TOKEN}&gatewayUrl=ws://127.0.0.1:19002`
);

// Vite dev
const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const p2 = await ctx2.newPage();
await doScreenshots(p2, "vite", (tab) =>
  `http://localhost:5173/${tab}`
);

await browser.close();
console.log("All done!");
