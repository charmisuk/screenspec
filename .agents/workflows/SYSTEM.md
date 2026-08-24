# ScreenSpec 작업 시스템

> 이 저장소는 단일 파일 라이브러리 + GitHub 이슈 단위 작업이다. ezdodal 의 plan→dev→review→push 체인을
> "이슈 1건 = 1사이클" 로 축소 이식했다. 상세는 각 워크플로 문서.

| 명령 | 파일 | 역할 | 실행 주체(모델) |
|---|---|---|---|
| `/ss-cycle` | issue-cycle.md | 이슈를 **중요순·1건씩** plan→dev→qa→commit 로 처리. tasks.json 게이트를 하드하게 체크 | 오케스트레이션·plan·qa·commit = 메인 세션 / dev = 서브에이전트 |
| `/ss-retro` | retro.md | 사이클 종료 후 회고 → log.md 를 분류해 issue-cycle.md 자체를 갱신 | 메인 세션 |

원칙
- 병렬 금지. 이슈 하나가 commit 까지 끝나야 다음 이슈를 연다 (어디서 꼬였는지 커밋 단위로 추적 가능해야 한다).
- 건너뛰기 금지. 각 게이트는 tasks.json 에 **증거**(테스트 출력·커밋 sha)를 적어야 `done` 이 된다. 막히면 조용히 넘기지 말고 사용자에게 묻는다.
- push 는 사용자 명시 요청 시에만. 브랜치에 커밋만 쌓는다.
- 사용자는 기획자다. 판단 요청·브리핑은 구현 용어 없이, 선택지마다 '하면 어떻게 되는지' + 추천 1개 (issue-cycle.md §보고 규칙).
- 커밋 메시지에 `fix #N` / `docs #N` / `feat #N` 을 넣어 push 시 이슈가 자동 종료되게 한다.
