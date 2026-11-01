' audio.brs - sound effects (short WAVs in pkg:/sounds, made by tools/gen_assets.py)

sub initAudio()
    m.snd = {}
    names = ["jump", "coin", "brk", "bump", "stomp", "hurt", "grab", "release", "die", "win", "flag", "boss", "spring", "dash", "pound", "power", "door", "bump2", "rev"]
    for each n in names
        r = CreateObject("roAudioResource", "pkg:/sounds/" + n + ".wav")
        if r <> invalid then m.snd[n] = r
    end for
end sub

sub sfx(n)
    if m.snd = invalid then return
    r = m.snd[n]
    if r <> invalid then r.Trigger(70)
end sub
