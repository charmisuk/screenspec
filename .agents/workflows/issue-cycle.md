---
description: 이슈 사이클 — GitHub 이슈를 중요순으로 1건씩 plan→dev→qa→commit 처리 (v1.0)
---

# Issue Cycle Protocol (v1.0)

**입력**: `docs/sprint/{cycle}/tasks.json` (이슈 목록·우선순위·게이트 상태) + GitHub 이슈 본문
**출력**: 이슈당 커밋 1개 + tasks.json 증거 + `log.md` 회고 원료

## Phase 0 — 세션 시작
1. tasks.json 읽기. `status` 가 `done` 이 아닌 첫 항목이 현재 작업. **순서를 바꾸지 않는다** (우선순위는 plan 단계에서 확정된 것).
2. 현황 1줄 보고: `✅ n건 완료 · ⬜ m건 남음 · 다음: #N 제목`

## Phase 1 — 이슈 1건 처리 (4 게이트, 순서 고정)

### G1 plan (메인 세션)
- 이슈 본문 + 관련 코드 구간을 읽고 tasks.json 의 `plan` 을 채운다: `cause`(원인) · `change`(바꿀 것, 파일·함수 단위) · `accept`(완료 기준, 검증 가능한 문장) · `qa`(검증 절차, e2e 케이스 포함) · `docs`(lint 가 강제하는 문서 동기화 대상).
- 설계 판단이 갈리면 여기서 사용자에게 묻는다. dev 단계에서는 묻지 않는다.
- `plan.done = true` 는 위 5필드가 전부 채워졌을 때만.

### G2 dev (서브에이전트 — 모델은 tasks.json `dev.model`)
- 서브에이전트에 plan 을 **그대로** 전달한다. 재해석 금지, 범위 확장 금지("겸사겸사" 수정 금지).
- 완료 조건: `node tests/lint.js` 통과 + 변경 요약 회신. 새 동작은 **e2e 케이스를 반드시 추가**한다(회귀 방지가 이 사이클의 핵심).
- 회신을 `dev.summary` 에 기록. 서브에이전트가 범위를 벗어났으면 되돌리고 다시 시킨다.

### G3 qa (메인 세션)
- `git diff` 를 직접 읽어 plan.change 와 일치하는지 확인 (범위 드리프트 검사).
- `node tests/lint.js` + `node tests/e2e.js` 실행, 결과 요약을 `qa.evidence` 에 기록 (PASS/FAIL 수).
- plan.qa 의 수동 항목이 있으면 Playwright 스크립트로 실측하고 수치를 적는다.
- 실패 → G2 로 되돌린다. 3회 실패하면 사용자에게 보고.

### G4 commit (메인 세션)
- 이슈 1건 = 커밋 1개. 메시지: `{fix|feat|docs}: {한 줄 요약} (fix #N)` / 여러 이슈 한 뿌리면 `(fix #12, fix #7)`.
- `commit.sha` 기록 → `status = done`. CHANGELOG 는 사이클 끝에 한 번에 쓴다(버전 릴리스 단위).

### 규칙
- **즉시 체크오프**: 게이트 통과 즉시 tasks.json 갱신. 모아서 하지 않는다.
- **막히면 묻기**: 원인 불명·설계 분기·이슈 본문과 코드 불일치 → 사용자에게 선택지 제시. 절대 조용히 skip 하거나 "나중에" 로 미루지 않는다. 미루려면 `status = blocked` + `blocked_reason` 을 적는다.
- **log.md**: 작업 중 "프로토콜이 빠뜨린 것 / 불필요했던 것 / 통찰" 이 생기면 그 즉시 `docs/sprint/{cycle}/log.md` 에 1줄 적는다. 회고 원료.

## Phase 2 — 사이클 종료
1. 전체 QA: lint + e2e 전체 + examples 전부 Playwright 로 열어 콘솔 에러 0 확인 + README 빠른시작 예제 실행. 결과를 tasks.json `cycle_qa` 에 기록.
2. 버전 bump(헤더 주석·워터마크·문서 CDN 태그 — lint 가 정합 검사) + CHANGELOG 작성 → 커밋 1개.
3. 사용자 브리핑: 처리 목록(커밋 sha) · **사용자 QA 필요 항목**(자동화로 못 보는 것: 실제 Next.js 앱에서의 체감 등) · 보류/차단 항목 · push/PR 여부 질문.
4. `/ss-retro` 실행.

## 모델 라우팅
| 단계 | 모델 | 이유 |
|---|---|---|
| plan · qa(diff 리뷰·판정) · commit · 브리핑 · retro | 메인 세션 (현재 Fable) | 판단·검증은 가장 강한 모델. 세션 모델은 사용자가 `/model` 로 정한다 — AI 는 세션 모델을 바꿀 수 없다 |
| dev(코드 변경 + 테스트 추가) | 서브에이전트 `opus` | 명세가 확정된 실행 작업. 메인이 서브에이전트 모델을 직접 지정할 수 있다 |
| dev(문서만 수정) · 단순 실측 스크립트 | 서브에이전트 `sonnet` | 기계적 작업 |
| effort | max 유지 | 사용자 지정 |
