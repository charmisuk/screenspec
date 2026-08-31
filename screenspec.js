/*!
 * ScreenSpec v0.25 — 프로토타입 자체가 화면정의서가 되는 오버레이
 * Copyright (c) 2026 ScreenSpec · MIT License · https://github.com/charmisuk/screenspec
 *
 * 이 파일은 프로토타입 HTML 안에 통째로 넣어 쓸 수 있다 (미리보기 환경 대응).
 * 그렇게 넣을 때도 위 저작권·라이선스 줄은 함께 남긴다 — MIT가 요구하는 유일한 조건이다.
 *
 * 사용법 (단일 화면):
 *   1) 프로토타입 HTML의 주요 영역에 data-spec="1" 형태로 번호 부여
 *   2) window.SCREENSPEC = { screen:{...}, specs:[...] } 정의
 *   3) 이 스크립트를 <body> 마지막에 로드
 *
 * 사용법 (다중 화면 SPA — 화면 전환 시 헤더·기능정의 자동 추적):
 *   window.SCREENSPEC = {
 *     screens: [
 *       { id:"SCR-XXX-001", name:"목록", path:["홈","목록"],
 *         root:'[data-ss-screen="SCR-XXX-001"]',   // 이 화면의 컨테이너 셀렉터
 *         specs:[...] },
 *       { id:"SCR-XXX-002", name:"상세", path:["홈","목록","상세"],
 *         root:'[data-ss-screen="SCR-XXX-002"]', specs:[...] }
 *     ]
 *   }
 *   - 화면 컨테이너가 표시/숨김(display 등)으로 전환되면 자동 감지해 따라간다.
 *   - 수동 전환도 가능: window.ScreenSpec.setScreen("SCR-XXX-002")
 *   - data-spec 번호는 화면(root) 안에서만 찾으므로 화면마다 1부터 다시 시작 가능.
 *
 * anno 타입 5종 (SKILL.md §5) — 의미(라벨)와 시각 동작(mech)을 분리한 레지스트리.
 * 타입은 «결과가 달라질 때만» 나뉜다 — 같은 결과면 하나다:
 *   box    영역   | mech box  | 기본값. 영역 하이라이트 (입력 정책·애니메이션도 여기에 그냥 쓴다)
 *   arrow  화살표 | mech arrow| 작은 요소 지시 — 요소 밖 56px(화면 중심 쪽)에서 가장자리를 가리키는 콜아웃 자동.
 *                              arrowTo:"#sel" 지정 시 요소→요소 관계선(가장자리↔가장자리)
 *   state  상태   | mech box  | 조건부 표시·상태 분기 (로그인 여부, 데이터 유무 등)
 *   action 동작   | mech play | 클릭 시 화면 안에서 동작 재생 (모달·바텀시트 포함). play:{selector,label}
 *   flow   이동   | mech flow | 다른 화면으로 전환. flowTo:"SCR-ID" (+선택 play.selector)
 *   옛 input·motion 은 box 로, popup 은 action 으로 읽는다 (ANNO_LEGACY) — 옛 문서는 그대로 열린다
 *
 * 모드 3종 (wrap·overlay 는 자동 판별, mode로 명시 가능 · frame 은 명시해야만 켜짐):
 *   wrap    단일 HTML 프로토타입 — 기기 뷰포트 포함 전 기능
 *   overlay React·Next·Vue 등 프레임워크 — DOM 불변, 라우트(route) 기반 화면 추적.
 *           screens[].route: "/members" 또는 "/members/[id]".
 *           basePath·정적 호스팅(경로 접두)도 suffix 매칭으로 지원.
 *   frame   프레임워크 앱을 iframe(액자)에 넣고 뷰어(툴바·설명 패널·마커)는 바깥에 두는 모드.
 *           설명 패널이 앱을 덮지 않고, 툴바의 모바일/PC 로 앱의 미디어쿼리가 실제로 발화한다.
 *           조건: 앱이 주소로 열리고 same-origin. 화면 추적은 overlay 와 같은 route/root 규칙.
 *
 * 액센트: accent 옵션 — 프리셋 blue(기본)·red·orange·green·purple, hex 또는 var(--토큰). 마커·하이라이트·버튼·그립·목차 활성이 묶음으로 바뀐다.
 * 화면 목록(목차): 헤더의 화면 ID 칩 클릭 → path 배열 기반 트리(들여쓰기 + 가이드선, 그룹 행, 최대 6뎁스 들여쓰기).
 *
 * 반응형 훅: 폭에 따라 .ss-pc(≥1100px) / .ss-narrow(≤520px)가 붙는다 — wrap 은 시트에, overlay 는 body 에(앱 영역 폭 기준).
 * 프로토타입 CSS는 미디어쿼리 대신 이 훅으로 분기.
 *
 * z-index 원칙 — 모드별로 다르다:
 *   overlay 모드(남의 앱 위에 얹음): ScreenSpec UI는 브라우저 최대 대역(2147482990~)에서 항상 맨 위.
 *     앱의 z-index와 경쟁하지 않는다 (Vercel 툴바·Hotjar 방식). 앱 모달이 패널 아래 깔릴 수 있으나
 *     본문은 밀어내기로 가리지 않고, '프로토타입' 필 한 번으로 전체 확인 가능.
 *     앱의 우측 드로어·사이드시트가 설명 패널에 가려지면 mode:"frame"(액자 모드) — 뷰어가 앱 바깥에 놓여 겹치지 않는다.
 *   wrap 모드(단일 HTML, AI 하네스가 전체 통제): 대역 규칙 사용 —
 *      0 ~ 7999  프로토타입 (시트 내부)
 *   8000 ~ 8099  시트 오버레이 — anno 8030 · markers 8040 · resize 8050
 *   9000 ~ 9099  크롬 — docmode 9000 · toolbar 9020
 *   9500 이상    프로토타입 전역 오버레이 (data-ss-ignore 모달·토스트) — 의도적으로 최상위
 *   공용 부유 요소(목차·툴팁·전환 토스트)는 양 모드 모두 최대 대역.
 *
 * 크기 시뮬레이터 (wrap, DevTools 벤치마크): 시트 = 기기 뷰포트(폭×높이, 내부 스크롤).
 * 프리셋 모바일 360×800 · PC 1920×1080 + 우측/하단/코너 드래그. 프리셋 클릭 = 복귀.
 *
 * 내부 구조(v0.6): 마커·기능정의·활성화·화살표·툴팁은 createCore() 공통 코어 하나가
 * 담당하고, wrap/overlay 부트는 좌표계·모드 전환·화면 감지만 ctx로 주입한다.
 */
(function () {
  "use strict";
  if (window.__SCREENSPEC_BOOTED__) return; /* 이중 로드 가드 */
  window.__SCREENSPEC_BOOTED__ = true;

  const RAW = window.SCREENSPEC || window.SPECLAYER || {}; /* 구명칭 호환 */

  /* 정의서 공개 스위치 — "붙이는 것" 과 "보여주는 것" 을 분리한다.
     off:true 면 아무것도 만들지 않고 끝낸다(원본 프로토타입 그대로). 정의는 코드에 그대로 남는다.
     주소에 ?screenspec=1 (또는 #screenspec) 을 붙이면 그때만 켜지므로, 같은 파일로
     "프로토타입만 보여주기" 와 "정의서까지 보기" 를 동시에 쓸 수 있다. ?screenspec=0 은 반대(임시 끄기).
     숨김이지 보안이 아니다 — 정의 텍스트는 페이지 소스에 남는다. */
  const SWITCH = (function () {
    const m = (location.search + location.hash).match(/[?&#]screenspec(?:=([^&#\s]*))?/);
    if (m) return /^(0|off|false|no)$/i.test(decodeURIComponent(m[1] || "1")) ? "off" : "on";
    return RAW.off === true ? "off" : "on";
  })();
  /* 편집 잠금 (#37) — 전달본을 못 고치게 한다. 「보여 주기만」 하는 사본에 건다.
     숨김이 아니라 미생성이다: 고칠 수 있는 표식도 저장 경로도 아예 만들지 않는다 */
  const READONLY = RAW.readonly === true;
  /* 저장은 «원본 HTML 의 설정 블록만» 갈아끼운다. 지금 DOM 은 라이브러리가 이미 손댄 뒤라 원본이 아니므로,
     손대기 전 사본을 부팅 직전에 떠 둔다 — file:// 처럼 fetch 가 막힌 자리에서는 이게 유일한 원본이다 */
  let SRC_SNAPSHOT = null;
  const SCREENS = (RAW.screens && RAW.screens.length)
    ? RAW.screens
    : [Object.assign({ id: "SCR-000", name: "화면명 미정", path: [] }, RAW.screen || {}, { specs: RAW.specs || [] })];
  /* 프리셋 = 가장 대중화된 실기기 사이즈 (statcounter 최다) */
  const DEVICES = {
    mobile: { w: 360, h: 800 },   /* 갤럭시 표준 해상도 */
    pc:     { w: 1920, h: 1080 }  /* FHD 데스크톱 */
  };
  if (RAW.devices) for (const k in RAW.devices) DEVICES[k] = Object.assign({}, DEVICES[k], RAW.devices[k]);
  else if (RAW.widths) { /* v0.2 호환 */
    if (RAW.widths.mobile) DEVICES.mobile.w = RAW.widths.mobile;
    if (RAW.widths.pc) DEVICES.pc.w = RAW.widths.pc;
  }
  /* anno 타입 레지스트리 — 결과(액션)가 달라질 때만 분기한다 (#63, PM 2026-08-31).
     box=하이라이트 · arrow=지시선 · state=조건부(누락 경고 제외) · action=▶재생 · flow=화면 이동 */
  const ANNO = {
    box:    { label: "영역",   mech: "box" },
    arrow:  { label: "화살표", mech: "arrow" },
    state:  { label: "상태",   mech: "box" },
    action: { label: "동작",   mech: "play" },
    flow:   { label: "이동",   mech: "flow" }
  };
  /* 옛 타입은 결과가 같던 쪽으로 읽는다 — 옛 문서는 그대로 열린다 */
  const ANNO_LEGACY = { input: "box", motion: "box", popup: "action" };
  function annoOf(s) {
    const k = ANNO_LEGACY[s.anno] || s.anno;
    return ANNO[k] || { label: s.anno || "영역", mech: "box" };
  }
  /* 아카이브 (#46, 2026-08-30 PM) — 유형 고르기 드롭다운은 «만드는 길» 을 없앴다.
     골라도 화면이 거의 안 바뀌었기 때문이다: 실제 동작은 4가지고 그중 넷(영역·입력·상태·모션)은 라벨만 다르다.
     값이 확실해지면(외부 요청 2건+) 되살린다. anno 는 렌더·마커·▶ 에서 그대로 쓰인다 — 읽기는 하위호환 */

  /* 하이라이트·마커·버튼 등 포인트 컬러 — accent: 프리셋명 또는 hex
     window.SCREENSPEC = { accent: "orange" } 또는 { accent: "#7C3AED" } */
  const ACCENT_PRESETS = {
    blue:   "#2952E3",  /* 기본 */
    red:    "#E5484D",
    orange: "#F76B15",
    green:  "#18794E",
    purple: "#8E4EC6"
  };
  const ACCENT = (function () {
    const a = RAW.accent;
    if (!a) return ACCENT_PRESETS.blue;
    if (ACCENT_PRESETS[a]) return ACCENT_PRESETS[a];
    if (/^#[0-9a-fA-F]{3,8}$/.test(a)) return a;
    /* CSS 변수 참조 — 값을 복사하지 않고 제품 토큰을 가리킨다 (색 하드코딩 lint 회피·테마 추종) (#18) */
    if (/^var\(--[\w-]+(\s*,[^)]*)?\)$/.test(a)) return a;
    console.warn("[ScreenSpec] accent \"" + a + "\" 인식 불가: 기본(blue) 사용. 프리셋: " + Object.keys(ACCENT_PRESETS).join(", ") + ", hex 또는 var(--토큰)");
    return ACCENT_PRESETS.blue;
  })();

  /* v0.14 의 panel:"left" 는 폐기 — 겹침의 정식 해법은 mode:"frame" */
  if (RAW.panel) console.warn("[ScreenSpec] panel 설정은 v0.15 에서 폐기. 설명 패널은 오른쪽 고정. 앱의 우측 서랍과 겹치면 mode:\"frame\" 을 쓰세요");

  /* ============ 상태 커버리지 (#26) ============
     프로젝트가 정한 상태 축(checklist)을 화면마다 covers/skip 으로 대조한다.
     specs 에서 자동 추론하지 않는다 — anno:"state" 가 어느 축인지는 기계가 알 수 없고,
     "알고 비운 것"과 "몰라서 빠뜨린 것"은 선언으로만 갈린다. checklist 가 없으면 기능 자체가 꺼진다. */
  const CHECKLIST = (function () {
    const c = RAW.checklist;
    if (c == null) return null;
    if (!Array.isArray(c) || !c.length || !c.every((v) => typeof v === "string" && v.trim())) {
      console.warn("[ScreenSpec] checklist 는 문자열 배열이어야 합니다: 무시");
      return null;
    }
    return c.map((v) => v.trim());
  })();
  /* style — AI 가 읽는 «이 프로젝트의 쓰는 법»(온보딩 인터뷰의 답).
     라이브러리는 이 값으로 렌더를 바꾸지 않는다. 여기서는 형식만 보고 어긋나면 1회 알린다 —
     설정이 조용히 무시되면 AI 가 왜 그 톤으로 안 쓰는지 알 수 없기 때문이다. 규격은 docs/config.md */
  (function () {
    const st = RAW.style;
    if (st == null) return;
    if (typeof st !== "object" || Array.isArray(st)) {
      console.warn("[ScreenSpec] style 은 객체여야 합니다: 무시 (규격: docs/config.md)");
      return;
    }
    const bad = [];
    const v = st.vocab;
    if (v != null) {
      if (typeof v !== "object" || Array.isArray(v)) bad.push("vocab(객체)");
      else ["prefixes", "endings"].forEach((k) => {
        if (v[k] != null && !(Array.isArray(v[k]) && v[k].every((x) => typeof x === "string"))) bad.push("vocab." + k + "(문자열 배열)");
      });
    }
    ["idScheme", "notes"].forEach((k) => { if (st[k] != null && typeof st[k] !== "string") bad.push(k + "(문자열)"); });
    if (bad.length) console.warn("[ScreenSpec] style 의 형식이 어긋납니다: " + bad.join(", ") + " (해당 항목만 무시, 규격: docs/config.md)");
  })();
  const COV_CACHE = new WeakMap(); /* 화면당 1회만 계산 — 렌더마다 같은 경고가 쌓이지 않게 */
  /* → { done:[축], skipped:[{axis,reason}], missing:[축] } · checklist 가 없으면 null */
  function coverage(s) {
    if (!CHECKLIST || !s || s._unmapped) return null;
    if (COV_CACHE.has(s)) return COV_CACHE.get(s);
    const covers = (Array.isArray(s.covers) ? s.covers : []).filter((v) => typeof v === "string").map((v) => v.trim());
    covers.forEach((v) => {
      if (!CHECKLIST.includes(v)) console.warn("[ScreenSpec] " + s.id + ": covers \"" + v + "\" 는 checklist 에 없음");
    });
    const skipped = [];
    const sk = (s.skip && typeof s.skip === "object") ? s.skip : {};
    Object.keys(sk).forEach((k) => {
      const reason = typeof sk[k] === "string" ? sk[k].trim() : "";
      /* 사유 없는 skip 은 비운 게 아니라 빠뜨린 것 — 미정의로 되돌린다 */
      if (!reason) { console.warn("[ScreenSpec] " + s.id + ": skip \"" + k + "\" 에 사유가 없습니다: 미정의로 봅니다"); return; }
      if (CHECKLIST.includes(k)) skipped.push({ axis: k, reason: reason });
    });
    const r = {
      done: CHECKLIST.filter((ax) => covers.includes(ax)),
      skipped: skipped,
      missing: CHECKLIST.filter((ax) => !covers.includes(ax) && !skipped.some((z) => z.axis === ax))
    };
    COV_CACHE.set(s, r);
    return r;
  }
  /* 목차 배지 — 미정의 축이 있을 때만. 0이면 조용히 (다 채운 화면에 잔소리하지 않는다) */
  function covBadge(s) {
    const c = coverage(s);
    if (!c || !c.missing.length) return "";
    const t = c.missing.join(" · ") + " 미정의";
    return '<span class="ss-toc-undef ss-toc-cov" title="' + esc("이 화면에 「" + c.missing.join(" · ") + "」 설명이 없습니다: 설정의 checklist 로 정한 점검 항목") + '">⚠ ' + esc(t) + "</span>";
  }
  /* 패널 하단 블록 — 다룸 / 비움(사유) / ⚠ 미정의. 비어 있는 묶음은 줄 자체를 내지 않는다 */
  function covBlockHTML(s) {
    const c = coverage(s);
    if (!c) return "";
    /* 이건 정의서를 "쓰는 사람" 에게 필요한 정보다 — 다 채우면 사라진다(체크리스트의 정상 동작).
       읽는 사람의 패널에 «전부 다룸» 이 계속 떠 있으면 무엇을 하라는 것인지 애매해진다. */
    if (!c.missing.length) return "";
    /* 카드는 스스로를 설명해야 한다 — 이 기능을 모르는 사람에게도 «왜 떴고 뭘 하면 사라지는지» 가 보여야 한다 */
    const tip = "설정의 checklist 로 이 프로젝트가 정한 점검 항목입니다 (" + CHECKLIST.join(" · ") +
      "). 이 화면의 covers 에 적거나, 해당 없으면 skip: { \"축\": \"사유\" } 로 비우면 사라집니다.";
    let out = '<div class="ss-cov" title="' + esc(tip) + '">' +
      '<div class="ss-cov-miss">⚠ 이 화면에 「' + esc(c.missing.join(" · ")) + '」 설명이 없습니다</div>' +
      '<div class="ss-cov-l">이 프로젝트가 화면마다 챙기기로 한 항목입니다. 설명을 더하거나, 이 화면에 해당 없으면 사유와 함께 「해당 없음」으로 적으면 사라집니다.</div>';
    if (c.skipped.length) out += '<div class="ss-cov-l">해당 없음: ' + esc(c.skipped.map((z) => z.axis + " (" + z.reason + ")").join(" · ")) + "</div>";
    return out + "</div>";
  }

  /* 사용자 텍스트는 전부 이걸 거쳐 innerHTML에 들어간다 */
  function esc(x) {
    return String(x == null ? "" : x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* ---- 인라인 서식 (#44) — 굵게와 링크, 딱 둘 ----
     저장 형식을 **컨플루언스 XHTML 의 최소 부분집합**으로 못박는다: <strong> 과 <a href> 뿐.
     그래서 컨플루언스로 내보낼 때 변환기가 «아예 없다» — 태그를 그대로 실어 보내면 된다.
     노션처럼 형태가 다른 곳으로 갈 때만 얇은 변환기 하나가 필요하다.
     서식을 늘리고 싶은 유혹도 이 한 줄이 막는다: 허용 목록 밖은 애초에 만들 수 없다. */
  const RICH_OK = { STRONG: 1, A: 1 };
  /* 화면에 그릴 글자 — 허용한 두 태그만 살리고 나머지는 글자로 만든다(살균).
     사용자가 붙여넣은 서식이든 남의 스크립트든, 우리 패널에서 실행될 길을 남기지 않는다 */
  /* 글자 노드용 이스케이프 — 따옴표는 건드리지 않는다. 우리가 만드는 건 «태그 사이 내용» 이지 속성값이 아니고,
     따옴표까지 바꾸면 저장된 글자가 &quot; 로 남아 다음 편집 때 또 한 겹 쌓인다 (2026-08-30 PM 발견) */
  function escText(x) {
    return String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /* 언제나 «HTML 로 읽어서 다시 쓴다». 태그가 없다고 글자로만 이스케이프하면
     rich(rich(x)) 가 x 와 달라져(&amp;quot;) 편집할 때마다 한 겹씩 쌓인다 */
  function rich(x) {
    const src = String(x == null ? "" : x);
    const box = document.createElement("div");
    box.innerHTML = src;
    let out = "";
    const walk = (node) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) { out += escText(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        const tag = n.tagName;
        if (tag === "A") {
          const href = n.getAttribute("href") || "";
          /* 주소는 http(s)·mailto 만 — javascript: 같은 것이 링크를 타고 들어오지 못하게 */
          const ok = /^(https?:|mailto:)/i.test(href);
          out += ok ? '<a href="' + esc(href) + '" target="_blank" rel="noopener">' : "";
          walk(n);
          out += ok ? "</a>" : "";
          return;
        }
        if (RICH_OK[tag]) { out += "<" + tag.toLowerCase() + ">"; walk(n); out += "</" + tag.toLowerCase() + ">"; return; }
        walk(n); /* 허용 밖 태그는 껍데기만 버리고 안의 글자는 살린다 */
      });
    };
    walk(box);
    return out;
  }
  /* 편집한 결과를 설정에 담을 때 — 브라우저가 만든 <b>·<i> 를 컨플루언스 이름으로 바꾼다.
     입구에서 한 번만 하면 그 뒤로는 어디로 내보내든 손댈 것이 없다 (PM 2026-08-29) */
  function richIn(el) {
    const box = document.createElement("div");
    box.innerHTML = el.innerHTML;
    box.querySelectorAll("b,strong,i,em,u,span,font,div,p,br").forEach((n) => {
      const t = n.tagName;
      if (t === "B" || t === "STRONG") { const w = document.createElement("strong"); w.innerHTML = n.innerHTML; n.replaceWith(w); return; }
      if (t === "BR") { n.replaceWith(document.createTextNode(" ")); return; }
      if (t === "I" || t === "EM" || t === "U" || t === "SPAN" || t === "FONT" || t === "DIV" || t === "P") {
        /* 기울임·밑줄은 «최소한의 노션» 밖이다 — 글자만 살린다 */
        const f = document.createDocumentFragment();
        while (n.firstChild) f.appendChild(n.firstChild);
        n.replaceWith(f);
      }
    });
    return rich(box.innerHTML).replace(/\s+/g, " ").trim();
  }
  /* 모션 감소 설정 반영 */
  const SB = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth";

  /* ============================================================
     편집 엔진 (#37) — DOM 을 모르는 순수 함수. 여기서 만든 텍스트가 그대로 파일이 된다.
     기획자가 정의서를 고치는 것과, 그 결과를 파일로 되돌리는 것은 다른 일이다.
     되돌리는 쪽을 순수 함수로 떼어 두면 브라우저 없이도 검증할 수 있다.
     ============================================================ */
  /* 필드 순서를 고정해야 «고친 줄만» 바뀐 파일이 나온다 — 순서가 흔들리면 매 저장이 전면 수정으로 보인다.
     모르는 키는 뒤에 원래 순서로 붙인다: 설정이 늘어나도 저장이 필드를 잃지 않는다 */
  const KEY_RANK = ["mode", "accent", "baseViewport", "devices", "checklist", "style", "off", "readonly",
    "vocab", "prefixes", "endings", "idScheme", "notes",
    "screen", "screens", "id", "name", "path", "route", "root", "viewports", "covers", "skip",
    "n", "target", "sel", "anno", "title", "optional", "t", "why", "subs", "layer", "defs", "dev", "parts",
    "play", "preview", "flowTo", "arrowTo", "selector", "label", "w", "h", "specs"];
  function ssStr(s) {
    /* JSON.stringify 가 따옴표·역슬래시·줄바꿈을 맡고, 우리는 «스크립트 블록을 깨뜨리는» 것만 더 막는다.
       스크립트 종료 태그와 HTML 주석 여는 표시의 < 만 이스케이프한다 — 「a < b」 같은 본문은 읽히는 채로 둔다.
       이 파일 자체도 인라인 대상이라 소스에 종료 태그를 «쓸 수 없다» — 그래서 아래도 \/ 로 적는다 */
    return JSON.stringify(String(s))
      .replace(/<(?=[/!])/g, "\\u003C")
      .replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).toUpperCase());
  }
  function ssKey(k) { return /^[A-Za-z_$][\w$]*$/.test(k) ? k : ssStr(k); }
  function ssKeys(o) {
    const ks = Object.keys(o).filter((k) => o[k] !== undefined && typeof o[k] !== "function");
    const orig = {};
    ks.forEach((k, i) => (orig[k] = i));
    return ks.slice().sort((a, b) => {
      const ra = KEY_RANK.indexOf(a), rb = KEY_RANK.indexOf(b);
      if (ra < 0 && rb < 0) return orig[a] - orig[b];
      if (ra < 0) return 1;
      if (rb < 0) return -1;
      return ra - rb;
    });
  }
  function ssVal(v, ind) {
    if (v === null) return "null";
    const t = typeof v;
    if (t === "string") return ssStr(v);
    if (t === "number" || t === "boolean") return String(v);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      /* 원시값만 든 짧은 배열은 한 줄로 — path·covers·subs 가 세로로 늘어지면 사람이 못 읽는다 */
      if (v.every((x) => x === null || typeof x !== "object")) {
        const one = "[" + v.map((x) => ssVal(x, ind)).join(", ") + "]";
        if (one.length + ind.length <= 96) return one;
      }
      return "[\n" + v.map((x) => ind + "  " + ssVal(x, ind + "  ")).join(",\n") + "\n" + ind + "]";
    }
    if (t === "object") {
      const ks = ssKeys(v);
      if (!ks.length) return "{}";
      return "{\n" + ks.map((k) => ind + "  " + ssKey(k) + ": " + ssVal(v[k], ind + "  ")).join(",\n") + "\n" + ind + "}";
    }
    return "null"; /* 함수·undefined 는 설정에 올 수 없다 */
  }
  function serializeConfig(cfg) { return "window.SCREENSPEC = " + ssVal(cfg, "") + ";"; }

  /* 설정 <script> 블록만 골라낸다 — src 가 있는 태그(라이브러리 로드)는 건드리지 않는다 */
  const CFG_BLOCK_RE = /<script(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script\s*>/gi;
  function findConfigBlock(html) {
    CFG_BLOCK_RE.lastIndex = 0;
    let m;
    while ((m = CFG_BLOCK_RE.exec(html))) {
      if (/(?:window\s*\.\s*)?(?:SCREENSPEC|SPECLAYER)\s*=/.test(m[0])) return { start: m.index, end: m.index + m[0].length };
    }
    return null;
  }
  /* 설정 블록만 갈아끼운 새 HTML. 블록을 못 찾으면 null — 부르는 쪽이 「이 파일이 맞나요」를 묻는다.
     나머지 바이트는 손대지 않는다: 프로토타입 코드가 저장 때문에 바뀌면 안 된다 */
  function replaceConfigBlock(html, body) {
    const at = findConfigBlock(html);
    if (!at) return null;
    return html.slice(0, at.start) + "<script>\n" + body + "\n<\/script>" + html.slice(at.end);
  }
  /* 복원은 «제자리»여야 한다 — 부팅 때 잡아 둔 배열·객체 참조를 살려야 화면 목록과 설정이
     계속 같은 것을 가리킨다. 통째로 갈아끼우면 그 연결이 끊겨 편집이 화면에 반영되지 않는다 */
  function adoptInto(dst, src) {
    if (Array.isArray(dst) && Array.isArray(src)) {
      if (dst.length > src.length) dst.length = src.length;
      src.forEach((v, i) => {
        const a = dst[i];
        if (a && v && typeof a === "object" && typeof v === "object" && Array.isArray(a) === Array.isArray(v)) adoptInto(a, v);
        else dst[i] = v;
      });
      return dst;
    }
    Object.keys(dst).forEach((k) => { if (!(k in src)) delete dst[k]; });
    Object.keys(src).forEach((k) => {
      const a = dst[k], b = src[k];
      if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) adoptInto(a, b);
      else dst[k] = b;
    });
    return dst;
  }

  /* ============ 디자인 시스템 ============
     1. 토큰: 색·서체는 --ss-* 변수로만 사용 (하드코딩 금지)
     2. 리셋: :where()로 특이도 0 — 컴포넌트 클래스가 항상 이긴다
     3. 컴포넌트: 단일 클래스(.ss-play, .ss-marker ...)가 형태·색을 완결 정의
     4. 포인트 컬러(--ss-accent) 위에는 항상 흰 텍스트
     5. 액센트는 묶음(테마 세트): --ss-accent 단일 토큰이 마커·하이라이트·재생버튼·
        드래그 그립·목차 활성까지 견인하고, 파생색(soft·hover·그림자)은 color-mix로만.
        액센트 계열 hex·rgba 하드코딩 금지 — tests/lint.js가 기계 검증 */
  /* 활성 영역 하이라이트 — frame 모드는 대상이 액자 안에 있어 이 규칙을 그 문서에도 넣는다 */
  const HL_CSS = `
  :where(.ss-hl){position:relative}
  .ss-hl::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
    border:2px solid var(--ss-accent);border-radius:inherit;
    background:color-mix(in srgb,var(--ss-accent) 8%,transparent)}`;
  const CSS = `
  :root{--ss-canvas:#F1F1F0;--ss-ink:#191919;--ss-ink2:#50524E;--ss-ink3:#9B9A97;
    --ss-line:#E9E9E7;--ss-line2:#D3D1CB;--ss-accent:${ACCENT};--ss-accent-soft:color-mix(in srgb,${ACCENT} 9%,#fff);
    --ss-mono:ui-monospace,"Cascadia Code",Consolas,monospace;
    /* 블록 규격 (PM 2026-08-29) — 노션 실측을 좁은 패널에 맞춰 조인 한 벌.
       노션: 글머리칸 24 · 들여쓰기 24 · 블록 위아래 8(=사이 16) · 줄높이 24.
       우리: 그 구조를 그대로 두고 4분의 3으로. 글머리칸 = 들여쓰기 한 단 이라 자릿수가 어긋나지 않는다 */
    --ss-blk-fs:12.5px;--ss-blk-lh:20px;--ss-blk-py:3px;--ss-blk-mark:16px;--ss-gut-w:28px;
    /* 글자의 «잉크» 중심은 줄 상자 중심보다 아래에 있다 — 한글은 밑선 위로 넓게 앉기 때문이다.
       줄 상자 기준으로 글머리를 가운데 두면 눈에는 살짝 위로 뜬다 (PM 2026-08-30).
       12.5px/20px Pretendard 실측: 0.88px. 글머리를 그만큼 내린다 */
    --ss-blk-ink:0.9px}
  body.ss-wrap{margin:0;background:var(--ss-canvas)}
  .ss-ui,.ss-ui *{box-sizing:border-box;font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic","Apple SD Gothic Neo",sans-serif}
  .ss-ui :where(button){font:inherit;cursor:pointer;border:0;background:none;color:inherit}
  /* 프로토타입의 CSS 가 우리 UI 를 흔들면 안 된다 (2026-08-29 실측: 프로토타입의 button{flex:1} 때문에
     서식 단추가 패널 폭 전체로 늘어났다). :where() 는 특정도가 0 이라 프로토타입 규칙에 진다 */
  .ss-ui button{flex:none}
  .ss-toolbar{position:fixed;top:0;left:0;right:0;z-index:9020;height:50px;background:#fff;
    border-bottom:1px solid var(--ss-line2);display:flex;align-items:center;gap:14px;padding:0 16px}
  .ss-modes{display:flex;border:1px solid var(--ss-line2);border-radius:9px;padding:2px;gap:2px;background:#FAFAF9}
  .ss-modes button{padding:6px 16px;border-radius:7px;font-size:13px;font-weight:700;color:var(--ss-ink2)}
  .ss-modes button[aria-pressed="true"]{background:var(--ss-ink);color:#fff}
  .ss-widthsim{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ss-ink2)}
  .ss-widthsim .ss-seg{display:flex;border:1px solid var(--ss-line2);border-radius:8px;padding:2px;gap:2px;background:#FAFAF9}
  .ss-widthsim .ss-seg button{padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;color:var(--ss-ink2)}
  .ss-widthsim .ss-seg button[aria-pressed="true"]{background:#fff;color:var(--ss-ink);box-shadow:0 1px 2px rgba(17,24,39,.12)}
  .ss-wpx{font-family:var(--ss-mono);font-size:11px;color:var(--ss-ink3);min-width:52px;text-align:right}
  @media(max-width:640px){.ss-wpx{display:none}}
  .ss-proto-wrap{padding:74px 16px 60px;overflow-x:auto}
  body.ss-mode-doc .ss-proto-wrap{display:none}
  .ss-holder{margin:0 auto;width:max-content}
  .ss-docmode{display:none}
  body.ss-mode-doc .ss-docmode{display:flex;flex-direction:column;position:fixed;top:50px;left:0;right:0;bottom:0;z-index:9000}
  .ss-doc-header{background:#fff;border-bottom:1px solid var(--ss-line2);padding:12px 24px;display:flex;align-items:flex-start;gap:36px;flex-wrap:wrap}
  .ss-dh .ss-k{font-size:10.5px;font-weight:700;color:var(--ss-ink3);letter-spacing:.06em;display:block;margin-bottom:1px}
  .ss-dh .ss-v{font-size:14px;font-weight:800;color:var(--ss-ink)}
  .ss-dh .ss-v.ss-monoV{font-family:var(--ss-mono);font-size:13px}
  .ss-dh .ss-sep{color:var(--ss-ink3);font-weight:400;margin:0 4px}
  .ss-doc-body{flex:1;display:flex;min-height:0;background:var(--ss-canvas)}
  .ss-stage{flex:1;min-width:0;overflow:auto;padding:24px}
  .ss-fit{position:relative;margin:0 auto;transition:width .15s,height .15s}
  .ss-defs{width:var(--ss-panel-w,50vw);flex-shrink:0;background:#fff;border-left:1px solid var(--ss-line2);
    display:flex;flex-direction:column;min-height:0;position:relative}
  /* 폭 조절 (#53) — 왼쪽 가장자리를 잡아 끈다. 고른 폭은 그 사람 브라우저에 남는다 */
  /* 손잡이는 «패널 안쪽» 에 둔다 — 밖으로 나오면 시트의 폭 조절 손잡이를 가로챈다 (2026-08-30 실측) */
  .ss-defs-resize{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:col-resize;z-index:2}
  .ss-defs-resize::after{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);
    width:2px;height:34px;border-radius:2px;background:transparent;transition:background .12s}
  .ss-defs-resize:hover::after,.ss-defs-resize.ss-on::after{background:var(--ss-accent)}
  body.ss-resizing{cursor:col-resize;user-select:none}
  .ss-defs-head{padding:12px 18px;border-bottom:1px solid var(--ss-line);display:flex;align-items:center;gap:8px}
  .ss-defs-head h2{font-size:13px;font-weight:800;margin:0;color:var(--ss-ink)}
  .ss-defs-head .ss-cnt{font-family:var(--ss-mono);font-size:11px;color:var(--ss-ink3);font-weight:700}
  /* 편집 모드 (#37) — 기획자가 코드를 안 보고 정의서를 고치는 자리.
     읽는 화면을 그대로 두고 «고칠 수 있음» 만 얹는다: 편집을 켜야 손잡이가 보인다.
     새 고정(fixed) 요소를 만들지 않는다 — 전부 패널 안쪽 흐름 배치라 마커·재현 중 띠를 가리지 않는다 */
  /* 개발 정의 레이어 (#38) — 탭으로 가르지 않고 같은 항목 안에 한 단 들여쓴 블록으로.
     보더 색과 DEV 태그로 «누가 쓴 줄인지» 가 한눈에 갈린다 (결정 D2) */
  .ss-dev{margin:7px 0 2px;padding:5px 0 3px 10px;border-left:2.5px solid #8E4EC6}
  .ss-devtag{display:inline-block;font-family:var(--ss-mono);font-size:9.5px;font-weight:800;color:#8E4EC6;
    border:1px solid #D9C3EE;border-radius:4px;padding:0 4px;line-height:1.7;margin-bottom:3px}
  .ss-dev-ttl{font-size:11px;font-weight:700;color:var(--ss-ink3);margin-left:5px}
  .ss-dev-common{margin:12px 14px 2px;padding:7px 0 5px 10px}
  .ss-dev .ss-b-dot::before{background:#8E4EC6}
  /* 필터는 «CSS 전용» 이다 — 모델을 안 건드리므로 마커·누락 경고·커버리지에 부작용이 원천적으로 없다.
     행 자체는 숨기지 않는다: 번호와 마커의 대응이 깨지면 안 된다 */
  .ss-defs-list[data-layer="plan"] .ss-dev{display:none}
  .ss-defs-list[data-layer="dev"] .ss-kids{display:none}
  .ss-layerbar{display:flex;align-items:center;gap:7px;padding:7px 18px;border-bottom:1px solid var(--ss-line);
    background:#fff;font-size:11px;color:var(--ss-ink3)}
  .ss-chips{display:flex;border:1px solid var(--ss-line2);border-radius:7px;overflow:hidden}
  .ss-chips button{border:0;background:#fff;color:var(--ss-ink3);font-size:11px;font-weight:700;
    padding:3px 9px;cursor:pointer;font-family:inherit;border-right:1px solid var(--ss-line2)}
  .ss-chips button:last-child{border-right:0}
  .ss-chips button:hover{color:var(--ss-ink)}
  .ss-chips button[aria-pressed="true"]{background:var(--ss-accent);color:#fff}
  .ss-headtools{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0}
  .ss-headbtn{border:1px solid var(--ss-line2);background:#fff;color:var(--ss-ink2);
    font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:7px;cursor:pointer;font-family:inherit;white-space:nowrap}
  .ss-headbtn:hover{border-color:var(--ss-ink3);color:var(--ss-ink)}
  /* 저장 상태 — 사람이 «저장했나?» 를 궁금해하지 않아도 되게 늘 오른쪽 위에 (PM 2026-08-29) */
  .ss-savest{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;
    color:var(--ss-ink3);white-space:nowrap}
  .ss-savest::before{content:"";width:6px;height:6px;border-radius:99px;background:currentColor;flex:none}
  .ss-savest.ss-st-on{color:#2F8F5B}
  .ss-savest.ss-st-busy{color:#B8862B}
  .ss-savest.ss-st-warn{color:#E0522F}
  .ss-headbtn:disabled{opacity:.45;cursor:default;border-color:var(--ss-line)}
  .ss-headbtn:disabled:hover{border-color:var(--ss-line);color:var(--ss-ink2)}
  /* 밖에서 바뀐 파일 띠 — 초안 띠와 같은 자리·같은 모양, 색만 다르다 */
  .ss-outside{background:#EAF1FF;border-bottom-color:#C7D8F5;color:#1B4A9C}
  .ss-outside button{border-color:#B9CDF0;color:#1B4A9C}
  .ss-outside .ss-out-what{font-weight:800}
  .ss-outside .ss-out-why,.ss-outside .ss-out-stuck{opacity:.8}
  .ss-outside .ss-out-stuck{flex-basis:100%;font-weight:700}
  /* 파일 연결 관문 (#78) — 띠가 아니라 레이어다. 띠는 «알림» 처럼 생겨서 무시하고 지나갔는데,
     이건 무시하면 아무것도 못 하는 관문이다. 단 «패널 안쪽» 에만 깐다 —
     프로토타입 위에 팝업을 띄우지 않는다는 것이 이 제품의 전제다 (고치려 누른 순간이라 시선도 여기 있다) */
  .ss-lay{display:none;position:absolute;inset:0;z-index:30;background:rgba(26,26,25,.30);
    align-items:center;justify-content:center;padding:22px}
  .ss-lay.ss-show{display:flex}
  .ss-lay-card{width:100%;max-width:340px;background:#fff;border:1px solid var(--ss-line2);border-radius:14px;
    box-shadow:0 14px 36px rgba(0,0,0,.18);padding:20px 20px 14px}
  .ss-lay-card h3{margin:0 0 7px;font-size:14px;font-weight:800;color:var(--ss-ink)}
  .ss-lay-card p{margin:0;font-size:12px;line-height:1.65;color:var(--ss-ink2)}
  .ss-lay-where{margin:12px 0 14px;padding:9px 11px;background:#FAFAF9;border:1px solid var(--ss-line);
    border-radius:9px;font-size:11px;line-height:1.6;color:var(--ss-ink3);word-break:break-all}
  .ss-lay-where b{display:block;font-family:var(--ss-mono);font-size:12px;color:var(--ss-ink);font-weight:800}
  .ss-lay-go{display:block;width:100%;border:0;background:var(--ss-accent);color:#fff;font-weight:800;
    font-size:12.5px;padding:11px 12px;border-radius:9px;cursor:pointer;font-family:inherit}
  .ss-lay-go:hover{filter:brightness(1.07)}
  .ss-lay-later{display:block;width:100%;margin-top:6px;border:0;background:transparent;color:var(--ss-ink3);
    font-size:11.5px;font-weight:700;padding:7px;cursor:pointer;font-family:inherit}
  .ss-lay-later:hover{color:var(--ss-ink2)}
  .ss-lay-msg{margin-top:10px;font-size:11.5px;line-height:1.6;color:#B4442A}
  .ss-lay-msg:empty{display:none}
  .ss-wipeall:hover{border-color:#E0522F;color:#E0522F}
  .ss-edbar{display:none;align-items:center;gap:6px;padding:8px 18px;border-bottom:1px solid var(--ss-line);
    background:#FAFAF9;font-size:11.5px;color:var(--ss-ink3);flex-wrap:wrap}
  body.ss-editing .ss-edbar{display:flex}
  .ss-edbar button{border:1px solid var(--ss-line2);background:#fff;color:var(--ss-ink2);font-size:11.5px;
    font-weight:700;padding:4px 9px;border-radius:7px;cursor:pointer;font-family:inherit}
  .ss-edbar button:hover{border-color:var(--ss-ink3);color:var(--ss-ink)}
  .ss-edbar .ss-edsave{background:var(--ss-accent);border-color:var(--ss-accent);color:#fff}
  .ss-edmsg{flex-basis:100%;color:var(--ss-ink2);line-height:1.6}
  .ss-edmsg:empty{display:none}
  /* ---- 블록 에디터 (#52) ----
     PM: 「편집 누르면 노션처럼 빈칸 쭉 나오고 플러스 버튼 있고 드래그할 수 있는 점 6개 보이고.
     편집모드 들어간다고 밑에 쉐이드 있고 이런 거 싫어.」
     그래서 «편집 중» 을 알리는 장식(노란 배경·밑줄)을 전부 뺐다. 편집은 상태가 아니라 그냥 쓸 수 있는 것이다.
     손잡이(＋·⠿)는 블록 왼쪽 거터에 있고, 마우스를 올린 블록에만 나온다. */
  body.ss-editing [data-ed]{cursor:text;border-radius:3px}
  body.ss-editing [data-ed].ss-ed-on{outline:none;background:transparent}
  /* 거터 (#59) — ＋ 와 ⠿ 를 붙여 폭을 줄였다. 패널 왼쪽 여백 «안» 에 들어와야 첫 블록에서도 안 잘린다 */
  .ss-gut{position:absolute;left:calc(var(--ss-gut-w) * -1);top:0;height:var(--ss-blk-lh);
    display:flex;align-items:center;gap:0;opacity:0;transition:opacity .1s}
  .ss-blk:hover > .ss-gut,.ss-blk:focus-within > .ss-gut{opacity:1}
  .ss-gut button{width:13px;height:var(--ss-blk-lh);display:grid;place-items:center;border-radius:3px;
    color:var(--ss-line2);font-size:11px;line-height:1;cursor:pointer;background:none;border:0;padding:0}
  .ss-gut button:hover{background:var(--ss-canvas);color:var(--ss-ink2)}
  .ss-gut .ss-g-grip{cursor:grab;letter-spacing:-2px}
  .ss-gut .ss-g-grip:active{cursor:grabbing}
  .ss-blk{position:relative}
  /* 번호 블록 = 하나의 덩어리 (노션 콜아웃처럼). PM 확인: 「콜아웃 느낌 난 좋아」
     편집 중이라고 왼쪽 여백을 없애지 않는다 — 손잡이는 콜아웃 «밖» 거터에 있어서 자리를 다투지 않는다.
     (PM 2026-08-29: 「번호 쪽 디자인이 너무 왼쪽 마진이 없어」— 원인이 이 규칙이었다) */
  /* 드롭선 — 왼쪽 끝이 «몇 단에 들어가는지» 를 말한다. 동그라미가 그 지점을 짚는다 */
  .ss-drop-line{position:absolute;z-index:3;height:2px;background:var(--ss-accent);border-radius:2px;
    pointer-events:none}
  .ss-drop-line::before{content:"";position:absolute;left:-3px;top:-2px;width:6px;height:6px;
    border-radius:99px;background:var(--ss-accent)}
  .ss-dragging{opacity:.4}
  /* 하위로 들어갈 때 부모가 될 블록 — 노션과 같은 «통째로 밝히기», 색은 우리 액센트 (PM 2026-08-30) */
  /* 들어갈 덩어리 — 부모와 그 하위를 «한 박스» 로 감싼다. 자리가 아니라 소속을 말한다.
     선과 같이 «떠 있는» 판이라 글을 한 픽셀도 안 민다 (철학 1) */
  .ss-drop-in{position:absolute;z-index:0;background:var(--ss-accent-soft);border-radius:6px;
    pointer-events:none}
  /* 빈 번호도 «놓을 수 있는 자리» 여야 한다 — 높이가 0 이면 마우스가 닿지 않는다 */
  .ss-kids{min-height:14px}
  /* 항목 삭제 — 제목 줄 오른쪽 끝. 마우스를 올린 블록에만 나온다 */
  .ss-rowdel{margin-left:auto;flex-shrink:0;opacity:0;border:0;background:none;color:var(--ss-ink3);
    font-size:14px;line-height:1;padding:2px 4px;border-radius:5px;cursor:pointer;transition:opacity .1s}
  body.ss-editing .ss-row:hover .ss-rowdel,body.ss-editing .ss-row:focus-within .ss-rowdel{opacity:1}
  .ss-rowdel:hover{background:var(--ss-canvas);color:var(--ss-ink)}
  .ss-draft{display:none;align-items:center;gap:8px;padding:9px 18px;background:#FFF8E1;
    border-bottom:1px solid #F0E4B8;font-size:11.5px;color:#7A5B00;line-height:1.6}
  .ss-draft.ss-show{display:flex}
  .ss-draft button{border:1px solid #E0CE96;background:#fff;color:#7A5B00;font-size:11px;font-weight:700;
    padding:3px 9px;border-radius:6px;cursor:pointer;font-family:inherit;white-space:nowrap}
  /* 인쇄 · 화면별 PDF (#34) — 브라우저의 「PDF 로 저장」이 곧 산출물이다.
     화면에서는 숨어 있다가 인쇄 미디어에서만 나타난다 — 그래야 누를 때 깜빡이지 않는다 */
  .ss-prdlg{border:0;border-radius:14px;padding:20px 22px 18px;max-width:340px;color:var(--ss-ink);
    box-shadow:0 18px 50px rgba(17,24,39,.22);font:13px/1.6 var(--ss-font)}
  .ss-prdlg::backdrop{background:rgba(17,24,39,.35)}
  .ss-prdlg h3{margin:0 0 6px;font-size:14px;font-weight:800}
  .ss-prdlg .ss-prdlg-sub{margin:0 0 14px;font-size:11.5px;color:var(--ss-ink3);line-height:1.6}
  .ss-prdlg label{display:flex;align-items:center;gap:7px;font-size:12.5px;margin:7px 0;cursor:pointer}
  .ss-prdlg .ss-prdlg-btns{display:flex;justify-content:flex-end;gap:7px;margin-top:16px}
  .ss-prdlg button{border:1px solid var(--ss-line2);background:#fff;color:var(--ss-ink2);font-size:12px;
    font-weight:700;padding:6px 13px;border-radius:8px;cursor:pointer;font-family:inherit}
  .ss-prdlg .ss-prdlg-go{background:var(--ss-accent);border-color:var(--ss-accent);color:#fff}
  /* 이미지 내보내기 (#40) — 화면 밖에 조립했다가 캡처 뒤 지운다. 화면에는 안 보인다 */
  .ss-cap{position:fixed;left:-99999px;top:0;background:#fff;z-index:-1}
  .ss-cap-head{padding:16px 30px 12px;border-bottom:2px solid var(--ss-ink)}
  .ss-cap-id{font-family:var(--ss-mono);font-size:12px;font-weight:800;color:var(--ss-ink)}
  .ss-cap-name{font-size:19px;font-weight:800;color:var(--ss-ink);margin:3px 0 3px}
  .ss-cap-path{font-size:12px;color:var(--ss-ink3)}
  .ss-cap-foot{font-size:10px;color:var(--ss-ink3);padding:4px 12px 6px;text-align:right}
  .ss-cap .ss-pr-table{margin:0 30px 24px;width:calc(100% - 60px);border-collapse:collapse;font-size:12px;color:var(--ss-ink)}
  .ss-cap .ss-pr-table th{background:#F1F1F0;border:1px solid var(--ss-line2);padding:6px 8px;text-align:left;font-weight:800;font-size:11px}
  .ss-cap .ss-pr-table td{border:1px solid var(--ss-line2);padding:6px 8px;vertical-align:top;line-height:1.55}
  .ss-cap .ss-sheet{box-shadow:none}
  .ss-cap .ss-edge-r,.ss-cap .ss-edge-b{display:none}
  .ss-cap-msg{font-size:11.5px;color:var(--ss-ink2);line-height:1.6;margin-top:10px}
  .ss-cap-msg:empty{display:none}
  .ss-prdlg-hr{border:0;border-top:1px solid var(--ss-line);margin:12px 0 4px}
  /* 기능 설명 표 — 「기능 설명 포함」을 켰을 때만 그림에 함께 굽는다 */
  .ss-pr-table .ss-pr-no{font-family:var(--ss-mono);font-weight:700;white-space:nowrap;width:44px}
  .ss-pr-table .ss-pr-tag{white-space:nowrap;width:52px;color:var(--ss-ink3)}
  .ss-pr-table .ss-pr-ttl{width:22%;font-weight:700}
  .ss-pr-table tr.ss-pr-part .ss-pr-no{padding-left:16px;color:var(--ss-ink3)}
  .ss-pr-table ul{margin:0;padding-left:14px}
  .ss-pr-table li{margin:1px 0}
  /* 그림 속 블록도 화면과 같은 규칙으로 — 들여쓰기 한 단 = 글머리 칸 (#55) */
  .ss-pr-table li.ss-pr-b{color:#37352F}
  .ss-pr-table li.ss-pr-in1{margin-left:16px}
  .ss-pr-table li.ss-pr-in2{margin-left:32px}
  .ss-pr-table li.ss-pr-text{list-style:none;margin-left:-14px}
  .ss-pr-table li.ss-pr-why{list-style:none;color:var(--ss-ink3);font-size:11px}
  .ss-pr-table li.ss-pr-why::before{content:"↳ "}
  .ss-pr-table tr.ss-pr-dev .ss-pr-no,.ss-pr-table tr.ss-pr-dev .ss-pr-tag{color:#8E4EC6}
  .ss-pr-table .ss-pr-devtag{font-family:var(--ss-mono);font-size:10px;font-weight:800;color:#8E4EC6;
    border:1px solid #D9C3EE;border-radius:3px;padding:0 3px;margin-right:4px}
  /* 끌 수 없는 선택지는 «꺼져 있음» 이 보여야 한다 (기능 설명을 안 넣으면 레이어는 무의미) */
  .ss-prdlg label.ss-off{opacity:.4}
  .ss-prdlg label.ss-off select{cursor:not-allowed}
  .ss-defs-list{position:relative;flex:1;overflow-y:auto;padding:6px 8px 18px calc(var(--ss-gut-w) + 4px)}
  .ss-badge{border-top:1px solid var(--ss-line);padding:8px 18px;font-size:11px;color:var(--ss-ink3);background:#fff}
  .ss-badge a{color:var(--ss-ink3);font-weight:700;text-decoration:none}
  .ss-badge a:hover{color:var(--ss-accent)}
  .ss-empty{padding:24px 18px;font-size:12.5px;color:var(--ss-ink3);line-height:1.7}
  .ss-empty code{font-family:var(--ss-mono);font-size:11.5px;background:#F1F1F0;padding:1px 5px;border-radius:4px}
  .ss-empty b{color:var(--ss-ink2)}
  /* 첫 화면 (FTUE) — 「무엇을 누르면 되는지」 하나만 크게 */
  .ss-start{padding:34px 20px;text-align:center}
  .ss-start-t{font-size:14px;font-weight:800;color:var(--ss-ink);margin-bottom:7px}
  .ss-start-d{font-size:12px;color:var(--ss-ink3);line-height:1.75;margin-bottom:16px}
  .ss-start-b{background:var(--ss-accent);color:#fff;border:0;border-radius:9px;font-size:12.5px;
    font-weight:800;padding:10px 18px;cursor:pointer;font-family:inherit}
  .ss-start-b:hover{filter:brightness(.94)}
  .ss-start-h{margin-top:16px;font-size:11px;color:var(--ss-ink3);line-height:1.7}
  .ss-start-h code{font-family:var(--ss-mono);font-size:10.5px;background:#F1F1F0;padding:1px 4px;border-radius:4px}
  /* 상태 커버리지 (#26) — 정의 목록 맨 아래. 액센트는 쓰지 않는다(경고가 아니라 잔여 작업 표시) */
  /* 빠진 상황 안내 — 미정의가 있을 때만 나온다. 「할 일이 남았다」로 읽히게 점선 카드로 띄운다 */
  .ss-cov{margin:10px 14px 16px;padding:10px 12px;border:1px dashed var(--ss-line2);border-radius:8px;
    background:#FAFAF9;font-size:12px;color:var(--ss-ink3);line-height:1.7}
  .ss-cov-miss{color:var(--ss-ink);font-weight:800}
  @media(max-width:1000px){
    body.ss-mode-doc .ss-docmode{position:static;display:block;padding-top:50px}
    body.ss-mode-doc.ss-pv-on .ss-docmode{top:auto;padding-top:78px} /* 좁은 폭: 흐름 배치라 여백으로 민다 */
    .ss-doc-body{display:block}.ss-stage{overflow:visible}
    .ss-defs{width:100%;border-left:0;border-top:1px solid var(--ss-line2)}
  }
  /* 번호 블록 = 하나의 덩어리 (노션 콜아웃). PM: 「1~9번 라벨 자체도 컴포넌트가 돼야 한다 —
     크게 보면 에디터가 있고 그 안에 번호가 있고 그 안에 또 넣을 수 있는 구조」 */
  .ss-row{display:flex;gap:7px;align-items:flex-start;margin:5px 0;padding:8px 9px;border-radius:9px;
    background:#FBFBFA;cursor:pointer;transition:background .12s}
  /* 지금 화면에 없는 정의(조건부 상태 등) — 번호를 흐리게 + '현재 미표시' (#27) */
  .ss-nowtag{display:none;font-size:10px;color:var(--ss-ink3);border:1px dashed var(--ss-line2);border-radius:4px;padding:0 5px;margin-left:6px;white-space:nowrap}
  /* preview 가 있는 항목의 배지는 그 자리에서 눌러 재현한다 — 「지금 없음 → 눌러서 보기」가 한 흐름 (#29) */
  .ss-nowtag[role="button"]{cursor:pointer;color:var(--ss-accent);border-color:color-mix(in srgb,var(--ss-accent) 45%,#fff);transition:background .12s,color .12s}
  .ss-nowtag[role="button"]:hover,.ss-nowtag[role="button"]:focus-visible{background:var(--ss-accent-soft);color:var(--ss-accent);border-style:solid}
  .ss-row.ss-now-hidden .ss-no{opacity:.4}
  .ss-row.ss-now-hidden .ss-nowtag{display:inline-block}
  .ss-row:hover{background:#F4F4F2}
  .ss-row.ss-active{background:var(--ss-accent-soft)}
  .ss-no{width:20px;height:20px;flex-shrink:0;display:grid;place-items:center;margin-top:1px;
    border-radius:99px;background:var(--ss-ink);color:#fff;font-family:var(--ss-mono);font-size:11px;font-weight:800}
  .ss-row.ss-active .ss-no{background:var(--ss-accent)}
  .ss-main{flex:1;padding:0;min-width:0}
  .ss-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .ss-title .ss-t{font-size:13.5px;font-weight:800;color:var(--ss-ink)}
  .ss-title .ss-tag{font-size:10px;font-weight:700;color:var(--ss-ink3);border:1px solid var(--ss-line2);border-radius:5px;padding:1px 6px;margin-left:auto;flex-shrink:0}
  .ss-row.ss-active .ss-tag{color:var(--ss-accent);border-color:var(--ss-accent)}
  /* 블록 (#55) — 번호·불릿·화살표·글이 모두 같은 «블록» 이다. 들여쓰기는 블록의 성질이다 */
  .ss-kids{position:relative;margin:4px 0 0}
  .ss-b{position:relative;display:flex;align-items:flex-start;gap:0;font-size:var(--ss-blk-fs);color:#37352F;
    line-height:var(--ss-blk-lh);padding:var(--ss-blk-py) 0;border-radius:4px}
  .ss-b .ss-dt{flex:1;min-width:0;padding-inline:2px}
  /* 글머리는 «칸» 이다 — 줄높이만큼 키우고 가운데 놓으면 글자 크기가 바뀌어도 눈금이 안 흔들린다 */
  .ss-b-dot,.ss-b-arrow{flex:none;width:var(--ss-blk-mark);height:var(--ss-blk-lh);display:grid;place-items:center;
    transform:translateY(var(--ss-blk-ink))}
  .ss-b-dot::before{content:"";width:4px;height:4px;border-radius:50%;background:var(--ss-ink)}
  /* ↳ 글리프는 밑선보다 위에 앉는 문자다 — 실측으로 본문 잉크보다 1px 높다. 그만큼 더 내린다 */
  .ss-b-arrow{color:var(--ss-ink3);font-size:11px;transform:translateY(calc(var(--ss-blk-ink) + 1px))}
  .ss-b-why{color:var(--ss-ink3)}
  .ss-b-dev{color:var(--ss-ink2)}
  /* 들여쓰기 한 단 = 글머리칸. 안쪽 블록의 글머리가 바깥 블록의 글자 자리에 딱 선다 */
  .ss-in1{margin-left:var(--ss-blk-mark)}
  .ss-in2{margin-left:calc(var(--ss-blk-mark) * 2)}
  .ss-defs-list [data-ed]:empty::after{content:"내용";color:var(--ss-ink3)}
  .ss-defs-list [data-ed].ss-ed-on:empty::after{content:"내용 입력, / 로 넣기"}
  .ss-defs-list [data-ed].ss-ed-on:empty{min-width:120px;display:inline-block}
  .ss-defs-list [data-ed="title"]:empty::after{content:"영역 이름"}
  .ss-defs-list [data-ed="title"].ss-ed-on:empty::after{content:"영역 이름을 쓰세요"}
  .ss-slash{position:fixed;z-index:2147483000;background:var(--ss-bg,#fff);border:1px solid var(--ss-line,#dcdce3);
    border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:4px;display:flex;flex-direction:column;min-width:132px}
  .ss-slash{min-width:262px}
  .ss-slash-g{font-size:10.5px;font-weight:800;color:var(--ss-ink3);letter-spacing:.04em;padding:7px 9px 5px}
  .ss-slash button{all:unset;display:flex;align-items:center;gap:10px;padding:7px 9px;border-radius:7px;
    cursor:pointer;font-size:13px;color:var(--ss-ink)}
  .ss-slash button:hover,.ss-slash button.on{background:var(--ss-accent-soft)}
  .ss-sl-ico{width:24px;height:24px;border-radius:6px;background:var(--ss-canvas);border:1px solid var(--ss-line);
    display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--ss-ink2);flex:none}
  .ss-slash button.on .ss-sl-ico{background:#fff;border-color:var(--ss-accent);color:var(--ss-accent)}
  .ss-sl-nm{font-weight:600}
  .ss-sl-key{margin-left:auto;font-family:var(--ss-mono);font-size:11.5px;color:var(--ss-ink3)}
  /* 번호 찍기 (#43) — 찍을 수 있는 곳은 옅게, 잡힌 것만 또렷하게 */
  body.ss-picking [data-spec]{outline:1px dashed color-mix(in srgb,var(--ss-accent) 40%,#fff);outline-offset:1px}
  body.ss-picking{cursor:crosshair}
  .ss-pick-box{position:fixed;z-index:2147483300;pointer-events:none;outline:2px solid var(--ss-accent);
    outline-offset:1px;background:color-mix(in srgb,var(--ss-accent) 8%,transparent);display:none}
  .ss-pick-tip{position:fixed;z-index:2147483301;pointer-events:none;background:var(--ss-ink);color:#fff;
    font-size:11px;padding:4px 8px;border-radius:6px;white-space:nowrap}
  .ss-play{margin:9px 0 0 16px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;
    color:#fff;border-radius:8px;padding:7px 14px;background:var(--ss-accent);
    box-shadow:0 2px 8px color-mix(in srgb,var(--ss-accent) 35%,transparent);transition:background .12s}
  .ss-play:hover{background:color-mix(in srgb,var(--ss-accent) 82%,#000)}
  .ss-play:active{transform:translateY(1px)}
  /* 상태 재현 (#27·#29) — ▶(실제 클릭)와 다른 물건이다: 실행 버튼이 아니라 **스위치**.
     기호(◑)는 관습이 없어 읽히지 않았다 (#29) → 트랙+노브를 CSS 로 그려 「토글」임을 모양으로 말한다.
     마크업은 버튼 하나 그대로 (::before=트랙 · ::after=노브) — 안에 span 을 넣으면 클릭 위임이 깨진다 */
  .ss-preview{position:relative;background:transparent;color:var(--ss-accent);border:1.5px dashed var(--ss-accent);
    box-shadow:none;border-radius:99px;padding:6px 13px 6px 10px;gap:8px}
  .ss-preview::before{content:"";flex:none;width:22px;height:13px;border-radius:99px;
    border:1px solid var(--ss-line2);background:#fff;transition:background .12s,border-color .12s}
  .ss-preview::after{content:"";position:absolute;left:13.5px;top:50%;margin-top:-4.5px;width:9px;height:9px;
    border-radius:50%;background:var(--ss-ink2);transition:transform .14s,background .12s}
  .ss-preview:hover{background:var(--ss-accent-soft)}
  .ss-preview.ss-on{background:var(--ss-accent);color:#fff;border-style:solid;
    box-shadow:0 2px 8px color-mix(in srgb,var(--ss-accent) 35%,transparent)}
  .ss-preview.ss-on::before{background:var(--ss-accent);border-color:#fff}
  .ss-preview.ss-on::after{background:#fff;transform:translateX(9px)}
  .ss-preview.ss-on:hover{background:color-mix(in srgb,var(--ss-accent) 82%,#000)}
  /* 아무도 이 이벤트를 듣지 않을 때 — 죽은 버튼이 아니라 「앱이 아직 못 만든다」로 읽히게 */
  .ss-preview-none{display:block;margin:6px 0 0 16px;font-size:11.5px;color:var(--ss-ink3);line-height:1.55}
  /* 재현 중 띠 (#29) — 패널이 아니라 **앱 위**에 붙는다. 옆에서 화면만 보는 사람에게 「이건 진짜 데이터가 아니다」를
     알리는 유일한 신호다. 앱마다 각자 만들면 모양이 제각각이라 라이브러리가 그린다. 상단 바 바로 아래에 붙어 앱을 덮는다 */
  .ss-pvbar{display:none;position:fixed;left:0;right:0;top:0;z-index:9010;height:28px;align-items:center;gap:10px;
    padding:0 14px;font-size:12px;font-weight:700;color:var(--ss-ink);
    background:color-mix(in srgb,var(--ss-accent) 14%,#fff);
    border-bottom:1px solid color-mix(in srgb,var(--ss-accent) 35%,#fff)}
  .ss-pvbar .ss-pvbar-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ss-pvbar .ss-pvbar-x{flex:none;font-size:11.5px;font-weight:800;color:var(--ss-accent);background:#fff;
    border:1px solid color-mix(in srgb,var(--ss-accent) 45%,#fff);border-radius:6px;padding:3px 10px}
  .ss-pvbar .ss-pvbar-x:hover{background:var(--ss-accent-soft)}
  /* 정의서 모드에서만·모드별 자리: wrap·frame 은 툴바(50px) 아래, overlay 는 정의서 헤더(48px) 아래 */
  body.ss-wrap.ss-mode-doc .ss-pvbar.ss-show{display:flex;top:50px}
  /* 띠가 뜨면 그 높이(28px)만큼 아래를 민다 — 덮으면 정의서 헤더의 화면 ID·화면명이 가려진다 (#29) */
  body.ss-wrap.ss-mode-doc.ss-pv-on .ss-docmode{top:78px}
  /* overlay: 설명 패널(400px, 더 위 대역)이 오른쪽을 덮으므로 앱 영역까지만 — 「끄기」가 패널 밑에 깔리면 못 끈다 */
  body.ss-ov-doc .ss-pvbar.ss-show{display:flex;top:48px;right:400px;z-index:2147483005}
  body.ss-ov-doc.ss-pv-on{padding-top:76px!important} /* 헤더 48 + 띠 28 */
  /* transform 이 있으면 자손의 position:fixed 기준이 뷰포트가 아니라 이 상자가 된다 — 기기 화면이 곧 뷰포트다.
     없으면 프로토타입의 플로팅 버튼·바텀시트·전면 모달이 폰을 탈출해 브라우저 창 구석에 뜨고, 우리 툴바까지 덮는다.
     정의서 모드는 축소 scale() 때문에 이미 갇혀 있었다 — 프로토타입 모드만 새던 것을 같은 규칙으로 맞춘다 */
  .ss-frame{position:relative;transform:translate(0)}
  .ss-sheet{position:relative;background:#fff;border-radius:14px;overflow:auto;
    box-shadow:0 1px 3px rgba(17,24,39,.08),0 16px 44px rgba(17,24,39,.10);padding:28px 24px 40px}
  .ss-sheet.ss-narrow{padding:20px 14px 32px}
  /* frame 모드: 시트가 곧 액자다 — 여백 없이 iframe 이 꽉 채운다 (시트 폭 = 앱의 뷰포트 폭) */
  .ss-sheet.ss-sheet-frame{padding:0;overflow:hidden}
  .ss-appframe{display:block;width:100%;height:100%;border:0;background:#fff}
  /* DevTools식 리사이즈: 우측·하단 풀렝스 거터 바 + 코너 (touch-action:none = 모바일 드래그 필수) */
  .ss-edge{position:absolute;z-index:8050;touch-action:none}
  .ss-edge-r{top:0;right:-20px;width:20px;height:100%;cursor:ew-resize}
  .ss-edge-b{left:0;bottom:-20px;width:100%;height:20px;cursor:ns-resize}
  .ss-edge-c{right:-20px;bottom:-20px;width:26px;height:26px;cursor:nwse-resize}
  /* 트랙: 변 전체를 덮는 바 */
  .ss-edge-r::before{content:"";position:absolute;top:0;left:7px;width:6px;height:100%;
    border-radius:99px;background:#DEDCD6;transition:background .15s}
  .ss-edge-b::before{content:"";position:absolute;left:0;top:7px;width:100%;height:6px;
    border-radius:99px;background:#DEDCD6;transition:background .15s}
  /* 그립: 트랙 중앙의 진한 표시 */
  .ss-edge-r::after{content:"";position:absolute;top:50%;left:7px;transform:translateY(-50%);
    width:6px;height:56px;border-radius:99px;background:#B3B1AA;transition:background .15s}
  .ss-edge-b::after{content:"";position:absolute;left:50%;top:7px;transform:translateX(-50%);
    height:6px;width:56px;border-radius:99px;background:#B3B1AA;transition:background .15s}
  .ss-edge-c::after{content:"";position:absolute;right:4px;bottom:4px;width:14px;height:14px;
    border-right:4px solid #B3B1AA;border-bottom:4px solid #B3B1AA;border-radius:3px;transition:border-color .15s}
  .ss-edge-r:hover::before,.ss-edge-r.ss-dragging::before,
  .ss-edge-b:hover::before,.ss-edge-b.ss-dragging::before{background:var(--ss-accent-soft)}
  .ss-edge-r:hover::after,.ss-edge-r.ss-dragging::after,
  .ss-edge-b:hover::after,.ss-edge-b.ss-dragging::after{background:var(--ss-accent)}
  .ss-edge-c:hover::after,.ss-edge-c.ss-dragging::after{border-color:var(--ss-accent)}
  /* 터치 기기: 핸들을 시트 가장자리에 걸치게(반 안쪽) + 히트영역 확대 — 폰에서 화면 밖으로 밀리는 문제 방지 */
  @media(pointer:coarse){
    .ss-edge-r{right:-10px;width:28px}
    .ss-edge-b{bottom:-10px;height:28px}
    .ss-edge-c{right:-10px;bottom:-10px;width:36px;height:36px}
    .ss-edge-r::before,.ss-edge-r::after{left:9px;width:8px}
    .ss-edge-b::before,.ss-edge-b::after{top:9px;height:8px}
    .ss-edge-c::after{width:18px;height:18px;border-width:5px}
  }
  /* 마커 — 흰 배경 + 검은 숫자, 활성 시 포인트색 배경 + 흰 숫자 */
  .ss-marker{
    position:absolute;width:24px;height:24px;border-radius:50%;pointer-events:auto;padding:0;
    background:#fff;color:var(--ss-ink);border:1.5px solid var(--ss-line2);
    font-size:12px;font-weight:800;font-family:var(--ss-mono);
    display:grid;place-items:center;box-shadow:0 2px 8px rgba(17,24,39,.28);cursor:pointer}
  .ss-marker.ss-hot{background:var(--ss-accent);color:#fff;border-color:var(--ss-accent)}
  .ss-marker.ss-marker-sub{font-size:10.5px;letter-spacing:-.03em} /* 두 자리 번호 — 크기는 그대로, 글자만 줄여 맞춘다 */
  .ss-markers,.ss-anno{position:absolute;top:0;left:0;width:100%;height:100%;z-index:8040;pointer-events:none}
  .ss-anno{z-index:8030;overflow:visible}
  body.ss-mode-proto .ss-marker,body.ss-mode-proto .ss-anno{display:none}
${HL_CSS}
  .ss-tip{position:fixed;z-index:2147483060;max-width:280px;background:#fff;border:1px solid var(--ss-line2);
    border-radius:10px;box-shadow:0 10px 30px rgba(17,24,39,.18);padding:10px 13px;display:none;pointer-events:none}
  .ss-tip .ss-tn{font-family:var(--ss-mono);font-size:10px;font-weight:800;color:var(--ss-accent)}
  .ss-tip .ss-tt{font-size:13px;font-weight:800;margin:2px 0 3px;color:var(--ss-ink)}
  .ss-tip .ss-td{font-size:12px;color:var(--ss-ink2)}
  /* ---- 화면 목록 (목차) — 헤더의 화면 ID 클릭으로 열림 ---- */
  /* 화면 ID는 '드롭다운(select)' 모양 — 테두리+캐럿으로 누를 수 있음을 보이기 전부터 알게 한다 */
  .ss-toc-btn{cursor:pointer;display:inline-flex;align-items:center;gap:7px;border-radius:7px;padding:2px 7px 2px 8px;margin:-3px 0;
    border:1px solid var(--ss-line2);background:#fff;box-shadow:0 1px 0 rgba(17,24,39,.04);transition:border-color .12s,background .12s,color .12s}
  .ss-toc-btn:hover{border-color:var(--ss-accent);background:var(--ss-accent-soft);color:var(--ss-accent)}
  .ss-toc-caret{display:inline-flex;align-items:center;color:var(--ss-ink2);border-left:1px solid var(--ss-line2);padding-left:6px;line-height:1}
  .ss-toc-caret svg{display:block}
  .ss-toc-btn:hover .ss-toc-caret{color:var(--ss-accent);border-left-color:color-mix(in srgb,var(--ss-accent) 30%,transparent)}
  .ss-toc{position:fixed;z-index:2147483050;min-width:300px;max-width:380px;max-height:62vh;overflow-y:auto;
    background:#fff;border:1px solid var(--ss-line2);border-radius:12px;
    box-shadow:0 14px 44px rgba(17,24,39,.22);display:none}
  .ss-toc.ss-open{display:block}
  .ss-toc-head{display:flex;align-items:baseline;gap:8px;padding:11px 16px;border-bottom:1px solid var(--ss-line);
    position:sticky;top:0;background:#fff;font-size:13px;color:var(--ss-ink)}
  .ss-toc-head b{font-weight:800}
  .ss-toc-search{position:sticky;top:41px;background:#fff;padding:8px 12px;border-bottom:1px solid var(--ss-line);z-index:1}
  .ss-toc-search input{width:100%;box-sizing:border-box;font:inherit;font-size:12.5px;padding:6px 9px;border:1px solid var(--ss-line2);border-radius:7px;outline:none;color:var(--ss-ink)}
  .ss-toc-search input:focus{border-color:var(--ss-accent)}
  .ss-toc-row{display:flex;align-items:center;gap:9px;padding:9px 16px;cursor:pointer;font-size:12.5px;
    border-bottom:1px solid var(--ss-line);transition:background .12s}
  .ss-toc-row:last-child{border-bottom:0}
  .ss-toc-row:hover{background:#FAFAF9}
  .ss-toc-row.ss-cur{background:var(--ss-accent-soft)}
  .ss-toc-dot{width:7px;height:7px;border-radius:50%;background:var(--ss-ink);flex-shrink:0}
  .ss-toc-row.ss-undef .ss-toc-dot{background:#fff;border:1.3px solid var(--ss-ink3)}
  .ss-toc-id{font-family:var(--ss-mono);font-size:11.5px;font-weight:800;color:var(--ss-ink2);flex-shrink:0}
  .ss-toc-row.ss-cur .ss-toc-id{color:var(--ss-accent)}
  .ss-toc-name{font-weight:700;color:var(--ss-ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ss-toc-row.ss-undef .ss-toc-name{color:var(--ss-ink3);font-weight:500}
  .ss-toc-cnt{font-family:var(--ss-mono);font-size:10.5px;color:var(--ss-ink3);flex-shrink:0}
  /* 트리(Figma 레이어·Notion 사이드바·VS Code 탐색기 패턴): 뎁스 = 인덴트 + 세로 가이드선.
     화면이 아닌 중간 경로(그룹)는 회색 비클릭 행, 화면 행은 이름 + ID. */
  .ss-toc-body{padding:6px 0 8px}
  .ss-toc-row{padding:7px 14px 7px 0;border-bottom:0;align-items:center}
  .ss-toc-row:hover{background:#FAFAF9}
  .ss-toc-grp{display:flex;align-items:center;gap:9px;padding:8px 14px 4px 0;font-size:11.5px;font-weight:800;color:var(--ss-ink3);cursor:default}
  .ss-toc-dash{width:7px;height:2px;border-radius:2px;background:var(--ss-line2);flex-shrink:0}
  .ss-toc-ind{position:relative;display:flex;align-items:stretch;flex-shrink:0}
  .ss-toc-ind i{display:block;width:14px;border-right:1px solid var(--ss-line2);margin-right:-1px}
  .ss-toc-row .ss-toc-ind,.ss-toc-grp .ss-toc-ind{align-self:stretch;margin:-7px 10px -7px 16px}
  .ss-toc-grp .ss-toc-ind{margin-top:-8px;margin-bottom:-4px}
  .ss-toc-idr{font-family:var(--ss-mono);font-size:10.5px;font-weight:700;color:var(--ss-ink3);flex-shrink:0;max-width:40%}
  .ss-toc-row.ss-cur .ss-toc-idr{color:var(--ss-accent)}
  .ss-toc-undef{font-size:10.5px;color:var(--ss-ink3);font-weight:500;flex-shrink:0}
  .ss-toc-cov{color:var(--ss-ink2);font-weight:700}
  /* 화면 전환 알림 토스트 — 이동 인지용 */
  .ss-nav-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-6px);z-index:2147483055;
    background:var(--ss-ink);color:#fff;font-size:12.5px;font-weight:700;padding:7px 16px;border-radius:99px;
    opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;max-width:80vw;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  .ss-nav-toast.ss-show{opacity:1;transform:translateX(-50%) translateY(0)}
  .ss-toc-x{margin-left:auto;font-size:13px;color:var(--ss-ink3);padding:2px 6px;border-radius:6px}
  .ss-toc-x:hover{color:var(--ss-ink);background:var(--ss-line)}
  /* 모바일: 드롭다운 대신 전체 화면 시트 */
  @media(max-width:900px){
    .ss-toc{left:0!important;top:0!important;right:0;bottom:0;width:100%;max-width:none;max-height:none;
      border-radius:0;border:0}
    .ss-toc-head{padding:14px 18px;font-size:14px}
    .ss-toc-row{padding-top:11px;padding-bottom:11px}
  }
  /* ---- 오버레이 모드 (React·Next·SPA — DOM을 감싸지 않음) ---- */
  .ss-pill{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483040;display:flex;gap:2px;
    background:#fff;border:1px solid var(--ss-line2);border-radius:99px;padding:3px;box-shadow:0 4px 16px rgba(17,24,39,.18)}
  .ss-pill button{padding:5px 14px;border-radius:99px;font-size:12.5px;font-weight:700;color:var(--ss-ink2)}
  .ss-pill button[aria-pressed="true"]{background:var(--ss-ink);color:#fff}
  .ss-ov-header{position:fixed;top:0;left:0;right:0;height:48px;z-index:2147483010;background:#fff;
    border-bottom:1px solid var(--ss-line2);display:none;align-items:center;gap:28px;padding:0 16px}
  .ss-ov-hfields{display:flex;gap:28px;align-items:center;min-width:0}
  #ss-ovVw{margin-left:auto;margin-right:0;flex:none;font-family:var(--ss-mono);font-size:11px;color:var(--ss-ink3)}
  .ss-ov-panel{position:fixed;top:48px;right:0;bottom:0;width:400px;z-index:2147483010;background:#fff;
    border-left:1px solid var(--ss-line2);display:none;flex-direction:column;box-shadow:-8px 0 30px rgba(17,24,39,.12)}
  .ss-ov-markers{position:absolute;top:0;left:0;width:100%;height:0;z-index:2147483000;pointer-events:none;display:none}
  .ss-ov-markers .ss-marker{pointer-events:auto}
  .ss-ov-anno{position:absolute;top:0;left:0;width:100%;height:0;z-index:2147482990;overflow:visible;pointer-events:none;display:none}
  body.ss-ov-doc .ss-ov-header{display:flex}
  body.ss-ov-doc .ss-ov-panel{display:flex}
  body.ss-ov-doc .ss-ov-markers,body.ss-ov-doc .ss-ov-anno{display:block}
  /* 정의서 모드: 앱을 덮지 않고 밀어낸다 — 헤더 높이만큼 아래로, 패널 폭만큼 왼쪽으로 */
  body.ss-ov-doc{padding-top:48px!important;padding-right:400px!important}
  /* 좁은 화면: 우측 패널 대신 하단 시트 — 앱은 위에 그대로 보이고 아래로 밀림 */
  @media(max-width:900px){
    .ss-ov-panel{top:auto;left:0;right:0;bottom:0;width:100%;height:52vh;
      border-left:0;border-top:1px solid var(--ss-line2);border-radius:14px 14px 0 0;
      box-shadow:0 -10px 30px rgba(17,24,39,.18)}
    body.ss-ov-doc{padding-right:0!important;padding-bottom:54vh!important}
    body.ss-ov-doc .ss-pill{top:56px} /* 헤더 글자를 가리지 않게 아래로 */
    body.ss-ov-doc .ss-pvbar.ss-show{right:0} /* 패널이 하단 시트로 내려가므로 띠는 앱 전체 폭 */
  }
  @media (prefers-reduced-motion: reduce){.ss-ui *{transition:none!important}}
  `;

  function h(tag, attrs, html) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (html != null) el.innerHTML = html;
    return el;
  }
  /* 다른 문서(액자 안)의 스타일시트를 글자로 — 캡처가 안쪽 CSS 까지 같이 실어야 그림이 맞다 */
  function cssText(doc) {
    let out = "";
    const sheets = doc.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) out += rules[j].cssText + "\n";
      } catch (e) { /* 읽을 수 없는 시트는 건너뛴다 */ }
    }
    return out;
  }
  function injectCSS() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* 번호는 숫자만이다 (#51, PM 2026-08-30: 「1a 1b 는 너무 규격화되지 않은 것 같다」).
     하위 요소(parts)로 «1a» 를 매기던 규칙을 없앴다 — 1a 로 쓸 것은 새 번호로 전부 되고,
     깊이가 필요하면 그 번호 안의 불릿이 한다. 옛 문서에 parts 가 있어도 조용히 무시한다(안 깨진다).
     key = "1" · "2" … 마커·활성화·배치·화살표·재생이 전부 이 key 로 돈다. */
  function flatItems(specs) {
    return (specs || []).map((s) => ({ key: String(s.n), label: String(s.n), spec: s }));
  }
  /* 편집 모드는 «켜야 보이는» 것이다 (#37) — 꺼져 있으면 아래 함수들이 빈 문자열을 내므로
     정의서 DOM 은 편집 기능이 없던 때와 한 글자도 다르지 않다. 회귀 위험을 0 으로 두려는 배치다 */
  /* 편집 «모드» 를 없앴다 (#58, PM: 「노션처럼 클릭하면 편집하는 느낌으로」).
     잠긴 전달본(readonly)이 아니면 언제나 고칠 수 있다 — 켜고 끄는 상태가 없다 */
  const EDIT = !READONLY;
  function edMark(field, di, si, ti) {
    if (!EDIT) return "";
    return ' data-ed="' + field + '"' + (di == null ? "" : ' data-di="' + di + '"') + (si == null ? "" : ' data-si="' + si + '"') +
      (ti == null ? "" : ' data-ti="' + ti + '"');
  }
  function edBtn(cmd, label, title, di, si, ti) {
    return '<button type="button" data-ec="' + cmd + '"' + (di == null ? "" : ' data-di="' + di + '"') +
      (si == null ? "" : ' data-si="' + si + '"') + (ti == null ? "" : ' data-ti="' + ti + '"') +
      (title ? ' title="' + title + '"' : "") + ">" + label + "</button>";
  }
  /* 줄 하나의 손잡이 (#45) — 상시 노출 버튼(＋이유·×)을 걷어냈다. 넣기는 Enter·Tab·슬래시가,
     지우기는 빈 줄 Backspace 가 한다. 마우스를 쓰는 사람을 위해 «올렸을 때만» 나타나는 ⋮ 하나만 남긴다 */
  /* 줄 손잡이 (#49) — 잡아서 옮기는 «손잡이» 하나뿐이다. 지우기는 지금 고치는 칸에서만 나온다.
     ⋮ 를 지우기로 쓰던 것이 무슨 뜻인지 알 수 없었다는 PM 지적을 따랐다 */
  /* 블록 손잡이 (#52) — 노션처럼 «블록 왼쪽» 거터에 ＋ 와 ⠿.
     PM: 「지금은 점 6개가 맨 아래에 나와서 말이 안 돼. 하나의 블럭처럼 해줬으면 좋겠어.」 */
  function edGut(kind, di, si, ti) {
    if (!EDIT) return "";
    const at = (di == null ? "" : ' data-di="' + di + '"') + (si == null ? "" : ' data-si="' + si + '"') +
      (ti == null ? "" : ' data-ti="' + ti + '"');
    return '<span class="ss-gut ss-ui">' +
      '<button type="button" class="ss-g-add" title="여기에 넣기" data-add="' + kind + '"' + at + ">＋</button>" +
      '<button type="button" class="ss-g-grip" title="잡아서 옮기기" draggable="true" data-g="' + kind + '"' + at + ">⠿</button></span>";
  }
  /* 줄 지우기 버튼은 없앴다 (PM 2026-08-30) — 빈 줄에서 Backspace 가 그 일을 한다.
     버튼이 하나 더 있으면 «어느 쪽이 맞나» 를 사용자가 판단해야 한다 */
  /* 항목(상위) 손잡이 — 순서·삭제는 여기서만. 번호는 옮기고 지운 뒤 라이브러리가 다시 매긴다 */
  /* 항목 삭제는 제목 줄 «오른쪽» 에 (PM: 「원래 그 상태값 쪽으로」). 아래에 줄로 매달려 있으면
     무엇에 붙은 것인지 흐려지고, 블록의 머리에 있어야 «이 덩어리를 지운다» 로 읽힌다 */
  function edRowDel() {
    if (!EDIT) return "";
    return '<button type="button" class="ss-rowdel ss-ui" data-ec="delitem" title="이 항목을 통째로 삭제">×</button>';
  }
  /* 아카이브 (#46) — 하위 요소를 «만드는 길» 을 없앴다. 사용자 개념이 아니라 데이터 개념이고,
     1a 로 쓸 것은 새 번호로 전부 된다. 기존 문서의 parts 는 그대로 렌더된다 — 읽기는 하위호환 */
  /* ---- 블록 모델 (#55, PM 2026-08-30) ----
     「기능 설명 밑이 전체가 에디터고 그 안에서 다 블록이다. 1번 2번도 블록(콜아웃)이고
      그 콜아웃 안에 불릿 블록이 들어간다.」

     그래서 정의를 «평평한 블록 목록» 으로 다룬다. 옛 문서의 두 가지 겹침을 부팅 때 편다:
       subs 중첩  → indent(들여쓰기 깊이)를 가진 형제 블록
       why 속성   → 바로 뒤에 오는 화살표 블록
     한 가지 표현만 남으면 편집·드래그·저장이 전부 같은 규칙으로 돈다. */
  const B_TEXT = "text", B_BULLET = "bullet", B_WHY = "why";
  function blkKind(d) { return d && d.kind ? d.kind : B_BULLET; } /* 생략 = 불릿 (옛 문서 호환) */
  /* ---- 정의는 «트리» 다 (PM 2026-08-30) ----
     R0: 내가 옮긴 것 말고는 아무것도 안 바뀐다 — 남의 깊이도, 남의 소속도.

     평평한 목록 + 절대 깊이 숫자로는 이 약속을 못 지킨다. 부모가 저장되지 않고
     «앞쪽에서 깊이가 하나 작은 첫 블록» 으로 계산되기 때문에, 앞에 무엇이 끼거나 빠지면
     뒤 블록의 부모가 조용히 바뀐다 (실측: 272자리 중 16자리).

     그래서 부모를 «담김» 으로 확정한다. 각 블록이 자기 하위(c)를 직접 들고 있다.
     추측이 없으므로 남의 소속이 바뀔 «길» 자체가 없다.

       { t:"사양", c:[ { t:"조건" }, { t:"까닭", kind:"why" } ] }

     화면·드래그는 «펼친 목록»(flat)을 본다 — 트리는 원본, 펼친 것은 파생이다.
     그래서 그리기·자리 찾기 코드는 그대로 살고, «바꾸는» 곳만 트리를 만진다. */
  function normOne(d) {
    if (typeof d === "string") return { t: d };
    const b = { t: (d && d.t) || "" };
    if (d.kind) b.kind = d.kind;
    if (d.layer) b.layer = d.layer;
    const kids = [];
    /* 옛 문서 두 가지를 여기서 흡수한다: why 속성 · subs 중첩 */
    if (d.why) kids.push({ t: String(d.why), kind: B_WHY });
    (d.subs || []).forEach((x) => kids.push(normOne(x)));
    (d.c || []).forEach((x) => kids.push(normOne(x)));
    if (kids.length) b.c = kids;
    return b;
  }
  /* 옛 «깊이 숫자» 목록을 담김 관계로 세운다 — 숫자가 있던 문서도 그대로 열린다 */
  function normDefs(defs) {
    if (!defs) return defs;
    const root = { c: [] };
    const stack = [root];       /* stack[i] = 깊이 i 에서 지금 담고 있는 것 */
    defs.forEach((raw) => {
      const d = typeof raw === "string" ? { t: raw } : raw;
      const b = normOne(d);
      const want = Math.max(0, Math.min(2, (d && d.indent) || 0));
      const at = Math.min(want, stack.length - 1); /* 부모 없이 두 단 뛰어든 문서는 붙잡아 준다 */
      const parent = stack[at];
      (parent.c || (parent.c = [])).push(b);
      stack.length = at + 1;
      stack.push(b);
    });
    return root.c;
  }
  /* 트리를 «펼친 목록» 으로 — 그리기와 자리 찾기가 보는 것.
     path 는 뿌리에서 그 블록까지의 자리 번호들이다: [0,2,1] = 첫째의 셋째의 둘째 */
  function flatten(defs, want) {
    const out = [];
    const walk = (list, depth, path) => {
      (list || []).forEach((b, i) => {
        const p = path.concat(i);
        const keep = want === "plan" ? !b.layer : want === "dev" ? b.layer === "dev" : true;
        if (keep) out.push({ b: b, depth: depth, path: p });
        walk(b.c, depth + 1, p);
      });
    };
    walk(defs, 0, []);
    return out;
  }
  /* 자리 번호로 그 블록을 담고 있는 목록과 순번을 찾는다 — 트리를 «바꾸는» 모든 곳이 이걸 쓴다 */
  function atPath(defs, path) {
    let list = defs;
    for (let i = 0; i < path.length - 1; i++) {
      const b = list[path[i]];
      if (!b) return null;
      list = b.c || (b.c = []);
    }
    return { owner: list, idx: path[path.length - 1] };
  }
  /* 부팅 때 한 번 — 설정 원본을 제자리에서 편다. 저장도 이 모양으로 나간다 */
  function normalizeAll(screens) {
    (screens || []).forEach((sc) => {
      if (sc.dev) sc.dev = normDefs(sc.dev);
      (sc.specs || []).forEach((sp) => { if (sp.defs) sp.defs = normDefs(sp.defs); });
    });
  }

  /* 블록 하나 — 종류와 들여쓰기가 화면을 정한다. 편집은 언제나 가능하다(#58) */
  /* di = «펼친 순번» (화면에서 몇 번째 줄인가) · data-path = 트리에서의 자리.
     화면은 순번으로 짚고, 모델은 자리 번호로 짚는다 — 둘을 갈라 두면 트리를 바꿔도 그리기가 안 흔들린다 */
  function blockHTML(n, di) {
    const d = n.b, kind = blkKind(d);
    const ind = Math.max(0, Math.min(2, n.depth));
    const cls = "ss-b ss-blk ss-b-" + kind + (ind ? " ss-in" + ind : "") + (d.layer === "dev" ? " ss-b-dev" : "");
    return '<div class="' + cls + '" data-di="' + di + '" data-path="' + n.path.join(".") + '" data-kind="' + kind + '">' +
      edGut("b", di) +
      (kind === B_BULLET ? '<span class="ss-b-dot"></span>' : kind === B_WHY ? '<span class="ss-b-arrow">↳</span>' : "") +
      '<span class="ss-dt"' + edMark("b", di) + ">" + rich(d.t) + "</span></div>";
  }
  function blocksHTML(defs, want) {
    return flatten(defs, want).map(blockHTML).join("");
  }

  /* 개발 정의 (#38) — 탭으로 가르지 않는다. 개발 정의는 기획 정의를 «보면서» 쓰는 글이라
     같은 항목 안에 한 단 들여쓴 블록으로 붙인다 (결정 D2) */
  /* 트리 어디에든 개발 줄이 있으면 «있다» — 하위에 숨어 있어도 찾는다 */
  function hasDev(defs) { return flatten(defs, "dev").length > 0; }
  function devBlockHTML(defs) {
    if (!hasDev(defs)) return "";
    return '<div class="ss-dev"><span class="ss-devtag">DEV</span>' + blocksHTML(defs, "dev") + "</div>";
  }
  /* 항목에 안 붙는 화면 공통 개발 정의 — 정의 목록 맨 위에 하나 */
  function devCommonHTML(screen) {
    if (!screen || !(screen.dev || []).length) return "";
    return '<div class="ss-dev ss-dev-common"><span class="ss-devtag">DEV</span>' +
      '<span class="ss-dev-ttl">화면 공통</span>' +
      blocksHTML((screen.dev || []).map((d) => Object.assign({}, d, { layer: "dev" })), "dev") + "</div>";
  }
  /* 이 문서에 개발 정의가 하나라도 있는가 — 없으면 필터 칩을 만들지 않는다.
     layer 를 안 쓰는 기존 문서의 화면이 한 픽셀도 안 바뀌게 하려는 것이다 */
  function anyDev() {
    return SCREENS.some((sc) => (sc.dev || []).length ||
      (sc.specs || []).some((sp) => hasDev(sp.defs)));
  }
  /* ▶ 버튼(공통) — key 는 상위 "1" · 하위 "1a" */
  function playBtnHTML(sp, key) {
    const type = annoOf(sp);
    if (type.mech === "play" && sp.play)
      return '<button class="ss-play" data-play="' + key + '">▶ ' + esc(sp.play.label || "동작 재생") + "</button>";
    if (type.mech === "flow" && (sp.flowTo || sp.play)) {
      const dest = SCREENS.find((x) => x.id === sp.flowTo);
      return '<button class="ss-play" data-play="' + key + '">▶ ' + esc((sp.play && sp.play.label) || "이동: " + (dest ? dest.name : sp.flowTo)) + "</button>";
    }
    return "";
  }
  /* 상태 재현 스위치(공통) — anno 와 무관하게 preview 가 있으면 붙는다 (#27).
     ▶(play)는 화면에 있는 요소를 실제로 누르는 것이고, 이건 지금 화면에 없는 상태를 앱에 요청하는 것이다.
     켜면 라벨이 「원래대로」로 바뀐다 — 되돌리는 방법이 그 자리에 있어야 한다 (#29). 원래 라벨은 data-pvlabel 에 남긴다 */
  const PV_OFF_LABEL = "원래대로";
  function previewBtnHTML(sp, key) {
    if (!sp.preview) return "";
    const label = sp.preview.label || (sp.title ? sp.title + " 보기" : "이 상태 보기");
    return '<button class="ss-play ss-preview" data-preview="' + key + '" data-pvlabel="' + esc(label) +
      '" aria-pressed="false">' + esc(label) + "</button>";
  }
  /* 스위치 한 개의 켬/끔 표시 — 눌린 상태·채움·라벨을 한 곳에서 맞춘다 (#29) */
  function pvSetBtn(btn, on) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("ss-on", on);
    btn.textContent = on ? PV_OFF_LABEL : (btn.dataset.pvlabel || btn.textContent);
  }
  /* 기능정의 행 HTML (wrap·overlay 공용) — 행은 상위 하나. parts 는 그 안에 한 단 들여쓴 블록으로 (#25) */
  function defsRowsHTML(specs) {
    let out = "";
    (specs || []).forEach((s) => {
      const type = annoOf(s);
      out += `<div class="ss-row ss-blk" id="ss-def-${s.n}" tabindex="0" data-defrow="${s.n}">
        ${edGut("item")}<div class="ss-no">${s.n}</div>
        <div class="ss-main">
          <div class="ss-title"><span class="ss-t"${edMark("title")}>${esc(s.title)}</span><span class="ss-nowtag">현재 미표시</span>${edRowDel()}</div>
          <div class="ss-kids">${blocksHTML(s.defs, "plan", String(s.n))}</div>${devBlockHTML(s.defs)}${playBtnHTML(s, s.n)}${previewBtnHTML(s, s.n)}
        </div></div>`;
    });
    return out;
  }
  function headerFieldsHTML(screen) {
    const pathHtml = (screen.path || []).map((p) => "<span>" + esc(p) + "</span>").join('<span class="ss-sep">›</span>');
    return `
      <div class="ss-dh"><span class="ss-k">화면 ID</span><button class="ss-v ss-monoV ss-toc-btn" title="화면 목록 열기">${esc(screen.id)}<i class="ss-toc-caret"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></i></button></div>
      <div class="ss-dh"><span class="ss-k">화면명</span><span class="ss-v">${esc(screen.name)}</span></div>
      ${pathHtml ? `<div class="ss-dh"><span class="ss-k">화면 경로</span><span class="ss-v">${pathHtml}</span></div>` : ""}`;
  }
  /* 라우트 패턴 → 정규식: "/members/[id]" 식 동적 세그먼트 지원 */
  function routeToRe(route) {
    const tmp = route.replace(/\[[^\]]+\]/g, " ");
    const esc2 = tmp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + esc2.replace(/ /g, "[^/]+") + "/?$");
  }
  /* suffix 버전 — Next basePath·정적 호스팅처럼 경로 앞에 접두가 붙는 환경 지원 */
  function routeToSuffixRe(route) {
    const tmp = route.replace(/\[[^\]]+\]/g, " ");
    const esc2 = tmp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(esc2.replace(/ /g, "[^/]+") + "/?$");
  }
  function unmappedScreen(p) {
    return { id: "—", name: "정의되지 않은 화면", path: [p], specs: [], _unmapped: true, _path: p };
  }

  /* 화면 감지 (overlay·frame 공용): 보이는 root 화면 > 라우트 > 미정의.
     라우트 매칭은 exact → suffix → 경계 prefix 순. 라우트 없는 root 화면(패널·다이얼로그)은
     라우트 화면 위에 얹히는 표면이므로, 열려 있으면 라우트 결과를 이긴다(닫히면 라우트 화면으로 복귀).
     여러 개가 동시에 보이면 문서 순서상 마지막 = 가장 나중에 얹힌 표면을 택한다.
     win·doc = 앱이 사는 창·문서 (overlay 는 이 창, frame 은 액자 안). 앱 DOM 은 건드리지 않는다 — setCurrent만. */
  function detectScreenIn(core, win, doc) {
    if (core.unwiredNow()) return; /* 사람이 고른 «연결 안 된» 화면은 뒤집지 않는다 (#77) */
    /* 구체 경로 우선: 동적 세그먼트([id])가 적은 라우트를 먼저 본다 (동률이면 긴 경로).
       선언 순서에 의존하면 /members/[id] 가 뒤에 적은 /members/invite 를 삼킨다 (#15) */
    const dyn = (r) => (r.match(/\[[^\]]+\]/g) || []).length;
    const routed = SCREENS.filter((s) => s.route)
      .sort((a, b) => dyn(a.route) - dyn(b.route) || b.route.length - a.route.length);
    /* 해시 라우터(#/members)면 # 뒤를 경로로 사용 — 일반 책갈피(#section)는 해당 없음 */
    const loc = win.location;
    const p = loc.hash.indexOf("#/") === 0 ? loc.hash.slice(1).split("?")[0] : loc.pathname;
    let hit = null;
    if (routed.length) {
      hit = routed.find((s) => routeToRe(s.route).test(p));
      if (!hit) { /* basePath·정적 호스팅: 경계 일치 suffix */
        hit = routed.find((s) => s.route !== "/" && routeToSuffixRe(s.route).test(p));
      }
      if (!hit) { /* 미등록 하위 경로 → 경계(/)가 일치하는 가장 긴 prefix */
        let bestLen = -1;
        routed.forEach((s) => {
          const base = s.route.replace(/\[[^\]]+\]/g, "").replace(/\/+$/, "");
          if (!base) return; /* route "/"는 exact 매칭으로만 */
          const bounded = p === base || (p.indexOf(base) === 0 && p.charAt(base.length) === "/");
          if (bounded && base.length > bestLen) { bestLen = base.length; hit = s; }
        });
      }
    }
    /* 라우트 없는 root 화면 중 실제로 보이는 것 — 여럿이면 문서 순서상 마지막 */
    let top = null, topEl = null;
    SCREENS.forEach((sc) => {
      if ((!sc.root && !sc._rootEl) || sc.route) return;
      const el = sc._rootEl || doc.querySelector(sc.root);
      if (!el || el.getClientRects().length === 0) return;
      if (!top || (topEl.compareDocumentPosition(el) & 4 /* DOCUMENT_POSITION_FOLLOWING */)) { top = sc; topEl = el; }
    });
    if (top) { core.setCurrent(top); return; }
    if (hit) { core.setCurrent(hit); return; }
    if (!routed.length) return; /* 라우트가 하나도 없는 설정: 경로로 판단할 근거가 없으므로 유지 */
    const cur = core.current();
    core.setCurrent(cur && cur._unmapped && cur._path === p ? cur : unmappedScreen(p));
  }

  /* ============================================================
     공통 코어 — 마커·기능정의·활성화·화살표·툴팁
     ctx = {
       headerEl, cntEl, listEl, markerLayer, tip, annoLine,
       doc, win        앱이 사는 문서·창 (기본 document·window · frame 모드는 액자 안을 가리키는 게터)
       posOf(target)   → {left, top, transform}   마커 좌표 (부트별 좌표계)
       rectOf(target)  → {l,t,r,b}               화살표 좌표 (콘텐츠 좌표계)
       viewCenter()    → {x,y}                   화살표 시작 방향 기준(보이는 영역 중심)
       ensureDoc()                                 프로토타입 모드면 정의서 모드로
       afterRender()                               렌더 후 배치 트리거
     }
     ============================================================ */
  function createCore(ctx) {
    /* 앱이 사는 문서·창. 기본은 이 창이고, frame 모드는 액자(iframe) 안을 가리킨다(게터).
       ScreenSpec 자신의 UI(목차·툴팁·토스트·패널)는 어느 모드든 바깥 document 에 남는다. */
    const appDoc = () => ctx.doc || document;
    const appWin = () => ctx.win || window;
    let current = null;
    let activeKey = null;      /* 활성 항목 key — 상위 "1" · 하위 "1a" (문자열) */
    let markerEls = {};        /* key → 마커 요소 */
    let previewKey = null;     /* 지금 켜져 있는 상태 재현 항목 key — 동시에 하나만 (#27) */
    const warned = {};
    const pvTold = {};         /* 「듣는 앱 코드가 없다」 콘솔 안내는 항목당 1회 */

    function rootEl() {
      const d = appDoc();
      if (!current) return d;
      return current._rootEl || (current.root ? d.querySelector(current.root) || d : d);
    }
    /* 요소를 찾는 길이 둘이다 (2026-08-30).
         ① 이름표 data-spec — 원래의 길
         ② 선택자 sel — 번호를 «찍어서» 만들 때 같이 적어 둔다

       왜 둘인가: 저장은 설정 블록만 갈아끼우므로 화면에 붙인 data-spec 속성은 파일에 남지 않는다.
       찍어서 번호를 만들고 저장한 뒤 다시 열면 이름표가 없어 마커가 통째로 사라졌다 (2026-08-30 실측).
       선택자가 있으면 찾아서 이름표를 «다시 붙인다» — 나중에 AI 가 프로토타입을 고치며 이름표를
       지워도 같은 길로 저절로 돌아온다. */
    function targetOf(s) {
      const r = rootEl();
      const scope = r.querySelector ? r : appDoc();
      const byTag = scope.querySelector('[data-spec="' + s.target + '"]');
      if (byTag) return byTag;
      if (!s.sel) return null;
      let el = null;
      const from = pickRoot() || scope; /* 선택자는 «앱의 뿌리» 기준으로 적혀 있다 */
      try { el = from.querySelector(s.sel); } catch (e) { return null; } /* 손으로 고친 선택자가 깨졌을 수 있다 */
      if (!el || el.getAttribute("data-spec")) return null; /* 남의 번호가 붙은 요소는 뺏지 않는다 */
      el.setAttribute("data-spec", String(s.target));
      return el;
    }
    function specs() { return (current && current.specs) || []; }
    /* 상위·하위를 편 목록. 하위(part)는 parent 를 갖고, target 이 없으면 패널에만 산다 (#25) */
    function items() { return flatItems(specs()); }
    function itemOf(key) { return items().find((it) => it.key === key); }
    function blockOf(it) { return document.getElementById("ss-def-" + it.key); }

    function render() {
      ctx.headerEl.innerHTML = headerFieldsHTML(current);
      if (current._unmapped) {
        ctx.cntEl.textContent = "항목 0개";
        ctx.listEl.innerHTML = '<div class="ss-empty">이 화면은 아직 정의되지 않았습니다.<br>' +
          '설정의 <b>screens</b>에 이 경로(<code>' + esc(current._path) + '</code>)를 추가하면 여기 나타납니다.</div>';
        ctx.markerLayer.innerHTML = "";
        markerEls = {};
        return;
      }
      /* parts 가 있으면 세부를 갈라 적는다 — 「항목 8개」만 세면 정의 밀도가 실제보다 얇아 보인다 (#25).
         「상위·하위」는 관계를 가리키는 말이라 무엇의 위인지 모르면 읽히지 않아 「항목 N개 · 세부 M개」로 (#30) */
      ctx.cntEl.textContent = "항목 " + specs().length + "개";
      if (specs().length === 0) {
        /* 등록은 했지만 아직 정의를 안 쓴 화면 — 처음 붙이는 사람이 가장 오래 머무는 자리. 백지 대신 다음 할 일 (#19) */
        const r = rootEl();
        const have = (r.querySelectorAll ? r : appDoc()).querySelectorAll("[data-spec]").length;
        /* 첫 화면(FTUE) — 「코드를 이렇게 고치세요」가 아니라 「이걸 누르세요」다.
           기획자가 코드를 안 열고도 첫 번호를 붙일 수 있어야 이 도구가 시작된다 (PM 2026-08-29) */
        ctx.listEl.innerHTML = (EDIT
          ? '<div class="ss-start ss-ui">' +
            '<div class="ss-start-t">아직 비어 있습니다</div>' +
            '<div class="ss-start-d">화면에서 설명할 곳을 고르면 번호가 붙습니다.<br>번호를 누르면 바로 글을 씁니다.</div>' +
            '<button type="button" class="ss-start-b" data-ftue="pick">화면에서 번호 찍기</button>' +
            '<div class="ss-start-h">이미 <code>data-spec</code> 이 붙은 요소 <b>' + have + '개</b> 가 있습니다. 그 위를 골라도 됩니다.</div>' +
            "</div>"
          : '<div class="ss-empty">이 화면은 등록됐지만 기능 설명이 아직 없습니다.<br>' +
            '읽기 전용으로 열려 있어 여기서 쓸 수 없습니다.</div>') + covBlockHTML(current);
        ctx.markerLayer.innerHTML = "";
        markerEls = {};
        ctx.afterRender();
        return;
      }
      /* 개발 정의는 «언제나 기획 다음» 이다 — 항목 안에서도, 화면 층에서도 (#41) */
      ctx.listEl.innerHTML = defsRowsHTML(specs()) + devCommonHTML(current) + covBlockHTML(current);
      if (previewKey != null) pvSetBtn(pvBtn(previewKey), true); /* 재렌더돼도 켜진 스위치는 켜진 채로 — 라벨(원래대로)까지 (#27·#29) */
      ctx.markerLayer.innerHTML = "";
      markerEls = {};
      items().forEach((it) => {
        const el = h("button", { class: "ss-ui ss-marker", "aria-label": "기능 " + it.label + ": " + (it.spec.title || "") });
        if (it.label.length > 1) el.classList.add("ss-marker-sub");
        el.textContent = it.label;
        el.onclick = (e) => { e.stopPropagation(); activate(it.key, "marker"); };
        el.onmouseenter = () => showTip(it, el);
        el.onmouseleave = () => (ctx.tip.style.display = "none");
        ctx.markerLayer.appendChild(el);
        markerEls[it.key] = el;
      });
      watchMissing(current);
      ctx.afterRender();
    }
    /* 누락 경고 — 시간이 아니라 "앱이 다 그려졌는가" 로 판정 (#23)
       목차·flow 로 옮기면 정의서가 앱보다 먼저 그려지고, 비동기 조회 화면은 스켈레톤 → 본문 교체가 한참 뒤다.
       규칙: 앱 DOM(우리 UI 제외)에 노드 추가/삭제가 1.5초 동안 없으면 "다 그려졌다" 로 보고 센다. 변경이 계속되면 5초 상한.
             전부 찾으면 종료(clean), 못 찾은 게 있으면 그때 1회 경고. */
    const MISS_QUIET = 1500, MISS_CAP = 5000;
    const OWN_UI = ".ss-ui,.ss-markers,.ss-ov-markers,.ss-anno,.ss-ov-anno,.ss-toolbar,.ss-tip";
    /* 우리가 «그린» 것 — 마커·주석선·툴팁. 앱을 «감싸는» 컨테이너(.ss-proto-wrap·.ss-docmode)와 구분해야 한다 */
    const OWN_DRAWN = ".ss-markers,.ss-ov-markers,.ss-anno,.ss-ov-anno,.ss-tip,.ss-toc,.ss-nav-toast,.ss-pvbar";
    /* 이 변경이 «앱» 의 것인가.
       wrap·frame 은 앱을 .ss-holder 안으로 옮기는데 그 조상 컨테이너에 .ss-ui 가 붙어 있다.
       그래서 OWN_UI 만 보면 앱의 모든 변경이 «우리 UI 변경» 으로 오인돼 1.5초 리셋이 죽는다
       — 비동기 조회 화면이 여전히 누락 오탐을 받던 원인 (2026-08-26). 홀더 안쪽은 앱으로 본다. */
    const isAppChange = (n) => {
      if (!n || !n.closest) return false;
      if (n.closest(OWN_DRAWN)) return false;      /* 마커를 다시 놓는 것은 앱의 변화가 아니다 */
      if (n.closest(".ss-holder")) return true;    /* wrap·frame: 앱은 홀더 안에 산다 */
      return !n.closest(OWN_UI);                   /* overlay: 앱은 우리 UI 밖에 그대로 있다 */
    };
    let missMo = null, missTimer = null, missCap = null;
    function watchMissing(sc) {
      if (missMo) { missMo.disconnect(); missMo = null; }
      clearTimeout(missTimer); clearTimeout(missCap);
      if (warned[sc.id]) return;
      /* final=false 는 «조용해졌다» 신호, final=true 는 «상한(5초) 도달».
         전부 찾았으면 즉시 끝내고, 못 찾은 게 있으면 상한까지 기다렸다 경고한다 —
         조용하다고 다 온 것은 아니기 때문이다(응답이 1.5초보다 늦는 조회 화면). 낙관적으로 기다린다. */
      const attempt = (final) => {
        if (sc !== current || warned[sc.id]) return stop();
        const missing = [], cond = []; /* cond = anno:"state" — 조건부 표시라 없는 게 정상일 수 있어 경고에서 제외 (#20) */
        items().forEach((it) => { /* 하위 요소도 target 이 있으면 센다 — 보고는 #1a (#25) */
          const sp = it.spec;
          if (!targetOf(sp)) (sp.anno === "state" || sp.optional ? cond : missing).push(it); /* optional:true — anno 와 무관하게 조건부 (#23) */
        });
        if (!missing.length) { warned[sc.id] = "clean"; return stop(); }
        if (!final) return; /* 아직 상한 전 — 늦게 올 수도 있으니 경고를 미룬다 (감시는 계속) */
        warned[sc.id] = true;
        console.warn("[ScreenSpec] " + sc.id + ": data-spec 요소를 못 찾은 정의 " + missing.length + "건: " +
          missing.map((it) => "#" + it.label + " target=\"" + it.spec.target + "\"").join(", ") +
          " (마커 숨김. 해당 화면에 data-spec 속성이 있는지 확인)" +
          (cond.length ? " · 조건부(state·optional) " + cond.length + "건은 제외" : ""));
        stop();
      };
      const stop = () => { if (missMo) missMo.disconnect(); missMo = null; clearTimeout(missTimer); clearTimeout(missCap); };
      missMo = new MutationObserver((recs) => {
        if (!recs.some((r) => isAppChange(r.target))) return; /* 우리가 그린 것의 변경은 무시 */
        clearTimeout(missTimer);
        missTimer = setTimeout(() => attempt(false), MISS_QUIET);
      });
      missMo.observe(appDoc().body, { subtree: true, childList: true });
      missTimer = setTimeout(() => attempt(false), MISS_QUIET);
      missCap = setTimeout(() => attempt(true), MISS_CAP);
    }
    const navToast = h("div", { class: "ss-ui ss-nav-toast" });
    document.body.appendChild(navToast);
    let navTimer = null;
    /* 짧게 지나가는 한 줄 — 화면 전환 알림과 같은 자리를 쓴다 (#83) */
    function sayToast(t) {
      navToast.textContent = t;
      navToast.classList.add("ss-show");
      clearTimeout(navTimer);
      navTimer = setTimeout(() => navToast.classList.remove("ss-show"), 2600);
    }
    function showNav(sc) {
      navToast.textContent = "→ " + sc.id + " · " + sc.name + (unwired(sc) ? "  (설명만 · 프로토타입은 그대로)" : "");
      navToast.classList.add("ss-show");
      clearTimeout(navTimer);
      navTimer = setTimeout(() => navToast.classList.remove("ss-show"), 1600);
    }
    function setCurrent(sc) {
      if (!sc || sc === current) return;
      const prev = current;
      clearActive();
      previewOff(); /* 화면이 바뀌면 재현도 끈다 — 앱이 가짜 상태에 갇히지 않게 (#27) */
      current = sc;
      render();
      if (prev && !sc._unmapped && ctx.isDoc && ctx.isDoc()) showNav(sc);
    }
    /* root 기반 화면의 표시/숨김 전환 — 대상만 보이고 나머지는 숨는다.
       앱 DOM을 건드리므로 wrap 전용(ctx.toggleRoot)이며, overlay는 앱 DOM을 소유하지 않는다. */
    function showRoot(sc) {
      SCREENS.forEach((o) => {
        if (!o.root && !o._rootEl) return;
        const el = o._rootEl || appDoc().querySelector(o.root);
        if (el) el.style.display = o === sc ? "" : "none";
      });
    }
    /* 프로토타입에 «연결» 되지 않은 화면 — root 도 route 도 없으면 목차에서 골라도
       설명만 바뀌고 화면은 그대로다. 사람은 도구가 고장 난 줄 안다 (#67, PM 2026-08-31).
       정의가 가리키는 요소들의 공통 조상을 찾아 세워 두면 대부분 저절로 전환된다.
       추론한 것은 sc._rootEl 에만 담는다 — 설정(sc.root)에는 쓰지 않는다. 우리가 «추측한 것»을
       남의 파일에 저장하지 않는다는 뜻이다. 모호하면 세우지 않고 말로 알린다. */
    function loneEl(sp) {
      const d = appDoc(), one = (q) => { let h; try { h = d.querySelectorAll(q); } catch (e) { return null; } return h.length === 1 ? h[0] : null; };
      return (sp.sel && one(sp.sel)) || one('[data-spec="' + String(sp.target).replace(/["\\]/g, "\\$&") + '"]');
    }
    function commonUp(els) {
      let a = els[0];
      for (let i = 1; i < els.length && a; i++) while (a && !a.contains(els[i])) a = a.parentElement;
      return a;
    }
    let rootsTold = false;
    function ensureRoots() {
      if (SCREENS.length < 2) return;
      const open = () => SCREENS.filter((sc) => !sc.root && !sc._rootEl && !sc.route);
      if (!open().length) return;
      const d = appDoc(), guess = new Map();
      open().forEach((sc) => {
        const sps = sc.specs || [];
        if (!sps.length) return;
        const els = sps.map(loneEl).filter(Boolean);
        if (els.length !== sps.length) return;      /* 하나라도 «어느 것인지 모르겠다» 면 손대지 않는다 */
        const a = commonUp(els);
        if (a && a !== d.body && a !== d.documentElement) guess.set(sc, a);
      });
      const els = [...guess.values()];
      /* 한 화면의 조상이 다른 화면을 품으면 숨김이 서로를 잡아먹는다 — 그럴 땐 전부 포기한다 */
      if (els.some((a, i) => els.some((b, j) => i !== j && a.contains(b)))) guess.clear();
      guess.forEach((el, sc) => { sc._rootEl = el; });
      const left = open();
      if (left.length && !rootsTold) {
        rootsTold = true;
        console.warn("[ScreenSpec] 프로토타입에 연결되지 않은 화면 " + left.length + "개: " + left.map((s) => s.id).join(", ") +
          " · 목차에서 골라도 설명만 바뀌고 화면은 그대로다. 각 화면을 감싸는 요소를 root 로 적어라 (예: root: '#screen-home')");
      }
    }
    const unwired = (sc) => SCREENS.length > 1 && !sc.route && !sc.root && !sc._rootEl;
    /* 정의서 모드에서는 «지금 설명하는 화면» 만 보인다 (#75).
       우리가 세운 화면(_rootEl)에만 적용한다 — root 를 적은 화면은 프로토타입이 스스로 관리하는 것이다.
       프로토타입 모드로 돌아가면 원래 모습 그대로 되돌린다: 우리가 숨긴 것을 우리가 되살린다 */
    let soloOn = false;
    function soloRoots(on) {
      if (ctx.toggleRoot !== true) return;
      const made = SCREENS.filter((sc) => sc._rootEl);
      if (made.length < 2) return;
      if (on) {
        made.forEach((sc) => { if (sc._rootWas === undefined) sc._rootWas = sc._rootEl.style.display; });
        soloOn = true;
        showRoot(current && current._rootEl ? current : made[0]);
        return;
      }
      if (!soloOn) return;
      soloOn = false;
      made.forEach((sc) => { sc._rootEl.style.display = sc._rootWas || ""; });
    }
    function setScreen(id) {
      const next = SCREENS.find((s) => s.id === id);
      if (!next) return;
      /* 라우트 없는 root 화면은 앱 화면도 같이 전환해야 화면 감지가 되돌리지 않는다 (wrap 한정) */
      if ((next.root || next._rootEl) && !next.route && ctx.toggleRoot === true) showRoot(next);
      setCurrent(next);
    }

    function placeMarkers() {
      let moved = false;
      wireMoves();
      items().forEach((it) => {
        const t = targetOf(it.spec), m = markerEls[it.key];
        const hidden = !t || t.getClientRects().length === 0;
        const blk = blockOf(it);
        if (blk) { /* 정의는 있는데 지금 화면엔 없음: 패널에서 구분 (#27) */
          blk.classList.toggle("ss-now-hidden", hidden);
          pvTagWire(blk.querySelector(".ss-main > .ss-title > .ss-nowtag"), it, hidden);
        }
        if (!m) return;
        if (hidden) { m.style.display = "none"; return; }
        m.style.display = "";
        const pos = ctx.posOf(t);
        /* 값이 그대로면 쓰지 않는다 — 스타일 쓰기는 그 자체로 DOM 변경 신호라 감시자들을 깨운다.
           그리고 «움직였는가» 판정의 근거가 된다 (#8) */
        const L_ = pos.left + "px", T_ = pos.top + "px";
        if (m.style.left !== L_) { m.style.left = L_; moved = true; }
        if (m.style.top !== T_) { m.style.top = T_; moved = true; }
        if (m.style.transform !== pos.transform) m.style.transform = pos.transform;
      });
      drawArrow();
      return moved;
    }
    /* 움직이는 요소 추적 (#8) — 마커를 다시 놓는 계기가 창 크기·DOM 변경뿐이라,
       transform 으로 미끄러지는 캐러셀 «안쪽» 에 마커를 달면 번호만 제자리에 남았다.
       전환·애니메이션이 시작되면 따라가기 시작하고, 더 움직이지 않으면 스스로 멎는다.
       멈추는 조건을 이벤트 짝맞추기(시작 N번·끝 N번)로 세지 않는 이유: 요소가 도중에 사라지면
       끝 이벤트가 오지 않아 루프가 영원히 남는다. «움직였는가» 를 매 프레임 실제로 보는 편이 스스로 낫는다. */
    const MOVE_IDLE = 20; /* 이만큼(약 0.3초) 한 픽셀도 안 움직이면 추적을 끈다 */
    let moveWired = false, moveIdle = 0, moveRaf = null;
    function movesMarker(el) {
      if (!el || !el.contains) return false;
      return items().some((it) => { const t = targetOf(it.spec); return t && (el === t || el.contains(t)); });
    }
    function moveTick() {
      moveRaf = null;
      if (placeMarkers()) moveIdle = 0; else moveIdle++;
      if (moveIdle < MOVE_IDLE) moveRaf = requestAnimationFrame(moveTick);
    }
    function moveStart(e) {
      if (!movesMarker(e.target)) return; /* 마커와 무관한 장식 애니메이션까지 따라다닐 이유가 없다 */
      moveIdle = 0;
      if (!moveRaf) moveRaf = requestAnimationFrame(moveTick);
    }
    function wireMoves() {
      if (moveWired) return;
      const d = appDoc();
      if (!d || !d.addEventListener) return;
      moveWired = true;
      ["transitionrun", "animationstart"].forEach((n) => d.addEventListener(n, moveStart, true));
    }
    /* 화살표 규칙 (유저가 좌표를 정하지 않는다 — 위치는 항상 자동)
       - 기본(지시선): 요소 밖 56px 지점에서 요소 가장자리로. 시작 방향은 화면 중심 쪽(= 빈 공간 쪽)이라
         모서리의 작은 아이콘이든 큰 영역이든 같은 규칙으로 "바깥에서 안으로 가리키는" 콜아웃이 된다.
       - arrowTo 지정(관계선): 대상 요소 가장자리 → arrowTo 요소 가장자리. "여기를 누르면 저기" */
    const ARROW_STANDOFF = 56;
    function clampPt(x, y, B) { return { x: Math.min(Math.max(x, B.l), B.r), y: Math.min(Math.max(y, B.t), B.b) }; }
    function drawArrow() {
      const act = activeKey == null ? null : itemOf(activeKey);
      const s = act && act.spec;
      if (!s || annoOf(s).mech !== "arrow") { ctx.annoLine.setAttribute("visibility", "hidden"); return; }
      const t = targetOf(s);
      if (!t) return;
      const A = ctx.rectOf(t);
      const C = { x: (A.l + A.r) / 2, y: (A.t + A.b) / 2 };
      let from, to;
      if (s.arrowTo) {
        const bEl = appDoc().querySelector(s.arrowTo);
        if (!bEl) { ctx.annoLine.setAttribute("visibility", "hidden"); return; }
        const B = ctx.rectOf(bEl);
        from = clampPt((B.l + B.r) / 2, (B.t + B.b) / 2, A);
        to = clampPt(C.x, C.y, B);
      } else {
        const V = ctx.viewCenter();
        let dx = V.x - C.x, dy = V.y - C.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) { dx = -0.7; dy = 0.7; } else { dx /= len; dy /= len; }
        const hw = (A.r - A.l) / 2, hh = (A.b - A.t) / 2;
        const tEdge = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
        to = { x: C.x + dx * tEdge, y: C.y + dy * tEdge };
        from = { x: C.x + dx * (tEdge + ARROW_STANDOFF), y: C.y + dy * (tEdge + ARROW_STANDOFF) };
      }
      ctx.annoLine.setAttribute("x1", from.x); ctx.annoLine.setAttribute("y1", from.y);
      ctx.annoLine.setAttribute("x2", to.x); ctx.annoLine.setAttribute("y2", to.y);
      ctx.annoLine.setAttribute("visibility", "visible");
    }
    function showTip(it, m) {
      const s = it.spec;
      ctx.tip.innerHTML =
        '<div class="ss-tn">NO.' + esc(it.label) + " · " + esc(annoOf(s).label) + "</div>" +
        '<div class="ss-tt">' + esc(s.title || "") + "</div>" +
        '<div class="ss-td">' + esc((s.defs && s.defs[0] && s.defs[0].t) || "") + "</div>";
      ctx.tip.style.display = "block";
      const r = m.getBoundingClientRect();
      const w = Math.min(280, innerWidth - 24);
      let left = r.left + 16;
      if (left + w > innerWidth - 12) left = innerWidth - w - 12;
      ctx.tip.style.left = left + "px";
      ctx.tip.style.top = r.bottom + 8 + "px";
    }

    function clearActive() {
      if (activeKey == null) return;
      const it = itemOf(activeKey);
      if (it) {
        const t = targetOf(it.spec); if (t) t.classList.remove("ss-hl");
        const blk = blockOf(it); if (blk) blk.classList.remove("ss-active");
      }
      if (markerEls[activeKey]) markerEls[activeKey].classList.remove("ss-hot");
      activeKey = null;
      drawArrow();
    }
    /* key = 상위 "1" · 하위 "1a". 하위를 켜면 그 블록만 강조하고 패널은 부모 행으로 스크롤한다 (#25) */
    function activate(key, from) {
      ctx.ensureDoc();
      clearActive();
      activeKey = key;
      const it = itemOf(key);
      if (!it) return;
      const t = targetOf(it.spec);
      if (t) t.classList.add("ss-hl");
      if (markerEls[key]) markerEls[key].classList.add("ss-hot");
      const blk = blockOf(it);
      if (blk) blk.classList.add("ss-active");
      if (from === "panel" && t) t.scrollIntoView({ block: "center", behavior: SB });
      if (from === "marker") {
        const row = blk;
        if (row) row.scrollIntoView({ block: "center", behavior: SB });
      }
      drawArrow();
    }

    /* ---- 상태 재현 (#27) — 빈 상태·오류처럼 「지금 화면에 없는 상태」를 앱에게 만들어 달라고 요청한다.
       라이브러리는 앱의 상태 관리를 모른다. 표준 이벤트(screenspec:preview)를 쏘고, 앱이 듣고 싶으면 듣는다.
       앱은 리스너에서 e.detail.handled = true 로 「내가 처리했다」를 알린다 (preventDefault 와 같은 관용).
         handled=true  → 버튼이 눌린 상태(aria-pressed)로 남는다. 다시 누르면 on:false
         handled=false → 아무도 안 들었다 = 이 프로토타입은 그 상태를 못 만든다. 그 사실을 행에 적는다
       이벤트는 반드시 **앱이 사는 창**(appWin)에서, 그 창의 CustomEvent 로 만든다 —
       frame 모드의 앱은 액자(iframe) 안에 살고, 그 안에서 instanceof 가 성립해야 한다. */
    function pvBtn(key) { return ctx.listEl.querySelector('[data-preview="' + key + '"]'); }
    function firePreview(it, on) {
      const aw = appWin();
      const detail = { screen: current ? current.id : null, n: it.label, title: it.spec.title || "", on: on, handled: false };
      try {
        const CE = aw.CustomEvent || CustomEvent;
        aw.dispatchEvent(new CE("screenspec:preview", { detail: detail }));
      } catch (err) { return false; } /* cross-origin 액자 등 — 조종할 수 없다 */
      return detail.handled === true;
    }
    /* 재현 중 띠 — 패널을 안 보는 사람(옆에서 화면만 보는 디자이너·개발자)에게 「지금은 가짜 상태」를 알린다 (#29).
       툴팁·토스트처럼 한 번만 만들고 켜져 있는 동안만 보인다. 「끄기」는 스위치를 끄는 것과 같은 경로 */
    const pvBar = h("div", { class: "ss-ui ss-pvbar" },
      '<span class="ss-pvbar-t"></span><button type="button" class="ss-pvbar-x">끄기</button>');
    document.body.appendChild(pvBar);
    const pvBarText = pvBar.querySelector(".ss-pvbar-t");
    pvBar.querySelector(".ss-pvbar-x").onclick = () => previewOff();
    function pvBarShow(it) {
      pvBarText.textContent = "◑ 「" + (it.spec.title || it.label) + "」 재현 중: 실제 데이터가 아닙니다";
      pvBar.classList.add("ss-show");
      document.body.classList.add("ss-pv-on");
    }
    /* 켜져 있는 재현을 끈다 (다른 항목을 켤 때 · 화면이 바뀔 때 · 띠의 「끄기」). 앱이 가짜 상태에 갇히지 않게 한다 */
    function previewOff() {
      if (previewKey == null) return;
      const it = itemOf(previewKey), btn = pvBtn(previewKey);
      previewKey = null;
      pvSetBtn(btn, false);
      pvBar.classList.remove("ss-show");
      document.body.classList.remove("ss-pv-on");
      if (it) firePreview(it, false);
    }
    /* 「현재 미표시」 배지 ↔ 스위치 잇기 (#29) — 지금 화면에 없고 재현할 수 있는 항목만 눌리는 배지가 된다 */
    function pvTagWire(tag, it, hidden) {
      if (!tag) return;
      if (hidden && it.spec.preview) {
        tag.setAttribute("role", "button");
        tag.setAttribute("tabindex", "0");
        tag.setAttribute("title", "눌러서 이 상태를 재현합니다");
        tag.dataset.pvtag = it.key;
      } else if (tag.hasAttribute("role")) {
        tag.removeAttribute("role"); tag.removeAttribute("tabindex"); tag.removeAttribute("title");
        delete tag.dataset.pvtag;
      }
    }
    function pvTagToggle(tag) {
      const btn = pvBtn(String(tag.dataset.pvtag));
      if (btn) previewToggle(btn);
    }
    function previewToggle(btn) {
      const it = itemOf(String(btn.dataset.preview));
      if (!it) return;
      activate(it.key, "panel");
      const note = btn.nextElementSibling;
      if (note && note.classList.contains("ss-preview-none")) note.remove();
      if (previewKey === it.key) { previewOff(); return; } /* 같은 버튼 = 끄기 */
      previewOff();                                        /* 한 번에 하나만 — 켜기 전에 먼저 끈다 */
      if (firePreview(it, true)) {
        previewKey = it.key;
        pvSetBtn(btn, true);
        pvBarShow(it);
        return;
      }
      const tag = h("div", { class: "ss-preview-none" });
      tag.textContent = "이 프로토타입은 아직 이 상태를 만들지 못합니다. 정의는 있지만 화면으로 확인할 수 없습니다";
      btn.insertAdjacentElement("afterend", tag);
      const id = (current ? current.id : "") + "/" + it.key;
      if (!pvTold[id]) {
        pvTold[id] = 1;
        console.info('[ScreenSpec] preview "' + (it.spec.title || it.label) + '" 를 받는 앱 코드가 없습니다. screenspec:preview 이벤트를 들어야 재현됩니다');
      }
    }

    /* 패널 상호작용 (위임) — 행 클릭 + play/flow 버튼 + 상태 재현 스위치 + 「현재 미표시」 배지 */
    ctx.listEl.addEventListener("click", (e) => {
      const pv = e.target.closest("[data-preview]");
      if (pv) { e.stopPropagation(); previewToggle(pv); return; }
      const tag = e.target.closest("[data-pvtag]");
      if (tag) { e.stopPropagation(); pvTagToggle(tag); return; }
      const btn = e.target.closest("[data-play]");
      if (btn) {
        e.stopPropagation();
        const it = itemOf(String(btn.dataset.play));
        if (!it) return;
        const s = it.spec;
        activate(it.key, "panel");
        if (s.play && s.play.selector) {
          const el = appDoc().querySelector(s.play.selector);
          if (el) el.click(); /* flow는 실제 내비 클릭 → 화면 감지가 정의서를 자동 전환 */
        } else if (annoOf(s).mech === "flow" && s.flowTo) {
          setScreen(s.flowTo);
        }
        return;
      }
      const row = e.target.closest("[data-defrow]");
      if (row) activate(String(row.dataset.defrow), "panel");
    });
    ctx.listEl.addEventListener("keydown", (e) => {
      const tag = e.target.closest("[data-pvtag]");
      if (tag && (e.key === "Enter" || e.key === " ")) { /* 배지는 role=button 이므로 Enter·Space 둘 다 받는다 */
        e.preventDefault(); e.stopPropagation(); pvTagToggle(tag); return;
      }
      const row = e.target.closest("[data-defrow]");
      if (row && e.key === "Enter") activate(String(row.dataset.defrow), "panel");
    });

    /* ---- 화면 목록 (목차) — 트리 패턴 (Figma 레이어·Notion 사이드바·VS Code 탐색기 벤치마크):
       path 배열이 곧 트리. 각 뎁스는 인덴트 + 세로 가이드선으로 내려가고,
       화면이 아닌 중간 경로는 회색 그룹 행(비클릭), 화면은 클릭 행(이름 + ID).
       MAX_TOC_DEPTH = 인덴트 상한 — 더 깊은 path는 마지막 인덴트에 머물되 순서는 유지. ---- */
    const MAX_TOC_DEPTH = 6; /* 인덴트 상한 — 트리라 더 깊어도 순서는 유지 */
    const toc = h("div", { class: "ss-ui ss-toc" });
    document.body.appendChild(toc);
    function buildTree() {
      const root = { children: [], byKey: {} };
      SCREENS.forEach((s) => {
        const p = (s.path && s.path.length) ? s.path : [s.name];
        let node = root;
        p.forEach((seg, i) => {
          if (!node.byKey[seg]) { node.byKey[seg] = { label: seg, children: [], byKey: {}, screen: null }; node.children.push(node.byKey[seg]); }
          node = node.byKey[seg];
          if (i === p.length - 1) node.screen = node.screen || s;
        });
      });
      return root;
    }
    function guides(depth) {
      const d = Math.min(depth, MAX_TOC_DEPTH - 1);
      return `<span class="ss-toc-ind">${"<i></i>".repeat(d)}</span>`;
    }
    /* 화면 메타 viewports: ["pc"] — 이 화면이 존재하는 폭. 목차에 'PC 전용'·'모바일 전용' 배지 (#17) */
    function vpBadge(s) {
      const v = s.viewports;
      if (!Array.isArray(v) || !v.length || v.length >= 2) return "";
      const name = { pc: "PC", mobile: "모바일" }[v[0]] || v[0];
      return '<span class="ss-toc-undef ss-toc-vp">' + esc(name) + ' 전용</span>';
    }
    function renderNode(node, depth) {
      let html = "";
      const s = node.screen;
      if (s) {
        const n = (s.specs || []).length;
        const idShow = s.id.length > 14 ? "…" + s.id.slice(-13) : s.id;
        html += `<div class="ss-toc-row${current && s.id === current.id ? " ss-cur" : ""}${n ? "" : " ss-undef"}" data-toc="${esc(s.id)}" data-depth="${depth}">
          ${guides(depth)}<span class="ss-toc-dot"></span>
          <span class="ss-toc-name">${esc(s.name)}</span>
          ${n ? "" : '<span class="ss-toc-undef">미정의</span>'}${vpBadge(s)}${covBadge(s)}
          <span class="ss-toc-idr" title="${esc(s.id)}">${esc(idShow)}</span></div>`;
      } else {
        html += `<div class="ss-toc-grp" data-depth="${depth}">${guides(depth)}<span class="ss-toc-dash"></span>${esc(node.label)}</div>`;
      }
      node.children.forEach((c) => { html += renderNode(c, depth + 1); });
      return html;
    }
    function renderToc() {
      const defined = SCREENS.filter((s) => (s.specs || []).length > 0).length;
      const tree = buildTree();
      let html = "";
      tree.children.forEach((c) => { html += renderNode(c, 0); });
      /* 화면이 많으면(≥ TOC_SEARCH_MIN) 검색 — 이름·ID 부분 일치, 매칭 행 + 그 조상 그룹만 남긴다 (#9) */
      const search = SCREENS.length >= TOC_SEARCH_MIN
        ? '<div class="ss-toc-search"><input type="search" placeholder="화면 이름·ID 검색" aria-label="화면 검색"></div>' : "";
      toc.innerHTML = `<div class="ss-toc-head"><b>화면 목록</b><span class="ss-cnt">${defined}/${SCREENS.length} 정의됨</span><button class="ss-toc-x" aria-label="닫기">✕</button></div>` +
        search + '<div class="ss-toc-body">' + html + "</div>";
      const inp = toc.querySelector(".ss-toc-search input");
      if (inp) inp.addEventListener("input", () => filterToc(inp.value));
    }
    const TOC_SEARCH_MIN = 8;
    function filterToc(q) {
      q = q.trim().toLowerCase();
      const rows = [...toc.querySelectorAll(".ss-toc-body > *")];
      if (!q) { rows.forEach((r) => (r.style.display = "")); return; }
      rows.forEach((r) => (r.style.display = "none"));
      rows.forEach((r, i) => {
        if (!r.dataset.toc) return;
        const sc = SCREENS.find((s) => s.id === r.dataset.toc);
        if (!sc || !((sc.name || "").toLowerCase().includes(q) || sc.id.toLowerCase().includes(q))) return;
        r.style.display = "";
        let d = Number(r.dataset.depth); /* 조상: 위로 거슬러 가며 더 얕은 행(그룹이든 화면이든)만 — 트리 맥락 유지 */
        for (let j = i - 1; j >= 0 && d > 0; j--) {
          const g = rows[j];
          if (Number(g.dataset.depth) < d) { g.style.display = ""; d = Number(g.dataset.depth); }
        }
      });
    }
    function openToc(anchor) {
      renderToc();
      if (window.matchMedia && matchMedia("(max-width: 900px)").matches) {
        toc.style.left = "0"; toc.style.top = "0"; /* 모바일: 전체 화면 시트 */
      } else {
        const r = anchor.getBoundingClientRect();
        toc.style.left = Math.max(8, Math.min(r.left, innerWidth - 320)) + "px";
        toc.style.top = r.bottom + 8 + "px";
      }
      toc.classList.add("ss-open");
      const inp = toc.querySelector(".ss-toc-search input");
      if (inp && !(window.matchMedia && matchMedia("(max-width: 900px)").matches)) inp.focus();
    }
    function closeToc() { toc.classList.remove("ss-open"); }
    ctx.headerEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".ss-toc-btn");
      if (!btn) return;
      e.stopPropagation();
      if (toc.classList.contains("ss-open")) closeToc();
      else openToc(btn);
    });
    toc.addEventListener("click", (e) => {
      e.stopPropagation(); /* 목차 내부 클릭이 '바깥 클릭 닫기'로 오인되지 않게 */
      if (e.target.closest(".ss-toc-x")) { closeToc(); return; }
      const row = e.target.closest("[data-toc]");
      if (!row) return;
      const sc = SCREENS.find((s) => s.id === row.dataset.toc);
      closeToc();
      if (!sc) return;
      setCurrent(sc);
      /* route가 있으면 소프트 내비게이션 시도 — popstate 리스너형 라우터(SPA)는 화면도 따라온다.
         라우터가 반응하지 않는 앱이면 정의서만 전환되고 마커는 자동 숨김(콘솔 진단). */
      const aw = appWin();
      if (sc.route && aw.location.pathname !== sc.route) {
        try {
          aw.history.pushState({}, "", sc.route);
          aw.dispatchEvent(new aw.PopStateEvent("popstate")); /* 이벤트도 그 창의 realm 것으로 */
        } catch (err) { /* file:// 등 pushState 불가 환경 방어 */ }
      } else if (!sc.route && (sc.root || sc._rootEl)) {
        /* root 기반 화면: 앱 화면도 같은 방식(표시/숨김)으로 전환 — 정의서·앱 동기 유지.
           안 하면 화면 감지가 "앱은 그대로"라며 이전 화면으로 되돌린다.
           추론해서 세운 화면(_rootEl)도 같다 (#74) — 여기서 sc.root 만 보면 목차 클릭만 안 먹는다 */
        showRoot(sc);
      }
    });
    document.addEventListener("click", (e) => { if (!toc.contains(e.target)) closeToc(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeToc(); });

    /* ============================================================
       인쇄 · 화면별 PDF (#34) — 브라우저의 「PDF 로 저장」이 곧 산출물이다.
       살아 있는 시트를 «옮긴다» — 복제하면 앱의 상태와 스크립트를 잃는다.
       옮기기는 모드 전환이 이미 쓰는 동작이라 새 위험이 아니다. 끝나면 제자리로 돌린다.
       ============================================================ */
    /* ============================================================
       PNG 내보내기 (#40) — 컨플루언스·노션에 붙일 그림 한 장.
       DOM → SVG foreignObject → canvas → PNG. 캡처 라이브러리를 넣지 않는다:
       html2canvas 만 해도 gzip 48KB 로 이 라이브러리 전체보다 크다.
       세 모드가 잡을 대상이 다르므로 «무엇을 캡처할지» 만 각 모드가 알려 준다(ctx.capSource).
       ============================================================ */
    let prDlg = null;
    function prLine(n) {
      const d = n.b, kind = blkKind(d), ind = Math.max(0, Math.min(2, n.depth));
      const cls = "ss-pr-b" + (ind ? " ss-pr-in" + ind : "") + (kind === B_WHY ? " ss-pr-why" : "") +
        (kind === B_TEXT ? " ss-pr-text" : "");
      return '<li class="' + cls + '">' + (d.layer === "dev" ? '<span class="ss-pr-devtag">DEV</span>' : "") + rich(d.t) + "</li>";
    }
    function prKeep(d, layer) {
      if (layer === "plan") return d.layer !== "dev";
      if (layer === "dev") return d.layer === "dev";
      return true;
    }
    function prRows(layer) {
      let out = "";
      /* 화면 공통 개발 정의도 표의 한 행으로 — 그림 속에서는 블록보다 행이 읽기 쉽다 */
      const common = (current && current.dev) || [];
      if (common.length && layer !== "plan") {
        out += '<tr class="ss-pr-dev"><td class="ss-pr-no">·</td><td class="ss-pr-ttl">화면 공통</td>' +
          '<td class="ss-pr-tag">개발</td><td><ul>' +
          flatten(common, null).map((n) => prLine({ b: Object.assign({}, n.b, { layer: "dev" }), depth: n.depth })).join("") + "</ul></td></tr>";
      }
      items().forEach((it) => {
        let li = "";
        flatten(it.spec.defs, layer === "plan" ? "plan" : layer === "dev" ? "dev" : null).forEach((n) => { li += prLine(n); });
        out += '<tr><td class="ss-pr-no">' + esc(it.label) + "</td>" +
          '<td class="ss-pr-ttl">' + esc(it.spec.title || "") + "</td>" +
          '<td class="ss-pr-tag">' + esc(annoOf(it.spec).label) + "</td>" +
          "<td>" + (li ? "<ul>" + li + "</ul>" : "—") + "</td></tr>";
      });
      return out;
    }

    function capCSS(doc) {
      let css = "";
      const sheets = (doc || document).styleSheets;
      for (let i = 0; i < sheets.length; i++) {
        try {
          const rules = sheets[i].cssRules;
          for (let j = 0; j < rules.length; j++) css += rules[j].cssText + "\n";
        } catch (e) { /* cross-origin 스타일시트는 읽을 수 없다 — 건너뛴다 */ }
      }
      return css;
    }
    /* 바깥 주소 이미지는 그림에 «빈칸» 으로 나온다 — <img> 안의 SVG 는 바깥 요청을 못 하기 때문이다.
       조용히 백지를 내주는 것은 실패보다 나쁘므로 미리 센다 */
    function capRemoteImgs(node) {
      return node.querySelectorAll('img[src^="http"],img[src^="//"]').length;
    }
    function capHeadHTML(sc) {
      const path = (sc.path || []).map(esc).join(" › ");
      return '<div class="ss-cap-head"><div class="ss-cap-id">' + esc(sc.id || "") + "</div>" +
        '<div class="ss-cap-name">' + esc(sc.name || "") + "</div>" +
        (path ? '<div class="ss-cap-path">' + path + "</div>" : "") + "</div>";
    }
    /* 우리 뷰어 UI — 그림에는 «문서» 만 남고 뷰어는 빠진다 */
    const CAP_DROP = ".ss-toolbar,.ss-ov-header,.ss-ov-panel,.ss-pill,.ss-docmode,.ss-proto-wrap," +
      ".ss-toc,.ss-tip,.ss-pvbar,.ss-nav-toast,.ss-cap";
    const CAP_MARKS = ".ss-markers,.ss-ov-markers,.ss-anno,.ss-ov-anno";

    function capBox(opt) {
      const box = h("div", { class: "ss-cap ss-ui" },
        (opt.head === false ? "" : capHeadHTML(current || {})) + '<div class="ss-cap-body"></div>' +
        (opt.table ? '<table class="ss-pr-table"><thead><tr><th>번호</th><th>영역</th><th>유형</th><th>기능 설명</th></tr></thead><tbody>' +
          prRows(opt.layer || LAYER) + "</tbody></table>" : "") +
        ""); /* 꼬리표는 DOM 이 아니라 캔버스에 직접 쓴다 — 밑단 잘라내기(아래) 뒤에 붙여야 간격이 안 벌어진다 */
      document.body.appendChild(box);
      return box;
    }
    /* 그림을 조립한다. 되돌리는 함수를 같이 준다 — 화면은 원래대로 돌아가야 한다 */
    function capBuild(opt) {
      const src = ctx.capSource ? ctx.capSource() : null;
      if (!src) return null;
      const box = capBox(opt);
      const body = box.querySelector(".ss-cap-body");
      let restoreSrc = function () {};
      let target;

      /* sticky·backdrop-filter 중화 — 둘 다 «살아 있는 화면» 의 물건이라 정지 그림에서는 탈이 난다.
         sticky 는 스크롤이 없으면 제 흐름 자리가 정답이고(안 그러면 빈 띠 + 바가 엉뚱한 곳),
         backdrop-filter 는 SVG 캡처에서 요소를 통째로 안 그린다 (크롬 실측) */
      const stickyUndo = [];
      const capNeutralize = (root) => root.querySelectorAll("*").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position === "sticky") { stickyUndo.push([el, "position", el.style.position]); el.style.position = "relative"; }
        if (cs.backdropFilter && cs.backdropFilter !== "none") { stickyUndo.push([el, "backdropFilter", el.style.backdropFilter]); el.style.backdropFilter = "none"; }
        /* aspect-ratio 로 높이를 잡는 요소는 SVG 캡처에서 납작해진다 — 아래 내용이 통째로 위로 당겨지고
           그만큼 그림 밑에 흰 띠가 남는다 (2026-08-29 실측: 배너 115px → 6px). 지금 높이를 픽셀로 못박는다.
           offsetHeight 인 이유: 정의서 모드의 축소 배율(transform)이 rect 에는 묻지만 layout 값에는 안 묻는다 */
        if (cs.aspectRatio && cs.aspectRatio !== "auto" && el.offsetHeight) {
          stickyUndo.push([el, "height", el.style.height], [el, "aspectRatio", el.style.aspectRatio]);
          el.style.height = el.offsetHeight + "px";
          el.style.aspectRatio = "auto";
        }
      });
      const restoreSticky = () => stickyUndo.forEach(([el, k, v]) => (el.style[k] = v));

      if (src.kind === "move") {
        /* wrap — 살아 있는 시트를 «옮긴다». 복제하면 앱의 상태(입력값·canvas)를 잃는다 */
        const sheet = src.node.querySelector(".ss-sheet");
        if (!sheet) { box.remove(); return null; }
        capNeutralize(src.node); /* 높이를 재기 «전에» — sticky 채로 재면 내용보다 길게 나온다 */
        sheet.style.height = "auto";
        const full = Math.max(sheet.scrollHeight, sheet.offsetHeight);
        src.node.style.transform = "";
        sheet.style.height = full + "px";
        sheet.style.overflow = "visible";
        if (opt.markers === false) src.node.querySelectorAll(CAP_MARKS).forEach((n) => n.remove());
        body.appendChild(src.node);
        target = src.node;
        restoreSrc = function () {
          sheet.style.height = "";
          sheet.style.overflow = "";
          if (src.give) src.give(src.node);
        };
      } else {
        /* overlay·frame — 옮길 시트가 없으므로 사본을 뜬다. 다른 문서의 노드도 importNode 로 가져온다 */
        target = document.importNode(src.node, true);
        target.querySelectorAll(CAP_DROP).forEach((n) => n.remove());
        if (opt.markers === false) target.querySelectorAll(CAP_MARKS).forEach((n) => n.remove());
        else if (src.marks) src.marks.forEach((m) => target.appendChild(document.importNode(m, true)));
        /* 마커는 absolute 다. 기준이 될 것이 없으면 조립 상자(fixed)를 기준으로 잡혀
           머리말 높이만큼 통째로 밀린다 — 캡처 대상을 기준으로 세운다 */
        target.style.position = "relative";
        target.style.margin = "0";
        target.style.width = src.w + "px";
        target.style.minHeight = src.h + "px";
        target.style.background = "#fff";
        body.style.width = src.w + "px";
        body.appendChild(target);
      }

      if (src.kind !== "move") capNeutralize(target); /* 사본 쪽 — 복제 뒤라야 요소가 있다 */

      /* 여백은 «마커가 실제로 튀어나온 만큼» 만 준다. 사방에 넉넉히 주면 그림 둘레에 흰 띠가 남는다 */
      const base = (src.kind === "move" ? target.querySelector(".ss-sheet") : target).getBoundingClientRect();
      const pad = { l: 0, r: 0, t: 0, b: 0 };
      target.querySelectorAll(".ss-marker").forEach((mk) => {
        const mr = mk.getBoundingClientRect();
        pad.l = Math.max(pad.l, base.left - mr.left);
        pad.r = Math.max(pad.r, mr.right - base.right);
        pad.t = Math.max(pad.t, base.top - mr.top);
        pad.b = Math.max(pad.b, mr.bottom - base.bottom);
      });
      const up = (v) => Math.max(0, Math.ceil(v) + (v > 0 ? 2 : 0)); /* 안티에일리어싱 여유 */
      const inner = src.kind === "move" ? target.querySelector(".ss-sheet").offsetWidth : src.w;
      body.style.cssText = "box-sizing:border-box;width:" + (inner + up(pad.l) + up(pad.r)) + "px;padding:" +
        up(pad.t) + "px " + up(pad.r) + "px " + up(pad.b) + "px " + up(pad.l) + "px";
      box.style.width = Math.max(inner + up(pad.l) + up(pad.r), opt.head === false ? 0 : 320) + "px";

      return {
        box: box, remote: capRemoteImgs(target), extraCSS: src.css || "",
        restore: function () { restoreSticky(); restoreSrc(); box.remove(); },
      };
    }
    async function capPNG(opt) {
      const built = capBuild(opt || {});
      if (!built) return { ok: false, why: "지금 화면은 그림으로 뽑을 수 없습니다." };
      try {
        const r = built.box.getBoundingClientRect();
        const w = Math.ceil(r.width), hgt = Math.ceil(r.height);
        const clone = built.box.cloneNode(true);
        /* 조립 상자는 화면 밖(-99999px)에 숨겨 두는데, 그 위치가 SVG 안까지 따라가면
           그림이 캔버스 밖에 그려져 «백지» 가 나온다. 사본에서는 무력화한다 */
        clone.style.position = "static";
        clone.style.left = "auto";
        clone.style.top = "auto";
        clone.style.zIndex = "auto";
        /* 주석 안의 «--» 가 XML 파싱을 통째로 깨뜨린다 (`-----` 구분선이 흔하다) */
        const walk = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
        const dead = [];
        while (walk.nextNode()) dead.push(walk.currentNode);
        dead.forEach((n) => n.remove());
        const holder = document.createElement("div");
        holder.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
        holder.style.cssText = "width:" + w + "px;background:#fff";
        holder.appendChild(clone);
        /* CSS 안의 < 와 & 도 XML 을 깨뜨리므로 CDATA 로 감싼다 */
        const css = capCSS(document) + built.extraCSS;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + hgt + '">' +
          "<foreignObject width='100%' height='100%'><style><![CDATA[" + css.split("]]>").join("]]&gt;") + "]]></style>" +
          new XMLSerializer().serializeToString(holder) + "</foreignObject></svg>";
        const img = new Image();
        const okLoad = await new Promise((res) => {
          img.onload = () => res(true);
          img.onerror = () => res(false);
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        });
        if (!okLoad) return { ok: false, why: "이 화면은 그림으로 바꾸지 못했습니다." };
        const scale = opt && opt.scale ? opt.scale : 2;
        const cv = document.createElement("canvas");
        cv.width = w * scale;
        cv.height = hgt * scale;
        const cx = cv.getContext("2d");
        cx.fillStyle = "#fff";
        cx.fillRect(0, 0, cv.width, cv.height);
        cx.scale(scale, scale);
        cx.drawImage(img, 0, 0);
        /* 백지를 «성공» 이라고 내주지 않는다 — 흰 그림을 컨플에 붙이는 것이 가장 나쁜 실패다 */
        let ink = 0, seen = 0;
        try {
          const px = cx.getImageData(0, 0, cv.width, cv.height).data;
          for (let i = 0; i < px.length; i += 4 * 997) {
            seen++;
            if (px[i] < 245 || px[i + 1] < 245 || px[i + 2] < 245) ink++;
          }
        } catch (e) {
          return { ok: false, why: "바깥에서 불러온 이미지 때문에 그림을 만들 수 없습니다. 자체 완결 파일로 만든 뒤 다시 뽑아 주세요." };
        }
        if (seen && ink / seen < 0.002) return { ok: false, why: "그림이 비어 있게 나와 내보내지 않았습니다.", blank: true };
        /* 밑단은 «잉크가 끝난 곳» 에서 자른다 — 프로토타입의 CSS 가 SVG 캡처에서 얼마나 줄어들든
           (aspect-ratio·sticky·폰트 미세 차이 누적) 아래 흰 띠가 남지 않는다. 원인별로 쫓는 대신 결과를 보정한다.
           그런 다음 꼬리표(Made with)를 캔버스에 직접 쓴다 — DOM 에 두면 그 띠 아래 매달려 같이 밀린다 (2026-08-29) */
        let cut = cv;
        try {
          const px2 = cx.getImageData(0, 0, cv.width, cv.height).data;
          let lastInk = cv.height - 1;
          outer: for (let y = cv.height - 1; y >= 0; y--) {
            for (let x = 0; x < cv.width; x += 3) {
              const i = (y * cv.width + x) * 4;
              if (px2[i] < 245 || px2[i + 1] < 245 || px2[i + 2] < 245) { lastInk = y; break outer; }
            }
          }
          const foot = opt && opt.head === false ? false : true;
          const padB = Math.round(8 * scale), footH = foot ? Math.round(20 * scale) : 0;
          const newH = Math.min(cv.height, lastInk + 1 + padB) + footH;
          const c2 = document.createElement("canvas");
          c2.width = cv.width; c2.height = newH;
          const g2 = c2.getContext("2d");
          g2.fillStyle = "#fff";
          g2.fillRect(0, 0, c2.width, c2.height);
          g2.drawImage(cv, 0, 0);
          if (foot) {
            g2.fillStyle = "#9b9ba4";
            g2.font = 700 * 0 + Math.round(9.5 * scale) + "px system-ui, sans-serif";
            g2.textAlign = "right";
            g2.fillText("Made with ScreenSpec", c2.width - Math.round(12 * scale), newH - Math.round(7 * scale));
          }
          cut = c2;
        } catch (e) { /* 자르기가 실패해도 원본 그림은 내준다 */ }
        let url;
        try { url = cut.toDataURL("image/png"); }
        catch (e) { return { ok: false, why: "바깥에서 불러온 이미지 때문에 그림을 만들 수 없습니다. 자체 완결 파일로 만든 뒤 다시 뽑아 주세요." }; }
        return { ok: true, url: url, w: cut.width, h: cut.height, remote: built.remote, ink: +(ink / seen * 100).toFixed(1) };
      } finally { built.restore(); }
    }
    async function exportImage(opt) {
      const r = await capPNG(opt);
      if (!r.ok) { edSay2(r.why); return r; }
      const base = ((current || {}).id || "screen") + "-" + new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = r.url;
      a.download = base + ".png";
      a.click();
      edSay2(r.remote
        ? "내려받았습니다. 다만 바깥에서 불러오는 이미지 " + r.remote + "개는 빈칸으로 나옵니다. 자체 완결 파일로 만든 뒤 뽑으면 제대로 나옵니다."
        : "「" + a.download + "」 · " + r.w + "×" + r.h);
      return r;
    }

    function edSay2(msg) {
      const el = prDlg && prDlg.querySelector(".ss-cap-msg");
      if (el) el.textContent = msg || "";
    }
    /* 레이어는 «기능 설명 포함» 을 켜야 의미가 있다 — 표가 없으면 거를 것이 없다 */
    function prSyncLayer() {
      if (!prDlg) return;
      const sel = prDlg.querySelector("#ss-prLayer");
      if (!sel) return;
      const on = prDlg.querySelector("#ss-prTable").checked;
      sel.disabled = !on;
      sel.closest("label").classList.toggle("ss-off", !on);
    }
    function printOpen() {
      if (!prDlg) {
        prDlg = h("dialog", { class: "ss-prdlg ss-ui" },
          "<h3>PNG 로 내보내기</h3>" +
          '<label><input type="checkbox" id="ss-prMark" checked> 번호 표시</label>' +
          '<label><input type="checkbox" id="ss-prHead" checked> 머리말 표시: 화면 ID · 화면명 · 경로 · 일시</label>' +
          '<label><input type="checkbox" id="ss-prTable"> 기능 설명 포함</label>' +
          (anyDev() ? '<label class="ss-prdlg-sub2 ss-off">레이어 <select id="ss-prLayer" disabled><option value="all">전체</option>' +
            '<option value="plan">기획만</option><option value="dev">개발만</option></select></label>' : "") +
          '<div class="ss-cap-msg"></div>' +
          '<div class="ss-prdlg-btns"><button type="button" data-pr="cancel">닫기</button>' +
          '<button type="button" data-pr="go" class="ss-prdlg-go">내보내기</button></div>');
        document.body.appendChild(prDlg);
        prDlg.addEventListener("change", prSyncLayer);
        prDlg.addEventListener("click", (e) => {
          const b = e.target.closest("[data-pr]");
          if (!b) return;
          if (b.dataset.pr !== "go") { prDlg.close(); return; }
          const lySel = prDlg.querySelector("#ss-prLayer");
          edSay2("만드는 중…");
          /* 대화상자를 열어 둔 채 결과를 알린다 — 빈칸 이미지 경고를 읽을 자리가 필요하다 */
          exportImage({
            markers: prDlg.querySelector("#ss-prMark").checked,
            head: prDlg.querySelector("#ss-prHead").checked,
            table: prDlg.querySelector("#ss-prTable").checked,
            layer: lySel && !lySel.disabled ? lySel.value : "all",
          });
        });
      }
      edSay2("");
      prSyncLayer();
      if (prDlg.showModal) prDlg.showModal();
    }

    /* 패널 머리의 도구 자리 — 전부 삭제·저장 상태가 여기 산다 (wrap·overlay 공용).
       내보내기는 여기가 아니라 툴바로 갔다: 패널이 아니라 화면 전체에 작용하는 동작이기 때문이다 */
    function headTools() {
      if (!ctx.cntEl || !ctx.cntEl.parentNode) return null;
      let box = ctx.cntEl.parentNode.querySelector(".ss-headtools");
      if (!box) {
        box = h("span", { class: "ss-headtools ss-ui" }, "");
        ctx.cntEl.parentNode.appendChild(box);
      }
      return box;
    }
    /* 내보내기 진입점은 «화면 단위» 동작이 모이는 자리에 둔다 — 툴바(wrap)·모드 알약(overlay) */
    function prMount(box) {
      if (!box) return;
      /* 저장은 툴바로 (#58) — 패널 머리는 «쓰는 자리» 라 서식이 온다.
         고친 것을 어디에 남길지는 문서 전체에 대한 일이므로 위가 맞다.
         상태(자동저장 꺼짐·저장 중·저장됨)를 «오른쪽 위» 에 늘 띄운다 (PM 2026-08-29) */
      if (!READONLY) {
        edStat = h("span", { class: "ss-savest ss-ui" });
        box.appendChild(edStat);
        const sv = h("button", { class: "ss-headbtn ss-svbtn ss-ui", type: "button" }, "저장");
        edSvBtn = sv;
        sv.onclick = () => {
          if (typeof window.showOpenFilePicker === "function") edSaveFile();
          else edSaveDownload();
        };
        box.appendChild(sv);
        edSync();
        const cp = h("button", { class: "ss-headbtn ss-ui", type: "button",
          title: "지금까지 쓴 기능 설명을 통째로 복사합니다 (자동저장이 안 되는 브라우저용)" }, "설명 복사");
        cp.onclick = edCopyBlock;
        box.appendChild(cp);
      }
      const b = h("button", { class: "ss-headbtn ss-prbtn ss-ui", type: "button" }, "내보내기");
      b.onclick = printOpen;
      box.appendChild(b);
    }

    /* 레이어 필터 (#38) — 리뷰어는 기획만, 개발자는 개발만. 기본은 전체 */
    let LAYER = "all";
    function lyMount() {
      if (!anyDev() || !ctx.cntEl || !ctx.cntEl.parentNode) return; /* 개발 정의가 없는 문서는 예전 그대로 */
      const head = ctx.cntEl.parentNode;
      const bar = h("div", { class: "ss-layerbar ss-ui" },
        "<span>레이어</span>" +
        '<span class="ss-chips">' +
        '<button type="button" data-ly="all" aria-pressed="true">전체</button>' +
        '<button type="button" data-ly="plan" aria-pressed="false">기획</button>' +
        '<button type="button" data-ly="dev" aria-pressed="false">개발</button></span>');
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ly]");
        if (!b) return;
        LAYER = b.dataset.ly;
        bar.querySelectorAll("[data-ly]").forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.ly === LAYER)));
        if (LAYER === "all") ctx.listEl.removeAttribute("data-layer");
        else ctx.listEl.setAttribute("data-layer", LAYER);
      });
      head.parentNode.insertBefore(bar, head.nextSibling);
    }

    /* ============================================================
       편집 모드 (#37) — 정의서를 «읽는 것» 에서 «고치는 것» 으로.
       기획자는 window.SCREENSPEC 이라는 JS 객체를 평생 보지 않는다.
       고친 값은 설정 객체에 제자리로 들어가고(SCREENS 와 같은 배열을 가리킨다),
       저장은 그 객체를 텍스트로 되돌려 파일의 설정 블록만 갈아끼운다.
       ============================================================ */
    const DRAFT_KEY = "screenspec:draft:" + (location.pathname || "/");
    const OUT_KEY = "screenspec:outside:" + (location.pathname || "/"); /* 조용히 반영한 뒤 «그랬다» 고 말하려고 (#83) */
    let edEl = null;        /* 지금 고치는 중인 요소 */
    let edWas = "";         /* 고치기 전 값 — Esc 로 돌아갈 자리 */
    let edDirty = false;    /* 저장 안 된 변경이 있는가 */
    let edHandle = null;    /* 파일에 직접 저장할 때의 파일 손잡이 (세션 동안 기억) */
    let edBar = null, edBtn2 = null, edWhen = null, edMsg = null, edDraftBar = null;

    function edStore(fn) { try { return fn(); } catch (e) { return null; } } /* 사생활 보호 모드 등 localStorage 차단 대비 */
    function edSay(msg) { if (edMsg) edMsg.textContent = msg || ""; }
    /* 전부 삭제 — 되돌릴 길(Ctrl+Z)이 있어야 물어보는 것이 형식적이지 않다 */
    function edWipeAll() {
      if (!edGate()) return;
      const list = specs();
      if (!list.length) { edSay("지울 것이 없습니다"); return; }
      if (!confirm("이 화면의 기능 설명 " + list.length + "개를 전부 지웁니다. 되돌리려면 Ctrl+Z 를 누르세요.")) return;
      edSnap();
      list.length = 0;
      edTouched();
      render();
      edSay("전부 지웠습니다 (Ctrl+Z 로 되돌리기)");
    }
    let edSavedAt = "", edStat = null, edSvBtn = null, edSaving = false, edAutoT = null, edSnapped = false;
    let edMtime = 0, edOutside = false, edWatchT = null, edBar2 = null;
    let edLinkBar = null, edKnown = null; /* edKnown = 기억해 둔 손잡이 (아직 권한을 못 받았을 수 있다) */
    /* 밖에서 바뀐 것이 «무엇인가» 를 가리려면 기준이 있어야 한다 (#83) — 우리가 마지막으로 읽거나 쓴 파일 내용 */
    let edBase = null, edOutCfg = false;
    const AUTO_MS = 1200;   /* 손이 멈추면 이만큼 뒤에 파일로 — 구글 문서와 같은 감각 */
    const WATCH_MS = 3000;  /* 파일이 밖에서 바뀌었는지 보는 주기. 아래 edWatch 주석 참고 */
    function edCanFile() { return typeof window.showOpenFilePicker === "function"; }
    /* ---- 고른 파일을 기억한다 (#68, PM 2026-08-31) ----
       브라우저는 «이 페이지가 열린 그 파일» 에 스스로 쓰게 해 주지 않는다. 로컬 파일이어도 마찬가지다 —
       사람이 한 번 「이 파일」 을 골라 줘야만 쓸 수 있다. 그 한 번을 «문서당 한 번» 으로 줄인다:
       고른 손잡이를 브라우저 저장소에 담아 두고 같은 문서를 다시 열면 되꺼낸다.
       (로컬 파일에서도 이 저장소가 유지되는 것은 실측으로 확인했다.) */
    const HD_DB = "screenspec", HD_ST = "handles";
    const hdKey = () => "file:" + (location.pathname || "");
    function hdOpen() {
      return new Promise((res, rej) => {
        let r;
        try { r = indexedDB.open(HD_DB, 1); } catch (e) { return rej(e); }
        r.onupgradeneeded = () => { try { r.result.createObjectStore(HD_ST); } catch (e) { /* 이미 있다 */ } };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    async function hdPut(hd) {
      try { (await hdOpen()).transaction(HD_ST, "readwrite").objectStore(HD_ST).put(hd, hdKey()); }
      catch (e) { /* 저장소가 막힌 브라우저 — 기억을 못 할 뿐, 쓰기는 된다 */ }
    }
    async function hdGet() {
      try {
        const db = await hdOpen();
        return await new Promise((res) => {
          const g = db.transaction(HD_ST, "readonly").objectStore(HD_ST).get(hdKey());
          g.onsuccess = () => res(g.result || null);
          g.onerror = () => res(null);
        });
      } catch (e) { return null; }
    }
    /* 다시 열었을 때: 권한이 살아 있으면 조용히 잇고, 브라우저가 확인을 요구하면 «한 번 눌러» 잇는다 */
    async function edRelink() {
      if (!edCanFile() || edHandle) return;
      const hd = await hdGet();
      if (!hd) return;
      edKnown = hd;
      let perm = "prompt";
      try { perm = await hd.queryPermission({ mode: "readwrite" }); } catch (e) { return; }
      if (perm === "granted") { edAdopt(hd); return; }
      edLinkShow(true);
    }
    async function edAdopt(hd) {
      const wrong = await edMatches(hd); /* 기억해 둔 파일이 그 사이 다른 것으로 바뀌었을 수 있다 (#70) */
      if (wrong) { edKnown = null; edLinkShow(true); edSay(wrong); return; }
      try { edBase = await (await hd.getFile()).text(); } catch (e) { edBase = null; }
      edHandle = hd;
      edKnown = hd;
      edMtime = 0;
      edLinkShow(false);
      edWatch();
      edPeekFile();
      edSync();
      edSay("「" + hd.name + "」 에 이어서 저장합니다.");
    }
    /* 주소로 이미 아는 것은 말해 준다 — 「무슨 파일을 고르라는 건지」가 가장 큰 혼란이었다 (#78) */
    function edHere() {
      const raw = location.pathname || "";
      let full = raw;
      try { full = decodeURIComponent(raw); } catch (e) { full = raw; }
      return { name: full.split("/").pop() || "이 HTML 파일", dir: full.replace(/[^/]*$/, "") };
    }
    function edLinkSay(msg) {
      const box = edLinkBar && edLinkBar.querySelector(".ss-lay-msg");
      if (box) box.textContent = msg || "";
    }
    function edLinkShow(on) {
      if (!edLinkBar) return;
      if (on) {
        const at = edHere(), go = edLinkBar.querySelector(".ss-lay-go");
        edLinkBar.querySelector(".ss-lay-name").textContent = edKnown ? edKnown.name : at.name;
        edLinkBar.querySelector(".ss-lay-dir").textContent = at.dir;
        if (go) go.textContent = edKnown ? "「" + edKnown.name + "」 에 이어서 저장" : "「" + at.name + "」 고르기";
      } else edLinkSay("");
      edLinkBar.classList.toggle("ss-show", !!on);
    }
    /* 파일에 연결되지 않은 채로 고치면 그 수정은 어디에도 안 남는다 (#68).
       PM: 「수정 열심히 하면 뭐해? 반영이 안 되는데.」 그래서 다 고친 뒤가 아니라 «고치기 전에» 붙잡는다.
       파일에 못 쓰는 브라우저(사파리·모바일)에서는 막지 않는다 — 막으면 거기서는 아예 못 쓴다 */
    function edGate() {
      /* 붙잡는 것은 «로컬 파일로 연» 문서뿐이다. 주소로 받아 온 문서(사내 서버·깃허브 페이지)는
         애초에 쓸 파일이 없으므로 막을 이유가 없다 — 거기서는 「설명 복사」가 유일한 길이다 */
      if (edHandle || !edCanFile() || location.protocol !== "file:") return true;
      edLinkShow(true);
      edSay("이 문서는 아직 파일에 연결되지 않았습니다. 파일을 한 번 골라 주면 그 뒤로는 알아서 저장합니다.");
      return false;
    }
    /* 오른쪽 위 한 줄로 «지금 어떤 상태인가» 를 말한다. 사람이 저장을 신경 쓰지 않아도 되게 */
    function edSync() {
      if (edWhen) edWhen.textContent = edDirty ? "저장 안 됨" : (edSavedAt ? "마지막 저장 " + edSavedAt : "");
      if (!edStat) return;
      let cls = "ss-savest ss-ui", txt;
      if (!edCanFile()) { cls += " ss-st-off"; txt = "자동저장 안 됨 (크롬·엣지에서 됩니다)"; }
      else if (!edHandle) { cls += " ss-st-off"; txt = "자동저장 꺼짐"; }
      else if (edOutside) { cls += " ss-st-warn"; txt = "저장 멈춤"; }
      else if (edSaving) { cls += " ss-st-busy"; txt = "저장 중…"; }
      else if (edDirty) { cls += " ss-st-busy"; txt = "저장 대기"; }
      else { cls += " ss-st-on"; txt = "저장됨" + (edSavedAt ? " · " + edSavedAt : ""); }
      edStat.className = cls;
      edStat.textContent = txt;
      if (edSvBtn) {
        edSvBtn.textContent = edHandle ? "저장" : (edCanFile() ? "자동저장 켜기" : "내려받기");
        /* 자동저장이 켜져 있고 이미 저장됐으면 누를 일이 없다 — 눌러도 되는 것처럼 두지 않는다 (PM 2026-08-30) */
        const idle = edHandle && !edDirty && !edSaving && !edOutside;
        edSvBtn.disabled = !!idle;
        edSvBtn.title = !edHandle ? (edCanFile() ? "쓸 파일을 한 번 고르면 그 뒤로는 알아서 저장합니다" : "고친 내용을 파일로 내려받습니다")
          : idle ? "저장할 것이 없습니다" : "「" + edHandle.name + "」 에 바로 씁니다";
      }
    }
    function edTouched() {
      edDirty = true;
      if (edOutside && edBar2) { /* 멈춰 있는데 계속 쓰고 있다 — 그 글은 파일에 안 간다 (#83) */
        const st = edBar2.querySelector(".ss-out-stuck");
        if (st) st.textContent = " · 지금 고치는 것은 파일에 안 갑니다";
      }
      edStore(() => localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), cfg: RAW })));
      edSync();
      edAutoPlan();
    }
    function edSavedNow() {
      edDirty = false;
      edSavedAt = new Date().toLocaleTimeString();
      edStore(() => localStorage.removeItem(DRAFT_KEY));
      edSync();
    }
    /* ---- 자동저장 (PM 2026-08-29) ----
       「번호 넣고 입력하면 구글 시트 자동저장되듯이 로컬에 계속 저장되면서 가면
        그게 프로토타입 파일에 반영되고 그걸 또 클로드가 픽스하고 핑퐁이 되지 않을까.」
       파일을 한 번 고르면(브라우저가 권한을 그때 받는다) 그 뒤로는 손이 멈출 때마다 조용히 쓴다. */
    function edAutoPlan() {
      if (!edHandle || edOutside) return;
      clearTimeout(edAutoT);
      edAutoT = setTimeout(edAutoSave, AUTO_MS);
    }
    /* ---- 밖에서 바뀐 파일 알아채기 (PM 2026-08-30) ----
       PM 이 에이전트에게 프로토타입을 고치라고 하면 파일은 바뀌는데 브라우저는 모른다.
       자동저장을 켜 두면 그 파일의 손잡이를 쥐고 있으므로 «언제 바뀌었는지» 를 물어볼 수 있다.

       주기를 짧게 잡을 이유가 없다: 사람은 그동안 에이전트 쪽을 보고 있고,
       돌아오는 «순간» 확인하면 되기 때문이다. 그래서 탭이 보일 때만 3초마다 보고,
       탭이 가려지면 아예 멈추고, 돌아오면 즉시 한 번 본다.
       비용은 파일 정보 한 번 읽기다 — 내용을 읽지 않으므로 사실상 공짜다. */
    async function edPeekFile() {
      if (!edHandle || edOutside) return;
      let f;
      try { f = await edHandle.getFile(); } catch (e) { return; } /* 지워졌거나 권한이 끊겼다 */
      if (!edMtime) { edMtime = f.lastModified; return; }
      if (f.lastModified <= edMtime + 1) return;
      /* 무엇이 바뀌었는지 가린다 (#83). 정의서가 그대로면 충돌이 아니다 —
         저장은 설정 블록만 갈아끼우므로 프로토타입 변경과 내 정의는 «둘 다» 살 수 있다 */
      let text = null;
      try { text = await f.text(); } catch (e) { text = null; }
      const now = edSplit(text), was = edSplit(edBase);
      const cfgChanged = text !== null && edBase !== null && now.cfg !== was.cfg;
      const idle = !edDirty && !edEl; /* 편집 중도 아니고 미저장도 없다 = 잃을 것이 없다 */
      if (text !== null && edBase !== null && !cfgChanged && idle) {
        /* 잃을 것이 없다 — 묻지 않는다. 사람은 그동안 에이전트 쪽을 보고 있다 (#83, PM 2026-08-31) */
        try { sessionStorage.setItem(OUT_KEY, String(f.lastModified)); } catch (e) { /* 못 남겨도 반영은 한다 */ }
        location.reload();
        return;
      }
      /* 밖에서 바뀌었다 — 우리 저장을 멈춘다. 안 멈추면 다음 자동저장이 그 변경을 덮는다 */
      edOutside = true;
      edOutCfg = cfgChanged;
      clearTimeout(edAutoT);
      if (edBar2) {
        const when = new Date(f.lastModified).toLocaleTimeString();
        edBar2.querySelector(".ss-out-when").textContent = when;
        edBar2.querySelector(".ss-out-what").textContent = cfgChanged
          ? "기능 설명도 밖에서 바뀌었습니다"
          : "프로토타입이 밖에서 바뀌었습니다";
        edBar2.querySelector(".ss-out-why").textContent = cfgChanged
          ? " · 어느 쪽을 남길지 골라야 합니다"
          : " · 내 정의는 그대로입니다";
        const keep = edBar2.querySelector("[data-oc=keep]");
        keep.hidden = !cfgChanged; /* 정의서가 안 바뀌었으면 버릴 것이 없다 — 단추를 안 준다 */
        keep.textContent = "내 것으로 (밖의 설명 변경 버림)";
        edBar2.querySelector("[data-oc=reload]").textContent = cfgChanged
          ? "밖의 것으로 (내 미저장 버림)" : "새로 읽기";
        edBar2.classList.add("ss-show");
      }
      edSync();
    }
    function edWatch() {
      clearInterval(edWatchT);
      if (!edHandle) return;
      edWatchT = setInterval(() => { if (!document.hidden) edPeekFile(); }, WATCH_MS);
    }
    async function edAutoSave() {
      if (!edHandle || edSaving || edOutside) return;
      /* 쓰기 직전에 한 번 더 본다 (#83). 자동저장은 1.2초, 감시는 3초 주기라 그 사이에 들어온
         밖의 변경은 «알아채기 전에» 덮여 버렸다. 쓰기 직전 확인이 그 틈을 없앤다 */
      await edPeekFile();
      if (edOutside) return;
      edPickUp(); /* 치는 중이어도 지금까지 친 글은 담는다 */
      if (!edDirty) return;
      edSaving = true; edSync();
      const bad = await edWriteFile();
      edSaving = false;
      if (bad) { edHandle = null; edSay(bad + " 자동저장을 껐습니다."); }
      else edSavedNow();
      edSync();
    }

    /* ---- 글자 고치기 — 자리를 안 옮기고 그 자리에서 (contenteditable) ---- */
    /* 그 편집 칸이 가리키는 트리 자리 — 화면 순번(di)이 아니라 자리 번호(data-path)로 쓴다.
       걸러 그린 화면(기획만·개발만)에서는 순번이 «걸러진 목록» 기준이라 그걸로 쓰면 남의 줄을 덮는다 */
    function spotOf(el, sp) {
      const box = el.closest && el.closest(".ss-b");
      const raw = box && box.dataset.path;
      if (!raw) return null;
      return atPath(sp.defs || (sp.defs = []), raw.split(".").map(Number));
    }
    function edKeyOf(el) {
      const p = el.closest("[data-part]");
      if (p) return p.dataset.part;
      const r = el.closest("[data-defrow]");
      return r ? r.dataset.defrow : null;
    }
    function edBegin(el) {
      if (edEl === el) return;
      if (!edGate()) return; /* 파일에 연결되기 전에는 고치지 않는다 (#68) */
      if (edEl) edFinish(true);
      edEl = el;
      edSnapped = false; /* 이 칸을 고치는 동안은 «한 걸음» 이다 — Ctrl+Z 가 통째로 되돌린다 */
      edWas = richIn(el);
      el.contentEditable = "true";
      el.classList.add("ss-ed-on");
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false); /* 캐럿은 끝에 — 대개 뒤를 고친다 */
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    function edFinish(commit) {
      const el = edEl;
      if (!el) return;
      edEl = null;
      /* 화면을 다시 그리면 옛 입력칸은 문서에서 떨어져 나간다. 그것을 뒤늦게 «저장» 하면
         di·si 가 이제 다른 줄을 가리켜 엉뚱한 줄이 지워진다 (2026-08-30 실측: 줄 하나 지운 뒤
         Enter 를 치면 남은 줄까지 사라졌다). 떨어져 나간 칸의 편집은 이미 지난 일이다 */
      if (!el.isConnected) return;
      el.contentEditable = "false";
      el.classList.remove("ss-ed-on");
      const next = richIn(el); /* <b>→<strong> 정규화 + 허용 목록 밖 서식 제거 (#44) */
      if (!commit || next === edWas) {
        el.innerHTML = rich(edWas);
        /* 갓 만든 빈 줄에서 그냥 빠져나오면 «안 쓰기로 한 것» 이다 — 빈 껍데기를 남기지 않는다 (0-6).
           el.isConnected 를 보는 이유: 다시 그리면 옛 요소가 떨어져 나간 채 여기로 오는데,
           그건 사용자가 그만둔 게 아니라 우리가 화면을 갈아 끼운 것이다 (그걸 «취소» 로 읽으면 방금 만든 줄을 지운다) */
        if (!commit && !edWas && el.isConnected && el.dataset.ed === "b") { edEl = el; edKillLine(); edEl = null; }
        return;
      }
      const it = itemOf(edKeyOf(el));
      if (!it) { el.innerHTML = rich(edWas); return; }
      const s = it.spec, f = el.dataset.ed, di = Number(el.dataset.di);
      let redraw = false;
      edSnapOnce();
      if (f === "title") s.title = next;
      else if (f === "b") {
        const spot = spotOf(el, s);
        if (!spot || !spot.owner[spot.idx]) return;
        if (next) spot.owner[spot.idx].t = next;
        else {
          /* 빈 블록은 남기지 않는다 — 지운 것과 같은 뜻이다. 다만 «딸린 하위» 는 그 자리에 남긴다 */
          const gone = spot.owner[spot.idx];
          spot.owner.splice(spot.idx, 1, ...(gone.c || []));
          redraw = true;
        }
      }
      edTouched();
      /* 화면을 «저장된 형태» 로 맞춘다 — 브라우저는 굵게를 <b> 로 만드는데 우리가 담는 것은 <strong> 이다.
         여기서 안 맞추면 눈에 보이는 것과 저장된 것이 갈라진 채 다음 편집이 시작된다 (#44) */
      if (!redraw && el.isConnected && el.innerHTML !== rich(next)) el.innerHTML = rich(next);
      if (redraw) render();
    }

    /* ---- 되돌리기 (0-6) ----
       설정 전체를 글자로 찍어 두고 제자리로 되돌린다. adoptInto 가 참조를 살려 복원하므로
       화면 목록·마커가 계속 같은 것을 가리킨다. 편집 동작마다 «무엇을 어떻게 되돌릴지» 를
       따로 적지 않아도 되는 대신 스냅샷을 든다 — 설정은 작고 편집은 사람 속도다 */
    const ED_UNDO_MAX = 60;
    let edUndoS = [], edRedoS = [];
    function edSnap() {
      edUndoS.push(JSON.stringify(RAW));
      if (edUndoS.length > ED_UNDO_MAX) edUndoS.shift();
      edRedoS.length = 0;
    }
    /* 글자를 치는 동안 값이 계속 모델로 넘어가므로(실시간 저장), 기준점은 «칸에 들어간 순간» 한 번만
       찍는다. 키를 칠 때마다 찍으면 Ctrl+Z 가 글자 하나씩 되돌아가 쓸모가 없다 */
    function edSnapOnce() { if (edSnapped) return; edSnap(); edSnapped = true; }
    function edStep(back) {
      if (edEl) edFinish(true);
      const from = back ? edUndoS : edRedoS, to = back ? edRedoS : edUndoS;
      if (!from.length) { edSay(back ? "되돌릴 것이 없습니다" : "다시 할 것이 없습니다"); return; }
      to.push(JSON.stringify(RAW));
      adoptInto(RAW, JSON.parse(from.pop()));
      edTouched();
      render();
      edSay(back ? "되돌렸습니다" : "다시 했습니다");
    }

    /* ---- 블록 편집 (#55·#56·#57) ----
       필드가 넷(t·sub·sub3·why)이던 것이 «블록 하나(b)» 로 줄었다. 들여쓰기는 블록의 성질이라
       Tab 은 숫자 하나를 올리고 내릴 뿐이고, 종류(글·불릿·화살표)도 블록의 성질이다.
       그래서 «어느 층의 무엇인가» 를 따지는 분기가 통째로 사라졌다. */
    function edPos() {
      if (!edEl) return null;
      const key = edKeyOf(edEl), it = itemOf(key);
      if (!it) return null;
      /* 자리 번호는 블록 상자(.ss-b)에 붙어 있다 — 고치는 칸은 그 «안» 의 글자 span 이다 */
      const holder = edEl.closest(".ss-b");
      const raw = holder && holder.dataset.path;
      const path = raw ? raw.split(".").map(Number) : null;
      return { key: key, it: it, s: it.spec, di: Number(edEl.dataset.di), path: path };
    }
    /* 펼친 순번 → 그 블록 (화면에서 짚은 것을 모델에서 찾는다) */
    function edNode(p) {
      if (!p || !p.path) return null;
      const spot = atPath(p.s.defs || (p.s.defs = []), p.path);
      return spot && spot.owner[spot.idx] ? { spot: spot, b: spot.owner[spot.idx], depth: p.path.length - 1 } : null;
    }
    /* 다시 그린 뒤 «그 자리» 로 커서를 돌려놓는다. di 를 안 주면 그 번호의 제목으로 */
    function edGo(key, di) {
      render();
      const box = ctx.listEl.querySelector('[data-defrow="' + key + '"]');
      if (!box) return;
      const el = di == null || di !== di
        ? box.querySelector('[data-ed="title"]')
        : box.querySelector('.ss-b[data-di="' + di + '"] [data-ed]');
      if (el) edBegin(el);
    }
    function edLines(p) { return p.s.defs || (p.s.defs = []); }
    /* 다시 그린 뒤 «그 블록» 으로 커서를 돌린다.
       자리 번호로 찾으면 옮기거나 들인 뒤 엉뚱한 줄을 잡는다 — 블록 자체는 그대로이므로 그것으로 찾는다 */
    function edGoPath(key, b) {
      render();
      const it = itemOf(key);
      if (!it) return;
      /* 자리 번호(data-path)로 곧장 찾는다 — 펼친 순번은 «기획만/개발만» 필터에 따라 달라져서
         그걸로 찾으면 필터가 켜진 문서에서 엉뚱한 줄을 잡는다 (2026-08-30) */
      const n = flatten(it.spec.defs, null).find((x) => x.b === b);
      if (!n) return;
      const box = ctx.listEl.querySelector('[data-defrow="' + key + '"]');
      const el = box && box.querySelector('.ss-b[data-path="' + n.path.join(".") + '"] [data-ed]');
      if (el) edBegin(el);
    }

    /* Enter — 노션과 같다: 그냥 «빈 글 블록». 불릿을 이어 쓰는 중이면 불릿을 잇는다 (#56) */
    function edNewLine() {
      const p = edPos();
      if (!p) return;
      edFinish(true);
      edSnap();
      const defs = edLines(p);
      /* 이름 칸에서 Enter — 첫 줄이 이미 비어 있으면 그리로 간다. 빈 줄을 둘 만들지 않는다 */
      if (!p.path && defs.length && !String(defs[0].t || "").trim()) { edGo(p.key, 0); return; }
      const nb = { t: "" };
      let list, at;
      const node = edNode(p);
      if (node) {
        const cur = node.b;
        if (cur.layer) nb.layer = cur.layer;
        /* PM 결정 (#56): Enter 의 기본은 «아무것도 아닌 줄» 이다. 불릿은 «-» + 스페이스나 ＋ 로 만든다 */
        nb.kind = cur.kind === B_BULLET ? B_BULLET : B_TEXT;
        /* 형제로 «바로 뒤» — 하위를 가진 줄이어도 그 하위 «앞» 에 끼우지 않는다.
           그러면 그 하위들의 부모가 바뀐다 (R0) */
        list = node.spot.owner; at = node.spot.idx + 1;
      } else { nb.kind = B_TEXT; list = defs; at = defs.length; }
      list.splice(at, 0, nb);
      edGoPath(p.key, nb);
    }
    /* Tab / Shift+Tab — 잡아 끄는 것과 «같은 위계 규칙» 이어야 한다 (PM 2026-08-30).
       예전에는 Tab 이 그 줄의 숫자만 1 올렸다. 그래서 맨 앞 줄이 부모 없이 하위가 되고,
       두 번 누르면 0단 밑에 2단이 생기고, 하위 달린 줄을 들이면 자식이 제자리에 남아 관계가 끊겼다.
       규칙은 하나다: 바로 앞 블록보다 한 단까지 · 딸린 하위는 통째로 따라온다. */
    /* 트리에서 가장 깊은 곳까지 몇 단인가 (화면은 2단까지 그린다) */
    function deepOf(b, at) {
      let m = at;
      (b.c || []).forEach((k) => { m = Math.max(m, deepOf(k, at + 1)); });
      return m;
    }
    /* Tab / Shift+Tab — «담김» 을 바꾼다. 딸린 하위는 그 블록이 «들고» 있으므로 저절로 따라간다.
       남의 목록은 손대지 않는다 → R0 이 구조적으로 지켜진다 */
    function edIndent(deeper) {
      const p = edPos();
      if (!p) return;
      edFinish(true);
      const node = edNode(p);
      if (!node) return;
      const { spot } = node, list = spot.owner, i = spot.idx, b = list[i];
      if (deeper) {
        const prev = list[i - 1];
        /* 트리에서 «들어간다» = 바로 앞 형제의 하위가 된다. 앞 형제가 없으면 들어갈 곳이 없다 */
        if (!prev) { edSay("앞에 붙일 줄이 없어 더 들어갈 수 없습니다"); return; }
        if (deepOf(b, node.depth + 1) > 2) { edSay("딸린 하위가 너무 깊어집니다"); return; }
        edSnap();
        list.splice(i, 1);
        (prev.c || (prev.c = [])).push(b); /* 바로 앞 줄의 «마지막 하위» 가 된다 (노션과 같다) */
      } else {
        if (p.path.length < 2) { edSay("더 나올 수 없습니다"); return; }
        const up = atPath(edLines(p), p.path.slice(0, -1)); /* 부모가 담긴 자리 */
        edSnap();
        list.splice(i, 1);
        if (!list.length) delete up.owner[up.idx].c;
        up.owner.splice(up.idx + 1, 0, b); /* 부모 «바로 뒤» 형제로 */
      }
      edTouched();
      edGoPath(p.key, b);
    }
    /* 빈 줄에서 Backspace — 그 블록을 지우고 앞 블록으로 */
    function edKillLine() {
      const p = edPos();
      const node = edNode(p);
      if (!node) return;
      edSnap();
      const { spot } = node, b = spot.owner[spot.idx];
      /* 지운 줄이 하위를 들고 있었으면 그 하위는 «있던 자리» 에 그대로 남는다 — 사라지면 안 된다 */
      spot.owner.splice(spot.idx, 1, ...(b.c || []));
      edTouched();
      /* 커서는 «지운 자리 바로 앞 줄» 로. 첫 줄을 지웠으면 그 자리에 온 줄로 */
      const flat = flatten(edLines(p), null);
      const at = Math.max(0, Math.min(flat.length - 1, node.spot.idx === 0 && p.path.length === 1 ? 0 : 0));
      if (!flat.length) { render(); return; }
      edGoPath(p.key, flat[at].b);
    }
    /* 블록 종류 바꾸기 — 슬래시·＋ 메뉴와 «-» 단축키가 함께 쓴다 */
    function edSetKind(kind) {
      const p = edPos();
      const node = edNode(p);
      if (!node) return;
      const d = node.b;
      edSnap();
      if (kind === B_BULLET) delete d.kind; else d.kind = kind;
      /* 화살표(까닭)는 «앞 줄의 하위» 가 자연스럽다 — 앞 줄이 있고, 아직 뿌리에 있을 때만 */
      if (kind === B_WHY && p.path.length === 1) {
        const list = node.spot.owner, i = node.spot.idx, prev = list[i - 1];
        if (prev && deepOf(d, 1) <= 2) { list.splice(i, 1); (prev.c || (prev.c = [])).push(d); }
      }
      edTouched();
      edGoPath(p.key, d);
    }

    /* 슬래시 메뉴 (#42) — 항목은 셋뿐이다: 번호 · 불릿 · 이유.
       「설명 줄 / 하위 줄」로 나눴던 것은 우리 데이터 구조(defs·subs)를 그대로 메뉴로 내보낸 실수였다 —
       둘은 같은 불릿이고 층은 Tab 이 정한다(노션과 같음). 개발 정의·유형·하위 요소는 아카이브(#46).
       왼쪽 아이콘+이름, 오른쪽은 마크다운 단축키(없는 항목은 비운다) */
    const SLASH = [
      { k: "num", ico: "①", nm: "번호", key: "화면에서 찍기" },
      { k: "bul", ico: "•", nm: "불릿", key: "-" },
      { k: "why", ico: "↳", nm: "화살표", key: ">" },
    ];
    let edMenu = null, edMenuAt = 0;
    function edSlashClose() { if (edMenu) { edMenu.remove(); edMenu = null; } }
    function edSlash() {
      const p = edPos();
      if (!p) return;
      edSlashClose();
      edMenu = h("div", { class: "ss-slash ss-ui" },
        '<div class="ss-slash-g">넣기</div>' +
        SLASH.map((x, i) =>
          '<button type="button" data-sl="' + x.k + '"' + (i === 0 ? ' class="on"' : "") + '>' +
          '<span class="ss-sl-ico">' + x.ico + "</span><span class=\"ss-sl-nm\">" + x.nm + "</span>" +
          '<span class="ss-sl-key">' + esc(x.key) + "</span></button>").join(""));
      document.body.appendChild(edMenu);
      edMenuAt = 0;
      const r = edEl.getBoundingClientRect();
      edMenu.style.left = Math.round(Math.min(r.left, innerWidth - 300)) + "px";
      edMenu.style.top = Math.round(Math.min(r.bottom + 4, innerHeight - 170)) + "px";
      edMenu.addEventListener("mousedown", (e) => {
        const b = e.target.closest("[data-sl]");
        if (!b) return;
        e.preventDefault(); /* 커서를 뺏지 않는다 — 고치던 줄이 그대로 살아 있어야 한다 */
        edPick(b.dataset.sl, p);
      });
    }
    /* 메뉴가 떠 있는 동안 ↑↓ 로 고르고 Enter 로 넣는다 — 손이 키보드를 떠나지 않게 */
    function edMenuKey(e) {
      if (!edMenu) return false;
      const btns = [...edMenu.querySelectorAll("[data-sl]")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        edMenuAt = (edMenuAt + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length;
        btns.forEach((b, i) => b.classList.toggle("on", i === edMenuAt));
        return true;
      }
      if (e.key === "Enter") { const p = edPos(); if (p) edPick(btns[edMenuAt].dataset.sl, p); return true; }
      if (e.key === "Escape") { edSlashClose(); return true; }
      return false;
    }
    function edPick(kind, p) {
      edSlashClose();
      if (kind === "num") { edFinish(true); pickStart(); return; }
      if (kind === "bul") { edSetKind(B_BULLET); return; }
      if (kind === "why") { edSetKind(B_WHY); return; }
    }

    /* ---- 번호 찍기 (#43) ----
       지금까지 번호는 프로토타입에 미리 심어 둔 data-spec 이 있어야만 붙었다 — 기획자가 쓸 수 있는 길이 아니다.
       화면에서 직접 고른다: 호버로 잡고, 방향키로 넓히고 좁히고, 클릭으로 확정한다.
       방향키가 핵심이다 — 클릭 한 번으로 원하는 요소를 정확히 잡는 건 거의 불가능해서(작은 글자가 잡힌다)
       개발자도구·피그마가 쓰는 관습을 그대로 빌렸다. 배울 것이 없다는 게 이 방식의 값이다.

       저장은 프로토타입에 data-spec 을 «직접 쓴다» (로드맵 D7): 우리 약속은 «코드 불변» 이 아니라
       «동작 불변» 이다. 보이지 않는 이름표라 프로토타입은 하던 대로 움직인다. */
    /* 이 요소를 다시 찾아올 «짧고 안 흔들리는» 길. id 가 있으면 그것으로 끝내고,
       없으면 뿌리까지 올라가며 몇 번째 자식인지로 길을 만든다. 클래스는 쓰지 않는다 —
       프로토타입의 클래스는 디자인을 고칠 때마다 바뀌므로 길잡이로 못 쓴다 */
    function selOf(el) {
      /* 뿌리는 «앱의 뿌리» 다 (rootEl 이 아니라 pickRoot). 문서 전체를 뿌리로 잡으면
         우리 껍데기(.ss-docmode > .ss-stage > …)까지 길에 섞여 들어가, 우리가 껍데기를
         바꾸는 순간 남의 프로토타입 선택자가 깨진다 (2026-08-30 실측) */
      const root = pickRoot();
      /* id 는 «그 요소를 정확히 가리키는가» 로 본다 — 개수만 세면 같은 id 가 둘일 때 엉뚱한 것을 잡는다.
         [id="..."] 를 쓰는 이유: 이 파일 안에서 CSS 는 «우리 스타일시트 문자열» 이라 브라우저의
         CSS.escape 가 가려져 있다. 그걸 부르면 조용히 실패한다 (2026-08-30 실측) */
      const byId = (id) => '[id="' + String(id).replace(/["\\]/g, "\\$&") + '"]';
      const ok = (n) => {
        if (!n.id) return false;
        try { return root.querySelector(byId(n.id)) === n; } catch (e) { return false; }
      };
      const parts = [];
      let node = el;
      while (node && node !== root && node.nodeType === 1) {
        if (ok(node)) { parts.unshift(byId(node.id)); break; }
        const tag = node.tagName.toLowerCase();
        const kin = [...(node.parentNode ? node.parentNode.children : [])].filter((x) => x.tagName === node.tagName);
        parts.unshift(kin.length > 1 ? tag + ":nth-of-type(" + (kin.indexOf(node) + 1) + ")" : tag);
        node = node.parentNode;
        if (parts.length > 12) return null; /* 너무 깊으면 길이 오히려 약하다 */
      }
      const sel = parts.join(" > ");
      /* «그 요소를 정확히 가리키는가» 로 검사한다 — 개수만 세면 나중에 우리가 넣는 마커 단추 같은 것이
         같은 모양으로 걸려도 모른다 (2026-08-30: 시트 안 button 이 둘이 됐다) */
      try { return root.querySelector(sel) === el ? sel : null; } catch (e) { return null; }
    }
    let pickOn = false, pickEl = null, pickBox = null, pickTip = null;
    const PICK_MIN = 12; /* 이보다 작은 것은 찍을 것이 못 된다 */

    /* 찍을 수 있는 것 = «앱의 요소» 다. 정의서 모드에서는 프로토타입이 우리 껍데기(.ss-docmode.ss-ui) «안» 에
       들어가 있어서 «ss-ui 조상이 있으면 제외» 로 판정하면 전부 걸린다 (2026-08-30 실측).
       그래서 위가 아니라 «아래» 를 본다: 앱의 뿌리(시트/오버레이 본문) 안에 있고, 우리 물건이 아니면 후보다 */
    function pickRoot() {
      const d = appDoc();
      return d.querySelector(".ss-sheet") || (ctx.capSource && ctx.capSource() && ctx.capSource().node) || d.body;
    }
    function pickOurs(el, root) {
      /* 훑기는 «루트에서 멈춘다» — 루트 위쪽은 우리 껍데기라 계속 올라가면 무엇이든 우리 것이 된다 */
      for (let n = el; n && n !== root; n = n.parentElement) {
        const c = n.className;
        if (typeof c === "string" && /(^| )ss-(ui|markers|ov-markers|cap|anno|marker)( |$)/.test(c)) return true;
      }
      return false;
    }
    function pickCandidate(el) {
      const root = pickRoot();
      if (!el || !root || el === root || !root.contains(el)) return null;
      if (pickOurs(el, root)) return null;
      const r = el.getBoundingClientRect();
      if (r.width < PICK_MIN || r.height < PICK_MIN) return el.parentElement ? pickCandidate(el.parentElement) : null;
      return el;
    }
    function pickShow(el) {
      pickEl = el;
      if (!el) { if (pickBox) pickBox.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      pickBox.style.display = "block";
      pickBox.style.left = r.left + "px";
      pickBox.style.top = r.top + "px";
      pickBox.style.width = r.width + "px";
      pickBox.style.height = r.height + "px";
      const nm = el.getAttribute("data-spec") ? "번호 " + el.getAttribute("data-spec") + " 자리"
        : (el.id ? "#" + el.id : el.tagName.toLowerCase() + (el.className && el.className.split ? "." + el.className.split(" ")[0] : ""));
      pickTip.textContent = nm + " · " + Math.round(r.width) + "×" + Math.round(r.height);
      pickTip.style.left = Math.max(6, Math.min(r.left, innerWidth - 240)) + "px";
      pickTip.style.top = (r.top > 34 ? r.top - 28 : r.bottom + 6) + "px";
    }
    function pickMove(e) { const el = pickCandidate(e.target); if (el && el !== pickEl) pickShow(el); }
    function pickKey(e) {
      if (!pickOn) return;
      const k = e.key;
      if (k === "Escape") { e.preventDefault(); pickStop(); return; }
      if (!pickEl) return;
      let next = null;
      if (k === "ArrowUp") next = pickCandidate(pickEl.parentElement);
      else if (k === "ArrowDown") next = [...pickEl.children].map(pickCandidate).filter(Boolean)[0];
      else if (k === "ArrowLeft" || k === "ArrowRight") {
        const sib = [...(pickEl.parentElement ? pickEl.parentElement.children : [])].filter((x) => pickCandidate(x) === x);
        const at = sib.indexOf(pickEl);
        if (at >= 0) next = sib[(at + (k === "ArrowRight" ? 1 : sib.length - 1)) % sib.length];
      } else if (k === "Enter") { e.preventDefault(); pickTake(pickEl); return; }
      if (next) { e.preventDefault(); pickShow(next); }
    }
    function pickClick(e) { e.preventDefault(); e.stopPropagation(); const el = pickCandidate(e.target); if (el) pickTake(el); }

    /* 찍은 요소를 번호로 만든다 — 이미 번호가 있으면 새로 만들지 않고 그 항목으로 간다 */
    function pickTake(el) {
      const had = el.getAttribute("data-spec");
      pickStop();
      if (had) {
        const it = items().find((x) => String(x.spec.target) === String(had));
        if (it) { activate(it.key, "marker"); edGo(it.key); return; }
      }
      edSnap();
      const list = specs();
      let tag = had;
      if (!tag) { /* 비어 있는 번호를 찾아 붙인다 — 사람이 정하는 값이 아니다 */
        let n = 1;
        const used = new Set(list.map((s) => String(s.target)));
        while (used.has(String(n))) n++;
        tag = String(n);
        el.setAttribute("data-spec", tag);
      }
      /* 이름은 비워 둔다 — 「새 영역」 이 진짜 글자로 박혀 있으면 타이핑이 그 뒤에 붙는다 (PM 2026-08-29) */
      const sp = { n: list.length + 1, target: tag, title: "", defs: [{ t: "" }] };
      /* 이름표는 화면에만 붙고 파일에는 안 남는다 — 다시 찾아올 길을 설정에 같이 적는다 */
      const sel = selOf(el);
      if (sel) sp.sel = sel;
      list.push(sp);
      edRenumber();
      edTouched();
      render();
      const key = String(sp.n);
      edGo(key);
      edSay("번호 " + sp.n + " 을 붙였습니다. 이름을 쓰고 Enter 를 치면 설명으로 넘어갑니다");
    }
    function pickStop() {
      if (!pickOn) return;
      pickOn = false;
      const d = appDoc();
      d.removeEventListener("mousemove", pickMove, true);
      d.removeEventListener("click", pickClick, true);
      removeEventListener("keydown", pickKey, true);
      document.body.classList.remove("ss-picking");
      if (pickBox) { pickBox.remove(); pickBox = null; }
      if (pickTip) { pickTip.remove(); pickTip = null; }
      pickEl = null;
    }
    function pickStart() {
      if (!edGate()) return;
      if (pickOn) return;
      pickOn = true;
      pickBox = h("div", { class: "ss-pick-box ss-ui" });
      pickTip = h("div", { class: "ss-pick-tip ss-ui" });
      document.body.appendChild(pickBox);
      document.body.appendChild(pickTip);
      document.body.classList.add("ss-picking");
      const d = appDoc();
      d.addEventListener("mousemove", pickMove, true);
      d.addEventListener("click", pickClick, true);
      addEventListener("keydown", pickKey, true);
      edSay("번호를 붙일 곳을 고르세요. ↑↓ 넓게·좁게, ←→ 옆 요소, Esc 취소");
    }

    /* ============================================================
       잡아서 옮기기 (#55) — 계산 · 그리기 · 실행을 가른다

       철학 (PM 과 합의, 2026-08-30):
         1) 표시는 «자리를 차지하지 않는다». 무엇을 그려도 글은 한 픽셀도 안 움직인다.
            흐름 안에 그리면 그리는 순간 밀리고 → 커서 밑이 바뀌고 → 다시 그려져 떤다.
         2) 표시는 «놓으면 무엇이 되는가» 만 말한다.
            박스 = 어느 덩어리 «안» 인가(소속) · 선 = 그 안 어느 «자리» 인가 · 아무것도 없음 = 안 바뀐다.
         3) 브라우저의 «놓을 수 없음(🚫)» 표시는 끄는 내내 한 번도 안 나온다.
            놓을 수 없는 자리는 «아무 일도 안 일어나는 것» 으로 족하다. 🚫 는 「고장」 처럼 읽힌다.
         4) 커서는 자유롭다. 블록 위에 정확히 올릴 필요 없이 «가장 가까운 자리» 로 붙는다.

       위계 규칙 (여기가 «맞다» 의 정의. scripts/qa-drag.js 가 이 규칙으로 전수 검증한다):
         R0 불변   : 내가 옮긴 것 말고는 아무것도 안 바뀐다 — 남의 깊이도, 남의 소속도.
                     트리라서 «구조적으로» 지켜진다: 옮기기는 «담긴 목록에서 빼서 다른 목록에 넣기» 이고,
                     하위는 그 블록이 들고 있으므로 남의 목록은 손댈 일이 없다
         R1 자리   : 눈에 보이는 «줄과 줄 사이» 하나. 커서에서 가장 가까운 경계
         R2 깊이   : 원래 깊이 + 잡은 곳에서 옆으로 간 칸수 (아래로만 끌면 같은 단)
         R3 상한   : 넣을 자리 바로 앞 블록보다 한 단까지 (최대 2단). 앞이 없으면 0단
         R4 제외   : 끌고 있는 덩어리는 «이미 빠진 셈» — 자기가 자기 부모가 되지 않게
         R5 무표시 : 자기 하위 안 · 놓아도 자리와 깊이가 그대로일 때
         R6 소속   : 깊이 1 이상이면 부모 + 그 하위 전체를 박스로
         R7 이동   : 딸린 하위가 통째로 따라온다 (트리에선 저절로 — 들고 있으니까)

       구조: 한 프레임에 딱 세 걸음이다.
         dragPlan(e)   순수 계산 — DOM 을 «읽기만» 하고 무엇도 바꾸지 않는다. 계획 또는 null
         dragPaint(p)  그리기만 — 계획을 화면에 옮긴다. 모델은 안 건드린다
         dragApply(p)  실행만  — 계획대로 모델을 바꾼다. 화면은 render 가 맡는다
       ============================================================ */
    let drag = null;      /* 지금 끄는 것 {kind,key,di,x0,row} — 없으면 끄는 중이 아니다 */
    let dragPlanNow = null; /* 마지막으로 그린 계획 — 놓을 때 이것을 실행한다 */
    let dragArt = [];     /* 지금 그려 둔 것들 (선·박스) — 지울 때 이 목록만 보면 된다 */

    /* 펼친 목록에서 그 번호의 줄들 — 화면 순서 그대로다 */
    function flatOf(sp) { return flatten(sp.defs || (sp.defs = []), null); }
    function markPx() {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--ss-blk-mark");
      return parseFloat(v) || 16;
    }
    function specOf(key) { return specs().find((sp) => String(sp.n) === String(key)); }
    function moveAt(arr, from, to) {
      if (from < 0 || from >= arr.length) return null;
      const x = arr.splice(from, 1)[0];
      arr.splice(from < to ? to - 1 : to, 0, x);
      return x;
    }

    /* ---- 1. 계산 ---- */
    /* 커서에서 가장 가까운 «줄과 줄 사이» (R1) */
    function nearestEdge(e) {
      let best = null, bd = Infinity;
      ctx.listEl.querySelectorAll(".ss-b").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.height) return;
        const a = Math.abs(e.clientY - r.top), z = Math.abs(e.clientY - r.bottom);
        if (a < bd) { bd = a; best = { el: el, after: false }; }
        if (z < bd) { bd = z; best = { el: el, after: true }; }
      });
      return best;
    }
    function planBlock(e) {
      const src = specOf(drag.key);
      if (!src || !src.defs) return null;
      const srcFlat = flatOf(src);
      const me = srcFlat[drag.di];
      if (!me) return null;

      /* 블록이 하나도 없는 번호 안이면 그 번호의 첫 자리 */
      const kids = e.target.closest && e.target.closest(".ss-kids");
      if (kids && !kids.querySelector(".ss-b")) {
        const sp = specOf(edKeyOf(kids));
        if (!sp) return null;
        return { kind: "b", sp: sp, at: 0, ind: 0, parent: -1, pEnd: -1, box: kids, empty: true,
          into: sp.defs || (sp.defs = []), intoAt: 0 };
      }
      const near = nearestEdge(e);
      if (!near) return null;
      const overBlk = near.el;
      const sp = specOf(edKeyOf(overBlk));
      if (!sp) return null;
      const flat = sp === src ? srcFlat : flatOf(sp);
      const di = Number(overBlk.dataset.di);
      const at = near.after ? di + 1 : di;                  /* R1 — 펼친 목록에서의 자리 */

      /* R4·R5 — 끌고 있는 덩어리는 «이미 빠진 셈». 자기 하위 안이면 아예 없던 일 */
      const mine = (n) => sp === src && (n.b === me.b || isUnder(me.b, n.b));
      if (sp === src) {
        const inside = flat.slice(Math.min(at, flat.length)).length >= 0 && flat[at] && isUnder(me.b, flat[at].b);
        if (at > drag.di && flat[at - 1] && (flat[at - 1].b === me.b || isUnder(me.b, flat[at - 1].b))) {
          if (inside || at <= drag.di + countUnder(me.b)) return null;
        }
      }
      /* 넣을 자리 «바로 앞» 줄 (끌고 있는 덩어리는 건너뛴다) */
      let pi = at - 1;
      while (pi >= 0 && mine(flat[pi])) pi--;
      const prev = pi >= 0 ? flat[pi] : null;
      /* R3 — 앞 줄보다 한 단까지. 그리고 «내가 든 하위» 까지 2단 안에 들어와야 한다:
         하위를 들고 깊이 들어가면 그 하위가 3단이 된다 (2026-08-30 전수에서 잡힘) */
      const room = 2 - deepOf(me.b, 0);
      const cap = Math.min(prev ? Math.min(2, prev.depth + 1) : 0, Math.max(0, room));
      const step = markPx();
      const ind = Math.max(0, Math.min(cap, me.depth + Math.round((e.clientX - drag.x0) / step))); /* R2 */

      /* 어느 목록의 몇 번째로 들어가는가 — 트리에서의 «진짜 자리» */
      let into, intoAt, parent = -1, pEnd = -1;
      if (!prev) { into = sp.defs; intoAt = 0; }
      else if (ind > prev.depth) {                          /* 앞 줄의 «첫 하위» 로 */
        into = prev.b.c || (prev.b.c = []); intoAt = 0;
      } else {                                              /* 앞 줄의 조상 중 깊이 ind 인 것의 «다음 형제» */
        const anc = prev.path.slice(0, ind + 1);
        const spot = atPath(sp.defs, anc);
        if (!spot) return null;
        into = spot.owner; intoAt = spot.idx + 1;
      }
      /* R5 — 놓아도 그대로면 그리지 않는다 */
      if (sp === src) {
        const here = atPath(src.defs, me.path);
        if (here && here.owner === into && (here.idx === intoAt || here.idx + 1 === intoAt)) return null;
      }
      if (ind > 0) {                                        /* R6 — 어느 덩어리 안인가 */
        for (let i = at - 1; i >= 0; i--) {
          if (mine(flat[i])) continue;
          if (flat[i].depth === ind - 1) { parent = i; pEnd = i + 1 + countUnder(flat[i].b); break; }
        }
      }
      return { kind: "b", sp: sp, at: at, ind: ind, parent: parent, pEnd: pEnd,
        box: overBlk.parentNode, into: into, intoAt: intoAt };
    }
    /* a 가 b 를 (몇 대째든) 담고 있는가 — 자기 하위 안으로 못 들어가게 막는 데 쓴다 */
    function isUnder(a, b) {
      return (a.c || []).some((k) => k === b || isUnder(k, b));
    }
    function countUnder(b) {
      let n = 0;
      (b.c || []).forEach((k) => { n += 1 + countUnder(k); });
      return n;
    }
    function planRow(e) {
      const row = e.target.closest && e.target.closest(".ss-row");
      if (!row) return null;
      const key = edKeyOf(row);
      if (!key || String(key) === String(drag.key)) return null; /* 제자리 */
      const r = row.getBoundingClientRect();
      return { kind: "item", row: row, after: e.clientY > r.top + r.height / 2 };
    }
    function dragPlan(e) {
      if (!drag) return null;
      return drag.kind === "item" ? planRow(e) : planBlock(e);
    }

    /* ---- 2. 그리기 ---- */
    /* 선은 목록 «위에 떠서» 그린다 — 흐름에 넣으면 글이 밀리고, 밀리면 표시가 떤다 (철학 1) */
    /* 목록 위에 떠 있는 판 하나를 놓는다 — 선도 박스도 같은 길을 쓴다 (철학 1: 자리를 안 차지한다) */
    /* 판 하나를 «호스트» 안에 띄운다.
         선   → 목록(listEl) 맨 뒤 = 무엇보다 위. 번호 사이도 가로질러야 하므로 목록이 기준이다
         박스 → 그 번호 안(.ss-kids) 맨 앞 = 글 뒤·번호 카드 배경 앞.
                목록에 두면 번호 카드의 배경에 가려진다 (2026-08-30 실측) */
    function paintPad(cls, host, top, left, w, hgt, behind) {
      const hr = host.getBoundingClientRect();
      const el = h("div", { class: cls + " ss-ui" });
      el.style.top = (top - hr.top + host.scrollTop) + "px";
      el.style.left = (left - hr.left + host.scrollLeft) + "px";
      el.style.width = Math.max(0, w) + "px";
      if (hgt != null) el.style.height = Math.max(0, hgt) + "px";
      if (behind) host.insertBefore(el, host.firstChild); else host.appendChild(el);
      dragArt.push(el);
      return el;
    }
    function paintLine(y, left, width, ind) {
      const el = paintPad("ss-drop-line", ctx.listEl, y - 1, left, width, null, false);
      el.dataset.ind = String(ind); /* 몇 단인지 — 검사가 픽셀로 되짚지 않게 */
      return el;
    }
    function dragWipe() {
      dragArt.forEach((el) => el.remove());
      dragArt = [];
      dragPlanNow = null;
    }
    function dragPaint(plan) {
      dragWipe();
      if (!plan) return;
      if (plan.kind === "item") {
        const r = plan.row.getBoundingClientRect();
        paintLine(plan.after ? r.bottom : r.top, r.left, r.width, 0);
        dragPlanNow = plan;
        return;
      }
      const bx = plan.box.getBoundingClientRect();
      let y;
      if (plan.empty) y = bx.top;
      else {
        const next = plan.box.querySelector('.ss-b[data-di="' + plan.at + '"]');
        if (next) y = next.getBoundingClientRect().top;
        else {
          const all = plan.box.querySelectorAll(".ss-b");
          const last = all[all.length - 1];
          y = last ? last.getBoundingClientRect().bottom : bx.bottom;
        }
      }
      /* 소속 박스를 «먼저» 깔고 선을 그 위에 올린다 — 부모 한 줄이 아니라 «부모 + 그 하위 전체» (R6).
         블록마다 배경을 칠하면 들여쓰기 때문에 왼쪽 끝이 계단처럼 어긋난다 (2026-08-30 실측:
         789 → 805 → 821). 노션은 하나의 반듯한 사각형이다. 그래서 판 하나로 덮는다 */
      if (plan.parent >= 0) {
        let top = null, bot = null;
        for (let i = plan.parent; i < plan.pEnd; i++) {
          const el = plan.box.querySelector('.ss-b[data-di="' + i + '"]');
          if (!el) continue;
          const q = el.getBoundingClientRect();
          if (top === null || q.top < top) top = q.top;
          if (bot === null || q.bottom > bot) bot = q.bottom;
        }
        if (top !== null) {
          const pad = paintPad("ss-drop-in", plan.box, top, bx.left, bx.width, bot - top, true);
          pad.dataset.parent = String(plan.parent); /* 누구의 하위로 들어가는가 */
          pad.dataset.to = String(plan.pEnd);       /* 어디까지 감쌌는가 */
        }
      }
      const off = plan.ind * markPx();
      paintLine(y, bx.left + off, bx.width - off, plan.ind);
      dragPlanNow = plan;
    }

    /* ---- 3. 실행 ---- */
    function dragApply(plan) {
      if (!plan) return;
      edSnap();
      if (plan.kind === "item") {
        const list = specs();
        const from = list.findIndex((sp) => String(sp.n) === String(drag.key));
        const to = list.findIndex((sp) => String(sp.n) === String(edKeyOf(plan.row)));
        if (from < 0 || to < 0) return;
        moveAt(list, from, to + (plan.after ? 1 : 0));
        edRenumber();
      } else {
        /* R0 — 하는 일은 이것뿐이다: «담긴 목록에서 빼서, 갈 목록에 넣는다».
           하위는 그 블록이 들고 있으므로 저절로 따라오고(R7), 남의 목록은 손대지 않는다 */
        const src = specOf(drag.key);
        if (!src || !src.defs) return;
        const me = flatOf(src)[drag.di];
        if (!me) return;
        const from = atPath(src.defs, me.path);
        if (!from) return;
        const b = from.owner[from.idx];
        let at = plan.intoAt;
        if (from.owner === plan.into && from.idx < at) at--; /* 앞에서 빠진 만큼 당긴다 */
        from.owner.splice(from.idx, 1);
        plan.into.splice(Math.max(0, Math.min(plan.into.length, at)), 0, b);
      }
      edTouched();
      render();
    }

    /* ---- 세션 ---- */
    function dragBegin(e) {
      const g = e.target.closest && e.target.closest("[data-g]");
      if (!g) return false;
      if (edEl) edFinish(true);
      drag = { kind: g.dataset.g, key: edKeyOf(g), di: Number(g.dataset.di),
        x0: e.clientX, row: g.closest(".ss-row") };
      /* 무엇이 같이 움직이는지 흐리게 보여 준다 — 규칙이 «규칙» 으로 보이려면 눈에 보여야 한다 */
      if (drag.kind === "item") { if (drag.row) drag.row.classList.add("ss-dragging"); }
      else {
        const sp = specOf(drag.key);
        if (sp && sp.defs) {
          const me = flatOf(sp)[drag.di];
          const n = me ? 1 + countUnder(me.b) : 1; /* 자기 + 딸린 하위 전부 */
          for (let i = 0; i < n; i++) {
            const el = drag.row && drag.row.querySelector('.ss-b[data-di="' + (drag.di + i) + '"]');
            if (el) el.classList.add("ss-dragging");
          }
        }
      }
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", drag.kind); /* 일부 브라우저는 이게 있어야 끌린다 */
      } catch (x) { /* 막힌 환경 */ }
      return true;
    }
    function dragEnd() {
      dragWipe();
      ctx.listEl.querySelectorAll(".ss-dragging").forEach((n) => n.classList.remove("ss-dragging"));
      drag = null;
    }

    /* 커서가 목록 «안» 에 있는가 — 판정은 이벤트가 아니라 «좌표» 로 한다.
       dragleave 로 판정하면 블록과 블록 사이를 지날 때도 떠나는 것으로 잡혀(relatedTarget 이
       비어 오는 경우가 있다) 그림이 지워졌다 다시 그려진다 — 그게 «없음» 이 깜빡이던 정체다.
       좌표는 그런 사정이 없다: 안이면 안이고 밖이면 밖이다 (2026-08-30) */
    function inList(e) {
      const r = ctx.listEl.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    function edDnDMount() {
      /* 철학 3 — 끄는 동안에는 «문서 어디서든» 받는다. 한 곳이라도 안 받으면 그 위에서 🚫 가 뜬다 */
      const allow = (e) => {
        if (!drag) return false;
        e.preventDefault();
        try { if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; } catch (x) { /* 막힌 환경 */ }
        return true;
      };
      /* 한 프레임에 한 번, 한 곳에서 정한다: 받고 → 안이면 그리고 → 밖이면 지운다.
         목록에도 따로 dragover 를 달지 않는다 — 두 곳에서 그리면 순서에 따라 결과가 갈린다 */
      const over = (e) => { if (allow(e)) dragPaint(inList(e) ? dragPlan(e) : null); };
      /* dragenter 도 반드시 취소해야 한다 (2026-08-30 실측: 31프레임 전부 안 되고 있었다).
         HTML5 끌어놓기는 «그 요소가 받을 수 있는가» 를 dragenter 에서 정한다. 안 취소하면
         새 요소에 들어가는 «그 한 프레임» 동안 🚫 가 떴다가 다음 dragover 에서 사라진다 —
         블록과 블록 사이를 지날 때마다 깜빡이던 것이 이것이다. dragover 만 막아서는 못 없앤다 */
      const docs = [document];
      const ad = appDoc();
      if (ad && ad !== document) docs.push(ad);
      docs.forEach((d) => {
        d.addEventListener("dragenter", allow, true);
        d.addEventListener("drop", allow, true);
        /* 그리기는 우리 문서에서만 — 액자 안에는 목록이 없다 */
        d.addEventListener("dragover", d === document ? over : allow, true);
      });

      ctx.listEl.addEventListener("dragstart", (e) => { if (!edGate()) { e.preventDefault(); return; } dragBegin(e); });
      ctx.listEl.addEventListener("drop", (e) => {
        if (!drag) return;
        e.preventDefault();
        const plan = dragPlanNow;
        dragWipe();
        dragApply(plan);
        dragEnd();
      });
      ctx.listEl.addEventListener("dragend", dragEnd);
    }

    /* ---- 구조 바꾸기 — 줄·이유·순서·삭제 ---- */
    function edRenumber() { specs().forEach((s, i) => (s.n = i + 1)); } /* 옮기거나 지운 뒤 번호가 비면 읽는 사람이 «빠졌나» 를 의심한다 */
    function edCmd(btn) {
      if (!edGate()) return;
      const key = edKeyOf(btn), c = btn.dataset.ec, di = Number(btn.dataset.di), si = Number(btn.dataset.si);
      if (edEl) edFinish(true); /* 고치던 글자를 먼저 확정 — 재렌더에 날아가지 않게 */
      edSnap();
      const it = itemOf(key);
      if (!it) return;
      const s = it.spec;
      const list = specs();
      /* addline·addsub·addwhy 는 #45 에서 버튼과 함께 제거 — 넣기는 Enter·Tab·슬래시가 한다 */
      if (c === "delline") { if (s.defs) s.defs.splice(di, 1); }
      else if (c === "delsub") {
        const d = s.defs && s.defs[di];
        if (d && d.subs) { d.subs.splice(si, 1); if (!d.subs.length) delete d.subs; }
      } else if (c === "delsub3") {
        const x = s.defs && s.defs[di] && s.defs[di].subs && s.defs[di].subs[si];
        if (x && typeof x !== "string" && x.subs) { x.subs.splice(Number(btn.dataset.ti), 1); if (!x.subs.length) delete x.subs; }
      } else if (c === "up" || c === "down") {
        const i = list.indexOf(s), j = i + (c === "up" ? -1 : 1);
        if (i < 0 || j < 0 || j >= list.length) return;
        list.splice(j, 0, list.splice(i, 1)[0]);
        edRenumber();
      } else if (c === "delitem") {
        if (!confirm("항목 " + it.label + " 「" + (s.title || "") + "」 을 통째로 지웁니다. 계속할까요?")) return;
        const i = list.indexOf(s);
        if (i < 0) return;
        list.splice(i, 1);
        edRenumber();
      } else return;
      edTouched();
      render();
    }

    /* ---- 저장 — 세 경로를 겹친다. 어느 하나가 막혀도 고친 것을 잃지 않게 ---- */
    /* 빈 줄 청소 — 만들다 만 줄은 저장에 실려 나가지 않는다.
       고치는 «도중» 에 지우지 않는 이유: 그때 지우면 화면이 다시 그려지며 사용자의 다음 클릭을 삼킨다.
       화면에서는 「빈 줄 — 눌러서 쓰기」로 보이다가, 저장할 때 조용히 사라진다 */
    function edCut(arr, keep) { for (let i = arr.length - 1; i >= 0; i--) if (!keep(arr[i])) arr.splice(i, 1); }
    function edPrune() {
      let before = JSON.stringify(RAW);
      const one = (sp) => {
        (sp.defs || []).forEach((d) => {
          if (d.why != null && !String(d.why).trim()) delete d.why;
          if (d.subs) {
            d.subs.forEach((x) => {
              if (x && typeof x !== "string" && x.subs) {
                edCut(x.subs, (y) => String(y).trim());
                if (!x.subs.length) delete x.subs;
              }
            });
            edCut(d.subs, (x) => subT(x).trim() || (x && x.subs && x.subs.length));
            if (!d.subs.length) delete d.subs;
          }
        });
        if (sp.defs) {
          edCut(sp.defs, (d) => String(d.t || "").trim() || (d.subs && d.subs.length));
          if (!sp.defs.length) delete sp.defs;
        }
      };
      SCREENS.forEach((sc) => {
        (sc.specs || []).forEach(one);
        if (sc.dev) one({ defs: sc.dev });
      });
      if (JSON.stringify(RAW) !== before) render();
    }
    function edBlockText() { edPrune(); return serializeConfig(RAW); }
    /* 편집 중인 글자를 먼저 확정하고 나서 저장한다 — 안 그러면 방금 친 줄이 빠진다 */
    function edFlush() { if (edEl) edFinish(true); }
    /* 자동저장은 «치는 중» 에도 돌아야 하는데, 편집을 끝내면 커서가 튄다.
       그래서 값만 조용히 모델로 옮긴다 — 화면도 커서도 건드리지 않는다 */
    function edPickUp() {
      const el = edEl;
      if (!el || !el.isConnected) return;
      const next = richIn(el);
      if (next === edWas) return;
      const it = itemOf(edKeyOf(el));
      if (!it) return;
      const f = el.dataset.ed, di = Number(el.dataset.di), sp = it.spec;
      edSnapOnce();
      if (f === "title") sp.title = next;
      else if (f === "b") {
        const spot = spotOf(el, sp);
        if (!spot || !spot.owner[spot.idx]) return;
        spot.owner[spot.idx].t = next; /* 빈 칸도 그대로 — 빈 줄 «정리» 는 편집이 끝날 때 한다 */
      } else return;
      edWas = next; /* 나중에 edFinish 가 «안 바뀌었다» 로 읽게 */
      edTouched();  /* 초안·자동저장이 같은 길을 탄다 */
    }
    async function edSourceHTML() {
      /* 원본 HTML 이 필요하다. 지금 DOM 은 라이브러리가 이미 손댄 뒤라 그대로 쓰면 안 된다.
         ① 주소에서 다시 받아 보고 ② 막히면(file:// 등) 부팅 직전에 떠 둔 사본을 쓴다 */
      try {
        const res = await fetch(location.href, { cache: "no-store" });
        if (res.ok) {
          const txt = await res.text();
          if (findConfigBlock(txt)) return txt;
        }
      } catch (e) { /* file:// 은 fetch 가 막힌다 — 사본으로 간다 */ }
      return SRC_SNAPSHOT;
    }
    async function edBuildHTML() {
      const src = await edSourceHTML();
      if (!src) return null;
      return replaceConfigBlock(src, edBlockText());
    }
    /* 고른 파일이 «이 문서» 가 맞는가 (#70, PM 2026-08-31: 「이상한 거 하면 어떻게 돼? 그 파일 덮어쓰나?」)
       설정이 없는 파일은 원래 안 쓴다(쓸 자리를 못 찾으므로). 위험한 것은 «설정이 있는 다른 프로토타입» 이다 —
       그대로 쓰면 남의 정의서가 통째로 갈리고 되돌릴 길이 없다. 화면 ID 가 하나라도 겹쳐야 우리 파일로 본다.
       견줄 ID 가 아예 없는 설정이면 통과시킨다 — 근거 없이 막으면 멀쩡한 저장을 막는다.
       문제가 있으면 «사람에게 할 말» 을 돌려준다 (없으면 null) */
    /* 설정 블록과 나머지를 가른다 — 사람은 설정 블록을, 에이전트는 주로 나머지를 고친다.
       영역이 다르면 «합치는» 것이 기본이지 양자택일이 기본일 이유가 없다 (#83) */
    function edSplit(text) {
      const at = findConfigBlock(text || "");
      if (!at) return { cfg: null, rest: text || "" };
      return { cfg: text.slice(at.start, at.end), rest: text.slice(0, at.start) + "\u0000" + text.slice(at.end) };
    }
    async function edMatches(hd) {
      let text = "";
      try { text = await (await hd.getFile()).text(); }
      catch (e) { return "그 파일을 읽지 못했습니다: " + ((e && e.message) || e); }
      const at = findConfigBlock(text);
      if (!at) return "그 파일에는 window.SCREENSPEC 설정이 없습니다. 지금 보고 있는 프로토타입 HTML 을 골라 주세요.";
      const ids = (text.slice(at.start, at.end).match(/id\s*:\s*["'][^"']+["']/g) || [])
        .map((x) => x.replace(/^[^"']*["']([^"']+)["']$/, "$1"));
      const mine = SCREENS.map((sc) => sc.id).filter(Boolean);
      if (!ids.length || !mine.length) return null;
      if (ids.some((x) => mine.indexOf(x) >= 0)) return null;
      const few = (a) => a.slice(0, 3).join(" · ") + (a.length > 3 ? " 외 " + (a.length - 3) : "");
      return "그 파일은 이 화면정의서의 파일이 아닙니다. 덮어쓰지 않았습니다 · 그 파일의 화면: " +
        few(ids) + " · 지금 문서: " + few(mine);
    }
    /* 실제로 쓰는 곳 — 문제가 있으면 «사람에게 할 말» 을 돌려준다 (없으면 null) */
    async function edWriteFile() {
      try {
        const html = await edHandle.getFile().then((file) => file.text());
        const out = replaceConfigBlock(html, edBlockText());
        if (out == null) return "그 파일에서 window.SCREENSPEC 설정 블록을 찾지 못했습니다.";
        const w = await edHandle.createWritable();
        await w.write(out);
        await w.close();
        edBase = out; /* 방금 쓴 것이 다음 판정의 기준이다 (#83) */
        /* 우리가 쓴 것을 «밖에서 바뀐 것» 으로 오해하지 않게 기준 시각을 갱신한다 */
        try { edMtime = (await edHandle.getFile()).lastModified; } catch (e) { edMtime = Date.now(); }
        return null;
      } catch (e) {
        return "저장하지 못했습니다: " + ((e && e.message) || e);
      }
    }
    async function edSaveFile() {
      edFlush();
      try {
        if (!edHandle) {
          /* 고르기 창이 «엉뚱한 폴더» 에서 열리던 것 (#78, PM 2026-08-31: 「그냥 제일 최근에 했던 위치가 뜬다」).
             id 를 주면 브라우저가 «우리가 마지막에 고른 곳» 을 따로 기억하고,
             startIn 에 기억해 둔 손잡이를 주면 두 번째부터는 그 파일이 있는 폴더에서 열린다.
             둘 다 모르는 브라우저가 있을 수 있으므로 실패하면 기본 옵션으로 한 번 더 부른다 */
          const types = [{ description: "프로토타입 HTML", accept: { "text/html": [".html", ".htm"] } }];
          let picked;
          try { picked = await window.showOpenFilePicker({ types, id: "screenspec", startIn: edKnown || "documents" }); }
          catch (e2) {
            if (e2 && e2.name === "AbortError") return;
            picked = await window.showOpenFilePicker({ types });
          }
          edHandle = picked[0];
        }
        let perm = await edHandle.queryPermission({ mode: "readwrite" });
        if (perm !== "granted") perm = await edHandle.requestPermission({ mode: "readwrite" });
        if (perm !== "granted") { edHandle = null; edSync(); edSay("파일에 쓸 권한을 받지 못했습니다. 「내려받기」로 저장하세요."); return; }
        const wrong = await edMatches(edHandle); /* 남의 프로토타입을 덮어쓰기 전에 막는다 (#70) */
        if (wrong) { edHandle = null; edSync(); edSay(wrong); return; }
      } catch (e) {
        if (e && e.name === "AbortError") return; /* 사용자가 취소 — 알릴 것 없다 */
        edSay("파일을 고르지 못했습니다: " + ((e && e.message) || e));
        return;
      }
      edSaving = true; edSync();
      const bad = await edWriteFile();
      edSaving = false;
      if (bad) { edHandle = null; edSay(bad + " 지금 보고 있는 프로토타입 HTML 을 골라 주세요."); edSync(); return; }
      edSavedNow();
      edWatch();
      edKnown = edHandle;
      hdPut(edHandle);   /* 다음에 이 문서를 열면 되꺼낸다 (#68) */
      edLinkShow(false);
      edSync();
      edSay("「" + edHandle.name + "」 에 저장합니다. 이제 고칠 때마다 알아서 저장됩니다.");
    }
    async function edSaveDownload() {
      edFlush();
      const out = await edBuildHTML();
      if (out == null) { edSay("이 페이지에서 window.SCREENSPEC 설정 블록을 찾지 못해 파일을 만들 수 없습니다."); return; }
      const base = (location.pathname.split("/").pop() || "screenspec").replace(/\.html?$/i, "");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([out], { type: "text/html" }));
      a.download = base + ".edited.html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      edSavedNow();
      edSay("「" + a.download + "」 을 내려받았습니다. 원본을 이 파일로 바꾸면 됩니다.");
    }
    async function edCopyBlock() {
      edFlush();
      const txt = edBlockText();
      try { await navigator.clipboard.writeText(txt); edSay("기능 설명을 복사했습니다. 원본 파일의 window.SCREENSPEC 블록에 붙여넣거나, AI 에게 「이걸로 바꿔줘」 하세요."); }
      catch (e) { edSay("복사가 막혔습니다: 콘솔에 출력했습니다."); console.log(txt); }
    }

    /* ---- 저장 안 된 초안 ---- */
    function edDraftRead() {
      const raw = edStore(() => localStorage.getItem(DRAFT_KEY));
      if (!raw) return null;
      try {
        const d = JSON.parse(raw);
        if (!d || !d.cfg) return null;
        if (JSON.stringify(d.cfg) === JSON.stringify(RAW)) return null; /* 파일이 이미 그 내용이면 알릴 것 없다 */
        return d;
      } catch (e) { return null; }
    }
    function edDraftOffer() {
      const d = edDraftRead();
      if (!d || !edDraftBar) return;
      edDraftBar.querySelector(".ss-draft-when").textContent = new Date(d.at).toLocaleString();
      edDraftBar.classList.add("ss-show");
      edDraftBar.querySelector('[data-dc="take"]').onclick = () => {
        adoptInto(RAW, d.cfg);
        edDraftBar.classList.remove("ss-show");
        edDirty = true;
        edSync();
        setEdit(true);
        render();
        /* 되살리기만 하면 여전히 파일에는 없다 (#72) — 로컬 파일이면 그 자리에서 잇게 한다 */
        if (!edGate()) return;
        edAutoPlan();
        edSay("저장 안 된 초안을 되살렸습니다. 저장을 눌러 파일에 반영하세요.");
      };
      edDraftBar.querySelector('[data-dc="drop"]').onclick = () => {
        edStore(() => localStorage.removeItem(DRAFT_KEY));
        edDraftBar.classList.remove("ss-show");
      };
    }

    /* ---- 켜고 끄기 ---- */
    /* 공개 API 는 남긴다(옛 문서·스크립트 호환) — 이제 모드가 없으므로 하는 일이 없다 */
    function setEdit() { return EDIT; }

    /* ---- 패널에 편집 UI 를 심는다 — 새 고정 요소를 만들지 않는다 ---- */
    function edMount() {
      if (READONLY || !ctx.cntEl || !ctx.cntEl.parentNode) return;
      const head = ctx.cntEl.parentNode;
      /* 「편집」 토글도 미저장 점도 없앴다 (#58·PM 2026-08-29) — «안 저장됨» 은 아래 줄에 글자로 뜬다.
         이 자리는 화면 전체에 대한 동작이 오는 자리라 «전부 삭제» 를 둔다 */
      edBtn2 = h("button", { class: "ss-headbtn ss-wipeall ss-ui", type: "button",
        title: "이 화면의 기능 설명을 전부 지웁니다" }, "전부 삭제");
      edBtn2.onclick = edWipeAll;
      (headTools() || head).appendChild(edBtn2);

      /* 밖에서 바뀐 파일 알림 — 프로토타입 위에 뜨는 팝업이 아니라 패널 안쪽 띠다.
         「프로토타입의 동작을 방해하지 않는다」가 이 제품의 전제라 새 고정 요소를 만들지 않는다 */
      edBar2 = h("div", { class: "ss-draft ss-outside ss-ui" },
        '<b class="ss-out-what">프로토타입이 밖에서 바뀌었습니다</b><span class="ss-out-why"></span> ' +
        '(<span class="ss-out-when"></span>) ' +
        '<button type="button" data-oc="reload">새로 읽기</button>' +
        '<button type="button" data-oc="keep" hidden>내 것으로</button>' +
        '<span class="ss-out-stuck"></span>');
      edBar2.addEventListener("click", (e) => {
        const b2 = e.target.closest("[data-oc]");
        if (!b2) return;
        if (b2.dataset.oc === "reload") { location.reload(); return; }
        edBar2.classList.remove("ss-show");
        edOutside = false;
        /* 기준을 지금으로 — 다음 저장이 내 것으로 덮는다 */
        edHandle.getFile().then((f) => { edMtime = f.lastModified; }).catch(() => { edMtime = Date.now(); });
        edSync();
        edAutoPlan();
        edSay("내 것을 유지합니다. 다음 저장이 파일의 설정 블록을 덮어씁니다.");
      });
      /* 파일 연결 관문 (#78) — 패널 안쪽 레이어. 무엇을 고르라는 건지 이름과 폴더를 미리 박아 준다 */
      edLinkBar = h("div", { class: "ss-lay ss-ui" },
        '<div class="ss-lay-card">' +
        '<h3>이 문서를 파일에 연결하세요</h3>' +
        '<p>고친 내용을 파일에 남기려면 이 HTML 파일을 한 번 골라야 합니다. 한 번만 하면 다음부터는 저절로 이어집니다.</p>' +
        '<div class="ss-lay-where">고를 파일<b class="ss-lay-name"></b><span class="ss-lay-dir"></span></div>' +
        '<button type="button" class="ss-lay-go" data-lc="pick"></button>' +
        '<button type="button" class="ss-lay-later" data-lc="later">나중에 하기 (읽기만)</button>' +
        '<div class="ss-lay-msg"></div>' +
        '</div>');
      edLinkBar.addEventListener("click", async (e) => {
        const b3 = e.target.closest("[data-lc]");
        if (!b3) { if (!e.target.closest(".ss-lay-card")) edLinkShow(false); return; } /* 바깥을 누르면 나중에 하기 */
        if (b3.dataset.lc === "later") { edLinkShow(false); return; }
        if (edKnown) { /* 기억해 둔 파일이 있으면 «이어서» 가 먼저다 — 고르기 창을 또 열 이유가 없다 */
          let perm = "denied";
          try { perm = await edKnown.requestPermission({ mode: "readwrite" }); } catch (err) { perm = "denied"; }
          if (perm === "granted") { edAdopt(edKnown); return; }
          edLinkSay("권한을 받지 못했습니다. 아래에서 파일을 다시 골라 주세요.");
          edKnown = null;
          edLinkShow(true);
          return;
        }
        edSaveFile();
      });
      edDraftBar = h("div", { class: "ss-draft ss-ui" },
        '저장 안 된 초안이 있습니다 (<span class="ss-draft-when"></span>) ' +
        '<button type="button" data-dc="take">이어서</button><button type="button" data-dc="drop">버리기</button>');
      /* 이 자리는 «쓰는 자리» 다 — 서식이 온다. 저장은 위 툴바로 옮겼다 (#58, PM 지적) */
      edBar = h("div", { class: "ss-edbar ss-ui" },
        '<button type="button" data-fm="bold" title="굵게 (Ctrl+B)"><b>B</b></button>' +
        '<span class="ss-edwhen"></span><span class="ss-edmsg"></span>');
      /* 초안 띠가 먼저다 — 둘 다 .ss-draft 모양을 쓰므로 순서가 바뀌면 «첫 .ss-draft» 가 달라진다 */
      head.parentNode.insertBefore(edDraftBar, head.nextSibling);
      head.parentNode.appendChild(edLinkBar); /* 레이어는 패널 전체를 덮는다 (#78) */
      head.parentNode.insertBefore(edBar2, edDraftBar.nextSibling);
      head.parentNode.insertBefore(edBar, edDraftBar.nextSibling);
      edWhen = edBar.querySelector(".ss-edwhen");
      edMsg = edBar.querySelector(".ss-edmsg");
      edRelink(); /* 전에 고른 파일이 있으면 되잇는다 (#68) */
      /* 조용히 반영하고 새로 읽은 판이면 «그랬다» 고 한 줄 남긴다 — 말없이 바뀌면 사람이 놀란다 (#83) */
      try {
        if (sessionStorage.getItem(OUT_KEY)) {
          sessionStorage.removeItem(OUT_KEY);
          setTimeout(() => sayToast("밖의 변경을 반영했습니다"), 400);
        }
      } catch (e) { /* 저장소가 막힌 브라우저 */ }
      edBar.addEventListener("mousedown", (e) => {
        const f = e.target.closest("[data-fm]");
        if (!f) return;
        e.preventDefault(); /* 고른 글자를 놓치지 않는다 */
        if (f.dataset.fm === "bold") document.execCommand("bold");
      });
      edBar.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sv]");
        if (!b) return;
        if (b.dataset.sv === "file") edSaveFile();
        else if (b.dataset.sv === "down") edSaveDownload();
        else edCopyBlock();
      });

      /* 거터의 ＋ (#52) — click 까지 기다리면 그 사이 다른 핸들러가 화면을 다시 그려
         버튼이 문서에서 떨어져 나간다. 슬래시 메뉴와 같은 이유로 mousedown 에서 잡는다 */
      ctx.listEl.addEventListener("mousedown", (e) => {
        if (!EDIT) return;
        const add = e.target.closest("[data-add]");
        if (!add) return;
        e.preventDefault(); e.stopPropagation();
        if (!edGate()) return; /* 파일에 연결되기 전에는 줄도 안 는다 (#72) */
        edSlashClose();
        const blk = add.closest(".ss-b"), row = add.closest(".ss-row");
        const target = blk ? blk.querySelector("[data-ed]")
          : (row ? row.querySelector(".ss-kids [data-ed]") || row.querySelector(".ss-t") : null);
        if (!target) return;
        edBegin(target);
        edNewLine();
        setTimeout(edSlash, 0); /* 새 줄이 그려진 뒤에 연다 */
      }, true);

      /* 패널 안의 편집 상호작용 — 기존 클릭 위임(행 활성화·▶·스위치)보다 «먼저» 잡는다 */
      ctx.listEl.addEventListener("click", (e) => {
        if (!EDIT) return;
        if (e.target.closest("[data-add]")) return; /* ＋ 는 mousedown 에서 처리한다 (아래) */
        edSlashClose();
        if (e.target.closest('[data-ftue="pick"]')) { e.stopPropagation(); pickStart(); return; }
        const cmd = e.target.closest("[data-ec]");
        if (cmd && cmd.tagName !== "SELECT") { e.preventDefault(); e.stopPropagation(); edCmd(cmd); return; }
        if (cmd) return; /* 드롭다운은 change 에서 받는다 */
        const t = e.target.closest("[data-ed]");
        if (t) {
          e.stopPropagation();
          /* 편집 «모드» 가 없어진 뒤로는(#58) 글자를 누르는 것이 곧 그 항목을 고르는 것이기도 하다.
             커서만 놓고 화면 강조를 안 하면, 편집이 켜졌다는 이유로 «누르면 화면이 반응한다» 를 잃는다 */
          const key = edKeyOf(t);
          if (key) activate(key, "panel");
          edBegin(t);
          return;
        }
      }, true);
      /* 어디를 누르든 쓰던 글은 반영된다 (PM 2026-08-29 발견).
         전에는 이 판정이 패널 목록 «안» 에서만 돌아서, 패널 머리·툴바·프로토타입을 누르면
         쓴 글이 저장되지 않은 채 다음 렌더에 사라졌다.
         편집을 «돕는» 것들(슬래시 메뉴·서식 줄·손잡이)은 예외다 — 그쪽이 알아서 확정한다 */
      document.addEventListener("mousedown", (e) => {
        if (!edEl || !EDIT) return;
        const t = e.target;
        if (edEl.contains(t)) return;
        if (t.closest && t.closest(".ss-slash,.ss-edbar,.ss-gut")) return;
        edFinish(true);
      }, true);
      /* 치는 동안에도 값을 모델에 옮기고 자동저장을 예약한다 (PM 2026-08-29).
         Enter 나 바깥 클릭을 기다리면 「실시간 저장」 이 아니다 */
      ctx.listEl.addEventListener("input", () => {
        if (!edEl) return;
        edPickUp();
        edSync();
        edAutoPlan();
      });
      /* 탭을 덮거나 닫을 때 — 파일에 쓰는 건 못 기다리지만, 초안은 남길 수 있다 */
      const edPark = () => {
        if (!edEl) return;
        edPickUp();
        if (edDirty) edStore(() => localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), cfg: RAW })));
      };
      addEventListener("pagehide", edPark);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) edPark();
        else edPeekFile(); /* 에이전트 쪽에 갔다가 돌아온 «그 순간» 이 가장 중요한 확인 시점이다 */
      });
      addEventListener("focus", () => edPeekFile());
      /* 글 쓰듯 고치는 키 (0-6) — Enter 가 «반영» 이 아니라 «새 줄» 이다.
         반영은 치는 즉시 일어나고, 파일로 남기는 것은 위의 「저장」 이다 (PM 결정 2026-08-28) */
      ctx.listEl.addEventListener("keydown", (e) => {
        if (!edEl) return;
        /* 슬래시 메뉴가 떠 있으면 그쪽이 먼저 키를 가져간다 (↑↓ 고르기·Enter 넣기·Esc 닫기) */
        if (edMenu && edMenuKey(e)) { e.preventDefault(); e.stopPropagation(); return; }
        const k = e.key, empty = !edEl.textContent.trim();
        const eat = () => { e.preventDefault(); e.stopPropagation(); };
        if (k === "Enter" && !e.shiftKey) { eat(); edNewLine(); }
        else if (k === "Enter") { eat(); edFinish(true); } /* Shift+Enter = 여기서 그만 */
        /* 치는 즉시 반영되는 이상 Esc 로 «없던 일» 을 만들 수 없다 (구글 문서와 같다).
           Esc 는 그 칸에서 빠져나오는 것이고, 되돌리기는 Ctrl+Z 다 (PM 2026-08-29) */
        else if (k === "Escape") { eat(); edSlashClose(); edFinish(true); }
        else if (k === "Tab") { eat(); edIndent(!e.shiftKey); }
        else if (k === "Backspace" && empty) { eat(); edKillLine(); }
        else if (k === "/" && empty) { eat(); edSlash(); }
        /* 노션과 같은 마크다운 단축키 — 빈 줄에서 «-» + 스페이스면 불릿, «>» 면 화살표 (#56) */
        else if (k === " " && edEl.textContent === "-") { eat(); edEl.textContent = ""; edPickUp(); edSetKind(B_BULLET); }
        else if (k === ">" && empty) { eat(); edSetKind(B_WHY); }
        /* 굵게·링크 — 저장에는 <strong>·<a href> 로만 남는다 (#44) */
        else if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "B")) { eat(); document.execCommand("bold"); }
      }, true);
      /* 되돌리기는 문서 전체에서 받는다 — 커서가 어느 줄에 있든 같은 손짓이어야 한다 */
      document.addEventListener("keydown", (e) => {
        if (!EDIT || !(e.ctrlKey || e.metaKey)) return;
        const k = (e.key || "").toLowerCase();
        if (k === "z") { e.preventDefault(); edStep(!e.shiftKey); }
        else if (k === "y") { e.preventDefault(); edStep(false); }
      }, true);

      /* 붙여넣기는 글자만 — 서식이 딸려 오면 저장 텍스트가 더러워진다 */
      ctx.listEl.addEventListener("paste", (e) => {
        if (!edEl) return;
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
        document.execCommand("insertText", false, txt);
      });
      addEventListener("beforeunload", (e) => {
        if (!edDirty) return;
        e.preventDefault();
        e.returnValue = "";
        return "";
      });
      edDnDMount();
      edDraftOffer();
    }

    return { setCurrent, setScreen, ensureRoots, soloRoots, unwiredNow: () => !!current && unwired(current), current: () => current, placeMarkers, clearActive, render, edMount, setEdit, isDirty: () => edDirty, serialize: edBlockText, prMount, lyMount, exportImage };
  }

  /* 설정 없이 스크립트만 붙인 상태 = 가장 흔한 첫 실수.
     이때 남의 페이지를 시트로 감싸면 "망가졌다"로 읽히므로, DOM은 그대로 두고 안내 카드만 띄운다. */
  const DOCS_URL = "https://github.com/charmisuk/screenspec#빠른-시작-2분";
  function setupNotice() {
    console.warn("[ScreenSpec] 설정(window.SCREENSPEC)이 없어 화면정의서를 만들 수 없습니다. 복붙용 최소 예제: " + DOCS_URL);
    const card = h("div", { "data-ss-ignore": "" });
    card.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483060;max-width:330px;" +
      "background:#fff;color:#191919;border:1px solid #D3D1CB;border-radius:12px;padding:14px 34px 14px 16px;" +
      "box-shadow:0 10px 30px rgba(17,24,39,.18);font:13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
    card.innerHTML = '<b style="display:block;font-size:13.5px;margin-bottom:4px">ScreenSpec: 설정이 없습니다</b>' +
      '<span style="color:#50524E">스크립트는 로드됐습니다. 화면 ID와 기능 설명을 담은 ' +
      '<code style="font-size:12px">window.SCREENSPEC</code> 설정을 추가하세요.</span>' +
      '<a href="' + DOCS_URL + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;margin-top:9px;color:#191919;font-weight:700;text-decoration:underline">복붙용 최소 예제 열기 →</a>' +
      '<button aria-label="닫기" style="position:absolute;top:6px;right:6px;border:0;background:none;' +
      'color:#9B9A97;font-size:14px;cursor:pointer;line-height:1;padding:6px">✕</button>';
    card.querySelector("button").onclick = () => card.remove();
    document.body.appendChild(card);
  }

  function boot() {
    /* 우리가 만든 액자(iframe) 안에서 로드된 인스턴스 = 앱 쪽 사본. UI 를 만들지 않고 끝낸다
       (바깥 인스턴스가 이 문서를 직접 조종한다 — 재귀·이중 UI 방지). cross-origin 접근은 던지므로 무시 */
    try {
      if (window.frameElement && window.frameElement.dataset && window.frameElement.dataset.ssFrame) return;
    } catch (e) { /* cross-origin: 우리 액자가 아니다 */ }
    /* off — 원본 프로토타입 그대로. CSS·UI·DOM 어디에도 손대지 않고 끝낸다.
       프로토타입이 setScreen()·refresh() 를 부르고 있을 수 있으므로 빈 껍데기만 남긴다(안 그러면 프로토타입이 깨진다). */
    if (SWITCH === "off") {
      const noop = function () {};
      window.ScreenSpec = { setScreen: noop, refresh: noop, current: () => null, mode: "off", off: true, exportImage: noop, edit: noop, serialize: () => "", dirty: () => false };
      window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */
      console.info("[ScreenSpec] off: 프로토타입 원본 그대로입니다. 화면정의서를 보려면 주소 끝에 ?screenspec=1 (또는 #screenspec)");
      return;
    }
    /* 설정 유무 판정 — screens·screen·specs 중 하나라도 있으면 "설정함"으로 본다 */
    if (!(RAW.screens && RAW.screens.length) && !RAW.screen && !(RAW.specs && RAW.specs.length)) {
      setupNotice();
      return;
    }
    /* 설정 자가 진단 — ID는 자유 형식(불투명 문자열)이지만, 깨진 참조는 조용히 오동작하므로 경고 */
    const seen = {};
    SCREENS.forEach((s) => {
      if (seen[s.id]) console.warn("[ScreenSpec] 화면 ID 중복: " + s.id + ". 뒤의 화면은 목차·이동에서 무시됩니다");
      seen[s.id] = 1;
    });
    SCREENS.forEach((sc) => (sc.specs || []).forEach((sp) => {
      [sp].forEach((it, i) => {
        if (it.flowTo && !SCREENS.some((x) => x.id === it.flowTo))
          console.warn("[ScreenSpec] " + sc.id + " n=" + sp.n + ": flowTo \"" + it.flowTo + "\" 화면이 screens에 없습니다: 이동 버튼이 동작하지 않습니다");
      });
    }));
    /* 상태 점검이 켜져 있으면 그 사실을 알린다 — 설정을 직접 넣지 않은 사람도 «저 ⚠ 가 뭔지» 를 알 수 있게 */
    if (CHECKLIST) console.info("[ScreenSpec] 상태 점검 켜짐: 화면마다 " + CHECKLIST.join(" · ") + " 를 적었는지 확인합니다. 화면의 covers 에 적거나 skip 에 사유를 적으면 ⚠ 가 사라집니다");
    /* 아직 아무것도 안 건드린 지금이 원본을 뜰 수 있는 마지막 순간이다 (#37) */
    if (!READONLY) SRC_SNAPSHOT = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
    /* 모드 결정: 명시 > 프레임워크 자동 감지 > wrap */
    const isFramework = !!(window.next || document.querySelector("#__next,[data-reactroot],script#__NEXT_DATA__"));
    const mode = RAW.mode || (isFramework ? "overlay" : "wrap");
    normalizeAll(SCREENS); /* 두 모드 공통 — 정의를 «평평한 블록» 으로 편다 (#55). 옛 subs·why 도 여기서 흡수 */
    if (mode === "overlay") bootOverlay();
    else if (mode === "frame") bootWrap({ frame: true }); /* frame 은 자동 판별하지 않는다 — 명시해야만 */
    else bootWrap();
  }

  /* frame 모드: 바깥 창에 남은 앱 DOM 을 숨긴다 — 프레임워크 앱은 옮길 수 없으므로(리액트가 다시 붙인다)
     감싸는 대신 숨기고, 같은 주소를 액자(iframe)로 다시 연다. 우리 UI 는 전부 .ss-ui 지만 방어적으로 전부 적는다 */
  const SS_OWN_SEL = ".ss-ui,.ss-toolbar,.ss-proto-wrap,.ss-docmode,.ss-tip,.ss-toc,.ss-nav-toast";
  function hideAppDom() {
    Array.from(document.body.children).forEach((n) => {
      if (n.tagName === "SCRIPT" || n.tagName === "STYLE") return;
      if (n.matches && n.matches(SS_OWN_SEL)) return;
      n.style.display = "none";
    });
  }

  /* ============================================================
     wrap 모드 — 단일 HTML: 본문을 기기 뷰포트 시트로 감싼다
     frame 모드(opts.frame) — 프레임워크 앱: 감싸는 대신 액자(iframe)를 시트에 넣고 뷰어만 재사용
     ============================================================ */
  function bootWrap(opts) {
    const FRAME = !!(opts && opts.frame);
    document.body.classList.add("ss-wrap");
    if (EDIT) document.body.classList.add("ss-editing"); /* 모드가 아니라 «잠기지 않았다» 는 표시 (#58) */
    injectCSS();

    /* ---- 프로토타입 본문을 시트로 감싸기 (frame 은 액자를 넣는다) ---- */
    const sheet = h("div", { class: "ss-sheet" });
    let appFrame = null;
    if (FRAME) {
      sheet.classList.add("ss-sheet-frame");
      hideAppDom();
      appFrame = h("iframe", { class: "ss-appframe", "data-ss-frame": "1", src: location.href, title: "프로토타입" });
      sheet.appendChild(appFrame); /* 마커·화살표보다 먼저 = 항상 그 아래 */
    } else {
      const keep = [];
      Array.from(document.body.childNodes).forEach((n) => {
        if (n.nodeType === 1 && (n.tagName === "SCRIPT" || n.tagName === "STYLE")) return;
        if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute("data-ss-ignore")) return;
        keep.push(n);
      });
      keep.forEach((n) => sheet.appendChild(n));
    }

    const annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    annoSvg.setAttribute("class", "ss-anno");
    annoSvg.innerHTML =
      `<defs><marker id="ss-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" style="fill:${ACCENT}"></path></marker></defs><line id="ss-line" x1="0" y1="0" x2="0" y2="0" style="stroke:${ACCENT}" stroke-width="2" marker-end="url(#ss-arrowhead)" visibility="hidden"></line>`;
    const markerLayer = h("div", { class: "ss-markers" });
    sheet.appendChild(annoSvg);
    sheet.appendChild(markerLayer);
    /* frame = 시트(기기 뷰포트) + 리사이즈 핸들. 핸들은 overflow 클리핑을 피해 시트 밖에 */
    const frame = h("div", { class: "ss-frame" });
    frame.appendChild(sheet);
    const edgeR = h("div", { class: "ss-edge ss-edge-r", title: "드래그로 폭 조절" });
    const edgeB = h("div", { class: "ss-edge ss-edge-b", title: "드래그로 높이 조절" });
    const edgeC = h("div", { class: "ss-edge ss-edge-c", title: "드래그로 크기 조절" });
    frame.appendChild(edgeR); frame.appendChild(edgeB); frame.appendChild(edgeC);

    /* ---- 툴바 ---- */
    const toolbar = h("header", { class: "ss-toolbar ss-ui" }, `
      <nav class="ss-modes" aria-label="보기 모드">
        <button id="ss-mProto" aria-pressed="true">프로토타입</button>
        <button id="ss-mDoc" aria-pressed="false">화면정의서</button>
      </nav>
      <div class="ss-widthsim">
        <div class="ss-seg" id="ss-seg">
          <button data-w="mobile" aria-pressed="true">모바일</button>
          <button data-w="pc" aria-pressed="false">PC</button>
        </div>
        <span class="ss-wpx" id="ss-wpx"></span>
      </div>`);

    /* ---- 화면정의서 모드 ---- */
    const docmode = h("div", { class: "ss-docmode ss-ui" }, `
      <div class="ss-doc-header" id="ss-dh-wrap"></div>
      <div class="ss-doc-body">
        <div class="ss-stage" id="ss-stage"><div class="ss-fit" id="ss-fit"><div class="ss-holder" id="ss-docHolder"></div></div></div>
        <aside class="ss-defs" aria-label="기능 설명">
          <div class="ss-defs-resize" title="좌우로 끌어 폭 조절"></div>
          <div class="ss-defs-head"><h2>기능 설명</h2><span class="ss-cnt" id="ss-cnt"></span></div>
          <div class="ss-defs-list" id="ss-defsList"></div>
          <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.25</div>
        </aside>
      </div>`);

    const protoWrap = h("div", { class: "ss-proto-wrap ss-ui" }, '<div class="ss-holder" id="ss-protoHolder"></div>');
    const tip = h("div", { class: "ss-tip ss-ui", role: "tooltip" });
    document.body.appendChild(toolbar);
    document.body.appendChild(protoWrap);
    document.body.appendChild(docmode);
    document.body.appendChild(tip);

    const protoHolder = document.getElementById("ss-protoHolder");
    const docHolder = document.getElementById("ss-docHolder");
    const stage = document.getElementById("ss-stage");
    const fit = document.getElementById("ss-fit");
    protoHolder.appendChild(frame);
    document.body.classList.add("ss-mode-proto");

    /* ---- 크기: 프리셋 2(폭×높이) + DevTools식 드래그 3핸들, 프리셋 클릭 = 복귀 ---- */
    let sheetW = DEVICES.mobile.w;
    let sheetH = DEVICES.mobile.h;
    let scale = 1;
    const wpx = document.getElementById("ss-wpx");
    function applySize(w, hgt) {
      /* 터치 기기: 시트가 화면보다 넓으면 핸들이 화면 밖으로 나가 조작 불가 → 뷰포트에 맞게 클램프 */
      const coarse = window.matchMedia && matchMedia("(pointer:coarse)").matches;
      const maxW = coarse ? Math.max(260, innerWidth - 44) : 2200;
      sheetW = Math.max(coarse ? 260 : 320, Math.min(maxW, Math.round(w)));
      sheetH = Math.max(400, Math.min(1600, Math.round(hgt)));
      sheet.style.width = sheetW + "px";
      sheet.style.height = sheetH + "px";
      sheet.classList.toggle("ss-pc", sheetW >= 1100);
      sheet.classList.toggle("ss-narrow", sheetW <= 520);
      wpx.textContent = sheetW + "×" + sheetH;
      requestAnimationFrame(layout);
    }
    const seg = document.getElementById("ss-seg");
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      const d = DEVICES[btn.dataset.w];
      applySize(d.w, d.h);
    });
    let drag = null;
    function makeDrag(el, useW, useH) {
      el.addEventListener("pointerdown", (e) => {
        drag = { x: e.clientX, y: e.clientY, w: sheetW, h: sheetH, s: scale };
        el.classList.add("ss-dragging");
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* 일부 환경(합성 이벤트 등) 방어 */ }
        e.preventDefault();
      });
      el.addEventListener("pointermove", (e) => {
        if (!drag) return;
        applySize(
          useW ? drag.w + ((e.clientX - drag.x) * 2) / drag.s : sheetW, /* 중앙정렬 보정 */
          useH ? drag.h + (e.clientY - drag.y) / drag.s : sheetH
        );
      });
      ["pointerup", "pointercancel"].forEach((ev) =>
        el.addEventListener(ev, () => { drag = null; el.classList.remove("ss-dragging"); }));
    }
    makeDrag(edgeR, true, false);
    makeDrag(edgeB, false, true);
    makeDrag(edgeC, true, true);

    /* ---- 모드 전환 ---- */
    const mProto = document.getElementById("ss-mProto");
    const mDoc = document.getElementById("ss-mDoc");
    function setMode(m) {
      document.body.classList.remove("ss-mode-proto", "ss-mode-doc");
      document.body.classList.add("ss-mode-" + m);
      mProto.setAttribute("aria-pressed", String(m === "proto"));
      mDoc.setAttribute("aria-pressed", String(m === "doc"));
      core.clearActive();
      /* iframe 은 DOM 트리를 옮기면 브라우저가 src 로 다시 로드한다 — 보던 경로를 되돌려 준다 */
      const back = FRAME ? frameHref() : null;
      if (m === "doc") docHolder.appendChild(frame);
      else { protoHolder.appendChild(frame); frame.style.transform = ""; }
      if (back) appFrame.src = back;
      core.soloRoots(m === "doc"); /* 정의서 모드에서는 설명하는 화면만 (#75) */
      requestAnimationFrame(layout);
    }
    mProto.onclick = () => setMode("proto");
    mDoc.onclick = () => setMode("doc");

    /* ---- 축소 배치 ---- */
    function layout() {
      if (document.body.classList.contains("ss-mode-doc")) {
        const avail = stage.clientWidth - 48;
        scale = Math.min(1, avail / sheetW);
        frame.style.transformOrigin = "top left";
        frame.style.transform = "scale(" + scale + ")";
        fit.style.width = sheetW * scale + "px";
        fit.style.height = sheetH * scale + "px";
      } else {
        scale = 1;
        frame.style.transform = "";
        fit.style.width = ""; fit.style.height = "";
      }
      /* 드래그 핸들은 축소 배율과 무관하게 잡히는 폭 유지 (터치 기기는 더 크게·시트에 걸치게) */
      const coarse = window.matchMedia && matchMedia("(pointer:coarse)").matches;
      const hs = coarse ? 28 : 20, ho = coarse ? 10 : 20;
      edgeR.style.width = Math.round(hs / scale) + "px";
      edgeR.style.right = "-" + Math.round(ho / scale) + "px";
      edgeB.style.height = Math.round(hs / scale) + "px";
      edgeB.style.bottom = "-" + Math.round(ho / scale) + "px";
      core.placeMarkers();
    }

    /* ---- 액자(frame) 보조: 좌표 오프셋 · 현재 경로 · 바깥 주소 미러링 ---- */
    /* 액자 뷰포트 원점의 시트 콘텐츠 좌표. (액자와 시트의 거리)는 축소된 화면 픽셀이라 /scale,
       액자 안 rect 는 축소의 영향을 받지 않는 시트 좌표 그대로다 */
    function frameOffset() {
      const ir = appFrame.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      return { x: (ir.left - sr.left) / scale + sheet.scrollLeft, y: (ir.top - sr.top) / scale + sheet.scrollTop };
    }
    function frameHref() {
      try {
        const l = appFrame.contentWindow.location;
        return l.pathname + l.search + l.hash;
      } catch (e) { return null; } /* 로드 전·cross-origin */
    }
    /* 액자 안 경로를 바깥 주소에 미러링 — 새로고침해도 보던 화면으로 돌아온다 */
    function mirrorUrl() {
      const to = frameHref();
      if (!to || to === location.pathname + location.search + location.hash) return;
      try { history.replaceState(history.state, "", to); } catch (e) { /* file:// 등 방어 */ }
    }

    /* ---- 공통 코어 (좌표계 = 시트 내부 스크롤 + 축소 배율) ---- */
    const coreCtx = {
      headerEl: document.getElementById("ss-dh-wrap"),
      cntEl: document.getElementById("ss-cnt"),
      listEl: document.getElementById("ss-defsList"),
      markerLayer: markerLayer,
      tip: tip,
      annoLine: annoSvg.querySelector("#ss-line"),
      posOf: (t) => {
        const sr = sheet.getBoundingClientRect();
        const r = t.getBoundingClientRect();
        return {
          /* 시트 가장자리(여백 0 앱형)에서 마커가 잘리지 않게 최소 위치 클램프 */
          left: Math.max(12, (r.left - sr.left) / scale + sheet.scrollLeft),
          top: Math.max(12, (r.top - sr.top) / scale + sheet.scrollTop),
          transform: "translate(-40%,-40%) scale(" + 1 / scale + ")"
        };
      },
      viewCenter: () => ({ x: sheet.scrollLeft + sheet.clientWidth / 2, y: sheet.scrollTop + sheet.clientHeight / 2 }),
      viewRect: () => ({ x: sheet.scrollLeft, y: sheet.scrollTop, w: sheet.clientWidth, h: sheet.clientHeight }),
      rectOf: (t) => {
        const sr = sheet.getBoundingClientRect();
        const r = t.getBoundingClientRect();
        const ox = sheet.scrollLeft - sr.left / scale, oy = sheet.scrollTop - sr.top / scale;
        return { l: r.left / scale + ox, t: r.top / scale + oy, r: r.right / scale + ox, b: r.bottom / scale + oy };
      },
      ensureDoc: () => { if (document.body.classList.contains("ss-mode-proto")) setMode("doc"); },
      /* 인쇄는 시트를 «옮겨» 간다 — 크기는 축소 전 원본 기준이어야 A4 배율을 다시 잴 수 있다 (#34) */
      /* 캡처 대상 (#40). 액자 모드는 앱이 iframe 안에 있어 옮길 수가 없다 —
         same-origin 이 조건이므로 안쪽 문서를 직접 떠서 마커만 얹는다 */
      capSource: () => {
        if (!FRAME) return { kind: "move", node: frame, give: (n) => { docHolder.appendChild(n); layout(); } };
        let idoc = null;
        try { idoc = appFrame && appFrame.contentDocument; } catch (e) { idoc = null; }
        if (!idoc || !idoc.body) return null; /* cross-origin: 안쪽을 못 읽는다 */
        return { kind: "copy", node: idoc.body, css: cssText(idoc), w: sheetW,
                 h: Math.max(idoc.body.scrollHeight, sheetH), marks: [markerLayer] };
      },
      isDoc: () => document.body.classList.contains("ss-mode-doc"),
      afterRender: () => requestAnimationFrame(layout),
      toggleRoot: true /* wrap은 앱 DOM을 소유한다 — setScreen이 root 표시/숨김도 함께 전환 */
    };
    if (FRAME) {
      /* 액자 모드: 앱은 iframe 안에 산다 — 문서·창을 게터로 넘긴다(내부 내비게이션으로 교체돼도 따라간다).
         좌표는 "액자 안 좌표 + 액자의 시트 내 위치". 액자가 시트를 꽉 채우므로 시트 스크롤은 0이다. */
      Object.defineProperties(coreCtx, {
        doc: { get: () => appFrame.contentDocument || document },
        win: { get: () => appFrame.contentWindow || window }
      });
      coreCtx.toggleRoot = false; /* 앱 DOM 은 앱의 것 — overlay 와 같은 규칙 */
      coreCtx.posOf = (t) => {
        const off = frameOffset(), r = t.getBoundingClientRect();
        return {
          left: Math.max(12, off.x + r.left),
          top: Math.max(12, off.y + r.top),
          transform: "translate(-40%,-40%) scale(" + 1 / scale + ")"
        };
      };
      coreCtx.rectOf = (t) => {
        const off = frameOffset(), r = t.getBoundingClientRect();
        return { l: off.x + r.left, t: off.y + r.top, r: off.x + r.right, b: off.y + r.bottom };
      };
      coreCtx.viewCenter = () => {
        const off = frameOffset(), w = appFrame.contentWindow;
        return {
          x: off.x + (w ? w.innerWidth : appFrame.clientWidth) / 2,
          y: off.y + (w ? w.innerHeight : appFrame.clientHeight) / 2
        };
      };
      coreCtx.viewRect = () => {
        const off = frameOffset(), w = appFrame.contentWindow;
        return { x: off.x, y: off.y, w: w ? w.innerWidth : appFrame.clientWidth, h: w ? w.innerHeight : appFrame.clientHeight };
      };
    }
    const core = createCore(coreCtx);
    /* root 를 안 적은 화면을 정의가 가리키는 요소에서 되찾는다 (#67). 여기서 화면을 숨기지는 않는다 —
       처음 보이는 모습은 프로토타입의 것이고, 우리는 «사람이 화면을 고를 때» 만 전환한다 */
    if (!FRAME) core.ensureRoots();

    /* ---- 다중 화면 자동 감지 (root 표시/숨김 추적) ---- */
    function detectScreen() {
      if (SCREENS.length < 2) return;
      /* 사람이 고른 화면이 «연결 안 된» 화면이면 뒤집지 않는다 (#77) — 감지는 그 화면에 대해
         아는 것이 없다. 뒤집으면 설명 패널까지 이전 화면으로 되돌아가 «아무 일도 안 일어난» 것이 된다 */
      if (core.unwiredNow()) return;
      for (const sc of SCREENS) {
        if (!sc.root && !sc._rootEl) continue;
        const el = sc._rootEl || document.querySelector(sc.root);
        if (el && el.getClientRects().length > 0) {
          core.setCurrent(sc); /* 감지는 관찰 결과 반영일 뿐 — 여기서 다시 표시/숨김을 쓰면 관찰 루프가 된다 */
          return;
        }
      }
    }
    if (!FRAME && SCREENS.length > 1) {
      let detTimer = null;
      new MutationObserver(() => {
        clearTimeout(detTimer);
        detTimer = setTimeout(detectScreen, 80);
      }).observe(sheet, { subtree: true, attributes: true, childList: true, attributeFilter: ["style", "class", "hidden"] });
    }

    /* ---- frame: 액자 안 추적 — 라우팅·스크롤·DOM 변경을 바깥에서 관찰한다 (same-origin) ---- */
    if (FRAME) {
      let placeRaf = null;
      const queueFramePlace = () => {
        if (placeRaf) return;
        placeRaf = requestAnimationFrame(() => { placeRaf = null; core.placeMarkers(); });
      };
      const wireFrame = () => {
        const win = appFrame.contentWindow, doc = appFrame.contentDocument;
        if (!win || !doc) return; /* cross-origin 이면 조종할 수 없다 */
        if (!doc.getElementById("ss-frame-css")) { /* 하이라이트는 대상이 사는 문서에서만 그려진다 */
          const st = doc.createElement("style");
          st.id = "ss-frame-css";
          st.textContent = ":root{--ss-accent:" + ACCENT + "}" + HL_CSS;
          doc.head.appendChild(st);
        }
        const detect = () => { detectScreenIn(core, win, doc); mirrorUrl(); };
        const soon = () => setTimeout(detect, 50); /* 라우터가 DOM 을 바꾼 뒤에 판정 */
        ["pushState", "replaceState"].forEach((fn) => {
          const orig = win.history[fn];
          win.history[fn] = function () {
            const r = orig.apply(this, arguments);
            soon();
            return r;
          };
        });
        win.addEventListener("popstate", soon);
        win.addEventListener("hashchange", soon);
        win.addEventListener("scroll", queueFramePlace, { capture: true, passive: true });
        win.addEventListener("resize", queueFramePlace);
        let moTimer = null;
        new MutationObserver(() => {
          clearTimeout(moTimer);
          moTimer = setTimeout(() => { detect(); core.placeMarkers(); }, 120);
        }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
        detect();
        requestAnimationFrame(layout);
      };
      appFrame.addEventListener("load", wireFrame); /* 모드 전환으로 액자가 다시 로드돼도 매번 재배선 */
    }

    /* ---- 재배치 트리거 ---- */
    window.addEventListener("resize", layout);
    document.querySelectorAll("img").forEach((im) => im.addEventListener("load", layout));
    document.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => requestAnimationFrame(layout)));
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(core.placeMarkers)).observe(sheet);

    /* ---- 공개 API ---- */
    /* ---- 기능 설명 패널 폭 조절 (#53) ----
       왼쪽 가장자리를 잡아 끈다. 고른 폭은 그 사람 브라우저에만 남는다(다음에 열어도 그대로).
       폭이 바뀌면 시트 배율이 달라지므로 마커를 다시 놓는다 — 안 그러면 번호가 어긋난 채 남는다. */
    /* 폭은 «화면의 비율» 이다 (PM 2026-08-29): 기본 절반, 3분의 1 부터 90% 까지.
       px 로 잡으면 27인치에서는 쪽지만 하고 노트북에서는 화면을 삼킨다 — 사람이 보는 건 비율이다.
       저장도 비율로 남긴다: 회사 모니터에서 고른 폭이 집 노트북에서 그대로 «절반» 이어야 한다 */
    const PANEL_MIN_R = 1 / 3, PANEL_MAX_R = 0.9, PANEL_DEF_R = 0.5, PANEL_KEY = "ss-panel-r";
    function panelSpan() { return Math.max(320, window.innerWidth || 1280); }
    function panelRatio() {
      let r = 0;
      try { r = Number(localStorage.getItem(PANEL_KEY)); } catch (e) { r = 0; }
      return r > 0 ? r : PANEL_DEF_R;
    }
    function panelSet(px, save) {
      const span = panelSpan();
      const r = Math.max(PANEL_MIN_R, Math.min(PANEL_MAX_R, px / span));
      const w = Math.round(r * span);
      document.documentElement.style.setProperty("--ss-panel-w", w + "px");
      if (save) { try { localStorage.setItem(PANEL_KEY, r.toFixed(4)); } catch (e) { /* 사생활 보호 모드 */ } }
      return w;
    }
    function panelMount() {
      const grip = document.querySelector(".ss-defs-resize");
      const panel = document.querySelector(".ss-defs");
      if (!grip || !panel) return;
      panelSet(panelRatio() * panelSpan(), false);
      /* 폭이 정해지면 시트 배율이 달라진다 — 첫 배치를 그 폭 기준으로 다시 잡는다 */
      requestAnimationFrame(() => { layout(); core.placeMarkers(); });
      /* 창 크기가 바뀌어도 «절반» 은 절반이어야 한다 */
      addEventListener("resize", () => {
        panelSet(panelRatio() * panelSpan(), false);
        layout();
        core.placeMarkers();
      });

      let from = 0, base = 0;
      const move = (e) => {
        const x = e.touches ? e.touches[0].clientX : e.clientX;
        panelSet(base + (from - x), false);
        layout(); /* 시트 배율이 바뀐다 */
      };
      const up = () => {
        removeEventListener("mousemove", move);
        removeEventListener("mouseup", up);
        removeEventListener("touchmove", move);
        removeEventListener("touchend", up);
        document.body.classList.remove("ss-resizing");
        grip.classList.remove("ss-on");
        panelSet(panel.getBoundingClientRect().width, true);
        layout();
        core.placeMarkers();
      };
      const down = (e) => {
        from = e.touches ? e.touches[0].clientX : e.clientX;
        base = panel.getBoundingClientRect().width;
        document.body.classList.add("ss-resizing");
        grip.classList.add("ss-on");
        addEventListener("mousemove", move);
        addEventListener("mouseup", up);
        addEventListener("touchmove", move, { passive: true });
        addEventListener("touchend", up);
        e.preventDefault();
      };
      grip.addEventListener("mousedown", down);
      grip.addEventListener("touchstart", down, { passive: false });
      /* 키보드로도 — 손잡이에 초점을 두고 좌우 화살표 */
      grip.tabIndex = 0;
      grip.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        panelSet(panel.getBoundingClientRect().width + (e.key === "ArrowLeft" ? 20 : -20), true);
        layout();
        core.placeMarkers();
      });
    }
    panelMount();

    core.prMount(toolbar);
    core.edMount();
    core.lyMount();
    window.ScreenSpec = { setScreen: core.setScreen, refresh: layout, current: () => core.current().id, mode: FRAME ? "frame" : "wrap", exportImage: core.exportImage, edit: core.setEdit, serialize: core.serialize, dirty: core.isDirty };
    window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */

    core.setCurrent(SCREENS[0]);
    /* 시작 폭 = 이 문서가 서술하는 기준 폭. baseViewport: "mobile"(기본) | "pc" — 어드민은 PC, 앱은 모바일 (#17) */
    const base = DEVICES[RAW.baseViewport] ? RAW.baseViewport : "mobile";
    if (RAW.baseViewport && !DEVICES[RAW.baseViewport]) console.warn("[ScreenSpec] baseViewport \"" + RAW.baseViewport + "\" 인식 불가: mobile 사용 (" + Object.keys(DEVICES).join(" | ") + ")");
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === base)));
    applySize(DEVICES[base].w, DEVICES[base].h);
    if (FRAME) hideAppDom(); /* 부팅 중 앱이 body 에 더 붙였을 수 있다 */
    console.info("[ScreenSpec v0.25] " + (FRAME ? "frame" : "wrap") + " 모드 · 화면 " + SCREENS.length + "개 등록");
  }

  /* ============================================================
     overlay 모드 — 프레임워크: DOM 불변, 얹기만 (GA 스니펫 원리)
     ============================================================ */
  function bootOverlay() {
    injectCSS();

    /* ---- UI (전부 body에 append만 — 기존 DOM 불변) ---- */
    const pill = h("div", { class: "ss-ui ss-pill" }, `
      <button id="ss-ovProto" aria-pressed="true">프로토타입</button>
      <button id="ss-ovDoc" aria-pressed="false">화면정의서</button>`);
    const header = h("div", { class: "ss-ui ss-ov-header" });
    /* render()가 headerEl.innerHTML을 통째로 갈아끼우므로, 필드는 안쪽 div에 두고 폭 표시는 형제로 둔다 */
    const hFields = h("div", { class: "ss-ov-hfields" });
    /* 앱 폭 표시 + 반응형 훅 — overlay 에는 폭 시뮬레이터가 없으므로(개발자 도구 기기 툴바 사용) 지금 몇 px 인지만 보여 준다 (#17) */
    const vw = h("span", { class: "ss-ui", id: "ss-ovVw", title: "앱 영역 폭 (설명 패널 제외). 폭을 바꾸려면 브라우저 개발자 도구의 기기 툴바" });
    header.appendChild(hFields);
    header.appendChild(vw);
    function updateWidth() {
      const cs = getComputedStyle(document.body);
      const w = Math.round(innerWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
      vw.textContent = w + "px";
      document.body.classList.toggle("ss-pc", w >= 1100);
      document.body.classList.toggle("ss-narrow", w <= 520);
    }
    window.addEventListener("resize", updateWidth);
    const panel = h("aside", { class: "ss-ui ss-ov-panel", "aria-label": "기능 설명" }, `
      <div class="ss-defs-head"><h2>기능 설명</h2><span class="ss-cnt" id="ss-ovCnt"></span></div>
      <div class="ss-defs-list" id="ss-ovList"></div>
      <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.25</div>`);
    const markerLayer = h("div", { class: "ss-ov-markers" });
    const annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    annoSvg.setAttribute("class", "ss-ov-anno");
    annoSvg.innerHTML =
      `<defs><marker id="ss-ov-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" style="fill:${ACCENT}"></path></marker></defs><line id="ss-ov-line" x1="0" y1="0" x2="0" y2="0" style="stroke:${ACCENT}" stroke-width="2" marker-end="url(#ss-ov-arrowhead)" visibility="hidden"></line>`;
    const tip = h("div", { class: "ss-tip ss-ui", role: "tooltip" });
    document.body.appendChild(annoSvg);
    document.body.appendChild(markerLayer);
    document.body.appendChild(header);
    document.body.appendChild(panel);
    document.body.appendChild(pill);
    document.body.appendChild(tip);

    /* ---- 모드 전환 ---- */
    const bProto = pill.querySelector("#ss-ovProto");
    const bDoc = pill.querySelector("#ss-ovDoc");
    function setMode(m) {
      document.body.classList.toggle("ss-ov-doc", m === "doc");
      bProto.setAttribute("aria-pressed", String(m === "proto"));
      bDoc.setAttribute("aria-pressed", String(m === "doc"));
      if (m === "proto") core.clearActive();
      updateWidth();
      requestAnimationFrame(place);
    }
    bProto.onclick = () => setMode("proto");
    bDoc.onclick = () => setMode("doc");

    function place() {
      if (!document.body.classList.contains("ss-ov-doc")) return; /* 정의서 모드에서만 배치 */
      core.placeMarkers();
    }

    /* ---- 공통 코어 (좌표계 = 문서 좌표: rect + 페이지 스크롤) ---- */
    const core = createCore({
      headerEl: hFields,
      cntEl: panel.querySelector("#ss-ovCnt"),
      listEl: panel.querySelector("#ss-ovList"),
      markerLayer: markerLayer,
      tip: tip,
      annoLine: annoSvg.querySelector("#ss-ov-line"),
      posOf: (t) => {
        const r = t.getBoundingClientRect();
        /* 마커(24px)는 좌상단에 -40% 로 걸치므로 대상이 뷰포트 끝(x:0)이면 10px 잘린다 — 뷰포트 안으로 클램프.
           상단은 정의서 헤더(48px, fixed) 아래로 — 마커는 정의서 모드에서만 보이므로 헤더는 항상 있다 (#13) */
        return { left: Math.max(r.left, 10) + scrollX, top: Math.max(r.top, 48 + 10) + scrollY, transform: "translate(-40%,-40%)" };
      },
      viewCenter: () => ({ x: scrollX + innerWidth / 2, y: scrollY + innerHeight / 2 }),
      viewRect: () => ({ x: scrollX, y: scrollY, w: innerWidth, h: innerHeight }),
      rectOf: (t) => {
        const r = t.getBoundingClientRect();
        return { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY };
      },
      ensureDoc: () => { if (!document.body.classList.contains("ss-ov-doc")) setMode("doc"); },
      /* 캡처 대상 (#40) — 앱이 페이지 그 자체라 옮길 시트가 없다. 본문을 뜨고 뷰어 UI 만 걷어낸다 */
      capSource: () => {
        /* 정의서 모드는 본문 오른쪽에 패널 자리(400px)를 비워 둔다. 패널을 걷어내도 그 자리는
           빈 띠로 남으므로 폭에서 뺀다 — 그림 옆에 흰 띠가 붙으면 컨플에서 눈에 띈다 */
        const cs = getComputedStyle(document.body);
        const gapR = parseFloat(cs.paddingRight) || 0;
        const gapB = parseFloat(cs.paddingBottom) || 0;
        return { kind: "copy", node: document.body,
          w: Math.max(320, document.documentElement.clientWidth - gapR),
          h: Math.max(200, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - gapB) };
      },
      isDoc: () => document.body.classList.contains("ss-ov-doc"),
      afterRender: () => requestAnimationFrame(place)
    });

    /* ---- 화면 감지 (overlay·frame 공용 규칙) ---- */
    const detectScreen = () => detectScreenIn(core, window, document);
    /* SPA 라우팅 추적: pushState/replaceState 패치 + popstate */
    ["pushState", "replaceState"].forEach((fn) => {
      const orig = history[fn];
      history[fn] = function () {
        const r = orig.apply(this, arguments);
        setTimeout(detectScreen, 50);
        return r;
      };
    });
    window.addEventListener("popstate", () => setTimeout(detectScreen, 50));
    window.addEventListener("hashchange", () => setTimeout(detectScreen, 50));

    /* ---- 재배치 트리거: 스크롤(내부 컨테이너 포함)·리사이즈·DOM 변경 ---- */
    let raf = null;
    const queuePlace = () => { if (!raf) raf = requestAnimationFrame(() => { raf = null; place(); }); };
    window.addEventListener("scroll", queuePlace, { capture: true, passive: true });
    window.addEventListener("resize", queuePlace);
    let moTimer = null;
    new MutationObserver(() => {
      clearTimeout(moTimer);
      moTimer = setTimeout(() => { detectScreen(); place(); }, 120);
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });

    /* ---- 공개 API ---- */
    core.prMount(pill);
    core.edMount();
    core.lyMount();
    window.ScreenSpec = { setScreen: core.setScreen, refresh: place, current: () => core.current().id, mode: "overlay", exportImage: core.exportImage, edit: core.setEdit, serialize: core.serialize, dirty: core.isDirty };
    window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */

    core.setCurrent(SCREENS[0]);
    detectScreen();
    updateWidth();
    console.info("[ScreenSpec v0.25] overlay 모드 · 화면 " + SCREENS.length + "개 등록 · 미등록 화면은 '정의되지 않은 화면'으로 표시");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
