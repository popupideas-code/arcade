' game.brs - Rollabout game logic (no drawing). Ported from rollabout/index.html.
' Naming: pl = player, gs = game state, lv = level, ts = tile size. BrightScript is case-insensitive.

' ---------- small math helpers ----------
function clamp(v, a, b)
    if v < a then return a
    if v > b then return b
    return v
end function

function minf(a, b)
    if a < b then return a
    return b
end function

function maxf(a, b)
    if a > b then return a
    return b
end function

function absf(a)
    if a < 0 then return -a
    return a
end function

function hyp(dx, dy)
    return Sqr(dx * dx + dy * dy)
end function

function atan2(y, x)
    if x > 0 then return Atn(y / x)
    if x < 0 then
        if y >= 0 then return Atn(y / x) + 3.14159265
        return Atn(y / x) - 3.14159265
    end if
    if y > 0 then return 1.5707963
    if y < 0 then return -1.5707963
    return 0
end function

function istr(n) as string
    v = Int(n)
    return v.ToStr()
end function

function pad2(n) as string
    s = istr(n)
    if Len(s) < 2 then s = "0" + s
    return s
end function

function fmtTime(t) as string
    mins = Int(t / 60)
    secs = Int(t) mod 60
    tenths = Int((t - Int(t)) * 10)
    return istr(mins) + ":" + pad2(secs) + "." + istr(tenths)
end function

function padScore(n, width) as string
    s = istr(n)
    while Len(s) < width
        s = "0" + s
    end while
    return s
end function

' ---------- state ----------
sub initGame()
    m.G = { state: "title", lvl: 0, lives: 3, hp: 3, score: 0, coins: 0, t: 0.0, combo: 0, best: 0, shake: 0.0, lt: 0.0, kc: 0, kt: 0.0, gems: [0, 0, 0], keys: 0, rushT: 0.0, cg: 0 }
    m.K = { l: false, r: false, j: false, d: false }
    m.jEdge = false
    m.dEdge = false
    m.camX = 0.0
    m.held = []
    for i = 0 to 127
        m.held.push(false)
    end for
    m.PART = []
    m.POP = []
    m.BUMPS = []
    m.RINGS = []
    loadLevel(0)
    m.G.state = "title"
end sub

sub loadLevel(i)
    m.LV = buildLevel(i)
    lv = m.LV
    gs = m.G
    gs.lvl = i
    m.ENT = []
    for each o in lv.ents
        m.ENT.push(initEnt(o))
    end for
    m.COINS = []
    for each c in lv.coins
        m.COINS.push({ x: c.x, y: c.y, got: false })
    end for
    m.CHECKS = []
    for each c in lv.checks
        m.CHECKS.push({ x: c.x, y: c.y, on: false })
    end for
    m.CHAINS = []
    for each c in lv.chains
        m.CHAINS.push({ ax: c.ax, ay: c.ay, L: c.L, A: .95, om: Sqr(m.GC / c.L), ph: Rnd(0) * 6.28, th: 0.0, w: 0.0, latched: false })
    end for
    m.BOSS = invalid
    for each e in m.ENT
        if e.boss then m.BOSS = e
    end for
    m.PLAT = []
    for each p in lv.plats
        m.PLAT.push({ x: p.cx - p.w / 2, y: p.y0, w: p.w, h: 14, axis: p.axis, cx: p.cx, y0: p.y0, range: p.range, spd: p.spd, ph: p.ph, dx: 0.0, dy: 0.0 })
    end for
    m.ITEMS = []
    for each it in lv.items
        m.ITEMS.push({ kind: it.kind, x: it.x, y: it.y, vy: 0.0, t: Rnd(0) * 6, id: it.id, fix: (it.kind = "gem"), got: false, mag: false })
    end for
    gs.keys = 0
    updatePlats(0)
    for each p in m.PLAT
        p.dx = 0 : p.dy = 0
    end for
    m.RINGS = []
    gs.lt = 0 : gs.cg = 0 : gs.kc = 0 : gs.kt = 0 : gs.gems = [0, 0, 0] : gs.rushT = 0
    gs.totalCoins = lv.coins.Count()
    m.PART = [] : m.POP = [] : m.BUMPS = []
    m.respawnX = lv.startC * m.T + m.T / 2
    m.respawnY = lv.startR * m.T + m.T / 2
    m.P = { x: m.respawnX, y: m.respawnY, vx: 0.0, vy: 0.0, r: 15, ang: 0.0, gnd: false, coy: 0.0, jbuf: 0.0, rel: 0.0, inv: 0.0, latch: invalid, dead: false, dt: 0.0
            face: 1, sq: 0.0, sv: 0.0, sh: 0.0, shv: 0.0, spk: 0.0, pound: false, boost: 0.0, cling: 0.0, wallRoll: 0, rev: 0.0, revd: false, spr: 0.0
            pw: { spike: 0.0, speed: 0.0, magnet: 0.0 } }
    gs.hp = 3 : gs.combo = 0
    m.camX = 0
end sub

sub startGame(i, fresh)
    gs = m.G
    if fresh then
        gs.lives = 3 : gs.score = 0 : gs.coins = 0
    end if
    loadLevel(i)
    gs.state = "play"
    clearInput()
end sub

sub clearInput()
    for i = 0 to 127
        m.held[i] = false
    end for
    m.K.l = false : m.K.r = false : m.K.j = false : m.K.d = false
    m.jEdge = false : m.dEdge = false
end sub

' ---------- particles & popups ----------
sub spawn(x, y, n, col, spd, life, grav)
    if m.PART.Count() > 260 then return
    for i = 1 to n
        a = Rnd(0) * 6.283
        s = spd * (.3 + Rnd(0) * .7)
        m.PART.push({ x: x, y: y, vx: Cos(a) * s, vy: Sin(a) * s - spd * .3, life: life * (.6 + Rnd(0) * .4), max: life, col: col, g: grav, sz: 2 + Rnd(0) * 3, sq: false })
    end for
end sub

sub popup(x, y, txt, col)
    m.POP.push({ x: x, y: y, txt: txt, col: col, t: 0.0 })
end sub

sub addScore(n, x, y)
    m.G.score = m.G.score + n
    if x <> invalid then popup(x, y - 18, "+" + istr(n), "gold")
end sub

sub updateParticles(dt)
    keep = []
    for each pt in m.PART
        pt.life = pt.life - dt
        pt.vy = pt.vy + pt.g * dt
        pt.x = pt.x + pt.vx * dt
        pt.y = pt.y + pt.vy * dt
        if pt.life > 0 then keep.push(pt)
    end for
    m.PART = keep
    keep = []
    for each pp in m.POP
        pp.t = pp.t + dt
        if pp.t < 1.1 then keep.push(pp)
    end for
    m.POP = keep
end sub

' ---------- ball vs tiles ----------
sub hitBlock(c, r, fromBelow)
    lv = m.LV
    tt = lv.g[r][c]
    cx = c * m.T + m.T / 2
    if tt = 66 then
        lv.g[r][c] = 0
        sfx("brk")
        m.G.shake = .18
        for i = 1 to 7
            m.PART.push({ x: cx, y: r * m.T + m.T / 2, vx: (Rnd(0) - .5) * 380, vy: -120 - Rnd(0) * 320, life: 1.1, max: 1.1, col: "magenta", g: 1600, sz: 5 + Rnd(0) * 4, sq: true })
        end for
        addScore(50, cx, r * m.T)
    else if tt = 83 or tt = 77 or tt = 86 then
        lv.g[r][c] = 85
        sfx("power")
        m.BUMPS.push({ c: c, r: r, t: 0.0 })
        kind = "speed"
        if tt = 83 then kind = "spike"
        if tt = 77 then kind = "magnet"
        m.ITEMS.push({ kind: kind, x: cx, y: r * m.T - 6, vy: -460.0, t: 0.0, id: -1, fix: false, got: false, mag: false })
        spawn(cx, r * m.T, 10, "white", 240, .5, 900)
    else if tt = 63 then
        lv.g[r][c] = 85
        sfx("coin")
        m.G.coins = m.G.coins + 1
        addScore(100, cx, r * m.T)
        m.BUMPS.push({ c: c, r: r, t: 0.0 })
        spawn(cx, r * m.T, 10, "gold", 260, .6, 900)
        checkOneUp()
    end if
    if fromBelow then
        for each e in m.ENT
            if not e.dead and (e.t = "blob" or e.t = "spiky") then
                if absf(e.x - cx) < m.T * .8 and absf((e.y + e.r) - (r * m.T)) < 14 then kill(e, 100)
            end if
        end for
    end if
end sub

sub checkOneUp()
    gs = m.G
    if gs.coins >= 50 then
        gs.coins = gs.coins - 50
        gs.lives = gs.lives + 1
        popup(m.P.x, m.P.y - 40, "1UP!", "green")
        sfx("win")
    end if
end sub

sub collide()
    pl = m.P
    lv = m.LV
    ts = m.T
    rad = pl.r
    nrows = m.ROWS
    pl.gnd = false
    c0 = Int((pl.x - rad) / ts) : c1 = Int((pl.x + rad) / ts)
    r0 = Int((pl.y - rad) / ts) : r1 = Int((pl.y + rad) / ts)
    for r = r0 to r1
        for c = c0 to c1
            inb = (r >= 0) and (r < nrows) and (c >= 0) and (c < lv.W)
            done = false
            tt = 35
            if inb then
                tt = lv.g[r][c]
                if tt = 47 or tt = 92 then
                    slopeCollide(c, r, tt)
                    done = true
                end if
            end if
            if not done then
                if solidAt(c, r) then
                    x0 = c * ts : y0 = r * ts
                    px = clamp(pl.x, x0, x0 + ts) : py = clamp(pl.y, y0, y0 + ts)
                    dx = pl.x - px : dy = pl.y - py
                    d2 = dx * dx + dy * dy
                    if d2 < rad * rad then
                        nx = 0.0 : ny = 0.0 : push = 0.0
                        if d2 > .000001 then
                            d = Sqr(d2)
                            nx = dx / d : ny = dy / d : push = rad - d
                        else
                            l = pl.x - x0 : rr = x0 + ts - pl.x : u = pl.y - y0 : b = y0 + ts - pl.y
                            mn = minf(minf(l, rr), minf(u, b))
                            if mn = u then
                                nx = 0 : ny = -1 : push = u + rad
                            else if mn = b then
                                nx = 0 : ny = 1 : push = b + rad
                            else if mn = l then
                                nx = -1 : ny = 0 : push = l + rad
                            else
                                nx = 1 : ny = 0 : push = rr + rad
                            end if
                        end if
                        vn = pl.vx * nx + pl.vy * ny
                        if hitt(tt) and absf(nx) > .7 and vn < 0 and absf(pl.vx) >= m.SMASH then
                            hitBlock(c, r, false)
                            pl.vx = pl.vx * .82
                        else
                            pl.x = pl.x + nx * push
                            pl.y = pl.y + ny * push
                            if vn < 0 then
                                if ny > .7 and pl.vy < -60 and hitt(tt) then
                                    hitBlock(c, r, true)
                                else if ny > .7 and pl.vy < -60 and tt <> 0 then
                                    sfx("bump")
                                end if
                                if absf(nx) > .7 and vn < -160 then pl.shv = minf(5, -vn / 110)
                                pl.vx = pl.vx - vn * nx
                                pl.vy = pl.vy - vn * ny
                            end if
                            if ny < -.6 then pl.gnd = true
                        end if
                    end if
                end if
            end if
        end for
    end for
end sub

function segClosest(px, py, ax, ay, bx, by)
    dx = bx - ax : dy = by - ay
    l2 = dx * dx + dy * dy
    t = 0.0
    if l2 > 0 then t = ((px - ax) * dx + (py - ay) * dy) / l2
    if t < 0 then t = 0
    if t > 1 then t = 1
    return [ax + dx * t, ay + dy * t]
end function

sub slopeCollide(c, r, s)
    pl = m.P
    ts = m.T
    x0 = c * ts : y0 = r * ts : x1 = x0 + ts : y1 = y0 + ts
    rad = pl.r
    if s = 47 then
        vx = [x0, x1, x1] : vy = [y1, y1, y0]
        nxs = [0, 1, -.7071] : nys = [1, 0, -.7071]
    else
        vx = [x0, x0, x1] : vy = [y0, y1, y1]
        nxs = [-1, 0, .7071] : nys = [0, 1, -.7071]
    end if
    inside = true : best = -999999.0 : bi = 0
    for i = 0 to 2
        d = (pl.x - vx[i]) * nxs[i] + (pl.y - vy[i]) * nys[i]
        if d > 0 then inside = false
        if d > best then
            best = d
            bi = i
        end if
    end for
    nx = 0.0 : ny = 0.0 : push = 0.0
    if inside then
        nx = nxs[bi] : ny = nys[bi] : push = rad - best
    else
        bd = 999999.0 : qx = 0.0 : qy = 0.0
        for i = 0 to 2
            j = (i + 1) mod 3
            q = segClosest(pl.x, pl.y, vx[i], vy[i], vx[j], vy[j])
            dd = hyp(pl.x - q[0], pl.y - q[1])
            if dd < bd then
                bd = dd : qx = q[0] : qy = q[1]
            end if
        end for
        if bd >= rad then return
        if bd < .000001 then
            nx = nxs[bi] : ny = nys[bi] : push = rad
        else
            nx = (pl.x - qx) / bd : ny = (pl.y - qy) / bd : push = rad - bd
        end if
    end if
    pl.x = pl.x + nx * push
    pl.y = pl.y + ny * push
    vn = pl.vx * nx + pl.vy * ny
    if vn < 0 then
        pl.vx = pl.vx - vn * nx
        pl.vy = pl.vy - vn * ny
    end if
    if ny < -.6 then pl.gnd = true
end sub

sub moveBall(dt)
    pl = m.P
    mx = maxf(absf(pl.vx), absf(pl.vy)) * dt / 9
    n = -Int(-mx)
    if n < 1 then n = 1
    h = dt / n
    gnd = false
    for i = 1 to n
        pl.x = pl.x + pl.vx * h
        pl.y = pl.y + pl.vy * h
        collide()
        if pl.gnd then gnd = true
    end for
    pl.gnd = gnd
end sub

' ---------- chains ----------
sub chainTip(ch, out)
    out[0] = ch.ax + ch.L * Sin(ch.th)
    out[1] = ch.ay + ch.L * Cos(ch.th)
end sub

sub updateChains(dt)
    gs = m.G
    for each ch in m.CHAINS
        if not ch.latched then
            ch.A = ch.A + (.95 - ch.A) * dt * .4
            a = ch.om * gs.t + ch.ph
            ch.th = ch.A * Sin(a)
            ch.w = ch.A * ch.om * Cos(a)
        end if
    end for
end sub

sub latch(ch)
    pl = m.P
    th = ch.th
    vt = pl.vx * Cos(th) - pl.vy * Sin(th)
    ch.w = (vt / ch.L) * .65 + ch.w * .35
    ch.latched = true
    pl.latch = ch
    m.G.combo = 0
    sfx("grab")
    tip = [0.0, 0.0]
    chainTip(ch, tip)
    spawn(tip[0], tip[1], 8, "gold", 180, .4, 200)
end sub

sub releaseChain()
    pl = m.P
    ch = pl.latch
    if ch = invalid then return
    pl.vx = pl.vx * 1.22
    pl.vy = pl.vy * 1.15 - 260
    pl.latch = invalid
    ch.latched = false
    pl.rel = .35 : pl.jbuf = 0 : pl.gnd = false : pl.coy = 0
    wo = ch.w / ch.om
    amp = Sqr(ch.th * ch.th + wo * wo)
    ch.A = clamp(amp, .5, 1.25)
    ch.ph = atan2(ch.th, wo) - ch.om * m.G.t
    sfx("release")
end sub

sub updateLatch(dt, dir)
    pl = m.P
    ch = pl.latch
    ln = ch.L
    a = -(m.GC / ln) * Sin(ch.th)
    if dir <> 0 then
        if Sgn(ch.w) = dir or absf(ch.w) < .3 then
            a = a + dir * 3.4
        else
            a = a + dir * 1
        end if
    end if
    ch.w = ch.w + a * dt
    ch.w = ch.w * (1 - .1 * dt)
    ch.th = ch.th + ch.w * dt
    if ch.th > 1.4 then
        ch.th = 1.4 : ch.w = minf(ch.w, 0)
    end if
    if ch.th < -1.4 then
        ch.th = -1.4 : ch.w = maxf(ch.w, 0)
    end if
    pl.x = ch.ax + ln * Sin(ch.th)
    pl.y = ch.ay + ln * Cos(ch.th)
    pl.vx = ln * ch.w * Cos(ch.th)
    pl.vy = -ln * ch.w * Sin(ch.th)
    pl.ang = pl.ang + ch.w * dt * .6
    if pl.jbuf > 0 then releaseChain()
end sub

' ---------- player events ----------
sub scatterRings()
    gs = m.G
    pl = m.P
    n = minf(gs.coins, 24)
    if n < 1 then return
    gs.coins = gs.coins - n
    for i = 0 to n - 1
        a = i / n * 6.283
        s = 170 + Rnd(0) * 230
        m.RINGS.push({ x: pl.x, y: pl.y, vx: Cos(a) * s, vy: Sin(a) * s - 260, life: 6.0, delay: .7 })
    end for
    sfx("hurt")
end sub

sub hurt(dirx)
    pl = m.P
    gs = m.G
    if pl.inv > 0 or pl.dead then return
    scatterRings()
    gs.hp = gs.hp - 1
    sfx("hurt")
    pl.inv = 1.6
    spawn(pl.x, pl.y, 10, "red", 280, .5, 900)
    if pl.latch <> invalid then releaseChain()
    pl.pound = false
    if gs.hp <= 0 then
        die(false)
        return
    end if
    pl.vx = dirx * 320
    pl.vy = -380
end sub

sub die(pit)
    pl = m.P
    gs = m.G
    if pl.dead then return
    if pl.latch <> invalid then
        pl.latch.latched = false
        pl.latch = invalid
    end if
    pl.dead = true
    if pit then
        pl.dt = .7 : pl.vy = 0
    else
        pl.dt = 0 : pl.vy = -600
    end if
    pl.vx = 0
    gs.lives = gs.lives - 1
    sfx("die")
    if not pit then spawn(pl.x, pl.y, 16, "red", 320, .8, 900)
end sub

sub afterDeath()
    pl = m.P
    gs = m.G
    if gs.lives <= 0 then
        endGame()
        return
    end if
    pl.x = m.respawnX : pl.y = m.respawnY : pl.vx = 0 : pl.vy = 0
    pl.dead = false : pl.inv = 1.5 : pl.gnd = false
    gs.hp = 3 : gs.combo = 0
    pl.latch = invalid : pl.rev = 0 : pl.pound = false
    pl.pw.spike = 0 : pl.pw.speed = 0 : pl.pw.magnet = 0
    for each ch in m.CHAINS
        ch.latched = false
    end for
end sub

sub kill(e, pts)
    gs = m.G
    if e.dead then return
    if pts > 0 and not e.boss then
        if gs.kt > 0 then
            gs.kc = gs.kc + 1
        else
            gs.kc = 1
        end if
        gs.kt = 2.6
        pts = Int(pts * minf(5, 1 + (gs.kc - 1) * .5) + .5)
    end if
    e.dead = true
    e.vy = -420
    e.vx = (Rnd(0) - .5) * 200
    col = "cyan"
    if e.t = "wasp" then col = "gold"
    if e.t = "blob" then col = "green"
    if e.t = "spider" then col = "magenta"
    spawn(e.x, e.y, 10, col, 260, .6, 900)
    if pts > 0 then addScore(pts, e.x, e.y)
end sub

sub bossHit(e)
    e.hp = e.hp - 1
    e.inv = 1.1
    sfx("stomp")
    sfx("boss")
    m.G.shake = .3
    spawn(e.x, e.y, 16, "gold", 320, .7, 900)
    if e.hp <= 0 then
        kill(e, 2000)
        sfx("win")
    end if
end sub

sub overlapEnemy(e)
    pl = m.P
    gs = m.G
    sp = pl.pw.spike > 0
    dx = pl.x - e.x : dy = pl.y - e.y
    rr = pl.r + e.r - 3
    if sp then rr = rr + 8
    if dx * dx + dy * dy >= rr * rr then return
    sdir = Sgn(dx)
    if sdir = 0 then sdir = 1
    if e.boss then
        if e.inv > 0 then return
        if sp then
            bossHit(e)
            pl.vx = sdir * 320
            pl.vy = -300
            return
        end if
        if pl.vy > 0 and pl.y < e.y - 8 then
            bossHit(e)
            pl.vy = -620
        else
            hurt(sdir)
        end if
        return
    end if
    if sp then
        kill(e, 200)
        sfx("brk")
        return
    end if
    fast = absf(pl.vx) >= m.SMASH
    if (e.t <> "spiky" or pl.pound) and pl.vy > 60 and pl.y < e.y - 2 and not pl.gnd then
        gs.combo = minf(gs.combo + 1, 4)
        kill(e, 100 * (2 ^ (gs.combo - 1)))
        if m.K.j then
            pl.vy = -640
        else
            pl.vy = -480
        end if
        sfx("stomp")
        return
    end if
    if fast then
        kill(e, 150)
        sfx("brk")
        return
    end if
    hurt(sdir)
end sub

' ---------- enemies ----------
sub groundEnemy(e, dt)
    ts = m.T
    e.vy = minf(e.vy + m.GRAV * dt, 900)
    e.x = e.x + e.dir * e.sp * dt
    e.y = e.y + e.vy * dt
    c = Int(e.x / ts)
    rb = Int((e.y + e.r) / ts)
    if e.vy >= 0 and solidAt(c, rb) then
        e.y = rb * ts - e.r
        e.vy = 0
        if not solidAt(Int((e.x + e.dir * (e.r + 4)) / ts), rb) then e.dir = -e.dir
    end if
    if solidAt(Int((e.x + e.dir * (e.r + 2)) / ts), Int(e.y / ts)) then e.dir = -e.dir
    if e.x < 20 then e.dir = 1
end sub

sub dragonAI(e, dt)
    pl = m.P
    gs = m.G
    e.tm = e.tm + dt
    if e.st = 0 then
        e.x = e.x0 + Sin(gs.t * .9 + e.ph) * 60
        e.y = e.y0 + Sin(gs.t * 3 + e.ph) * 14
        e.cool = e.cool - dt
        if e.cool <= 0 and absf(pl.x - e.x) < 380 and absf(pl.y - e.y) < 260 then
            e.st = 1 : e.tm = 0 : e.tx = pl.x : e.ty = pl.y
            sfx("boss")
        end if
    else if e.st = 1 then
        dx = e.tx - e.x : dy = e.ty - e.y
        d = hyp(dx, dy)
        if d < .001 then d = 1
        e.x = e.x + dx / d * 420 * dt
        e.y = e.y + dy / d * 420 * dt
        if dx >= 0 then
            e.dir = 1
        else
            e.dir = -1
        end if
        if d < 20 or e.tm > .9 then
            e.st = 2 : e.tm = 0
        end if
    else
        dx = e.x0 - e.x : dy = e.y0 - e.y
        d = hyp(dx, dy)
        if d < .001 then d = 1
        e.x = e.x + dx / d * 200 * dt
        e.y = e.y + dy / d * 200 * dt
        if d < 10 then
            e.st = 0 : e.cool = 2.2
        end if
    end if
end sub

sub bossAI(e, dt)
    pl = m.P
    gs = m.G
    e.tm = e.tm + dt
    e.inv = maxf(0, e.inv - dt)
    if e.st = 0 then
        if pl.x > e.x then
            e.dir = 1
        else
            e.dir = -1
        end if
        e.sp = 85
        if e.tm > 2.4 and absf(pl.x - e.x) < 520 then
            e.st = 1 : e.tm = 0 : e.sp = 0
            sfx("boss")
        end if
    else if e.st = 1 then
        e.sp = 0
        if pl.x > e.x then
            e.dir = 1
        else
            e.dir = -1
        end if
        if e.tm > .7 then
            e.st = 2 : e.tm = 0 : e.sp = 400 : e.cdir = e.dir
        end if
    else if e.st = 2 then
        e.sp = 400
        if e.dir <> e.cdir or e.tm > 1.4 or e.x <= e.xmin or e.x >= e.xmax then
            e.st = 3 : e.tm = 0 : e.sp = 0
            gs.shake = .35
            spawn(e.x, e.y - e.r, 10, "gold", 240, .6, 900)
            sfx("bump")
        end if
    else
        e.sp = 0
        if e.tm > 1.3 then
            e.st = 0 : e.tm = 0
        end if
    end if
    d0 = e.dir
    groundEnemy(e, dt)
    if e.st <> 2 then e.dir = d0
    e.x = clamp(e.x, e.xmin, e.xmax)
end sub

sub updateEnemies(dt)
    pl = m.P
    gs = m.G
    for each e in m.ENT
        if e.dead then
            e.vy = e.vy + m.GRAV * dt
            e.y = e.y + e.vy * dt
            e.x = e.x + e.vx * dt
        else if absf(e.x - pl.x) > m.VW * .9 + 300 and not e.boss then
            ' off-screen: sleep
        else
            t = e.t
            if t = "blob" or t = "spiky" then
                groundEnemy(e, dt)
            else if t = "wasp" then
                e.x = e.x0 + Sin(gs.t * 1.1 + e.ph) * 110
                e.y = e.y0 + Sin(gs.t * 2.6 + e.ph) * 26
                if Cos(gs.t * 1.1 + e.ph) >= 0 then
                    e.dir = 1
                else
                    e.dir = -1
                end if
            else if t = "spider" then
                e.y = e.y0 + (Sin(gs.t * 1.5 + e.ph) + 1) / 2 * e.len
            else if t = "dragon" then
                dragonAI(e, dt)
            else if t = "boss" then
                bossAI(e, dt)
            end if
            if not pl.dead then overlapEnemy(e)
        end if
    end for
    keep = []
    for each e in m.ENT
        if not (e.dead and e.y > m.VH + 300) then keep.push(e)
    end for
    m.ENT = keep
end sub

' ---------- items, platforms, doors ----------
sub updateItems(dt)
    pl = m.P
    gs = m.G
    ts = m.T
    keep = []
    for each it in m.ITEMS
        it.t = it.t + dt
        it.mag = false
        if pl.pw.magnet > 0 and not pl.dead then
            dx = pl.x - it.x : dy = pl.y - it.y
            d = hyp(dx, dy)
            if d < 200 and d > 1 then
                it.x = it.x + dx / d * 420 * dt
                it.y = it.y + dy / d * 420 * dt
                it.vy = 0
                it.mag = true
            end if
        end if
        if not it.mag and not it.fix then
            it.vy = minf(it.vy + m.GRAV * dt, 900)
            it.y = it.y + it.vy * dt
            c = Int(it.x / ts) : r = Int((it.y + 14) / ts)
            if it.vy >= 0 and solidAt(c, r) then
                it.y = r * ts - 14
                it.vy = 0
            end if
        end if
        if not pl.dead and hyp(pl.x - it.x, pl.y - it.y) < pl.r + 16 then
            collectItem(it)
        else if it.y < m.VH + 200 then
            keep.push(it)
        end if
    end for
    m.ITEMS = keep
end sub

sub collectItem(it)
    pl = m.P
    gs = m.G
    spawn(it.x, it.y, 12, "white", 260, .5, 0)
    if it.kind = "gem" then
        gs.gems[it.id] = 1
        sfx("power")
        addScore(500, it.x, it.y)
        n = gs.gems[0] + gs.gems[1] + gs.gems[2]
        popup(it.x, it.y - 30, "GEM " + istr(n) + "/3", "violet")
        spawn(it.x, it.y, 18, "violet", 300, .7, 0)
        return
    end if
    if it.kind = "key" then
        gs.keys = gs.keys + 1
        popup(it.x, it.y - 24, "KEY", "gold")
        sfx("power")
        return
    end if
    sfx("power")
    addScore(100, it.x, it.y)
    if it.kind = "spike" then
        pl.pw.spike = 15
        popup(it.x, it.y - 30, "SPIKES!", "orange")
    else if it.kind = "magnet" then
        pl.pw.magnet = 15
        popup(it.x, it.y - 30, "MAGNET!", "cyan")
    else
        pl.pw.speed = 12
        popup(it.x, it.y - 30, "SPEED!", "lime")
    end if
end sub

sub updatePlats(dt)
    gs = m.G
    for each p in m.PLAT
        nx = p.cx - p.w / 2
        ny = p.y0
        if p.axis = "x" then
            nx = nx + Sin(gs.t * p.spd + p.ph) * p.range
        else
            ny = ny + Sin(gs.t * p.spd + p.ph) * p.range
        end if
        p.dx = nx - p.x : p.dy = ny - p.y
        p.x = nx : p.y = ny
    end for
end sub

sub platCollide(dt)
    pl = m.P
    for each p in m.PLAT
        bot = pl.y + pl.r
        if pl.vy >= p.dy / maxf(dt, .0001) - 30 and pl.x > p.x - 8 and pl.x < p.x + p.w + 8 and bot >= p.y - 6 and bot <= p.y + 20 + maxf(0, pl.vy * dt) then
            pl.y = p.y - pl.r
            pl.vy = 0
            pl.gnd = true
            pl.x = pl.x + p.dx
        end if
    end for
end sub

sub openDoor(c, r)
    lv = m.LV
    gs = m.G
    r0 = r
    while r0 > 0 and lv.g[r0 - 1][c] = 68
        r0 = r0 - 1
    end while
    rr = r0
    while rr < m.ROWS and lv.g[rr][c] = 68
        lv.g[rr][c] = 0
        spawn(c * m.T + m.T / 2, rr * m.T + m.T / 2, 6, "gold", 200, .5, 900)
        rr = rr + 1
    end while
    gs.keys = gs.keys - 1
    sfx("door")
    popup(c * m.T + m.T / 2, r * m.T - 10, "UNLOCKED", "gold")
end sub

sub checkDoors()
    gs = m.G
    if gs.keys <= 0 then return
    pl = m.P
    lv = m.LV
    ts = m.T
    c0 = Int((pl.x - pl.r - 4) / ts) : c1 = Int((pl.x + pl.r + 4) / ts)
    r0 = Int((pl.y - pl.r - 4) / ts) : r1 = Int((pl.y + pl.r + 4) / ts)
    for r = r0 to r1
        for c = c0 to c1
            if r >= 0 and r < m.ROWS and c >= 0 and c < lv.W then
                if lv.g[r][c] = 68 and gs.keys > 0 then openDoor(c, r)
            end if
        end for
    end for
end sub

sub slamLand()
    pl = m.P
    lv = m.LV
    ts = m.T
    pl.pound = false
    m.G.shake = .3
    sfx("pound")
    pl.sv = 7
    for i = 0 to 13
        s = 1
        if i < 7 then s = -1
        m.PART.push({ x: pl.x, y: pl.y + pl.r, vx: s * (120 + Rnd(0) * 260), vy: -40 - Rnd(0) * 120, life: .5, max: .5, col: "gold", g: 400, sz: 3.0, sq: false })
    end for
    r = Int((pl.y + pl.r + 4) / ts)
    cc = Int(pl.x / ts)
    for dc = -1 to 1
        c = cc + dc
        if c >= 0 and c < lv.W and r >= 0 and r < m.ROWS then
            tt = lv.g[r][c]
            if hitt(tt) and (dc = 0 or absf(pl.x - (c * ts + ts / 2)) < ts * .9) then hitBlock(c, r, false)
        end if
    end for
    for each e in m.ENT
        if not e.dead and e.t <> "wasp" and e.t <> "dragon" and e.t <> "spider" then
            if absf(e.x - pl.x) < 95 and absf(e.y - pl.y) < 60 then
                if e.boss then
                    if e.inv <= 0 then bossHit(e)
                else
                    kill(e, 150)
                end if
            end if
        end if
    end for
end sub

' ---------- rings dropped when hurt ----------
sub updateRings(dt)
    pl = m.P
    gs = m.G
    ts = m.T
    keep = []
    for each g in m.RINGS
        g.life = g.life - dt
        g.delay = g.delay - dt
        g.vy = g.vy + 900 * dt
        g.x = g.x + g.vx * dt
        g.y = g.y + g.vy * dt
        c = Int(g.x / ts) : r = Int((g.y + 9) / ts)
        if g.vy > 0 and solidAt(c, r) then
            g.y = r * ts - 9
            g.vy = g.vy * -.55
            g.vx = g.vx * .82
            if absf(g.vy) < 70 then g.vy = 0
        end if
        if solidAt(Int((g.x + Sgn(g.vx) * 9) / ts), Int(g.y / ts)) then g.vx = g.vx * -.6
        if pl.pw.magnet > 0 and g.delay <= 0 then
            dx = pl.x - g.x : dy = pl.y - g.y
            d = hyp(dx, dy)
            if d < 220 and d > 1 then
                g.x = g.x + dx / d * 500 * dt
                g.y = g.y + dy / d * 500 * dt
                g.vy = 0
            end if
        end if
        if g.delay <= 0 and not pl.dead and hyp(pl.x - g.x, pl.y - g.y) < pl.r + 12 then
            gs.coins = gs.coins + 1
            sfx("coin")
            g.life = 0
            checkOneUp()
        end if
        if g.life > 0 and g.y < m.VH + 200 then keep.push(g)
    end for
    m.RINGS = keep
end sub

' ---------- spin dash ----------
function spinDash(dt, dir) as boolean
    pl = m.P
    crouch = m.K.d and pl.gnd and absf(pl.vx) < 110 and not pl.pound
    if crouch then
        if dir <> 0 then pl.face = dir
        if pl.jbuf > 0 then
            pl.rev = minf(1, pl.rev + .34)
            pl.jbuf = 0
            sfx("rev")
        end if
        pl.vx = pl.vx * (1 - minf(1, 7 * dt))
        pl.ang = pl.ang + dt * (16 + 24 * pl.rev) * pl.face
        pl.sq = maxf(pl.sq, .14 + .1 * pl.rev)
        pl.revd = true
        if Rnd(0) < .5 and m.PART.Count() < 260 then
            m.PART.push({ x: pl.x - pl.face * pl.r, y: pl.y + pl.r, vx: -pl.face * (40 + pl.rev * 120), vy: -30 - Rnd(0) * 70, life: .3, max: .3, col: "steel", g: 300, sz: 3.0, sq: false })
        end if
        return true
    end if
    if pl.revd then
        pl.revd = false
        if pl.rev > .06 and pl.gnd then
            pl.vx = pl.face * (340 + pl.rev * 620)
            pl.boost = 1.2
            sfx("dash")
            pl.sv = -2
            spawn(pl.x - pl.face * pl.r, pl.y + pl.r, 8, "yellow", 240, .4, 200)
        end if
        pl.rev = 0
    end if
    return false
end function

' ---------- main update ----------
sub update(dt)
    gs = m.G
    pl = m.P
    lv = m.LV
    ts = m.T
    k = m.K
    gs.t = gs.t + dt
    gs.shake = maxf(0, gs.shake - dt)
    gs.lt = gs.lt + dt
    gs.kt = maxf(0, gs.kt - dt)
    if gs.kt <= 0 then gs.kc = 0
    updateChains(dt)
    updateParticles(dt)
    updatePlats(dt)
    updateRings(dt)
    if m.BUMPS.Count() > 0 then
        keep = []
        for each b in m.BUMPS
            b.t = b.t + dt
            if b.t < .25 then keep.push(b)
        end for
        m.BUMPS = keep
    end if

    if pl.dead then
        pl.dt = pl.dt + dt
        pl.vy = pl.vy + m.GRAV * dt
        pl.y = pl.y + pl.vy * dt
        pl.ang = pl.ang + dt * 6
        if pl.dt > 1.5 then afterDeath()
        updateEnemies(0)
        followCam(dt)
        return
    end if

    dir = 0
    if k.r then dir = dir + 1
    if k.l then dir = dir - 1
    if dir <> 0 then pl.face = dir
    pl.sv = pl.sv + (-260 * pl.sq - 16 * pl.sv) * dt
    pl.sq = clamp(pl.sq + pl.sv * dt, -.35, .45)
    pl.shv = pl.shv + (-260 * pl.sh - 16 * pl.shv) * dt
    pl.sh = clamp(pl.sh + pl.shv * dt, -.3, .4)
    pw = pl.pw
    pw.spike = maxf(0, pw.spike - dt)
    pw.speed = maxf(0, pw.speed - dt)
    pw.magnet = maxf(0, pw.magnet - dt)
    pl.boost = maxf(0, pl.boost - dt)
    pl.spr = maxf(0, pl.spr - dt)
    pl.inv = maxf(0, pl.inv - dt)
    pl.coy = pl.coy - dt
    pl.jbuf = pl.jbuf - dt
    pl.rel = pl.rel - dt
    if m.jEdge then
        pl.jbuf = .13
        m.jEdge = false
    end if
    slam = m.dEdge
    m.dEdge = false

    if pl.latch <> invalid then
        updateLatch(dt, dir)
    else
        fastMode = pw.speed > 0
        crouch = spinDash(dt, dir)
        acc = 430
        if pl.gnd then acc = 640
        if fastMode then acc = acc * 1.45
        if pl.pound then acc = acc * .2
        mv = m.MAXV
        if fastMode then mv = mv + 150
        if pl.boost > 0 then mv = mv + 340
        if lv.fast then mv = mv + 260
        if not crouch then
            if dir <> 0 then
                pl.vx = pl.vx + dir * acc * dt
                if pl.gnd and Sgn(pl.vx) <> dir then pl.vx = pl.vx + dir * acc * dt
            else if pl.gnd then
                f = 260 * dt
                if absf(pl.vx) <= f then
                    pl.vx = 0
                else
                    pl.vx = pl.vx - Sgn(pl.vx) * f
                end if
            end if
        end if
        if absf(pl.vx) > mv then
            if pl.gnd then
                pl.vx = pl.vx - Sgn(pl.vx) * minf(absf(pl.vx) - mv, 700 * dt)
            else if dir <> 0 and Sgn(pl.vx) <> dir then
                pl.vx = pl.vx + dir * acc * dt
            end if
        end if
        pl.vx = clamp(pl.vx, -1100, 1100)
        ' ground pound
        if slam and not pl.gnd and not pl.pound and pl.coy <= 0 then
            pl.pound = true
            pl.vy = 1300
            pl.vx = pl.vx * .3
            sfx("pound")
        end if
        if pl.pound then
            pl.ang = pl.ang + dt * 14
            if Rnd(0) < .6 and m.PART.Count() < 260 then m.PART.push({ x: pl.x, y: pl.y - 8, vx: 0.0, vy: -60.0, life: .25, max: .25, col: "gold", g: 0, sz: 4.0, sq: false })
        end if
        ' spike wall cling and climb
        wall = 0
        if pw.spike > 0 and dir <> 0 and not pl.gnd and not pl.pound then
            cx = Int((pl.x + dir * (pl.r + 3)) / ts)
            if solidAt(cx, Int(pl.y / ts)) or solidAt(cx, Int((pl.y - pl.r * .6) / ts)) then wall = dir
        end if
        if wall <> 0 then
            pl.cling = .12
            pl.vx = wall * 40
            pl.wallRoll = wall
            tv = 0
            if k.j then
                tv = -210
            else if k.d then
                tv = 190
            end if
            pl.vy = pl.vy + (tv - pl.vy) * minf(1, dt * 9)
        else
            if pl.cling > 0 and k.j and dir <> 0 and not pl.gnd then
                pl.vy = -330
                pl.vx = dir * 230
                pl.cling = 0
            end if
            pl.cling = maxf(0, pl.cling - dt)
            if crouch then pl.jbuf = 0
            if pl.jbuf > 0 and pl.coy > 0 then
                pl.vy = -m.JV
                pl.coy = 0 : pl.jbuf = 0 : pl.gnd = false
                pl.sv = -3.5
                sfx("jump")
                spawn(pl.x, pl.y + pl.r, 5, "steel", 120, .3, 200)
            end if
            if not k.j and pl.vy < -260 and not pl.pound and not (pl.spr > 0) then pl.vy = pl.vy + 3600 * dt
            maxfall = 1100
            if pl.pound then maxfall = 1500
            pl.vy = minf(pl.vy + m.GRAV * dt, maxfall)
        end if
        pvy = pl.vy
        was = pl.gnd
        moveBall(dt)
        platCollide(dt)
        if pl.gnd and not was and pvy > 260 then
            if pl.pound then
                slamLand()
            else
                pl.sv = minf(6, pvy / 900 * 5)
                spawn(pl.x, pl.y + pl.r, minf(8, Int(pvy / 150)), "steel", 130, .35, 300)
                if pvy > 520 then sfx("bump")
            end if
        end if
        if pl.gnd then
            pl.coy = .1
            gs.combo = 0
            pl.pound = false
            c = Int(pl.x / ts) : r = Int((pl.y + pl.r + 3) / ts)
            tt = 0
            if r >= 0 and r < m.ROWS and c >= 0 and c < lv.W then tt = lv.g[r][c]
            if tt = 117 then
                if k.j then
                    pl.vy = -1350
                else
                    pl.vy = -1150
                end if
                pl.spr = .9 : pl.gnd = false : pl.coy = 0 : pl.sv = -5
                sfx("spring")
                m.BUMPS.push({ c: c, r: r, t: 0.0 })
                spawn(pl.x, pl.y + pl.r, 8, "green", 200, .4, 900)
            else if tt = 60 then
                pl.x = pl.x - 110 * dt
            else if tt = 62 then
                pl.x = pl.x + 110 * dt
            else if tt = 102 then
                pl.boost = .7
                f = 1
                if pl.vx < 0 then f = -1
                if pl.vx = 0 then f = pl.face
                pl.vx = pl.vx + f * 1500 * dt
                pl.vx = clamp(pl.vx, -560, 560)
            end if
        end if
        if pl.cling > 0 and pl.wallRoll <> 0 and not pl.gnd then
            pl.ang = pl.ang + (-pl.vy * dt / pl.r * pl.wallRoll * 1.15)
        else if not crouch then
            if pl.gnd then
                pl.ang = pl.ang + pl.vx * dt / pl.r
            else
                pl.ang = pl.ang + pl.vx * dt / pl.r * .5
            end if
        end if
        if pl.cling <= 0 then pl.wallRoll = 0
        if not pl.gnd and pl.rel <= 0 then
            tip = [0.0, 0.0]
            for each ch in m.CHAINS
                if not ch.latched and pl.latch = invalid then
                    chainTip(ch, tip)
                    if hyp(pl.x - tip[0], pl.y - tip[1]) < 46 then latch(ch)
                end if
            end for
        end if
    end if

    if pw.magnet > 0 then
        for each co in m.COINS
            if not co.got then
                dx = pl.x - co.x : dy = pl.y - co.y
                d = hyp(dx, dy)
                if d < 190 and d > 1 then
                    co.x = co.x + dx / d * 480 * dt
                    co.y = co.y + dy / d * 480 * dt
                end if
            end if
        end for
    end if
    checkDoors()
    if pl.y > m.VH + 170 then
        die(true)
        return
    end if
    if not pl.dead and pw.spike <= 0 then
        c0 = Int((pl.x - pl.r) / ts) : c1 = Int((pl.x + pl.r) / ts)
        r0 = Int((pl.y - pl.r) / ts) : r1 = Int((pl.y + pl.r) / ts)
        for r = r0 to r1
            for c = c0 to c1
                if r >= 0 and r < m.ROWS and c >= 0 and c < lv.W then
                    if lv.g[r][c] = 94 then
                        sx0 = c * ts + 6 : sx1 = c * ts + ts - 6 : sy0 = r * ts + 16 : sy1 = r * ts + ts
                        if pl.x + pl.r * .6 > sx0 and pl.x - pl.r * .6 < sx1 and pl.y + pl.r * .7 > sy0 and pl.y - pl.r < sy1 then
                            sdir = Sgn(pl.x - (c * ts + ts / 2))
                            if sdir = 0 then sdir = 1
                            hurt(sdir)
                            if not pl.dead then pl.vy = -480
                        end if
                    end if
                end if
            end for
        end for
    end if
    for each co in m.COINS
        if not co.got and absf(pl.x - co.x) < pl.r + 13 and absf(pl.y - co.y) < pl.r + 13 then
            if hyp(pl.x - co.x, pl.y - co.y) < pl.r + 13 then
                co.got = true
                gs.coins = gs.coins + 1
                gs.cg = gs.cg + 1
                sfx("coin")
                addScore(10, invalid, 0)
                spawn(co.x, co.y, 5, "gold", 140, .35, 0)
                checkOneUp()
            end if
        end if
    end for
    for each cp in m.CHECKS
        if not cp.on and pl.x > cp.x then
            cp.on = true
            m.respawnX = cp.x : m.respawnY = cp.y
            sfx("flag")
            popup(cp.x, cp.y - 50, "CHECKPOINT", "cyan")
        end if
    end for
    updateItems(dt)
    updateEnemies(dt)
    if not pl.dead and pl.x > lv.goal * ts then
        bossDone = true
        if lv.boss then
            bossDone = false
            if m.BOSS <> invalid then bossDone = m.BOSS.dead
        end if
        if bossDone then levelClear()
    end if
    followCam(dt)
end sub

sub followCam(dt)
    pl = m.P
    lv = m.LV
    look = pl.vx * .28
    tx = clamp(pl.x - m.VW * .42 + look, 0, maxf(0, lv.W * m.T - m.VW))
    sp = 5
    if absf(pl.vx) > 500 then sp = 8
    m.camX = m.camX + (tx - m.camX) * minf(1, dt * sp)
end sub

sub levelClear()
    gs = m.G
    lv = m.LV
    gs.state = "clear"
    sfx("win")
    gs.bonus = gs.hp * 250
    gs.timeBonus = Int(maxf(0, (lv.par - gs.lt) * 20))
    gs.score = gs.score + gs.bonus + gs.timeBonus
    if gs.score > gs.best then gs.best = gs.score
    clearInput()
end sub

sub endGame()
    gs = m.G
    gs.state = "over"
    if gs.score > gs.best then gs.best = gs.score
    clearInput()
end sub
