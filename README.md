# SpecLayer

**프로토타입 자체가 화면정의서가 되는 오버레이.**

AI로 만든 프로토타입 HTML에 스크립트 하나를 얹으면, 같은 파일이 두 모드를 갖는다:

| 모드 | 내용 |
|---|---|
| **프로토타입** | 원본 그대로. 시연·데모용 |
| **화면정의서** | 화면 ID·화면명·화면 경로 헤더 + 좌측 축소 미리보기(번호 마커) + 우측 기능정의(노션풍 불렛) |

캡처 떠서 노션·컨플루언스에 번호 붙이고 설명 다는 작업이 사라진다.
마커 ↔ 기능정의가 양방향으로 연결되고, 클릭한 영역은 바운더리로 강조된다.

## 사용법 (AI에게 맡기기 — 권장)

프로토타입을 만든 AI(Claude 등)에게 이렇게 말한다:

```
이 프로토타입에 SpecLayer를 적용해줘.
규칙: https://raw.githubusercontent.com/charmisuk/speclayer/main/SKILL.md 를 읽고 그대로 따라줘.
```

AI가 SKILL.md의 하네스(화면 ID 규칙, 기능정의 작성 룰, anno 타입 선택)를 따라 알아서 심는다.

## 사용법 (수동)

```html
<!-- 1. 주요 영역에 번호 부여 -->
<div class="hero" data-spec="1">...</div>

<!-- 2. body 끝에 설정 + 스크립트 -->
<script>
window.SPECLAYER = {
  screen: { id:"SCR-XXX-001", name:"화면명", path:["홈","메뉴","상세"] },
  specs: [
    { n:1, target:"1", anno:"box", title:"히어로 영역", defs:[
      { t:"기능정의 한 줄", subs:["하위 조건"] }
    ]}
  ]
};
</script>
<script src="https://cdn.jsdelivr.net/gh/charmisuk/speclayer@main/speclayer.js"></script>
```

## 기능

- 모드 토글: 프로토타입 / 화면정의서
- 화면 폭 시뮬레이터: 모바일(430)·PC(1440) 프리셋 + 시트 우측 가장자리 드래그로 자유 조절, 프리셋 클릭 시 복귀
- 어노테이션 타입: `box`(영역) · `arrow`(화살표) · `action`(실제 동작 재생) — 타입 레지스트리로 확장 예정
- 화면정의서 모드에서 프로토타입은 좌측 스테이지에 자동 축소 배치 (마커 크기는 유지)

## 설정 스키마

```js
window.SPECLAYER = {
  screen: {
    id: "SCR-BMD-CAL-001",     // 화면 ID
    name: "식단 캘린더 주간",    // 화면명
    path: ["홈","식단 캘린더","주간 탭"]  // 기획 IA 경로 (URL 아님)
  },
  widths: { mobile: 430, pc: 1440 },  // 선택
  specs: [{
    n: 1,                 // 마커 번호 (기능정의 번호와 동일)
    target: "1",          // data-spec 값
    anno: "box",          // box | arrow | action
    title: "영역명",
    defs: [               // 노션풍: ● 불렛 → ○ 하위 불렛
      { t: "기능정의 한 줄", subs: ["하위 조건 한 줄"] }
    ],
    play: { selector: "#btnCopy", label: "동작 재생 — 복사 토스트" }  // anno:"action"일 때
  }]
};
```

## 제약 (v0.1)

- 폭 시뮬레이터는 컨테이너 폭만 바꾼다 → 프로토타입의 반응형 분기는 미디어쿼리 대신
  `.sl-pc` / `.sl-narrow` 훅 클래스로 작성 (SKILL.md §6)
- 단일 HTML 프로토타입 기준. SPA 라우팅·다중 페이지는 페이지당 1회 적용

## 예제

[`examples/demo.html`](examples/demo.html) — 실서비스(ezdodal AI 아기 사진 상세) 재현 + 기능정의 10항목

## 로드맵

- [ ] 코멘트 레이어 (핀 + 스레드, 게스트 참여)
- [ ] 공유 링크 호스팅 (클라우드)
- [ ] 어노테이션 타입 추가: popup · motion · flow · condition
- [ ] PDF / Confluence 내보내기
