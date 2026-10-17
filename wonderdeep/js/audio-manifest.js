// Drop your audio files into assets/audio/ and list them here. Anything left empty keeps the built-in synth sounds.
// Music loops per style. Voices are lists: one clip is picked at random each time that character speaks.
window.W = window.W || {};
W.AUDIO_MANIFEST = {
  music: { cave:'', boss:'', twist:'' },                       // e.g. cave:'assets/audio/music/crash-hollow.mp3'
  voice: { bit:[], hero:[], enemy:[], boss:[] },               // e.g. bit:['assets/audio/voice/bit-01.mp3', ...]
  sfx:   { /* jump:'assets/audio/sfx/jump.wav', hop:'', dash:'', pickup:'' ... */ },
};
