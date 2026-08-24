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
  off?:     boolean,              // true = 완전 정지. 원본 프로토타입 그대로 (주소에 ?screenspec=1 이면 켜진다)

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
  flowTo?:  string,     // anno flow: 이동할 화면 id
  arrowTo?: string,     // anno arrow: 관계선을 그을 상대 요소 CSS 셀렉터
}

type Part = {           // 라벨은 적지 않는다 — parts[0] → "1a", parts[1] → "1b"
  title:    string,     // 하위 요소명
  target?:  string,     // 있으면 자기 마커를 갖는다. 없으면 패널에만
  anno?:    (Spec 과 동일 8종),
  defs?:    Def[],
  play?:    { selector: string, label: string },
  flowTo?:  string,
  arrowTo?: string,
}

type Def    = { t: string, subs?: string[], why?: string }  // why = 그 줄의 근거 (「↳ 이유:」로 분리 렌더)
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
| `off` | boolean | `false` | `true`면 라이브러리가 **아무것도 하지 않는다** — CSS·UI·DOM 어디에도 손대지 않고 원본 프로토타입 그대로. 정의는 코드에 남아 있고, 주소에 `?screenspec=1`을 붙이면 그때만 켜진다. 아래 [정의서 끄기](#정의서-끄기-off) 참조 |
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
- **숨김이지 보안이 아니다.** 정의 텍스트는 페이지 소스(`window.SCREENSPEC`)에 그대로 있어, 소스를 열면 읽힌다.
  정말 넘겨서는 안 되는 내용이면 정의를 지운 사본을 따로 만들어 전달한다.

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
- 미정의가 0인 화면에는 배지가 붙지 않고, 패널에는 `상태 커버리지 — 전부 다룸 (N개 축)`만 뜬다.
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

### Part

영역 안의 **이름 있는 하위 요소** (항목 수·더보기 버튼·팝업 등). 「그 줄의 조건·분기」인 `Def.subs`와 성격이 다르다.
라벨은 라이브러리가 매긴다 — `parts[0]` → `1a`, `parts[1]` → `1b` … `1z` 다음은 `1aa`. 설정에 번호를 적지 않는다.

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `title` | string | ✔ | 하위 요소명. 패널에서 라벨(`1a`) 옆에 굵게 |
| `target` | string | | 대상 요소의 `data-spec` 속성값. 있으면 자기 마커(`1a`)를 갖고, 없으면 패널에만 렌더된다 |
| `anno` | 8종 중 하나 | | Spec 과 동일. 생략하면 `box` |
| `defs` | Def[] | | Spec 과 동일 (`subs`·`why` 포함) |
| `play` | `{selector, label}` | anno에 따라 | Spec 과 동일. ▶ 버튼이 하위 블록 안에 붙는다 |
| `flowTo` | string | `flow`면 ✔ | Spec 과 동일 |
| `arrowTo` | string | | Spec 과 동일 |

```js
{ n:1, target:"1", title:"상단 타이틀 영역", defs:[{ t:"화면 상단에 고정" }],
  parts:[
    { title:"항목 수", target:"1a", defs:[{ t:"항목 개수를 1~99까지 표시" }] },
    { title:"더보기 버튼", target:"1b", anno:"popup", play:{ selector:'[data-spec="1b"]', label:"팝업 열기" } },
  ]}
```

`parts`가 하나라도 있으면 패널 헤더의 항목 수가 `상위 N · 하위 M`으로 갈라진다. 목차의 커버리지(`N/M 정의됨`)는 화면 단위 그대로다.

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
