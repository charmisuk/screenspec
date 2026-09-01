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
const { execFileSync, spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const LIB = path.join(REPO, "screenspec.js");
const E2E = path.join(REPO, "tests", "e2e.js");

/* 돌연변이 목록 — find 를 replace 로 바꾸면 그 기능이 죽는다. only = 그것을 잡아야 할 e2e 섹션 */
const MUTS = [
  { id: "infer-off", only: "[화면]", why: "root 추론을 꺼 버린다 (#67)",
    find: "    function ensureRoots() {\n      if (SCREENS.length < 2) return;",
    to:   "    function ensureRoots() {\n      if (SCREENS.length < 2) return;\n      return;" },
  { id: "toc-root-off", only: "[화면]", why: "목차 클릭이 추론된 화면을 안 바꾼다 (#74)",
    find: "      } else if (!sc.route && (sc.root || sc._rootEl)) {",
    to:   "      } else if (!sc.route && sc.root) {" },
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
    find: "      const screenPart = specs().some(isBrief) ? \"\" /* 개요는 화면당 하나다 */",
    to:   "      const screenPart = true ? \"\" /* 개요는 화면당 하나다 */" },
  { id: "brief-breaks-root", only: "[개요]", why: "개요가 있으면 화면 연결이 끊긴다 (#82)",
    find: "        const sps = (sc.specs || []).filter((sp) => !isBrief(sp));",
    to:   "        const sps = (sc.specs || []);" },
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

process.on("exit", () => { try { fs.writeFileSync(LIB, original); } catch (e) { /* 이미 되돌렸다 */ } });

for (const m of list) {
  process.stdout.write("· " + m.id.padEnd(18) + m.why + " … ");
  if (original.indexOf(m.find) < 0) {
    console.log("건너뜀 (심을 자리를 못 찾았다 — 코드가 바뀌었으면 돌연변이도 고쳐야 한다)");
    broken++;
    continue;
  }
  fs.writeFileSync(LIB, original.replace(m.find, m.to));
  const r = spawnSync(process.execPath, [E2E, "--only", m.only], { cwd: process.cwd(), encoding: "utf8" });
  fs.writeFileSync(LIB, original);
  const out = (r.stdout || "") + (r.stderr || "");
  /* 종료코드로 본다 — FAIL 이 나도, 시험이 아예 «멈춰 버려도»(기다리던 것이 안 나타나 타임아웃)
     그 결함을 잡은 것이다. 결과 줄만 보면 크래시를 «놓침» 으로 오판한다 (2026-08-31 실측) */
  const hit = r.status !== 0;
  const crashed = hit && !/결과: PASS/.test(out);
  if (hit) { console.log(crashed ? "잡음 ✓ (시험이 멈췄다 — 그것도 잡은 것이다)" : "잡음 ✓"); caught++; }
  else {
    console.log("놓침 ✗  ← 이 검사는 가짜다");
    missed++;
    const line = out.split("\n").find((l) => l.indexOf("결과:") === 0);
    if (line) console.log("    " + line);
  }
}

console.log("\n돌연변이 " + list.length + "개 · 잡음 " + caught + " · 놓침 " + missed +
  (broken ? " · 자리 없음 " + broken : ""));
if (missed || broken) {
  console.log("놓친 것이 있으면 그 e2e 검사가 무엇을 재는지 다시 써라 — 초록불이 «고쳐졌다» 를 뜻하지 않는다.");
  process.exit(1);
}
