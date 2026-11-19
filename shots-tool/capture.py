import asyncio, os
from playwright.async_api import async_playwright
from PIL import Image

EXE="/home/agentuser/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell"
BASE="http://127.0.0.1:8317/index.html"
OUT="/home/agentuser/makefun/entry-gta6b/screenshots"

SHOTS = [
    ("1-cover.jpg",  "cover",  2.0, 88),
    ("2-on-foot.jpg","onfoot", 2.0, 90),
    ("3-mission.jpg","mission",2.0, 88),
    ("4-menu.jpg",   "menu",   2.0, 85),
]

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"], executable_path=EXE)
        for name, shot, wait, q in SHOTS:
            page = await browser.new_page(viewport={"width":1280,"height":720})
            errs=[]
            page.on("pageerror", lambda e: errs.append((getattr(e,"stack","") or str(e))[:200]))
            await page.goto(f"{BASE}?shot={shot}")
            await page.wait_for_timeout(600)
            if shot != "menu":
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(400)
            await page.wait_for_timeout(wait*1000)
            tmp = f"/tmp/shot-{shot}.png"
            await page.screenshot(path=tmp)
            img = Image.open(tmp).convert("RGB")
            img.save(f"{OUT}/{name}", quality=q, optimize=True)
            print(name, os.path.getsize(f"{OUT}/{name}"), "errors:", errs[:2])
            await page.close()
        await browser.close()

asyncio.run(main())
