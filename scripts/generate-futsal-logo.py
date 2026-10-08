"""Generate a simple Futsal goal-and-ball launcher icon plus safe-zone adaptive icon."""
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parents[1]
assets = ROOT / "apps/mobile/assets"
svg_path = assets / "branding/premium-futsal-logo.svg"
source = svg_path.read_text(encoding="utf-8")

background = '<rect id="logoBackground" width="1024" height="1024" fill="#145BD5"/>'
mark = '<g id="logoMark">'
assert source.count(background) == 1
assert source.count(mark) == 1
assert '<circle cx="770" cy="321"' in source

def render(name, vector):
    target = assets / name
    cairosvg.svg2png(
        bytestring=vector.encode("utf-8"),
        write_to=str(target),
        output_width=1024,
        output_height=1024,
    )
    assert target.stat().st_size > 2500, f"Invalid PNG icon: {target}"
    print(f"Generated {target.name}: {target.stat().st_size} bytes")

# Launcher icon has a solid, brand-blue background.
render("icon.png", source)

# Android adaptive foreground stays transparent and inside the circle safe zone.
# The system supplies the same brand blue from app.json as its background.
foreground = source.replace(background, "", 1)
foreground = foreground.replace(
    mark,
    '<g id="logoMark" transform="translate(130 130) scale(0.74609375)">',
    1,
)
render("adaptive-icon.png", foreground)
