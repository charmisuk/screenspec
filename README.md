# ScreenSpec

**HTML 프로토타입에 `<script>` 한 줄을 붙여 화면정의서로 바꾸는 단일 파일 라이브러리.**
캡처 떠서 노션·컨플루언스에 번호 붙이고 설명 다는 작업을 없앤다.

[![MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE) [![CDN](https://img.shields.io/badge/CDN-jsDelivr-orange)](https://cdn.jsdelivr.net/gh/charmisuk/screenspec@0/screenspec.js) [![CI](https://github.com/charmisuk/screenspec/actions/workflows/ci.yml/badge.svg)](https://github.com/charmisuk/screenspec/actions/workflows/ci.yml)

▶ **[라이브 데모 열기](https://charmisuk.github.io/screenspec/examples/shop.html)** · 상단 "화면정의서" 버튼을 눌러보면 된다

| 프로토타입 모드 | 화면정의서 모드 |
|---|---|
| ![프로토타입 모드](docs/shot-proto.png) | ![화면정의서 모드](docs/shot-doc.png) |

- **단일 파일 · 의존성 0** — `<script>` 한 줄. 빌드·설치·계정 없음
- **프로토타입은 살아 있다** — 정의서 모드에서도 버튼이 눌리고 화면이 넘어간다
- **화면이 바뀌면 문서도 따라간다** — 헤더·기능 설명·목차가 자동 전환
- **React·Next도 지원** — DOM을 건드리지 않는 오버레이 모드 (GA 스니펫 원리)
- **AI가 대신 붙인다** — [SKILL.md](SKILL.md)를 읽히면 번호·설명까지 알아서
- **MIT** — 개인·상업 자유

## 이게 나한테 필요한가

**맞는 경우**

- AI(Claude 등)로 프로토타입 HTML을 만들고, 그걸 개발자에게 넘길 화면정의서가 따로 필요한 기획자
- 프로토타입을 고칠 때마다 문서 캡처를 다시 뜨는 게 반복 작업이라고 느끼는 사람
- 문서와 실물이 어긋나는 게 싫은 사람 (여기선 문서가 곧 실물이다)

**안 맞는 경우**

- 아직 프로토타입이 없다 → 이 도구는 **이미 있는 HTML에 얹는** 물건이다. 프로토타입부터 만들어야 한다
- 피그마 시안에 주석을 달고 싶다 → 피그마 코멘트나 Zeplin이 맞다
- 실서비스에 상시 켜둘 리뷰 도구가 필요하다 → BugHerd·Vercel Toolbar 같은 상용 도구가 맞다
- 여러 명이 코멘트로 토론해야 한다 → 아직 없다 ([로드맵](#로드맵))

## 빠른 시작 (2분)

아래를 통째로 복사해 `test.html`로 저장하고 브라우저로 열면 끝이다. 설치할 것은 없다.

```html
<!doctype html>
<html lang="ko">
<body>
  <header data-spec="1">
    <h1>주간 리포트</h1>
    <p>8월 3주차</p>
  </header>
  <button id="save" data-spec="2" onclick="this.textContent='저장됨'">저장</button>

  <script>
  window.SCREENSPEC = {
    screen: { id: "SCR-RPT-001", name: "주간 리포트", path: ["홈", "리포트"] },
    specs: [
      { n: 1, target: "1", anno: "box", title: "상단 헤더", defs: [
        { t: "리포트 제목 + 조회 기간 표시" },
        { t: "기간은 이번 주 월요일 기준 자동 계산" }
      ]},
      { n: 2, target: "2", anno: "action", title: "저장 버튼",
        play: { selector: "#save", label: "동작 재생: 저장" }, defs: [
        { t: "탭 시 저장 후 버튼 문구가 '저장됨'으로 변경", subs: ["미입력 항목이 있으면 저장 차단"] }
      ]}
    ]
  };
  </script>
  <script src="https://cdn.jsdelivr.net/gh/charmisuk/screenspec@0/screenspec.js"></script>
</body>
</html>
```

이 코드가 하는 일:

1. 설명할 영역에 `data-spec="1"`, `data-spec="2"` 번호를 붙였다
2. `window.SCREENSPEC`에 화면 정보(ID·화면명·경로)와 번호별 설명을 적었다
3. 마지막 줄이 라이브러리다. 열면 상단에 **프로토타입 / 화면정의서** 토글이 생긴다

화면정의서 모드로 바꾸면 영역에 번호 마커가 붙고 오른쪽에 기능 설명이 나온다.
2번 항목의 **▶ 동작 재생**을 누르면 실제로 저장 버튼이 눌린다.

### 전달할 때는 파일 하나로 뽑는다

위 방식은 열 때마다 인터넷에서 라이브러리를 가져온다. 만드는 중에는 편하지만, **남에게 넘기거나 나중에 다시 열 문서**로는 두 가지가 걸린다:
인터넷이 막힌 곳(클로드 대화창 미리보기·사내망·오프라인)에서 조용히 안 뜨고, 우리가 라이브러리를 고치면 이미 넘긴 문서가 몰래 바뀐다.

그래서 전달본은 라이브러리를 **파일 안에 넣어** 뽑는다. 명령 한 줄이고, 프로그램이 복사하므로 사람이 코드를 만질 일은 없다.

```bash
node scripts/inline.js 내프로토타입.html     # → 내프로토타입.inline.html
```

나온 파일은 어디서든 열리고, 그 시점 그대로 고정된다. 최신으로 올리고 싶으면 같은 명령을 한 번 더 치면 된다.
원본은 그대로 두고 전달본만 다시 뽑는 구조라, 원본을 고칠 일은 없다.

**주소 고르기** (원본용): `@0`은 릴리스가 나올 때마다 자동 반영, `@v0.14.0`처럼 태그를 박으면 그 시점으로 고정.

## 두 가지 모드

| 모드 | 대상 | 붙이는 법 |
|---|---|---|
| `wrap` (기본) | 단일 HTML 프로토타입 | 위 빠른 시작 그대로. 기기 뷰포트 시뮬레이터(모바일 360×800 · PC 1920×1080 + 드래그) 포함 |
| `overlay` | React · Next · Vue 등 프레임워크 | DOM을 건드리지 않고 얹기만 한다. 화면 구분은 라우트로 |

프레임워크는 자동 감지되지만 명시가 안전하다. 화면마다 `route`를 적으면 라우트 이동을 따라 문서가 바뀐다.

```js
window.SCREENSPEC = {
  mode: "overlay",
  screens: [
    { id: "S-01", name: "대시보드", path: ["대시보드"], route: "/", specs: [] },
    { id: "S-09", name: "이용자 명단", path: ["이용자", "명단"], route: "/members", specs: [] }
  ]
};
```

Next.js(App Router) 적용법은 [SKILL.md](SKILL.md)에 스니펫이 있다.

## AI에게 맡기기

이 저장소에는 AI용 작업 지시서 [SKILL.md](SKILL.md)가 들어 있다. 프로토타입을 만든 AI에게 이렇게 말하면 된다.

```
이 프로토타입에 ScreenSpec을 적용해줘.
https://github.com/charmisuk/screenspec 의 SKILL.md를 읽고 그대로 따라줘.
```

AI가 화면 ID 규칙·번호 부여·설명 작성 룰·자가 검증까지 따른다. 에이전트용 진입점은 [AGENTS.md](AGENTS.md)·[llms.txt](llms.txt)에도 안내돼 있다.

## anno 타입 8종

무엇을 표현할 수 있는지의 목록이다. 필드 상세는 [설정 레퍼런스](docs/config.md).

| 타입 | 언제 쓰나 |
|---|---|
| `box` | 기본값. 영역 설명 |
| `arrow` | 아이콘·버튼처럼 작아서 박스가 안 보일 때 |
| `input` | 입력 필드 정책 (글자수·형식·검증) |
| `state` | 조건부 표시·상태 분기 (로그인 여부, 빈 상태) |
| `motion` | 등장·전환 애니메이션 |
| `action` | 클릭 시 화면 안에서 동작 → ▶ 실제 재생 |
| `popup` | 클릭 시 모달·바텀시트 → ▶ 실제 열림 |
| `flow` | 클릭 시 다른 화면으로 → ▶ 실제 이동 + 문서 동시 전환 |

## 설정 레퍼런스

전체 필드(타입·기본값·필수 여부)는 **[docs/config.md](docs/config.md)** 한 장에 있다.
화면 목록 트리·액센트 컬러·CSS 훅·JS API·콘솔 경고 메시지도 여기 정리돼 있다.

## 자주 막히는 곳

| 증상 | 원인·조치 |
|---|---|
| 아무것도 안 뜬다 | 콘솔에 `[ScreenSpec]` 메시지가 있는지 확인. 없으면 스크립트 로드 실패 |
| 클로드 대화창 미리보기에서 안 보인다 | 그 화면은 바깥 주소를 막는다(실측 확인). 전달본(`.inline.html`)을 뽑아 올리거나, 코드를 `.html`로 저장해 브라우저에서 열면 된다 |
| 넘긴 문서가 나중에 열어보니 달라져 있다 | CDN 한 줄짜리 원본을 넘긴 것. 전달은 항상 `.inline.html`로 — 그 파일은 바뀌지 않는다 |
| "설정이 없습니다" 카드가 뜬다 | 스크립트만 넣고 `window.SCREENSPEC`을 안 적은 상태. 위 빠른 시작 참고 |
| 번호 마커가 안 보인다 | 화면정의서 모드에서만 보인다. 그래도 없으면 `data-spec` 속성 누락 (콘솔 경고 확인) |
| 화면이 바뀌어도 문서가 그대로 | 자동 감지 실패. `root`(단일 HTML)나 `route`(프레임워크) 지정, 또는 `ScreenSpec.setScreen(id)` 호출 |
| 프레임워크 화면이 깨진다 | wrap으로 붙은 것. `mode: "overlay"` 명시 |

## 예제

- [shop.html](https://charmisuk.github.io/screenspec/examples/shop.html) — 대표 데모. 이커머스 2화면, anno 8타입 전부, PC 반응형
- [tree.html](https://charmisuk.github.io/screenspec/examples/tree.html) — 화면 목록 트리 (11화면·4뎁스·미정의 혼합)
- [demo.html](https://charmisuk.github.io/screenspec/examples/demo.html) — 단일 화면 (콘텐츠형)
- [multi-screen.html](https://charmisuk.github.io/screenspec/examples/multi-screen.html) — 다중 화면 + flow·popup
- [overlay-spa.html](https://charmisuk.github.io/screenspec/examples/overlay-spa.html) — 오버레이 모드 (React·Next와 같은 구조)

## 개발

```bash
node tests/lint.js  # 문법·버전 정합·문서 드리프트 (의존성 없음)
node tests/e2e.js   # 브라우저 회귀 (playwright 필요)
```

전달본 만들기: `node scripts/inline.js 프로토타입.html` — 라이브러리를 파일 안에 넣어 바깥 요청 없이 동작하는 `.inline.html`을 만든다 (실행 후 자동 검증).

백로그(GitHub 이슈 ↔ Notion 보드) 싱크 검사는 `node scripts/backlog-sync.js` — 토큰이 필요해 로컬에서만 돈다.

모든 push·PR·태그에서 GitHub Actions가 lint·e2e 둘 다 돌린다. CI가 빨간 상태로는 릴리스하지 않는다.
문서도 검사 대상이다: 이 README의 빠른 시작 예제는 CI가 실제로 실행해보고, 설정 필드가 레퍼런스에서 빠지면 실패한다.

버그·요청은 [이슈](https://github.com/charmisuk/screenspec/issues)로. 변경 이력은 [CHANGELOG.md](CHANGELOG.md).

## 로드맵

- [ ] 코멘트 레이어 (핀 + 스레드, 게스트 참여)
- [ ] 공유 링크 호스팅
- [ ] PDF · Confluence 내보내기

## 라이선스

MIT
