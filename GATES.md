# Gates: Episuite

OWNS: episuite/**, GATES.md

Scope: Audit the legacy apps, implement a unified ADHD-oriented app, verify its workflows, and revise until a candid simulated user evaluation reaches at least 8/10.

Owner feedback rejected the appearance after this initial ledger was completed. The replacement visual pass is verified separately in episuite/DESIGN-GATES.md. The historical score below does not establish user acceptance. The revised simulated score is 8.6/10, with its limits stated in USER-JUDGE.md.

- [x] G1: Legacy apps and their functional differences are documented with source references and a feature coverage map.
  EVIDENCE: episuite/AUDIT.md and SOURCE-INVENTORY.json cover 55 legacy source/config files and 17883 lines; both legacy JSON datasets independently pass scripts/preview-legacy.mjs validation.
- [x] G2: Tasks, habits, scheduling, timers, rewards, data migration, and integration APIs pass functional and failure-case checks.
  CHECK: node --test episuite/tests/domain.test.mjs episuite/tests/server.test.mjs episuite/tests/integrations.test.mjs episuite/tests/extra.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=10537284bc57d4f7ff9fdb9abaa0a7e60716b4b9e441513e094ce903248ec8d0; exit=0; EXPECT=matched; output-sha256=77c46733c754e7a0f824b9bae82f36efafe504ba58446e3745c721b622559df2; output-bytes=2818; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite; path=afa1ae4e2e19/33 entries
- [x] G3: All shipped JavaScript parses and required application assets exist.
  CHECK: node episuite/scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=c3e88c5ebbfa4266e2aa2d17c2459f14b7c4f6d055a5c8ebf51ac926a67a3f1a; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite; path=afa1ae4e2e19/33 entries
- [x] G4: Desktop and mobile browser workflows are exercised, including persistence and keyboard use.
  EVIDENCE: Actual browser walkthroughs exercised task editing, tiny steps, focus pause/reload/partial finish, capture-to-task, offline capture and reconnection, wake-relative scheduling, keyboard capture, themes and 390x844 layout. Screenshots are in episuite/test-results; USER-JUDGE.md records the scenarios and external limits.
- [x] G5: Simulated user judge reports all four requested criteria, an overall score of at least eight, limitations, and revisions.
  EVIDENCE: episuite/USER-JUDGE.md records first-pass 7.35/10, fixes, final scores 8.5 functionality, 8.6 usefulness, 8.2 intuition/fluidity and 8.7 ADHD-oriented support; equal-weight overall 8.5/10. Explicitly a self-assessment rather than clinical evidence or independent research.
