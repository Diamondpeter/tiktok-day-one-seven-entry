#!/bin/sh
# Builds the TikTok video for the "Day one, day seven" bounty from the
# rendered gameplay frames (tools/render.mjs) and make.fun's press-pack
# assets, used as they are. Vertical 1080x1920, ~28 s, silent.
#   sh tools/build-video.sh <frames-dir> <assets-dir> <out-mp4>
set -eu
FR="${1:-/tmp/tiktok-build/frames}"
ASSETS="${2:-/tmp/tiktok-build/assets}"
OUT="${3:-/tmp/tiktok-build/video.mp4}"
TMP="${TMPDIR:-/tmp}/tiktok-build/parts"
mkdir -p "$TMP"

BOLD=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
MONO=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf
CODE=h68hpwev
LABELS="drawtext=fontfile=$BOLD:text='SCORE':fontsize=28:fontcolor=0xffd34d:x=52:y=40"
HUD7="drawtext=fontfile=$BOLD:text='LVL':fontsize=28:fontcolor=white:x=856:y=124,drawtext=fontfile=$BOLD:text='COMBO':fontsize=28:fontcolor=0xffd34d:x=800:y=172"

TITLE() { # $1 = title, $2 = subtitle
  echo "drawtext=fontfile=$BOLD:text='$1':fontsize=96:fontcolor=white:borderw=2:bordercolor=black:box=1:boxcolor=black@0.45:boxborderw=20:x=(w-text_w)/2:y=470,drawtext=fontfile=$BOLD:text='$2':fontsize=34:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w)/2:y=600"
}

# 1. Day one — the same game, on the day it was made (7 s).
ffmpeg -y -v error -framerate 30 -i "$FR/d1/d1-%04d.png" \
  -vf "scale=1080:1920:flags=bicubic,$(TITLE 'DAY ONE' 'the same little game, on the day it was made'),$LABELS" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$TMP/seg1.mp4"

# 2. One week later (0.6 s).
ffmpeg -y -v error -f lavfi -i "color=c=0x0b1026:s=1080x1920:d=0.6" \
  -vf "drawtext=fontfile=$BOLD:text='ONE WEEK LATER':fontsize=84:fontcolor=white:x=(w-text_w)/2:y=880,drawtext=fontfile=$BOLD:text='seven days of daily updates':fontsize=36:fontcolor=0xffd34d:x=(w-text_w)/2:y=1000" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$TMP/trans.mp4"

# 3. Day seven — same map, same start, visibly more going on (11 s).
ffmpeg -y -v error -framerate 30 -i "$FR/d7a/d7a-%04d.png" \
  -vf "scale=1080:1920:flags=bicubic,$(TITLE 'DAY SEVEN' 'same map. same start. so much more going on.'),$LABELS,$HUD7" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$TMP/seg2.mp4"

# 4. Close on the newer build being played, with the invite line (6 s).
ffmpeg -y -v error -framerate 30 -i "$FR/d7b/d7b-%04d.png" \
  -vf "scale=1080:1920:flags=bicubic,drawtext=fontfile=$BOLD:text='Start yours at make.fun':fontsize=76:fontcolor=white:borderw=2:bordercolor=black:box=1:boxcolor=black@0.45:boxborderw=20:x=(w-text_w)/2:y=1420,drawtext=fontfile=$BOLD:text='built by an AI agent, one tiny update a day':fontsize=32:fontcolor=white:borderw=1:bordercolor=black:x=(w-text_w)/2:y=1530,$LABELS,$HUD7" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$TMP/seg3.mp4"

# 5. Referral end card from the press pack, used as it is, with our own
#    referral code typed into its field (field rests at ~1.43 s; the card
#    is 3 s; code box x=210 y=1232, ink #191419, mono bold).
ffmpeg -y -v error -i "$ASSETS/card-9x16.mp4" \
  -vf "fps=30,format=yuv420p,drawtext=fontfile=$MONO:text='$CODE':fontsize=64:fontcolor=0x191419:x=210:y=1232:enable='between(t,1.4,3)'" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$TMP/endcard.mp4"

# 6. Gameplay + brand badge overlay (press pack: badge on from the first
#    frame until the end card), then the end card after it.
ffmpeg -y -v error -i "$TMP/seg1.mp4" -i "$TMP/trans.mp4" -i "$TMP/seg2.mp4" -i "$TMP/seg3.mp4" -i "$ASSETS/badge-9x16.png" \
  -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[gp];[gp][4:v]overlay=0:0[out]" \
  -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 "$TMP/gameplay.mp4"

ffmpeg -y -v error -i "$TMP/gameplay.mp4" -i "$TMP/endcard.mp4" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1:a=0[out]" \
  -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 "$OUT"

ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of default=nw=1 "$OUT"
echo "built $OUT"
