' render.brs - drawing for the 1280x720 roScreen. World units are scaled by m.SC (1.2).
' Sprites are PNGs from tools/gen_assets.py, described by images/sprites.json.

function mkColor(rgb, a) as integer
    return (rgb << 8) or a
end function

sub initGfx()
    m.screen = CreateObject("roScreen", true, 1280, 720)
    m.screen.SetMessagePort(m.port)
    m.screen.SetAlphaEnable(true)

    ' sprites
    m.spr = {}
    defs = ParseJson(ReadAsciiFile("pkg:/images/sprites.json"))
    for each name in defs
        d = defs[name]
        bm = CreateObject("roBitmap", "pkg:/images/" + name + ".png")
        rec = { bm: bm, w: d.w, h: d.h, ax: d.ax, ay: d.ay, top: 0 }
        if d.top <> invalid then rec.top = d.top
        m.spr[name] = rec
    end for
    m.bgSky = CreateObject("roBitmap", "pkg:/images/bg_sky.jpg")

    ' tile bitmaps by tile code
    m.tbm = []
    for i = 0 to 255
        m.tbm.push(invalid)
    end for
    tmap = { "66": "brick", "63": "qblock", "85": "used", "88": "steel", "83": "pblock_spike", "77": "pblock_magnet", "86": "pblock_speed", "117": "spring", "60": "conv_l", "62": "conv_r", "102": "fastpad", "68": "door", "94": "spikes", "47": "slope_r", "92": "slope_l" }
    for each key in tmap
        m.tbm[Val(key, 10)] = m.spr[tmap[key]].bm
    end for
    m.bmWallTop = m.spr["wall_top"].bm
    m.bmWallIn = m.spr["wall_in"].bm

    ' palette: name -> 8 alpha steps
    rgbs = { magenta: &hFF2FA6, gold: &hFFC23A, green: &h7DFF9A, cyan: &h27F0FF, red: &hFF4A3D, white: &hE8F6FF, steel: &h9FB0E0, orange: &hFF6A4A, yellow: &hFFE66B, violet: &h9B8BFF, lime: &hD6FF3A }
    m.pal = {}
    for each key in rgbs
        arr = []
        for i = 0 to 7
            arr.push(mkColor(rgbs[key], Int((i + 1) / 8 * 255)))
        end for
        m.pal[key] = arr
    end for

    ' fonts
    fr = CreateObject("roFontRegistry")
    m.fSm = fr.GetDefaultFont(22, false, false)
    m.fMd = fr.GetDefaultFont(30, true, false)
    m.fLg = fr.GetDefaultFont(84, true, false)

    m.cWhite = mkColor(&HE8F6FF, 255)
    m.cDim = mkColor(&H000000, 170)
    m.cGold = mkColor(&HFFC23A, 255)
    m.cCyan = mkColor(&H7FE0FF, 255)
    m.cRed = mkColor(&HFF4A3D, 255)
    m.cGreen = mkColor(&H7DFF9A, 255)
    m.camPx = 0
end sub

function palCol(name, frac)
    i = Int(frac * 7.99)
    if i < 0 then i = 0
    if i > 7 then i = 7
    return m.pal[name][i]
end function

' ---------- text helpers ----------
sub textC(txt, cx, y, col, font)
    w = font.GetOneLineWidth(txt, 1280)
    m.screen.DrawText(txt, Int(cx - w / 2), y, col, font)
end sub

sub textR(txt, rx, y, col, font)
    w = font.GetOneLineWidth(txt, 1280)
    m.screen.DrawText(txt, Int(rx - w), y, col, font)
end sub

' ---------- sprite helpers ----------
sub blit(name, wx, wy)
    s = m.spr[name]
    m.screen.DrawObject(Int(wx * 1.2) - m.camPx - s.ax, Int(wy * 1.2) - s.ay, s.bm)
end sub

sub blitFrame(base, wx, wy, angRad)
    ' pre-rotated sprite frames: base_0 .. base_35, each 10 degrees further clockwise
    n = Int(angRad * 57.29578 / 10 + .5)
    idx = n - 36 * Int(n / 36)
    blit(base + "_" + istr(idx), wx, wy)
end sub

sub fillRectW(x0, y0, x1, y1, col)
    ' world-space rectangle
    sx = Int(x0 * 1.2) - m.camPx
    sy = Int(y0 * 1.2)
    m.screen.DrawRect(sx, sy, Int(x1 * 1.2) - Int(x0 * 1.2), Int(y1 * 1.2) - sy, col)
end sub

' ---------- scene ----------
sub render()
    gs = m.G
    scr = m.screen
    shx = 0
    if gs.shake > 0 then shx = Int((Rnd(0) - .5) * gs.shake * 22)
    m.camPx = Int(m.camX * 1.2) + shx

    drawBG()
    drawTiles()
    drawCheckpoints()
    drawGoal()
    drawPlats()
    drawCoins()
    drawItems()
    drawChains()
    for each e in m.ENT
        if e.x > m.camX - 120 and e.x < m.camX + m.VW + 120 then drawEnemy(e)
    end for
    drawBall()
    drawFX()
    drawHUD()
    drawOverlay()
end sub

sub drawBG()
    scr = m.screen
    scr.DrawObject(0, 0, m.bgSky)
    ra = m.spr["ridge_a"]
    rb = m.spr["ridge_b"]
    sa = Int(m.camPx * .12) mod 1280
    scr.DrawObject(-sa, ra.top, ra.bm)
    scr.DrawObject(1280 - sa, ra.top, ra.bm)
    sb = Int(m.camPx * .28) mod 1280
    scr.DrawObject(-sb, rb.top, rb.bm)
    scr.DrawObject(1280 - sb, rb.top, rb.bm)
end sub

sub drawTiles()
    lv = m.LV
    scr = m.screen
    ts = 48
    c0 = Int(m.camPx / ts) - 1
    if c0 < 0 then c0 = 0
    c1 = c0 + 29
    if c1 > lv.W - 1 then c1 = lv.W - 1
    hasBump = m.BUMPS.Count() > 0
    for r = 0 to m.ROWS - 1
        row = lv.g[r]
        for c = c0 to c1
            tt = row[c]
            if tt <> 0 then
                x = c * ts - m.camPx
                y = r * ts
                if hasBump then
                    for each b in m.BUMPS
                        if b.c = c and b.r = r then y = y - Int(Sin(b.t / .25 * 3.14159) * 9 * 1.2)
                    end for
                end if
                if tt = 35 then
                    bm = m.bmWallIn
                    if r = 0 then
                        bm = m.bmWallTop
                    else
                        above = lv.g[r - 1][c]
                        if not m.solid[above] and above <> 47 and above <> 92 then bm = m.bmWallTop
                    end if
                    scr.DrawObject(x, y, bm)
                else
                    bm = m.tbm[tt]
                    if bm <> invalid then scr.DrawObject(x, y, bm)
                end if
            end if
        end for
    end for
end sub

sub drawCheckpoints()
    for each cp in m.CHECKS
        if cp.x > m.camX - 60 and cp.x < m.camX + m.VW + 60 then
            if cp.on then
                blit("flag_on", cp.x, cp.y + 20)
            else
                blit("flag_off", cp.x, cp.y + 20)
            end if
        end if
    end for
end sub

sub drawGoal()
    lv = m.LV
    gs = m.G
    scr = m.screen
    gx = lv.goal * m.T
    if gx > m.camX + m.VW + 80 or gx < m.camX - 120 then return
    gb = 12 * m.T
    for r = 0 to m.ROWS - 1
        q = lv.g[r][lv.goal]
        if q <> 0 and q <> 47 and q <> 92 then
            gb = r * m.T
            exit for
        end if
    end for
    gt = gb - 6 * m.T
    isOpen = true
    label = "GOAL"
    if lv.boss then
        isOpen = false
        if m.BOSS <> invalid then isOpen = m.BOSS.dead
        if not isOpen then label = "DEFEAT THE BOSS"
    end if
    col = mkColor(&HFF4A3D, 255)
    colFill = mkColor(&HFF4A3D, 40)
    if isOpen then
        col = mkColor(&H7DFF9A, 255)
        a = 50 + Int(Sin(gs.t * 5) * 20)
        colFill = mkColor(&H7DFF9A, a)
    end if
    fillRectW(gx, gt, gx + 60, gb, colFill)
    fillRectW(gx - 1, gt, gx + 2, gb, col)
    fillRectW(gx + 58, gt, gx + 61, gb, col)
    fillRectW(gx - 1, gt - 1, gx + 61, gt + 2, col)
    w = m.fSm.GetOneLineWidth(label, 600)
    scr.DrawText(label, Int((gx + 30) * 1.2) - m.camPx - Int(w / 2), Int(gt * 1.2) - 34, col, m.fSm)
end sub

sub drawPlats()
    for each p in m.PLAT
        if p.x < m.camX + m.VW + 40 and p.x + p.w > m.camX - 40 then
            fillRectW(p.x, p.y, p.x + p.w, p.y + p.h, mkColor(&H16294D, 255))
            fillRectW(p.x, p.y, p.x + p.w, p.y + 2, mkColor(&HFFC23A, 255))
            fillRectW(p.x, p.y + p.h - 2, p.x + p.w, p.y + p.h, mkColor(&HFFC23A, 255))
            i = 0
            while i < p.w - 16
                fillRectW(p.x + 8 + i, p.y + 5, p.x + 18 + i, p.y + 9, mkColor(&HFFC23A, 255))
                i = i + 20
            end while
            fillRectW(p.x + p.w / 2 - 14, p.y + p.h, p.x + p.w / 2 + 14, p.y + p.h + 4, mkColor(&H27F0FF, 110))
        end if
    end for
end sub

sub drawCoins()
    gs = m.G
    for each co in m.COINS
        if not co.got and co.x > m.camX - 30 and co.x < m.camX + m.VW + 30 then
            f = Int(absf(Cos(gs.t * 4 + co.x * .05)) * 3.99)
            blit("coin" + istr(f), co.x, co.y + Sin(gs.t * 3 + co.x) * 2)
        end if
    end for
end sub

sub drawItems()
    gs = m.G
    for each it in m.ITEMS
        if it.x > m.camX - 40 and it.x < m.camX + m.VW + 40 then
            if it.kind = "gem" then
                sq = .55 + .45 * absf(Cos((gs.t + it.t) * 2))
                f = Int((sq - .55) / .45 * 3.99)
                blit("gem" + istr(f), it.x, it.y + Sin(gs.t * 3 + it.t) * 4)
            else
                blit("item_" + it.kind, it.x, it.y + Sin(gs.t * 4 + it.t) * 3)
            end if
        end if
    end for
end sub

sub drawChains()
    scr = m.screen
    tip = [0.0, 0.0]
    cw = mkColor(&HE8F6FF, 220)
    for each ch in m.CHAINS
        if ch.ax > m.camX - 300 and ch.ax < m.camX + m.VW + 300 then
            chainTip(ch, tip)
            blit("anchor", ch.ax, ch.ay)
            n = Int(ch.L / 13)
            if n < 4 then n = 4
            px = Int(ch.ax * 1.2) - m.camPx
            py = Int(ch.ay * 1.2)
            for i = 1 to n
                k = i / n
                x = Int((ch.ax + (tip[0] - ch.ax) * k) * 1.2) - m.camPx
                y = Int((ch.ay + (tip[1] - ch.ay) * k) * 1.2)
                if (i mod 2) = 1 then
                    scr.DrawLine(px, py, x, y, cw)
                    scr.DrawLine(px + 1, py, x + 1, y, cw)
                end if
                scr.DrawRect(x - 2, y - 2, 5, 5, cw)
                px = x
                py = y
            end for
            if not ch.latched then blit("chain_tip", tip[0], tip[1])
        end if
    end for
end sub

sub drawEnemy(e)
    gs = m.G
    t = e.t
    dc = "r"
    if e.dir < 0 then dc = "l"
    f = Int(gs.t * 10 + e.ph) mod 2
    if e.boss and e.inv > 0 and (Int(gs.t * 14) mod 2) = 1 then return
    if t = "blob" then
        blit("blob_" + dc + istr(f), e.x, e.y)
    else if t = "boss" then
        blit("boss_" + dc + istr(f), e.x, e.y)
    else if t = "wasp" then
        blit("wasp_" + dc + istr(f), e.x, e.y)
    else if t = "dragon" then
        blit("dragon_" + dc + istr(f), e.x, e.y)
    else if t = "spiky" then
        blitFrame("spiky", e.x, e.y, e.x * .05 * e.dir)
    else if t = "spider" then
        sx = Int(e.x * 1.2) - m.camPx
        m.screen.DrawRect(sx, Int((e.y0 - 24) * 1.2), 1, Int((e.y - e.y0 + 16) * 1.2), mkColor(&HE8F6FF, 110))
        blit("spider" + istr(f), e.x, e.y)
    end if
end sub

sub drawBall()
    pl = m.P
    gs = m.G
    if pl.inv > 0 and not pl.dead and (Int(gs.t * 16) mod 2) = 1 then return
    if pl.pw.spike > 0 then
        blitFrame("ball_spiked", pl.x, pl.y, pl.ang)
    else
        blitFrame("ball", pl.x, pl.y, pl.ang)
    end if
    blit("ball_hi", pl.x - pl.r * .4, pl.y - pl.r * .45)
    if pl.pw.speed > 0 then
        s = pl.face
        if pl.vx > 0 then s = 1
        if pl.vx < 0 then s = -1
        for i = -1 to 1
            fillRectW(pl.x - s * (pl.r + 3) - s * (6 + Rnd(0) * 10), pl.y + i * 7, pl.x - s * (pl.r + 3), pl.y + i * 7 + 2, mkColor(&HD6FF3A, 170))
        end for
    end if
end sub

sub drawFX()
    scr = m.screen
    for each pt in m.PART
        f = pt.life / pt.max
        col = palCol(pt.col, f)
        sz = Int(pt.sz * 1.2)
        if sz < 2 then sz = 2
        scr.DrawRect(Int(pt.x * 1.2) - m.camPx, Int(pt.y * 1.2), sz, sz, col)
    end for
    for each pp in m.POP
        a = 1.3 - pp.t
        if a > 1 then a = 1
        if a > 0 then
            col = palCol(pp.col, a)
            w = m.fSm.GetOneLineWidth(pp.txt, 600)
            scr.DrawText(pp.txt, Int(pp.x * 1.2) - m.camPx - Int(w / 2), Int((pp.y - pp.t * 36) * 1.2), col, m.fSm)
        end if
    end for
end sub

' ---------- HUD ----------
sub drawHUD()
    gs = m.G
    pl = m.P
    lv = m.LV
    scr = m.screen
    padx = 28
    for i = 0 to minf(gs.lives, 6) - 1
        scr.DrawObject(padx - 4 + i * 26, 12, m.spr["hud_life"].bm)
    end for
    for i = 0 to 2
        nm = "hud_hp_off"
        if i < gs.hp then nm = "hud_hp_on"
        scr.DrawObject(padx - 4 + i * 28, 44, m.spr[nm].bm)
    end for
    py = 80
    pws = [{ k: "spike", mx: 15, lab: "SPIKES", c: &HFF6A4A }, { k: "magnet", mx: 15, lab: "MAGNET", c: &H27F0FF }, { k: "speed", mx: 12, lab: "SPEED", c: &HD6FF3A }]
    for each pwd in pws
        v = pl.pw[pwd.k]
        if v > 0 then
            col = mkColor(pwd.c, 255)
            scr.DrawRect(padx, py, 84, 2, col)
            scr.DrawRect(padx, py + 10, 84, 2, col)
            scr.DrawRect(padx, py, 2, 12, col)
            scr.DrawRect(padx + 82, py, 2, 12, col)
            scr.DrawRect(padx + 3, py + 3, Int(78 * v / pwd.mx), 6, col)
            scr.DrawText(pwd.lab, padx + 94, py - 6, col, m.fSm)
            py = py + 24
        end if
    end for
    if gs.keys > 0 then
        scr.DrawObject(padx - 8, py - 6, m.spr["key"].bm)
        scr.DrawText("x" + istr(gs.keys), padx + 32, py, m.cGold, m.fSm)
    end if

    textC(lv.name, 640, 14, m.cWhite, m.fSm)
    rx = 1280 - 28
    textR("SCORE " + padScore(gs.score, 6), rx, 14, m.cWhite, m.fSm)
    textR("COINS " + padScore(gs.coins, 2), rx, 42, m.cGold, m.fSm)
    textR("TIME " + fmtTime(gs.lt), rx, 70, m.cCyan, m.fSm)
    if lv.hasGems then
        for i = 0 to 2
            nm = "hud_gem_off"
            if gs.gems[2 - i] = 1 then nm = "hud_gem_on"
            scr.DrawObject(rx - 24 - i * 28, 98, m.spr[nm].bm)
        end for
    end if
    if gs.kc >= 2 and gs.kt > 0 then
        textC("COMBO x" + istr(gs.kc), 640, 74, mkColor(&HFFE66B, 255), m.fMd)
    end if
    b = m.BOSS
    if b <> invalid then
        if not b.dead and absf(pl.x - b.cx) < 1100 then
            bw = 288
            bx = Int(640 - bw / 2)
            by = 46
            col = m.cRed
            scr.DrawRect(bx, by, bw, 2, col)
            scr.DrawRect(bx, by + 10, bw, 2, col)
            scr.DrawRect(bx, by, 2, 12, col)
            scr.DrawRect(bx + bw - 2, by, 2, 12, col)
            scr.DrawRect(bx + 4, by + 4, Int((bw - 8) * b.hp / 3), 4, col)
        end if
    end if
end sub

sub drawOverlay()
    gs = m.G
    scr = m.screen
    st = gs.state
    if st = "play" then return
    scr.DrawRect(0, 0, 1280, 720, m.cDim)
    if st = "menu" then
        textC("POPUPIDEAS ARCADE", 640, 50, m.cWhite, m.fLg)
        n = m.menu.Count()
        first = m.menuSel - 3
        if first > n - 7 then first = n - 7
        if first < 0 then first = 0
        grey = mkColor(&H7A86B0, 255)
        for i = 0 to 6
            idx = first + i
            if idx < n then
                it = m.menu[idx]
                y = 190 + i * 56
                if idx = m.menuSel then
                    scr.DrawRect(300, y - 6, 680, 50, mkColor(&HFFC23A, 40))
                    scr.DrawRect(300, y - 6, 4, 50, m.cGold)
                end if
                col = grey
                if it.ready then col = m.cWhite
                if idx = m.menuSel and it.ready then col = m.cGold
                scr.DrawText(it.name, 330, y, col, m.fMd)
                if not it.ready then textR("coming soon", 950, y + 4, grey, m.fSm)
            end if
        end for
        textC("UP / DOWN choose        OK play        BACK exit", 640, 640, m.cCyan, m.fSm)
    else if st = "title" then
        textC("ROLLABOUT", 640, 150, m.cWhite, m.fLg)
        textC("You are a ball. Smash the blocks, stomp the bugs,", 640, 280, m.cCyan, m.fMd)
        textC("swing the chains over the big gaps.", 640, 320, m.cCyan, m.fMd)
        textC("LEFT / RIGHT  roll        OK or UP  jump", 640, 400, m.cWhite, m.fSm)
        textC("DOWN in the air  ground pound        hold DOWN on the ground + tap OK  spin dash", 640, 432, m.cWhite, m.fSm)
        textC("on a chain: touch to grab, OK to let go", 640, 464, m.cWhite, m.fSm)
        if gs.best > 0 then textC("BEST " + istr(gs.best), 640, 520, m.cGold, m.fMd)
        textC("press OK to start        BACK  menu", 640, 590, m.cGold, m.fMd)
    else if st = "paused" then
        textC("PAUSED", 640, 250, m.cWhite, m.fLg)
        textC("OK  resume          BACK  quit to menu", 640, 400, m.cGold, m.fMd)
    else if st = "clear" then
        textC("LEVEL CLEAR", 640, 170, m.cGreen, m.fLg)
        n = gs.gems[0] + gs.gems[1] + gs.gems[2]
        info = "TIME " + fmtTime(gs.lt) + "   TIME BONUS " + istr(gs.timeBonus) + "   HEALTH BONUS " + istr(gs.bonus)
        if m.LV.hasGems then info = info + "   GEMS " + istr(n) + "/3"
        textC(info, 640, 320, m.cCyan, m.fSm)
        textC("SCORE " + istr(gs.score) + "     BEST " + istr(gs.best), 640, 380, m.cWhite, m.fMd)
        textC("more levels coming - press OK to play again", 640, 520, m.cGold, m.fMd)
    else if st = "over" then
        textC("GAME OVER", 640, 190, m.cRed, m.fLg)
        textC("The bugs win this round.", 640, 320, m.cCyan, m.fMd)
        textC("SCORE " + istr(gs.score) + "     BEST " + istr(gs.best), 640, 380, m.cWhite, m.fMd)
        textC("press OK to try again", 640, 520, m.cGold, m.fMd)
    end if
end sub
