#!/usr/bin/env python3
"""Enlarge one or more game sprite sheets onto a dark background for review.  view_sheets.py OUT.png SHEET.png [...] [--x 2]"""
import sys
if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
    print(__doc__); sys.exit(0)
from PIL import Image
args=[a for a in sys.argv[1:] if not a.startswith("--x")]
z=int(next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--x=")),"2"))
out,files=args[0],args[1:]
ims=[Image.open(f).convert("RGBA") for f in files]
W=max(i.width for i in ims)*z; H=sum(i.height for i in ims)*z+6*len(ims)
o=Image.new("RGBA",(W,H),(36,36,73,255)); y=0
for i in ims:
    o.alpha_composite(i.resize((i.width*z,i.height*z),Image.Resampling.NEAREST),(0,y)); y+=i.height*z+6
o.convert("RGB").save(out); print(out,o.size)
