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
        # teleport player next to the giver and interact
        r = await page.evaluate("""() => {
          const w = window.__sol.main.world;
          const g = w.nextGiver;
          if (!g) return {giver:null, objective:w.nextObjective};
          w.player.x = g.x; w.player.y = g.y;
          return {giver: g.name, pos:[g.x|0,g.y|0]};
        }""")
        print("giver:", r)
        await page.keyboard.press("e")
        await page.wait_for_timeout(600)
        ms = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({active: !!m.missionState.active, step: m.missionState.stepIndex, obj: m.missionState.objective, sub: m.missionState.subtitle&&m.missionState.subtitle.who}))""")
        print("mission after E:", ms)
        # wait out dialogue (lines advance every ~3s)
        for i in range(5):
            await page.wait_for_timeout(3000)
        ms2 = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({step: m.missionState.stepIndex, obj: m.missionState.objective, marker: m.missionState.marker}))""")
        print("after dialogue:", ms2)
        await page.screenshot(path="/tmp/p-mission.png")
        # complete goto step
        await page.evaluate("""() => {const w=window.__sol.main.world; const ms=window.__missions; }""")
        ms3 = await page.evaluate("""() => import('./js/systems/missions.js').then(async m => {
          const w = window.__sol.main.world;
          if (m.missionState.marker) { w.player.x = m.missionState.marker.x; w.player.y = m.missionState.marker.y; }
          return {step:m.missionState.stepIndex, obj:m.missionState.objective};
        })""")
        await page.wait_for_timeout(500)
        ms4 = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({step:m.missionState.stepIndex, obj:m.missionState.objective, active: !!m.missionState.active}))""")
        print("after goto:", ms4)
        print("errors:", errs[:4])
        await browser.close()

asyncio.run(main())
