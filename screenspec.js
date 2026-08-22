/*!
 * ScreenSpec v0.10 — 프로토타입 자체가 화면정의서가 되는 오버레이
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
 *   arrow  화살표 | mech arrow| 아이콘·버튼 등 작은 요소 지시
 *   input  입력   | mech box  | 입력 필드 정책 (글자수·형식·검증·placeholder)
 *   state  상태   | mech box  | 조건부 표시·상태 분기 (로그인 여부, 데이터 유무 등)
 *   motion 모션   | mech box  | 등장·전환 애니메이션 정의
 *   action 동작   | mech play | 클릭 시 실제 동작 재생. play:{selector,label}
 *   popup  팝업   | mech play | 클릭 시 모달·레이어 열림. play:{selector,label}
 *   flow   이동   | mech flow | 다른 화면으로 전환. flowTo:"SCR-ID" (+선택 play.selector)
 *
 * 모드 2종 (자동 판별, mode로 명시 가능):
 *   wrap    단일 HTML 프로토타입 — 기기 뷰포트 포함 전 기능
 *   overlay React·Next·Vue 등 프레임워크 — DOM 불변, 라우트(route) 기반 화면 추적.
 *           screens[].route: "/members" 또는 "/members/[id]".
 *           basePath·정적 호스팅(경로 접두)도 suffix 매칭으로 지원.
 *
 * 반응형 훅(wrap): 시트 폭에 따라 .ss-pc(≥1100px) / .ss-narrow(≤520px)가 시트에 붙는다.
 * 프로토타입 CSS는 미디어쿼리 대신 이 훅으로 분기.
 *
 * z-index 스케일 (프로토타입은 이 대역을 지킬 것):
 *      0 ~ 7999  프로토타입 자유 영역 (시트 내부 콘텐츠)
 *   8000 ~ 8099  ScreenSpec 시트 오버레이 — anno 8030 · markers 8040 · resize 8050
 *   9000 ~ 9099  ScreenSpec 크롬 — docmode 9000 · toolbar 9020 · pill 9030 · tip 9040
 *   9500 이상    프로토타입 전역 오버레이 (data-ss-ignore 모달·토스트) — 모든 것 위 (의도)
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
    console.warn("[ScreenSpec] accent \"" + a + "\" 인식 불가 — 기본(blue) 사용. 프리셋: " + Object.keys(ACCENT_PRESETS).join(", ") + " 또는 hex");
    return ACCENT_PRESETS.blue;
  })();

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
  @media(max-width:1000px){
    body.ss-mode-doc .ss-docmode{position:static;display:block;padding-top:50px}
    .ss-doc-body{display:block}.ss-stage{overflow:visible}
    .ss-defs{width:100%;border-left:0;border-top:1px solid var(--ss-line2)}
  }
  .ss-row{display:flex;border-bottom:1px solid var(--ss-line);cursor:pointer;transition:background .12s}
  .ss-row:hover{background:#FAFAF9}
  .ss-row.ss-active{background:var(--ss-accent-soft)}
  .ss-no{width:46px;flex-shrink:0;display:flex;justify-content:center;padding-top:15px;
    font-family:var(--ss-mono);font-size:13px;font-weight:800;color:var(--ss-ink3)}
  .ss-row.ss-active .ss-no{color:var(--ss-accent)}
  .ss-main{flex:1;padding:13px 16px 14px 0;min-width:0}
  .ss-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .ss-title .ss-t{font-size:13.5px;font-weight:800;color:var(--ss-ink)}
  .ss-title .ss-tag{font-size:10px;font-weight:700;color:var(--ss-ink3);border:1px solid var(--ss-line2);border-radius:5px;padding:1px 6px;margin-left:auto;flex-shrink:0}
  .ss-row.ss-active .ss-tag{color:var(--ss-accent);border-color:var(--ss-accent)}
  .ss-items{margin:0;padding:0;list-style:none}
  .ss-items li{font-size:12.5px;color:#37352F;position:relative;padding-left:16px;margin:4px 0;line-height:1.6}
  .ss-items li::before{content:"";position:absolute;left:3px;top:.62em;width:5px;height:5px;border-radius:50%;background:var(--ss-ink)}
  .ss-items li.ss-sub{margin-left:18px}
  .ss-items li.ss-sub::before{background:#fff;border:1.3px solid var(--ss-ink2);left:2px}
  .ss-play{margin:9px 0 0 16px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;
    color:#fff;border-radius:8px;padding:7px 14px;background:var(--ss-accent);
    box-shadow:0 2px 8px color-mix(in srgb,var(--ss-accent) 35%,transparent);transition:background .12s}
  .ss-play:hover{background:color-mix(in srgb,var(--ss-accent) 82%,#000)}
  .ss-play:active{transform:translateY(1px)}
  .ss-frame{position:relative}
  .ss-sheet{position:relative;background:#fff;border-radius:14px;overflow:auto;
    box-shadow:0 1px 3px rgba(17,24,39,.08),0 16px 44px rgba(17,24,39,.10);padding:28px 24px 40px}
  .ss-sheet.ss-narrow{padding:20px 14px 32px}
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
  .ss-markers,.ss-anno{position:absolute;top:0;left:0;width:100%;height:100%;z-index:8040;pointer-events:none}
  .ss-anno{z-index:8030;overflow:visible}
  body.ss-mode-proto .ss-marker,body.ss-mode-proto .ss-anno{display:none}
  :where(.ss-hl){position:relative}
  .ss-hl::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
    border:2px solid var(--ss-accent);border-radius:inherit;
    background:color-mix(in srgb,var(--ss-accent) 8%,transparent)}
  .ss-tip{position:fixed;z-index:9040;max-width:280px;background:#fff;border:1px solid var(--ss-line2);
    border-radius:10px;box-shadow:0 10px 30px rgba(17,24,39,.18);padding:10px 13px;display:none;pointer-events:none}
  .ss-tip .ss-tn{font-family:var(--ss-mono);font-size:10px;font-weight:800;color:var(--ss-accent)}
  .ss-tip .ss-tt{font-size:13px;font-weight:800;margin:2px 0 3px;color:var(--ss-ink)}
  .ss-tip .ss-td{font-size:12px;color:var(--ss-ink2)}
  /* ---- 화면 목록 (목차) — 헤더의 화면 ID 클릭으로 열림 ---- */
  .ss-toc-btn{cursor:pointer;display:inline-flex;align-items:center;gap:5px;border-radius:7px;padding:1px 6px;margin:-1px -6px;transition:background .12s}
  .ss-toc-btn:hover{background:var(--ss-accent-soft);color:var(--ss-accent)}
  .ss-toc-caret{font-style:normal;font-size:9px;color:var(--ss-ink3)}
  .ss-toc-btn:hover .ss-toc-caret{color:var(--ss-accent)}
  .ss-toc{position:fixed;z-index:9045;min-width:300px;max-width:380px;max-height:62vh;overflow-y:auto;
    background:#fff;border:1px solid var(--ss-line2);border-radius:12px;
    box-shadow:0 14px 44px rgba(17,24,39,.22);display:none}
  .ss-toc.ss-open{display:block}
  .ss-toc-head{display:flex;align-items:baseline;gap:8px;padding:11px 16px;border-bottom:1px solid var(--ss-line);
    position:sticky;top:0;background:#fff;font-size:13px;color:var(--ss-ink)}
  .ss-toc-head b{font-weight:800}
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
  /* 커맨드 팔레트 스타일: 섹션 라벨(비클릭) + 행 내 브레드크럼 */
  .ss-toc-sec{padding:12px 16px 4px;font-size:10.5px;font-weight:800;letter-spacing:.05em;color:var(--ss-ink3)}
  .ss-toc-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
  .ss-toc-crumb{font-size:10.5px;color:var(--ss-ink3);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ss-toc-idr{font-family:var(--ss-mono);font-size:10.5px;font-weight:700;color:var(--ss-ink3);flex-shrink:0;max-width:40%}
  .ss-toc-row.ss-cur .ss-toc-idr{color:var(--ss-accent)}
  .ss-toc-row .ss-toc-dot{margin-top:5px;align-self:flex-start}
  .ss-toc-row{align-items:flex-start}
  /* 화면 전환 알림 토스트 — 이동 인지용 */
  .ss-nav-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-6px);z-index:9046;
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
    .ss-toc-row{padding-top:12px;padding-bottom:12px}
  }
  /* ---- 오버레이 모드 (React·Next·SPA — DOM을 감싸지 않음) ---- */
  .ss-pill{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9030;display:flex;gap:2px;
    background:#fff;border:1px solid var(--ss-line2);border-radius:99px;padding:3px;box-shadow:0 4px 16px rgba(17,24,39,.18)}
  .ss-pill button{padding:5px 14px;border-radius:99px;font-size:12.5px;font-weight:700;color:var(--ss-ink2)}
  .ss-pill button[aria-pressed="true"]{background:var(--ss-ink);color:#fff}
  .ss-ov-header{position:fixed;top:0;left:0;right:0;height:48px;z-index:9010;background:#fff;
    border-bottom:1px solid var(--ss-line2);display:none;align-items:center;gap:28px;padding:0 16px}
  .ss-ov-panel{position:fixed;top:48px;right:0;bottom:0;width:400px;z-index:9010;background:#fff;
    border-left:1px solid var(--ss-line2);display:none;flex-direction:column;box-shadow:-8px 0 30px rgba(17,24,39,.12)}
  .ss-ov-markers{position:absolute;top:0;left:0;width:100%;height:0;z-index:8040;pointer-events:none;display:none}
  .ss-ov-markers .ss-marker{pointer-events:auto}
  .ss-ov-anno{position:absolute;top:0;left:0;width:100%;height:0;z-index:8030;overflow:visible;pointer-events:none;display:none}
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

  /* 기능정의 행 HTML (wrap·overlay 공용) */
  function defsRowsHTML(specs) {
    let out = "";
    (specs || []).forEach((s) => {
      let items = "";
      (s.defs || []).forEach((d) => {
        items += "<li>" + esc(d.t) + "</li>";
        (d.subs || []).forEach((sub) => { items += '<li class="ss-sub">' + esc(sub) + "</li>"; });
      });
      const type = annoOf(s);
      let play = "";
      if (type.mech === "play" && s.play)
        play = '<button class="ss-play" data-play="' + s.n + '">▶ ' + esc(s.play.label || (s.anno === "popup" ? "팝업 열기" : "동작 재생")) + "</button>";
      else if (type.mech === "flow" && (s.flowTo || s.play)) {
        const dest = SCREENS.find((x) => x.id === s.flowTo);
        play = '<button class="ss-play" data-play="' + s.n + '">▶ ' + esc((s.play && s.play.label) || "이동 — " + (dest ? dest.name : s.flowTo)) + "</button>";
      }
      out += `<div class="ss-row" id="ss-def-${s.n}" tabindex="0" data-defrow="${s.n}">
        <div class="ss-no">${s.n}</div>
        <div class="ss-main">
          <div class="ss-title"><span class="ss-t">${esc(s.title)}</span><span class="ss-tag">${esc(type.label)}</span></div>
          <ul class="ss-items">${items}</ul>${play}
        </div></div>`;
    });
    return out;
  }
  function headerFieldsHTML(screen) {
    const pathHtml = (screen.path || []).map((p) => "<span>" + esc(p) + "</span>").join('<span class="ss-sep">›</span>');
    return `
      <div class="ss-dh"><span class="ss-k">화면 ID</span><button class="ss-v ss-monoV ss-toc-btn" title="화면 목록 열기">${esc(screen.id)}<i class="ss-toc-caret">▾</i></button></div>
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

  /* ============================================================
     공통 코어 — 마커·기능정의·활성화·화살표·툴팁
     ctx = {
       headerEl, cntEl, listEl, markerLayer, tip, annoLine,
       posOf(target)   → {left, top, transform}   마커 좌표 (부트별 좌표계)
       centerOf(target)→ {cx, cy, halfW}          화살표 좌표
       ensureDoc()                                 프로토타입 모드면 정의서 모드로
       afterRender()                               렌더 후 배치 트리거
     }
     ============================================================ */
  function createCore(ctx) {
    let current = null;
    let activeN = null;
    let markerEls = {};
    const warned = {};

    function rootEl() {
      return current && current.root ? document.querySelector(current.root) || document : document;
    }
    function targetOf(s) {
      const r = rootEl();
      return (r.querySelector ? r : document).querySelector('[data-spec="' + s.target + '"]');
    }
    function specs() { return (current && current.specs) || []; }

    function render() {
      ctx.headerEl.innerHTML = headerFieldsHTML(current);
      if (current._unmapped) {
        ctx.cntEl.textContent = "0항목";
        ctx.listEl.innerHTML = '<div class="ss-empty">이 화면은 아직 정의되지 않았습니다.<br>' +
          '설정의 <b>screens</b>에 이 경로(<code>' + esc(current._path) + '</code>)를 추가하면 여기 나타납니다.</div>';
        ctx.markerLayer.innerHTML = "";
        markerEls = {};
        return;
      }
      ctx.cntEl.textContent = specs().length + "항목";
      ctx.listEl.innerHTML = defsRowsHTML(specs());
      ctx.markerLayer.innerHTML = "";
      markerEls = {};
      let missing = 0;
      specs().forEach((s) => {
        if (!targetOf(s)) missing++;
        const el = h("button", { class: "ss-ui ss-marker", "aria-label": "기능 " + s.n + ": " + s.title });
        el.textContent = s.n;
        el.onclick = (e) => { e.stopPropagation(); activate(s.n, "marker"); };
        el.onmouseenter = () => showTip(s, el);
        el.onmouseleave = () => (ctx.tip.style.display = "none");
        ctx.markerLayer.appendChild(el);
        markerEls[s.n] = el;
      });
      if (missing && !warned[current.id]) {
        warned[current.id] = true;
        console.warn("[ScreenSpec] " + current.id + ": data-spec 요소를 못 찾은 정의 " + missing + "건 — 마커가 숨겨집니다. 해당 화면에 data-spec 속성이 있는지 확인하세요.");
      }
      ctx.afterRender();
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
      current = sc;
      render();
      if (prev && !sc._unmapped && ctx.isDoc && ctx.isDoc()) showNav(sc);
    }
    function setScreen(id) {
      const next = SCREENS.find((s) => s.id === id);
      if (next) setCurrent(next);
    }

    function placeMarkers() {
      specs().forEach((s) => {
        const t = targetOf(s), m = markerEls[s.n];
        if (!m) return;
        if (!t || t.getClientRects().length === 0) { m.style.display = "none"; return; }
        m.style.display = "";
        const pos = ctx.posOf(t);
        m.style.left = pos.left + "px";
        m.style.top = pos.top + "px";
        m.style.transform = pos.transform;
      });
      drawArrow();
    }
    function drawArrow() {
      const s = specs().find((x) => x.n === activeN);
      if (!s || annoOf(s).mech !== "arrow") { ctx.annoLine.setAttribute("visibility", "hidden"); return; }
      const t = targetOf(s);
      if (!t) return;
      const c = ctx.centerOf(t);
      ctx.annoLine.setAttribute("x1", c.cx - 120); ctx.annoLine.setAttribute("y1", c.cy + 80);
      ctx.annoLine.setAttribute("x2", c.cx - c.halfW - 8); ctx.annoLine.setAttribute("y2", c.cy + 8);
      ctx.annoLine.setAttribute("visibility", "visible");
    }
    function showTip(s, m) {
      ctx.tip.innerHTML =
        '<div class="ss-tn">NO.' + s.n + " · " + esc(annoOf(s).label) + "</div>" +
        '<div class="ss-tt">' + esc(s.title) + "</div>" +
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
      if (activeN == null) return;
      const s = specs().find((x) => x.n === activeN);
      if (s) { const t = targetOf(s); if (t) t.classList.remove("ss-hl"); }
      if (markerEls[activeN]) markerEls[activeN].classList.remove("ss-hot");
      const row = document.getElementById("ss-def-" + activeN);
      if (row) row.classList.remove("ss-active");
      activeN = null;
      drawArrow();
    }
    function activate(n, from) {
      ctx.ensureDoc();
      clearActive();
      activeN = n;
      const s = specs().find((x) => x.n === n);
      if (!s) return;
      const t = targetOf(s);
      if (t) t.classList.add("ss-hl");
      if (markerEls[n]) markerEls[n].classList.add("ss-hot");
      const row = document.getElementById("ss-def-" + n);
      if (row) row.classList.add("ss-active");
      if (from === "panel" && t) t.scrollIntoView({ block: "center", behavior: SB });
      if (from === "marker" && row) row.scrollIntoView({ block: "center", behavior: SB });
      drawArrow();
    }

    /* 패널 상호작용 (위임) — 행 클릭 + play/flow 버튼 */
    ctx.listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-play]");
      if (btn) {
        e.stopPropagation();
        const s = specs().find((x) => x.n === Number(btn.dataset.play));
        if (!s) return;
        activate(s.n, "panel");
        if (s.play && s.play.selector) {
          const el = document.querySelector(s.play.selector);
          if (el) el.click(); /* flow는 실제 내비 클릭 → 화면 감지가 정의서를 자동 전환 */
        } else if (annoOf(s).mech === "flow" && s.flowTo) {
          setScreen(s.flowTo);
        }
        return;
      }
      const row = e.target.closest("[data-defrow]");
      if (row) activate(Number(row.dataset.defrow), "panel");
    });
    ctx.listEl.addEventListener("keydown", (e) => {
      const row = e.target.closest("[data-defrow]");
      if (row && e.key === "Enter") activate(Number(row.dataset.defrow), "panel");
    });

    /* ---- 화면 목록 (목차) — 커맨드 팔레트 패턴 (Linear·Vercel ⌘K 벤치마크):
       클릭 가능한 그룹 행 없이 플랫 리스트. 계층은 ① 1뎁스 = 섹션 라벨(비클릭)
       ② 그 아래 뎁스 = 행 안의 브레드크럼("홈 › 과일 상점")으로 표현.
       path가 아무리 깊어도 크럼이 흡수 — MAX_TOC_DEPTH는 크럼 표시 상한. ---- */
    const MAX_TOC_DEPTH = 4; /* 추후 6까지 확장 시 이 값만 변경 */
    const toc = h("div", { class: "ss-ui ss-toc" });
    document.body.appendChild(toc);
    function renderToc() {
      const defined = SCREENS.filter((s) => (s.specs || []).length > 0).length;
      /* 1뎁스(섹션)별 그룹핑 — 순서는 첫 등장 순 */
      const sections = [];
      const bySection = {};
      SCREENS.forEach((s) => {
        /* 부모 화면(예: "홈")도 자기 이름 섹션 안에 포함되도록 path[0] 기준 그룹핑 */
        const sec = (s.path && s.path.length) ? s.path[0] : "";
        if (!(sec in bySection)) { bySection[sec] = []; sections.push(sec); }
        bySection[sec].push(s);
      });
      let html = "";
      sections.forEach((sec) => {
        if (sec) html += `<div class="ss-toc-sec">${esc(sec)}</div>`;
        bySection[sec].forEach((s) => {
          const n = (s.specs || []).length;
          /* 크럼 = 섹션과 자신 사이의 중간 세그먼트만 (섹션명 중복 표기 방지) */
          let parents = (s.path || []).slice(1, -1);
          if (parents.length > MAX_TOC_DEPTH - 2) parents = parents.slice(0, MAX_TOC_DEPTH - 3).concat("…");
          const crumb = parents.join(" › ");
          /* ID는 뒷자리가 식별의 핵심 — 길면 앞을 자르고 뒤를 보존 */
          const idShow = s.id.length > 14 ? "…" + s.id.slice(-13) : s.id;
          const sub = crumb + (n ? "" : (crumb ? " · " : "") + "미정의");
          html += `<div class="ss-toc-row${current && s.id === current.id ? " ss-cur" : ""}${n ? "" : " ss-undef"}" data-toc="${esc(s.id)}">
            <span class="ss-toc-dot"></span>
            <span class="ss-toc-main">
              <span class="ss-toc-name">${esc(s.name)}</span>
              ${sub ? `<span class="ss-toc-crumb">${esc(sub)}</span>` : ""}
            </span>
            <span class="ss-toc-idr" title="${esc(s.id)}">${esc(idShow)}</span></div>`;
        });
      });
      toc.innerHTML = `<div class="ss-toc-head"><b>화면 목록</b><span class="ss-cnt">${defined}/${SCREENS.length} 정의됨</span><button class="ss-toc-x" aria-label="닫기">✕</button></div>` + html;
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
      if (sc.route && location.pathname !== sc.route) {
        try {
          history.pushState({}, "", sc.route);
          dispatchEvent(new PopStateEvent("popstate"));
        } catch (err) { /* file:// 등 pushState 불가 환경 방어 */ }
      } else if (!sc.route && sc.root) {
        /* root 기반 화면: 앱 화면도 같은 방식(표시/숨김)으로 전환 — 정의서·앱 동기 유지.
           안 하면 화면 감지가 "앱은 그대로"라며 이전 화면으로 되돌린다. */
        SCREENS.forEach((o) => {
          if (!o.root) return;
          const el = document.querySelector(o.root);
          if (el) el.style.display = o === sc ? "" : "none";
        });
      }
    });
    document.addEventListener("click", (e) => { if (!toc.contains(e.target)) closeToc(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeToc(); });

    return { setCurrent, setScreen, current: () => current, placeMarkers, clearActive, render };
  }

  function boot() {
    /* 설정 자가 진단 — ID는 자유 형식(불투명 문자열)이지만, 깨진 참조는 조용히 오동작하므로 경고 */
    const seen = {};
    SCREENS.forEach((s) => {
      if (seen[s.id]) console.warn("[ScreenSpec] 화면 ID 중복: " + s.id + " — 뒤의 화면은 목차·이동에서 무시됩니다");
      seen[s.id] = 1;
    });
    SCREENS.forEach((sc) => (sc.specs || []).forEach((sp) => {
      if (sp.flowTo && !SCREENS.some((x) => x.id === sp.flowTo))
        console.warn("[ScreenSpec] " + sc.id + " n=" + sp.n + ": flowTo \"" + sp.flowTo + "\" 화면이 screens에 없습니다 — 이동 버튼이 동작하지 않습니다");
    }));
    /* 모드 결정: 명시 > 프레임워크 자동 감지 > wrap */
    const isFramework = !!(window.next || document.querySelector("#__next,[data-reactroot],script#__NEXT_DATA__"));
    const mode = RAW.mode || (isFramework ? "overlay" : "wrap");
    if (mode === "overlay") bootOverlay();
    else bootWrap();
  }

  /* ============================================================
     wrap 모드 — 단일 HTML: 본문을 기기 뷰포트 시트로 감싼다
     ============================================================ */
  function bootWrap() {
    document.body.classList.add("ss-wrap");
    injectCSS();

    /* ---- 프로토타입 본문을 시트로 감싸기 ---- */
    const sheet = h("div", { class: "ss-sheet" });
    const keep = [];
    Array.from(document.body.childNodes).forEach((n) => {
      if (n.nodeType === 1 && (n.tagName === "SCRIPT" || n.tagName === "STYLE")) return;
      if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute("data-ss-ignore")) return;
      keep.push(n);
    });
    keep.forEach((n) => sheet.appendChild(n));

    const annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    annoSvg.setAttribute("class", "ss-anno");
    annoSvg.innerHTML =
      `<defs><marker id="ss-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${ACCENT}"></path></marker></defs><line id="ss-line" x1="0" y1="0" x2="0" y2="0" stroke="${ACCENT}" stroke-width="2" marker-end="url(#ss-arrowhead)" visibility="hidden"></line>`;
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
          <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.10</div>
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
      if (m === "doc") docHolder.appendChild(frame);
      else { protoHolder.appendChild(frame); frame.style.transform = ""; }
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

    /* ---- 공통 코어 (좌표계 = 시트 내부 스크롤 + 축소 배율) ---- */
    const core = createCore({
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
      centerOf: (t) => {
        const sr = sheet.getBoundingClientRect();
        const r = t.getBoundingClientRect();
        return {
          cx: (r.left + r.width / 2 - sr.left) / scale + sheet.scrollLeft,
          cy: (r.top + r.height / 2 - sr.top) / scale + sheet.scrollTop,
          halfW: r.width / scale / 2
        };
      },
      ensureDoc: () => { if (document.body.classList.contains("ss-mode-proto")) setMode("doc"); },
      isDoc: () => document.body.classList.contains("ss-mode-doc"),
      afterRender: () => requestAnimationFrame(layout)
    });

    /* ---- 다중 화면 자동 감지 (root 표시/숨김 추적) ---- */
    function detectScreen() {
      if (SCREENS.length < 2) return;
      for (const sc of SCREENS) {
        if (!sc.root) continue;
        const el = document.querySelector(sc.root);
        if (el && el.getClientRects().length > 0) {
          core.setScreen(sc.id);
          return;
        }
      }
    }
    if (SCREENS.length > 1) {
      let detTimer = null;
      new MutationObserver(() => {
        clearTimeout(detTimer);
        detTimer = setTimeout(detectScreen, 80);
      }).observe(sheet, { subtree: true, attributes: true, childList: true, attributeFilter: ["style", "class", "hidden"] });
    }

    /* ---- 재배치 트리거 ---- */
    window.addEventListener("resize", layout);
    document.querySelectorAll("img").forEach((im) => im.addEventListener("load", layout));
    document.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => requestAnimationFrame(layout)));
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(core.placeMarkers)).observe(sheet);

    /* ---- 공개 API ---- */
    window.ScreenSpec = { setScreen: core.setScreen, refresh: layout, current: () => core.current().id, mode: "wrap" };
    window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */

    core.setCurrent(SCREENS[0]);
    applySize(DEVICES.mobile.w, DEVICES.mobile.h);
    console.info("[ScreenSpec v0.10] wrap 모드 · 화면 " + SCREENS.length + "개 등록");
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
    const panel = h("aside", { class: "ss-ui ss-ov-panel", "aria-label": "기능 설명" }, `
      <div class="ss-defs-head"><h2>기능 설명</h2><span class="ss-cnt" id="ss-ovCnt"></span></div>
      <div class="ss-defs-list" id="ss-ovList"></div>
      <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.10</div>`);
    const markerLayer = h("div", { class: "ss-ov-markers" });
    const annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    annoSvg.setAttribute("class", "ss-ov-anno");
    annoSvg.innerHTML =
      `<defs><marker id="ss-ov-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${ACCENT}"></path></marker></defs><line id="ss-ov-line" x1="0" y1="0" x2="0" y2="0" stroke="${ACCENT}" stroke-width="2" marker-end="url(#ss-ov-arrowhead)" visibility="hidden"></line>`;
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
      headerEl: header,
      cntEl: panel.querySelector("#ss-ovCnt"),
      listEl: panel.querySelector("#ss-ovList"),
      markerLayer: markerLayer,
      tip: tip,
      annoLine: annoSvg.querySelector("#ss-ov-line"),
      posOf: (t) => {
        const r = t.getBoundingClientRect();
        return { left: r.left + scrollX, top: r.top + scrollY, transform: "translate(-40%,-40%)" };
      },
      centerOf: (t) => {
        const r = t.getBoundingClientRect();
        return { cx: r.left + r.width / 2 + scrollX, cy: r.top + r.height / 2 + scrollY, halfW: r.width / 2 };
      },
      ensureDoc: () => { if (!document.body.classList.contains("ss-ov-doc")) setMode("doc"); },
      isDoc: () => document.body.classList.contains("ss-ov-doc"),
      afterRender: () => requestAnimationFrame(place)
    });

    /* ---- 화면 감지: 라우트 우선(exact → suffix → 경계 prefix), 없으면 컨테이너 표시 여부 ---- */
    function detectScreen() {
      const routed = SCREENS.filter((s) => s.route);
      if (routed.length) {
        /* 해시 라우터(#/members)면 # 뒤를 경로로 사용 — 일반 책갈피(#section)는 해당 없음 */
        const p = location.hash.indexOf("#/") === 0 ? location.hash.slice(1).split("?")[0] : location.pathname;
        let hit = routed.find((s) => routeToRe(s.route).test(p));
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
        const cur = core.current();
        core.setCurrent(hit || (cur && cur._unmapped && cur._path === p ? cur : unmappedScreen(p)));
        return;
      }
      for (const sc of SCREENS) {
        if (!sc.root) continue;
        const el = document.querySelector(sc.root);
        if (el && el.getClientRects().length > 0) {
          core.setScreen(sc.id);
          return;
        }
      }
    }
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
    console.info("[ScreenSpec v0.10] overlay 모드 · 화면 " + SCREENS.length + "개 등록 · 미등록 화면은 '정의되지 않은 화면'으로 표시");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
