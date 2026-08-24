# 설정 레퍼런스

ScreenSpec의 API는 전역 객체 `window.SCREENSPEC` 하나다. 이 문서가 전체 필드의 단일 출처이며,
라이브러리가 실제로 읽는 필드가 여기 없으면 CI가 실패한다 (`node tests/lint.js`).

- 처음이라면: [빠른 시작](../README.md#빠른-시작-2분)부터
- AI에게 맡기려면: [SKILL.md](../SKILL.md)

## 전체 구조

```ts
window.SCREENSPEC = {
  mode?:    "wrap" | "overlay",   // 생략 = 자동 판별 (React·Next 감지 시 overlay)
  accent?:  string,               // "blue"|"red"|"orange"|"green"|"purple" 또는 "#7C3AED". 기본 blue
  devices?: { mobile?: Device, pc?: Device },  // wrap 전용. 기기 프리셋 덮어쓰기

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
  root?:   string,      // 이 화면의 컨테이너 CSS 셀렉터 (두 모드 공통 · 표시 여부로 감지)
  route?:  string,      // overlay: 라우트 경로. "/members", "/members/[id]"
}

type Spec = {
  n:        number,     // 필수. 마커 번호
  target:   string,     // 필수. data-spec 속성값 (문자열)
  anno?:    "box"|"arrow"|"input"|"state"|"motion"|"action"|"popup"|"flow",  // 기본 box
  title?:   string,     // 영역명
  defs?:    Def[],      // 기능 설명 줄
  play?:    { selector: string, label: string },  // anno action·popup·flow: 재생 버튼
  flowTo?:  string,     // anno flow: 이동할 화면 id
  arrowTo?: string,     // anno arrow: 관계선을 그을 상대 요소 CSS 셀렉터
}

type Def    = { t: string, subs?: string[] }
type Device = { w: number, h: number }
```

## 최상위 필드

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `mode` | `"wrap"` \| `"overlay"` | 자동 판별 | 단일 HTML은 wrap, React·Next 등 프레임워크는 overlay. 자동 판별이 틀릴 때만 명시 |
| `accent` | 프리셋명 \| hex | `"blue"` (#2952E3) | 마커·하이라이트·재생 버튼·드래그 그립·목차 활성이 묶음으로 바뀐다. 인식 불가 값이면 콘솔 경고 후 기본값 |
| `devices` | `{ mobile, pc }` | 아래 참조 | wrap 전용. 기기 프리셋 크기 덮어쓰기 |
| `screen` | `Screen` | — | 화면이 하나일 때. `specs`와 짝 |
| `specs` | `Spec[]` | `[]` | 화면이 하나일 때의 기능 설명 |
| `screens` | `Screen[]` | — | 화면이 여럿일 때. 있으면 `screen`·`specs`는 무시된다 |

`screens`·`screen`·`specs`가 모두 없으면 라이브러리는 페이지를 건드리지 않고 안내 카드만 띄운다.

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
| `specs` | Spec[] | | 비어 있으면 목차에 "미정의"로 표시된다 (커버리지 갭 가시화) |
| `root` | string | | 컨테이너 셀렉터. 두 모드 공통 — 요소가 보이면 그 화면으로 자동 전환(패널·다이얼로그처럼 라우트 없는 화면). overlay에서는 route 화면 위에 얹힌 root 화면이 우선 |
| `route` | string | | overlay에서 이 화면의 라우트. 동적 세그먼트는 `[id]`. basePath·해시 라우터는 자동 대응. 구체 경로 우선(동적 세그먼트가 적은 라우트가 먼저 매칭) — 선언 순서 무관 |

## Spec

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `n` | number | ✔ | 마커에 찍히는 번호. 화면 안에서 1부터 |
| `target` | string | ✔ | 대상 요소의 `data-spec` 속성값. 요소를 못 찾으면 마커가 숨겨지고 콘솔 경고 |
| `anno` | 8종 중 하나 | | 아래 표 참조. 생략하면 `box` |
| `title` | string | | 영역명 |
| `defs` | Def[] | | 기능 설명. 항목당 1~4줄 권장 |
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

### Def

| 필드 | 타입 | 설명 |
|---|---|---|
| `t` | string | 설명 한 줄. 명사형 종결 권장 |
| `subs` | string[] | 조건·분기를 하위 불렛으로. 항목당 0~3줄 |

## HTML 속성

| 속성 | 붙이는 곳 | 설명 |
|---|---|---|
| `data-spec="1"` | 설명할 영역의 최상위 컨테이너 | Spec의 `target`과 짝. 값은 화면 안에서 고유 |
| `data-ss-screen="ID"` | 화면 컨테이너 | wrap 다중화면. Screen의 `root` 셀렉터로 지정할 때 관례적으로 사용 |
| `data-ss-ignore` | 전역 모달·토스트 등 | 시트로 감싸지 않고 페이지 전역에 남긴다 (wrap) |

## JS API

```js
window.ScreenSpec.setScreen("SCR-XXX-002")  // 화면 수동 전환 (자동 감지가 안 될 때)
window.ScreenSpec.current()                 // 현재 화면 id
window.ScreenSpec.refresh()                 // 레이아웃·마커 재계산
window.ScreenSpec.mode                      // "wrap" | "overlay"
```

`setScreen`은 wrap에서 root 표시/숨김 토글을 동반하고, overlay는 앱 DOM을 건드리지 않으므로 root가 보이는 동안만 유지된다.

`window.SpecLayer`는 구명칭 호환 별칭이다 (동일 객체).

## CSS 훅

| 훅 | 조건 | 용도 |
|---|---|---|
| `.ss-pc` | 시트 폭 ≥ 1100px | wrap에서 미디어쿼리 대신 사용 (폭 시뮬레이터는 컨테이너 폭만 바꾸므로 미디어쿼리가 반응하지 않는다) |
| `.ss-narrow` | 시트 폭 ≤ 520px | 동일 |

```css
.ss-sheet.ss-pc .page-inner { display: grid; grid-template-columns: 1fr 320px; }
body.ss-wrap .ss-sheet { padding: 0; }   /* 앱형(전면) 프로토타입: 시트 여백 제거 */
```

## 콘솔 진단

부팅 시 모드와 등록 화면 수가 `console.info`로 찍힌다. 아래는 `console.warn`:

| 메시지 | 원인 |
|---|---|
| 설정이 없어 화면정의서를 만들 수 없습니다 | `window.SCREENSPEC` 미설정 |
| data-spec 요소를 못 찾은 정의 N건 | `target`에 해당하는 `data-spec` 속성 누락 |
| 화면 ID 중복 | 같은 `id`가 둘 이상 (뒤엣것은 목차·이동에서 무시) |
| flowTo "X" 화면이 screens에 없습니다 | 존재하지 않는 화면으로 이동 지정 |
| accent "X" 인식 불가 | 프리셋명도 hex도 아님 |
