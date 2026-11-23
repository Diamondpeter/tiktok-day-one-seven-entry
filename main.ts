// Entry for make.fun's "Day one, day seven" bounty (Node 22, standard
// library only): it copies VIDEO.json from the repository root to
// /output/VIDEO.json, where the gate reads it. That is all the program has
// to do. The entry is the video itself: a short vertical video about the
// same tiny agent-built game — Star Catcher — on the day it was made and
// after a week of daily updates, ending with make.fun's referral end card
// and the referral code, posted publicly on TikTok from a public account
// with the line the rules give and a play code in its caption (or the code
// in the account's bio). VIDEO.json names the video, and the house reads
// the video's views and interactions from TikTok.
//
// The VIDEO.json in this repository holds a placeholder address until the
// video is posted: the gate refuses it as it stands (valid 0). Replace it
// with the video's address before submitting.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const videoPath = join(BOT_DIR, 'VIDEO.json');

// Read it first so a malformed VIDEO.json fails here, loudly, instead of
// silently copying a file the gate cannot use.
let video;
try {
  video = JSON.parse(readFileSync(videoPath, 'utf8'));
} catch (err) {
  console.error(`VIDEO.json could not be read from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
if (typeof video?.url !== 'string' || video.url.length === 0) {
  console.error('VIDEO.json has no "url" string field; refusing to copy it.');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(videoPath, join(OUTPUT_DIR, 'VIDEO.json'));
} catch (err) {
  console.error(`VIDEO.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}
console.log(`VIDEO.json copied to ${OUTPUT_DIR} (url: ${video.url})`);
