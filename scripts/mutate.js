/*
 * 검사를 검사한다 — 돌연변이 검사(mutation testing)의 축소판.
 *
 *   node scripts/mutate.js          전부 (돌연변이 하나당 20초쯤)
 *   node scripts/mutate.js <id>     하나만
 *   node scripts/mutate.js --list   목록
 *
 * 왜 필요한가 (2026-08-31 실제 사고):
 *   #67 의 e2e 4건이 전부 PASS 였는데 목차 클릭 경로는 여전히 깨져 있었다(#74).
 *   시험을 setScreen() 으로 재서 «사람이 실제로 누르는 길» 을 한 번도 안 지나갔기 때문이다.
 *   초록불이 「고쳐졌다」를 뜻하지 않았다. 초록불을 믿으려면 «빨간불을 본 적이 있어야» 한다.
 *
 * 어떻게 하나:
 *   라이브러리에 «알려진 결함» 을 한 줄 심고, 그것을 잡아야 할 e2e 섹션만 --only 로 돌린다.
 *     FAIL 이 나면  → 그 검사는 진짜다
 *     PASS 가 나오면 → 그 검사가 가짜다. 무엇을 재는지 다시 써야 한다
 *
 * 새 기능을 넣을 때 그 기능을 무력화하는 돌연변이를 한 줄 같이 등록한다.
 * 그것이 「이 검사가 진짜인가」의 영수증이다.
 *
 * playwright 는 e2e 와 같은 규칙으로 찾는다 — playwright 가 깔린 곳에서 실행해라.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const LIB = path.join(REPO, "screenspec.js");
const E2E = path.join(REPO, "tests", "e2e.js");

/* 돌연변이 목록 — find 를 replace 로 바꾸면 그 기능이 죽는다. only = 그것을 잡아야 할 e2e 섹션 */
const MUTS = [
  { id: "infer-off", only: "[화면]", why: "root 추론을 꺼 버린다 (#67)",
    find: "    function ensureRoots() {\n      if (SCREENS.length < 2) return;",
    to:   "    function ensureRoots() {\n      if (SCREENS.length < 2) return;\n      return;" },
  { id: "toc-root-off", only: "[화면]", why: "추론해 세운 화면(_rootEl)은 전환에서 빠진다 — 목차·API 둘 다 안 바뀐다 (#74)",
    find: "      if ((next.root || rootElOf(next)) && !next.route && ctx.toggleRoot === true) showRoot(next);",
    to:   "      if (next.root && !next.route && ctx.toggleRoot === true) showRoot(next);" },
  { id: "solo-off", only: "[화면]", why: "정의서 모드에서 화면을 안 좁힌다 (#75)",
    find: "    function soloRoots(on) {\n      if (ctx.toggleRoot !== true) return;",
    to:   "    function soloRoots(on) {\n      if (ctx.toggleRoot !== true) return;\n      return;" },
  { id: "detect-guard-off", only: "[화면]", why: "화면 감지가 고른 화면을 도로 뒤집는다 (#77)",
    find: "      if (core.unwiredNow()) return;\n      for (const sc of SCREENS) {",
    to:   "      for (const sc of SCREENS) {" },
  { id: "gate-off", only: "[편집] 파일에 연결", why: "연결 안 됐는데도 고쳐진다 (#68)",
    find: "      if (edCanWrite()) return true;",
    to:   "      return true;" },
  { id: "common-off", only: "[docs] checklist", why: "공통 처리 축이 화면마다 다시 경고한다 (#89)",
    find: "      missing: CHK_EACH.filter((ax) => !covers.includes(ax)",
    to:   "      missing: CHECKLIST.filter((ax) => !covers.includes(ax)" },
  { id: "common-hidden", only: "[docs] checklist", why: "공통 처리 축이 문서 어디에도 안 남는다 (#89)",
    find: "      const common = CHK_COMMON.length",
    to:   "      const common = false" },
  { id: "common-noreason", only: "[docs] checklist", why: "사유 없는 common 도 선언으로 쳐 준다 (#89)",
    find: "      const why = typeof v.common === \"string\" ? v.common.trim() : \"\";",
    to:   "      const why = typeof v.common === \"string\" ? v.common.trim() : (v.common ? \"공통\" : \"\");" },
  { id: "slash-empty-only", only: "[슬래시]", why: "슬래시가 다시 빈 줄에서만 열린다 (#85)",
    find: "        else if (k === \"/\" && !e.ctrlKey && !e.metaKey) {",
    to:   "        else if (k === \"/\" && !e.ctrlKey && !e.metaKey && !edEl.textContent.trim()) {" },
  { id: "derived-leak", only: "[파생]", why: "파생값(_rootEl)이 다시 파일로 샌다 — 다시 열면 화면 전환이 죽는다 (#101)",
    find: "typeof o[k] !== \"function\" && k.charAt(0) !== \"_\");",
    to:   "typeof o[k] !== \"function\");" },
  { id: "rootel-dirty-kept", only: "[파생]", why: "이미 오염된 파일의 _rootEl 을 청소하지 않는다 — 그 화면은 영영 안 세워진다 (#101)",
    find: "      SCREENS.forEach((sc) => { if (sc._rootEl && sc._rootEl.nodeType !== 1) delete sc._rootEl; }); /* 오염된 값 청소 */\n",
    to:   "" },
  { id: "ref-sup-off", only: "[출처]", why: "줄 끝 각주가 안 붙는다 (#100)",
    find: "\"</span>\" + refSupHTML(d) + \"</div>\"",
    to:   "\"</span>\" + \"\" + \"</div>\"" },
  { id: "ref-hitbox-off", only: "[출처]", why: "각주 클릭 상자가 9px 글자 크기로 되돌아간다 (#100)",
    find: "    padding:3px 7px;margin-right:-4px;border-radius:7px;user-select:none}",
    to:   "    padding:0;margin-right:-4px;border-radius:7px;user-select:none}" },
  { id: "ref-inside-edit", only: "[출처]", why: "각주를 편집칸 «안» 에 넣는다 — 고칠 때마다 글자에 눌러앉는다 (#100)",
    find: "\"</span>\" + refSupHTML(d) + \"</div>\"",
    to:   "refSupHTML(d) + \"</span>\" + \"</div>\"" },
  { id: "ref-foot-off", only: "[출처]", why: "화면 발치의 「출처」 목록이 안 선다 (#100)",
    find: "defsRowsHTML(specs()) + devCommonHTML(current) + refBlockHTML() + covBlockHTML(current)",
    to:   "defsRowsHTML(specs()) + devCommonHTML(current) + covBlockHTML(current)" },
  { id: "ref-lost-on-boot", only: "[출처]", why: "부팅 정규화가 ref 를 떨군다 — 열자마자 각주가 사라진다 (#100)",
    find: "    if (d.ref != null && String(d.ref)) b.ref = String(d.ref); /* 출처 각주 (#100) */",
    to:   "" },
  { id: "mm-view-off", only: "[머메이드]", why: "머메이드 블록이 화면에서 빈 줄이 된다 (#98)",
    find: "    if (kind === B_MERMAID) {\n      /* 그림은 나중에(비동기) 온다",
    to:   "    if (false) {\n      /* 그림은 나중에(비동기) 온다" },
  { id: "mm-pruned", only: "[머메이드]", why: "t 가 비었다고 머메이드를 지운다 — 저장하는 순간 사라진다 (#98)",
    find: "          edCut(sp.defs, (d) => isAtomBlk(d) || String(d.t || \"\").trim()",
    to:   "          edCut(sp.defs, (d) => isTable(d) || String(d.t || \"\").trim()" },
  { id: "mm-png-off", only: "[머메이드]", why: "그림에서만 순서도가 사라진다 (#98)",
    find: "      if (kind === B_MERMAID) {\n        const got = MM_SVG.get(d);",
    to:   "      if (false) {\n        const got = MM_SVG.get(d);" },
  { id: "route-nav-off", only: "[화면] route", why: "route 화면으로 가도 액자·앱이 안 따라간다 (#99 원래 버그)",
    find: "      if (!go) return; /* 호스트가 맡았다 */",
    to:   "      if (!go) return; return;" },
  { id: "route-prefix-off", only: "[화면] route", why: "접두(basePath)를 안 붙여 틀린 주소로 간다 (#99)",
    find: "      const to = routeBase(loc.pathname) + sc.route;",
    to:   "      const to = sc.route;" },
  { id: "route-event-off", only: "[화면] route", why: "screenchange 신호가 안 나간다 — 호스트가 따라갈 길이 없다 (#99)",
    find: "        go = window.dispatchEvent(new CustomEvent(\"screenspec:screenchange\", {",
    to:   "        go = true; if (false) window.dispatchEvent(new CustomEvent(\"screenspec:screenchange\", {" },
  { id: "toc-own-path", only: "[화면] route", why: "목차가 다시 자기만의 전환 코드를 탄다 (#74 재발)",
    find: "      setScreen(sc.id);\n    });",
    to:   "      setCurrent(sc);\n    });" },
  { id: "tbl-view-off", only: "[표]", why: "설정에 쓴 표를 뷰어가 안 그린다 (#97)",
    find: "    if (kind === B_TABLE) {\n      return '<div class=\"' + cls + '\" data-di=\"' + di +",
    to:   "    if (false) {\n      return '<div class=\"' + cls + '\" data-di=\"' + di +" },
  { id: "tbl-pruned", only: "[표]", why: "t 가 비었다고 표를 «빈 줄» 로 지운다 (#97)",
    find: "          edCut(sp.defs, (d) => isAtomBlk(d) || String(d.t || \"\").trim()",
    to:   "          edCut(sp.defs, (d) => String(d.t || \"\").trim()" },
  { id: "tbl-png-off", only: "[표]", why: "그림에서만 표가 조용히 사라진다 (#97)",
    find: "      if (kind === B_TABLE) {\n        const t = tblNorm(d);",
    to:   "      if (false) {\n        const t = tblNorm(d);" },
  { id: "tbl-tab-dead", only: "[표]", why: "표 안에서 Tab 이 칸을 안 옮긴다 (#97)",
    find: "          if (k === \"Tab\") { eat(); tblStep(edEl, e.shiftKey); return; }",
    to:   "          if (k === \"Tab\") { eat(); return; }" },
  { id: "tbl-nodel", only: "[표]", why: "⠿ 를 눌러도 메뉴가 안 뜬다 — 표를 지울 길이 없다 (#97)",
    find: "        edBlkMenuOpen(g);",
    to:   "        return;" },
  { id: "tbl-rowdel-off", only: "[표]", why: "빈 행에서 Backspace 가 행을 안 지운다 (#97)",
    find: "          if (k === \"Backspace\" && empty) { if (tblKillRow(edEl)) eat(); return; }",
    to:   "          if (k === \"Backspace\" && empty) return;" },
  { id: "mob-collapse-off", only: "[모바일]", why: "폰 폭에서 툴바가 다시 안 접힌다 — 버튼이 겹치고 잘린다 (#94)",
    find: "  @media(max-width:640px){\n    .ss-toolbar{gap:10px;padding:0 12px}",
    to:   "  @media(max-width:1px){\n    .ss-toolbar{gap:10px;padding:0 12px}" },
  { id: "mob-menu-dead", only: "[모바일]", why: "⋯ 를 눌러도 도구가 안 나온다 (#94)",
    find: "          const on = box.classList.toggle(\"ss-tools-open\");",
    to:   "          const on = false;" },
  { id: "slash-eats-shift", only: "[슬래시]", why: "메뉴가 Shift+Enter 를 «고르기» 로 삼킨다 (#85)",
    find: "      if (e.key === \"Enter\" && !e.shiftKey) { const p = edPos();",
    to:   "      if (e.key === \"Enter\") { const p = edPos();" },
  { id: "slash-crumb", only: "[슬래시]", why: "고른 뒤 «/» 가 글에 남는다 (#85)",
    find: "      edSlashEat(); /* «/» 와 거르려고 친 글자를 걷어낸다 (#85) */",
    to:   "      edSlashAt = null;" },
  { id: "slash-nofilter", only: "[슬래시]", why: "이어 친 글자로 안 걸러진다 — 안 걸려도 안 닫힌다 (#85)",
    find: "        if (edMenu) { const q = edSlashQuery(); if (q === null) edSlashClose(); else edSlash(q); }",
    to:   "        if (false) { edSlash(\"\"); }" },
  { id: "hook-off", only: "[편집] 저장을 호스트가", why: "호스트 저장 훅을 못 본다 — 앱에 심으면 다시 막힌다 (#87)",
    find: "    function edHook() { const hk = RAW.save;",
    to:   "    function edHook() { return null; } function edHookX() { const hk = RAW.save;" },
  { id: "hook-leak", only: "[편집] 저장을 호스트가", why: "훅을 설정에 되쓴다 — 한 번 저장하면 훅이 사라진다 (#87)",
    find: "    Object.keys(cfg).forEach((k) => { if (k !== \"save\") out[k] = cfg[k]; });",
    to:   "    Object.keys(cfg).forEach((k) => { out[k] = cfg[k]; });" },
  { id: "hook-kill", only: "[편집] 저장을 호스트가", why: "호스트가 한 번 실패하면 «껐습니다» 라고 한다 (#87)",
    find: "      if (bad) { if (edHook()) edSay(bad); else { edHandle = null; edSay(bad + \" 자동저장을 껐습니다.\"); } }",
    to:   "      if (bad) { edHandle = null; edSay(bad + \" 자동저장을 껐습니다.\"); }" },
  { id: "filecheck-off", only: "[편집] 잘못된 파일", why: "남의 프로토타입을 덮어쓴다 (#70)",
    find: "      if (!at) return \"그 파일에는 window.SCREENSPEC 설정이 없습니다.",
    to:   "      if (false) return \"그 파일에는 window.SCREENSPEC 설정이 없습니다." },
  { id: "layer-name-off", only: "[편집] 파일에 연결", why: "레이어가 무슨 파일인지 안 알려 준다 (#78)",
    find: "        edLinkBar.querySelector(\".ss-lay-name\").textContent = edKnown ? edKnown.name : at.name;",
    to:   "        edLinkBar.querySelector(\".ss-lay-name\").textContent = \"\";" },
  { id: "quiet-off", only: "[auto]", why: "잃을 게 없어도 매번 묻는다 (#83)",
    find: "      if (text !== null && edBase !== null && !cfgChanged && idle) {",
    to:   "      if (false) {" },
  { id: "what-off", only: "[auto]", why: "무엇이 바뀌었는지 안 가린다 (#83)",
    find: "      const cfgChanged = text !== null && edBase !== null && now.cfg !== was.cfg;",
    to:   "      const cfgChanged = true;" },
  { id: "race-off", only: "[auto]", why: "자동저장이 감시보다 빨라 밖의 변경을 덮는다 (#83)",
    find: "      await edPeekFile();\n      if (edOutside) return;",
    to:   "" },
  { id: "brief-off", only: "[개요]", why: "개요가 맨 위로 안 온다 (#82)",
    find: "  const inOrder = (specs) => (specs || []).slice().sort((a, b) => (isBrief(a) ? 0 : 1) - (isBrief(b) ? 0 : 1));",
    to:   "  const inOrder = (specs) => (specs || []).slice();" },
  { id: "brief-marker-on", only: "[개요]", why: "개요에도 마커를 만든다 (#82)",
    find: "        if (isBrief(it.spec)) return; /* 개요는 화면 위 요소가 아니다",
    to:   "        if (false) return; /* 개요는 화면 위 요소가 아니다" },
  { id: "nofile-off", only: "[편집] 파일에 연결", why: "주소로 연 문서에서 아무 말도 안 한다 (#84)",
    find: "      if (!edCanFile() || location.protocol !== \"file:\") { edNoFileTell(); return true; }",
    to:   "      if (!edCanFile() || location.protocol !== \"file:\") { return true; }" },
  { id: "brief-slash-off", only: "[개요]", why: "슬래시 메뉴에 화면 개요가 안 나온다 (#82)",
    find: "      const scr = (!bare || specs().some(isBrief)) ? [] : SLASH_SCREEN.filter(hit);",
    to:   "      const scr = [];" },
  { id: "brief-breaks-root", only: "[개요]", why: "개요가 있으면 화면 연결이 끊긴다 (#82)",
    find: "        const sps = (sc.specs || []).filter((sp) => !isBrief(sp));",
    to:   "        const sps = (sc.specs || []);" },
  { id: "depth-flat", only: "[내보내기]", why: "부모를 눌러도 자식이 안 따라간다 — 뎁스가 이름뿐 (#96)",
    find: "            const on = PR_HEAD.some((c) => prCfg[c]);\n            PR_HEAD.forEach((c) => (prCfg[c] = on ? false : PR_DEF[c]));",
    to:   "            prCfg.id = e.target.checked;" },
  { id: "head-on-takes-all", only: "[내보내기]", why: "부모를 켜면 안 쓰던 일시까지 따라 켜진다 (PM 2026-09-03)",
    find: "            PR_HEAD.forEach((c) => (prCfg[c] = on ? false : PR_DEF[c]));",
    to:   "            PR_HEAD.forEach((c) => (prCfg[c] = !on));" },
  { id: "when-on-by-default", only: "[내보내기]", why: "일시가 다시 기본으로 켜져 있다 (PM 2026-09-03)",
    find: "path: true, when: false, mark: true",
    to:   "path: true, when: true, mark: true" },
  { id: "indeterminate-off", only: "[내보내기]", why: "자식을 빼도 부모가 중간 상태가 안 된다 (#96)",
    find: "      head.indeterminate = n > 0 && n < base;",
    to:   "      head.indeterminate = false;" },
  { id: "sketch-lies", only: "[내보내기]", why: "스케치가 설정을 안 따라간다 — 번호를 꺼도 그대로 (2026-09-03 QA)",
    find: "  .ss-prdlg [hidden]{display:none}\n",
    to:   "" },
  { id: "head-parts-ignored", only: "[내보내기]", why: "고른 조각과 무관하게 머리말을 통째로 굽는다 (#96)",
    find: "      const o = head && typeof head === \"object\" ? head : {};",
    to:   "      const o = {};" },
  { id: "when-gone", only: "[내보내기]", why: "일시를 그림에 안 넣는다 — 문구만 약속하던 옛 상태 (#96)",
    find: "      if (on(\"when\")) html += '<div class=\"ss-cap-when\">' + esc(capWhen()) + \"</div>\";\n",
    to:   "" },
  { id: "accent-leaks", only: "[내보내기]", why: "내보내기 색이 문서의 accent 까지 바꾼다 — 저장 레인 침범 (#96)",
    find: "      if (opt.accent) box.style.setProperty(\"--ss-accent\", opt.accent);",
    to:   "      if (opt.accent) document.documentElement.style.setProperty(\"--ss-accent\", opt.accent);" },
  { id: "export-forgets", only: "[내보내기]", why: "내보낸 설정을 기억하지 않는다 — 20화면을 뽑을 때마다 다시 체크 (#96)",
    find: "          prSave();\n",
    to:   "" },
  { id: "export-remembers-junk", only: "[내보내기]", why: "깨진 저장값을 그대로 믿는다 (#96)",
    find: "        Object.keys(PR_DEF).forEach((k) => { if (typeof o[k] === typeof PR_DEF[k]) out[k] = o[k]; });",
    to:   "        Object.keys(o).forEach((k) => { out[k] = o[k]; });" },
  { id: "hex-unchecked", only: "[내보내기]", why: "hex 가 아닌 값도 색으로 받는다 (#96)",
    find: "          if (!v || prHex(v)) { prCfg.color = v ? v : \"\"; prSync(); }",
    to:   "          prCfg.color = v; prSync();" },
  { id: "sheet-not-bottom", only: "[내보내기]", why: "폰에서 바닥 시트가 아니라 가운데 상자로 뜬다 (#96)",
    find: "    .ss-prdlg{max-width:100%;width:100%;margin:auto auto 0;border-radius:16px 16px 0 0;padding:18px 18px 16px}",
    to:   "    .ss-prdlg{padding:18px 18px 16px}" },
  { id: "drag-steals-kids", only: "[grid]", why: "앞 줄의 «조상» 이 아니라 앞 줄 자체의 다음 형제로 넣는다 — 남의 자식 자리로 파고든다 (#91)",
    find: "        const anc = prev.path.slice(0, ind + 1);",
    to:   "        const anc = prev.path;" },
  { id: "drag-cap-ignores-sub", only: "[grid]", why: "데려가는 하위를 안 세고 더 들어간다 — 손자가 3단이 된다 (#91 참조가 정답으로 여겼던 그 동작)",
    find: "      const room = 2 - deepOf(me.b, 0);",
    to:   "      const room = 2;" },
  { id: "frame-snapshot-hide", only: "[frame]", why: "부팅 «그 순간» 목록만 감춘다 — 뒤에 생긴 노드가 액자 옆에 비친다 (#103 원래 버그)",
    find: "  function hideAppDom() { document.body.classList.add(\"ss-framed\"); }",
    to:   "  function hideAppDom() { Array.from(document.body.children).forEach((n) => { if (n.tagName === \"SCRIPT\" || n.tagName === \"STYLE\") return; if (n.matches && n.matches(SS_OWN_SEL)) return; n.style.display = \"none\"; }); }" },
  { id: "frame-hides-viewer", only: "[frame]", why: "감추는 규칙이 우리 뷰어 UI 까지 먹는다 (#103)",
    find: "  body.ss-framed > *:not(.ss-ui):not(.ss-toolbar)",
    to:   "  body.ss-framed > *:not(.ss-nope):not(.ss-toolbar)" },
  { id: "marker-px-raw", only: "[move]", why: "마커 좌표를 안 자르고 써 추적 루프가 영영 안 멎는다 (#104 가 깨운 잠복 버그)",
    find: "        const px = (v) => Math.round(v * 100) / 100 + \"px\";",
    to:   "        const px = (v) => v + \"px\";" },
  { id: "zoom-off", only: "[배율]", why: "「맞춤」 을 눌러도 안 줄어든다 — 단추가 이름만 남는다 (#104)",
    find: "      scale = doc ? fitScale(stage) : (zoomOn ? fitScale(protoWrap) : 1);",
    to:   "      scale = doc ? fitScale(stage) : 1;" },
  { id: "zoom-resizes-sheet", only: "[배율]", why: "축소 대신 시트를 줄인다 — 앱의 미디어쿼리가 달라진다 (자동과 뒤섞인다) (#104)",
    find: "    if (zoomBtn) zoomBtn.addEventListener(\"click\", () => { zoomOn = !zoomOn; layout(); core.placeMarkers(); });",
    to:   "    if (zoomBtn) zoomBtn.addEventListener(\"click\", () => { fitToStage(); layout(); });" },
  { id: "fit-width-only", only: "[배율]", why: "축소가 폭만 본다 — 긴 시트가 한 화면에 안 들어온다 (#104)",
    find: "      return Math.max(0.2, Math.min(1, b.w / sheetW, bound ? b.h / sheetH : 1));",
    to:   "      return Math.max(0.2, Math.min(1, b.w / sheetW));" },
  { id: "fit-self-referential", only: "[배율]", why: "흐름 배치에서도 높이를 봐 배율이 제 꼬리를 문다 (#104)",
    find: "      const bound = getComputedStyle(host).overflowY !== \"visible\" && b.h > 0;",
    to:   "      const bound = b.h > 0;" },
  { id: "holder-phantom-space", only: "[배율]", why: "축소해도 홀더가 원래 크기만큼 자리를 먹어 빈 곳으로 스크롤된다 (#104)",
    find: "        holder.style.width = scale === 1 ? \"\" : Math.ceil(sheetW * scale) + \"px\";",
    to:   "        holder.style.width = \"\";" },
  { id: "frame-squeezed", only: "[배율]", why: "프레임이 홀더를 따라 눌려 시트와 손잡이가 어긋난다 (#104)",
    find: "      frame.style.width = sheetW + \"px\";\n",
    to:   "" },
  { id: "flow-hop-off", only: "[흐름]", why: "화살표가 줄 사이를 못 건넌다 — #48 이전으로 (#48)",
    find: "    function edHop(dir, x) {\n      const cur = edEl;\n      if (!cur) return false;",
    to:   "    function edHop(dir, x) {\n      const cur = edEl;\n      if (cur || !cur) return false;" },
  { id: "flow-x-lost", only: "[흐름]", why: "건너간 줄에서 가로 위치를 버리고 맨 앞에 선다 (#48)",
    find: "      if (!edCaretAt(to.el, cx, cy)) edCaretTo(to.el, dir > 0 ? 0 : to.el.textContent.length);",
    to:   "      edCaretTo(to.el, 0);" },
  { id: "flow-wrong-cell", only: "[흐름]", why: "표에서 같은 열이 아니라 아무 칸으로 내려간다 (#48)",
    find: "        return dx(a) - dx(b);",
    to:   "        return dx(b) - dx(a);" },
  { id: "merge-off", only: "[흐름]", why: "줄 맨 앞 Backspace 가 다시 아무 일도 안 한다 (#48 원래 버그)",
    find: "    function edMergeLine(dir) {\n      const p = edPos(), node = edNode(p);\n      if (!p || !node) return false;",
    to:   "    function edMergeLine(dir) {\n      const p = edPos(), node = edNode(p);\n      if (p || !node) return false;" },
  { id: "merge-drops-kids", only: "[흐름]", why: "합칠 때 사라지는 줄의 하위가 통째로 증발한다 (#48)",
    find: "      goneSpot.owner.splice(goneSpot.idx, 1, ...(gone.c || []));",
    to:   "      goneSpot.owner.splice(goneSpot.idx, 1);" },
  { id: "merge-drops-ref", only: "[흐름]", why: "합칠 때 각주가 조용히 사라진다 (#48)",
    find: "      if (!keep.ref && gone.ref) keep.ref = gone.ref;\n",
    to:   "" },
  { id: "merge-thru-atom", only: "[흐름]", why: "표를 글자처럼 끌어 붙인다 — 표 아래 줄이 표를 먹는다 (#48)",
    find: "      if (!other || isAtomBlk(other) || isAtomBlk(node.b)) return false;",
    to:   "      if (!other) return false;" },
  { id: "split-scrollers", only: "[무대]", why: "가로는 상자가 세로는 문서가 맡던 옛 배치로 되돌린다 (#102)",
    find: "  .ss-proto-wrap{position:fixed;top:50px;left:0;right:0;bottom:0;overflow:auto;padding:var(--ss-stage-pad)}",
    to:   "  .ss-proto-wrap{padding:74px 16px 60px;overflow-x:auto}" },
  { id: "stage-pad-zero", only: "[무대]", why: "프로토타입 여백을 0 으로 — 손잡이가 잘린다 (#102 제안 ②)",
    find: "    --ss-stage-pad:24px}",
    to:   "    --ss-stage-pad:0px}" },
  { id: "fit-off", only: "[무대]", why: "«자동» 이 창을 안 따라간다 — 프리셋이 이름만 남는다 (#102)",
    find: "      if (fitOn) fitToStage(); else applySize(d.w, d.h);",
    to:   "      applySize(d.w || sheetW, d.h || sheetH);" },
  { id: "fit-sticks", only: "[무대]", why: "손으로 끈 크기를 다음 창 크기 변경이 지운다 (#102)",
    find: "        fitOn = false; /* 손으로 정한 크기가 다음 창 크기 변경에 지워지지 않게 */\n",
    to:   "" },
  { id: "fit-in-doc", only: "[무대]", why: "정의서에서도 폭이 창을 따라가 기준 폭을 잃는다 (#102)",
    find: "      if (document.body.classList.contains(\"ss-mode-doc\")) return;\n      const b = inner(protoWrap);",
    to:   "      const b = inner(document.body.classList.contains(\"ss-mode-doc\") ? stage : protoWrap);" },
];

const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  console.log("돌연변이 " + MUTS.length + "개:");
  MUTS.forEach((m) => console.log("  " + m.id.padEnd(18) + m.why + "   → " + m.only));
  process.exit(0);
}

/* 작업 중인 것을 잃지 않게 — 깨끗할 때만 심는다 */
try { execFileSync("git", ["diff", "--quiet", "--", "screenspec.js"], { cwd: REPO }); }
catch (e) { console.error("✗ screenspec.js 에 커밋 안 된 변경이 있다. 돌연변이는 파일을 고쳤다 되돌리므로 깨끗할 때만 돌린다."); process.exit(2); }

const only = argv.find((a) => a.indexOf("-") !== 0);
const list = only ? MUTS.filter((m) => m.id === only) : MUTS;
if (!list.length) { console.error("✗ 그런 돌연변이가 없다: " + only + " (--list 로 목록)"); process.exit(2); }

const original = fs.readFileSync(LIB, "utf8");
let caught = 0, missed = 0, broken = 0;

/* ---- 나란히 돌린다 ----
   판마다 node + 크롬을 통째로 띄우고, 그 섹션의 기다림(debounce·파일감시)을 고스란히 치른다.
   그래서 하나에 12~51초고 전부 돌리면 25분이었다. 「그럼 덜 돌리자」는 답이 아니다 —
   #91 이 정확히 «사람이 기억해서 돌리는 검사» 라서 다섯 판 동안 빨갰다.
   덜 돌릴 게 아니라 «자동으로 돌 만큼» 빨라야 한다.

   워커마다 «레포 사본» 을 준다. 사본이 필요한 이유: examples/*.html 은 file:// 로 열려
   ../screenspec.js 를 자기 옆에서 읽는다 — 한 파일을 여럿이 갈아 끼우면 서로의 돌연변이를 본다.
   포트도 워커마다 옮긴다 (SS_PORT_BASE) — 안 옮기면 남의 서버에 붙는다. */
/* 몇 판을 나란히? — «지금 CPU 로드» 로 조절하지 않는다. 두 가지 이유다:
   ① 이 일은 CPU 가 아니라 «기다림» 이 지배한다 (8판에서 CPU 58%). CPU 여유는 천장이 아니다
   ② loadavg 는 1분 평균이라 3분짜리 작업에는 반응이 늦다 — 제어 루프가 헛돈다
   진짜 천장은 «크롬 하나당 메모리» 다. 그래서 코어 수와 «남은 메모리» 로 정하고,
   8에서 자른다 — 그 위로는 이득이 얇아지고 남의 기계를 다 먹는다.
   실측 (8코어 맥, 73개): 1판 25분 · 4판 6분 57초 · 8판 3분 33초 */
const os = require("os");
const AUTO = Math.min(os.cpus().length, Math.floor(os.freemem() / (400 * 1024 * 1024)), 8);
const JOBS = Math.max(1, Number(process.env.SS_JOBS || (list.length > 2 ? Math.max(2, AUTO) : 1)));
const WORK = path.join(REPO, "_mut");
const SKIP = new Set([".git", "node_modules", "_qa", "_mut", "_private"]);

function mirror(dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(REPO)) {
    if (SKIP.has(name)) continue;
    fs.cpSync(path.join(REPO, name), path.join(dst, name), { recursive: true });
  }
}

function runOne(m, dir, portBase) {
  return new Promise((done) => {
    if (original.indexOf(m.find) < 0) return done({ m: m, kind: "broken" });
    const lib = path.join(dir, "screenspec.js");
    const e2e = path.join(dir, "tests", "e2e.js");
    fs.writeFileSync(lib, original.replace(m.find, m.to));
    /* [grid] 는 플래그 뒤에 숨어 있다 — 안 켜면 «검사 0건» 이라 무엇을 심어도 초록이 된다 (#91) */
    const grid = m.only.indexOf("[grid]") === 0;
    const args = [e2e, "--only", m.only].concat(grid ? ["--grid"] : []);
    /* 전수(272자리)는 --grid 가 따로 돈다. 여기서는 «무는가» 만 보면 되므로 판 셋으로 줄인다 */
    const env = Object.assign({}, process.env, { SS_PORT_BASE: String(portBase) },
      grid ? { SS_GRID_FAST: "1" } : {});
    const ps = spawn(process.execPath, args, { cwd: process.cwd(), env: env });
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.stderr.on("data", (d) => (out += d));
    ps.on("close", (code) => {
      /* 종료코드로 본다 — FAIL 이 나도, 시험이 아예 «멈춰 버려도»(기다리던 것이 안 나타나 타임아웃)
         그 결함을 잡은 것이다. 결과 줄만 보면 크래시를 «놓침» 으로 오판한다 (2026-08-31 실측) */
      const hit = code !== 0;
      done({ m: m, kind: hit ? "caught" : "missed", crashed: hit && !/결과: PASS/.test(out),
        line: out.split("\n").find((l) => l.indexOf("결과:") === 0) });
    });
  });
}

(async () => {
  const dirs = [];
  for (let i = 0; i < JOBS; i++) {
    const d = path.join(WORK, "w" + i);
    mirror(d);
    dirs.push(d);
  }
  process.on("exit", () => { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch (e) { /* 이미 지웠다 */ } });
  if (JOBS > 1) console.log("나란히 " + JOBS + "판 (코어 " + os.cpus().length +
    " · 남은 메모리 " + Math.round(os.freemem() / 1073741824 * 10) / 10 + "GB · 레포 사본 · 포트 분리)\n");

  let next = 0;
  const say = (r) => {
    process.stdout.write("· " + r.m.id.padEnd(20) + r.m.why + " … ");
    if (r.kind === "broken") { console.log("건너뜀 (심을 자리를 못 찾았다 — 코드가 바뀌었으면 돌연변이도 고쳐야 한다)"); broken++; return; }
    if (r.kind === "caught") { console.log(r.crashed ? "잡음 ✓ (시험이 멈췄다 — 그것도 잡은 것이다)" : "잡음 ✓"); caught++; return; }
    console.log("놓침 ✗  ← 이 검사는 가짜다");
    missed++;
    if (r.line) console.log("    " + r.line);
  };
  /* 끝난 순서가 아니라 «등록한 순서» 로 찍는다 — 목록과 나란히 읽혀야 한다 */
  const slot = new Array(list.length).fill(null);
  let shown = 0;
  const flush = () => { while (shown < slot.length && slot[shown]) { say(slot[shown]); shown++; } };
  await Promise.all(dirs.map(async (dir, w) => {
    for (;;) {
      const i = next++;
      if (i >= list.length) return;
      slot[i] = await runOne(list[i], dir, 100 * (w + 1));
      flush();
    }
  }));

  console.log("\n돌연변이 " + list.length + "개 · 잡음 " + caught + " · 놓침 " + missed +
    (broken ? " · 자리 없음 " + broken : ""));
  if (missed || broken) {
    console.log("놓친 것이 있으면 그 e2e 검사가 무엇을 재는지 다시 써라 — 초록불이 «고쳐졌다» 를 뜻하지 않는다.");
    process.exit(1);
  }
})();
