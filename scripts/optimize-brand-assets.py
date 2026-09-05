from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "assets" / "images"

for name in ("icon.png", "splash-icon.png"):
    source = root / name
    temporary = root / f"{name}.optimized.png"
    image = Image.open(source)
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    if image.mode == "RGBA":
        image.save(temporary, format="PNG", optimize=True, compress_level=9)
    else:
        image = image.convert("RGB")
        image.save(temporary, format="PNG", optimize=True, compress_level=9)
    temporary.replace(source)
    print(f"optimized {source.name}: {source.stat().st_size} bytes")
