import { chromium } from "playwright";

const TOKEN = "fba06478c8ba35f757ea617f797c03b31e7299ad1ed8c64c";
const BASE = "http://127.0.0.1:19002/#token=" + TOKEN + "&gatewayUrl=ws%3A%2F%2F127.0.0.1%3A19002";
const OUT = "d:/codeknowledge/clawdbot-main/clawdbot-main";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(5000);

// Close any popup/modal
const popupBtns = await page.$$("button");
for (const btn of popupBtns) {
  const text = await btn.textContent().catch(() => "");
  if (text && (text.includes("好的") || text.includes("继续") || text.includes("探索"))) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(500);
    break;
  }
}

await page.screenshot({ path: OUT + "/tmp_page_01_chat.png" });
console.log("01 chat done");

// Navigate by clicking sidebar links
const navLabels = [
  ["02", "概览"],
  ["03", "模型设置"],
  ["04", "用量统计"],
  ["05", "指挥渠道"],
  ["06", "实例"],
  ["07", "会话"],
  ["08", "定时任务"],
  ["09", "智能体"],
  ["10", "技能"],
  ["11", "扩展 MCP"],
  ["12", "节点"],
  ["13", "配置"],
  ["14", "调试"],
  ["15", "日志"],
];

for (const [num, label] of navLabels) {
  try {
    const links = await page.$$("a, button, [role=link], [role=button], span, div");
    let clicked = false;
    for (const el of links) {
      const text = (await el.textContent().catch(() => "")).trim();
      if (text === label) {
        const box = await el.boundingBox();
        if (box && box.x < 200) {
          await el.click();
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) {
      console.log(num + " " + label + " - nav item not found, skipping");
      continue;
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: OUT + "/tmp_page_" + num + "_" + label.replace(/\s+/g, "_") + ".png" });
    console.log(num + " " + label + " done");
  } catch (e) {
    console.log(num + " " + label + " error: " + e.message);
  }
}

await browser.close();
console.log("All done!");
