# Gates: Episuite visual redesign

OWNS: episuite/public/**, episuite/DESIGN-GATES.md, episuite/USER-JUDGE.md, episuite/DESIGN.md

Scope: Replace the rejected soft visual direction with a distinctive action-first interface, preserve workflows, and judge the revision without presenting a simulated score as user approval or clinical efficacy.

- [x] V1: All four functional test suites and source checks pass after the redesign.
  CHECK: node --test tests/domain.test.mjs tests/server.test.mjs tests/integrations.test.mjs tests/extra.test.mjs
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=4346d4597d82b8a022baa5a450a2b9a31c4e82811af9b96dd0bcc6be21996b9b; exit=0; EXPECT=matched; output-sha256=877b53c002409e1807989433a441af519c892a6f77ad669e2efb2fc3a226a394; output-bytes=2816; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] V2: Shipped source and assets pass validation.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=afa1ae4e2e19/33 entries
- [x] V3: Desktop and phone layouts, task creation, completion feedback, capture, timer controls, dark mode and low-stimulation mode are verified through the browser.
  EVIDENCE: Disposable workspace on port 3211: actual task creation and tiny-step editing, two-minute timer start, pause/reload, completion/undo, finished-shortlist break flow, keyboard capture, preference save, dark and quiet modes. 390x844 documents stayed within viewport width across all eight pages. Desktop/mobile screenshots in test-results/redesign-*.jpg; browser error log empty. Viewport override reset; real workspace data preserved.
- [x] V4: The design rationale separates research-backed principles from aesthetic choices; the simulated judge is revised and remains explicit about its limits.
  EVIDENCE: DESIGN.md links NICE and W3C and labels the palette as an aesthetic choice. USER-JUDGE.md supersedes the rejected design's score, reports the four criteria and an 8.6/10 simulated overall score, and explicitly states that this is neither clinical evidence nor owner acceptance.
