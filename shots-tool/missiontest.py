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
        await page.wait_for_timeout(400)
        await page.evaluate("""() => {const w=window.__sol.main.world; const g=w.nextGiver; w.player.x=g.x; w.player.y=g.y;}""")
        await page.keyboard.press("e")
        await page.wait_for_timeout(400)
        st = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({active:!!m.missionState.active, step:m.missionState.stepIndex, obj:m.missionState.objective, sub:m.missionState.subtitle&&m.missionState.subtitle.who, marker:!!m.missionState.marker}))""")
        print("mission started:", st)
        # step through dialogue
        for i in range(6):
            await page.wait_for_timeout(3200)
            s = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({step:m.missionState.stepIndex, obj:m.missionState.objective, sub:m.missionState.subtitle&&m.missionState.subtitle.who, marker:m.missionState.marker&&[m.missionState.marker.x|0,m.missionState.marker.y|0]}))""")
            print(i, s)
        # teleport to marker to trigger goto completion
        await page.evaluate("""() => import('./js/systems/missions.js').then(m=>{const w=window.__sol.main.world; if(m.missionState.marker){w.player.x=m.missionState.marker.x; w.player.y=m.missionState.marker.y;}})""")
        await page.wait_for_timeout(500)
        s = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({step:m.missionState.stepIndex, obj:m.missionState.objective, sub:m.missionState.subtitle&&m.missionState.subtitle.who}))""")
        print("after goto:", s)
        await page.screenshot(path="/tmp/p-mission.png")
        print("errors:", errs[:3])
        await browser.close()

asyncio.run(main())
