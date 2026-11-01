#!/usr/bin/env python3
"""Packages the channel as popupideas-arcade.zip (manifest at the zip root) for sideloading."""
import os, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "popupideas-arcade.zip")
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(ROOT, "manifest"), "manifest")
    for folder in ("source", "images", "sounds"):
        for dp, _, files in os.walk(os.path.join(ROOT, folder)):
            for f in sorted(files):
                full = os.path.join(dp, f)
                z.write(full, os.path.relpath(full, ROOT).replace(os.sep, "/"))
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
