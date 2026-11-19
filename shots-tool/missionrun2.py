import asyncio
from playwright.async_api import async_playwright

EXE="/home/agentuser/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell"
M = "import('./js/systems/missions.js')"
W = "window.__sol.main.world"

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
        await page.evaluate(f"() => {{const w={W}; const g=w.nextGiver; w.player.x=g.x; w.player.y=g.y; w.cars=w.cars.filter(c=>Math.hypot(c.x-g.x,c.y-g.y)>100);}}")
        await page.keyboard.press("e"); await page.wait_for_timeout(300)
        chk = await page.evaluate(f"() => {M}.then(m=>({{active:!!m.missionState.active}}))")
        print("started:", chk)
        if not chk["active"]:
            await page.keyboard.press("e"); await page.wait_for_timeout(300)
        await page.evaluate(f"() => {M}.then(m=>{{const w={W}; const mk=m.missionState.marker; if(mk){{w.player.x=mk.x; w.player.y=mk.y;}}}})")
        await page.wait_for_timeout(19_000)
        # drive step: enter given car then teleport
        r = await page.evaluate(f"""() => {M}.then(m=>{{
          const w={W};
          const carsBefore=w.cars.length;
          if(!w.player.inCar){{
            const c=w.cars[w.cars.length-1];
            w.player.inCar=c; c.driver='player';
          }}
          const mk=m.missionState.marker;
          return {{hasMarker: !!mk, carsBefore, inCar: !!w.player.inCar, ppos:[w.player.x|0,w.player.y|0], mk: mk?[mk.x|0,mk.y|0]:null}};
        }})""")
        print("drive setup:", r)
        await page.evaluate(f"() => {M}.then(m=>{{const w={W}; const mk=m.missionState.marker; if(mk){{w.player.x=mk.x; w.player.y=mk.y; if(w.player.inCar){{w.player.inCar.x=mk.x; w.player.inCar.y=mk.y;}}}}}})")
        await page.wait_for_timeout(1500)
        st2 = await page.evaluate(f"() => {M}.then(m=>({{step:m.missionState.stepIndex, obj:m.missionState.objective, banner:m.missionState.banner}}))")
        print("final:", st2)
        print("money/completed:", await page.evaluate(f"() => [{W}.money, JSON.stringify({W}.completed)]"))
        print("errors:", errs[:3])
        await browser.close()

asyncio.run(main())
