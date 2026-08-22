# ScreenSpec 적용 스킬 (AI 하네스)

> 이 문서는 사람용 설명서가 아니라 **AI(Claude 등)가 프로토타입에 ScreenSpec를 적용할 때 따르는 작업 지시서**다.
> 사용자가 "스펙레이어 적용해줘", "화면정의서 붙여줘"라고 하면 이 순서대로 실행한다.

## 목표

프로토타입 HTML에 ScreenSpec를 심어, 같은 파일이 두 모드를 갖게 한다:
- **프로토타입 모드**: 원본 그대로 (마커 숨김)
- **화면정의서 모드**: 헤더(화면 ID·화면명·화면 경로) + 좌측 축소 미리보기 + 우측 기능 설명.
  프로토타입은 이 모드에서도 살아 있다 — 버튼·내비게이션 동작, 화면이 바뀌면 헤더·기능 설명 자동 전환.

## 작업 순서

### 1. 화면 메타 정의

```
화면 ID   : SCR-{프로젝트 약어}-{화면 약어}-{3자리 번호}   ex. SCR-BMD-CAL-001
화면명    : 한국어 명사구, 15자 이내                       ex. 식단 캘린더 주간
화면 경로 : 기획 IA 관점 배열 (URL 아님)                   ex. ["홈","식단 캘린더","주간 탭"]
            이 배열이 그대로 화면 목록의 계층 트리가 된다 (마지막 = 화면 자신, 앞 = 그룹, 최대 4뎁스 표시)
```

- **프로젝트에 이미 화면 ID 체계가 있으면 그것을 그대로 따른다** (예: S-01, SCR-#, 자유 형식 전부 허용 — 위 규칙은 체계가 없을 때의 기본값일 뿐, 새 체계를 강요하지 않는다). ID는 라이브러리에서 자유 형식 문자열로 취급된다.
- 같은 프로젝트에서 번호는 001부터 순차 증가.
- 프로젝트 약어를 사용자가 안 줬으면 서비스명에서 3글자로 만들고 보고 시 명시.
- ID 중복·존재하지 않는 flowTo는 브라우저 콘솔에 경고가 뜬다 — 적용 후 콘솔 확인.

### 2. 주요 영역에 `data-spec` 부여

- 화면에서 **기획 의도가 있는 영역** 8~12개 (전부 다는 것 금지 — 정의할 말이 있는 곳만).
- 위→아래, 좌→우 순서로 `data-spec="1"`부터. 부여 대상은 영역의 **최상위 컨테이너**.
- 다중 화면이면 화면(root) 안에서만 찾으므로 화면마다 1부터 다시 시작 가능.

### 3. `window.SCREENSPEC` 설정 작성

**단일 화면:**
```html
<script>
window.SCREENSPEC = {
  screen: { id:"SCR-XXX-001", name:"화면명", path:["홈","..."] },
  widths: { mobile:430, pc:1440 },
  specs: [
    { n:1, target:"1", anno:"box", title:"영역명", defs:[
      { t:"기능 설명 한 줄", subs:["하위 조건 한 줄"] }
    ]},
  ]
};
</script>
<script src="./screenspec.js"></script>
```

**다중 화면 (SPA — 화면 20개도 이 구조):**
```html
<script>
window.SCREENSPEC = {
  screens: [
    { id:"SCR-XXX-001", name:"목록", path:["홈","목록"],
      root:'[data-ss-screen="SCR-XXX-001"]', specs:[ /* 이 화면의 정의 */ ] },
    { id:"SCR-XXX-002", name:"상세", path:["홈","목록","상세"],
      root:'[data-ss-screen="SCR-XXX-002"]', specs:[ ... ] }
  ]
};
</script>
```
- 각 화면의 컨테이너 요소에 `data-ss-screen="SCR-XXX-001"` 부여.
- 화면 전환이 표시/숨김(display 등)으로 일어나면 **자동 감지**되어 헤더·기능 설명가 따라 바뀐다.
- 감지가 안 되는 구조(동일 DOM 재사용 등)면 프로토타입의 내비 코드에 `window.ScreenSpec.setScreen("SCR-XXX-002")` 한 줄 추가.

### 3-B. 프레임워크 프로토타입(React·Next·Vue) = 오버레이 모드

Next.js 등 프레임워크 기반이면 화면을 감싸지 않는 오버레이 모드를 쓴다 (자동 감지되지만 명시가 안전):

- `window.SCREENSPEC`에 `mode:"overlay"` 명시
- 화면 구분은 `screens[].route`에 라우트 경로: `"/members"`, 동적 세그먼트는 `"/members/[id]"`
- 앱이 basePath(예: /admin) 아래에 있어도 suffix 매칭으로 동작 — route는 basePath 없이 적는다
- 해시 라우터(주소가 #/members 형태)도 자동 인식 — route는 동일하게 "/members"로 적는다
- 라우트가 없는 패널·다이얼로그 화면은 `root` 셀렉터(컨테이너 표시 여부)로 구분 가능
- Next.js(App Router) 적용: `app/layout.tsx`의 `<body>` 안에

```tsx
import Script from "next/script";
// <body> 안:
<Script id="screenspec-config" strategy="afterInteractive">{`window.SCREENSPEC = {...}`}</Script>
<Script src="https://cdn.jsdelivr.net/gh/charmisuk/screenspec@v0.10.0/screenspec.js" strategy="afterInteractive" />
```

- `data-spec` 속성은 JSX 요소에 그대로 (`data-spec="1"`)
- 오버레이 모드에는 기기 뷰포트 시뮬레이터가 없다 (앱 자체 반응형 사용) — 미디어쿼리 훅(§6)도 불필요
- 주의: 앱이 자체 고정 헤더(top:0)를 쓰면 정의서 모드에서 ScreenSpec 헤더(48px)와 겹칠 수 있다 — 이 경우 사용자에게 보고

**액센트 컬러**: `accent` 옵션으로 포인트 컬러 묶음(마커·하이라이트·버튼·드래그 그립·목차 활성 전체)을 교체할 수 있다 — 프리셋 `blue`(기본)·`red`·`orange`·`green`·`purple` 또는 hex(`"#7C3AED"`).

**앱형 프로토타입**(모바일 앱처럼 전면 사용): 시트 기본 여백을 제거한다 — `.ss-wrap .ss-sheet{padding:0}`

**screenspec.js 로드**: 이 저장소의 `screenspec.js`를 프로토타입 파일 옆에 복사하고 `<script src="./screenspec.js"></script>`로 `</body>` 직전에 로드 (프로토타입 자체 스크립트보다 뒤). 저장소는 private이므로 CDN URL은 쓰지 않는다.

### 4. 기능 설명 텍스트 작성 룰 (하네스 핵심 — 반드시 준수)

1. **한 줄 = 사실 하나.** 결과·값·개수 중심. 과정 서술 금지
2. **명사형 종결**: "~표시" "~이동" "~금지" (문장체 X)
3. **숫자·경로·키는 정확히**: 1024×1536, cards/{slug}.jpg — 디테일한 값은 생략 없이
4. **조건·분기는 하위 불렛(subs)으로 분리.** 본문에 섞지 않음
5. **이유는 필요할 때 1개만**, 대시(—) 뒤에 짧게
6. **색상·간격 등 디자인 값은 토큰명으로 지칭** (디자인 시스템이 있는 경우)

항목당 defs는 1~4줄, subs는 항목당 0~3줄. 그 이상이면 영역을 쪼갠다.

### 5. anno 타입 선택 룰 (8종)

| 타입 | 라벨 | 언제 | 추가 필드 |
|---|---|---|---|
| `box` | 영역 | 기본값. 영역 설명 | — |
| `arrow` | 화살표 | 작은 요소(아이콘·버튼)라 박스가 안 보일 때 | — |
| `input` | 입력 | 입력 필드 정책 (글자수·형식·검증·placeholder) | — |
| `state` | 상태 | 조건부 표시·상태 분기 (로그인 여부, 데이터 유무, 빈 상태) | — |
| `motion` | 모션 | 등장·전환 애니메이션 정의 | — |
| `action` | 동작 | 클릭하면 화면 안에서 동작이 일어남 (토스트·복사 등) | `play:{selector:"#btn", label:"동작 재생 — 결과"}` |
| `popup` | 팝업 | 클릭하면 모달·레이어·바텀시트 열림 | `play:{selector:"#btn", label:"팝업 열기"}` |
| `flow` | 이동 | 클릭하면 다른 화면으로 전환 | `flowTo:"SCR-XXX-002"` (+실제 내비 버튼 있으면 `play.selector`도) |

- 판단 순서: 화면 이동? → flow / 레이어 열림? → popup / 그 외 동작? → action / 입력 필드? → input / 조건 분기? → state / 모션 정의? → motion / 작아서 안 보임? → arrow / 나머지 → box
- 새 타입이 필요하면 screenspec.js의 `ANNO` 레지스트리에 한 줄 추가 (label + mech: box·arrow·play·flow 중 택1).

### 6. 반응형 훅

- 라이브러리가 시트 폭에 따라 `.ss-pc`(≥1100px) / `.ss-narrow`(≤520px) 클래스를 시트에 부여한다.
- 프로토타입 CSS의 반응형 분기는 **미디어쿼리 대신 이 훅으로** 작성한다
  (폭 시뮬레이터가 컨테이너 폭만 바꾸므로 미디어쿼리는 반응하지 않는다).

```css
.ss-sheet.ss-pc .page-inner { display:grid; grid-template-columns:1fr 320px; }
.ss-sheet.ss-narrow .some-grid { grid-template-columns:1fr; }
```

### 7. 완료 전 자가 검증

- [ ] 두 모드 전환 시 에러 없음 (콘솔 확인)
- [ ] 마커 번호와 기능 설명 번호 일치, 누락 없음
- [ ] 기능 설명 전 항목이 4번 작성 룰 통과
- [ ] PC 폭(1440)에서 화면정의서 모드 축소 배치 정상
- [ ] 다중 화면이면: 화면 전환 시 헤더·기능 설명가 따라 바뀌는지 확인
- [ ] `data-spec` 없는 specs 항목 없음 (마커가 숨겨지면 이것)

검증 후 사용자에게: 화면 ID 목록, 항목 수, 열어보는 법(모드 전환 위치)만 짧게 보고.

### 8. 없는 기능은 만들지 않는다 (일관성 룰)

라이브러리가 지원하지 않는 것(화면 목록 뷰, 공통 컴포넌트 참조, 흐름도, 내보내기, 코멘트 등)이 필요해 보여도 **즉석에서 자체 구현하거나 라이브러리를 수정하지 않는다.** 필요 목록만 사용자에게 보고한다 — 기능은 이 저장소에서 한 곳으로 추가되어야 모든 프로토타입이 일관된다.
깃허브 계정 권한이 있으면 보고와 함께 https://github.com/charmisuk/screenspec/issues 에 이슈로도 등록한다 (제목: [요청] 또는 [버그] + 한 줄 요약, 본문: 상황·기대 동작).

### 9. 트러블슈팅

| 증상 | 원인·조치 |
|---|---|
| 아무것도 안 뜸 | 콘솔에 [ScreenSpec] 로드 메시지가 있는지 확인. 없으면 스크립트 로드 실패 — CDN 차단 환경이면 screenspec.js 파일 복사 후 상대경로 로드 |
| 마커가 안 보임 | 콘솔 경고 확인: "data-spec 요소를 못 찾은 정의 N건" — 해당 화면 JSX/HTML에 data-spec 속성 누락. 마커는 화면정의서 모드에서만 보인다 |
| 헤더가 "정의되지 않은 화면" | 현재 라우트가 screens에 없음 — 해당 route를 screens에 추가 (정상 동작이며 커버리지 갭 표시용) |
| 화면 전환이 감지 안 됨 | 라우트 기반이 아니면 root 셀렉터 방식 사용, 그것도 안 되면 내비 코드에 window.ScreenSpec.setScreen(id) 한 줄 |
| 프레임워크 화면이 깨짐 | wrap 모드로 붙인 것 — mode:"overlay" 명시 |
| 앱 고정 헤더와 겹침 | 알려진 한계 — 사용자에게 보고 (§3-B 주의) |
