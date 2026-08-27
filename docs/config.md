# 설정 레퍼런스

ScreenSpec의 API는 전역 객체 `window.SCREENSPEC` 하나다. 이 문서가 전체 필드의 단일 출처이며,
라이브러리가 실제로 읽는 필드가 여기 없으면 CI가 실패한다 (`node tests/lint.js`).

- 처음이라면: [빠른 시작](../README.md#빠른-시작-2분)부터
- AI에게 맡기려면: [SKILL.md](../SKILL.md)

## 전체 구조

```ts
window.SCREENSPEC = {
  mode?:    "wrap" | "overlay" | "frame",  // 생략 = 자동 판별 (React·Next 감지 시 overlay). frame 은 명시 전용
  accent?:  string,               // "blue"|"red"|"orange"|"green"|"purple", "#7C3AED" 또는 "var(--brand)". 기본 blue
  baseViewport?: "mobile" | "pc",  // wrap·frame 시작 폭 = 이 문서가 서술하는 기준 폭. 기본 mobile
  devices?: { mobile?: Device, pc?: Device },  // wrap·frame. 기기 프리셋 덮어쓰기
  checklist?: string[],           // 프로젝트가 정한 상태 축. 있으면 화면마다 covers/skip 으로 커버리지 표시
  style?:   Style,                // 이 프로젝트의 «쓰는 법» — AI 가 읽는 계약. 라이브러리 렌더는 바뀌지 않는다
  off?:     boolean,              // true = 완전 정지. 원본 프로토타입 그대로 (주소에 ?screenspec=1 이면 켜진다)
  readonly?: boolean,             // true = 편집 잠금. 편집 버튼·저장 경로를 아예 만들지 않는다 (전달본용)

  // 화면이 하나면 screen + specs
  screen?:  Screen,               // specs 없이 메타만
  specs?:   Spec[],

  // 화면이 여럿이면 screens (screen·specs 대신)
  screens?: Screen[],
}

type Screen = {
  id:      string,      // 필수. 자유 형식 (S-01, SCR-XXX-001 등 프로젝트 체계 그대로)
  name:    string,      // 필수. 화면명
  path?:   string[],    // 기획 IA 경로. 이 배열이 그대로 화면 목록 트리가 된다
  specs?:  Spec[],      // 이 화면의 기능 설명
  root?:   string,      // 이 화면의 컨테이너 CSS 셀렉터 (모든 모드 공통 · 표시 여부로 감지 · data-spec 조회 범위)
  route?:  string,      // overlay·frame: 라우트 경로. "/members", "/members/[id]"
  viewports?: string[], // 이 화면이 존재하는 폭. ["pc"] 면 목차에 「PC 전용」
  covers?: string[],    // checklist 중 이 화면이 실제로 적은 축
  skip?:   { [축: string]: string },  // 의도적으로 비운 축 = 사유. 사유가 없으면 미정의로 본다
  dev?:    Def[],       // 항목에 안 붙는 «화면 공통» 개발 정의. 정의 목록 맨 위 블록으로 나온다
}

type Spec = {
  n:        number,     // 필수. 마커 번호
  target:   string,     // 필수. data-spec 속성값 (문자열)
  anno?:    "box"|"arrow"|"input"|"state"|"motion"|"action"|"popup"|"flow",  // 기본 box
  title?:   string,     // 영역명 (위치 힌트는 자동)
  optional?: boolean,   // 조건부 요소 — 누락 경고 제외
  defs?:    Def[],      // 기능 설명 줄
  parts?:   Part[],     // 이 영역 안의 이름 있는 하위 요소. 라벨(1a·1b)은 라이브러리가 매긴다
  play?:    { selector: string, label: string },  // anno action·popup·flow: 재생 버튼
  preview?: { label?: string },  // 상태 재현 버튼. 누르면 앱에 screenspec:preview 이벤트를 쏜다
  flowTo?:  string,     // anno flow: 이동할 화면 id
  arrowTo?: string,     // anno arrow: 관계선을 그을 상대 요소 CSS 셀렉터
}

type Part = {           // 라벨은 적지 않는다 — parts[0] → "1a", parts[1] → "1b"
  title:    string,     // 하위 요소명
  target?:  string,     // 있으면 자기 마커를 갖는다. 없으면 패널에만
  anno?:    (Spec 과 동일 8종),
  optional?: boolean,   // 조건부 — 팝업·패널 안처럼 닫혀 있을 때는 없는 요소
  defs?:    Def[],
  play?:    { selector: string, label: string },
  preview?: { label?: string },  // Spec 과 동일 — 하위 요소도 상태 재현 버튼을 갖는다
  flowTo?:  string,
  arrowTo?: string,
}

type Style  = {           // 온보딩 인터뷰(SKILL §0)의 답이 남는 자리
  vocab?:    { prefixes?: string[], endings?: string[] },  // 생략 = SKILL §4 기본 한 벌
  idScheme?: string,      // 화면 ID 체계. 예: "SCR-{영역}-{번호}"
  notes?:    string,      // 자유 서술 — 「존댓말 금지」 같은 프로젝트 규칙
}
type Def    = { t: string, subs?: string[], why?: string, layer?: "dev" }  // why = 그 줄의 근거 (「↳ 이유:」로 분리 렌더) · layer 생략 = 기획
type Device = { w: number, h: number }
```

## 최상위 필드

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `mode` | `"wrap"` \| `"overlay"` \| `"frame"` | 자동 판별 | 단일 HTML은 wrap, React·Next 등 프레임워크는 overlay. 자동 판별이 틀릴 때만 명시. `"frame"`은 자동 판별되지 않는다 — 아래 참조 |
| `accent` | 프리셋명 \| hex \| `var(--x)` | `"blue"` (#2952E3) | 마커·하이라이트·재생 버튼·드래그 그립·목차 활성이 묶음으로 바뀐다. `"var(--color-accent)"`처럼 CSS 변수를 가리키면 제품 토큰을 복사하지 않고 따라간다(색 하드코딩 lint·다크 모드 대응). 인식 불가 값이면 콘솔 경고 후 기본값 |
| `baseViewport` | `"mobile"` \| `"pc"` | `"mobile"` | wrap·frame 의 시작 폭 = 이 문서가 서술하는 기준 폭. PC 앞에서 쓰는 어드민은 `"pc"`, 앱은 기본값. 반응형 차이는 화면을 늘리지 말고 같은 화면의 `anno:"state"` 항목으로 적는다 |
| `devices` | `{ mobile, pc }` | 아래 참조 | wrap·frame 전용. 기기 프리셋 크기 덮어쓰기 |
| `checklist` | string[] | — | 프로젝트가 정한 상태 축. 있으면 화면마다 `covers`/`skip` 로 커버리지를 표시한다. 없거나 문자열 배열이 아니면 기능이 꺼지고 콘솔 경고. 아래 [상태 커버리지](#상태-커버리지) 참조 |
| `style` | `Style` | — | 이 프로젝트의 문구·ID 체계를 적어 두는 자리. **AI 가 읽는 계약이며 라이브러리 동작은 바뀌지 않는다** — 정의서 렌더·마커·경고 어디에도 영향이 없다. [SKILL §0 적용 전 인터뷰](../SKILL.md)의 답이 여기 남아, 다음에 AI 가 다시 쓸 때도 같은 톤이 유지된다. 형식이 어긋나면 해당 항목만 무시하고 콘솔 경고 1회. 아래 [쓰는 법 고정](#쓰는-법-고정-style) 참조 |
| `off` | boolean | `false` | `true`면 라이브러리가 **아무것도 하지 않는다** — CSS·UI·DOM 어디에도 손대지 않고 원본 프로토타입 그대로. 정의는 코드에 남아 있고, 주소에 `?screenspec=1`을 붙이면 그때만 켜진다. 아래 [정의서 끄기](#정의서-끄기-off) 참조 |
| `readonly` | boolean | `false` | `true`면 **편집 모드가 아예 없다** — 패널의 「편집」 버튼도, 저장 경로도 만들지 않는다(숨김이 아니라 미생성). 남에게 넘기는 전달본이 고쳐지지 않게 할 때. 아래 [편집 모드](#편집-모드-readonly) 참조 |
| `screen` | `Screen` | — | 화면이 하나일 때. `specs`와 짝 |
| `specs` | `Spec[]` | `[]` | 화면이 하나일 때의 기능 설명 |
| `screens` | `Screen[]` | — | 화면이 여럿일 때. 있으면 `screen`·`specs`는 무시된다 |

`screens`·`screen`·`specs`가 모두 없으면 라이브러리는 페이지를 건드리지 않고 안내 카드만 띄운다.

> **폐기된 필드**: `panel`(v0.14 의 설명 패널 좌/우) — v0.15 부터 무시되고 콘솔 경고. 설명 패널은 오른쪽 고정이며, 앱의 우측 서랍과 겹치면 `mode:"frame"`.

**`mode: "frame"` (액자)** — 프레임워크 앱을 iframe(액자)에 넣고 뷰어(툴바·설명 패널·마커·목차)는 그 밖에 두는 모드.
overlay 는 앱과 뷰어가 한 창에 살기 때문에 (1) 설명 패널이 앱의 우측 드로어를 덮고 (2) 폭을 줄여도 앱의 미디어쿼리가 발화하지 않는다.
frame 은 앱을 액자 안에 가두므로 **설명 패널이 앱을 덮지 않고**, 툴바의 **모바일/PC 로 실제 미디어쿼리가 발화**한다(폭 시뮬레이터가 그대로 동작).
화면 추적은 overlay 와 같은 규칙(`route`·`root`)이고, 액자 안 경로는 바깥 주소에 미러링돼 새로고침해도 보던 화면으로 돌아온다.
조건: **앱이 주소(URL)로 열리고 same-origin** 일 것 (cross-origin 이면 액자 안을 조종할 수 없다). 명시해야만 켜진다.

### 쓰는 법 고정 (style)

프로젝트마다 문구 어휘도, 화면 ID 체계도 다르다. 그걸 적어 두지 않으면 AI 가 정의서를 다시 쓸 때마다 톤이 갈리고, 기획자가 매번 손으로 맞춰야 한다.

```js
window.SCREENSPEC = {
  style: {
    vocab: { prefixes: ["기본값 :", "선택값 :", "클릭 :"], endings: ["~가능", "~불가"] },
    idScheme: "SCR-{영역}-{번호}",
    notes: "존댓말 금지 · 숫자는 반각",
  },
  screens: [ /* … */ ],
};
```

| 필드 | 무엇 |
|---|---|
| `vocab.prefixes` | 정의 줄 앞에 붙이는 어휘 한 벌. 생략하면 [SKILL §4](../SKILL.md)의 기본 한 벌 |
| `vocab.endings` | 종결 어휘 |
| `idScheme` | 화면 ID 를 짓는 규칙. AI 가 새 화면을 추가할 때 따른다 |
| `notes` | 표로 안 잡히는 프로젝트 규칙을 문장으로 |

- **라이브러리는 이 값을 쓰지 않는다.** 읽는 것은 AI(SKILL.md)이며, 라이브러리는 형식만 검사해 어긋나면 콘솔로 1회 알린다. 그래서 `style` 을 넣거나 빼도 화면은 한 픽셀도 달라지지 않는다.
- 설정에 `vocab` 이 있으면 AI 는 **그것만 쓰고 기본 어휘와 섞지 않는다**.

### 개발 정의 레이어 (layer)

화면정의서는 기획자 혼자 쓰는 문서가 아니다. 개발 PM 이 같은 화면·같은 항목 옆에 **정책·API·이벤트**를 적는다.
그 자리를 문서 안에 만든다 — 컨플루언스 다른 페이지로 흩어지면 기획 정의와 따로 놀기 때문이다.

```js
{ n:1, target:"1", title:"목록", defs:[
  { t:"정렬 : 최신순" },                          // layer 생략 = 기획
  { t:"GET /api/items?page=&size=", layer:"dev" }, // 개발 정의
  { t:"빈 상태 : 「등록된 항목이 없습니다」" },
]}
```

**줄 단위**로 붙인다. 한 항목 안에 기획 정의와 개발 정의가 섞이는 것이 실무의 실제 모습이라서다.
항목에 안 붙는 화면 공통 정책은 화면의 `dev` 에 적는다.

```js
screen: { id:"SCR-XXX-001", name:"목록", dev:[{ t:"인증 : Bearer 토큰" },{ t:"4xx 는 토스트로" }] }
```

**보이는 모습** — 탭으로 가르지 않는다. 개발 정의는 기획 정의를 **보면서** 쓰는 글이다.

- `layer:"dev"` 줄들은 항목 행 **안에** 한 단 들여쓴 「개발」 블록으로 묶여, 다른 보더 색 + `DEV` 태그가 붙는다.
- 화면의 `dev` 는 정의 목록 **맨 위**에 「화면 공통」 블록 하나로 나온다.
- 설명 패널에 **레이어 칩 `전체 | 기획 | 개발`** 이 생긴다. 리뷰어는 기획만, 개발자는 개발만 볼 수 있다. 기본은 전체.
- 인쇄(PDF)에서도 같은 축으로 고를 수 있다.

**필터는 보기만 바꾼다.** 마커 개수·누락 정의 경고·상태 커버리지는 필터와 무관하게 그대로다.
행 자체도 숨기지 않는다 — 번호와 마커의 대응이 깨지면 안 되기 때문이다.

**하위 호환** — `layer` 와 `dev` 를 하나도 안 쓴 문서는 칩도 개발 블록도 생기지 않는다. 화면이 예전과 완전히 같다.

> 개발 정의는 지금 **자유 텍스트**다. API 경로·이벤트명 같은 구조 필드는 실제로 쓰는 모습을 본 뒤에 정한다.
> 두 사람이 동시에 쓰는 것·서명·이력은 이 단계의 범위가 아니다.

### 인쇄 · PDF

지금 보는 화면 하나를 **종이 문서 형태로** 뽑는다. 컨플루언스·노션·결재에 붙이는 산출물이 여기서 나온다.
서버도 계정도 필요 없다 — 브라우저의 「대상 → PDF 로 저장」이 곧 산출물이다.

정의서 패널 머리의 **「인쇄」** 버튼 → 대화상자에서 두 가지를 고른다.

| 선택 | 뜻 |
|---|---|
| **마커(번호) 표시** | 끄면 프로토타입만 깨끗하게 나온다 (`?screenspec=0` 과 같은 모습) |
| **항목 표 포함** | 끄면 그림만 나온다 |
| **레이어** | 전체 / 기획만 / 개발만. [개발 정의](#개발-정의-레이어-layer)가 있는 문서에서만 나온다 |

종이에 나오는 것은 네 덩이다.

1. **화면 머리** — 화면 ID · 화면명 · 경로
2. **프로토타입** — 폭 시뮬레이터의 축소를 풀고 A4 세로 폭에 맞춘다. A4 보다 넓은 PC 화면은 **잘라내지 않고 줄인다**
3. **항목 표** — 번호 · 영역명 · 유형 · 기능 설명 (하위 `1a`·`1b` 와 「↳ 이유」 포함)
4. **꼬리** — 화면 ID · 생성 일시 · Made with ScreenSpec

- 툴바·설명 패널·목차·툴팁은 종이에 나오지 않는다. **뷰어가 아니라 문서만** 남는다.
- 표의 행은 페이지 중간에서 잘리지 않고(`break-inside: avoid`), 여러 장이면 장마다 머리행이 다시 붙는다.
- 인쇄가 끝나면 화면은 **원래대로 돌아온다** — 프로토타입을 복제하지 않고 잠시 옮겼다가 제자리에 놓기 때문이다.
- 용지 방향은 브라우저 인쇄 창에서 바꿀 수 있다. 기본은 A4 세로다.
- overlay 모드는 앱이 페이지 그 자체라 옮길 시트가 없다 — 머리 · 표 · 꼬리만 나온다.
- **여러 화면 한꺼번에 뽑기**는 아직 없다. 화면을 바꿔 가며 한 장씩 뽑는다.

### 편집 모드 (readonly)

정의서를 **읽는 것**에서 **고치는 것**으로 넘기는 자리다. AI 가 쓴 초안을 사람이 손보는 것이 주 시나리오이므로,
고치는 사람이 `window.SCREENSPEC` 이라는 JS 객체를 보지 않아도 되게 만든다.

화면정의서 패널 머리의 **「편집」** 버튼을 누르면 켜진다 (프로토타입 모드에서는 패널 자체가 없으므로 보이지 않는다).

| 켜면 되는 것 | 아직 안 되는 것 |
|---|---|
| 항목명·설명 줄·이유·하위 줄 글자 수정 | 새 항목 추가 · 화면에서 요소를 집어 `target` 지정 |
| 설명 줄 추가·삭제, 이유 붙이기, 하위 줄 추가·삭제 | `anno` 타입 변경 · `play`/`preview`/`flowTo` 편집 |
| 항목 순서 바꾸기(↑↓) · 항목 삭제 · 세부(part) 삭제 | 화면(`screen`) 메타 편집 |

- 글자를 누르면 **그 자리에서** 고쳐진다. **Enter** 또는 바깥 클릭 = 반영, **Esc** = 취소.
- 순서를 바꾸거나 항목을 지우면 마커 번호(`n`)를 **1부터 다시 매긴다** — 번호가 비면 읽는 사람이 「빠졌나」를 의심하기 때문이다.
- 편집 중에도 마커·▶ 재생·상태 재현은 그대로 동작한다. 정의서는 살아 있는 문서다.

**저장 — 세 경로를 겹친다.** 어느 하나가 막혀도 고친 것을 잃지 않게 한다.

| 경로 | 하는 일 | 조건 |
|---|---|---|
| **파일에 저장** | 프로토타입 HTML 을 골라 그 파일의 `window.SCREENSPEC` 블록만 갈아끼운다 | 파일 접근 API 가 있는 브라우저(크로미움 계열). 없으면 버튼 자체가 안 생긴다 |
| **내려받기** | `이름.edited.html` 로 뱉는다 | 모든 브라우저 |
| **설정 복사** | 갱신된 `window.SCREENSPEC = {…};` 를 클립보드로 — 원본에 붙여넣거나 **AI 에게 「이걸로 교체해줘」** | 모든 브라우저 |

- 어느 경로든 **저장 안 된 초안이 브라우저에 자동으로 깔린다**. 저장 없이 닫았다 다시 열면 「저장 안 된 초안이 있습니다 — 이어서 / 버리기」 배너가 뜬다.
- 저장은 **설정 블록만** 바꾼다. 프로토타입의 나머지 코드는 바이트 그대로 남는다.
- 직렬화는 정해진 형식으로 다시 만든다(필드 순서 고정·들여쓰기 2칸). **원래 설정 블록 안에 적어 둔 주석은 사라진다.**
- 미저장 변경이 있으면 「편집」 버튼에 빨간 점이 붙고, 탭을 닫으려 하면 브라우저가 한 번 되묻는다.

```js
window.SCREENSPEC = {
  readonly: true,     // 이 사본은 못 고친다 — 편집 버튼도, 저장 경로도 없다
  screens: [ /* … */ ],
};
```

### 정의서 끄기 (off)

정의서를 붙이는 것과 **공개하는 것**은 다른 결정이다. 프로토타입만 보여주고 싶은 자리(초기 리뷰·외부 데모)가 있는데,
그때마다 정의를 뜯어냈다가 다시 붙이는 것은 낭비다. `off`로 스위치만 내린다.

```js
window.SCREENSPEC = {
  off: true,          // 이 한 줄만 추가 — 나머지 설정은 그대로 둔다
  screens: [ /* 정의는 그대로 남아 있다 */ ],
};
```

| 상태 | 화면 | 켜는 법 |
|---|---|---|
| `off: true` | 원본 프로토타입 그대로. 모드 토글·마커·설명 패널·주입 CSS 전부 없음 | 주소 끝에 `?screenspec=1` (또는 `#screenspec`) |
| `off` 없음(기본) | 지금까지처럼 정의서 모드 | — |
| 임시로 끄기 | — | 주소 끝에 `?screenspec=0` — 설정을 고치지 않고 그 탭에서만 끈다 |

- 주소 스위치가 설정보다 **강하다**. 그래서 `off: true`로 배포해 두고, 리뷰할 사람만 `?screenspec=1`로 열면 된다. 같은 파일 하나로 두 청중을 감당한다.
- off 상태에서도 `window.ScreenSpec.setScreen()`·`refresh()`는 **빈 함수로 남는다** — 프로토타입이 그 호출을 갖고 있어도 깨지지 않는다. `window.ScreenSpec.mode`는 `"off"`.
- `data-spec` 속성은 그대로 남지만 보이지도, 아무 영향도 주지 않는다 (그냥 속성이다).
- **화면에서 감추는 것이지 파일에서 빼는 것이 아니다.** `off`는 라이브러리를 멈출 뿐이라 정의 텍스트는 `window.SCREENSPEC` 안에 그대로 남는다 —
  전달본(`.inline.html`)에도 똑같이 들어간다. 받은 사람이 파일을 열면 읽힌다.
  정말 넘겨서는 안 되는 내용이면 `off`로 가리지 말고 그 정의를 지운 사본을 따로 만들어 전달한다.

**accent 프리셋**: `blue` #2952E3 · `red` #E5484D · `orange` #F76B15 · `green` #18794E · `purple` #8E4EC6

**devices 기본값**: `mobile` 360×800 · `pc` 1920×1080

```js
devices: { mobile: { w: 390, h: 844 } }   // 지정한 값만 덮어쓴다
```

> `widths: { mobile, pc }`는 v0.2 호환용으로 아직 동작하지만 폭만 바꾼다. 신규 작성은 `devices` 사용.

## Screen

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✔ | 화면 ID. 라이브러리는 불투명 문자열로만 취급하므로 프로젝트 체계를 그대로 쓰면 된다. 중복이면 콘솔 경고 |
| `name` | string | ✔ | 화면명. 헤더·목차·이동 버튼 라벨에 쓰인다 |
| `path` | string[] | | 기획 IA 경로. `["홈","이용자","명단"]` → 목차에서 홈 › 이용자 아래 "명단" 행. 마지막 = 화면 자신, 앞 = 그룹. 들여쓰기는 최대 6뎁스 |
| `specs` | Spec[] | | 비어 있으면 목차에 "미정의"로 표시되고(커버리지 갭 가시화), 패널에는 다음 할 일 안내 + 현재 화면의 `data-spec` 요소 수가 뜬다 |
| `root` | string | | 컨테이너 셀렉터. 모든 모드 공통 — 요소가 보이면 그 화면으로 자동 전환(패널·다이얼로그처럼 라우트 없는 화면). overlay·frame에서는 route 화면 위에 얹힌 root 화면이 우선. 어느 모드든 `data-spec` 조회 범위를 이 컨테이너 안으로 좁힌다 — 화면마다 번호를 1부터 다시 쓸 수 있고, 공통 골격의 마커와 섞이지 않는다 |
| `route` | string | | overlay·frame에서 이 화면의 라우트. 동적 세그먼트는 `[id]`. basePath·해시 라우터는 자동 대응. 구체 경로 우선(동적 세그먼트가 적은 라우트가 먼저 매칭) — 선언 순서 무관 |
| `viewports` | string[] | | 이 화면이 존재하는 폭. `["pc"]` 처럼 하나만 적으면 목차에 「PC 전용」 배지 (예: 앱 진입에서는 없고 PC 웹에서만 뜨는 로그인). 둘 다면 생략 |
| `covers` | string[] | | 최상위 `checklist` 중 이 화면이 **실제로 적은** 축. checklist 에 없는 값이면 콘솔 경고 |
| `skip` | `{축: 사유}` | | 의도적으로 비운 축과 그 사유. 사유가 빈 문자열이면 비운 것으로 치지 않고 **미정의로 본다**(콘솔 경고) |

### 상태 커버리지

빈 상태·로딩·오류처럼 **보이지 않는 상태**는 화면을 보며 적을 때 가장 먼저 빠진다.
프로젝트가 상태 축 목록(`checklist`)을 한 번 정해 두면, 화면마다 아직 안 적은 축을 목차 배지와 패널 하단에 표시한다.

```js
window.SCREENSPEC = {
  checklist: ["빈 상태", "로딩", "오류", "권한 없음"],   // 프로젝트가 정한다. 없으면 기능 꺼짐
  screens: [
    { id: "S-02", name: "목록", specs: [ /* ... */ ],
      covers: ["빈 상태", "오류"],                        // 이 화면이 다룬 축
      skip:   { "권한 없음": "이 화면은 권한 분기가 없음" }, // 의도적으로 비운 것 (사유 필수)
    },
  ],
}
```

- 미정의 = `checklist` − `covers` − `skip`의 키. 위 예에서는 「로딩」이 남아 목차에 `⚠ 로딩 미정의` 배지가 붙는다.
- `specs`에서 자동으로 추론하지 않는다. `anno:"state"` 항목이 어느 축인지는 기계가 알 수 없고, 선언이 더 정확하다.
- `skip`에 **사유가 필수**인 이유: 몰라서 빠뜨린 것과 알고 비운 것을 섞지 않기 위해서다. 사유가 비면 미정의로 되돌리고 경고한다.
- **미정의가 0이면 아무것도 뜨지 않는다** — 목차 배지도, 패널 카드도 없다. 이건 정의서를 *쓰는 사람* 을 위한 체크리스트라 다 채우면 사라지는 것이 정상이다.
- 미정의가 있으면 패널 아래에 점선 카드로 `⚠ 아직 적지 않은 상황 — 로딩 · 오류`, 사유를 적은 축이 있으면 `해당 없음 — 권한 없음 (권한 분기가 없는 화면)` 이 곁들여 뜬다.
- `checklist`가 없으면 배지도 패널 블록도 만들지 않는다 (기존 화면정의서와 완전히 동일).

## Spec

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `n` | number | ✔ | 마커에 찍히는 번호. 화면 안에서 1부터 |
| `target` | string | ✔ | 대상 요소의 `data-spec` 속성값. 요소를 못 찾으면 마커가 숨겨지고 콘솔 경고 |
| `anno` | 8종 중 하나 | | 아래 표 참조. 생략하면 `box` |
| `title` | string | | 영역명. 패널에서는 제목 옆에 마커 실제 위치에서 계산한 위치 힌트(상단·하단 / 좌측·우측·전체폭)가 자동으로 붙는다 — 화면 없이 읽어도 어디인지 알 수 있게 |
| `optional` | boolean | | 조건부 요소(예: 특정 상태에서만 서는 버튼). `anno`와 무관하게 「못 찾은 정의」 경고에서 제외 |
| `defs` | Def[] | | 기능 설명. 항목당 1~4줄 권장 |
| `parts` | Part[] | | 영역 안의 이름 있는 하위 요소. 라벨 `1a`·`1b`는 라이브러리가 자동으로 매긴다(설정에 적지 않는다). 항목: `title`·`target`(선택)·`anno`·`defs`·`play`·`flowTo`·`arrowTo`. 아래 [Part](#part) 참조 |
| `play` | `{selector, label}` | anno에 따라 | `action`·`popup`은 필수, `flow`는 선택. `selector`는 실제로 클릭할 요소, `label`은 버튼 문구 |
| `preview` | `{label?}` | | 지금 화면에 없는 상태(빈 상태·오류…)를 앱에 재현시키는 **토글 스위치**. 누르면 `screenspec:preview` 이벤트가 앱 창으로 날아간다. `label` 생략 시 「{title} 보기」. **앱에 리스너가 있어야 동작한다** — 아래 [상태 재현](#상태-재현-preview) 참조 |
| `flowTo` | string | `flow`면 ✔ | 이동할 화면 `id`. 없는 id면 콘솔 경고 |
| `arrowTo` | string | | `arrow`에서만. 지정하면 대상 요소에서 이 요소로 관계선을 긋는다 |

### anno 8종

| 값 | 라벨 | 언제 | 시각 동작 |
|---|---|---|---|
| `box` | 영역 | 기본값. 영역 설명 | 바운더리 하이라이트 |
| `arrow` | 화살표 | 아이콘·버튼처럼 작아 박스가 안 보일 때 | 요소 바깥에서 가장자리를 가리키는 지시선. `arrowTo` 지정 시 요소 → 요소 관계선 |
| `input` | 입력 | 입력 필드 정책 (글자수·형식·검증) | 하이라이트 |
| `state` | 상태 | 조건부 표시·상태 분기 | 하이라이트 |
| `motion` | 모션 | 등장·전환 애니메이션 | 하이라이트 |
| `action` | 동작 | 클릭 시 화면 안에서 동작 (토스트·복사 등) | ▶ 버튼 → 실제 동작 재생 |
| `popup` | 팝업 | 클릭 시 모달·레이어·바텀시트 | ▶ 버튼 → 실제 팝업 열림 |
| `flow` | 이동 | 클릭 시 다른 화면으로 | ▶ 버튼 → 실제 화면 이동 + 정의서 동시 전환 |

### 상태 재현 (preview)

`anno:"state"` 로 적은 빈 상태·로딩·오류는 **지금 화면에 없는 화면**이다. 정의는 읽히지만 실물은 못 본다.
`play` 는 화면에 있는 요소를 실제로 클릭하는 장치라 여기엔 쓸 수 없다 — 누를 요소 자체가 없기 때문이다.

`preview` 는 그 자리에 **토글 스위치**를 놓고, 켜면 **앱에 표준 이벤트를 쏜다.** 상태를 만드는 것은 앱의 몫이다
(라이브러리는 앱의 상태 관리 방식을 알지 않는다 — React·Vue·바닐라 무관, 설정이 JSON 으로 직렬화돼도 그대로 동작한다).

```js
{ n:9, target:"9", anno:"state", title:"목록 공백 상태",
  preview: { label:"빈 상태 보기" },        // label 생략 시 「목록 공백 상태 보기」
  defs:[{ t:"표시문구 : 이 기간에 방문이 없습니다" }] }
```

**화면에 나오는 것** — 세 자리에서 같은 사실을 말한다 (라이브러리가 그리므로 어느 앱이든 모양이 같다).

| 자리 | 무엇 | 왜 |
|---|---|---|
| 패널의 **토글 스위치** | 트랙(22×13)+노브. 꺼짐이면 노브가 왼쪽·회색 테두리, 켜짐이면 노브가 오른쪽·액센트로 채워진다 | ▶(실행 버튼)와 **다른 물건**이다. 모양만 보고 「한 번 실행」이 아니라 「토글」로 읽히게 |
| 스위치의 **라벨** | 꺼짐 = `label`(생략 시 「{title} 보기」) · **켜짐 = 「원래대로」** | 되돌리는 방법이 누른 그 자리에 있어야 한다. 색만으로는 「방금 눌림」인지 「지금 켜짐」인지 갈리지 않는다 |
| 앱 위의 **재현 중 띠** | `◑ 「{title}」 재현 중 — 실제 데이터가 아닙니다` + 오른쪽 「끄기」 | 패널을 안 보고 화면만 보는 사람(옆에서 같이 보는 디자이너·개발자)에게 이 화면이 가짜라는 유일한 신호 |

- **재현 중 띠**는 상단 바 바로 아래에 가로로 깔린다 — wrap·frame 은 툴바(50px) 아래, overlay 는 정의서 헤더(48px) 아래(설명 패널은 덮지 않는다).
  켜져 있는 동안만 보이고, 끄면·다른 항목을 켜면·화면이 바뀌면·프로토타입 모드로 돌아가면 사라진다. 띠의 「끄기」는 스위치를 끄는 것과 같다 (앱에 `on:false`).
- **「현재 미표시」 배지가 스위치로 이어진다.** 지금 화면에 그 요소가 없고 `preview` 가 있는 항목은 배지 자체가 눌리는 버튼이 된다
  (`role="button"`·Enter·Space·「눌러서 이 상태를 재현합니다」). 「지금 없음 → 눌러서 보기」가 한 흐름이라 배지와 스위치 사이를 오갈 필요가 없다.
  `preview` 가 없는 항목의 배지는 지금까지처럼 그냥 표시다 — 누를 수 없다.

**이벤트 계약**

| | |
|---|---|
| 이름 | `screenspec:preview` |
| 쏘는 곳 | **앱이 사는 창** — overlay·wrap 은 `window`, frame 은 액자(iframe) 안의 `window` |
| `detail.screen` | 현재 화면 `id` |
| `detail.n` | 항목 라벨. 상위는 `"9"`, 하위(part)는 `"1a"` — **문자열** |
| `detail.title` | 그 항목의 `title` |
| `detail.on` | `true` = 켜기, `false` = 끄기 |
| `detail.handled` | **앱이 채운다.** 처리했으면 리스너 안에서 `true` 로 (아래) |

**앱 쪽 리스너 — 이걸 심어야 동작한다** (바닐라)

```js
addEventListener("screenspec:preview", (e) => {
  if (e.detail.n !== "9") return;                       // 내가 아는 항목만
  document.getElementById("list").hidden = e.detail.on;
  document.getElementById("empty").hidden = !e.detail.on;
  e.detail.handled = true;                              // 「내가 처리했다」 — preventDefault 와 같은 관용
});
```

React (`useState`) — 프레임워크 앱도 같은 계약이다.

```jsx
const [forceEmpty, setForceEmpty] = useState(false);
useEffect(() => {
  const onPreview = (e) => {
    if (e.detail.n !== "9") return;
    setForceEmpty(e.detail.on);
    e.detail.handled = true;      // 리스너 안에서 동기적으로 (setState 는 나중에 반영돼도 무방)
  };
  addEventListener("screenspec:preview", onPreview);
  return () => removeEventListener("screenspec:preview", onPreview);
}, []);
// 렌더: (forceEmpty || rows.length === 0) ? <Empty/> : <List rows={rows}/>
```

**`handled` 확인응답이 이 설계의 핵심이다.** 이벤트를 쏜 직후 라이브러리가 `detail.handled` 를 읽는다.

- `true` — 스위치가 켜진 상태(`aria-pressed="true"`)로 남고 라벨이 「원래대로」가 되며, 앱 위에 재현 중 띠가 뜬다. 다시 누르면 `on:false` 를 쏘고 원래대로.
- `false` (아무도 듣지 않음) — 스위치는 켜지지 않고(라벨도 그대로·띠도 뜨지 않는다), 그 행에 「이 프로토타입은 아직 이 상태를 만들지 못합니다 — 정의는 있지만 화면으로 확인할 수 없습니다」가 붙는다.
  콘솔에도 `console.info` 로 1회 안내한다. **죽은 버튼이 아니라 「앱이 아직 못 만든다」로 읽히게 하는 것**이 목적이다.

- **한 번에 하나만 켜진다.** 다른 항목을 켜면 켜져 있던 항목에 먼저 `on:false` 가 간다 (상태 두 개가 겹쳐 뜨지 않게).
- **화면이 바뀌면 자동으로 꺼진다** — 켜져 있던 항목에 `on:false` 가 가고 재현 중 띠도 사라진다. 앱이 가짜 상태에 갇힌 채 다른 화면으로 넘어가지 않는다.
- 리스너를 심을 수 없는 상태(그 프로토타입이 못 만드는 상태)에는 `preview` 를 주지 않는다. 정의만 남기면 된다.

### Part

영역 안의 **이름 있는 하위 요소** (항목 수·더보기 버튼·팝업 등). 「그 줄의 조건·분기」인 `Def.subs`와 성격이 다르다.
라벨은 라이브러리가 매긴다 — `parts[0]` → `1a`, `parts[1]` → `1b` … `1z` 다음은 `1aa`. 설정에 번호를 적지 않는다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `title` | string | ✔ | 하위 요소명. 패널에서 라벨(`1a`) 옆에 굵게 |
| `target` | string | | 대상 요소의 `data-spec` 속성값. 있으면 자기 마커(`1a`)를 갖고, 없으면 패널에만 렌더된다 |
| `anno` | 8종 중 하나 | | Spec 과 동일. 생략하면 `box` |
| `optional` | boolean | | Spec 과 동일. **팝업·패널 안의 하위 요소에는 사실상 필수** — 닫혀 있는 동안 「못 찾은 정의」 경고가 나기 때문이다 (닫힌 것이 정상이므로) |
| `defs` | Def[] | | Spec 과 동일 (`subs`·`why` 포함) |
| `play` | `{selector, label}` | anno에 따라 | Spec 과 동일. ▶ 버튼이 하위 블록 안에 붙는다 |
| `preview` | `{label?}` | | Spec 과 동일. 스위치가 하위 블록 안에 붙고, 이벤트의 `n` 은 하위 라벨(`"1a"`)로 간다 |
| `flowTo` | string | `flow`면 ✔ | Spec 과 동일 |
| `arrowTo` | string | | Spec 과 동일 |

```js
{ n:1, target:"1", title:"상단 타이틀 영역", defs:[{ t:"화면 상단에 고정" }],
  parts:[
    { title:"항목 수", target:"1a", defs:[{ t:"항목 개수를 1~99까지 표시" }] },
    { title:"더보기 버튼", target:"1b", anno:"popup", play:{ selector:'[data-spec="1b"]', label:"팝업 열기" } },
  ]}
```

**하위 요소는 `n`을 빼면 Spec 과 같은 필드를 쓴다** (`optional`·`why` 포함). 팝업·패널 안을 가리키는 하위 요소는
`optional: true` 를 함께 준다 — 안 주면 패널이 닫혀 있는 동안 경고가 난다.

```js
{ n:5, target:"5", title:"표 설정", anno:"popup", play:{ selector:'[data-spec="5"]', label:"패널 열기" },
  parts:[
    { title:"열 표시", target:"5a", optional:true, defs:[{ t:"열 16개의 표시 여부" }] },
    { title:"열 고정", target:"5b", optional:true, defs:[{ t:"어느 열까지 고정할지" }] },
  ]}
```

`parts`가 하나라도 있으면 패널 헤더의 항목 수가 `항목 11개 · 세부 4개`로 갈라진다(없으면 `항목 11개`). 목차의 커버리지(`N/M 정의됨`)는 화면 단위 그대로다.

### Def

| 필드 | 타입 | 설명 |
|---|---|---|
| `t` | string | 설명 한 줄. 명사형 종결 권장 |
| `subs` | string[] | 조건·분기를 하위 불렛으로. 항목당 0~3줄 |
| `why` | string | 그 줄의 근거. 본문에 대시로 이어 붙이지 말고 여기에 — 패널에서 「↳ 이유:」로 작게 따라붙는다. 구현자는 `t`만 읽고 검토자는 `why`까지 읽는다 |

## HTML 속성

| 속성 | 붙이는 곳 | 설명 |
|---|---|---|
| `data-spec="1"` | 설명할 영역의 최상위 컨테이너 | Spec의 `target`과 짝. 값은 화면 안에서 고유 |
| `data-ss-screen="ID"` | 화면 컨테이너 | Screen의 `root` 셀렉터로 지정할 때의 관례 (wrap 다중화면, overlay·frame 의 패널·다이얼로그 화면) |
| `data-ss-ignore` | 전역 모달·토스트 등 | 시트로 감싸지 않고 페이지 전역에 남긴다 (wrap) |
| `data-ss-frame` | (라이브러리가 붙인다) | frame 모드의 액자 iframe 표식. 이 표식이 붙은 액자 안에서 로드된 인스턴스는 UI 를 만들지 않는다 (재귀 방지) |

## JS API

```js
window.ScreenSpec.setScreen("SCR-XXX-002")  // 화면 수동 전환 (자동 감지가 안 될 때)
window.ScreenSpec.current()                 // 현재 화면 id
window.ScreenSpec.refresh()                 // 레이아웃·마커 재계산
window.ScreenSpec.mode                      // "wrap" | "overlay" | "frame" | "off"
window.ScreenSpec.edit(true)                // 편집 모드 켜기·끄기 (readonly 면 아무 일도 안 한다)
window.ScreenSpec.serialize()               // 지금 설정을 «window.SCREENSPEC = {…};» 텍스트로
window.ScreenSpec.dirty()                   // 저장 안 된 변경이 있는가 (boolean)
window.ScreenSpec.print({ markers, table })  // 인쇄 (대화상자 없이 바로). prepareOnly: true 면 준비만 하고 되돌리는 함수를 준다
```

`setScreen`은 wrap에서 root 표시/숨김 토글을 동반하고, overlay는 앱 DOM을 건드리지 않으므로 root가 보이는 동안만 유지된다.

`window.SpecLayer`는 구명칭 호환 별칭이다 (동일 객체).

## CSS 훅

| 훅 | 조건 | 용도 |
|---|---|---|
| `.ss-pc` | 폭 ≥ 1100px | wrap: 시트에 붙는다 — 미디어쿼리 대신 사용 (폭 시뮬레이터는 컨테이너 폭만 바꾸므로 미디어쿼리가 반응하지 않는다). overlay: `body`에 붙는다 (앱 영역 폭 = 뷰포트 − 설명 패널). 정의서 헤더에 현재 앱 폭(px)이 표시된다 |
| `.ss-narrow` | 폭 ≤ 520px | 동일 |

frame 모드에서는 액자 안 앱에 실제 미디어쿼리가 발화하므로 이 훅이 필요 없다 (뷰어 쪽 시트에는 wrap 과 같이 붙는다).

```css
.ss-sheet.ss-pc .page-inner { display: grid; grid-template-columns: 1fr 320px; }
body.ss-wrap .ss-sheet { padding: 0; }   /* 앱형(전면) 프로토타입: 시트 여백 제거 */
```

## 콘솔 진단

부팅 시 모드와 등록 화면 수가 `console.info`로 찍힌다. 아래는 `console.warn`:

| 메시지 | 원인 |
|---|---|
| 설정이 없어 화면정의서를 만들 수 없습니다 | `window.SCREENSPEC` 미설정 |
| data-spec 요소를 못 찾은 정의 N건 — #n target="…" | `target`에 해당하는 `data-spec` 속성 누락. 어느 정의인지 `#n target`으로 나열(하위 요소는 `#1a`). `anno:"state"`·`optional:true`(조건부)는 없는 게 정상일 수 있어 건수에서 제외하고 "조건부(state·optional) M건은 제외"로 따로 표기. 앱이 그려질 때까지(DOM 이 1.5초 조용할 때, 최대 5초) 기다렸다가 1회만 |
| 화면 ID 중복 | 같은 `id`가 둘 이상 (뒤엣것은 목차·이동에서 무시) |
| flowTo "X" 화면이 screens에 없습니다 | 존재하지 않는 화면으로 이동 지정 |
| accent "X" 인식 불가 | 프리셋명·hex·`var(--x)` 어느 것도 아님 |
| off — 프로토타입 원본 그대로입니다 | `off: true`(또는 `?screenspec=0`). `console.info`이며 화면에는 아무것도 뜨지 않는다. 켜는 방법을 같이 안내한다 |
| baseViewport "X" 인식 불가 | `mobile`·`pc`(또는 `devices`에 추가한 이름)가 아님 |
| panel 설정은 v0.15 에서 폐기 | v0.14 의 `panel:"left"`가 남아 있음. 지우고, 겹치면 `mode:"frame"` |
| checklist 는 문자열 배열이어야 합니다 — 무시 | `checklist`가 빈 배열이거나 문자열이 아닌 값을 포함 |
| covers "X" 는 checklist 에 없음 | 화면의 `covers`에 `checklist`에 없는 축 이름 (오타·용어 불일치) |
| skip "X" 에 사유가 없습니다 — 미정의로 봅니다 | `skip`의 값이 빈 문자열. 비운 이유를 적어야 비운 것으로 친다 |
| preview "X" 를 받는 앱 코드가 없습니다 | 상태 재현 스위치를 켰는데 `screenspec:preview` 를 듣는 리스너가 없다(= `detail.handled` 가 그대로). `console.info` 이며 항목당 1회. 패널 행에도 같은 사실이 표시된다 |
