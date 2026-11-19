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
        await page.wait_for_timeout(600)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(500)
        await page.evaluate("""() => {const w=window.__sol.main.world; const g=w.nextGiver; w.player.x=g.x; w.player.y=g.y;}""")
        await page.wait_for_timeout(200)
        # instrument: wrap startMission
        await page.evaluate("""() => {
          import('./js/systems/missions.js').then(m => {
            const orig = m.startMission;
            window.__started = 0;
            // patch missionState access via check after E
          });
        }""")
        await page.keyboard.press("e")
        await page.wait_for_timeout(100)
        probe = await page.evaluate("""() => {
          const w = window.__sol.main.world;
          return {interactFlag: w.input ? w.input.interact : 'n/a', active: !!w.missionState ? w.missionState.active : 'no-ms'};
        }""")
        print("immediately post-E:", probe)
        ms = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({active: !!m.missionState.active, banner: m.missionState.banner}))""")
        print("mission module:", ms)
        print("errors:", errs[:3])
        await browser.close()

asyncio.run(main())
