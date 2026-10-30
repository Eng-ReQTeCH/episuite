# Gates: Life OS

OWNS: episuite/**
Scope: Unified tasks, contribution histories, authenticated automation, Life OS shortcuts and floating focus.

- [x] G1: Automation is authenticated, retry safe and persistent; graphs and shortcut inputs validate.
  CHECK: node --test tests/life.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=d2fb6a4d894d05d44e9f2f9655d49357785d4488bec9cb7a5206b138d8c6c7c0; exit=0; EXPECT=matched; output-sha256=b5fa2c10dacfed93b5c4250b3dcf49ce1a6cae750106bf63146f85ca57de08e9; output-bytes=618; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G2: Existing regressions pass.
  CHECK: node --test tests/*.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=e99620a3ee9e9dcb0276a7080ef2da9f31fe9f74fae42d9dc2bef19cfdfaf7b6; exit=0; EXPECT=matched; output-sha256=25d18aa60a41761ed84c1b4866177b18e6d2ded4d0b7a8aa79614a54adaca11f; output-bytes=17859; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G3: Source and offline assets validate.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G4: Browser verifies tasks, graphs, shortcuts, setup and floating timer.
  CHECK: node scripts/check-life-browser.mjs
  EXPECT: Life OS browser checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=03b86e0d0e6e5f783449b31df8ff2c5f67de77c472e2047e0bdb1274046da6e8; exit=0; EXPECT=matched; output-sha256=76ed3261ceea81cfbe69979ca5907aab15220ab4bb21da94b2ae1137ea65d6af; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G5: Independent judge scores all four requested categories at least 90.
  EVIDENCE: Independent subagent judge round 2 in LIFE-JUDGE.md: usefulness 94, completeness 94, functionality/robustness 93, ADHD usability 92. Judge independently reran browser regression and inspected phone screenshot.
