# Learnings (누적)

- 2026-08-24 감지 로직(detectScreen)은 DOM 을 읽기만 한다. display 를 쓰면 MutationObserver(style 필터)가 재발화해 루프 — 쓰기는 사용자 액션(목차·setScreen)에서만
- 2026-08-24 getComputedStyle(el).getPropertyValue("--x") 는 var() 를 치환한 최종값을 돌려준다 — 테스트는 최종 색으로 비교
- 2026-08-24 overlay 마커는 정의서 모드에서만 보이므로 상단 클램프 기준은 뷰포트 0 이 아니라 정의서 헤더 48px
