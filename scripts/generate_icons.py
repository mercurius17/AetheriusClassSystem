"""Compatibility entrypoint for the original SVG illustration generator."""
from pathlib import Path
import subprocess
subprocess.run(["node", str(Path(__file__).with_name("draw-class-icons.cjs"))], check=True)
