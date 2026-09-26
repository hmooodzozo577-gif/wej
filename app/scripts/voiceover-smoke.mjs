// Phase 20 — practical VoiceOver smoke test of the deployed site on a
// GitHub-hosted macOS runner (see .github/workflows/production-smoke.yml).
// Real VoiceOver reads a destination page in real Safari; the test walks
// the page by headings (VO + Command + H) and checks what VoiceOver
// actually announces. The Worker hostname is blocked in /etc/hosts first,
// and the job proves it unreachable before Safari opens, so the run
// writes no production data.
// It is a smoke test of the heading structure, not a full audit.
//
// Usage: node scripts/voiceover-smoke.mjs [siteUrl]
import { execFileSync } from 'node:child_process';
import { macOSActivate, voiceOver } from '@guidepup/guidepup';
import { PRODUCTION_SITE_URL } from './lib/productionUrls.mjs';

const SITE = (process.argv[2] || PRODUCTION_SITE_URL).replace(/\/$/, '');
let checks = 0;
let failures = 0;
const check = (ok, label, detail = '') => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} voiceover ${label}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

execFileSync('open', ['-a', 'Safari', `${SITE}/destination/japan`]);
await sleep(10000);
await voiceOver.start();
try {
  // Getting VoiceOver's cursor into Safari's web content. Earlier runs
  // (interact + jump to the left edge) left it on the browser chrome, where
  // every "next heading" answers "Heading not found". Tab moves keyboard
  // focus into the page and the VoiceOver cursor follows it; if the first
  // search still finds nothing, VO + Command + ] jumps to the page's first
  // web spot. Each step's announcement is printed for diagnosis.
  await macOSActivate('Safari');
  await sleep(1500);
  await voiceOver.press('Tab');
  await sleep(1200);
  console.log(`After Tab: ${await voiceOver.lastSpokenPhrase()}`);
  // The first search is part of the walk (it reaches the page's h1), so
  // its announcement is kept rather than cleared.
  const heard = [];
  await voiceOver.perform(voiceOver.keyboardCommands.findNextHeading);
  await sleep(900);
  const first = await voiceOver.lastSpokenPhrase();
  if (/not found/i.test(first)) {
    await voiceOver.perform(voiceOver.keyboardCommands.moveToNextAutoWebSpot);
    await sleep(1200);
    console.log(`After web spot: ${await voiceOver.lastSpokenPhrase()}`);
  } else {
    heard.push(first);
  }
  for (let step = heard.length; step < 14; step += 1) {
    await voiceOver.perform(voiceOver.keyboardCommands.findNextHeading);
    await sleep(900);
    heard.push(await voiceOver.lastSpokenPhrase());
  }
  console.log('Spoken while moving by heading:');
  heard.forEach((phrase, index) => console.log(`  ${index + 1}. ${phrase}`));
  const level = (n) => heard.filter((phrase) => new RegExp(`heading level ${n}\\b`, 'i').test(phrase)).length;
  check(heard.some((phrase) => phrase.trim().length > 0), 'VoiceOver announces the page');
  check(level(1) >= 1, 'the page heading is announced as heading level 1', String(level(1)));
  check(level(2) >= 3, 'destination sections are announced as heading level 2', String(level(2)));
  check(heard.some((phrase) => /اليابان|Japan/.test(phrase)), 'the destination name is spoken');
} catch (error) {
  check(false, 'run completed', String(error?.message ?? error).split('\n')[0]);
} finally {
  await voiceOver.stop();
}

console.log(`VoiceOver smoke: ${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
