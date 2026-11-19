import asyncio
from playwright.async_api import async_playwright

EXE="/home/agentuser/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell"

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox"], executable_path=EXE)
        page = await browser.new_page(viewport={"width":1280,"height":720})
        errs=[]
        page.on("pageerror", lambda e: errs.append((getattr(e,"stack","") or str(e))[:200]))
        await page.goto("http://127.0.0.1:8317/index.html")
        await page.wait_for_timeout(500)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(400)
        # ensure no car is near the giver, then walk in and press E
        await page.evaluate("""() => {
          const w = window.__sol.main.world;
          const g = w.nextGiver;
          w.player.x = g.x; w.player.y = g.y;
          w.cars = w.cars.filter(c => Math.hypot(c.x-g.x,c.y-g.y) > 100);
        }""")
        await page.wait_for_timeout(100)
        pre = await page.evaluate("() => {const w=window.__sol.main.world; return {hint:w.hint, dist:(()=>{const g=w.nextGiver; return Math.hypot(g.x-w.player.x,g.y-w.player.y)|0;})()};}")
        print("pre:", pre)
        await page.keyboard.press("e")
        await page.wait_for_timeout(200)
        post = await page.evaluate("() => import('./js/systems/missions.js').then(m=>({active:!!m.missionState.active, completed: window.__sol.main.world.completed.length}))")
        print("post:", post)
        print("errors:", errs[:3])
        await browser.close()

asyncio.run(main())
