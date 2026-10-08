"""Generate Futsal launcher and adaptive icons from the checked-in SVG source."""
from pathlib import Path
import cairosvg

ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/"apps/mobile/assets"
svg_path=assets/"branding/premium-futsal-logo.svg"
source=svg_path.read_text(encoding="utf-8")
assert 'width="1024"' in source and '<svg' in source and 'ball' in source

def write(name,content):
    cairosvg.svg2png(
        bytestring=content.encode("utf-8"),
        write_to=str(assets/name),
        output_width=1024,
        output_height=1024,
    )
    assert (assets/name).stat().st_size>5000, f"Bad icon: {name}"
    print(f"Created {assets/name} ({(assets/name).stat().st_size} bytes)")

write("icon.png",source)
open_tag='<g clip-path="url(#art)">'
assert source.count(open_tag)==1
adaptive=source.replace(open_tag,
    '<g transform="translate(142 142) scale(0.72265625)">'+open_tag,1)
closing='</g>\n</svg>'
assert closing in adaptive
adaptive=adaptive.replace(closing,'</g></g>\n</svg>',1)
write("adaptive-icon.png",adaptive)
