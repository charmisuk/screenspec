# ScreenSpec

**프로토타입 자체가 화면정의서가 되는 오버레이.**

▶ **[라이브 데모 바로가기](https://charmisuk.github.io/screenspec/examples/shop.html)** — 모바일·PC 모두 지원

| 프로토타입 모드 | 화면정의서 모드 |
|---|---|
| ![프로토타입 모드](docs/shot-proto.png) | ![화면정의서 모드](docs/shot-doc.png) |

| 화면 목록 (헤더의 화면 ID 칩 클릭 → 트리) |
|---|
| ![화면 목록 트리](docs/shot-toc.png) |

AI로 만든 프로토타입 HTML에 스크립트 하나를 얹으면, 같은 파일이 두 모드를 갖는다:

| 모드 | 내용 |
|---|---|
| **프로토타입** | 원본 그대로. 시연·데모용 |
| **화면정의서** | 화면 ID·화면명·화면 경로 헤더 + 좌측 축소 미리보기(번호 마커) + 우측 기능 설명(노션풍 불렛) |

캡처 떠서 노션·컨플루언스에 번호 붙이고 설명 다는 작업이 사라진다.
마커 ↔ 기능 설명 양방향 연결, 클릭한 영역 바운더리 강조.
**화면정의서 모드에서도 프로토타입은 살아 있다** — 버튼이 동작하고, 화면이 바뀌면 헤더·기능 설명가 자동으로 따라간다.

## 시작하기

**방법 A — CDN 한 줄 (public 레포, 회사 프로토타입에 붙일 때):**

```html
<script src="https://cdn.jsdelivr.net/gh/charmisuk/screenspec@v0.11.0/screenspec.js"></script>
```

주소 선택 — 용도에 따라:

- 박제(산출물 보존): `@v0.11.0` — 그 시점 그대로 영원히
- **자동 최신(권장)**: `@0` — 정식 릴리스(태그)가 나올 때마다 자동 반영. CI 통과본만 흘러온다

```html
<script src="https://cdn.jsdelivr.net/gh/charmisuk/screenspec@0/screenspec.js"></script>
```

**방법 B — 파일 복사 (오프라인·사내망):**

1. 이 저장소를 클론하거나 `screenspec.js` 파일을 받는다
2. 프로토타입을 만든 AI(Claude 등)에게:

```
이 프로토타입에 ScreenSpec를 적용해줘.
규칙: (클론 폴더)/SKILL.md 를 읽고 그대로 따라줘.
screenspec.js는 프로토타입 파일 옆에 복사해서 상대경로로 로드해줘.
```

AI가 SKILL.md의 하네스(화면 ID 규칙, 기능 설명 작성 룰, anno 타입 선택)를 따라 알아서 심는다.

## 수동 적용

```html
<!-- 1. 주요 영역에 번호 부여 -->
<div class="hero" data-spec="1">...</div>

<!-- 2. body 끝에 설정 + 스크립트 -->
<script>
window.SCREENSPEC = {
  screen: { id:"SCR-XXX-001", name:"화면명", path:["홈","메뉴","상세"] },
  specs: [
    { n:1, target:"1", anno:"box", title:"히어로 영역", defs:[
      { t:"기능 설명 한 줄", subs:["하위 조건"] }
    ]}
  ]
};
</script>
<script src="./screenspec.js"></script>
```

## 다중 화면 (SPA)

화면이 여러 개면 `screens` 배열로. 각 화면 컨테이너에 `data-ss-screen="SCR-ID"`를 붙이면
표시/숨김 전환을 자동 감지해 헤더·기능 설명가 따라 바뀐다. 수동 전환: `window.ScreenSpec.setScreen("SCR-ID")`.

```js
window.SCREENSPEC = {
  screens: [
    { id:"SCR-XXX-001", name:"목록", path:["홈","목록"],
      root:'[data-ss-screen="SCR-XXX-001"]', specs:[...] },
    { id:"SCR-XXX-002", name:"상세", path:["홈","목록","상세"],
      root:'[data-ss-screen="SCR-XXX-002"]', specs:[...] }
  ]
};
```

## 액센트 컬러 (묶음 테마)

```js
window.SCREENSPEC = { accent: "orange", ... }  // blue(기본)·red·orange·green·purple 또는 "#7C3AED"
```

포인트 컬러 하나로 마커·하이라이트·재생 버튼·드래그 그립·목차 활성이 세트로 바뀐다.

## 두 가지 모드 (자동 판별)

| 모드 | 대상 | 특징 |
|---|---|---|
| `wrap` | 단일 HTML 프로토타입 | 기기 뷰포트 시뮬레이터 포함 전 기능 |
| `overlay` | React·Next·Vue 등 프레임워크 | DOM 불변 (GA 스니펫 원리) · 라우트 기반 화면 추적 |

오버레이 예제: [`examples/overlay-spa.html`](examples/overlay-spa.html)

## anno 타입 (8종)

| 타입 | 라벨 | 용도 | 시각 동작 |
|---|---|---|---|
| `box` | 영역 | 기본. 영역 설명 | 바운더리 하이라이트 |
| `arrow` | 화살표 | 작은 요소 지시 — 바깥에서 요소를 가리키는 지시선 자동 · `arrowTo`로 요소→요소 관계선 | 화살표 |
| `input` | 입력 | 입력 필드 정책 | 하이라이트 |
| `state` | 상태 | 조건부 표시·상태 분기 | 하이라이트 |
| `motion` | 모션 | 애니메이션 정의 | 하이라이트 |
| `action` | 동작 | 클릭 시 화면 내 동작 | ▶ 버튼 → 실제 동작 재생 |
| `popup` | 팝업 | 모달·레이어 열림 | ▶ 버튼 → 실제 팝업 열림 |
| `flow` | 이동 | 다른 화면으로 전환 | ▶ 버튼 → 실제 화면 이동 + 정의서 전환 |

새 타입은 `screenspec.js`의 `ANNO` 레지스트리에 한 줄 추가 (label + mech).

## 기능

- 모드 토글: 프로토타입 / 화면정의서
- **화면 목록(목차)**: 정의서 헤더의 화면 ID 칩 클릭 → 트리(Figma 레이어·Notion 사이드바 패턴). 뎁스 = 들여쓰기 + 세로 가이드선, 화면이 아닌 중간 경로는 회색 그룹 행, 화면 행은 ● 이름 + ID(미정의는 ○ + "미정의"), 커버리지(N/M 정의됨), 행 클릭 이동, 최대 6뎁스 들여쓰기. 모바일은 전체 화면 시트. 화면 전환 시 "→ 화면명" 알림 토스트
- 기기 뷰포트(wrap): 모바일 360×800 · PC 1920×1080 프리셋 + 우측/하단/코너 드래그, 프리셋 클릭 시 복귀
- 화면정의서 모드에서 좌측 스테이지 자동 축소 배치, 마커·그립 크기는 유지
- 반응형 훅: `.ss-pc`(≥1100px) / `.ss-narrow`(≤520px) — 미디어쿼리 대신 사용 (SKILL.md §6)

## 예제 (개발자용 — 모드·기능별 참고 코드)

대표 데모는 위 하나로 충분하다. 아래는 적용 코드를 볼 때 여는 참고용:

- [shop.html](https://charmisuk.github.io/screenspec/examples/shop.html) — **대표 데모**: 이커머스 2화면 (홈·상세), anno 8타입 전부 시연, PC 반응형 훅
- [demo.html](https://charmisuk.github.io/screenspec/examples/demo.html) — wrap 단일 화면 (콘텐츠형 페이지, 10항목)
- [multi-screen.html](https://charmisuk.github.io/screenspec/examples/multi-screen.html) — wrap 다중 화면 + flow·popup
- [overlay-spa.html](https://charmisuk.github.io/screenspec/examples/overlay-spa.html) — overlay 모드 (React·Next 적용과 같은 구조)
- [tree.html](https://charmisuk.github.io/screenspec/examples/tree.html) — 화면 목록 트리 (11화면·4뎁스·그룹·미정의 혼합)

## 테스트

모든 push·PR·태그에서 GitHub Actions CI가 lint + e2e를 자동 실행한다 — CI가 빨간 상태에서는 릴리스하지 않는다.

```bash
# playwright가 설치된 폴더에서
node tests/lint.js  # 문법·오염·버전 정합·예제 정합·문서 드리프트 (의존성 없음)
node tests/e2e.js   # 브라우저 회귀 — 릴리스(태그) 전 전부 PASS 필수 (케이스 수는 실행 결과로 확인)
```

## 로드맵

- [ ] 코멘트 레이어 (핀 + 스레드, 게스트 참여)
- [ ] 공유 링크 호스팅 (클라우드)
- [ ] PDF / Confluence 내보내기

## 라이선스

MIT — 개인·상업 모두 자유롭게 사용할 수 있습니다.
