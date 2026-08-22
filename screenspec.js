/*!
 * ScreenSpec v0.4 — 프로토타입 자체가 화면정의서가 되는 오버레이
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
 * 반응형 훅: 시트 폭에 따라 .ss-pc(≥1100px) / .ss-narrow(≤520px)가 시트에 붙는다.
 * 프로토타입 CSS는 미디어쿼리 대신 이 훅으로 분기.
 *
 * z-index 스케일 (프로토타입은 이 대역을 지킬 것):
 *      0 ~ 7999  프로토타입 자유 영역 (시트 내부 콘텐츠)
 *   8000 ~ 8099  ScreenSpec 시트 오버레이 — anno 8030 · markers 8040 · resize 8050
 *   9000 ~ 9099  ScreenSpec 크롬 — docmode 9000 · toolbar 9020 · tip 9040
 *   9500 이상    프로토타입 전역 오버레이 (data-ss-ignore 모달·토스트) — 모든 것 위 (의도)
 *
 * 크기 시뮬레이터 (DevTools 벤치마크): 시트 = 기기 뷰포트(폭×높이, 내부 스크롤).
 * 프리셋 모바일 360×800 · PC 1920×1080 + 우측/하단/코너 드래그. 프리셋 클릭 = 복귀.
 */
(function () {
  "use strict";
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

  /* ============ 디자인 시스템 ============
     1. 토큰: 색·서체는 --ss-* 변수로만 사용 (하드코딩 금지)
     2. 리셋: :where()로 특이도 0 — 컴포넌트 클래스가 항상 이긴다
     3. 컴포넌트: 단일 클래스(.ss-play, .ss-marker ...)가 형태·색을 완결 정의
     4. 포인트 컬러(--ss-accent) 위에는 항상 흰 텍스트 */
  const CSS = `
  :root{--ss-canvas:#F1F1F0;--ss-ink:#191919;--ss-ink2:#50524E;--ss-ink3:#9B9A97;
    --ss-line:#E9E9E7;--ss-line2:#D3D1CB;--ss-accent:#2952E3;--ss-accent-soft:#EEF2FF;
    --ss-mono:ui-monospace,"Cascadia Code",Consolas,monospace}
  body{margin:0;background:var(--ss-canvas)}
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
    box-shadow:0 2px 8px rgba(41,82,227,.35);transition:background .12s}
  .ss-play:hover{background:#1E3FC4}
  .ss-play:active{transform:translateY(1px)}
  .ss-frame{position:relative}
  .ss-sheet{position:relative;background:#fff;border-radius:14px;overflow:auto;
    box-shadow:0 1px 3px rgba(17,24,39,.08),0 16px 44px rgba(17,24,39,.10);padding:28px 24px 40px}
  .ss-sheet.ss-narrow{padding:20px 14px 32px}
  /* DevTools식 리사이즈: 우측 바(폭) + 하단 바(높이) + 코너(양방향) */
  .ss-edge{position:absolute;z-index:8050}
  .ss-edge-r{top:0;right:-16px;width:16px;height:100%;cursor:ew-resize}
  .ss-edge-b{left:0;bottom:-16px;width:100%;height:16px;cursor:ns-resize}
  .ss-edge-c{right:-16px;bottom:-16px;width:20px;height:20px;cursor:nwse-resize}
  .ss-edge-r::after{content:"";position:absolute;top:50%;left:5px;transform:translateY(-50%);
    width:5px;height:48px;border-radius:99px;background:#C6C4BD;box-shadow:0 1px 3px rgba(17,24,39,.15);transition:background .15s}
  .ss-edge-b::after{content:"";position:absolute;left:50%;top:5px;transform:translateX(-50%);
    height:5px;width:48px;border-radius:99px;background:#C6C4BD;box-shadow:0 1px 3px rgba(17,24,39,.15);transition:background .15s}
  .ss-edge-c::after{content:"";position:absolute;right:3px;bottom:3px;width:10px;height:10px;
    border-right:3px solid #C6C4BD;border-bottom:3px solid #C6C4BD;border-radius:2px;transition:border-color .15s}
  .ss-edge-r:hover::after,.ss-edge-r.ss-dragging::after,
  .ss-edge-b:hover::after,.ss-edge-b.ss-dragging::after{background:var(--ss-accent)}
  .ss-edge-c:hover::after,.ss-edge-c.ss-dragging::after{border-color:var(--ss-accent)}
  /* 마커 — 흰 배경 + 검은 숫자, 활성 시 포인트색 배경 + 흰 숫자 (v0.2 가독성 수정) */
  .ss-marker{
    position:absolute;width:24px;height:24px;border-radius:50%;pointer-events:auto;padding:0;
    background:#fff;color:var(--ss-ink);border:1.5px solid var(--ss-line2);
    font-size:12px;font-weight:800;font-family:var(--ss-mono);
    display:grid;place-items:center;box-shadow:0 2px 8px rgba(17,24,39,.28);cursor:pointer}
  .ss-marker.ss-hot{background:var(--ss-accent);color:#fff;border-color:var(--ss-accent)}
  .ss-markers,.ss-anno{position:absolute;top:0;left:0;width:100%;height:100%;z-index:8040;pointer-events:none}
  .ss-anno{z-index:8030;overflow:visible}
  body.ss-mode-proto .ss-marker,body.ss-mode-proto .ss-anno{display:none}
  .ss-hl{box-shadow:0 0 0 2px var(--ss-accent),0 0 0 6px rgba(41,82,227,.15)!important;border-radius:12px}
  .ss-tip{position:fixed;z-index:9040;max-width:280px;background:#fff;border:1px solid var(--ss-line2);
    border-radius:10px;box-shadow:0 10px 30px rgba(17,24,39,.18);padding:10px 13px;display:none;pointer-events:none}
  .ss-tip .ss-tn{font-family:var(--ss-mono);font-size:10px;font-weight:800;color:var(--ss-accent)}
  .ss-tip .ss-tt{font-size:13px;font-weight:800;margin:2px 0 3px;color:var(--ss-ink)}
  .ss-tip .ss-td{font-size:12px;color:var(--ss-ink2)}
  @media (prefers-reduced-motion: reduce){.ss-ui *{transition:none!important}}
  `;

  function h(tag, attrs, html) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (html != null) el.innerHTML = html;
    return el;
  }

  function boot() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

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
      '<defs><marker id="ss-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
      '<path d="M0,0 L8,4 L0,8 Z" fill="#2952E3"></path></marker></defs>' +
      '<line id="ss-line" x1="0" y1="0" x2="0" y2="0" stroke="#2952E3" stroke-width="2" marker-end="url(#ss-arrowhead)" visibility="hidden"></line>';
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
        <aside class="ss-defs" aria-label="기능정의">
          <div class="ss-defs-head"><h2>기능정의</h2><span class="ss-cnt" id="ss-cnt"></span></div>
          <div class="ss-defs-list" id="ss-defsList"></div>
          <div class="ss-badge">Made with <a href="https://github.com/charmisuk/screenspec" target="_blank" rel="noopener">ScreenSpec</a> · v0.4</div>
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
    const dhWrap = document.getElementById("ss-dh-wrap");
    const cntEl = document.getElementById("ss-cnt");
    const defsList = document.getElementById("ss-defsList");
    const wpx = document.getElementById("ss-wpx");
    const annoLine = annoSvg.querySelector("#ss-line");
    protoHolder.appendChild(frame);
    document.body.classList.add("ss-mode-proto");

    /* ---- 현재 화면 상태 ---- */
    let current = SCREENS[0];
    let activeN = null;
    let markerEls = {};

    function rootEl() {
      return current.root ? document.querySelector(current.root) || document : document;
    }
    function targetOf(s) {
      const r = rootEl();
      return (r.querySelector ? r : document).querySelector('[data-spec="' + s.target + '"]');
    }

    /* ---- 화면별 렌더 ---- */
    function renderHeader() {
      const pathHtml = (current.path || []).map((p) => "<span>" + p + "</span>").join('<span class="ss-sep">›</span>');
      dhWrap.innerHTML = `
        <div class="ss-dh"><span class="ss-k">화면 ID</span><span class="ss-v ss-monoV">${current.id}</span></div>
        <div class="ss-dh"><span class="ss-k">화면명</span><span class="ss-v">${current.name}</span></div>
        ${pathHtml ? `<div class="ss-dh"><span class="ss-k">화면 경로</span><span class="ss-v">${pathHtml}</span></div>` : ""}`;
    }
    function renderDefs() {
      cntEl.textContent = (current.specs || []).length + "항목";
      defsList.innerHTML = "";
      (current.specs || []).forEach((s) => {
        let items = "";
        (s.defs || []).forEach((d) => {
          items += "<li>" + d.t + "</li>";
          (d.subs || []).forEach((sub) => { items += '<li class="ss-sub">' + sub + "</li>"; });
        });
        const type = annoOf(s);
        let play = "";
        if (type.mech === "play" && s.play)
          play = '<button class="ss-play" data-play="' + s.n + '">▶ ' + (s.play.label || (s.anno === "popup" ? "팝업 열기" : "동작 재생")) + "</button>";
        else if (type.mech === "flow" && (s.flowTo || s.play))
          play = '<button class="ss-play" data-play="' + s.n + '">▶ ' + ((s.play && s.play.label) || "이동 — " + s.flowTo) + "</button>";
        const row = h("div", { class: "ss-row", id: "ss-def-" + s.n, tabindex: "0" }, `
          <div class="ss-no">${s.n}</div>
          <div class="ss-main">
            <div class="ss-title"><span class="ss-t">${s.title}</span><span class="ss-tag">${type.label}</span></div>
            <ul class="ss-items">${items}</ul>${play}
          </div>`);
        row.onclick = () => activate(s.n, "panel");
        row.onkeydown = (e) => { if (e.key === "Enter") activate(s.n, "panel"); };
        defsList.appendChild(row);
      });
    }
    function rebuildMarkers() {
      markerLayer.innerHTML = "";
      markerEls = {};
      (current.specs || []).forEach((s) => {
        const el = h("button", { class: "ss-ui ss-marker", "aria-label": "기능 " + s.n + ": " + s.title });
        el.textContent = s.n;
        el.onclick = (e) => { e.stopPropagation(); activate(s.n, "marker"); };
        el.onmouseenter = () => showTip(s, el);
        el.onmouseleave = () => (tip.style.display = "none");
        markerLayer.appendChild(el);
        markerEls[s.n] = el;
      });
    }
    function renderScreen() {
      renderHeader();
      renderDefs();
      rebuildMarkers();
      requestAnimationFrame(layout);
    }
    function setScreen(id) {
      const next = SCREENS.find((s) => s.id === id);
      if (!next || next === current) return;
      clearActive();
      current = next;
      renderScreen();
    }

    /* ---- 다중 화면 자동 감지 (root 표시/숨김 추적) ---- */
    function detectScreen() {
      if (SCREENS.length < 2) return;
      for (const sc of SCREENS) {
        if (!sc.root) continue;
        const el = document.querySelector(sc.root);
        if (el && el.getClientRects().length > 0) {
          if (sc !== current) setScreen(sc.id);
          return;
        }
      }
    }
    if (SCREENS.length > 1) {
      let detTimer = null;
      const mo = new MutationObserver(() => {
        clearTimeout(detTimer);
        detTimer = setTimeout(detectScreen, 80);
      });
      mo.observe(sheet, { subtree: true, attributes: true, childList: true, attributeFilter: ["style", "class", "hidden"] });
    }

    /* ---- 크기: 프리셋 2(폭×높이) + DevTools식 드래그 3핸들, 프리셋 클릭 = 복귀 ---- */
    let sheetW = DEVICES.mobile.w;
    let sheetH = DEVICES.mobile.h;
    let scale = 1;
    function applySize(w, hgt) {
      sheetW = Math.max(320, Math.min(2200, Math.round(w)));
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
        el.setPointerCapture(e.pointerId);
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
      clearActive();
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
      /* 드래그 핸들은 축소 배율과 무관하게 잡히는 폭 유지 */
      edgeR.style.width = Math.round(16 / scale) + "px";
      edgeR.style.right = "-" + Math.round(16 / scale) + "px";
      edgeB.style.height = Math.round(16 / scale) + "px";
      edgeB.style.bottom = "-" + Math.round(16 / scale) + "px";
      placeMarkers();
    }

    /* ---- 마커 배치 (시트 내부 스크롤 좌표계) ---- */
    function placeMarkers() {
      const sr = sheet.getBoundingClientRect();
      (current.specs || []).forEach((s) => {
        const t = targetOf(s), m = markerEls[s.n];
        if (!m) return;
        if (!t || t.getClientRects().length === 0) { m.style.display = "none"; return; }
        m.style.display = "";
        const r = t.getBoundingClientRect();
        m.style.left = (r.left - sr.left) / scale + sheet.scrollLeft + "px";
        m.style.top = (r.top - sr.top) / scale + sheet.scrollTop + "px";
        m.style.transform = "translate(-40%,-40%) scale(" + 1 / scale + ")";
      });
      drawArrow();
    }
    function showTip(s, m) {
      tip.innerHTML =
        '<div class="ss-tn">NO.' + s.n + " · " + annoOf(s).label + "</div>" +
        '<div class="ss-tt">' + s.title + "</div>" +
        '<div class="ss-td">' + ((s.defs && s.defs[0] && s.defs[0].t) || "") + "</div>";
      tip.style.display = "block";
      const r = m.getBoundingClientRect();
      const w = Math.min(280, innerWidth - 24);
      let left = r.left + 16;
      if (left + w > innerWidth - 12) left = innerWidth - w - 12;
      tip.style.left = left + "px";
      tip.style.top = r.bottom + 8 + "px";
    }

    /* ---- 화살표 (anno: arrow) ---- */
    function drawArrow() {
      const s = (current.specs || []).find((x) => x.n === activeN);
      if (!s || annoOf(s).mech !== "arrow") { annoLine.setAttribute("visibility", "hidden"); return; }
      const t = targetOf(s);
      if (!t) return;
      const sr = sheet.getBoundingClientRect();
      const r = t.getBoundingClientRect();
      const cx = (r.left + r.width / 2 - sr.left) / scale + sheet.scrollLeft;
      const cy = (r.top + r.height / 2 - sr.top) / scale + sheet.scrollTop;
      annoLine.setAttribute("x1", cx - 120); annoLine.setAttribute("y1", cy + 80);
      annoLine.setAttribute("x2", cx - r.width / scale / 2 - 8); annoLine.setAttribute("y2", cy + 8);
      annoLine.setAttribute("visibility", "visible");
    }

    /* ---- play/flow 버튼: 실제 동작 재생 · 화면 이동 ---- */
    defsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-play]");
      if (!btn) return;
      e.stopPropagation();
      const s = (current.specs || []).find((x) => x.n === Number(btn.dataset.play));
      if (!s) return;
      activate(s.n, "panel");
      if (s.play && s.play.selector) {
        const el = document.querySelector(s.play.selector);
        if (el) el.click(); /* flow는 실제 내비 클릭 → 화면 감지가 헤더·정의를 자동 전환 */
      } else if (annoOf(s).mech === "flow" && s.flowTo) {
        setScreen(s.flowTo);
      }
    });

    /* ---- 양방향 연결 ---- */
    function clearActive() {
      if (activeN == null) return;
      const s = (current.specs || []).find((x) => x.n === activeN);
      if (s) { const t = targetOf(s); if (t) t.classList.remove("ss-hl"); }
      if (markerEls[activeN]) markerEls[activeN].classList.remove("ss-hot");
      const row = document.getElementById("ss-def-" + activeN);
      if (row) row.classList.remove("ss-active");
      activeN = null;
      drawArrow();
    }
    function activate(n, from) {
      if (document.body.classList.contains("ss-mode-proto")) setMode("doc");
      clearActive();
      activeN = n;
      const s = (current.specs || []).find((x) => x.n === n);
      if (!s) return;
      const t = targetOf(s);
      if (t) t.classList.add("ss-hl");
      if (markerEls[n]) markerEls[n].classList.add("ss-hot");
      const row = document.getElementById("ss-def-" + n);
      if (row) row.classList.add("ss-active");
      if (from === "panel" && t) t.scrollIntoView({ block: "center", behavior: "smooth" });
      if (from === "marker" && row) row.scrollIntoView({ block: "center", behavior: "smooth" });
      drawArrow();
    }

    /* ---- 재배치 트리거 ---- */
    window.addEventListener("resize", layout);
    document.querySelectorAll("img").forEach((im) => im.addEventListener("load", layout));
    document.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => requestAnimationFrame(layout)));
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(placeMarkers)).observe(sheet);

    /* ---- 공개 API ---- */
    window.ScreenSpec = { setScreen: setScreen, refresh: layout, current: () => current.id };
    window.SpecLayer = window.ScreenSpec; /* 구명칭 호환 */

    renderScreen();
    applySize(DEVICES.mobile.w, DEVICES.mobile.h);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
