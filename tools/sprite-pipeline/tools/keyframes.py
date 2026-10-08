#!/usr/bin/env python3
"""Build a keyframe clip from stills: keyframes.py OUT.mp4 SIZE img:holdframes [img:hold ...]  (24 fps, each still resized to SIZE^2)"""
import sys, cv2
if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
    print(__doc__); sys.exit(0)
out, size, specs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
vw = cv2.VideoWriter(out + ".raw.mp4", cv2.VideoWriter_fourcc(*"mp4v"), 24, (size, size))
for s in specs:
    path, n = s.rsplit(":", 1)
    im = cv2.resize(cv2.imread(path), (size, size), interpolation=cv2.INTER_AREA)
    for _ in range(int(n)): vw.write(im)
vw.release()
import subprocess, os
subprocess.run(["ffmpeg","-v","error","-y","-i",out+".raw.mp4","-c:v","libx264","-crf","4","-pix_fmt","yuv420p",out],check=True); os.remove(out+".raw.mp4")
print(out)
