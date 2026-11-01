' main.brs - entry point, input and main loop

sub Main()
    m.port = CreateObject("roMessagePort")
    initConsts()
    initGfx()
    initAudio()
    initGame()
    m.quit = false

    timer = CreateObject("roTimespan")
    timer.Mark()
    last = 0

    while not m.quit
        msg = m.port.GetMessage()
        while msg <> invalid
            if type(msg) = "roUniversalControlEvent" then handleKey(msg.GetInt())
            msg = m.port.GetMessage()
        end while

        now = timer.TotalMilliseconds()
        dt = (now - last) / 1000
        last = now
        if dt > .033 then dt = .033
        if dt < .001 then dt = .001

        gs = m.G
        if gs.state = "play" then
            update(dt)
        else if gs.state = "title" or gs.state = "paused" then
            if gs.state = "title" then gs.t = gs.t + dt
        end if
        render()
        m.screen.SwapBuffers()
    end while
end sub

' Roku remote codes: press = code, release = code + 100
'  0 back, 2 up, 3 down, 4 left, 5 right, 6 OK, 13 play/pause
sub handleKey(code)
    if code >= 100 then
        setHeld(code - 100, false)
        return
    end if
    if code > 127 then return
    gs = m.G
    st = gs.state
    if st = "play" then
        if code = 0 then
            gs.state = "paused"
            clearInput()
            return
        end if
        setHeld(code, true)
    else if st = "title" then
        if code = 6 or code = 13 then
            startGame(0, true)
        else if code = 0 then
            m.quit = true
        end if
    else if st = "paused" then
        if code = 6 or code = 13 then
            gs.state = "play"
            clearInput()
        else if code = 0 then
            gs.state = "title"
            loadLevel(0)
            gs.state = "title"
            clearInput()
        end if
    else if st = "clear" or st = "over" then
        if code = 6 or code = 13 then
            startGame(0, true)
        else if code = 0 then
            loadLevel(0)
            gs.state = "title"
            clearInput()
        end if
    end if
end sub

sub setHeld(code, down)
    if code < 0 or code > 127 then return
    k = m.K
    wasJump = k.j
    m.held[code] = down
    k.l = m.held[4]
    k.r = m.held[5]
    k.d = m.held[3]
    k.j = m.held[6] or m.held[2] or m.held[13]
    if down then
        if k.j and not wasJump and (code = 6 or code = 2 or code = 13) then m.jEdge = true
        if code = 3 then m.dEdge = true
    end if
end sub
