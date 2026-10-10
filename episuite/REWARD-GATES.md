# Gates: Variable rewards and phone notifications

OWNS: episuite/server.mjs, episuite/public/**, episuite/notifications.mjs, episuite/screentime.mjs, episuite/random-rewards.mjs, episuite/tests/**, episuite/scripts/check-reward-phone-browser.mjs, episuite/README.md, episuite/SCREEN-TIME-API.md

Scope: Weighted random task payouts, custom personal and screentime rewards, persistent single-use screentime redemption, and phone notification compatibility.

- [x] G1: Variable server-only payouts, undo without rerolls, provider delivery, retries and secret redaction are verified.
  CHECK: node --test tests/reward-notifications.test.mjs
  EXPECT: # fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=19743b68d4eacf0569bc586ba614ec40f0df3729755ef74f682c5fd1a7b7529f; exit=0; EXPECT=matched; output-sha256=059e365104190a59f0afb5823a673cef9ef14bf390c0ed113161f3b3dcf906ee; output-bytes=1510; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=706505cec3cc/34 entries

- [x] G4: Settings save random payouts and both providers, custom screentime rewards issue usable keys, and phone layout fits.
  CHECK: node scripts/check-reward-phone-browser.mjs
  EXPECT: Reward and phone browser checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=e4229345055e4de2af2d4f9d0127518eb6ec6f6acb52bd4b48cf2bd07dc7abf8; exit=0; EXPECT=matched; output-sha256=6665a52e6424f4cac03fd1dcf05c59e44931ae980d6d5e86f3dcbbaa4768dc88; output-bytes=39; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=706505cec3cc/34 entries

- [x] G2: Existing app behavior passes regression tests.
  CHECK: npm test
  EXPECT: # fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=fff94ba34c84b328f10bcb2052e574cf993836c3a31464a29c6811307a964d7d; exit=0; EXPECT=matched; output-sha256=204c43d84d8fbe9a4ce77a0beb85872911ecc7371acb54b2426dc37626e91e04; output-bytes=16980; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=706505cec3cc/34 entries

- [x] G3: All app source parses and offline assets exist.
  CHECK: npm run check
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=dc599cabdb9bf17a08c8e5466a0c7df0f69612ef32abae12c2859e73bc7c12c6; exit=0; EXPECT=matched; output-sha256=070c51ac5451403eecfe030f3cb9cc987a1e8701f38e230815deb63b8377a258; output-bytes=105; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=706505cec3cc/34 entries

- [x] G5: Screentime purchase and redemption are atomic, persistent, single-use, validated, and cannot be replayed through import.
  CHECK: node --test tests/screentime.test.mjs
  EXPECT: # fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=56a924ee1e5fa7e39d40887d83bfaa0b951972ace99ea8915f06ae8f1abeedd1; exit=0; EXPECT=matched; output-sha256=5a720c583f04257d5777dbe1e07cbdd4d0c14ddf7c17f9fe8765a0c38b85ca2b; output-bytes=1654; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=706505cec3cc/34 entries
