# Gates: Personal Life OS board

OWNS: episuite/**
Scope: Replace the activity catalogue with a personal compact board, rewarding daily flame, and permanent task deletion.

- [x] G1: Board preferences persist and validate; streaks use actual dated work; permanent deletion removes links safely.
  CHECK: node --test tests/life-board.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=76cdc4ead49b33faf432023bd3ccc144aad369968e7718231f3a6e06acb3d55f; exit=0; EXPECT=matched; output-sha256=6593bb9e1ee329d684e294005e39bf6e8d33f6ca45cbeea671c8942bdcd52b32; output-bytes=922; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G2: Existing regression tests and source checks pass.
  CHECK: node --test tests/*.test.mjs && node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=c95ca11bf58b381eeec76e0ef8711671f976c5762768deb9aa3aacc2aa5c0407; exit=0; EXPECT=matched; output-sha256=6e96ef3934ee3a6e8b82488e110c726c6c8b047e607348a72e135c3b2f7ce7d4; output-bytes=18689; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G3: Browser verifies compact graph selection, visibility, flame activation, deletion and responsive layouts.
  CHECK: node scripts/check-life-board-browser.mjs && node scripts/check-life-browser.mjs
  EXPECT: Life OS browser checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=c67a8f5c47bef1f6d4ff220d6351fd69c571389242ee679f393d5ce106fa6f29; exit=0; EXPECT=matched; output-sha256=5e48b14c724db5d2c1e4baf74b4eae7e838ef7480ba748f8fd065a08b0adc64e; output-bytes=69; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G4: Independent layout judge inspects code and desktop/mobile screenshots and scores at least 95.
  EVIDENCE: Independent layout subagent round 2 scored 96/100 in LIFE-LAYOUT-JUDGE.md after inspecting code, desktop, phone, dark, dormant, empty, and Customize screenshots and independently rerunning the browser check.
