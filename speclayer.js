/*!
 * SpecLayer v0.1 — 프로토타입 자체가 화면정의서가 되는 오버레이
 *
 * 사용법:
 *   1) 프로토타입 HTML의 주요 영역에 data-spec="1" 형태로 번호 부여
 *   2) window.SPECLAYER 설정 정의 (화면 메타 + 기능정의)
 *   3) 이 스크립트를 <body> 마지막에 로드
 *
 * window.SPECLAYER = {
 *   screen: { id:"SCR-XXX-001", name:"화면명", path:["홈","메뉴","상세"] },
 *   widths: { mobile:430, pc:1440 },          // 선택 (기본값 그대로면 생략)
 *   specs: [{
 *     n:1, target:"1", anno:"box"|"arrow"|"action", title:"영역명",
 *     defs:[{ t:"기능정의 한 줄", subs:["하위 조건"] }],
 *     play:{ selector:"#btn", label:"동작 재생" }   // anno:"action"일 때
 *   }]
 * }
 *
 * 반응형 훅: 라이브러리가 시트 폭에 따라 .sl-pc(≥1100px) / .sl-narrow(≤520px)
 * 클래스를 시트에 부여한다. 프로토타입 CSS는 미디어쿼리 대신 이 훅으로 분기.
 */
(function () {
  "use strict";
  const CFG = window.SPECLAYER || {};
  const SCREEN = CFG.screen || { id: "SCR-000", name: "화면명 미정", path: [] };
  const SPECS = CFG.specs || [];
  const WIDTHS = Object.assign({ mobile: 430, pc: 1440 }, CFG.widths || {});
  const ANNO_LABEL = { box: "영역", arrow: "화살표", action: "동작" };

  /* ============ 스타일 주입 (그레이스케일 + 포인트 1색) ============ */
  const CSS = `
  :root{--sl-canvas:#F1F1F0;--sl-ink:#191919;--sl-ink2:#50524E;--sl-ink3:#9B9A97;
    --sl-line:#E9E9E7;--sl-line2:#D3D1CB;--sl-accent:#2952E3;--sl-accent-soft:#EEF2FF;
    --sl-mono:ui-monospace,"Cascadia Code",Consolas,monospace}
  body{margin:0;background:var(--sl-canvas)}
  .sl-ui,.sl-ui *{box-sizing:border-box;font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic","Apple SD Gothic Neo",sans-serif}
  .sl-ui button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
  .sl-toolbar{position:fixed;top:0;left:0;right:0;z-index:9060;height:50px;background:#fff;
    border-bottom:1px solid var(--sl-line2);display:flex;align-items:center;gap:14px;padding:0 16px}
  .sl-modes{display:flex;border:1px solid var(--sl-line2);border-radius:9px;padding:2px;gap:2px;background:#FAFAF9}
  .sl-modes button{padding:6px 16px;border-radius:7px;font-size:13px;font-weight:700;color:var(--sl-ink2)}
  .sl-modes button[aria-pressed="true"]{background:var(--sl-ink);color:#fff}
  .sl-widthsim{margin-left:auto;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sl-ink2)}
  .sl-widthsim .sl-seg{display:flex;border:1px solid var(--sl-line2);border-radius:8px;padding:2px;gap:2px;background:#FAFAF9}
  .sl-widthsim .sl-seg button{padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;color:var(--sl-ink2)}
  .sl-widthsim .sl-seg button[aria-pressed="true"]{background:#fff;color:var(--sl-ink);box-shadow:0 1px 2px rgba(17,24,39,.12)}
  .sl-wpx{font-family:var(--sl-mono);font-size:11px;color:var(--sl-ink3);min-width:52px;text-align:right}
  @media(max-width:640px){.sl-wpx{display:none}}
  .sl-proto-wrap{padding:74px 16px 60px;overflow-x:auto}
  body.sl-mode-doc .sl-proto-wrap{display:none}
  .sl-holder{margin:0 auto;width:max-content}
  .sl-docmode{display:none}
  body.sl-mode-doc .sl-docmode{display:flex;flex-direction:column;position:fixed;top:50px;left:0;right:0;bottom:0;z-index:9050}
  .sl-doc-header{background:#fff;border-bottom:1px solid var(--sl-line2);padding:12px 24px;display:flex;align-items:flex-start;gap:36px;flex-wrap:wrap}
  .sl-dh .sl-k{font-size:10.5px;font-weight:700;color:var(--sl-ink3);letter-spacing:.06em;display:block;margin-bottom:1px}
  .sl-dh .sl-v{font-size:14px;font-weight:800;color:var(--sl-ink)}
  .sl-dh .sl-v.sl-monoV{font-family:var(--sl-mono);font-size:13px}
  .sl-dh .sl-sep{color:var(--sl-ink3);font-weight:400;margin:0 4px}
  .sl-doc-body{flex:1;display:flex;min-height:0;background:var(--sl-canvas)}
  .sl-stage{flex:1;min-width:0;overflow:auto;padding:24px}
  .sl-fit{position:relative;margin:0 auto;transition:width .15s,height .15s}
  .sl-defs{width:460px;flex-shrink:0;background:#fff;border-left:1px solid var(--sl-line2);display:flex;flex-direction:column;min-height:0}
  .sl-defs-head{padding:12px 18px;border-bottom:1px solid var(--sl-line);display:flex;align-items:center;gap:8px}
  .sl-defs-head h2{font-size:13px;font-weight:800;margin:0;color:var(--sl-ink)}
  .sl-defs-head .sl-cnt{font-family:var(--sl-mono);font-size:11px;color:var(--sl-ink3);font-weight:700}
  .sl-defs-list{flex:1;overflow-y:auto}
  @media(max-width:1000px){
    body.sl-mode-doc .sl-docmode{position:static;display:block;padding-top:50px}
    .sl-doc-body{display:block}.sl-stage{overflow:visible}
    .sl-defs{width:100%;border-left:0;border-top:1px solid var(--sl-line2)}
  }
  .sl-row{display:flex;border-bottom:1px solid var(--sl-line);cursor:pointer;transition:background .12s}
  .sl-row:hover{background:#FAFAF9}
  .sl-row.sl-active{background:var(--sl-accent-soft)}
  .sl-no{width:46px;flex-shrink:0;display:flex;justify-content:center;padding-top:15px;
    font-family:var(--sl-mono);font-size:13px;font-weight:800;color:var(--sl-ink3)}
  .sl-row.sl-active .sl-no{color:var(--sl-accent)}
  .sl-main{flex:1;padding:13px 16px 14px 0;min-width:0}
  .sl-title{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .sl-title .sl-t{font-size:13.5px;font-weight:800;color:var(--sl-ink)}
  .sl-title .sl-tag{font-size:10px;font-weight:700;color:var(--sl-ink3);border:1px solid var(--sl-line2);border-radius:5px;padding:1px 6px;margin-left:auto;flex-shrink:0}
  .sl-row.sl-active .sl-tag{color:var(--sl-accent);border-color:var(--sl-accent)}
  .sl-items{margin:0;padding:0;list-style:none}
  .sl-items li{font-size:12.5px;color:#37352F;position:relative;padding-left:16px;margin:4px 0;line-height:1.6}
  .sl-items li::before{content:"";position:absolute;left:3px;top:.62em;width:5px;height:5px;border-radius:50%;background:var(--sl-ink)}
  .sl-items li.sl-sub{margin-left:18px}
  .sl-items li.sl-sub::before{background:#fff;border:1.3px solid var(--sl-ink2);left:2px}
  .sl-play{margin:9px 0 0 16px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;
    color:var(--sl-accent);border:1px solid var(--sl-accent);border-radius:7px;padding:5px 12px;background:#fff}
  .sl-play:hover{background:var(--sl-accent-soft)}
  .sl-sheet{position:relative;background:#fff;border-radius:16px;
    box-shadow:0 1px 3px rgba(17,24,39,.08),0 16px 44px rgba(17,24,39,.10);padding:28px 24px 40px}
  .sl-sheet.sl-narrow{padding:20px 14px 32px}
  .sl-resize{position:absolute;top:0;right:-14px;width:14px;height:100%;cursor:ew-resize;display:flex;align-items:center;justify-content:center}
  .sl-resize::after{content:"";width:4px;height:44px;border-radius:99px;background:var(--sl-line2);transition:background .15s}
  .sl-resize:hover::after,.sl-resize.sl-dragging::after{background:var(--sl-accent)}
  body.sl-mode-doc .sl-resize{display:none}
  .sl-markers,.sl-anno{position:absolute;top:0;left:0;width:100%;height:100%;z-index:8040;pointer-events:none}
  .sl-anno{z-index:8039;overflow:visible}
  .sl-marker{position:absolute;width:23px;height:23px;border-radius:50%;pointer-events:auto;
    background:var(--sl-ink);color:#fff;font-size:12px;font-weight:800;font-family:var(--sl-mono);
    display:grid;place-items:center;box-shadow:0 0 0 2.5px #fff,0 2px 8px rgba(17,24,39,.35);border:0;cursor:pointer}
  .sl-marker.sl-hot{background:var(--sl-accent)}
  body.sl-mode-proto .sl-marker,body.sl-mode-proto .sl-anno{display:none}
  .sl-hl{box-shadow:0 0 0 2px var(--sl-accent),0 0 0 6px rgba(41,82,227,.15)!important;border-radius:12px}
  .sl-tip{position:fixed;z-index:9065;max-width:280px;background:#fff;border:1px solid var(--sl-line2);
    border-radius:10px;box-shadow:0 10px 30px rgba(17,24,39,.18);padding:10px 13px;display:none;pointer-events:none}
  .sl-tip .sl-tn{font-family:var(--sl-mono);font-size:10px;font-weight:800;color:var(--sl-accent)}
  .sl-tip .sl-tt{font-size:13px;font-weight:800;margin:2px 0 3px;color:var(--sl-ink)}
  .sl-tip .sl-td{font-size:12px;color:var(--sl-ink2)}
  @media (prefers-reduced-motion: reduce){.sl-ui *{transition:none!important}}
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
    const sheet = h("div", { class: "sl-sheet" });
    const keep = [];
    Array.from(document.body.childNodes).forEach((n) => {
      if (n.nodeType === 1 && (n.tagName === "SCRIPT" || n.tagName === "STYLE")) return;
      if (n.nodeType === 1 && n.hasAttribute && n.hasAttribute("data-sl-ignore")) return;
      keep.push(n);
    });
    keep.forEach((n) => sheet.appendChild(n));

    /* 오버레이 레이어 */
    const annoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    annoSvg.setAttribute("class", "sl-anno");
    annoSvg.innerHTML =
      '<defs><marker id="sl-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
      '<path d="M0,0 L8,4 L0,8 Z" fill="#2952E3"></path></marker></defs>' +
      '<line id="sl-line" x1="0" y1="0" x2="0" y2="0" stroke="#2952E3" stroke-width="2" marker-end="url(#sl-arrowhead)" visibility="hidden"></line>';
    const markerLayer = h("div", { class: "sl-markers" });
    const resize = h("div", { class: "sl-resize", title: "드래그로 폭 조절" });
    sheet.appendChild(annoSvg);
    sheet.appendChild(markerLayer);
    sheet.appendChild(resize);

    /* ---- 툴바 (로고 없음: 모드 + 폭 프리셋 2개) ---- */
    const toolbar = h("header", { class: "sl-toolbar sl-ui" }, `
      <nav class="sl-modes" aria-label="보기 모드">
        <button id="sl-mProto" aria-pressed="true">프로토타입</button>
        <button id="sl-mDoc" aria-pressed="false">화면정의서</button>
      </nav>
      <div class="sl-widthsim">
        <div class="sl-seg" id="sl-seg">
          <button data-w="mobile" aria-pressed="true">모바일</button>
          <button data-w="pc" aria-pressed="false">PC</button>
        </div>
        <span class="sl-wpx" id="sl-wpx"></span>
      </div>`);

    /* ---- 화면정의서 모드 ---- */
    const pathHtml = (SCREEN.path || [])
      .map((p) => `<span>${p}</span>`)
      .join('<span class="sl-sep">›</span>');
    const docmode = h("div", { class: "sl-docmode sl-ui" }, `
      <div class="sl-doc-header">
        <div class="sl-dh"><span class="sl-k">화면 ID</span><span class="sl-v sl-monoV">${SCREEN.id}</span></div>
        <div class="sl-dh"><span class="sl-k">화면명</span><span class="sl-v">${SCREEN.name}</span></div>
        ${pathHtml ? `<div class="sl-dh"><span class="sl-k">화면 경로</span><span class="sl-v">${pathHtml}</span></div>` : ""}
      </div>
      <div class="sl-doc-body">
        <div class="sl-stage" id="sl-stage"><div class="sl-fit" id="sl-fit"><div class="sl-holder" id="sl-docHolder"></div></div></div>
        <aside class="sl-defs" aria-label="기능정의">
          <div class="sl-defs-head"><h2>기능정의</h2><span class="sl-cnt">${SPECS.length}항목</span></div>
          <div class="sl-defs-list" id="sl-defsList"></div>
        </aside>
      </div>`);

    const protoWrap = h("div", { class: "sl-proto-wrap sl-ui" }, '<div class="sl-holder" id="sl-protoHolder"></div>');
    const tip = h("div", { class: "sl-tip sl-ui", role: "tooltip" });
    document.body.appendChild(toolbar);
    document.body.appendChild(protoWrap);
    document.body.appendChild(docmode);
    document.body.appendChild(tip);

    const protoHolder = document.getElementById("sl-protoHolder");
    const docHolder = document.getElementById("sl-docHolder");
    const stage = document.getElementById("sl-stage");
    const fit = document.getElementById("sl-fit");
    const annoLine = annoSvg.querySelector("#sl-line");
    protoHolder.appendChild(sheet);
    document.body.classList.add("sl-mode-proto");

    /* ---- 폭: 프리셋 2 + 우측 드래그, 프리셋 클릭 = 기본값 복귀 ---- */
    let sheetW = WIDTHS.mobile;
    let scale = 1;
    const wpx = document.getElementById("sl-wpx");
    function applyWidth(px) {
      sheetW = Math.max(320, Math.min(1920, Math.round(px)));
      sheet.style.width = sheetW + "px";
      sheet.classList.toggle("sl-pc", sheetW >= 1100);
      sheet.classList.toggle("sl-narrow", sheetW <= 520);
      wpx.textContent = sheetW + "px";
      requestAnimationFrame(layout);
    }
    const seg = document.getElementById("sl-seg");
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      applyWidth(WIDTHS[btn.dataset.w]);
    });
    /* 드래그 리사이즈 (프로토타입 모드) */
    let dragging = null;
    resize.addEventListener("pointerdown", (e) => {
      dragging = { x: e.clientX, w: sheetW };
      resize.classList.add("sl-dragging");
      resize.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    resize.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      applyWidth(dragging.w + (e.clientX - dragging.x) * 2); /* 중앙정렬이라 양쪽 성장 보정 */
    });
    ["pointerup", "pointercancel"].forEach((ev) =>
      resize.addEventListener(ev, () => { dragging = null; resize.classList.remove("sl-dragging"); }));

    /* ---- 모드 전환 ---- */
    const mProto = document.getElementById("sl-mProto");
    const mDoc = document.getElementById("sl-mDoc");
    function setMode(m) {
      document.body.classList.remove("sl-mode-proto", "sl-mode-doc");
      document.body.classList.add("sl-mode-" + m);
      mProto.setAttribute("aria-pressed", String(m === "proto"));
      mDoc.setAttribute("aria-pressed", String(m === "doc"));
      clearActive();
      if (m === "doc") docHolder.appendChild(sheet);
      else { protoHolder.appendChild(sheet); sheet.style.transform = ""; }
      requestAnimationFrame(layout);
    }
    mProto.onclick = () => setMode("proto");
    mDoc.onclick = () => setMode("doc");

    /* ---- 축소 배치 ---- */
    function layout() {
      if (document.body.classList.contains("sl-mode-doc")) {
        const avail = stage.clientWidth - 48;
        scale = Math.min(1, avail / sheetW);
        sheet.style.transformOrigin = "top left";
        sheet.style.transform = "scale(" + scale + ")";
        fit.style.width = sheetW * scale + "px";
        fit.style.height = sheet.offsetHeight * scale + "px";
      } else {
        scale = 1;
        sheet.style.transform = "";
        fit.style.width = ""; fit.style.height = "";
      }
      placeMarkers();
    }

    /* ---- 마커 ---- */
    const markerEls = {};
    SPECS.forEach((s) => {
      const el = h("button", { class: "sl-marker sl-ui", "aria-label": "기능 " + s.n + ": " + s.title });
      el.textContent = s.n;
      el.onclick = (e) => { e.stopPropagation(); activate(s.n, "marker"); };
      el.onmouseenter = () => showTip(s, el);
      el.onmouseleave = () => (tip.style.display = "none");
      markerLayer.appendChild(el);
      markerEls[s.n] = el;
    });
    function targetOf(s) {
      return document.querySelector('[data-spec="' + s.target + '"]');
    }
    function placeMarkers() {
      const sr = sheet.getBoundingClientRect();
      SPECS.forEach((s) => {
        const t = targetOf(s), m = markerEls[s.n];
        if (!t || !m) return;
        const r = t.getBoundingClientRect();
        m.style.left = (r.left - sr.left) / scale + "px";
        m.style.top = (r.top - sr.top) / scale + "px";
        m.style.transform = "translate(-40%,-40%) scale(" + 1 / scale + ")";
      });
      drawArrow();
    }
    function showTip(s, m) {
      tip.innerHTML =
        '<div class="sl-tn">NO.' + s.n + " · " + (ANNO_LABEL[s.anno] || s.anno) + "</div>" +
        '<div class="sl-tt">' + s.title + "</div>" +
        '<div class="sl-td">' + ((s.defs && s.defs[0] && s.defs[0].t) || "") + "</div>";
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
      const s = SPECS.find((x) => x.n === activeN);
      if (!s || s.anno !== "arrow") { annoLine.setAttribute("visibility", "hidden"); return; }
      const t = targetOf(s);
      if (!t) return;
      const sr = sheet.getBoundingClientRect();
      const r = t.getBoundingClientRect();
      const cx = (r.left + r.width / 2 - sr.left) / scale;
      const cy = (r.top + r.height / 2 - sr.top) / scale;
      annoLine.setAttribute("x1", cx - 120); annoLine.setAttribute("y1", cy + 80);
      annoLine.setAttribute("x2", cx - r.width / scale / 2 - 8); annoLine.setAttribute("y2", cy + 8);
      annoLine.setAttribute("visibility", "visible");
    }

    /* ---- 기능정의 목록 (넘버 + ● / ○ 불렛) ---- */
    const defsList = document.getElementById("sl-defsList");
    SPECS.forEach((s) => {
      let items = "";
      (s.defs || []).forEach((d) => {
        items += "<li>" + d.t + "</li>";
        (d.subs || []).forEach((sub) => { items += '<li class="sl-sub">' + sub + "</li>"; });
      });
      const play = s.anno === "action" && s.play
        ? '<button class="sl-play" data-play="' + s.n + '">▶ ' + (s.play.label || "동작 재생") + "</button>" : "";
      const row = h("div", { class: "sl-row", id: "sl-def-" + s.n, tabindex: "0" }, `
        <div class="sl-no">${s.n}</div>
        <div class="sl-main">
          <div class="sl-title"><span class="sl-t">${s.title}</span><span class="sl-tag">${ANNO_LABEL[s.anno] || s.anno}</span></div>
          <ul class="sl-items">${items}</ul>${play}
        </div>`);
      row.onclick = () => activate(s.n, "panel");
      row.onkeydown = (e) => { if (e.key === "Enter") activate(s.n, "panel"); };
      defsList.appendChild(row);
    });
    defsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-play]");
      if (!btn) return;
      e.stopPropagation();
      const s = SPECS.find((x) => x.n === Number(btn.dataset.play));
      activate(s.n, "panel");
      if (s.play && s.play.selector) {
        const el = document.querySelector(s.play.selector);
        if (el) el.click();
      }
    });

    /* ---- 양방향 연결 ---- */
    let activeN = null;
    function clearActive() {
      if (activeN == null) return;
      const s = SPECS.find((x) => x.n === activeN);
      if (s) { const t = targetOf(s); if (t) t.classList.remove("sl-hl"); }
      if (markerEls[activeN]) markerEls[activeN].classList.remove("sl-hot");
      const row = document.getElementById("sl-def-" + activeN);
      if (row) row.classList.remove("sl-active");
      activeN = null;
      drawArrow();
    }
    function activate(n, from) {
      if (document.body.classList.contains("sl-mode-proto")) setMode("doc");
      clearActive();
      activeN = n;
      const s = SPECS.find((x) => x.n === n);
      const t = targetOf(s);
      if (t) t.classList.add("sl-hl");
      if (markerEls[n]) markerEls[n].classList.add("sl-hot");
      const row = document.getElementById("sl-def-" + n);
      if (row) row.classList.add("sl-active");
      if (from === "panel" && t) t.scrollIntoView({ block: "center", behavior: "smooth" });
      if (from === "marker" && row) row.scrollIntoView({ block: "center", behavior: "smooth" });
      drawArrow();
    }

    /* ---- 재배치 트리거 ---- */
    window.addEventListener("resize", layout);
    document.querySelectorAll("img").forEach((im) => im.addEventListener("load", layout));
    document.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => requestAnimationFrame(layout)));
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(placeMarkers)).observe(sheet);
    applyWidth(WIDTHS.mobile);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
