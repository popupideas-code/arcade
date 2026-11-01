#!/usr/bin/env python3
"""Generates every PNG, WAV and sprites.json for the Roku port of Rollabout.

Run from anywhere:  python3 roku/rollabout/tools/gen_assets.py
Coordinates in the drawing code are the web game's world units (tile = 40);
SC converts them to Roku screen pixels (1280x720 shows the 600-unit-high world at 1.2x).
"""
import json, math, os, random, struct, wave
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
IMG = os.path.join(ROOT, "images")
SND = os.path.join(ROOT, "sounds")
os.makedirs(IMG, exist_ok=True)
os.makedirs(SND, exist_ok=True)

SC = 1.2
SS = 4          # supersampling factor
SPRITES = {}    # name -> {w,h,ax,ay,rot}

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(a))


def rgba(h, a):
    return hexc(h, int(a * 255))


class Cv:
    """Canvas whose drawing coordinates are world units relative to an anchor point.
    The anchor sits at pixel (ax, ay) inside the w x h bitmap."""

    def __init__(self, w, h, ax=None, ay=None):
        self.w, self.h = w, h
        self.ax = w / 2 if ax is None else ax
        self.ay = h / 2 if ay is None else ay
        self.im = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
        self.gl = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.gd = ImageDraw.Draw(self.gl)

    def P(self, x, y):
        return ((self.ax + x * SC) * SS, (self.ay + y * SC) * SS)

    def pts(self, pts):
        return [self.P(x, y) for x, y in pts]

    def lw(self, w):
        return max(1, int(round(w * SC * SS)))

    # --- primitives -------------------------------------------------
    def _paint(self, fn):
        """PIL draw calls overwrite pixels (no blending), so draw on a scratch layer and composite."""
        layer = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
        fn(ImageDraw.Draw(layer))
        self.im = Image.alpha_composite(self.im, layer)

    def line(self, pts, color, width=1.5, glow=False, closed=False):
        p = self.pts(pts + ([pts[0]] if closed else []))
        lw = self.lw(width)
        self._paint(lambda d: d.line(p, fill=color, width=lw, joint="curve"))
        if glow:
            self.gd.line(p, fill=color, width=self.lw(width * 2.2), joint="curve")

    def poly(self, pts, fill=None, outline=None, width=1.5, glow=False):
        p = self.pts(pts)
        if fill:
            self._paint(lambda d: d.polygon(p, fill=fill))
        if outline:
            self.line(pts, outline, width, glow, closed=True)

    def ell(self, cx, cy, rx, ry, fill=None, outline=None, width=1.5, glow=False, rot=0.0):
        n = 48
        pts = []
        for i in range(n):
            a = i / n * math.tau
            x, y = math.cos(a) * rx, math.sin(a) * ry
            pts.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
        self.poly(pts, fill, outline, width, glow)

    def arc(self, cx, cy, r, a0, a1, color, width=1.5, glow=False):
        n = 24
        pts = [(cx + math.cos(a0 + (a1 - a0) * i / n) * r, cy + math.sin(a0 + (a1 - a0) * i / n) * r) for i in range(n + 1)]
        self.line(pts, color, width, glow)

    def rect(self, x0, y0, x1, y1, fill=None, outline=None, width=1.5, glow=False):
        self.poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], fill, outline, width, glow)

    def quad(self, p0, c, p1, n=14):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in [i / n for i in range(n + 1)]]

    def text(self, s, x, y, size, color):
        f = ImageFont.truetype(FONT_BOLD, int(size * SC * SS))
        px, py = self.P(x, y)
        self._paint(lambda d: d.text((px, py), s, font=f, fill=color, anchor="mm"))

    # --- output -----------------------------------------------------
    def _compose(self, glow_blur=2.4):
        gl = self.gl.filter(ImageFilter.GaussianBlur(glow_blur * SS))
        a = gl.getchannel("A").point(lambda v: min(255, int(v * 1.6)))
        gl.putalpha(a)
        return Image.alpha_composite(gl, self.im)

    def save(self, name, rot=False, glow_blur=2.4):
        out = self._compose(glow_blur).resize((self.w, self.h), Image.LANCZOS)
        out.save(os.path.join(IMG, name + ".png"))
        SPRITES[name] = {"w": self.w, "h": self.h, "ax": int(round(self.ax)), "ay": int(round(self.ay))}

    def save_frames(self, name, n=36):
        """Pre-rotated frames name_0..name_{n-1}; frame i is rotated i*360/n degrees CLOCKWISE
        about the canvas centre. (Avoids DrawRotatedObject, which is slow and 90-degree-only on old Rokus.)"""
        full = self._compose()
        for i in range(n):
            r = full.rotate(-i * 360.0 / n, resample=Image.BICUBIC).resize((self.w, self.h), Image.LANCZOS)
            r.save(os.path.join(IMG, "%s_%d.png" % (name, i)))
            SPRITES["%s_%d" % (name, i)] = {"w": self.w, "h": self.h, "ax": int(round(self.w / 2)), "ay": int(round(self.h / 2))}


def grad_fill(cv, cx, cy, r, c0, c1, hx=-0.35, hy=-0.4):
    """Fake radial gradient with concentric discs."""
    steps = 18
    for i in range(steps):
        t = i / (steps - 1)
        rr = r * (1 - t * 0.85)
        col = tuple(int(c1[k] + (c0[k] - c1[k]) * t) for k in range(3)) + (255,)
        cv.ell(cx + hx * r * t * 0.9, cy + hy * r * t * 0.9, rr, rr, fill=col)


# ============================== TILES ===============================
T = 40
TP = int(round(T * SC))  # 48
THEME = dict(f="#0c2142", s="#071428", e="#27f0ff", top="#0f3a5c", lip="#7dff9a")


def tile_cv():
    return Cv(TP, TP, 0, 0)


def inset_box(cv, fill, edge, w=2.0):
    cv.rect(0, 0, T, T, fill=hexc(fill))
    cv.rect(1.5, 1.5, T - 1.5, T - 1.5, outline=hexc(edge), width=w)


def icon_spike(cv, cx, cy, s):
    for i in range(8):
        a = i * math.pi / 4
        cv.poly([(cx + math.cos(a - .28) * 7 * s, cy + math.sin(a - .28) * 7 * s),
                 (cx + math.cos(a) * 14 * s, cy + math.sin(a) * 14 * s),
                 (cx + math.cos(a + .28) * 7 * s, cy + math.sin(a + .28) * 7 * s)], fill=hexc("#ff6a4a"))
    cv.ell(cx, cy, 7 * s, 7 * s, fill=hexc("#7a1018"), outline=hexc("#ffb09a"), width=1.6)


def icon_magnet(cv, cx, cy, s):
    cv.arc(cx, cy + 1 * s, 9 * s, math.pi, math.tau, hexc("#27f0ff"), 5 * s)
    cv.line([(cx + 9 * s, cy + 1 * s), (cx + 9 * s, cy + 10 * s)], hexc("#27f0ff"), 5 * s)
    cv.line([(cx - 9 * s, cy + 1 * s), (cx - 9 * s, cy + 10 * s)], hexc("#27f0ff"), 5 * s)
    cv.line([(cx - 9 * s, cy + 6 * s), (cx - 9 * s, cy + 12 * s)], hexc("#ff4a3d"), 5 * s)
    cv.line([(cx + 9 * s, cy + 6 * s), (cx + 9 * s, cy + 12 * s)], hexc("#ff4a3d"), 5 * s)


def icon_speed(cv, cx, cy, s):
    pts = [(2, -14), (-8, 3), (-1, 3), (-4, 14), (9, -4), (1, -4)]
    cv.poly([(cx + x * s, cy + y * s) for x, y in pts], fill=hexc("#d6ff3a"), outline=hexc("#ffffff"), width=1.2)


def icon_key(cv, cx, cy, s):
    col = hexc("#ffc23a")
    cv.line([(cx - 2 * s, cy), (cx + 12 * s, cy + 12 * s)], col, 3)
    cv.line([(cx + 7 * s, cy + 7 * s), (cx + 11 * s, cy + 3 * s)], col, 3)
    cv.line([(cx + 10 * s, cy + 10 * s), (cx + 14 * s, cy + 6 * s)], col, 3)
    cv.ell(cx - 6 * s, cy - 4 * s, 6 * s, 6 * s, outline=col, width=3)


def make_tiles():
    f, s_, e, top, lip = (THEME[k] for k in ("f", "s", "e", "top", "lip"))
    # ground
    for name, exposed in (("wall_top", True), ("wall_in", False)):
        cv = tile_cv()
        cv.rect(0, 0, T, T, fill=hexc(f))
        cv.rect(0.5, 0.5, T - 0.5, T - 0.5, outline=rgba(e, .9 if exposed else .35), width=1)
        if exposed:
            cv.line([(0, 1), (T, 1)], hexc(lip), 2.4, glow=True)
        cv.save(name)
    # slopes
    for name, tri in (("slope_r", [(0, T), (T, T), (T, 0)]), ("slope_l", [(0, 0), (0, T), (T, T)])):
        cv = tile_cv()
        cv.poly(tri, fill=hexc(f), outline=rgba(e, .8), width=1.2)
        a, b = ((0, T), (T, 0)) if name == "slope_r" else ((0, 0), (T, T))
        cv.line([a, b], hexc(lip), 2.4, glow=True)
        cv.save(name)
    # brick
    cv = tile_cv(); inset_box(cv, "#3b0e30", "#ff2fa6")
    for seg in ([(2, 20), (38, 20)], [(20, 2), (20, 20)], [(10, 20), (10, 38)], [(30, 20), (30, 38)]):
        cv.line(seg, hexc("#ff2fa6"), 1.2)
    cv.save("brick")
    # ? block
    cv = tile_cv(); inset_box(cv, "#3a2a06", "#ffc23a"); cv.text("?", 20, 21, 26, hexc("#ffc23a")); cv.save("qblock")
    # used
    cv = tile_cv(); inset_box(cv, "#1a1730", "#4b5688"); cv.save("used")
    # steel
    cv = tile_cv(); inset_box(cv, "#1b2640", "#b6c4f0")
    cv.line([(5, 5), (35, 35)], hexc("#b6c4f0"), 1.2); cv.line([(35, 5), (5, 35)], hexc("#b6c4f0"), 1.2)
    for rx, ry in ((6, 6), (34, 6), (6, 34), (34, 34)):
        cv.ell(rx, ry, 2, 2, fill=hexc("#b6c4f0"))
    cv.save("steel")
    # power blocks
    for name, fill, edge, icon in (("pblock_spike", "#3a0f12", "#ff6a4a", icon_spike),
                                   ("pblock_magnet", "#06303a", "#27f0ff", icon_magnet),
                                   ("pblock_speed", "#2f3a06", "#d6ff3a", icon_speed)):
        cv = tile_cv(); inset_box(cv, fill, edge); icon(cv, 20, 20, .95); cv.save(name)
    # spring
    cv = tile_cv(); inset_box(cv, "#10243a", "#7dff9a")
    zz = [(8, 36)]
    for i in range(5):
        zz.append((32, 36 - 22 * (i + .5) / 5)); zz.append((8, 36 - 22 * (i + 1) / 5))
    cv.line(zz, hexc("#7dff9a"), 2.4)
    cv.rect(4, 8, 36, 13, fill=hexc("#7dff9a"))
    cv.save("spring")
    # conveyors
    for name, d in (("conv_l", -1), ("conv_r", 1)):
        cv = tile_cv(); inset_box(cv, "#14283f", "#ffc23a")
        for i in range(-1, 4):
            cx = i * 14 + 7
            cv.line([(cx - d * 4, 10), (cx + d * 2, 16), (cx - d * 4, 22)], hexc("#ffc23a"), 2)
        cv.save(name)
    # speed pad
    cv = tile_cv(); inset_box(cv, "#2a2a08", "#ffe66b")
    for i in range(2):
        cx = 10 + i * 14
        cv.line([(cx, 8), (cx + 8, 20), (cx, 32)], hexc("#ffe66b"), 3)
    cv.save("fastpad")
    # door
    cv = tile_cv(); inset_box(cv, "#3a2a06", "#ffc23a")
    cv.ell(20, 17, 5, 5, fill=hexc("#ffc23a")); cv.rect(18, 20, 22, 30, fill=hexc("#ffc23a"))
    cv.save("door")
    # spikes
    cv = tile_cv()
    for i in range(3):
        bx = i * T / 3
        cv.poly([(bx + 1, T), (bx + T / 6, 14), (bx + T / 3 - 1, T)], fill=hexc("#2a0a14"), outline=hexc("#ff4a3d"), width=1.8)
    cv.save("spikes")


# ============================== ACTORS ===============================
def ball_sprite(spikes):
    size = 76 if spikes else 52
    cv = Cv(size, size)
    r = 15
    if spikes:
        for i in range(12):
            a = i * math.tau / 12
            cv.poly([(math.cos(a - .2) * (r - 1), math.sin(a - .2) * (r - 1)),
                     (math.cos(a) * (r + 11), math.sin(a) * (r + 11)),
                     (math.cos(a + .2) * (r - 1), math.sin(a + .2) * (r - 1))],
                    fill=hexc("#ffd0c0"), outline=hexc("#ff6a4a"), width=1.4)
    grad_fill(cv, 0, 0, r, (255, 138, 122), (163, 20, 31))
    # stripes (3 rotated ellipses clipped to the ball)
    layer = Cv(size, size)
    for k in range(3):
        layer.ell(0, 0, r, r * .4, outline=rgba("#ffebe6", .8), width=1.4, rot=k * math.pi / 3)
    mask = Image.new("L", cv.im.size, 0)
    ImageDraw.Draw(mask).ellipse([cv.P(-(r - 1), -(r - 1)), cv.P(r - 1, r - 1)], fill=255)
    stripes = Image.composite(layer.im, Image.new("RGBA", cv.im.size, (0, 0, 0, 0)), mask)
    cv.im = Image.alpha_composite(cv.im, stripes)
    cv.d = ImageDraw.Draw(cv.im)
    cv.ell(0, 0, r, r, outline=hexc("#ff4a3d"), width=2, glow=True)
    cv.ell(r * .62, 0, 2.6, 2.6, fill=hexc("#ffffff"))
    cv.save_frames("ball_spiked" if spikes else "ball", 36)


def ball_highlight():
    cv = Cv(16, 16)
    cv.ell(0, 0, 3.2, 3.2, fill=rgba("#ffffff", .45))
    cv.save("ball_hi")


def legs(cv, n, ln, phase, y0, color, width):
    for i in range(n):
        s = -1 if i < n / 2 else 1
        k = (i % (n // 2)) / ((n // 2) - 1 or 1) - .5
        sw = math.sin(phase + i * 1.7) * 3
        cv.line([(k * 14, y0), (k * 20 + s * ln * .7 + sw, y0 + ln * .7), (k * 24 + s * ln + sw, y0 + ln)], color, width)


def blob(scale, frame, boss, left):
    w, h = (176, 156) if boss else (72, 62)
    cv = Cv(w, h)
    k = scale
    legs_phase = 0.0 if frame == 0 else 2.2

    def sx(pts):
        return [(x * k, y * k) for x, y in pts]
    # legs
    for i in range(6):
        s = -1 if i < 3 else 1
        kk = (i % 3) / 2 - .5
        sw = math.sin(legs_phase + i * 1.7) * 3
        cv.line(sx([(kk * 14, 6), (kk * 20 + s * 9 * .7 + sw, 6 + 9 * .7), (kk * 24 + s * 9 + sw, 6 + 9)]), hexc("#7dff9a"), 2.8 * k)
    body = cv.quad((-17, 7), (-16, -15), (2, -15)) + cv.quad((2, -15), (17, -14), (17, 7))[1:]
    cv.poly(sx(body), fill=hexc("#1c6b3a"), outline=hexc("#7dff9a"), width=2.4 * k, glow=True)
    for x0, y0 in ((1, -15), (-9, -9), (10, -9)):
        cv.line(sx([(x0, y0), (x0, 7)]), hexc("#7dff9a"), 1 * k)
    cv.arc(-3 * k, -5 * k, 10 * k, 3.6, 4.7, rgba("#ffffff", .55), 2 * k)
    cv.ell(13 * k, -1 * k, 3.4 * k, 3.4 * k, fill=hexc("#ff4a3d"))
    cv.line(sx(cv.quad((15, -5), (22, -14), (26, -12))), hexc("#7dff9a"), 1.5 * k)
    if boss:
        cv.poly(sx([(13, -9), (26, -22), (19, -3)]), fill=hexc("#ffc23a"))
        cv.line(sx([(-6, -15), (-2, -24), (3, -15)]), hexc("#ffc23a"), 1.6 * k)
    name = ("boss" if boss else "blob") + ("_l" if left else "_r") + str(frame)
    if left:
        cv.im = cv.im.transpose(Image.FLIP_LEFT_RIGHT)
        cv.gl = cv.gl.transpose(Image.FLIP_LEFT_RIGHT)
        cv.ax = cv.w - cv.ax
    cv.save(name)


def wasp(frame, left):
    cv = Cv(72, 56)
    fl = .4 if frame == 0 else -.4
    cv.ell(-3, -13, 12, 5, fill=rgba("#27f0ff", .34), outline=hexc("#27f0ff"), width=1.4, glow=True, rot=-.5 + fl)
    cv.ell(-8, -12, 11, 4, fill=rgba("#27f0ff", .34), outline=hexc("#27f0ff"), width=1.4, glow=True, rot=-.1 - fl)
    cv.ell(0, 0, 14, 10, fill=hexc("#d99a12"), outline=hexc("#ffc23a"), width=2.4, glow=True)
    for x in (-5, 2, 8):
        cv.line([(x, -9), (x, 9)], hexc("#2a1a00"), 4)
    cv.line([(-13, 0), (-22, 0), (-13, 3)], hexc("#ff4a3d"), 1.8)
    cv.ell(10, -2, 2.6, 2.6, fill=hexc("#ffffff"))
    name = "wasp_" + ("l" if left else "r") + str(frame)
    if left:
        cv.im = cv.im.transpose(Image.FLIP_LEFT_RIGHT); cv.gl = cv.gl.transpose(Image.FLIP_LEFT_RIGHT)
    cv.save(name)


def spiky():
    cv = Cv(64, 64)
    for i in range(10):
        a = i / 10 * math.tau
        cv.line([(math.cos(a) * 13, math.sin(a) * 13), (math.cos(a) * 21, math.sin(a) * 21)], hexc("#ff4a3d"), 2.2)
    cv.ell(0, 0, 13, 13, fill=hexc("#5a1038"), outline=hexc("#ff2fa6"), width=2.4, glow=True)
    cv.arc(0, 0, 7, .6, 3.8, hexc("#ff2fa6"), 1.4)
    cv.save_frames("spiky", 36)


def spider(frame):
    cv = Cv(48, 48)
    legs(cv, 8, 13, 0.0 if frame == 0 else 2.2, 0, hexc("#ff2fa6"), 1.8)
    cv.ell(0, 2, 10, 10, fill=hexc("#7a1456"), outline=hexc("#ff2fa6"), width=2.4, glow=True)
    cv.ell(-4, -1, 2.4, 2.4, fill=hexc("#ffffff")); cv.ell(4, -1, 2.4, 2.4, fill=hexc("#ffffff"))
    cv.save("spider%d" % frame)


def dragon(frame, left):
    cv = Cv(64, 40)
    fl = .35 if frame == 0 else -.35
    for wx, wr in ((-4, -.25), (5, .15)):
        cv.ell(wx, -11, 13, 3.6, fill=rgba("#27f0ff", .32), outline=hexc("#27f0ff"), width=1.2, glow=True, rot=wr + fl)
    cv.line([(-22, 2), (8, 0)], hexc("#9b8bff"), 5)
    cv.ell(12, 0, 6.5, 6.5, fill=hexc("#4a3bb0"), outline=hexc("#9b8bff"), width=2.2, glow=True)
    cv.ell(14, -1, 2.4, 2.4, fill=hexc("#ff4a3d"))
    name = "dragon_" + ("l" if left else "r") + str(frame)
    if left:
        cv.im = cv.im.transpose(Image.FLIP_LEFT_RIGHT); cv.gl = cv.gl.transpose(Image.FLIP_LEFT_RIGHT)
    cv.save(name)


def coins():
    for i, rx in enumerate((1.5, 4.5, 7.5, 10.5)):
        cv = Cv(30, 34)
        cv.ell(0, 0, rx, 10, fill=rgba("#ffc23a", .22), outline=hexc("#ffc23a"), width=2, glow=True)
        cv.save("coin%d" % i)


def gems():
    for i, sq in enumerate((.55, .7, .85, 1.0)):
        cv = Cv(40, 44)
        s = 13
        cv.poly([(0, -s), (s * sq, -2), (0, s), (-s * sq, -2)], fill=rgba("#9b8bff", .35), outline=hexc("#cbbcff"), width=2.2, glow=True)
        cv.line([(-s * sq, -2), (s * sq, -2)], rgba("#ffffff", .6), 1)
        cv.line([(0, -s), (0, s)], rgba("#ffffff", .6), 1)
        cv.save("gem%d" % i)
    # small HUD gems (empty / full)
    for name, filled in (("hud_gem_off", False), ("hud_gem_on", True)):
        cv = Cv(24, 24)
        cv.poly([(0, -8), (6, 0), (0, 8), (-6, 0)], fill=rgba("#9b8bff", .55) if filled else None,
                outline=hexc("#cbbcff") if filled else hexc("#34406e"), width=1.6)
        cv.save(name)


def items():
    for name, col, icon in (("item_spike", "#ff6a4a", icon_spike), ("item_magnet", "#27f0ff", icon_magnet), ("item_speed", "#d6ff3a", icon_speed), ("item_key", "#ffc23a", icon_key)):
        cv = Cv(48, 48)
        cv.ell(0, 0, 18, 18, fill=rgba("#0a0622", .82), outline=hexc(col), width=2.2, glow=True)
        icon(cv, 0, 0, .78)
        cv.save(name)
    cv = Cv(40, 40)
    cv.line([(-2, 0), (12, 12)], hexc("#ffc23a"), 3); cv.line([(7, 7), (11, 3)], hexc("#ffc23a"), 3); cv.line([(10, 10), (14, 6)], hexc("#ffc23a"), 3)
    cv.ell(-6, -4, 6, 6, outline=hexc("#ffc23a"), width=3)
    cv.save("key")


def hud():
    cv = Cv(24, 24)
    cv.ell(0, 0, 7, 7, fill=rgba("#ff4a3d", .35), outline=hexc("#ff4a3d"), width=1.6)
    cv.save("hud_life")
    for name, on in (("hud_hp_on", True), ("hud_hp_off", False)):
        cv = Cv(24, 24)
        cv.poly([(0, -7), (7, 0), (0, 7), (-7, 0)], fill=rgba("#27f0ff", .4) if on else None,
                outline=hexc("#27f0ff") if on else hexc("#34406e"), width=1.6)
        cv.save(name)


def world_bits():
    cv = Cv(44, 44)
    cv.rect(-12, -16, 12, 0, fill=hexc("#16103a"), outline=hexc("#9b3dff"), width=2)
    cv.ell(0, 0, 5, 5, outline=hexc("#27f0ff"), width=2, glow=True)
    cv.save("anchor")
    cv = Cv(40, 40)
    cv.ell(0, 0, 12, 12, fill=rgba("#ffc23a", .18), outline=hexc("#ffc23a"), width=2.4, glow=True)
    cv.ell(0, 0, 4, 4, fill=hexc("#ffc23a"))
    cv.save("chain_tip")
    # checkpoints (anchor at the pole base)
    for name, ext, col, fa in (("flag_off", 14, "#4b5688", .4), ("flag_on", 26, "#7dff9a", .35)):
        cv = Cv(64, 130, 14, 100)
        cv.line([(0, 20), (0, -40)], hexc(col), 2.4)
        cv.poly([(0, -40), (ext, -32), (0, -22)], fill=rgba(col, fa), outline=hexc(col), width=1.6, glow=True)
        cv.save(name)


# ============================== BACKGROUND ===============================
def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def background():
    W, H = 1280, 720
    stops = [(0, hexc("#08051f")), (.5, hexc("#25093f")), (.78, hexc("#7a1766")), (1, hexc("#ff4f77"))]
    im = Image.new("RGBA", (W, H))
    px = im.load()
    for y in range(H):
        t = y / (H - 1)
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                u = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])
                col = lerp(stops[i][1], stops[i + 1][1], u) + (255,)
                break
        for x in range(W):
            px[x, y] = col
    # sun
    sx, sy, sr = int(W * .72), int(H * .5), int(min(W, H) * .16)
    big = Image.new("RGBA", (W * 2, H * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    for yy in range(sy * 2 - sr * 2, sy * 2 + sr * 2):
        t = (yy - (sy * 2 - sr * 2)) / (sr * 4)
        col = lerp(hexc("#ffe66b"), hexc("#ff2fa6"), t) + (255,)
        half = math.sqrt(max(0, (sr * 2) ** 2 - (yy - sy * 2) ** 2))
        d.line([(sx * 2 - half, yy), (sx * 2 + half, yy)], fill=col)
    dk = hexc("#1a0733")
    for i in range(6):
        y = sy + sr * (.05 + i * .17)
        d.rectangle([(sx - sr) * 2, y * 2, (sx + sr) * 2, (y + 2 + i * 1.6) * 2], fill=dk)
    # the stripes are cut-outs drawn in the ridge colour over the sun only
    sun = big.resize((W, H), Image.LANCZOS)
    mask = Image.new("L", (W * 2, H * 2), 0)
    ImageDraw.Draw(mask).ellipse([(sx - sr) * 2, (sy - sr) * 2, (sx + sr) * 2, (sy + sr) * 2], fill=255)
    mask = mask.resize((W, H), Image.LANCZOS)
    im = Image.composite(sun, im, mask)
    # stars
    rnd = random.Random(7)
    d = ImageDraw.Draw(im, "RGBA")
    for _ in range(70):
        x, y, s = rnd.random() * W, rnd.random() * H * .55, rnd.random() * 1.4 + .4
        d.rectangle([x, y, x + s * 1.2, y + s * 1.2], fill=(255, 255, 255, 140))
    im.convert("RGB").save(os.path.join(IMG, "bg_sky.jpg"), quality=92)

    def ridge(name, base, amp, seed, fill, edge, ns):
        PW = 1280
        top = int(base - amp * 1.9)
        hh = H - top
        r = Image.new("RGBA", (PW * 2, hh * 2), (0, 0, 0, 0))
        dr = ImageDraw.Draw(r)
        pts = []
        for x in range(0, PW + 8, 4):
            y = base - (math.sin(x * math.tau * ns[0] / PW + seed) + math.sin(x * math.tau * ns[1] / PW + seed * 2) * .55 + math.sin(x * math.tau * ns[2] / PW + seed * 3) * .2) * amp
            pts.append((x * 2, (y - top) * 2))
        dr.polygon(pts + [(PW * 2 + 16, hh * 2), (0, hh * 2)], fill=hexc(fill))
        dr.line(pts, fill=hexc(edge), width=3)
        r = r.resize((PW, hh), Image.LANCZOS)
        r.save(os.path.join(IMG, name + ".png"))
        SPRITES[name] = {"w": PW, "h": hh, "ax": 0, "ay": 0, "top": top}
    ridge("ridge_a", H * .78, H * .10, 1.3, "#1a0733", "#9b3dff", (1, 3, 5))
    ridge("ridge_b", H * .90, H * .09, 4.1, "#10052a", "#27f0ff", (2, 5, 8))


def icons():
    src = os.path.join(os.path.dirname(os.path.dirname(ROOT)), "rollabout", "thumb.png")
    if not os.path.exists(src):
        return
    im = Image.open(src).convert("RGB")
    def fit(w, h):
        r = max(w / im.width, h / im.height)
        t = im.resize((int(im.width * r) + 1, int(im.height * r) + 1), Image.LANCZOS)
        l, tp = (t.width - w) // 2, (t.height - h) // 2
        return t.crop((l, tp, l + w, tp + h))
    fit(540, 405).save(os.path.join(IMG, "icon_hd.png"))
    fit(246, 140).save(os.path.join(IMG, "icon_sd.png"))
    fit(1280, 720).save(os.path.join(IMG, "splash_hd.jpg"), quality=90)


# ============================== SOUND ===============================
RATE = 22050


def tone(f, d, kind="square", vol=.3, slide=0.0, delay=0.0):
    n = int(RATE * (d + delay))
    out = [0.0] * n
    start = int(RATE * delay)
    phase = 0.0
    for i in range(start, n):
        t = (i - start) / RATE
        fr = max(30.0, f + slide * (t / d)) if slide else f
        phase += fr / RATE
        ph = phase % 1.0
        if kind == "square":
            v = 1.0 if ph < .5 else -1.0
        elif kind == "sawtooth":
            v = 2 * ph - 1
        elif kind == "triangle":
            v = 4 * abs(ph - .5) - 1
        else:
            v = math.sin(ph * math.tau)
        env = math.exp(-5.5 * t / d) if t < d else 0.0
        out[i] = v * env * vol
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    out = [0.0] * n
    for p in parts:
        for i, v in enumerate(p):
            out[i] += v
    return out


def write_wav(name, samples):
    with wave.open(os.path.join(SND, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32000)) for s in samples))


def sounds():
    write_wav("jump", tone(280, .16, "square", .3, 380))
    write_wav("coin", mix(tone(988, .07, "square", .3), tone(1319, .2, "square", .3, 0, .07)))
    write_wav("brk", mix(tone(170, .22, "sawtooth", .4, -110), tone(95, .25, "square", .3, -40)))
    write_wav("bump", tone(120, .1, "square", .4, -40))
    write_wav("stomp", tone(220, .12, "square", .4, -130))
    write_wav("hurt", tone(320, .35, "sawtooth", .4, -250))
    write_wav("grab", tone(520, .09, "triangle", .5, 320))
    write_wav("release", tone(720, .15, "triangle", .4, -320))
    write_wav("die", mix(*[tone(f, .2, "square", .3, 0, i * .14) for i, f in enumerate((440, 370, 311, 220))]))
    write_wav("win", mix(*[tone(f, .16, "square", .3, 0, i * .1) for i, f in enumerate((523, 659, 784, 1047))]))
    write_wav("flag", mix(tone(660, .1, "triangle", .4), tone(990, .18, "triangle", .4, 0, .1)))
    write_wav("boss", tone(110, .3, "sawtooth", .5, -50))
    write_wav("spring", tone(260, .25, "sine", .5, 700))
    write_wav("dash", mix(tone(120, .35, "sawtooth", .5, 800), tone(600, .2, "square", .25, 300)))
    write_wav("pound", mix(tone(90, .25, "sawtooth", .6, -50), tone(60, .3, "square", .45, -20)))
    write_wav("power", mix(*[tone(f, .1, "triangle", .4, 0, i * .06) for i, f in enumerate((392, 523, 659, 784))]))
    write_wav("door", mix(tone(200, .15, "square", .4, 200), tone(500, .2, "triangle", .4, 0, .1)))
    write_wav("bump2", tone(420, .12, "triangle", .5, 500))
    write_wav("rev", tone(260, .12, "sawtooth", .4, 160))


if __name__ == "__main__":
    make_tiles()
    ball_sprite(False); ball_sprite(True); ball_highlight()
    for fr in (0, 1):
        for left in (False, True):
            blob(1, fr, False, left)
            blob(2, fr, True, left)
            wasp(fr, left)
            dragon(fr, left)
        spider(fr)
    spiky(); coins(); gems(); items(); hud(); world_bits(); background(); icons(); sounds()
    with open(os.path.join(IMG, "sprites.json"), "w") as f:
        json.dump(SPRITES, f, indent=1, sort_keys=True)
    print(len(SPRITES), "sprites")
