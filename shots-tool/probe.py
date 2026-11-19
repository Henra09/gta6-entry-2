import asyncio, sys, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"], executable_path="/home/agentuser/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell")
        page = await browser.new_page(viewport={"width":1280,"height":720})
        errors = []
        page.on("pageerror", lambda e: errors.append((str(e).splitlines() or ["?"])[0] + " | " + (getattr(e, "stack", "") or "").splitlines()[1] if getattr(e, "stack", "") else str(e)))
        page.on("console", lambda m: errors.append("console:"+m.text+m.location.get("url","")) if m.type=="error" else None)
        await page.goto("http://127.0.0.1:8317/index.html")
        await page.wait_for_timeout(1500)
        await page.screenshot(path="/tmp/t-title.png", timeout=8000)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1200)
        await page.screenshot(path="/tmp/t-play.png", timeout=8000)
        await page.keyboard.down("w"); await page.keyboard.down("d")
        await page.wait_for_timeout(1500)
        await page.keyboard.up("w"); await page.keyboard.up("d")
        await page.screenshot(path="/tmp/t-drive.png", timeout=8000)
        print("ERRORS:", json.dumps(errors, indent=1))
        await browser.close()

asyncio.run(main())
