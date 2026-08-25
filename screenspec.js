/*!
 * ScreenSpec v0.19 — 프로토타입 자체가 화면정의서가 되는 오버레이
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
 * anno 타입 8종 (SKILL.md §5) — 의미(라벨)와 시각 동작(mech)을 분리한 레지스트리:
 *   box    영역   | mech box  | 기본값. 영역 하이라이트
 *   arrow  화살표 | mech arrow| 작은 요소 지시 — 요소 밖 56px(화면 중심 쪽)에서 가장자리를 가리키는 콜아웃 자동.
 *                              arrowTo:"#sel" 지정 시 요소→요소 관계선(가장자리↔가장자리)
 *   input  입력   | mech box  | 입력 필드 정책 (글자수·형식·검증·placeholder)
 *   state  상태   | mech box  | 조건부 표시·상태 분기 (로그인 여부, 데이터 유무 등)
 *   motion 모션   | mech box  | 등장·전환 애니메이션 정의
 *   action 동작   | mech play | 클릭 시 실제 동작 재생. play:{selector,label}
 *   popup  팝업   | mech play | 클릭 시 모달·레이어 열림. play:{selector,label}
 *   flow   이동   | mech flow | 다른 화면으로 전환. flowTo:"SCR-ID" (+선택 play.selector)
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
  /* anno 타입 레지스트리 — label(의미 구분) + mech(시각 동작). 새 타입은 여기 한 줄 추가 */
  const ANNO = {
    box:    { label: "영역",   mech: "box" },
    arrow:  { label: "화살표", mech: "arrow" },
    input:  { label: "입력",   mech: "box" },
    state:  { label: "상태",   mech: "box" },
    motion: { label: "모션",   mech: "box" },
    action: { label: "동작",   mech: "play" },
    popup:  { label: "팝업",   mech: "play" },
    flow:   { label: "이동",   mech: "flow" }
  };
  function annoOf(s) { return ANNO[s.anno] || { label: s.anno || "영역", mech: "box" }; }

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
    console.warn("[ScreenSpec] accent \"" + a + "\" 인식 불가 — 기본(blue) 사용. 프리셋: " + Object.keys(ACCENT_PRESETS).join(", ") + ", hex 또는 var(--토큰)");
    return ACCENT_PRESETS.blue;
  })();

  /* v0.14 의 panel:"left" 는 폐기 — 겹침의 정식 해법은 mode:"frame" */
  if (RAW.panel) console.warn("[ScreenSpec] panel 설정은 v0.15 에서 폐기 — 설명 패널은 오른쪽 고정. 앱의 우측 서랍과 겹치면 mode:\"frame\" 을 쓰세요");

  /* ============ 상태 커버리지 (#26) ============
     프로젝트가 정한 상태 축(checklist)을 화면마다 covers/skip 으로 대조한다.
     specs 에서 자동 추론하지 않는다 — anno:"state" 가 어느 축인지는 기계가 알 수 없고,
     "알고 비운 것"과 "몰라서 빠뜨린 것"은 선언으로만 갈린다. checklist 가 없으면 기능 자체가 꺼진다. */
  const CHECKLIST = (function () {
    const c = RAW.checklist;
    if (c == null) return null;
    if (!Array.isArray(c) || !c.length || !c.every((v) => typeof v === "string" && v.trim())) {
      console.warn("[ScreenSpec] checklist 는 문자열 배열이어야 합니다 — 무시");
      return null;
    }
    return c.map((v) => v.trim());
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
      if (!reason) { console.warn("[ScreenSpec] " + s.id + ": skip \"" + k + "\" 에 사유가 없습니다 — 미정의로 봅니다"); return; }
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
    return '<span class="ss-toc-undef ss-toc-cov" title="' + esc("이 화면에 「" + c.missing.join(" · ") + "」 설명이 없습니다 — 설정의 checklist 로 정한 점검 항목") + '">⚠ ' + esc(t) + "</span>";
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
    if (c.skipped.length) out += '<div class="ss-cov-l">해당 없음 — ' + esc(c.skipped.map((z) => z.axis + " (" + z.reason + ")").join(" · ")) + "</div>";
    return out + "</div>";
  }

  /* 사용자 텍스트는 전부 이걸 거쳐 innerHTML에 들어간다 */
  function esc(x) {
    return String(x == null ? "" : x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* 모션 감소 설정 반영 */
  const SB = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth";

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
    --ss-mono:ui-monospace,"Cascadia Code",Consolas,monospace}
  body.ss-wrap{margin:0;background:var(--ss-canvas)}
  .ss-ui,.ss-ui *{box-sizing:border-box;font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic","Apple SD Gothic Neo",sans-serif}
  .ss-ui :where(button){font:inherit;cursor:pointer;border:0;background:none;color:inherit}
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
  .ss-defs{width:460px;flex-shrink:0;background:#fff;border-left:1px solid var(--ss-line2);display:flex;flex-direction:column;min-height:0}
  .ss-defs-head{padding:12px 18px;border-bottom:1px solid var(--ss-line);display:flex;align-items:center;gap:8px}
  .ss-defs-head h2{font-size:13px;font-weight:800;margin:0;color:var(--ss-ink)}
  .ss-defs-head .ss-cnt{font-family:var(--ss-mono);font-size:11px;color:var(--ss-ink3);font-weight:700}
  .ss-defs-list{flex:1;overflow-y:auto}
  .ss-badge{border-top:1px solid var(--ss-line);padding:8px 18px;font-size:11px;color:var(--ss-ink3);background:#fff}
  .ss-badge a{color:var(--ss-ink3);font-weight:700;text-decoration:none}
  .ss-badge a:hover{color:var(--ss-accent)}
  .ss-empty{padding:24px 18px;font-size:12.5px;color:var(--ss-ink3);line-height:1.7}
  .ss-empty code{font-family:var(--ss-mono);font-size:11.5px;background:#F1F1F0;padding:1px 5px;border-radius:4px}
  .ss-empty b{color:var(--ss-ink2)}
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
  .ss-row{display:flex;border-bottom:1px solid var(--ss-line);cursor:pointer;transition:background .12s}
  /* 지금 화면에 없는 정의(조건부 상태 등) — 번호를 흐리게 + '현재 미표시' (#27) */
  .ss-nowtag{display:none;font-size:10px;color:var(--ss-ink3);border:1px dashed var(--ss-line2);border-radius:4px;padding:0 5px;margin-left:6px;white-space:nowrap}
  /* preview 가 있는 항목의 배지는 그 자리에서 눌러 재현한다 — 「지금 없음 → 눌러서 보기」가 한 흐름 (#29) */
  .ss-nowtag[role="button"]{cursor:pointer;color:var(--ss-accent);border-color:color-mix(in srgb,var(--ss-accent) 45%,#fff);transition:background .12s,color .12s}
  .ss-nowtag[role="button"]:hover,.ss-nowtag[role="button"]:focus-visible{background:var(--ss-accent-soft);color:var(--ss-accent);border-style:solid}
  .ss-row.ss-now-hidden .ss-no{opacity:.35}
  .ss-row.ss-now-hidden .ss-nowtag{display:inline-block}
  .ss-row:hover{background:#FAFAF9}
  .ss-row.ss-active{background:var(--ss-accent-soft)}
  .ss-no{width:46px;flex-shrink:0;display:flex;justify-content:center;padding-top:15px;
    font-family:var(--ss-mono);font-size:13px;font-weight:800;color:var(--ss-ink3)}
  .ss-row.ss-active .ss-no{color:var(--ss-accent)}
  .ss-main{flex:1;padding:13px 16px 14px 0;min-width:0}
  .ss-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .ss-title .ss-t{font-size:13.5px;font-weight:800;color:var(--ss-ink)}
  .ss-title .ss-pos{font-size:10.5px;color:var(--ss-ink3);white-space:nowrap}
  .ss-title .ss-pos:empty{display:none}
  .ss-title .ss-tag{font-size:10px;font-weight:700;color:var(--ss-ink3);border:1px solid var(--ss-line2);border-radius:5px;padding:1px 6px;margin-left:auto;flex-shrink:0}
  .ss-row.ss-active .ss-tag{color:var(--ss-accent);border-color:var(--ss-accent)}
  .ss-items{margin:0;padding:0;list-style:none}
  .ss-items li{font-size:12.5px;color:#37352F;position:relative;padding-left:16px;margin:4px 0;line-height:1.6}
  .ss-items li::before{content:"";position:absolute;left:3px;top:.62em;width:5px;height:5px;border-radius:50%;background:var(--ss-ink)}
  .ss-items li .ss-why{display:block;font-size:11.5px;color:var(--ss-ink3);line-height:1.5;margin-top:1px}
  .ss-items li .ss-why::before{content:"↳ 이유: "}
  .ss-items li.ss-sub{margin-left:18px}
  .ss-items li.ss-sub::before{background:#fff;border:1.3px solid var(--ss-ink2);left:2px}
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
  /* 하위 요소(parts) — 상위 행 안쪽에 한 단 들여쓴 블록. 라벨(1a·1b)은 라이브러리가 매긴다 (#25) */
  .ss-part{margin:10px 0 0 18px;padding:2px 0 5px 12px;border-left:2px solid var(--ss-line2);transition:background .12s}
  .ss-part.ss-active{background:var(--ss-accent-soft);border-left-color:var(--ss-accent);border-radius:0 6px 6px 0}
  .ss-part .ss-title{margin-bottom:4px}
  .ss-part .ss-t{font-size:12.5px}
  .ss-part-no{font-family:var(--ss-mono);font-size:11.5px;font-weight:800;color:var(--ss-ink3)}
  .ss-part.ss-active .ss-part-no{color:var(--ss-accent)}
  .ss-part .ss-play{margin:7px 0 0 16px}
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
  .ss-marker.ss-marker-sub{font-size:10.5px;letter-spacing:-.03em} /* 1a·1b — 크기는 그대로, 글자만 줄여 맞춘다 */
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
  function injectCSS() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* parts[i] → a·b … z·aa. 라벨은 라이브러리가 매긴다 — 사람이 번호를 쥐면 항목 하나 끼울 때마다 뒤가 전부 밀린다 (#25) */
  const PART_LETTERS = "abcdefghijklmnopqrstuvwxyz";
  function partSuffix(i) {
    let out = "";
    for (let v = i; v >= 0; v = Math.floor(v / 26) - 1) out = PART_LETTERS[v % 26] + out;
    return out;
  }
  /* 렌더 단위 평탄화 — 상위(spec)와 하위(part)를 같은 모양의 항목으로 편다 (#25).
     key = 상위 "1" · 하위 "1a" (문자열). 마커·활성화·배치·화살표·재생이 전부 이 key 로 돈다. */
  function flatItems(specs) {
    const out = [];
    (specs || []).forEach((s) => {
      out.push({ key: String(s.n), label: String(s.n), isPart: false, parent: null, spec: s });
      (s.parts || []).forEach((p, i) => {
        const key = String(s.n) + partSuffix(i);
        out.push({ key: key, label: key, isPart: true, parent: s, spec: p });
      });
    });
    return out;
  }
  /* 정의 불렛(공통) — 근거는 사양과 분리한다. 구현자는 사양만, 검토자는 이유까지 (#24) */
  function defItemsHTML(defs) {
    let items = "";
    (defs || []).forEach((d) => {
      items += "<li>" + esc(d.t) + (d.why ? '<span class="ss-why" title="이유">' + esc(d.why) + "</span>" : "") + "</li>";
      (d.subs || []).forEach((sub) => { items += '<li class="ss-sub">' + esc(sub) + "</li>"; });
    });
    return items;
  }
  /* ▶ 버튼(공통) — key 는 상위 "1" · 하위 "1a" */
  function playBtnHTML(sp, key) {
    const type = annoOf(sp);
    if (type.mech === "play" && sp.play)
      return '<button class="ss-play" data-play="' + key + '">▶ ' + esc(sp.play.label || (sp.anno === "popup" ? "팝업 열기" : "동작 재생")) + "</button>";
    if (type.mech === "flow" && (sp.flowTo || sp.play)) {
      const dest = SCREENS.find((x) => x.id === sp.flowTo);
      return '<button class="ss-play" data-play="' + key + '">▶ ' + esc((sp.play && sp.play.label) || "이동 — " + (dest ? dest.name : sp.flowTo)) + "</button>";
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
      let parts = "";
      (s.parts || []).forEach((p, i) => {
        const key = String(s.n) + partSuffix(i);
        parts += `<div class="ss-part" data-part="${key}">
          <div class="ss-title ss-part-head"><span class="ss-part-no">${key}</span><span class="ss-t">${esc(p.title || "")}</span><span class="ss-pos"></span><span class="ss-tag">${esc(annoOf(p).label)}</span></div>
          <ul class="ss-items">${defItemsHTML(p.defs)}</ul>${playBtnHTML(p, key)}${previewBtnHTML(p, key)}
        </div>`;
      });
      out += `<div class="ss-row" id="ss-def-${s.n}" tabindex="0" data-defrow="${s.n}">
        <div class="ss-no">${s.n}</div>
        <div class="ss-main">
          <div class="ss-title"><span class="ss-t">${esc(s.title)}</span><span class="ss-pos"></span><span class="ss-tag">${esc(type.label)}</span><span class="ss-nowtag">현재 미표시</span></div>
          <ul class="ss-items">${defItemsHTML(s.defs)}</ul>${playBtnHTML(s, s.n)}${previewBtnHTML(s, s.n)}${parts}
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
      if (!sc.root || sc.route) return;
      const el = doc.querySelector(sc.root);
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
      return current && current.root ? d.querySelector(current.root) || d : d;
    }
    function targetOf(s) {
      const r = rootEl();
      return (r.querySelector ? r : appDoc()).querySelector('[data-spec="' + s.target + '"]');
    }
    function specs() { return (current && current.specs) || []; }
    /* 상위·하위를 편 목록. 하위(part)는 parent 를 갖고, target 이 없으면 패널에만 산다 (#25) */
    function items() { return flatItems(specs()); }
    function itemOf(key) { return items().find((it) => it.key === key); }
    /* 패널에서 그 항목의 블록 — 상위는 행 자체, 하위는 행 안의 .ss-part */
    function blockOf(it) {
      return it.isPart ? ctx.listEl.querySelector('[data-part="' + it.key + '"]')
                       : document.getElementById("ss-def-" + it.key);
    }

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
      const subCnt = items().filter((it) => it.isPart).length;
      /* parts 가 있으면 세부를 갈라 적는다 — 「항목 8개」만 세면 정의 밀도가 실제보다 얇아 보인다 (#25).
         「상위·하위」는 관계를 가리키는 말이라 무엇의 위인지 모르면 읽히지 않아 「항목 N개 · 세부 M개」로 (#30) */
      ctx.cntEl.textContent = "항목 " + specs().length + "개" + (subCnt ? " · 세부 " + subCnt + "개" : "");
      if (specs().length === 0) {
        /* 등록은 했지만 아직 정의를 안 쓴 화면 — 처음 붙이는 사람이 가장 오래 머무는 자리. 백지 대신 다음 할 일 (#19) */
        const r = rootEl();
        const have = (r.querySelectorAll ? r : appDoc()).querySelectorAll("[data-spec]").length;
        ctx.listEl.innerHTML = '<div class="ss-empty">이 화면은 등록됐지만 기능 설명이 아직 없습니다.<br><br>' +
          '1. 설명할 영역에 <code>data-spec="1"</code> 을 붙이세요<br>' +
          '2. 설정의 <b>' + esc(current.id) + '</b> › <b>specs</b> 에 <code>{ n:1, target:"1", title:"영역명" }</code> 을 넣으세요<br><br>' +
          '지금 이 화면에서 data-spec 이 붙은 요소: <b>' + have + '개</b></div>' + covBlockHTML(current);
        ctx.markerLayer.innerHTML = "";
        markerEls = {};
        ctx.afterRender();
        return;
      }
      ctx.listEl.innerHTML = defsRowsHTML(specs()) + covBlockHTML(current);
      if (previewKey != null) pvSetBtn(pvBtn(previewKey), true); /* 재렌더돼도 켜진 스위치는 켜진 채로 — 라벨(원래대로)까지 (#27·#29) */
      ctx.markerLayer.innerHTML = "";
      markerEls = {};
      items().forEach((it) => {
        if (it.isPart && !it.spec.target) return; /* target 없는 하위 요소는 패널에만 (#25) */
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
    let missMo = null, missTimer = null, missCap = null;
    function watchMissing(sc) {
      if (missMo) { missMo.disconnect(); missMo = null; }
      clearTimeout(missTimer); clearTimeout(missCap);
      if (warned[sc.id]) return;
      const attempt = () => {
        if (sc !== current || warned[sc.id]) return stop();
        const missing = [], cond = []; /* cond = anno:"state" — 조건부 표시라 없는 게 정상일 수 있어 경고에서 제외 (#20) */
        items().forEach((it) => { /* 하위 요소도 target 이 있으면 센다 — 보고는 #1a (#25) */
          const sp = it.spec;
          if (it.isPart && !sp.target) return;
          if (!targetOf(sp)) (sp.anno === "state" || sp.optional ? cond : missing).push(it); /* optional:true — anno 와 무관하게 조건부 (#23) */
        });
        if (!missing.length) { warned[sc.id] = "clean"; return stop(); }
        warned[sc.id] = true;
        console.warn("[ScreenSpec] " + sc.id + ": data-spec 요소를 못 찾은 정의 " + missing.length + "건 — " +
          missing.map((it) => "#" + it.label + " target=\"" + it.spec.target + "\"").join(", ") +
          " (마커 숨김. 해당 화면에 data-spec 속성이 있는지 확인)" +
          (cond.length ? " · 조건부(state·optional) " + cond.length + "건은 제외" : ""));
        stop();
      };
      const stop = () => { if (missMo) missMo.disconnect(); missMo = null; clearTimeout(missTimer); clearTimeout(missCap); };
      missMo = new MutationObserver((recs) => {
        if (!recs.some((r) => !(r.target.closest && r.target.closest(OWN_UI)))) return; /* 우리 UI 안의 변경은 무시 */
        clearTimeout(missTimer);
        missTimer = setTimeout(attempt, MISS_QUIET);
      });
      missMo.observe(appDoc().body, { subtree: true, childList: true });
      missTimer = setTimeout(attempt, MISS_QUIET);
      missCap = setTimeout(attempt, MISS_CAP);
    }
    const navToast = h("div", { class: "ss-ui ss-nav-toast" });
    document.body.appendChild(navToast);
    let navTimer = null;
    function showNav(sc) {
      navToast.textContent = "→ " + sc.id + " · " + sc.name;
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
        if (!o.root) return;
        const el = appDoc().querySelector(o.root);
        if (el) el.style.display = o === sc ? "" : "none";
      });
    }
    function setScreen(id) {
      const next = SCREENS.find((s) => s.id === id);
      if (!next) return;
      /* 라우트 없는 root 화면은 앱 화면도 같이 전환해야 화면 감지가 되돌리지 않는다 (wrap 한정) */
      if (next.root && !next.route && ctx.toggleRoot === true) showRoot(next);
      setCurrent(next);
    }

    /* 위치 힌트 — 실무 정의서의 "상단 타이틀 영역·하단 버튼 영역" 을 사람이 적게 하지 않고, 마커가 찍힌 실제 좌표에서 계산한다.
       화면(뷰포트) 기준: 세로 상단/중앙/하단(⅓ 경계) · 가로 전체폭(≥70%)/좌측/우측/중앙. 화면 없이 패널만 읽을 때 어디인지 알게 */
    function posHint(t) {
      if (!ctx.viewRect) return "";
      const v = ctx.viewRect(), r = ctx.rectOf(t);
      if (!v.w || !v.h) return "";
      const cy = ((r.t + r.b) / 2 - v.y) / v.h, cx = ((r.l + r.r) / 2 - v.x) / v.w, wr = (r.r - r.l) / v.w;
      const vert = cy < 1 / 3 ? "상단" : cy > 2 / 3 ? "하단" : "중앙";
      const horz = wr >= 0.7 ? "전체폭" : cx < 1 / 3 ? "좌측" : cx > 2 / 3 ? "우측" : "중앙";
      return vert === "중앙" && horz === "중앙" ? "중앙" : vert + " · " + horz;
    }
    function placeMarkers() {
      items().forEach((it) => {
        if (it.isPart && !it.spec.target) return;
        const t = targetOf(it.spec), m = markerEls[it.key];
        const hidden = !t || t.getClientRects().length === 0;
        const blk = blockOf(it);
        if (blk && !it.isPart) { /* 정의는 있는데 지금 화면엔 없음 — 패널에서 구분 (#27) */
          blk.classList.toggle("ss-now-hidden", hidden);
          pvTagWire(blk.querySelector(".ss-main > .ss-title > .ss-nowtag"), it, hidden);
        }
        if (blk && !hidden) { /* 위치 힌트는 상위·하위 각자의 블록에 (#25) */
          const ph = blk.querySelector(it.isPart ? ".ss-pos" : ".ss-main > .ss-title > .ss-pos");
          if (ph) ph.textContent = posHint(t);
        }
        if (!m) return;
        if (hidden) { m.style.display = "none"; return; }
        m.style.display = "";
        const pos = ctx.posOf(t);
        m.style.left = pos.left + "px";
        m.style.top = pos.top + "px";
        m.style.transform = pos.transform;
      });
      drawArrow();
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
        '<div class="ss-tn">' + (it.isPart ? esc(it.label) : "NO." + it.label) + " · " + esc(annoOf(s).label) + "</div>" +
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
        const row = it.isPart ? document.getElementById("ss-def-" + it.parent.n) : blk;
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
      pvBarText.textContent = "◑ 「" + (it.spec.title || it.label) + "」 재현 중 — 실제 데이터가 아닙니다";
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
      tag.textContent = "이 프로토타입은 아직 이 상태를 만들지 못합니다 — 정의는 있지만 화면으로 확인할 수 없습니다";
      btn.insertAdjacentElement("afterend", tag);
      const id = (current ? current.id : "") + "/" + it.key;
      if (!pvTold[id]) {
        pvTold[id] = 1;
        console.info('[ScreenSpec] preview "' + (it.spec.title || it.label) + '" 를 받는 앱 코드가 없습니다 — screenspec:preview 이벤트를 들어야 재현됩니다');
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
      } else if (!sc.route && sc.root) {
        /* root 기반 화면: 앱 화면도 같은 방식(표시/숨김)으로 전환 — 정의서·앱 동기 유지.
           안 하면 화면 감지가 "앱은 그대로"라며 이전 화면으로 되돌린다. */
        showRoot(sc);
      }
    });
    document.addEventListener("click", (e) => { if (!toc.contains(e.target)) closeToc(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeToc(); });

    return { setCurrent, setScreen, current: () => current, placeMarkers, clearActive, render };
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
      window.ScreenSpec = { setScreen: noop, refresh: noop, current: () => null, mode: "off", off: true };
      window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */
      console.info("[ScreenSpec] off — 프로토타입 원본 그대로입니다. 화면정의서를 보려면 주소 끝에 ?screenspec=1 (또는 #screenspec)");
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
      if (seen[s.id]) console.warn("[ScreenSpec] 화면 ID 중복: " + s.id + " — 뒤의 화면은 목차·이동에서 무시됩니다");
      seen[s.id] = 1;
    });
    SCREENS.forEach((sc) => (sc.specs || []).forEach((sp) => {
      [sp].concat(sp.parts || []).forEach((it, i) => { /* 하위 요소(parts)의 flowTo 도 검사 */
        if (it.flowTo && !SCREENS.some((x) => x.id === it.flowTo))
          console.warn("[ScreenSpec] " + sc.id + " n=" + sp.n + (i ? partSuffix(i - 1) : "") + ": flowTo \"" + it.flowTo + "\" 화면이 screens에 없습니다 — 이동 버튼이 동작하지 않습니다");
      });
    }));
    /* 상태 점검이 켜져 있으면 그 사실을 알린다 — 설정을 직접 넣지 않은 사람도 «저 ⚠ 가 뭔지» 를 알 수 있게 */
    if (CHECKLIST) console.info("[ScreenSpec] 상태 점검 켜짐 — 화면마다 " + CHECKLIST.join(" · ") + " 를 적었는지 확인합니다. 화면의 covers 에 적거나 skip 에 사유를 적으면 ⚠ 가 사라집니다");
    /* 모드 결정: 명시 > 프레임워크 자동 감지 > wrap */
    const isFramework = !!(window.next || document.querySelector("#__next,[data-reactroot],script#__NEXT_DATA__"));
    const mode = RAW.mode || (isFramework ? "overlay" : "wrap");
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
          <div class="ss-defs-head"><h2>기능 설명</h2><span class="ss-cnt" id="ss-cnt"></span></div>
          <div class="ss-defs-list" id="ss-defsList"></div>
          <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.19</div>
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

    /* ---- 다중 화면 자동 감지 (root 표시/숨김 추적) ---- */
    function detectScreen() {
      if (SCREENS.length < 2) return;
      for (const sc of SCREENS) {
        if (!sc.root) continue;
        const el = document.querySelector(sc.root);
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
    window.ScreenSpec = { setScreen: core.setScreen, refresh: layout, current: () => core.current().id, mode: FRAME ? "frame" : "wrap" };
    window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */

    core.setCurrent(SCREENS[0]);
    /* 시작 폭 = 이 문서가 서술하는 기준 폭. baseViewport: "mobile"(기본) | "pc" — 어드민은 PC, 앱은 모바일 (#17) */
    const base = DEVICES[RAW.baseViewport] ? RAW.baseViewport : "mobile";
    if (RAW.baseViewport && !DEVICES[RAW.baseViewport]) console.warn("[ScreenSpec] baseViewport \"" + RAW.baseViewport + "\" 인식 불가 — mobile 사용 (" + Object.keys(DEVICES).join(" | ") + ")");
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.w === base)));
    applySize(DEVICES[base].w, DEVICES[base].h);
    if (FRAME) hideAppDom(); /* 부팅 중 앱이 body 에 더 붙였을 수 있다 */
    console.info("[ScreenSpec v0.19] " + (FRAME ? "frame" : "wrap") + " 모드 · 화면 " + SCREENS.length + "개 등록");
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
      <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.19</div>`);
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
    window.ScreenSpec = { setScreen: core.setScreen, refresh: place, current: () => core.current().id, mode: "overlay" };
    window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */

    core.setCurrent(SCREENS[0]);
    detectScreen();
    updateWidth();
    console.info("[ScreenSpec v0.19] overlay 모드 · 화면 " + SCREENS.length + "개 등록 · 미등록 화면은 '정의되지 않은 화면'으로 표시");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
