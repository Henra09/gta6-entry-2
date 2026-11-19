import asyncio
from playwright.async_api import async_playwright

EXE="/home/agentuser/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"], executable_path=EXE)
        page = await browser.new_page(viewport={"width":1280,"height":720})
        errs=[]
        page.on("pageerror", lambda e: errs.append((getattr(e,"stack","") or str(e))[:300]))
        await page.goto("http://127.0.0.1:8317/index.html")
        await page.wait_for_timeout(800)
        await page.keyboard.press("Enter")  # PLAY
        await page.wait_for_timeout(600)
        # walk a bit
        await page.keyboard.down("s"); await page.keyboard.down("d")
        await page.wait_for_timeout(1200)
        await page.keyboard.up("s"); await page.keyboard.up("d")
        # try enter car (E) then drive
        await page.keyboard.press("e")
        await page.wait_for_timeout(400)
        await page.screenshot(path="/tmp/p-enter.png")
        await page.keyboard.down("w")
        await page.wait_for_timeout(2000)
        await page.keyboard.up("w")
        await page.screenshot(path="/tmp/p-drive.png")
        # exit, shoot
        await page.keyboard.press("e")
        await page.wait_for_timeout(500)
        await page.mouse.move(640, 200)
        await page.mouse.down(); await page.wait_for_timeout(300); await page.mouse.up()
        await page.screenshot(path="/tmp/p-shoot.png")
        print("errors:", errs[:4])
        await browser.close()

asyncio.run(main())
