---
description: 사이클 회고 — log.md 를 분류해 issue-cycle.md 를 점진 개선 (v1.0)
---

# Cycle Retro Protocol (v1.1)

**트리거**: `/ss-cycle` Phase 2 완료 후 자동, 또는 `/ss-retro` 직접 호출.
**입력**: `_private/sprint/{cycle}/log.md` + tasks.json (되돌림 횟수·blocked 항목)

1. log.md 항목을 분류: 🔧 Protocol Fix(프로토콜 누락·오류) / ➕ Add / ➖ Remove(한 번도 잡아낸 게 없는 검사) / 💡 Insight(코드·도메인 지식, 프로토콜 변경 불필요).
2. **lint 질문** (v1.1): 이 사이클에서 사람이/QA 가 잡은 문제 중 **lint 가 잡을 수 있었던 것**이 있나? 있으면 `tests/lint.js` 에 검사를 추가한다(incident → rule). 추가한 검사는 **음성 테스트**(일부러 틀리게 해서 FAIL 이 나는지)로 검사 자체를 검증하고, 추출기(정규식)가 빈 결과를 돌려 조용히 통과하지 않도록 최소 개수 가드를 둔다. lint 는 스스로 갱신되지 않는다 — 이 질문이 갱신 경로다.
3. tasks.json 통계도 원료다: G3→G2 되돌림이 잦은 이슈 유형은 plan 템플릿에 항목을 추가할 후보. 서브에이전트 범위 이탈이 있었으면 dev 지시문 강화 후보.
4. 개선안을 비개발자(기획자)가 읽을 수 있는 한국어로 제시하고 **사용자 승인 후** `issue-cycle.md` 에 반영, 버전(v1.x) 올림. 승인 없이 프로토콜을 바꾸지 않는다.
5. 💡 Insight 는 `_private/sprint/learnings.md` 에 누적. AGENTS.md 에 넣을 만큼 일반적이면 그쪽 제안.
6. log.md 는 아카이브(`_private/sprint/{cycle}/log.md` 그대로 두고 다음 사이클은 새 폴더).
