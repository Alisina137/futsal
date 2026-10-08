"""Render the approved wordmark-free Futsal player as reproducible native icons.

Source asset is a compact WebP rendition of the approved 1024px preview.
The approved athlete/football artwork contains no letters or wordmark; the
screen header supplies the Futsal brand name separately.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageOps

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"apps/mobile/assets"
SOURCE=ASSETS/"branding/futsal-player-logo.webp"

with Image.open(SOURCE) as asset:
    assert asset.size[0]>=200 and asset.size[0]==asset.size[1], "Invalid approved logo source."
    approved=asset.convert("RGB")

launcher=ImageOps.fit(approved,(1024,1024),method=Image.Resampling.LANCZOS)
launcher.save(ASSETS/"icon.png",format="PNG",optimize=True)

# Android's adaptive icon mask crops outer image edges. Use a 72% safe area
# for the text-free athlete and football with transparent foreground.
scaled=ImageOps.fit(approved,(740,740),method=Image.Resampling.LANCZOS)
white=Image.new("RGB",scaled.size,"white")
alpha=ImageChops.difference(scaled,white).convert("L").point(
    lambda value:min(255,round(value*1.7))
)
foreground=Image.new("RGBA",(1024,1024),(255,255,255,0))
foreground.paste(scaled.convert("RGBA"),(142,142))
foreground.putalpha(
    Image.new("L",(1024,1024),0)
)
whole_alpha=Image.new("L",(1024,1024),0)
whole_alpha.paste(alpha,(142,142))
foreground.putalpha(whole_alpha)
foreground.save(ASSETS/"adaptive-icon.png",format="PNG",optimize=True)

for name in ("icon.png","adaptive-icon.png"):
    with Image.open(ASSETS/name) as result:
        assert result.size==(1024,1024)
    print(f"Created Futsal {name}: {(ASSETS/name).stat().st_size} bytes")
