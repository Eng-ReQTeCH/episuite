# Gates: two-way CalDAV synchronization

OWNS: episuite/**

Scope: Discover remote CalDAV events, import changes, upload missing commitments without duplication, preserve remote recurrence, detect conflicts, and verify Radicale interoperability.

- [x] C1: Remote import, missing-event upload, repeat sync, modifications, deletion and conflict regressions pass.
  CHECK: node --test tests/*.test.mjs
  EXPECT: # fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=086c395288186d03758f84120a215daa591a408fbcf3cb20ae362c791a8d0612; exit=0; EXPECT=matched; output-sha256=ad8eca5e815d3aa660829c38fc6bfa338c310fdfb653a16903cb9ca49b896683; output-bytes=13950; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries

- [x] C2: Source/PWA assets and dependency installation are consistent.
  CHECK: node scripts/check.mjs
  EXPECT: Episuite source checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=b3e9d34cbf264bf8e7cd88cfa037843456f6b4f407c322e3d7e0848a0bc9c2b6; exit=0; EXPECT=matched; output-sha256=944d4bd8f2b775688f42b2a6d538ceae667429a2eb5d55f48cc3e3cc597b2244; output-bytes=30; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries

- [x] C3: Two-way discovery and writes work against an isolated real Radicale server.
  CHECK: node scripts/check-radicale.mjs
  EXPECT: Radicale two-way checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=6da396eca97827956dc2ebdb0476fc68a7eec609fd9aafd4e1159968cccedc27; exit=0; EXPECT=matched; output-sha256=e133ff8b4c349a6b30e70ef9dcc2e7524a87bfb55eccde215323d6de6bc95aba; output-bytes=31; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries

- [x] C4: Existing browser flows, offline support and installation remain usable.
  CHECK: node scripts/check-social-browser.mjs
  EXPECT: Social and PWA browser checks passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=fde867c5c9a96adfb536e1a1b6ac9c6708d185c6e05fe0b9cf9b6e0206a42aec; exit=0; EXPECT=matched; output-sha256=06b39fc02063e2cfae9dccbe60608db22060110224d69aa103b8b7af81eb4b69; output-bytes=37; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\ai inference\epi suite\episuite; path=916c2a091702/34 entries
