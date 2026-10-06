# Gates: calendar colors, habit spacing, social and phone installation

OWNS: episuite/**

Scope: Deliver calendar colors, spaced repeat suggestions, connected social planning, a working PWA, candid judge review, and push the verified update.

- [x] G1: Automatic and custom colors persist and recurrence/habit spacing/social integrations pass regression tests.
  CHECK: node --test tests/*.test.mjs
  EXPECT: # fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=086c395288186d03758f84120a215daa591a408fbcf3cb20ae362c791a8d0612; exit=0; EXPECT=matched; output-sha256=8344bebdb40cbe214a6d496f98acf70394529a04c019bec136d70ee4cb31e4c5; output-bytes=13457; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries

- [x] G2: Source and required PWA assets pass validation.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries

- [x] G3: Browser walkthrough verifies colors, spaced Now suggestions, social CRUD/calendar/task links, phone layout, service worker and offline reopening.
  CHECK: node scripts/check-social-browser.mjs
  EXPECT: Social and PWA browser checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=fde867c5c9a96adfb536e1a1b6ac9c6708d185c6e05fe0b9cf9b6e0206a42aec; exit=0; EXPECT=matched; output-sha256=06b39fc02063e2cfae9dccbe60608db22060110224d69aa103b8b7af81eb4b69; output-bytes=37; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries

- [x] G4: Judge reviews observed flows, fixes defects, and documents a rubric score at least 9.9 without claiming independent user research.
  EVIDENCE: SOCIAL-JUDGE.md records 9.4 and 9.7 passes, corrected defects, inspected desktop/phone light/dark screenshots, and a final scoped self-review of 9.9. This is a manual assessment; physical-phone and production-tailnet verification remain explicitly outside observed evidence.

- [x] G5: Update is committed and pushed; remote branch points to the local commit.
  EVIDENCE: Release commit cf42b2bb7eee29554393459a5ff44881407ff960 was pushed to origin/main. git ls-remote origin refs/heads/main matched git rev-parse HEAD, and git status was clean. This evidence-only follow-up records the completed release.
