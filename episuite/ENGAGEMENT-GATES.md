# Gates: rewarding productive use

OWNS: public/**, server.mjs, scripts/check.mjs, tests/engagement.test.mjs, README.md, ENGAGEMENT-GATES.md, ENGAGEMENT-REVIEW.md

Scope: Up to twenty sequential implementation/review cycles. Judge only whether the experience encourages opening, starting real work and feeling rewarded. Scores must be candid; a simulated score is not measured retention or a dopamine outcome.

- [x] E1: Reward progress derives from real work, preferences persist, and repeated interactions cannot manufacture progress.
  CHECK: node --test tests/engagement.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=72dedef3980d3a8dd21ec00a3fe11a061531e60a672ee9cf44012afbb041dc19; exit=0; EXPECT=matched; output-sha256=428048d43a13fa16745e4cfb812a1e4b09aeabf66c861712f664edbf943703dc; output-bytes=780; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] E2: Existing functionality and onboarding remain intact.
  CHECK: node --test tests/domain.test.mjs tests/server.test.mjs tests/integrations.test.mjs tests/extra.test.mjs tests/onboarding.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=6959345e345880e8abe8ba590283ecaa0057949b41f86f6d26431e97b56c3bea; exit=0; EXPECT=matched; output-sha256=f950a008a09b129d0501e177231f1eaf03d3a37979fd1a0ef2d3e1ee4d5bec65; output-bytes=3039; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] E3: Sources and assets validate.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] E4: Phone and desktop workflows, sensory preferences, live productive actions and reward feedback are verified; each iteration has a finding, actual revision and candid score.
  EVIDENCE: CUA browser verified onboarding, tiny-step acknowledgment, a real two-minute focus completion, pause/reload/resume, one credited minute on early finish, zero-minute finish without points, completion/undo, keepsake discovery, saved return cue, goal choice, next-move persistence, optional quieter feedback, finite three-choice inbox picker, dark/low-stimulation/reduced-motion/rewards-off modes, and desktop growth. No horizontal overflow at 320px after repair or at 390px. No browser console errors. Screenshots: test-results/engagement-phone.png, engagement-desktop.png, engagement-growth.png and engagement-preview.png. Disposable test data remained separate; the real preview is running at 127.0.0.1:3210 with no test tasks or progress. ENGAGEMENT-REVIEW.md records twenty iterations and a truthful 9.5 score below the 9.6 target at the iteration cap. Physical-phone haptics and actual daily return are unverified.
