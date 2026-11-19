import asyncio, json
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
        r = await page.evaluate("""() => {
          const w = window.__sol.main.world;
          return {cars: w.cars.length, peds: w.peds.length, player: [w.player.x|0, w.player.y|0], nearCar: w.cars.some(c=>Math.hypot(c.x-w.player.x,c.y-w.player.y)<80)};
        }""")
        print("state:", r)
        # walk to the nearest car and enter it
        for _ in range(30):
            ok = await page.evaluate("""() => {
              const w = window.__sol.main.world, p = w.player;
              let best=null,bd=1e9;
              for (const c of w.cars){ if(c.dead||c.police)continue; const d=Math.hypot(c.x-p.x,c.y-p.y); if(d<bd){bd=d;best=c;} }
              if(!best) return false;
              // teleport-walk: move player toward car at walking speed per frame is too slow; nudge
              p.x += Math.sign(best.x-p.x)*4; p.y += Math.sign(best.y-p.y)*4;
              return Math.hypot(best.x-p.x,best.y-p.y)<40;
            }""")
            if ok: break
        await page.keyboard.press("e")
        await page.wait_for_timeout(300)
        s = await page.evaluate("() => !!window.__sol.main.world.player.inCar")
        print("in car:", s)
        # drive forward 4s
        await page.keyboard.down("w")
        await page.wait_for_timeout(4000)
        await page.keyboard.up("w")
        s2 = await page.evaluate("() => {const w=window.__sol.main.world; const c=w.player.inCar; return {speed: c?c.speed|0:null, pos:[w.player.x|0,w.player.y|0], stolen:w.stats.stolen};}")
        print("after drive:", s2)
        await page.screenshot(path="/tmp/p-drive2.png")
        # exit and shoot a ped
        await page.keyboard.press("e")
        await page.wait_for_timeout(300)
        await page.evaluate("""() => {const w=window.__sol.main.world; w.player.x = 640; w.player.y=520; w.player.aimAngle=-Math.PI/2;}""")
        await page.mouse.move(640, 300)
        for _ in range(5):
            await page.mouse.down(); await page.wait_for_timeout(150); await page.mouse.up()
        s3 = await page.evaluate("() => {const w=window.__sol.main.world; return {wanted: (window.__policeProbe? window.__policeProbe(w): w.policeProbe), kills:w.stats.kills, ammo:w.ammo.pistol};}")
        print("after shoot:", s3)
        # wanted via police module import
        wanted = await page.evaluate("""() => import('./js/systems/police.js').then(m=>m.police.wanted)""")
        print("wanted stars:", wanted)
        await page.wait_for_timeout(4000)
        ncars = await page.evaluate("() => window.__sol.main.world.cars.filter(c=>c.police).length")
        print("police cars:", ncars)
        await page.screenshot(path="/tmp/p-wanted.png")
        # mission: walk to giver marker and press E
        ok = await page.evaluate("""() => {const w=window.__sol.main.world; const g=w.nextGiver; if(!g) return false; w.player.x=g.x; w.player.y=g.y+20; return true;}""")
        await page.keyboard.press("e")
        await page.wait_for_timeout(800)
        ms = await page.evaluate("""() => import('./js/systems/missions.js').then(m=>({active: !!m.missionState.active, obj: m.missionState.objective, sub: m.missionState.subtitle&&m.missionState.subtitle.who}))""")
        print("mission:", ms)
        await page.screenshot(path="/tmp/p-mission.png")
        print("errors:", errs[:5])
        await browser.close()

asyncio.run(main())
