# ScreenSpec

**프로토타입이 그대로 화면정의서가 된다.**
HTML 프로토타입에 `<script>` 한 줄을 붙이면, 그 화면 위에 번호를 찍고 노션처럼 블록으로 설명을 쓸 수 있다.
캡처를 떠서 노션·컨플루언스에 번호를 붙이고 설명을 다는 작업이 통째로 없어진다.

[![MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE) [![CDN](https://img.shields.io/badge/CDN-jsDelivr-orange)](https://cdn.jsdelivr.net/gh/charmisuk/screenspec@0/screenspec.js) [![CI](https://github.com/charmisuk/screenspec/actions/workflows/ci.yml/badge.svg)](https://github.com/charmisuk/screenspec/actions/workflows/ci.yml)

| 프로토타입 모드 | 화면정의서 모드 |
|---|---|
| ![프로토타입 모드](docs/shot-proto.png) | ![화면정의서 모드](docs/shot-doc.png) |

▶ **[직접 만져 보기](https://charmisuk.github.io/screenspec/examples/shop.html)** · 상단 「화면정의서」를 눌러 보면 된다

---

## 쓰는 이유

**산출물이 둘이면 반드시 어긋난다.** 프로토타입을 고칠 때마다 캡처를 다시 뜨고, 번호를 다시 달고, 문서를 다시 맞춰야 한다. 그러다 한 번 건너뛰면 그때부터 문서는 거짓말을 시작한다.

ScreenSpec 은 **산출물을 하나로 만든다.** 설명이 프로토타입 파일 안에 살고, 화면과 붙어 다닌다.

- **캡처가 없다** : 번호는 실제 요소에 붙는다. 화면이 바뀌면 번호도 따라간다
- **문서 모드에서도 프로토타입이 살아 있다** : 버튼이 눌리고 화면이 넘어간다
- **기획자가 직접 쓴다** : 코드를 열지 않는다. 노션처럼 눌러서 고친다

---

## AI 적용

**가장 빠른 길이다.** 프로토타입 HTML 을 열어 둔 채, 쓰는 AI 에게 아래를 그대로 준다.

```text
이 프로토타입에 ScreenSpec 을 붙여 줘.
https://raw.githubusercontent.com/charmisuk/screenspec/main/SKILL.md
를 먼저 읽고 그대로 따라 해.
```

AI 가 화면을 훑어 번호를 붙이고 설명 초안까지 쓴다. 그 뒤는 브라우저에서 직접 고친다.
AI 에게 주는 작업 지시서 전문 : **[SKILL.md](SKILL.md)**

---

## 직접 적용

구조를 먼저 보고 싶으면 아래를 통째로 복사해 `test.html` 로 저장하고 브라우저로 연다. 설치할 것은 없다.

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
        { t: "기간은 이번 주 월요일 기준 자동 계산", c: [
          { t: "주간 회의가 월요일이라 그 주 기준이 자연스럽다", kind: "why" }
        ]}
      ]},
      { n: 2, target: "2", anno: "action", title: "저장 버튼",
        play: { selector: "#save", label: "동작 재생: 저장" }, defs: [
        { t: "탭 시 저장 후 버튼 문구가 '저장됨'으로 변경", c: [
          { t: "미입력 항목이 있으면 저장 차단" }
        ]}
      ]}
    ]
  };
  </script>
  <script src="https://cdn.jsdelivr.net/gh/charmisuk/screenspec@0/screenspec.js"></script>
</body>
</html>
```

1. 설명할 영역에 `data-spec` 이름표를 붙였다. **여기서는 손으로 적었지만 실제로는 화면에서 찍으면 자동으로 붙는다**
2. `window.SCREENSPEC` 에 화면 정보와 번호별 설명을 적었다. `c` 는 그 줄에 딸린 하위다
3. 마지막 줄이 라이브러리다. 열면 위쪽에 **프로토타입 / 화면정의서** 토글이 생긴다

**여기서부터는 코드를 안 봐도 된다.**

---

## 사용법

| 하고 싶은 것 | 어떻게 |
|---|---|
| 설명 고치기 | 글자를 누르면 그 자리에서 써진다. 켜고 끄는 편집 모드가 없다 |
| **새 번호 붙이기** | 빈 줄에서 `/` → **번호** → 프로토타입에서 설명할 곳을 클릭 |
| 줄 늘리기 | `Enter`. 불릿은 `-`+스페이스, 화살표는 `>`, 그 밖엔 `/` 로 고른다 |
| 화면 전체 설명 | 빈 줄에서 `/` → **화면 개요**. 번호 없이 목록 맨 위에 붙는다 |
| 층·순서 바꾸기 | `Tab` / `Shift+Tab`. 또는 왼쪽 `⠿` 를 잡아 끈다 |
| 되돌리기 | `Ctrl+Z` · `Ctrl+Shift+Z` |
| **저장** | 오른쪽 위 **자동저장 켜기** → 이 HTML 파일을 한 번 고른다. 그 뒤로는 손이 멈출 때마다 저장된다 |
| 자동저장이 안 될 때 | **설명 복사** 로 설정 블록을 통째로 복사해 원본에 붙여넣거나 AI 에게 준다 |
| 그림으로 뽑기 | **내보내기** 로 화면별 PNG. 번호·머리말·표를 고를 수 있다 |

자동저장은 파일에 직접 쓰는 브라우저 기능을 쓴다. **크롬·엣지에서 로컬 파일**로 열었을 때다.
저장되는 것은 `window.SCREENSPEC` 블록 하나뿐이다. **프로토타입 코드는 한 글자도 건드리지 않는다.**

---

## 적용 모드

| 모드 | 언제 | 자동 판별 |
|---|---|---|
| `wrap` | 단일 HTML 프로토타입. 기기 뷰포트 포함 전 기능 | ✅ |
| `overlay` | React·Next 등 앱에 심는다. DOM 을 건드리지 않는다 | ✅ |
| `frame` | 액자 안에서 실제 미디어쿼리로 본다 | 직접 지정 |

자세히 : **[docs/modes.md](docs/modes.md)**

---

## 문서 안내

| 하고 싶은 것 | 어디 |
|---|---|
| 설정 필드 전부 보기 | **[docs/config.md](docs/config.md)** |
| AI 에게 맡기는 법 | **[SKILL.md](SKILL.md)** |
| 남에게 넘기기 · 정의서 끄기 | **[docs/share.md](docs/share.md)** |
| 라이브러리 자체를 고치기 | **[AGENTS.md](AGENTS.md)** · [llms.txt](llms.txt) |

무엇을 적을 수 있나(표현 타입 6종·상태 커버리지·동작 재생)는 [docs/config.md](docs/config.md) 에 전부 있다.

---

## 문제 해결

| 증상 | 까닭 |
|---|---|
| 아무것도 안 뜬다 | `window.SCREENSPEC` 이 라이브러리보다 **뒤에** 있다. 설정이 먼저다 |
| 「0항목」만 뜬다 | `specs` 가 비었거나 `target` 이 화면의 `data-spec` 과 안 맞는다 |
| 번호가 엉뚱한 곳에 | 같은 `data-spec` 값이 두 곳에 있다 |
| 자동저장 버튼이 없다 | 크롬·엣지가 아니거나 `http` 로 열었다. **설명 복사** 를 쓴다 |
| 앱에서 화면이 안 바뀐다 | `overlay` 는 라우트를 따라간다. 화면마다 `root` 를 적는다 |
| 내보낸 그림에 이미지가 빈칸 | 외부 주소 이미지다. 자체 완결 파일로 뽑은 뒤 내보낸다 |
| 정의서를 잠깐 끄고 싶다 | 주소 끝에 `?screenspec=0` |

---

## 예제

`examples/` : [shop](examples/shop.html) · [demo](examples/demo.html) · [multi-screen](examples/multi-screen.html) · [overlay-spa](examples/overlay-spa.html) · [tree](examples/tree.html) · [floating](examples/floating.html)

---

## 개발

```bash
node tests/lint.js      # 정적 검사
node tests/e2e.js       # 브라우저 회귀
node tests/smoke.js     # 예제 전수 클릭
```

규칙과 릴리스 절차는 [AGENTS.md](AGENTS.md).

## 라이선스

MIT © ScreenSpec
