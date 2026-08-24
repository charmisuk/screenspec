---
description: 사이클 회고 — log.md 를 분류해 issue-cycle.md 를 점진 개선 (v1.0)
---

# Cycle Retro Protocol (v1.0)

**트리거**: `/ss-cycle` Phase 2 완료 후 자동, 또는 `/ss-retro` 직접 호출.
**입력**: `docs/sprint/{cycle}/log.md` + tasks.json (되돌림 횟수·blocked 항목)

1. log.md 항목을 분류: 🔧 Protocol Fix(프로토콜 누락·오류) / ➕ Add / ➖ Remove(한 번도 잡아낸 게 없는 검사) / 💡 Insight(코드·도메인 지식, 프로토콜 변경 불필요).
2. tasks.json 통계도 원료다: G3→G2 되돌림이 잦은 이슈 유형은 plan 템플릿에 항목을 추가할 후보. 서브에이전트 범위 이탈이 있었으면 dev 지시문 강화 후보.
3. 개선안을 비개발자가 읽을 수 있는 한국어로 제시하고 **사용자 승인 후** `issue-cycle.md` 에 반영, 버전(v1.x) 올림. 승인 없이 프로토콜을 바꾸지 않는다.
4. 💡 Insight 는 `docs/sprint/learnings.md` 에 누적. AGENTS.md 에 넣을 만큼 일반적이면 그쪽 제안.
5. log.md 는 아카이브(`docs/sprint/{cycle}/log.md` 그대로 두고 다음 사이클은 새 폴더).
