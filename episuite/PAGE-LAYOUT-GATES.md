# Gates: Task flames and calm page layouts

OWNS: episuite/**
Scope: Add accurate task streak flames and independently review every page for layout and crowding, iterating to at least 95 each.

- [x] G1: Task streaks count consecutive recorded completion days, distinguish today's activity, and survive gaps and undo.
  CHECK: node --test tests/task-streak.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=964087c6573059f6ba3632b4b29db7ae16f6f532e7a3e202eaede90b14c09f62; exit=0; EXPECT=matched; output-sha256=8ef1e4d3f1929dc11fecb8060653df41fbdef291d414b024224ac8a7e9119b1a; output-bytes=585; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G2: All regression tests and source validation pass.
  CHECK: node --test tests/*.test.mjs && node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=c95ca11bf58b381eeec76e0ef8711671f976c5762768deb9aa3aacc2aa5c0407; exit=0; EXPECT=matched; output-sha256=17a18c01999e1326613afdbcea78716d344ad1267af4ecefb94259053fc422fd; output-bytes=19157; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G3: Populated and empty pages render without overflow; task flames and revised controls work in browser.
  CHECK: node scripts/check-page-layouts.mjs
  EXPECT: Page layout browser checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=6636fffb62e73dd441eb11da24be4f1076763d34217ab6746bdc13c19b9c468c; exit=0; EXPECT=matched; output-sha256=a3dda4159925be810cbad66e9a6fbd7ea2d6898d782296d8f1885b32d450d018; output-bytes=34; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=796bb037d508/48 entries
- [x] G4: Independent judge reviews every main page in desktop and phone screenshots, scores layout and content load, and accepts every page at least 95.
  EVIDENCE: Independent subagent round 2 accepted all ten pages in PAGE-LAYOUT-JUDGE.md: LIFE OS 96, Today 95, Tasks 95, Calendar 95, Social 95, Focus 95, Capture 96, Progress 96, Rewards 95, Settings 95. Both layout and content-load scores meet 95. Judge inspected desktop/phone, populated/empty, Calendar variants and active Focus, independently reran browser checks, and verified the refreshed empty month.
