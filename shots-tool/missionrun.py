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
        w = "window.__sol.main.world"
        M = "import('./js/systems/missions.js')"
        # full mission 0 playthrough
        await page.evaluate(f"() => {{const w={w}; const g=w.nextGiver; w.player.x=g.x; w.player.y=g.y; w.cars=w.cars.filter(c=>Math.hypot(c.x-g.x,c.y-g.y)>100);}}")
        await page.keyboard.press("e"); await page.wait_for_timeout(300)
        chk = await page.evaluate(f"() => {M}.then(m=>({{active:!!m.missionState.active, step:m.missionState.stepIndex}}))")
        print("started:", chk)
        # step 0 is 'goto'; teleport to marker
        await page.evaluate(f"() => {M}.then(m=>{{const w={w}; const s=m.missionState.active.steps[m.missionState.stepIndex]; const mk=(m.missionState.marker||s.marker); w.player.x=mk.x; w.player.y=mk.y;}})")
        await page.wait_for_timeout(400)
        s=None
        for i in range(5):
            s = await page.evaluate(f"() => {M}.then(m=>({{step:m.missionState.stepIndex, obj:m.missionState.objective}}))")
            await page.wait_for_timeout(3200)
        print("after dialog:", s)
        # dialog done -> goto-drive with giveCar; teleport to marker in car
        await page.evaluate(f"() => {M}.then(m=>{{const w={w}; const c=w.cars[w.cars.length-1]; if(c&&!w.player.inCar){{w.player.inCar=c;c.driver='player';}} if(m.missionState.marker){{w.player.x=m.missionState.marker.x; w.player.y=m.missionState.marker.y;}}}})")
        await page.wait_for_timeout(600)
        s2 = await page.evaluate(f"() => {M}.then(m=>({{step:m.missionState.stepIndex, obj:m.missionState.objective, banner:m.missionState.banner}}))")
        print("after deliver:", s2)
        money = await page.evaluate(f"() => {w}.money")
        completed = await page.evaluate(f"() => {w}.completed")
        print("money:", money, "completed:", completed)
        print("errors:", errs[:4])
        await browser.close()

asyncio.run(main())
