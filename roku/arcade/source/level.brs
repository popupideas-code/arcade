' level.brs - constants, level builder and level 1 (ported from rollabout/index.html)
' NOTE: BrightScript names are case-insensitive, so locals here avoid clashes like P/p, T/t, G/g.

sub initConsts()
    m.T = 40            ' tile size (world units)
    m.VH = 600          ' world height
    m.ROWS = 15
    m.SMASH = 270
    m.GRAV = 1800
    m.JV = 790
    m.MAXV = 320
    m.GC = 1400
    m.SC = 1.2          ' world -> screen scale (720 / 600)
    m.SW = 1280
    m.SH = 720
    m.VW = 1280 / 1.2   ' visible world width

    ' solid tile table, indexed by tile code (ASCII value of the web game's tile character)
    m.solid = []
    for i = 0 to 255
        m.solid.push(false)
    end for
    for each code in [35, 66, 63, 85, 88, 83, 77, 86, 117, 60, 62, 102, 68]
        m.solid[code] = true
    end for
end sub

' ---------- tile helpers ----------
function solidAt(c, r) as boolean
    lv = m.LV
    if c < 0 or c >= lv.W then return true
    if r < 0 or r >= m.ROWS then return false
    return m.solid[lv.g[r][c]]
end function

function hitt(tt) as boolean
    ' B ? S M V  (blocks the ball can hit)
    return tt = 66 or tt = 63 or tt = 83 or tt = 77 or tt = 86
end function

' ---------- builder ----------
function lvNew(name, w)
    g = []
    for r = 0 to m.ROWS - 1
        row = []
        for c = 0 to w - 1
            row.push(0)
        end for
        g.push(row)
    end for
    return { name: name, W: w, g: g, ents: [], chains: [], coins: [], checks: [], plats: [], items: [], par: 90, fast: false, startC: 2, startR: 11, goal: w - 8, boss: false, hasGems: false }
end function

sub lvPut(lv, c, r, code)
    if c >= 0 and c < lv.W and r >= 0 and r < m.ROWS then lv.g[r][c] = code
end sub

sub lvFill(lv, c0, c1, r0, r1, code)
    for r = r0 to r1
        for c = c0 to c1
            lvPut(lv, c, r, code)
        end for
    end for
end sub

sub lvGround(lv, c0, c1, top)
    lvFill(lv, c0, c1, top, m.ROWS - 1, 35)
end sub

sub lvRow(lv, c0, r, s)
    n = Len(s)
    for i = 0 to n - 1
        ch = Mid(s, i + 1, 1)
        if ch <> "_" then lvPut(lv, c0 + i, r, Asc(ch))
    end for
end sub

sub lvE(lv, t, c, r, o)
    e = { t: t, x: c * m.T + m.T / 2, y: r * m.T + m.T / 2 }
    if o <> invalid then
        for each k in o
            e[k] = o[k]
        end for
    end if
    lv.ents.push(e)
end sub

sub lvCoins(lv, c0, c1, r)
    for c = c0 to c1
        lv.coins.push({ x: c * m.T + m.T / 2, y: r * m.T + m.T / 2 })
    end for
end sub

sub lvItem(lv, kind, c, r, id)
    lv.items.push({ kind: kind, x: c * m.T + m.T / 2, y: r * m.T + m.T / 2, id: id })
    if kind = "gem" then lv.hasGems = true
end sub

sub lvChain(lv, c, r, ln)
    lv.chains.push({ ax: c * m.T + m.T / 2, ay: r * m.T + m.T / 2, L: ln })
end sub

sub lvPlat(lv, c, r, w, axis, rng, spd)
    lv.plats.push({ cx: c * m.T, y0: r * m.T, w: w * m.T, axis: axis, range: rng, spd: spd, ph: Rnd(0) * 6 })
end sub

sub lvCheck(lv, c, r)
    lv.checks.push({ x: c * m.T + m.T / 2, y: r * m.T + m.T / 2 })
end sub

' ---------- level 1 : MEADOW ROLL ----------
function buildLevel(index)
    lv = lvNew("1 - MEADOW ROLL", 150)
    lv.par = 80
    lvItem(lv, "gem", 47, 1, 0)
    lvItem(lv, "gem", 93, 8, 1)
    lvItem(lv, "gem", 120, 1, 2)

    lvGround(lv, 0, 28, 12)
    lvRow(lv, 12, 9, "B?BMB")
    lvCoins(lv, 6, 9, 10)
    lvCoins(lv, 13, 15, 6)
    lvE(lv, "blob", 22, 11, invalid)
    lvRow(lv, 16, 12, ">>>>")

    lvGround(lv, 33, 58, 12)
    lvRow(lv, 38, 9, "BB?BB")
    lvCoins(lv, 39, 41, 7)
    lvE(lv, "blob", 36, 11, invalid)
    lvE(lv, "wasp", 50, 8, invalid)
    lvCheck(lv, 52, 11)

    lvPut(lv, 45, 11, 117)
    lvFill(lv, 46, 48, 5, 5, 88)
    lvItem(lv, "key", 47, 4, -1)
    lvCoins(lv, 43, 49, 2)

    lvChain(lv, 64, 4, 190)
    lvCoins(lv, 61, 67, 9)

    lvGround(lv, 69, 79, 12)
    lvRow(lv, 72, 9, "V")
    lvPut(lv, 76, 11, 94)
    lvPut(lv, 77, 11, 94)
    lvPut(lv, 70, 11, 88)
    lvPut(lv, 71, 11, 88)
    lvPut(lv, 71, 10, 88)
    lvE(lv, "blob", 74, 11, invalid)
    lvRow(lv, 73, 12, "fff")

    lvGround(lv, 80, 95, 10)
    lvE(lv, "spider", 86, 5, { len: 150 })
    lvE(lv, "dragon", 92, 4, invalid)
    lvCoins(lv, 83, 88, 8)
    lvCheck(lv, 88, 9)
    lvFill(lv, 90, 94, 7, 9, 88)
    lvFill(lv, 91, 93, 8, 9, 0)
    lvPut(lv, 90, 8, 68)
    lvPut(lv, 90, 9, 68)
    lvCoins(lv, 91, 93, 9)
    lvRow(lv, 92, 8, "S")

    lvPlat(lv, 100.5, 10, 3, "x", 90, 1.0)

    lvGround(lv, 105, 149, 10)
    lvCheck(lv, 106, 9)
    lvRow(lv, 106, 7, "BSB?B")
    lvCoins(lv, 105, 112, 8)
    lvE(lv, "blob", 108, 9, invalid)
    lvE(lv, "blob", 116, 9, invalid)
    lvE(lv, "wasp", 112, 6, invalid)

    lvFill(lv, 114, 114, 8, 9, 88)
    lvRow(lv, 110, 5, "XXXXX")
    lvFill(lv, 120, 121, 3, 7, 88)
    lvCoins(lv, 119, 122, 2)
    lvE(lv, "wasp", 124, 6, invalid)
    lvE(lv, "spiky", 125, 9, invalid)
    lvCheck(lv, 127, 9)
    lvFill(lv, 147, 149, 0, 9, 88)
    lvE(lv, "boss", 138, 9, { b0: 128, b1: 146 })
    lv.boss = true
    lv.goal = 143
    return lv
end function

' ---------- entities ----------
function initEnt(o)
    e = {}
    for each k in o
        e[k] = o[k]
    end for
    e.dead = false
    e.vy = 0
    e.vx = 0
    e.ph = Rnd(0) * 6.28
    e.x0 = o.x
    e.y0 = o.y
    e.dir = 1
    e.sp = 0
    e.r = 14
    e.boss = false
    e.inv = 0
    e.st = 0
    e.tm = 0
    t = o.t
    if t = "blob" then
        e.r = 15 : e.dir = -1 : e.sp = 70
    else if t = "spiky" then
        e.r = 16 : e.dir = -1 : e.sp = 95
    else if t = "wasp" then
        e.r = 14
    else if t = "dragon" then
        e.r = 14 : e.cool = 1.5 + Rnd(0) : e.tx = 0 : e.ty = 0
    else if t = "spider" then
        e.r = 14
        if o.len = invalid then e.len = 150
    else if t = "boss" then
        e.r = 30 : e.hp = 3 : e.boss = true : e.dir = -1 : e.sp = 80
        e.cdir = -1
        e.cx = (o.b0 + o.b1) / 2 * m.T
        e.xmin = o.b0 * m.T + 34
        e.xmax = o.b1 * m.T
    end if
    return e
end function
