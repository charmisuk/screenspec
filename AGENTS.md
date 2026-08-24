# AGENTS.md

이 저장소(ScreenSpec 라이브러리 자체)를 수정할 때 지켜야 하는 규칙이다.

> **찾는 게 이게 아닐 수 있다.** 사용자의 프로토타입에 ScreenSpec을 *적용*하려는 것이라면
> [SKILL.md](SKILL.md)를 읽어라. 이 문서는 라이브러리 자체를 고칠 때의 규칙이다.

## 구조

| 경로 | 역할 |
|---|---|
| `screenspec.js` | 라이브러리 전부. 단일 파일, 의존성 0, 빌드 없음 |
| `SKILL.md` | AI가 남의 프로토타입에 적용할 때의 작업 지시서 |
| `docs/config.md` | 설정 필드 전체의 단일 출처 |
| `examples/*.html` | 실행 가능한 예제 겸 e2e 대상 |
| `scripts/inline.js` | 라이브러리를 프로토타입 파일 안에 넣어 자체 완결 HTML 생성 |
| `tests/lint.js` | 의존성 없는 정적 검사 |
| `tests/e2e.js` | Playwright 브라우저 회귀 |
| `tests/smoke.js` | 예제 전수 클릭 스모크 (아무거나 눌러도 안 죽는가) |

## 검증 (변경 후 반드시)

```bash
node tests/lint.js   # 의존성 없음
node tests/e2e.js    # playwright 설치된 폴더에서
node tests/smoke.js  # 예제 전수 클릭 — JS 에러 0 (릴리스 전)
```

둘 다 통과해야 커밋한다. CI(`.github/workflows/ci.yml`)가 push·PR·태그마다 같은 것을 돌린다.

## 문서 동기화 (기계가 강제한다)

lint가 아래를 검사하므로, 코드를 바꾸면 문서도 같이 고쳐야 통과한다.

- 설정 필드를 추가·삭제하면 `docs/config.md`에 반영 (필드 커버리지 검사)
- `ANNO` 레지스트리를 바꾸면 `README.md`·`docs/config.md` 표에 반영
- README의 빠른 시작 예제는 e2e가 실제로 실행한다. API를 바꾸면 예제도 고쳐야 한다
- 폐기한 설계 용어를 문서에 남기지 않는다 (드리프트 검사)
- 버전은 헤더 주석·워터마크 배지·문서 CDN 태그가 한 계열이어야 한다

## 백로그 싱크 (GitHub Issues ↔ Notion 보드)

GitHub 이슈가 원본이고, Notion 보드는 우선순위 판단용이다. 둘이 어긋나면 판단이 틀어지므로 검사로 막는다.

```bash
node scripts/backlog-sync.js           # 드리프트 보고 (기본 dry-run). 어긋나면 exit 1
node scripts/backlog-sync.js --apply   # 노션 쪽을 맞추고 실행 후 자동 재검증
```

잡는 것: 열린 이슈에 카드 없음 · 닫힌 이슈인데 카드가 완료가 아님 · 카드는 완료인데 이슈는 열림 · 죽은 링크.
`NOTION_API_KEY`는 `.env.local`에서 읽는다 (커밋 금지). CI에는 넣지 않는다 — 토큰이 필요한 로컬 검사다.

## 릴리스

1. lint·e2e 통과 확인
2. `CHANGELOG.md`에 항목 추가
3. 버전 문자열 갱신: `screenspec.js` 헤더·배지, `README.md`·`SKILL.md`의 `@vX.Y.Z`
4. commit → `git tag vX.Y.Z` → `git push origin main --tags`
5. jsDelivr 퍼지: `https://purge.jsdelivr.net/gh/charmisuk/screenspec@vX.Y.Z/screenspec.js` 와 `@0`

## 코드 규칙

- 의존성·빌드 단계를 추가하지 않는다. 단일 파일 유지가 이 프로젝트의 제약이다
- CSS는 `:where()`로 리셋해 호스트 페이지 스타일과 싸우지 않는다 (특정도 0)
- 액센트 계열 색을 하드코딩하지 않는다. `--ss-accent` 토큰과 `color-mix`만 사용 (lint가 검사)
- overlay 모드 UI는 브라우저 최대 z 대역에 둔다. 앱의 z-index와 경쟁하지 않는다
- 사용자 문자열은 `esc()`로 이스케이프한다

## 이슈

버그·요청은 https://github.com/charmisuk/screenspec/issues 로. 제목은 `[버그]` 또는 `[요청]` + 한 줄 요약.
