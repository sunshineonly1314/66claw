from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1200, "height": 800})
    page.goto('file:///d:/codeknowledge/clawdbot-main/clawdbot-main/mockup-step4-qr.html')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)  # wait for QR image to load
    page.screenshot(path='d:/codeknowledge/clawdbot-main/clawdbot-main/screenshot-step4-qr.png', full_page=True)
    print("Screenshot saved to screenshot-step4-qr.png")
    browser.close()
