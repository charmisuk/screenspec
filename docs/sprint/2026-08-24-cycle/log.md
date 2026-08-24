# Cycle log — 2026-08-24

회고 원료. 작업 중 즉시 1줄씩. 형식: `- [#N] 🔧|➕|➖|💡 내용`

- [#12/#7] 💡 wrap 감지 루프: 감지(detectScreen)가 DOM display 를 쓰면 MutationObserver(style 필터)가 재발화 — 감지는 setCurrent 만, 쓰기는 사용자 액션(목차·setScreen)만
- [#12/#7] 🔧 plan 에 "예제 배치 위치" 를 안 적어 서브에이전트가 패널 위치를 스스로 판단 — 예제 수정이 있는 이슈는 plan 에 UI 배치 제약(ScreenSpec 자체 UI 와 겹치지 않게) 명시
- [#13] 🔧 accept 기준을 "left>=0" 로만 잡았다가 헤더 겹침을 놓칠 뻔 — 위치 관련 이슈는 accept 에 "다른 fixed UI 와 겹치지 않음" 을 기본 포함
- [#18] 💡 getComputedStyle().getPropertyValue(커스텀 프로퍼티) 는 var() 를 치환한 값을 돌려준다 — 검사식은 최종 색으로
