# Gates: general guided onboarding

OWNS: public/**, server.mjs, tests/onboarding.test.mjs, ONBOARDING-GATES.md, README.md

- [x] O1: Tour progress persists, pause/resume/restart work, invalid progress is rejected and existing data remains unchanged.
  CHECK: node --test tests/onboarding.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=56a8a8ad70955dcaad6c1ccda9273bdb12b9773cf1c27f96b5001c07113b27a7; exit=0; EXPECT=matched; output-sha256=8bf2db628b733fa01daf50aa0faba5b3164db5cd383a54d37e09a76c3e36cebd; output-bytes=336; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] O2: Existing functionality and source checks pass.
  CHECK: node --test tests/domain.test.mjs tests/server.test.mjs tests/integrations.test.mjs tests/extra.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=4346d4597d82b8a022baa5a450a2b9a31c4e82811af9b96dd0bcc6be21996b9b; exit=0; EXPECT=matched; output-sha256=9c9d13a8f2ffd7a8b5e3703fdecca402a1d1d24db4cd94b8f482064e9336d56b; output-bytes=2817; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] O3: Source parses and shipped assets exist.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] O4: Browser verifies guidance through every page, optional setup actions, pause/resume and phone layout; documentation explains the daily workflow.
  EVIDENCE: Separate port-3211 workspace exercised all eight guide steps, native task creation, optional block cancellation, two-minute selection, capture, custom reward/category, pause/reload/resume, replay and final preference save (10-minute default visible in Now). Disabled rewards stayed disabled. 390x844 layout stayed within viewport width; screenshots in test-results/onboarding-*.jpg; no browser errors. README documents entry, optional actions, persistence and daily loop. USER-JUDGE reports a candid 8.7/10 self-review.
