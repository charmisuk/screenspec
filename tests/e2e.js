/*
 * ScreenSpec e2e 회귀 스위트
 *
 * 실행: playwright가 설치된 폴더에서
 *   node <레포>/tests/e2e.js
 * 모든 릴리스(태그) 전에 이 스위트가 전부 PASS여야 한다.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const LIB = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8");
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), __dirname] }));

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, detail !== undefined ? "→ " + JSON.stringify(detail) : ""); }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  /* ============ wrap: demo.html ============ */
  console.log("[wrap] demo.html");
  await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/demo.html");
  await page.waitForTimeout(1200);
  await page.click("#ss-mDoc");
  await page.waitForTimeout(500);
  check("기능 설명 10행", (await page.locator(".ss-defs-list .ss-row").count()) === 10);
  await page.click("#ss-def-5");
  await page.waitForTimeout(300);
  check("행 클릭 → 영역 강조", await page.evaluate(() => !!document.querySelector(".ss-hl")));
  await page.click("#ss-def-3");
  await page.waitForTimeout(300);
  check("화살표(anno:arrow) 표시", await page.evaluate(() =>
    document.querySelector("#ss-line").getAttribute("visibility") === "visible"));
  await page.click('[data-play="7"]');
  await page.waitForTimeout(300);
  check("동작 재생 → 토스트", await page.evaluate(() => document.getElementById("toast").classList.contains("show")));
  await page.click('#ss-seg button[data-w="pc"]');
  await page.waitForTimeout(400);
  check("PC 프리셋 → ss-pc 훅 + 축소", await page.evaluate(() => {
    const s = document.querySelector(".ss-sheet");
    return s.classList.contains("ss-pc") && s.style.width === "1920px";
  }));
  await page.click('#ss-seg button[data-w="mobile"]');
  await page.waitForTimeout(300);
  check("모바일 복귀 360×800", await page.evaluate(() => document.querySelector(".ss-wpx").textContent === "360×800"));
  check("배지 표기", await page.evaluate(() => (document.querySelector(".ss-badge") || {}).textContent?.includes("ScreenSpec")));
  check("화면 ID 칩: 12px 셰브론", await page.evaluate(() => {
    const svg = document.querySelector(".ss-toc-btn .ss-toc-caret svg");
    return !!svg && svg.getAttribute("width") === "12";
  }));
  check("arrowTo 관계선: 끝점이 대상 요소 안", await page.evaluate(() => {
    const cfg = window.SCREENSPEC;
    const s = (cfg.specs || []).find((x) => x.n === 3);
    s.arrowTo = '[data-spec="5"]';
    document.getElementById("ss-def-3").click();
    const l = document.querySelector("#ss-line");
    const sheet = document.querySelector(".ss-sheet");
    const sr = sheet.getBoundingClientRect();
    const scale = sr.width / parseFloat(sheet.style.width);
    const B = document.querySelector('[data-spec="5"]').getBoundingClientRect();
    const x2 = Number(l.getAttribute("x2")), y2 = Number(l.getAttribute("y2"));
    const cx = sr.left + (x2 - sheet.scrollLeft) * scale, cy = sr.top + (y2 - sheet.scrollTop) * scale;
    delete s.arrowTo;
    return l.getAttribute("visibility") === "visible" && cx >= B.left - 1 && cx <= B.right + 1 && cy >= B.top - 1 && cy <= B.bottom + 1;
  }));
  check("내부 스크롤 중 마커 정합", await page.evaluate(() => {
    const s = document.querySelector(".ss-sheet");
    s.scrollTop = 300;
    const hero = document.querySelector('[data-spec="2"]').getBoundingClientRect();
    const m = document.querySelectorAll(".ss-marker")[1].getBoundingClientRect();
    return Math.abs(m.left + m.width * 0.4 - hero.left) < 8 && Math.abs(m.top + m.height * 0.4 - hero.top) < 8;
  }));
  // 우측 핸들 드래그로 폭 변경
  {
    const b = await page.locator(".ss-edge-r").boundingBox();
    await page.mouse.move(b.x + 7, 400);
    await page.mouse.down();
    await page.mouse.move(b.x + 107, 400, { steps: 5 });
    await page.mouse.up();
    const w = await page.evaluate(() => document.querySelector(".ss-sheet").style.width);
    check("우측 드래그 폭 변경", w !== "360px", w);
  }

  /* ============ wrap: multi-screen.html ============ */
  console.log("[wrap] multi-screen.html");
  await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/multi-screen.html");
  await page.waitForTimeout(800);
  await page.click("#ss-mDoc");
  await page.waitForTimeout(400);
  await page.click('[data-play="2"]');
  await page.waitForTimeout(500);
  check("flow → 화면·정의서 동시 전환", await page.evaluate(() => window.ScreenSpec.current()) === "SCR-EX-DTL-002");
  await page.click('[data-play="4"]');
  await page.waitForTimeout(400);
  check("popup → 실제 모달 열림", await page.evaluate(() => document.getElementById("sheetModal").classList.contains("open")));
  await page.click("#sheetModal .ok"); /* 모달 닫고 다음 검사로 */
  await page.waitForTimeout(200);
  /* 화면 목록 (목차) — wrap */
  await page.click(".ss-toc-btn");
  await page.waitForTimeout(300);
  check("목차 열림 + 커버리지", await page.evaluate(() => {
    const t = document.querySelector(".ss-toc");
    return t.classList.contains("ss-open") && t.textContent.includes("2/2 정의됨");
  }));
  check("목차 트리: 그룹 행 + 뎁스 인덴트", await page.evaluate(() => {
    const t = document.querySelector(".ss-toc");
    const grp = [...t.querySelectorAll(".ss-toc-grp")].some((x) => x.textContent.includes("홈"));
    const lst = t.querySelector('[data-toc="SCR-EX-LST-001"]'), dtl = t.querySelector('[data-toc="SCR-EX-DTL-002"]');
    return grp && lst && dtl && Number(dtl.dataset.depth) === Number(lst.dataset.depth) + 1 &&
      dtl.querySelectorAll(".ss-toc-ind i").length === Number(dtl.dataset.depth);
  }));
  check("flow 버튼에 대상 화면명 표기", await page.evaluate(() =>
    (document.querySelector('[data-play="1"]') || {}).textContent?.includes("상품 목록") === true));
  await page.click('[data-toc="SCR-EX-LST-001"]');
  await page.waitForTimeout(300);
  check("목차 행 클릭 → 정의서 전환", await page.evaluate(() => window.ScreenSpec.current()) === "SCR-EX-LST-001");
  check("화면 전환 알림 토스트", await page.evaluate(() => {
    const t = document.querySelector(".ss-nav-toast");
    return t.classList.contains("ss-show") && t.textContent.includes("상품 목록");
  }));
  /* 공개 API setScreen — wrap은 root 표시/숨김까지 동반해야 감지가 되돌리지 않는다 */
  await page.evaluate(() => window.ScreenSpec.setScreen("SCR-EX-DTL-002"));
  await page.waitForTimeout(500);
  check("setScreen → 정의서·앱 화면 동시 전환", await page.evaluate(() => {
    const lst = document.querySelector('[data-ss-screen="SCR-EX-LST-001"]');
    const dtl = document.querySelector('[data-ss-screen="SCR-EX-DTL-002"]');
    return window.ScreenSpec.current() === "SCR-EX-DTL-002" &&
      dtl.getClientRects().length > 0 && lst.style.display === "none";
  }));
  await page.evaluate(() => window.ScreenSpec.setScreen("SCR-EX-LST-001"));
  await page.waitForTimeout(500);
  check("setScreen 복귀 → 목록 화면", await page.evaluate(() => {
    const lst = document.querySelector('[data-ss-screen="SCR-EX-LST-001"]');
    const dtl = document.querySelector('[data-ss-screen="SCR-EX-DTL-002"]');
    return window.ScreenSpec.current() === "SCR-EX-LST-001" &&
      lst.getClientRects().length > 0 && dtl.style.display === "none";
  }));
  /* 모바일: 목차 = 전체 화면 시트 */
  await page.setViewportSize({ width: 480, height: 800 });
  await page.waitForTimeout(300);
  await page.click(".ss-toc-btn");
  await page.waitForTimeout(300);
  check("모바일 목차 풀스크린", await page.evaluate(() => {
    const r = document.querySelector(".ss-toc").getBoundingClientRect();
    return Math.round(r.width) === innerWidth && r.top === 0;
  }));
  await page.click(".ss-toc-x");
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ============ wrap: shop.html (대표 데모 — MOA) ============ */
  console.log("[wrap] shop.html");
  await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/shop.html");
  await page.waitForTimeout(1200);
  await page.click("#ss-mDoc");
  await page.waitForTimeout(500);
  check("MOA 홈 기능 설명 9행", (await page.locator(".ss-defs-list .ss-row").count()) === 9); /* parts 는 행을 늘리지 않는다 — 상위 행 안의 블록 (#25) */
  check("상단 바 parts 2개 → 헤더 '항목 9개 · 세부 2개' + 마커 1a·1b (#25·#30)", await page.evaluate(() => {
    const labels = [...document.querySelectorAll(".ss-marker")].map((m) => m.textContent);
    return document.getElementById("ss-cnt").textContent === "항목 9개 · 세부 2개" &&
      labels.includes("1a") && labels.includes("1b") &&
      [...document.querySelectorAll(".ss-part")].map((e) => e.dataset.part).join(",") === "1a,1b";
  }));
  check("앱형 시트 여백 0 (탭바 하단 밀착)", await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".ss-sheet"));
    return cs.paddingBottom === "0px" && cs.paddingTop === "0px";
  }));
  await page.click('[data-play="6"]');
  await page.waitForTimeout(400);
  check("쿠폰 popup → 실제 바텀시트", await page.evaluate(() => document.getElementById("couponSheet").classList.contains("open")));
  await page.click("#couponSheet .ok");
  await page.waitForTimeout(300);
  await page.click('[data-play="8"]');
  await page.waitForTimeout(500);
  check("추천 카드 flow → 상세 + 정의서 전환", await page.evaluate(() =>
    window.ScreenSpec.current() === "SCR-MOA-PDP-002" &&
    document.querySelector('[data-ss-screen="SCR-MOA-PDP-002"]').style.display !== "none"));
  await page.click('[data-play="5"]');
  await page.waitForTimeout(300);
  check("구매 바 action → 토스트", await page.evaluate(() => document.getElementById("toast").classList.contains("show")));
  await page.click('[data-play="1"]');
  await page.waitForTimeout(400);
  check("뒤로가기 flow → 홈 복귀", await page.evaluate(() => window.ScreenSpec.current() === "SCR-MOA-HOME-001"));
  await page.click('#ss-seg button[data-w="pc"]');
  await page.waitForTimeout(500);
  check("PC 반응형 훅 (그리드 4열·탭바 숨김)", await page.evaluate(() => {
    const grid = getComputedStyle(document.getElementById("recoGrid")).gridTemplateColumns.split(" ").length;
    const tab = document.querySelector(".tabbar").getClientRects().length === 0;
    return grid === 4 && tab;
  }));
  await page.click('#ss-seg button[data-w="mobile"]');

  /* ============ wrap: floating.html — 고정·플로팅 요소가 기기 화면을 벗어나지 않는가 ============
     프로토타입의 position:fixed 는 기본적으로 브라우저 창에 붙는다. 시트 밖으로 새면 폰 옆 허공에 뜨고
     우리 툴바까지 덮는다. .ss-frame 의 transform 이 이것을 가둔다 — 두 모드·두 폭 모두에서 (v0.19.2) */
  console.log("[wrap] floating.html (고정 요소 가둠)");
  await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/floating.html");
  await page.waitForTimeout(500);

  /* 시트(기기 화면) 안에 들어 있는가 — 좌우상하 전부. 여유 2px 은 그림자·반올림 */
  const inSheet = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s), sh = document.querySelector(".ss-sheet");
    if (!el || !sh) return null;
    const a = el.getBoundingClientRect(), b = sh.getBoundingClientRect();
    if (!a.width || !a.height) return null;
    return a.left >= b.left - 2 && a.right <= b.right + 2 && a.top >= b.top - 2 && a.bottom <= b.bottom + 2;
  }, sel);

  for (const [name, sel] of [["앱바", ".appbar"], ["FAB", ".fab"], ["탭바", ".tabbar"]]) {
    check("프로토타입 모드: " + name + " 가 기기 화면 안", (await inSheet(sel)) === true);
  }
  check("프로토타입 모드: 툴바가 프로토타입 위 (z 경쟁 없음)", await page.evaluate(() => {
    const tb = document.querySelector(".ss-toolbar").getBoundingClientRect();
    const hit = document.elementFromPoint(tb.left + tb.width / 2, tb.top + tb.height / 2);
    return !!(hit && hit.closest(".ss-toolbar"));
  }));

  /* 전면 모달(inset:0 · z 10000)도 폰 안에서만 덮는다 */
  await page.click("#fab");
  await page.waitForTimeout(250);
  check("프로토타입 모드: 전면 시트가 기기 화면 안", (await inSheet("#sheet")) === true);
  await page.click("#sheet .dim");
  await page.waitForTimeout(200);

  /* 본문을 스크롤해도 고정 요소는 기기 화면에 붙어 있다 (진짜 폰과 같은 거동) */
  const fabBefore = await page.evaluate(() => document.querySelector(".fab").getBoundingClientRect().top);
  await page.evaluate(() => { document.querySelector(".ss-sheet").scrollTop = 300; });
  await page.waitForTimeout(200);
  const fabAfter = await page.evaluate(() => document.querySelector(".fab").getBoundingClientRect().top);
  check("본문 스크롤에도 FAB 고정", Math.abs(fabBefore - fabAfter) < 2, [fabBefore, fabAfter]);
  await page.evaluate(() => { document.querySelector(".ss-sheet").scrollTop = 0; });

  /* 화면정의서 모드 — 고정 요소가 설명 패널을 침범하지 않는다 */
  await page.click("#ss-mDoc");
  await page.waitForTimeout(500);
  for (const [name, sel] of [["앱바", ".appbar"], ["FAB", ".fab"], ["탭바", ".tabbar"]]) {
    check("정의서 모드: " + name + " 가 기기 화면 안", (await inSheet(sel)) === true);
  }
  check("정의서 모드: 고정 요소가 설명 패널을 덮지 않음", await page.evaluate(() => {
    const pan = document.querySelector(".ss-defs").getBoundingClientRect();
    return [".appbar", ".fab", ".tabbar"].every((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return r.right <= pan.left + 1;
    });
  }));
  /* 상위 5 + 하위 5a·5b + 지금 닫혀 있는 시트 6 (optional — 패널에 「현재 미표시」) */
  check("정의서 모드: 마커 8개", (await page.locator(".ss-marker").count()) === 8);

  /* PC 폭(1920 시트 → 축소 배치)에서도 같은 규칙 */
  await page.click('#ss-seg button[data-w="pc"]');
  await page.waitForTimeout(500);
  for (const [name, sel] of [["앱바", ".appbar"], ["FAB", ".fab"], ["탭바", ".tabbar"]]) {
    check("정의서 모드 PC 폭: " + name + " 가 기기 화면 안", (await inSheet(sel)) === true);
  }
  await page.click('#ss-seg button[data-w="mobile"]');
  await page.waitForTimeout(300);

  /* ============ overlay: 하위경로(basePath) 환경 ============ */
  console.log("[overlay] SPA (하위경로 서빙)");
  const srv = http.createServer((req, res) => {
    if (req.url.endsWith("screenspec.js")) { res.setHeader("content-type", "text/javascript"); res.end(LIB); return; }
    res.setHeader("content-type", "text/html");
    res.end(fs.readFileSync(path.join(REPO, "examples/overlay-spa.html"), "utf8")
      .replace("../screenspec.js", "/screenspec.js")
      .replace("window.SCREENSPEC = {", 'window.SCREENSPEC = { accent: "#7C3AED",')); /* accent·panel 주입 (e2e 전용) */
  });
  await new Promise((r) => srv.listen(4179, r));
  const ovWarns = [];
  const onOvMsg = (msg) => { if (msg.type() === "warning") ovWarns.push(msg.text()); };
  page.on("console", onOvMsg);
  const bgBefore = "rgb(255, 255, 255)";
  await page.goto("http://localhost:4179/screenspec/examples/overlay-spa.html");
  await page.waitForTimeout(800);
  check("suffix 매칭 초기 화면", await page.evaluate(() => window.ScreenSpec.current()) === "S-01");
  check("호스트 body 배경 보존", await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === bgBefore);
  check("DOM 불변 (감싸지 않음)", await page.evaluate(() =>
    document.querySelector(".gnb").parentElement === document.body && !document.querySelector(".ss-sheet")));
  check("accent hex 적용 (#7C3AED → 토큰·활성 필 배경)", await page.evaluate(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--ss-accent").trim().toUpperCase();
    const on = document.querySelector(".ss-pill .ss-on");
    return v === "#7C3AED" && (!on || getComputedStyle(on).backgroundColor !== "rgb(41, 82, 227)");
  }));
  check("overlay UI 최대 z 대역 (≥ 2147482990)", await page.evaluate(() => {
    const z = (sel) => Number(getComputedStyle(document.querySelector(sel)).zIndex);
    return z(".ss-pill") >= 2147482990 && z(".ss-ov-panel") >= 2147482990 && z(".ss-pill") > z(".ss-ov-panel");
  }));
  await page.click("#ss-ovDoc");
  await page.waitForTimeout(400);
  check("설명 패널 오른쪽 고정 (좌/우 전환 버튼 없음)", await page.evaluate(() => {
    const r = document.querySelector(".ss-ov-panel").getBoundingClientRect();
    return r.right === innerWidth && getComputedStyle(document.body).paddingRight === "400px" && !document.querySelector("#ss-ovSide");
  }));
  check("뷰포트 끝(x:0) 대상의 마커가 잘리지 않음", await page.evaluate(() => {
    const t = document.querySelector('[data-spec="1"]').getBoundingClientRect();
    const m = document.querySelector(".ss-ov-markers .ss-marker").getBoundingClientRect();
    return t.left === 0 && m.left >= 0 && m.top >= 48;
  }));
  await page.click('[data-nav][href="./members"]'); /* 정의서 모드에서 앱 조작 */
  await page.waitForTimeout(500);
  check("정의서 모드에서 앱 내비 동작 + 추적", await page.evaluate(() => window.ScreenSpec.current()) === "S-09");
  await page.goBack();
  await page.waitForTimeout(400);
  check("뒤로가기 추적", await page.evaluate(() => window.ScreenSpec.current()) === "S-01");
  await page.evaluate(() => history.pushState({}, "", "/definitely-unmapped-xyz"));
  await page.waitForTimeout(400);
  check("미정의 화면 표시", await page.evaluate(() =>
    window.ScreenSpec.current() === "—" && !!document.querySelector(".ss-empty")));
  /* 목차 소프트 내비게이션 — overlay: route까지 실제 이동 */
  await page.click(".ss-toc-btn");
  await page.waitForTimeout(300);
  await page.click('[data-toc="S-09"]');
  await page.waitForTimeout(400);
  check("화면 5개: 목차 검색 없음", (await page.locator(".ss-toc-search").count()) === 0);
  check("목차 → route 소프트 내비게이션", await page.evaluate(() =>
    window.ScreenSpec.current() === "S-09" && location.pathname === "/members" &&
    document.body.innerText.includes("이용자 명단")));
  await page.waitForTimeout(500);
  check("목차 이동 시 '못 찾은 정의' 오경고 없음 (앱이 그려진 뒤 판정)", !ovWarns.some((w) => w.includes("S-09") && w.includes("못 찾은 정의")), ovWarns.join(" | ").slice(0, 160));
  await page.addScriptTag({ content: LIB });
  await page.waitForTimeout(300);
  check("이중 로드 가드", (await page.locator(".ss-pill").count()) === 1);
  /* 해시 라우터: #/경로 가 화면 감지에 잡히는지 */
  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForTimeout(400);
  const hash1 = await page.evaluate(() => window.ScreenSpec.current());
  await page.evaluate(() => { location.hash = "#/members"; });
  await page.waitForTimeout(400);
  const hash2 = await page.evaluate(() => window.ScreenSpec.current());
  check("해시 라우터(#/) 감지", hash1 === "S-01" && hash2 === "S-09", hash1 + "→" + hash2);
  /* 구체 경로 우선 (#15): /members/[id] 가 먼저 선언돼 있어도 /members/invite 는 초대 화면 */
  await page.evaluate(() => { location.hash = ""; history.pushState({}, "", "/members/invite"); });
  await page.waitForTimeout(400);
  const spec1 = await page.evaluate(() => window.ScreenSpec.current());
  await page.evaluate(() => history.pushState({}, "", "/members/123"));
  await page.waitForTimeout(400);
  const spec2 = await page.evaluate(() => window.ScreenSpec.current());
  check("라우트 구체성 우선 (선언 순서 무관)", spec1 === "S-11" && spec2 === "S-10", spec1 + "/" + spec2);
  /* 등록됐지만 specs 가 빈 화면 — 백지 대신 다음 할 일 안내 (#19). 현재 /members/123 = S-10(specs []) */
  check("빈 specs 화면 안내 + data-spec 개수", await page.evaluate(() => {
    const e = document.querySelector(".ss-ov-panel .ss-empty");
    const n = document.querySelectorAll("[data-spec]").length;
    return !!e && e.textContent.includes("기능 설명이 아직 없습니다") && e.textContent.includes("S-10") &&
      e.textContent.includes("data-spec 이 붙은 요소: " + n + "개") && document.querySelector("#ss-ovCnt").textContent === "항목 0개";
  }));
  await page.evaluate(() => history.pushState({}, "", "/members"));
  await page.waitForTimeout(400);
  /* 라우트 없는 root 화면(패널) — 열리면 자동 전환, 닫히면 라우트 화면 복귀 (여기서 현재 화면은 S-09) */
  await page.click("tbody tr:first-child .rowbtn");
  await page.waitForTimeout(300);
  check("패널 열림 → 라우트 없는 root 화면 감지", await page.evaluate(() => window.ScreenSpec.current()) === "S-03");
  await page.click("#detailPanel .pclose");
  await page.waitForTimeout(300);
  check("패널 닫힘 → 라우트 화면 복귀", await page.evaluate(() => window.ScreenSpec.current()) === "S-09");
  /* setScreen 후 DOM이 계속 변해도 감지가 되돌리지 않는다 */
  await page.click("tbody tr:first-child .rowbtn");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.ScreenSpec.setScreen("S-03"));
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.textContent = "mutation probe";
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 60);
    });
    await page.waitForTimeout(250);
  }
  check("setScreen 유지 (DOM 변경 1초)", await page.evaluate(() => window.ScreenSpec.current()) === "S-03");
  await page.click("#detailPanel .pclose");
  await page.waitForTimeout(300);
  /* 앱 폭 표시 + overlay 반응형 훅 (#17 최소안). 현재 정의서 모드·패널 우측(400px) */
  const vw = async () => page.evaluate(() => ({ t: document.getElementById("ss-ovVw").textContent, pc: document.body.classList.contains("ss-pc"), nr: document.body.classList.contains("ss-narrow") }));
  await page.waitForTimeout(200);
  const w1 = await vw();
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(300);
  const w2 = await vw();
  await page.setViewportSize({ width: 480, height: 800 });
  await page.waitForTimeout(300);
  const w3 = await vw();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  check("헤더 앱 폭 표시 (뷰포트 − 패널)", w1.t === "1040px" && w2.t === "1200px" && w3.t === "480px", JSON.stringify([w1, w2, w3]));
  check("overlay body 반응형 훅 .ss-pc/.ss-narrow", !w1.pc && !w1.nr && w2.pc && !w3.pc && w3.nr, JSON.stringify([w1, w2, w3]));
  page.off("console", onOvMsg);
  srv.close();


  /* ============ frame: 액자 모드 (같은 SPA 예제를 iframe 에 담고 뷰어는 바깥) ============ */
  console.log("[frame] SPA (액자 모드)");
  const srvF = http.createServer((req, res) => {
    if (req.url.endsWith("screenspec.js")) { res.setHeader("content-type", "text/javascript"); res.end(LIB); return; }
    res.setHeader("content-type", "text/html");
    res.end(fs.readFileSync(path.join(REPO, "examples/overlay-spa.html"), "utf8")
      .replace("../screenspec.js", "/screenspec.js")
      .replace('mode: "overlay"', 'mode: "frame"')); /* 모드 주입 (e2e 전용) */
  });
  await new Promise((r) => srvF.listen(4180, r));
  const F = 'iframe[data-ss-frame]';
  const inFrame = () => page.frameLocator(F);
  const state = () => page.evaluate(() => {
    const f = document.querySelector("iframe[data-ss-frame]");
    return {
      cur: window.ScreenSpec.current(),
      outer: location.pathname,
      inner: f.contentWindow.location.pathname
    };
  });
  await page.goto("http://localhost:4180/screenspec/examples/overlay-spa.html");
  await page.waitForTimeout(1200);
  check("frame 부팅: 시트 안 액자 1개 + 툴바 + 바깥 앱 DOM 숨김", await page.evaluate(() => {
    const f = document.querySelectorAll(".ss-sheet iframe[data-ss-frame]");
    const gnb = document.querySelector("body .gnb");
    const hidden = !!gnb && (gnb.offsetParent === null || getComputedStyle(gnb).display === "none");
    return f.length === 1 && !!document.querySelector(".ss-toolbar") && hidden &&
      window.ScreenSpec.mode === "frame" && window.ScreenSpec.current() === "S-01";
  }));
  check("액자 안 인스턴스는 UI 를 만들지 않는다", await page.evaluate(() => {
    const d = document.querySelector("iframe[data-ss-frame]").contentDocument;
    return d.querySelectorAll(".ss-pill,.ss-toolbar,.ss-sheet").length === 0 && !!d.querySelector(".gnb");
  }));
  await page.click("#ss-mDoc");
  await page.waitForTimeout(900); /* 액자는 DOM 이동으로 재로드된다 */
  const mk = await page.evaluate(() => {
    const f = document.querySelector("iframe[data-ss-frame]");
    const ir = f.getBoundingClientRect();
    const t = f.contentDocument.querySelector('[data-spec="1"]').getBoundingClientRect();
    const m = [...document.querySelectorAll(".ss-markers .ss-marker")].find((e) => e.textContent === "1").getBoundingClientRect();
    return { dl: Math.round(Math.abs(m.left - (ir.left + t.left))), dt: Math.round(Math.abs(m.top - (ir.top + t.top))) };
  });
  check("정의서 모드: 마커가 액자 안 대상 위 (±14px)", mk.dl <= 14 && mk.dt <= 14, JSON.stringify(mk));
  /* 액자는 앱이 iframe 안이라 «옮길 시트» 가 없다. same-origin 이 조건이므로 안쪽 문서를 직접 뜬다 (#40) */
  const frImg = await page.evaluate(async () => {
    const r = await window.ScreenSpec.exportImage({ markers: true, head: true });
    return { ok: r.ok, w: r.w, h: r.h, ink: r.ink, why: r.why };
  });
  check("frame: 액자 안 문서를 떠서 PNG 로 뽑는다", frImg.ok === true, JSON.stringify(frImg));
  check("frame: 백지가 아니다", frImg.ink > 0.5, JSON.stringify(frImg));
  check("frame: 내보낸 뒤 조립 상자가 남지 않고 액자도 그대로", await page.evaluate(() =>
    document.querySelectorAll(".ss-cap").length === 0 &&
    document.querySelectorAll(".ss-sheet iframe[data-ss-frame]").length === 1));
  const widthOf = () => page.evaluate(() => {
    const f = document.querySelector("iframe[data-ss-frame]");
    return { w: f.clientWidth, dir: f.contentWindow.getComputedStyle(f.contentDocument.querySelector(".gnb")).flexDirection };
  });
  await page.click('#ss-seg button[data-w="pc"]');
  await page.waitForTimeout(600);
  const fPc = await widthOf();
  await page.click('#ss-seg button[data-w="mobile"]');
  await page.waitForTimeout(600);
  const fMo = await widthOf();
  check("툴바 모바일/PC → 액자 폭 + 앱 미디어쿼리 실제 발화", fPc.w === 1920 && fPc.dir === "row" && fMo.w === 360 && fMo.dir === "column", JSON.stringify([fPc, fMo]));
  await inFrame().locator('[data-nav][href="./members"]').click();
  await page.waitForTimeout(600);
  const fNav = await state();
  check("액자 안 내비 → 화면 추적 + 바깥 주소 미러링", fNav.cur === "S-09" && fNav.inner.endsWith("/members") && fNav.outer === fNav.inner, JSON.stringify(fNav));
  await page.click(".ss-toc-btn");
  await page.waitForTimeout(300);
  await page.click('[data-toc="S-01"]');
  await page.waitForTimeout(600);
  const fToc = await state();
  check("목차 → 액자 안 경로 이동", fToc.cur === "S-01" && fToc.inner.endsWith("/home"), JSON.stringify(fToc));
  await inFrame().locator('[data-nav][href="./members"]').click();
  await page.waitForTimeout(600);
  await inFrame().locator("tbody tr:first-child .rowbtn").click();
  await page.waitForTimeout(500);
  check("액자 안 패널 열림 → 라우트 없는 root 화면 감지", (await state()).cur === "S-03");
  await inFrame().locator("#detailPanel .pclose").click();
  await page.waitForTimeout(500);
  check("액자 안 패널 닫힘 → 라우트 화면 복귀", (await state()).cur === "S-09");
  await page.click('.ss-defs-list [data-play="3"]');
  await page.waitForTimeout(500);
  check("▶ 재생이 액자 안 요소를 클릭", await page.evaluate(() => {
    const b = document.querySelector("iframe[data-ss-frame]").contentDocument.querySelector(".invite");
    return !!b && b.dataset.opened === "1";
  }));
  check("활성 영역 강조가 액자 안 문서에서 그려진다", await page.evaluate(() => {
    const d = document.querySelector("iframe[data-ss-frame]").contentDocument;
    const t = d.querySelector(".ss-hl");
    return !!t && t.getAttribute("data-spec") === "3" && !!d.getElementById("ss-frame-css");
  }));
  srvF.close();


  /* ============ 문서 검증: README 빠른 시작이 진짜 동작하는가 ============
     README의 복붙 예제를 그대로 실행한다. API가 바뀌었는데 문서를 안 고치면 여기서 FAIL. */
  console.log("[docs] README 빠른 시작 예제");
  {
    const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
    const m = readme.match(/```html\r?\n([\s\S]*?)```/);
    const html = (m ? m[1] : "").replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>/, "");
    await page.goto("about:blank");
    await page.setContent(html);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(800);
    check("빠른 시작: 모드 토글 생성", (await page.locator("#ss-mDoc").count()) === 1);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(500);
    check("빠른 시작: 화면 ID 헤더", await page.evaluate(() => document.body.innerText.includes("SCR-RPT-001")));
    check("빠른 시작: 기능 설명 2행", (await page.locator(".ss-defs-list .ss-row").count()) === 2);
    check("위치 힌트 자동 (헤더 → '상단' 포함)", await page.evaluate(() => (document.querySelector('[data-defrow="1"] .ss-pos') || {}).textContent?.startsWith("상단") === true));
    check("빠른 시작: 마커 2개", (await page.locator(".ss-marker").count()) === 2);
    await page.click('[data-play="2"]');
    await page.waitForTimeout(400);
    check("빠른 시작: 동작 재생이 실제로 동작", await page.evaluate(() => document.getElementById("save").textContent === "저장됨"));
  }

  /* ============ 누락 경고: 어느 정의가 빠졌는지 + state 제외 (#20) ============ */
  console.log("[docs] 누락 정의 경고");
  {
    const warns = [];
    const onMsg = (msg) => { if (msg.type() === "warning") warns.push(msg.text()); };
    page.on("console", onMsg);
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">A</div><script>window.SCREENSPEC={screen:{id:"S-X",name:"x"},specs:[' +
      '{n:1,target:"1",title:"있음",defs:[{t:"사양 한 줄",why:"근거 한 줄"}]},{n:2,target:"2",title:"없음"},{n:3,target:"3",title:"조건부",anno:"state"},{n:4,target:"4",title:"없음2"},{n:5,target:"5",title:"조건부 버튼",anno:"action",optional:true}]}</script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    /* 못 찾은 게 있으면 경고는 상한(5초)에 나온다 — 조용해졌다고 다 온 것은 아니므로 (#23 개정).
       고정 대기 대신 «도착할 때까지» 로 잡는다 (경합 방지) */
    const missW = () => warns.filter((x) => x.includes("못 찾은 정의"));
    for (let i = 0; i < 80 && missW().length === 0; i++) await page.waitForTimeout(100);
    const w = missW();
    check("지금 화면에 없는 정의는 패널에서 '현재 미표시' (#27)", await page.evaluate(() => {
      const c = (n) => document.querySelector('[data-defrow="' + n + '"]').classList.contains("ss-now-hidden");
      return !c(1) && c(2) && c(3) && c(4) && getComputedStyle(document.querySelector('[data-defrow="2"] .ss-nowtag')).display !== "none";
    }));
    check("누락 경고 1회 + #n target 나열 + state 제외", w.length === 1 && w[0].includes("2건") &&
      w[0].includes('#2 target="2"') && w[0].includes('#4 target="4"') && !w[0].includes("#3") && !w[0].includes("#5") && w[0].includes("조건부(state·optional) 2건"), w.join(" | ").slice(0, 200));
    check("def.why → '↳ 이유:' 로 분리 렌더 (#24)", await page.evaluate(() => {
      const el = document.querySelector('[data-defrow="1"] .ss-why');
      return !!el && el.textContent === "근거 한 줄" && getComputedStyle(el, "::before").content.includes("이유");
    }));
    page.off("console", onMsg);
    const warns2 = [];
    const onMsg2 = (msg) => { if (msg.type() === "warning") warns2.push(msg.text()); };
    page.on("console", onMsg2);
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">A</div><script>window.SCREENSPEC={screen:{id:"S-Y",name:"y"},specs:[' +
      '{n:1,target:"1",title:"있음"},{n:2,target:"2",title:"조건부",anno:"state"}]}</script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(1700); /* 판정은 앱 DOM 이 1.5초 조용한 뒤 (#23) */
    check("state 만 누락이면 경고 없음", !warns2.some((x) => x.includes("못 찾은 정의")), warns2.join(" | ").slice(0, 200));
    page.off("console", onMsg2);
  }
  /* 비동기 조회 화면 (#23): 스켈레톤 뒤 본문 — 늦게 온 요소는 경고에서 빠져야 한다.
     경고는 «조용해지면» 이 아니라 «상한(5초)» 에 나온다 — 조용하다고 다 온 것은 아니기 때문이다.
     전부 찾으면 그 전에 조용히 끝난다(경고 없음). 그래서 대기는 고정이 아니라 «도착할 때까지» 로 잡는다 */
  for (const [라벨, 지연] of [["0.7초", 700], ["2.5초(조용한 뒤 도착)", 2500]]) {
    const warns3 = [];
    const onMsg3 = (msg) => { if (msg.type() === "warning") warns3.push(msg.text()); };
    page.on("console", onMsg3);
    await page.goto("about:blank");
    await page.setContent('<div id="app">로딩 중…</div><script>window.SCREENSPEC={screen:{id:"S-A",name:"a"},specs:[' +
      '{n:1,target:"1",title:"본문"},{n:2,target:"2",title:"버튼"},{n:9,target:"9",title:"진짜 누락"}]};' +
      'setTimeout(()=>{document.getElementById("app").innerHTML=\'<div data-spec="1">본문</div><button data-spec="2">저장</button>\';},' + 지연 + ');</script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    const miss = () => warns3.filter((x) => x.includes("못 찾은 정의"));
    /* 데이터가 오기 전에는 경고가 없어야 한다 (조용해졌다고 성급히 판정하면 안 된다) */
    await page.waitForTimeout(지연 + 300);
    check("비동기 " + 라벨 + ": 데이터 도착 전에는 경고 없음", miss().length === 0, miss().join(" | ").slice(0, 160));
    /* 상한까지 기다린다 — 고정 대기가 아니라 도착할 때까지 (경합 방지) */
    for (let i = 0; i < 80 && miss().length === 0; i++) await page.waitForTimeout(100);
    const late = miss();
    check("비동기 " + 라벨 + ": 진짜 누락 #9 만 경고 · 늦게 온 #1·#2 는 제외",
      late.length === 1 && late[0].includes('#9 target="9"') && !late[0].includes('#1 ') && !late[0].includes('#2 '),
      late.join(" | ").slice(0, 160));
    page.off("console", onMsg3);
  }


  /* ============ parts: 영역 안의 이름 있는 하위 요소 + 자동 라벨 (#25) ============ */
  console.log("[docs] parts");
  {
    const partsCfg = (extra) => '<div data-spec="1">상단<span data-spec="1a" onclick="document.getElementById(\'pop\').hidden=false">3</span></div>' +
      '<div id="pop" hidden>팝업</div><script>window.SCREENSPEC={screen:{id:"S-P",name:"parts"},specs:[' +
      '{n:1,target:"1",title:"상단 타이틀 영역",defs:[{t:"화면 상단에 고정"}],parts:[' +
      '{title:"항목 수",target:"1a",anno:"popup",play:{selector:"[data-spec=\'1a\']",label:"팝업 열기"},defs:[{t:"항목 개수를 1~99까지 표시"}]},' +
      '{title:"더보기 버튼",defs:[{t:"팝업을 버튼 아래에 표시"}]}' + extra + ']}]}<\/script>';
    await page.goto("about:blank");
    await page.setContent(partsCfg(""));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("parts: 상위 행 1개 안에 하위 블록 1a·1b 순서대로 (라벨은 라이브러리가 매김)", await page.evaluate(() => {
      const rows = document.querySelectorAll(".ss-defs-list .ss-row").length;
      const parts = [...document.querySelectorAll(".ss-part")];
      return rows === 1 && parts.length === 2 &&
        parts.map((e) => e.dataset.part).join(",") === "1a,1b" &&
        parts.map((e) => e.querySelector(".ss-part-no").textContent).join(",") === "1a,1b" &&
        parts[0].closest(".ss-row").dataset.defrow === "1" &&
        parts[0].querySelector(".ss-t").textContent === "항목 수";
    }));
    check("parts: 마커는 1 · 1a 만 (target 없는 1b 는 패널 전용)", await page.evaluate(() => {
      const ms = [...document.querySelectorAll(".ss-marker")];
      const vis = ms.filter((m) => m.style.display !== "none").map((m) => m.textContent);
      return vis.join(",") === "1,1a" && !ms.some((m) => m.textContent === "1b");
    }));
    await page.click(".ss-marker.ss-marker-sub");
    await page.waitForTimeout(300);
    check("parts: 하위 마커 클릭 → 대상 강조 + 하위 블록 활성", await page.evaluate(() =>
      document.querySelector('[data-spec="1a"]').classList.contains("ss-hl") &&
      document.querySelector('.ss-part[data-part="1a"]').classList.contains("ss-active")));
    await page.click('[data-play="1a"]');
    await page.waitForTimeout(300);
    check("parts: 하위 ▶ 가 실제 팝업을 연다", await page.evaluate(() => !document.getElementById("pop").hidden));
    check("parts: 헤더 항목 수 '항목 1개 · 세부 2개' (#30)", await page.evaluate(() => document.getElementById("ss-cnt").textContent === "항목 1개 · 세부 2개"));

    const pWarns = [];
    const onPMsg = (msg) => { if (msg.type() === "warning") pWarns.push(msg.text()); };
    page.on("console", onPMsg);
    await page.goto("about:blank");
    await page.setContent(partsCfg(',{title:"없는 하위",target:"1c-none"}'));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    /* 못 찾은 게 있으면 경고는 상한(5초)에 나온다 — 조용해졌다고 다 온 것은 아니므로 (#23 개정).
       고정 대기 대신 «도착할 때까지» 로 잡는다 (경합 방지) */
    const missP = () => pWarns.filter((x) => x.includes("못 찾은 정의"));
    for (let i = 0; i < 80 && missP().length === 0; i++) await page.waitForTimeout(100);
    const pw = missP();
    check("parts: target 없는 하위 요소도 누락 경고에 #1c 로 나온다", pw.length === 1 && pw[0].includes('#1c target="1c-none"') && pw[0].includes("1건"), pw.join(" | ").slice(0, 200));
    page.off("console", onPMsg);
  }

  /* ============ accent = CSS 변수 참조 (#18) ============ */
  console.log("[docs] accent var(--x)");
  {
    await page.goto("about:blank");
    await page.setContent('<style>:root{--brand:#123456}</style><div data-spec="1">A</div><script>window.SCREENSPEC={accent:"var(--brand)",screen:{id:"S-V",name:"v"},specs:[{n:1,target:"1",title:"a",anno:"arrow"}]}</script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click(".ss-marker");
    await page.waitForTimeout(300);
    check("accent var(--brand) → 토큰 대입 + 화살표 stroke 실제 색", await page.evaluate(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--ss-accent").trim();
      const st = getComputedStyle(document.getElementById("ss-line")).stroke;
      const hot = getComputedStyle(document.querySelector(".ss-marker.ss-hot")).backgroundColor;
      return v === "#123456" /* computed 는 var() 치환값 */ && st === "rgb(18, 52, 86)" && hot === "rgb(18, 52, 86)";
    }));
  }

  /* ============ 목차 검색 (#9): 화면 8개 이상 ============ */
  console.log("[docs] 목차 검색");
  {
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">A</div><script>window.SCREENSPEC={screens:[' +
      [["S-01","홈",["홈"]],["S-02","목록",["홈","이용자","목록"]],["S-03","초대",["홈","이용자","초대"]],["S-04","상세",["홈","이용자","상세"]],
       ["S-05","계약",["홈","계약"]],["S-06","정산",["홈","정산"]],["S-07","설정",["홈","설정"]],["S-08","알림",["홈","설정","알림"]],
       ["S-09","프로필",["홈","설정","프로필"]],["S-10","로그",["홈","로그"]]]
        .map(([id,name,path]) => JSON.stringify({ id, name, path, specs: [{ n: 1, target: "1", title: "t" }], viewports: id === "S-10" ? ["pc"] : undefined })).join(",") + '],baseViewport:"pc"}</script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click(".ss-toc-btn");
    await page.waitForTimeout(300);
    check("화면 10개: 목차 검색 입력 존재", (await page.locator(".ss-toc-search input").count()) === 1);
    check("viewports:['pc'] → 목차 'PC 전용' 배지 (#17)", await page.evaluate(() => document.querySelector('[data-toc="S-10"] .ss-toc-vp')?.textContent === "PC 전용" && !document.querySelector('[data-toc="S-01"] .ss-toc-vp')));
    check("baseViewport:'pc' → 시작 폭 PC (#17)", await page.evaluate(() => document.querySelector('#ss-seg button[data-w="pc"]').getAttribute("aria-pressed") === "true" && document.querySelector(".ss-sheet").style.width === "1920px" /* 정의서 모드는 화면에 맞춰 축소되므로 설정값으로 */));
    await page.fill(".ss-toc-search input", "초대");
    await page.waitForTimeout(200);
    const vis = () => page.evaluate(() => [...document.querySelectorAll(".ss-toc-body > *")].filter((r) => r.style.display !== "none").map((r) => r.dataset.toc || "grp:" + r.textContent.trim()));
    const v1 = await vis();
    check("검색 '초대' → 매칭 행 + 조상(홈 화면·이용자 그룹)만", v1.length === 3 && v1[0] === "S-01" && v1[1] === "grp:이용자" && v1[2] === "S-03", JSON.stringify(v1));
    await page.fill(".ss-toc-search input", "");
    await page.waitForTimeout(200);
    const v2 = await vis();
    check("검색 비우면 전부 복원", v2.filter((x) => !x.startsWith("grp:")).length === 10, String(v2.length));
    await page.click(".ss-toc-x");
  }

  /* ============ 상태 커버리지 (#26): checklist × covers/skip ============ */
  console.log("[docs] checklist");
  {
    const covHtml = (head) => '<div data-ss-screen="S-A"><div data-spec="1">A</div></div>' +
      '<div data-ss-screen="S-B"><div data-spec="1">B</div></div>' +
      '<div data-ss-screen="S-C"><div data-spec="1">C</div></div>' +
      "<script>window.SCREENSPEC={" + head + "screens:[" +
      [["S-A", "다 채운 화면", { covers: ["빈 상태", "오류"], skip: { "로딩": "조회가 없다" } }],
       ["S-B", "덜 채운 화면", { covers: ["빈 상태"] }],
       ["S-C", "사유 없는 화면", { covers: ["없는축"], skip: { "오류": "" } }]]
        .map(([id, name, meta]) => JSON.stringify(Object.assign({
          id, name, path: ["홈", name], root: '[data-ss-screen="' + id + '"]',
          specs: [{ n: 1, target: "1", title: "영역" }]
        }, meta))).join(",") + "]}<\/script>";

    const cWarns = [];
    const onCMsg = (msg) => { if (msg.type() === "warning") cWarns.push(msg.text()); };
    page.on("console", onCMsg);
    await page.goto("about:blank");
    await page.setContent(covHtml('checklist:["빈 상태","로딩","오류"],'));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("커버리지: 다 채운 화면 → 아무것도 안 뜬다 (체크리스트는 다 채우면 사라진다)", await page.evaluate(() => {
      const el = document.querySelector(".ss-cov");
      return !el;
    }));
    await page.click(".ss-toc-btn");
    await page.waitForTimeout(300);
    check("커버리지: 미정의 0인 화면은 목차 배지 없음 (조용히)", await page.evaluate(() =>
      !document.querySelector('[data-toc="S-A"] .ss-toc-cov')));
    check("커버리지: 목차 배지 '⚠ 로딩 · 오류 미정의'", await page.evaluate(() =>
      (document.querySelector('[data-toc="S-B"] .ss-toc-cov') || {}).textContent === "⚠ 로딩 · 오류 미정의"));
    check("커버리지: 사유 없는 skip 은 비운 것으로 치지 않는다 (배지에 오류 포함)", await page.evaluate(() => {
      const t = (document.querySelector('[data-toc="S-C"] .ss-toc-cov') || {}).textContent || "";
      return t === "⚠ 빈 상태 · 로딩 · 오류 미정의";
    }));
    await page.click(".ss-toc-x");
    await page.waitForTimeout(200);
    await page.evaluate(() => window.ScreenSpec.setScreen("S-B"));
    await page.waitForTimeout(300);
    check("커버리지: 패널 ⚠ 줄이 미정의 축을 나열", await page.evaluate(() => {
      const el = document.querySelector(".ss-cov");
      const miss = el && el.querySelector(".ss-cov-miss");
      return !!miss && miss.textContent === "⚠ 이 화면에 「로딩 · 오류」 설명이 없습니다" &&
        el.innerText.includes("해당 없음") && el.title.includes("checklist"); /* 카드가 스스로 설명한다 */
    }));
    check("커버리지: 사유 없는 skip · checklist 밖 covers 경고", 
      cWarns.some((w) => w.includes('skip "오류" 에 사유가 없습니다')) &&
      cWarns.some((w) => w.includes('covers "없는축" 는 checklist 에 없음')), cWarns.join(" | ").slice(0, 200));
    page.off("console", onCMsg);

    /* checklist 가 없으면 아무 것도 달라지지 않는다 */
    const nWarns = [];
    const onNMsg = (msg) => { if (msg.type() === "warning") nWarns.push(msg.text()); };
    page.on("console", onNMsg);
    await page.goto("about:blank");
    await page.setContent(covHtml(""));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click(".ss-toc-btn");
    await page.waitForTimeout(300);
    check("checklist 없으면 커버리지 UI 자체가 없음 (.ss-cov · .ss-toc-cov 0개)", await page.evaluate(() =>
      document.querySelectorAll(".ss-cov").length === 0 && document.querySelectorAll(".ss-toc-cov").length === 0));
    check("checklist 없으면 covers·skip 경고도 없음", !nWarns.some((w) => w.includes("covers") || w.includes("skip")), nWarns.join(" | ").slice(0, 160));
    await page.click(".ss-toc-x");
    page.off("console", onNMsg);

    /* 잘못된 checklist → 경고 후 기능 꺼짐 */
    const bWarns = [];
    const onBMsg = (msg) => { if (msg.type() === "warning") bWarns.push(msg.text()); };
    page.on("console", onBMsg);
    await page.goto("about:blank");
    await page.setContent(covHtml("checklist:[],"));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("checklist 가 빈 배열 → 경고 + 기능 꺼짐", await page.evaluate(() => document.querySelectorAll(".ss-cov").length === 0) &&
      bWarns.some((w) => w.includes("checklist 는 문자열 배열이어야 합니다")), bWarns.join(" | ").slice(0, 160));
    page.off("console", onBMsg);
  }

  /* ============ 상태 재현 (#27): preview 이벤트 ============
     빈 상태·오류처럼 지금 화면에 없는 상태는 클릭할 요소가 없다 — 라이브러리는 표준 이벤트를 쏘고 앱이 만든다.
     앱이 detail.handled = true 로 확인응답을 해야 버튼이 켜진다 (아무도 안 들으면 그 사실을 행에 적는다). */
  console.log("[docs] preview");
  {
    const LISTENER = 'window.__pv=[];addEventListener("screenspec:preview",function(e){' +
      'window.__pv.push(e.detail.n+":"+e.detail.on+":"+e.detail.screen+":"+e.detail.title);' +
      'if(e.detail.n!=="9")return;' +
      'document.getElementById("list").hidden=e.detail.on;' +
      'document.getElementById("empty").hidden=!e.detail.on;' +
      'e.detail.handled=true;});';
    const BODY = '<div id="list" data-spec="1">목록</div><div id="empty" hidden>이 기간에 방문이 없습니다</div>';
    const CFG = 'window.SCREENSPEC={screen:{id:"S-PV",name:"목록"},specs:[' +
      '{n:1,target:"1",title:"목록 영역"},' +
      '{n:9,target:"9",anno:"state",title:"목록 공백 상태",preview:{label:"빈 상태 보기"},defs:[{t:"표시문구 : 이 기간에 방문이 없습니다"}]}]};';

    /* 1) 리스너가 있는 앱 — 실제로 화면이 바뀌고 버튼이 눌린 상태로 남는다 */
    await page.goto("about:blank");
    await page.setContent(BODY + "<script>" + CFG + LISTENER + "<\/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("preview: 스위치 라벨(기호 없음) + ss-play 액센트 상속", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      return !!b && b.textContent.trim() === "빈 상태 보기" && b.dataset.pvlabel === "빈 상태 보기" &&
        b.classList.contains("ss-play") && b.classList.contains("ss-preview") && b.getAttribute("aria-pressed") === "false";
    }));
    /* 스위치 모양 — 트랙(::before)·노브(::after)를 CSS 로 그린다. 꺼졌을 땐 노브가 왼쪽 (#29 ①) */
    check("preview: ▶ 가 아니라 스위치 모양 (트랙 22×13 + 노브, 노브는 왼쪽)", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      const track = getComputedStyle(b, "::before"), knob = getComputedStyle(b, "::after");
      return track.width === "22px" && track.height === "13px" && knob.width === "9px" &&
        (knob.transform === "none" || knob.transform === "matrix(1, 0, 0, 1, 0, 0)");
    }));
    check("preview: 재현 중 띠는 기본으로 숨어 있다", await page.evaluate(() => {
      const bar = document.querySelector(".ss-pvbar");
      return !!bar && getComputedStyle(bar).display === "none";
    }));
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(300);
    check("preview: 앱이 실제로 상태를 만든다 + 버튼 눌린 상태", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      return document.getElementById("list").hidden === true && document.getElementById("empty").hidden === false &&
        b.getAttribute("aria-pressed") === "true" && b.classList.contains("ss-on") &&
        window.__pv.join("|") === "9:true:S-PV:목록 공백 상태";
    }));
    /* ② 되돌리는 방법이 그 자리에 있어야 한다 — 켜지면 라벨이 「원래대로」 */
    check("preview: 켜지면 라벨이 「원래대로」 (되돌리는 법이 그 자리에)", await page.evaluate(() =>
      document.querySelector('[data-preview="9"]').textContent.trim() === "원래대로"));
    check("preview: 켜지면 노브가 오른쪽으로 간다", await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-preview="9"]'), "::after").transform === "matrix(1, 0, 0, 1, 9, 0)"));
    /* ③ 앱만 보는 사람에게도 가짜 상태임이 보여야 한다 — 앱 위 띠 */
    check("preview: 켜진 동안 앱 위에 재현 중 띠 (항목명 포함)", await page.evaluate(() => {
      const bar = document.querySelector(".ss-pvbar");
      const cs = getComputedStyle(bar);
      return cs.display !== "none" && cs.position === "fixed" && cs.top === "50px" &&
        bar.textContent.includes("「목록 공백 상태」 재현 중") && bar.textContent.includes("실제 데이터가 아닙니다");
    }));
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(300);
    check("preview: 다시 누르면 on:false → 원래 화면 복귀", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      return document.getElementById("list").hidden === false && document.getElementById("empty").hidden === true &&
        b.getAttribute("aria-pressed") === "false" && !b.classList.contains("ss-on") &&
        b.textContent.trim() === "빈 상태 보기" &&
        window.__pv.join("|").endsWith("9:false:S-PV:목록 공백 상태");
    }));
    check("preview: 끄면 띠도 사라진다", await page.evaluate(() =>
      getComputedStyle(document.querySelector(".ss-pvbar")).display === "none"));
    /* 띠의 「끄기」 = 스위치를 끄는 것과 같은 경로 (앱은 on:false 를 받는다) */
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(200);
    await page.click(".ss-pvbar-x");
    await page.waitForTimeout(300);
    check("preview: 띠의 「끄기」로도 꺼진다 (앱에 on:false + 띠 숨김)", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      return window.__pv.slice(-1)[0] === "9:false:S-PV:목록 공백 상태" &&
        getComputedStyle(document.querySelector(".ss-pvbar")).display === "none" &&
        b.getAttribute("aria-pressed") === "false" && document.getElementById("list").hidden === false;
    }));
    /* ④ 「현재 미표시」 배지 ↔ 스위치 — 지금 없는 항목의 배지를 눌러도 켜진다 */
    check("preview: 지금 없는 항목의 「현재 미표시」 배지가 눌리는 배지가 된다", await page.evaluate(() => {
      const tag = document.querySelector("#ss-def-9 .ss-nowtag");
      return !!tag && tag.getAttribute("role") === "button" && tag.getAttribute("tabindex") === "0" &&
        tag.title.includes("재현") && getComputedStyle(tag).cursor === "pointer";
    }));
    check("preview: preview 없는 항목의 배지는 그대로 (비클릭)", await page.evaluate(() => {
      const tag = document.querySelector("#ss-def-1 .ss-nowtag");
      return !!tag && !tag.hasAttribute("role") && !tag.hasAttribute("tabindex");
    }));
    await page.click("#ss-def-9 .ss-nowtag");
    await page.waitForTimeout(300);
    check("preview: 배지를 누르면 스위치와 같은 경로로 켜진다", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      return window.__pv.slice(-1)[0] === "9:true:S-PV:목록 공백 상태" &&
        b.getAttribute("aria-pressed") === "true" && b.textContent.trim() === "원래대로" &&
        document.getElementById("empty").hidden === false &&
        getComputedStyle(document.querySelector(".ss-pvbar")).display !== "none";
    }));
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(200);

    /* 2) 아무도 안 듣는 앱 — 죽은 버튼이 아니라 「앱이 아직 못 만든다」로 읽혀야 한다 */
    const infos = [];
    const onInfo = (msg) => { if (msg.type() === "info") infos.push(msg.text()); };
    page.on("console", onInfo);
    await page.goto("about:blank");
    await page.setContent(BODY + "<script>" + CFG + "<\/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(300);
    check("preview: 듣는 앱이 없으면 행에 안내 + 버튼은 안 켜짐", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="9"]');
      const n = document.querySelector(".ss-preview-none");
      return !!n && n.textContent.includes("아직 이 상태를 만들지 못합니다") &&
        b.getAttribute("aria-pressed") === "false" && !b.classList.contains("ss-on") &&
        document.getElementById("list").hidden === false;
    }));
    check("preview: 듣는 앱이 없으면 콘솔로도 1회 안내", infos.filter((t) => t.includes("screenspec:preview 이벤트를 들어야")).length === 1,
      infos.join(" | ").slice(0, 200));
    page.off("console", onInfo);

    /* 3) 한 번에 하나만 — 켜기 전에 켜져 있던 것을 끈다 (상태 두 개가 겹쳐 뜨지 않게) */
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">목록</div><script>window.SCREENSPEC={screen:{id:"S-PV2",name:"목록"},specs:[' +
      '{n:1,target:"1",title:"목록 영역"},' +
      '{n:9,target:"9",anno:"state",title:"공백",preview:{}},' +
      '{n:10,target:"10",anno:"state",title:"오류",preview:{label:"오류 보기"}}]};' +
      'window.__pv=[];addEventListener("screenspec:preview",function(e){window.__pv.push(e.detail.n+":"+e.detail.on);e.detail.handled=true;});<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("preview: label 생략 시 「{title} 보기」", await page.evaluate(() =>
      document.querySelector('[data-preview="9"]').textContent.trim() === "공백 보기"));
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(200);
    await page.click('[data-preview="10"]');
    await page.waitForTimeout(300);
    check("preview: 두 번째를 켜면 첫 번째가 먼저 꺼진다 (동시에 하나만)", await page.evaluate(() =>
      window.__pv.join("|") === "9:true|9:false|10:true" &&
      document.querySelector('[data-preview="9"]').getAttribute("aria-pressed") === "false" &&
      document.querySelector('[data-preview="9"]').textContent.trim() === "공백 보기" &&
      document.querySelector('[data-preview="10"]').getAttribute("aria-pressed") === "true" &&
      document.querySelector('[data-preview="10"]').textContent.trim() === "원래대로"));
    check("preview: 띠는 지금 켜진 항목의 이름을 말한다", await page.evaluate(() =>
      document.querySelector(".ss-pvbar").textContent.includes("「오류」 재현 중")));

    /* 4) 화면이 바뀌면 꺼진다 — 앱이 가짜 상태에 갇힌 채 다른 화면으로 넘어가지 않게 */
    await page.goto("about:blank");
    await page.setContent('<div data-ss-screen="S-1"><div data-spec="1">A</div></div>' +
      '<div data-ss-screen="S-2" style="display:none"><div data-spec="1">B</div></div>' +
      '<script>window.SCREENSPEC={screens:[' +
      '{id:"S-1",name:"하나",root:"[data-ss-screen=\'S-1\']",specs:[{n:1,target:"1",title:"목록"},{n:9,target:"9",anno:"state",title:"공백",preview:{}}]},' +
      '{id:"S-2",name:"둘",root:"[data-ss-screen=\'S-2\']",specs:[{n:1,target:"1",title:"본문"}]}]};' +
      'window.__pv=[];addEventListener("screenspec:preview",function(e){window.__pv.push(e.detail.screen+"/"+e.detail.n+":"+e.detail.on);e.detail.handled=true;});<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.ScreenSpec.setScreen("S-2"));
    await page.waitForTimeout(400);
    check("preview: 화면이 바뀌면 앱에 on:false 가 간다", await page.evaluate(() =>
      window.__pv.join("|") === "S-1/9:true|S-1/9:false" && window.ScreenSpec.current() === "S-2"));
    check("preview: 화면이 바뀌면 재현 중 띠도 사라진다", await page.evaluate(() =>
      getComputedStyle(document.querySelector(".ss-pvbar")).display === "none"));

    /* 5) 하위 요소(part)도 같은 파이프라인 — 라벨은 "1a" */
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">목록<span data-spec="1a">3</span></div>' +
      '<script>window.SCREENSPEC={screen:{id:"S-PV3",name:"목록"},specs:[{n:1,target:"1",title:"목록 영역",parts:[' +
      '{title:"항목 수",target:"1a",anno:"state",preview:{label:"0건 보기"}}]}]};' +
      'window.__pv=[];addEventListener("screenspec:preview",function(e){window.__pv.push(e.detail.n+":"+e.detail.on+":"+e.detail.title);' +
      'if(e.detail.n==="1a"){document.querySelector("[data-spec=\'1a\']").textContent=e.detail.on?"0":"3";e.detail.handled=true;}});<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("preview: 하위 요소 버튼이 하위 블록 안에 붙는다 (key 1a)", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="1a"]');
      return !!b && b.closest(".ss-part").dataset.part === "1a" && !document.querySelector('[data-preview="1"]');
    }));
    await page.click('[data-preview="1a"]');
    await page.waitForTimeout(300);
    /* 띠가 정의서 헤더를 덮지 않는다 — 뜨면 그 높이(28px)만큼 아래를 민다 (#29 QA 실측) */
    check("preview: 재현 중 띠가 정의서 헤더를 덮지 않는다", await page.evaluate(() => {
      const bar = document.querySelector(".ss-pvbar").getBoundingClientRect();
      const dh = document.querySelector(".ss-dh").getBoundingClientRect();
      return getComputedStyle(document.querySelector(".ss-pvbar")).display !== "none" && bar.bottom <= dh.top + 0.5;
    }));
    check("preview: 하위 요소도 실제로 동작 (detail.n = \"1a\")", await page.evaluate(() =>
      window.__pv.join("|") === "1a:true:항목 수" &&
      document.querySelector('[data-spec="1a"]').textContent === "0" &&
      document.querySelector('[data-preview="1a"]').getAttribute("aria-pressed") === "true"));

    /* 6) overlay 모드 — 띠는 정의서 헤더(48px) 바로 아래, 설명 패널에 깔리지 않아 「끄기」가 실제로 눌린다 (#29 ③) */
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">목록</div><script>' +
      'window.SCREENSPEC={mode:"overlay",screen:{id:"S-OV",name:"목록"},specs:[' +
      '{n:1,target:"1",title:"목록 영역"},{n:9,target:"9",anno:"state",title:"공백",preview:{}}]};' +
      'window.__pv=[];addEventListener("screenspec:preview",function(e){window.__pv.push(e.detail.n+":"+e.detail.on);e.detail.handled=true;});<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-ovDoc");
    await page.waitForTimeout(300);
    await page.click('[data-preview="9"]');
    await page.waitForTimeout(300);
    check("preview: overlay 도 띠가 헤더 아래(48px)에 · 패널 아래 대역", await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".ss-pvbar"));
      const hz = +getComputedStyle(document.querySelector(".ss-ov-header")).zIndex;
      return cs.display === "flex" && cs.top === "48px" && +cs.zIndex < hz &&
        document.querySelector(".ss-pvbar").getBoundingClientRect().right <= innerWidth - 400;
    }));
    await page.click(".ss-pvbar-x");
    await page.waitForTimeout(300);
    check("preview: overlay 의 「끄기」도 실제로 눌린다", await page.evaluate(() =>
      window.__pv.join("|") === "9:true|9:false" &&
      getComputedStyle(document.querySelector(".ss-pvbar")).display === "none"));
  }

  /* ============ 설정 없이 스크립트만 넣은 경우 ============
     남의 페이지를 감싸면 "망가졌다"로 읽힌다 — DOM은 그대로 두고 안내만. */
  console.log("[docs] 설정 없음 상태");
  {
    const warns = [];
    const onMsg = (msg) => { if (msg.type() === "warning") warns.push(msg.text()); };
    page.on("console", onMsg);
    await page.goto("about:blank");
    await page.setContent("<h1 id='own'>내 프로토타입</h1>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(600);
    check("설정 없음: DOM 불변 (감싸지 않음)", await page.evaluate(() =>
      !document.querySelector(".ss-sheet") && document.getElementById("own").parentElement === document.body));
    check("설정 없음: 안내 카드 노출", await page.evaluate(() => document.body.innerText.includes("설정이 없습니다")));
    check("설정 없음: 콘솔 경고", warns.some((w) => w.includes("window.SCREENSPEC")), JSON.stringify(warns).slice(0, 120));
    page.off("console", onMsg);
  }

  /* ============ off 스위치: 붙여 두고 끄기 ============
     정의서를 붙인 것과 공개한 것은 다른 결정이다. off 면 원본 프로토타입과 구별되지 않아야 한다. */
  console.log("[docs] off 스위치");
  {
    const CFG = 'window.SCREENSPEC={off:true,screen:{id:"S-OFF",name:"o"},specs:[{n:1,target:"1",title:"헤더"}]}';
    const BODY = '<h1 id="own" data-spec="1">내 프로토타입</h1>';
    const infos = [];
    const onMsg = (msg) => { if (msg.type() === "info") infos.push(msg.text()); };
    page.on("console", onMsg);
    await page.goto("about:blank");
    await page.setContent(BODY + "<script>" + CFG + "</script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(600);
    check("off: UI 0개 (토글·마커·시트·안내카드)", await page.evaluate(() =>
      !document.querySelector(".ss-toolbar,.ss-pill,.ss-sheet,.ss-marker,.ss-ov-panel,.ss-ui")));
    check("off: 주입 CSS 없음 + body 클래스 불변", await page.evaluate(() =>
      ![...document.querySelectorAll("style")].some((s) => s.textContent.includes("--ss-accent")) && document.body.className === ""));
    check("off: 원본 DOM 그대로 (감싸지 않음)", await page.evaluate(() =>
      document.getElementById("own").parentElement === document.body && document.body.children.length === 2));
    check("off: 프로토타입이 API 를 불러도 깨지지 않음 (no-op)", await page.evaluate(() => {
      try { window.ScreenSpec.setScreen("X"); window.ScreenSpec.refresh(); } catch (e) { return false; }
      return window.ScreenSpec.mode === "off" && window.ScreenSpec.current() === null && window.SpecLayer === window.ScreenSpec;
    }));
    check("off: 켜는 방법을 콘솔로 알린다", infos.some((t) => t.includes("off") && t.includes("?screenspec=1")), infos.join(" | ").slice(0, 140));
    page.off("console", onMsg);

    /* 주소 스위치 — 설정보다 강하다. file:/about:blank 은 쿼리를 못 붙이므로 로컬 서버로 */
    const srv2 = http.createServer((req, res) => {
      if (req.url.indexOf("/screenspec.js") === 0) { res.setHeader("content-type", "text/javascript"); res.end(LIB); return; }
      const on = req.url.indexOf("cfgon") > -1;
      res.setHeader("content-type", "text/html");
      res.end("<!doctype html><body>" + BODY + "<script>" +
        (on ? CFG.replace("off:true,", "") : CFG) + "</script><script src=\"/screenspec.js\"></script></body>");
    });
    await new Promise((r) => srv2.listen(4183, r));
    await page.goto("http://localhost:4183/?screenspec=1");
    await page.waitForTimeout(700);
    check("?screenspec=1 → off:true 를 이기고 정상 부팅", await page.evaluate(() =>
      !!document.querySelector(".ss-toolbar") && window.ScreenSpec.mode === "wrap"));
    await page.goto("http://localhost:4183/cfgon?screenspec=0");
    await page.waitForTimeout(700);
    check("?screenspec=0 → 설정이 켜져 있어도 off", await page.evaluate(() =>
      !document.querySelector(".ss-toolbar") && window.ScreenSpec.mode === "off"));
    await page.goto("http://localhost:4183/#screenspec");
    await page.waitForTimeout(700);
    check("#screenspec (해시·값 생략) → 켜짐", await page.evaluate(() =>
      !!document.querySelector(".ss-toolbar") && window.ScreenSpec.mode === "wrap"));
    srv2.close();
  }

  /* ============ style — AI 가 읽는 계약. 라이브러리는 형식만 보고 렌더는 바꾸지 않는다 (#36) ============ */
  console.log("[docs] style 설정");
  {
    const base = (styleLine) => '<div id="a" data-spec="1">본문</div><script>window.SCREENSPEC={' + styleLine +
      'screen:{id:"S-A",name:"a"},specs:[{n:1,target:"1",title:"본문",defs:[{t:"한 줄"}]}]};</script>';
    const boot = async (html) => {
      const warns = [];
      const on = (m) => { if (m.type() === "warning") warns.push(m.text()); };
      page.on("console", on);
      await page.goto("about:blank");
      await page.setContent(html);
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(400);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(400);
      const rows = await page.locator(".ss-defs-list .ss-row").count();
      page.off("console", on);
      return { st: warns.filter((x) => x.includes("style")), rows };
    };

    const none = await boot(base(""));
    check("style: 없으면 경고 0 · 정상 렌더", none.st.length === 0 && none.rows === 1, JSON.stringify(none));

    const okStyle = await boot(base('style:{vocab:{prefixes:["기본값 :"],endings:["~가능"]},idScheme:"SCR-{n}",notes:"존댓말 금지"},'));
    check("style: 올바르면 경고 0 · 렌더는 없을 때와 동일", okStyle.st.length === 0 && okStyle.rows === none.rows, JSON.stringify(okStyle));

    const notObj = await boot(base('style:"문자열",'));
    check("style: 객체가 아니면 경고 1회 · 그래도 정상 렌더",
      notObj.st.length === 1 && notObj.st[0].includes("객체") && notObj.rows === 1, JSON.stringify(notObj));

    const badVocab = await boot(base('style:{vocab:{prefixes:"문자열"},idScheme:12},'));
    check("style: 하위 필드 타입이 틀리면 어긋난 항목을 짚어 경고 1회",
      badVocab.st.length === 1 && badVocab.st[0].includes("vocab.prefixes") && badVocab.st[0].includes("idScheme") && badVocab.rows === 1,
      JSON.stringify(badVocab));
  }

  /* ============ 편집 모드 — 코드를 안 보고 정의서를 고친다 (#37) ============
     http 로 띄운다: localStorage(초안)·fetch(원본)·다운로드가 file:// 나 about:blank 에서는 막힌다.
     기획자가 실제로 쓰는 자리(로컬 서버·공유 링크)와 같은 조건이다. */
  console.log("[edit] 편집 모드");
  {
    const PROTO = '<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8"><title>편집 대상</title></head>\n' +
      '<body>\n<div id="a" data-spec="1">가</div>\n<div id="b" data-spec="2">나</div>\n' +
      "<script>\nwindow.SCREENSPEC = {\n  screen: { id: \"S-A\", name: \"화면\" },\n  specs: [\n" +
      '    { n:1, target:"1", title:"머리", defs:[{ t:"첫 줄", why:"근거" },{ t:"둘째 줄", subs:["하위"] }] },\n' +
      '    { n:2, target:"2", anno:"action", title:"몸통", defs:[{ t:"한 줄" }], play:{ selector:"#b", label:"눌러 보기" } }\n' +
      "  ]\n};\n<" + '/script>\n<script src="/screenspec.js"><' + "/script>\n<p id=\"tail\">꼬리</p>\n</body></html>\n";
    const srv = http.createServer((rq, rs) => {
      if (rq.url.indexOf("/screenspec.js") === 0) { rs.writeHead(200, { "Content-Type": "text/javascript" }); return rs.end(LIB); }
      if (rq.url.indexOf("/ro") === 0) { rs.writeHead(200, { "Content-Type": "text/html" }); return rs.end(PROTO.replace("window.SCREENSPEC = {", "window.SCREENSPEC = {\n  readonly: true,")); }
      rs.writeHead(200, { "Content-Type": "text/html" });
      rs.end(PROTO);
    });
    await new Promise((r) => srv.listen(4197, r));
    const open = async (p) => {
      await page.goto("http://localhost:4197" + (p || "/"));
      await page.waitForTimeout(500);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(300);
    };

    /* --- 진입 --- */
    await open();
    check("편집: 정의서 패널에 편집 버튼", (await page.locator(".ss-editbtn").count()) === 1);
    check("편집: 끄면 정의서 DOM 이 예전과 같다 (편집 표식 0개)", (await page.locator("[data-ed]").count()) === 0);
    await page.click(".ss-editbtn");
    await page.waitForTimeout(200);
    check("편집: 켜면 body 에 표시", await page.evaluate(() => document.body.classList.contains("ss-editing")));
    check("편집: 고칠 수 있는 글자에 표식이 붙는다", (await page.locator("[data-ed]").count()) >= 6);
    check("편집: 저장바가 보인다", await page.evaluate(() => getComputedStyle(document.querySelector(".ss-edbar")).display === "flex"));
    check("편집: 저장 경로 안내 (내려받기·설정 복사는 늘 있다)", await page.evaluate(() =>
      [...document.querySelectorAll(".ss-edbar [data-sv]")].map((x) => x.dataset.sv).join(",").includes("down,copy")));
    check("편집: 새 고정 요소를 만들지 않는다 (마커·띠를 가릴 일이 없다)", await page.evaluate(() =>
      [".ss-edbar", ".ss-draft", ".ss-editbtn"].every((s) => {
        const el = document.querySelector(s);
        return !el || getComputedStyle(el).position !== "fixed";
      })));

    /* --- 글자 고치기 --- */
    await page.click('[data-defrow="1"] .ss-t');
    await page.keyboard.press("Control+a");
    await page.keyboard.type("고친 머리");
    await page.keyboard.press("Shift+Enter"); /* 0-6: 제목에서 Enter 를 치면 아래에 새 설명 줄이 생긴다 */
    await page.waitForTimeout(200);
    check("편집: 항목명이 설정에 들어간다", await page.evaluate(() => window.SCREENSPEC.specs[0].title === "고친 머리"));
    check("편집: 화면에도 그대로", await page.evaluate(() => document.querySelector('[data-defrow="1"] .ss-t').textContent === "고친 머리"));
    check("편집: 미저장 표시가 뜬다", await page.evaluate(() => document.querySelector(".ss-editbtn").classList.contains("ss-dirty") && window.ScreenSpec.dirty()));

    await page.click('[data-defrow="1"] [data-ed="t"][data-di="0"]');
    await page.keyboard.press("Control+a");
    await page.keyboard.type("고친 첫 줄");
    await page.keyboard.press("Shift+Enter"); /* 0-6: Enter 는 새 줄 · Shift+Enter 가 «여기서 그만» */
    await page.waitForTimeout(200);
    check("편집: 설명 줄도 고쳐진다", await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t === "고친 첫 줄"));

    /* --- Esc 는 취소 --- */
    await page.click('[data-defrow="2"] .ss-t');
    await page.keyboard.press("Control+a");
    await page.keyboard.type("버릴 값");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("편집: Esc 는 설정을 안 바꾼다", await page.evaluate(() => window.SCREENSPEC.specs[1].title === "몸통"));
    check("편집: Esc 는 화면도 되돌린다", await page.evaluate(() => document.querySelector('[data-defrow="2"] .ss-t').textContent === "몸통"));

    /* --- 구조 --- */
    await page.click('[data-defrow="2"] [data-ec="addline"]');
    await page.waitForTimeout(200);
    check("편집: 줄 추가", await page.evaluate(() => window.SCREENSPEC.specs[1].defs.length === 2));
    await page.click('[data-defrow="1"] [data-ec="delline"][data-di="0"]');
    await page.waitForTimeout(200);
    check("편집: 줄 삭제", await page.evaluate(() => window.SCREENSPEC.specs[0].defs.length === 1 && window.SCREENSPEC.specs[0].defs[0].t === "둘째 줄"));
    await page.click('[data-defrow="1"] [data-ec="addwhy"][data-di="0"]');
    await page.waitForTimeout(200);
    check("편집: 이유 붙이기", await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].why === "이유"));
    await page.click('[data-defrow="2"] [data-ec="up"]');
    await page.waitForTimeout(250);
    check("편집: 순서 바꾸기", await page.evaluate(() => window.SCREENSPEC.specs[0].title === "몸통"));
    check("편집: 순서를 바꾸면 번호를 1부터 다시 매긴다", await page.evaluate(() => window.SCREENSPEC.specs.map((s) => s.n).join() === "1,2"));
    check("편집: 마커 번호도 따라온다", await page.evaluate(() => [...document.querySelectorAll(".ss-marker")].map((x) => x.textContent).join() === "1,2"));

    /* --- 편집 중에도 문서는 살아 있다 --- */
    await page.click('.ss-defs-list [data-play="1"]');
    await page.waitForTimeout(250);
    check("편집 중에도 ▶ 재생이 동작한다", (await page.locator(".ss-marker").count()) === 2 && await page.evaluate(() => document.body.classList.contains("ss-editing")));

    /* --- 직렬화 (공개 API) --- */
    const ser = await page.evaluate(() => {
      const txt = window.ScreenSpec.serialize();
      const w = {};
      new Function("window", txt)(w);
      /* 키 순서는 «일부러» 정규화한다(필드 순서 고정) — 그래서 왕복은 값으로 본다 */
      const norm = (v) => Array.isArray(v) ? v.map(norm)
        : (v && typeof v === "object") ? Object.keys(v).sort().reduce((o, k) => (o[k] = norm(v[k]), o), {})
        : v;
      return {
        same: JSON.stringify(norm(w.SCREENSPEC)) === JSON.stringify(norm(window.SCREENSPEC)),
        ordered: txt.indexOf("screen:") < txt.indexOf("specs:") && txt.indexOf("n: 1") < txt.indexOf("title:"),
        twice: txt === window.ScreenSpec.serialize(),
        head: txt.slice(0, 20),
        got: JSON.stringify(norm(w.SCREENSPEC)).slice(0, 300),
        want: JSON.stringify(norm(window.SCREENSPEC)).slice(0, 300),
      };
    });
    check("편집: serialize 왕복 무손실 (값 기준)", ser.same, { got: ser.got, want: ser.want });
    check("편집: 필드 순서를 고정한다 (고친 줄만 바뀐 파일이 나오게)", ser.ordered);
    check("편집: 같은 설정이면 늘 같은 텍스트 (저장이 결정적)", ser.twice);
    check("편집: serialize 는 window.SCREENSPEC 대입문", ser.head.indexOf("window.SCREENSPEC") === 0, ser.head);

    /* 스크립트를 깨뜨리려는 글자를 넣어도 블록이 안 깨져야 한다 */
    await page.click('[data-defrow="1"] [data-ed="t"][data-di="0"]');
    await page.keyboard.press("Control+a");
    await page.keyboard.type("종료 시도 <" + "/script><" + "script>alert(1)");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const esc = await page.evaluate(() => {
      const txt = window.ScreenSpec.serialize();
      const w = {};
      new Function("window", txt)(w);
      return { leaks: /<\/script/i.test(txt), back: w.SCREENSPEC.specs[0].defs[0].t };
    });
    check("편집: 스크립트 종료 태그가 그대로 새어 나가지 않는다", !esc.leaks);
    check("편집: 그래도 값은 원래 글자 그대로 복원된다", esc.back.indexOf("종료 시도") === 0, esc.back);

    /* --- 내려받기: replaceConfigBlock 을 실제 경로로 검증 --- */
    const dl = await Promise.all([page.waitForEvent("download"), page.click('.ss-edbar [data-sv="down"]')]);
    const saved = path.join(require("os").tmpdir(), "ss-edited.html");
    await dl[0].saveAs(saved);
    const outHtml = fs.readFileSync(saved, "utf8");
    check("내려받기: 파일 이름이 .edited.html", /\.edited\.html$/.test(dl[0].suggestedFilename()), dl[0].suggestedFilename());
    check("내려받기: 고친 내용이 들어 있다", outHtml.includes("고친 머리"));
    check("내려받기: 프로토타입 코드는 그대로 남는다", outHtml.includes('id="tail"') && outHtml.includes('data-spec="2"'));
    check("내려받기: 라이브러리 스크립트 태그도 그대로", /<script[^>]+src=[^>]*screenspec\.js/.test(outHtml));
    check("내려받기: 미저장 표시가 사라진다", await page.evaluate(() => !window.ScreenSpec.dirty()));

    /* 산출물을 다시 열면 고친 내용이 뜬다 — 저장의 목적 그 자체 */
    const srv2 = http.createServer((rq, rs) => {
      if (rq.url.indexOf("/screenspec.js") === 0) { rs.writeHead(200, { "Content-Type": "text/javascript" }); return rs.end(LIB); }
      rs.writeHead(200, { "Content-Type": "text/html" });
      rs.end(outHtml);
    });
    await new Promise((r) => srv2.listen(4196, r));
    await page.goto("http://localhost:4196/");
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("내려받기: 산출물을 열면 고친 내용이 뜬다", await page.evaluate(() => document.body.innerText.includes("고친 머리")));
    check("내려받기: 산출물도 정상 부팅 (마커 2개)", (await page.locator(".ss-marker").count()) === 2);
    srv2.close();

    /* --- 저장 안 된 초안 --- */
    await open();
    await page.click(".ss-editbtn");
    await page.click('[data-defrow="1"] .ss-t');
    await page.keyboard.press("Control+a");
    await page.keyboard.type("초안만 고침");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    check("초안: 고치면 브라우저에 자동으로 깔린다", await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.indexOf("screenspec:draft") === 0)));
    await open(); /* 저장 없이 떠났다가 다시 온다 */
    check("초안: 다시 열면 배너가 뜬다", await page.evaluate(() => document.querySelector(".ss-draft").classList.contains("ss-show")));
    check("초안: 배너가 뜨기만 하고 설정을 멋대로 바꾸지는 않는다", await page.evaluate(() => window.SCREENSPEC.specs[0].title === "머리"));
    await page.click('.ss-draft [data-dc="take"]');
    await page.waitForTimeout(250);
    check("초안: 「이어서」 를 누르면 되살아난다", await page.evaluate(() => window.SCREENSPEC.specs[0].title === "초안만 고침"));
    check("초안: 되살리면 화면에도 뜬다", await page.evaluate(() => document.body.innerText.includes("초안만 고침")));
    check("초안: 되살리면 편집 모드로 들어간다", await page.evaluate(() => document.body.classList.contains("ss-editing")));
    await open();
    await page.click('.ss-draft [data-dc="drop"]');
    await page.waitForTimeout(200);
    check("초안: 「버리기」 를 누르면 지워진다", await page.evaluate(() =>
      !Object.keys(localStorage).some((k) => k.indexOf("screenspec:draft") === 0)));

    /* --- readonly: 숨김이 아니라 미생성 --- */
    await open("/ro");
    check("readonly: 편집 버튼을 아예 만들지 않는다", (await page.locator(".ss-editbtn").count()) === 0);
    check("readonly: 저장바도 없다", (await page.locator(".ss-edbar").count()) === 0);
    check("readonly: edit() 를 불러도 편집이 안 켜진다", await page.evaluate(() => {
      window.ScreenSpec.edit(true);
      return !document.body.classList.contains("ss-editing");
    }));
    check("readonly: 정의서 자체는 정상", (await page.locator(".ss-defs-list .ss-row").count()) === 2);
    srv.close();
  }

  /* ============ PNG 내보내기 (#40) — 컨플·노션에 붙일 그림 한 장 ============
     실제로 PNG 를 만들어 «백지가 아닌지(잉크 비율)» 까지 본다. 클래스만 세는 검사는
     「그림이 제대로 나오는가」를 검증하지 못한다. 세 모드(wrap·overlay·frame) 전부 확인한다. */
  console.log("[export] PNG 내보내기");
  {
    const shoot = (opt) => page.evaluate(async (o) => {
      const r = await window.ScreenSpec.exportImage(o);
      return { ok: r.ok, w: r.w, h: r.h, ink: r.ink, remote: r.remote, why: r.why };
    }, opt || {});

    /* --- wrap --- */
    await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/shop.html");
    await page.waitForTimeout(1000);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("내보내기: 툴바에 있다 (패널이 아니라 화면 전체에 작용하므로)", await page.evaluate(() => {
      const b = document.querySelector(".ss-prbtn");
      return !!b && !!b.closest(".ss-toolbar") && !b.closest(".ss-defs");
    }));
    check("내보내기: 이름이 「내보내기」", await page.evaluate(() => document.querySelector(".ss-prbtn").textContent.trim() === "내보내기"));
    check("내보내기: 대화상자는 번호·머리말·기능 설명 세 가지만 (PDF 는 없다)", await page.evaluate(() => {
      document.querySelector(".ss-prbtn").click();
      const d = document.querySelector(".ss-prdlg");
      return !!d && d.open && !!d.querySelector("#ss-prMark") && !!d.querySelector("#ss-prHead") &&
        !!d.querySelector("#ss-prTable") && !d.querySelector("#ss-prImg");
    }));
    check("내보내기: 번호·머리말은 기본 켬 · 기능 설명은 기본 끔", await page.evaluate(() => {
      const d = document.querySelector(".ss-prdlg");
      return d.querySelector("#ss-prMark").checked && d.querySelector("#ss-prHead").checked &&
        !d.querySelector("#ss-prTable").checked;
    }));
    await page.evaluate(() => document.querySelector(".ss-prdlg").close());

    const dev = await page.evaluate(() => ({
      기기높이: document.querySelector(".ss-sheet").offsetHeight,
      내용높이: document.querySelector(".ss-sheet").scrollHeight,
      기기폭: document.querySelector(".ss-sheet").offsetWidth,
      마커: document.querySelectorAll(".ss-marker").length,
    }));
    const img = await shoot({ markers: true, head: true });
    check("wrap: 내보내기가 성공한다", img.ok === true, JSON.stringify(img));
    check("wrap: 백지가 아니다 (잉크 비율로 확인)", img.ink > 5, JSON.stringify(img));
    check("wrap: «화면 전체 높이» 로 뽑는다 — 기기 높이만 자르면 아래쪽 마커가 사라진다",
      img.h / 2 > dev.내용높이 * 0.9, JSON.stringify({ img: img.h, dev: dev }));
    check("wrap: 폭이 기기 폭에 딱 맞는다 (쓸데없는 흰 띠 없음)",
      img.w / 2 >= dev.기기폭 && img.w / 2 <= dev.기기폭 + 60, JSON.stringify({ img: img.w / 2, 기기폭: dev.기기폭 }));
    check("wrap: 내보낸 뒤 화면이 원상 복귀한다", await page.evaluate((d) =>
      document.querySelectorAll(".ss-cap").length === 0 &&
      !document.querySelector(".ss-sheet").style.height &&
      document.querySelector(".ss-frame").parentElement.id === "ss-docHolder" &&
      document.querySelectorAll(".ss-marker").length === d.마커, dev));

    const noHead = await shoot({ head: false, markers: false });
    check("wrap: 머리말을 끄면 그만큼 세로가 짧아진다", noHead.ok && noHead.h < img.h, JSON.stringify({ noHead, img }));
    check("wrap: 머리말을 꺼도 백지가 아니다", noHead.ink > 5, JSON.stringify(noHead));
    const withTable = await shoot({ table: true });
    check("wrap: 기능 설명을 포함하면 세로가 길어진다", withTable.ok && withTable.h > img.h, JSON.stringify({ withTable, img }));

    /* --- 바깥 주소 이미지 · 주석에 «--» 가 있는 프로토타입 --- */
    await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/demo.html");
    await page.waitForTimeout(1000);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    const rem = await shoot({});
    check("wrap: 바깥에서 불러오는 이미지 개수를 알려 준다 (빈칸으로 나오므로)", rem.ok === true && rem.remote >= 1, JSON.stringify(rem));
    check("wrap: 주석에 «--» 가 있는 프로토타입도 캡처된다 (XML 이 안 깨진다)", rem.ok === true, JSON.stringify(rem));

    /* --- overlay: 옮길 시트가 없어 사본을 뜬다 --- */
    const srvOv = http.createServer((rq, rs) => {
      const u = rq.url.split("?")[0].split("#")[0];
      const p = u.indexOf("/screenspec.js") === 0 ? "/screenspec.js" : "/examples/overlay-spa.html";
      rs.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : "text/html" });
      rs.end(fs.readFileSync(path.join(REPO, p)));
    });
    await new Promise((r) => srvOv.listen(4192, r));
    await page.goto("http://localhost:4192/");
    await page.waitForTimeout(1000);
    await page.click("#ss-ovDoc");
    await page.waitForTimeout(500);
    check("내보내기(overlay): 버튼이 모드 알약에 있다", await page.evaluate(() =>
      !!document.querySelector(".ss-pill .ss-prbtn")));
    const ov = await shoot({ markers: true, head: true });
    check("overlay: 내보내기가 성공한다", ov.ok === true, JSON.stringify(ov));
    check("overlay: 백지가 아니다", ov.ink > 0.3, JSON.stringify(ov));
    check("overlay: 뷰어 UI(패널·알약·헤더)는 그림에 안 들어간다", await page.evaluate(async () => {
      /* 캡처 직전 사본에서 무엇이 빠지는지 — 조립 상자를 잡아 확인한다 */
      let seen = null;
      const mo = new MutationObserver(() => {
        const box = document.querySelector(".ss-cap");
        if (box && seen === null) seen = box.querySelectorAll(".ss-ov-panel,.ss-pill,.ss-ov-header,.ss-toc").length;
      });
      mo.observe(document.body, { childList: true, subtree: true });
      await window.ScreenSpec.exportImage({});
      mo.disconnect();
      return seen === 0;
    }));
    check("overlay: 내보낸 뒤 조립 상자가 남지 않는다", (await page.locator(".ss-cap").count()) === 0);
    check("overlay: 앱 DOM 이 그대로다 (사본을 떴을 뿐)", await page.evaluate(() =>
      !!document.querySelector("[data-spec]") && document.querySelectorAll(".ss-ov-panel").length === 1));
    srvOv.close();
  }

  /* ============ 개발 정의 레이어 (#38) ============
     개발 정의는 기획 정의를 «보면서» 쓰는 글이라 탭으로 가르지 않고 같은 항목 안에 넣는다 (결정 D2).
     필터는 CSS 전용이어야 한다 — 모델을 건드리면 마커·경고가 따라 흔들린다. 그걸 실측으로 못박는다. */
  console.log("[layer] 개발 정의 레이어");
  {
    const withDev = '<div data-spec="1">가</div><div data-spec="2">나</div><script>window.SCREENSPEC={' +
      'screen:{id:"S-A",name:"화면",dev:[{t:"인증 : Bearer 토큰"},{t:"에러코드 4xx 는 토스트"}]},specs:[' +
      '{n:1,target:"1",title:"머리",defs:[{t:"기획 한 줄"},{t:"GET /api/items", layer:"dev"},{t:"기획 둘째 줄"}]},' +
      '{n:2,target:"2",title:"몸통",defs:[{t:"기획만 있는 항목"}]}]};<' + "/script>";
    const plain = '<div data-spec="1">가</div><div data-spec="2">나</div><script>window.SCREENSPEC={' +
      'screen:{id:"S-B",name:"옛 문서"},specs:[{n:1,target:"1",title:"머리",defs:[{t:"한 줄"}]},' +
      '{n:2,target:"2",title:"몸통",defs:[{t:"한 줄"}]}]};<' + "/script>";
    const boot = async (html) => {
      await page.goto("about:blank");
      await page.setContent(html);
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(400);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(300);
    };
    const disp = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).display : "(없음)";
    }, sel);

    await boot(withDev);
    check("레이어: 개발 줄이 항목 안 개발 블록으로", await page.evaluate(() =>
      [...document.querySelectorAll('[data-defrow="1"] .ss-dev li')].map((x) => x.textContent).join() === "GET /api/items"));
    check("레이어: 기획 줄은 개발 블록 밖에 그대로", await page.evaluate(() =>
      [...document.querySelectorAll('[data-defrow="1"] .ss-items.ss-plan li')].map((x) => x.textContent).join() === "기획 한 줄,기획 둘째 줄"));
    check("레이어: DEV 태그가 붙는다", (await page.locator('[data-defrow="1"] .ss-devtag').count()) === 1);
    check("레이어: 개발 줄이 없는 항목엔 개발 블록도 없다", (await page.locator('[data-defrow="2"] .ss-dev').count()) === 0);
    /* 어느 층에서든 «기획이 먼저, 개발이 나중» — 화면 공통 개발도 예외가 아니다 (#41) */
    check("레이어: 화면 공통 개발 정의가 항목들 «뒤» 에 온다", await page.evaluate(() => {
      const c = document.querySelector(".ss-dev-common");
      if (!c) return false;
      const rows = [...document.querySelectorAll(".ss-defs-list .ss-row")];
      const kids = [...c.parentElement.children];
      return c.innerText.includes("화면 공통") && c.innerText.includes("Bearer") &&
        rows.every((r) => kids.indexOf(r) < kids.indexOf(c));
    }));
    check("레이어: 필터 칩 3종", await page.evaluate(() =>
      [...document.querySelectorAll(".ss-chips [data-ly]")].map((x) => x.dataset.ly).join() === "all,plan,dev"));

    const base = await page.evaluate(() => ({
      markers: document.querySelectorAll(".ss-marker").length,
      rows: document.querySelectorAll(".ss-row").length,
      cnt: document.querySelector(".ss-cnt").textContent,
    }));

    await page.click('[data-ly="plan"]');
    await page.waitForTimeout(150);
    check("레이어: 「기획」 을 고르면 개발 블록이 안 보인다", (await disp('[data-defrow="1"] .ss-dev')) === "none");
    check("레이어: 「기획」 이어도 기획 줄은 그대로", (await disp('[data-defrow="1"] .ss-items.ss-plan')) !== "none");
    check("레이어: 「기획」 이면 화면 공통(개발)도 숨는다", (await disp(".ss-dev-common")) === "none");

    await page.click('[data-ly="dev"]');
    await page.waitForTimeout(150);
    check("레이어: 「개발」 을 고르면 기획 줄이 안 보인다", (await disp('[data-defrow="1"] .ss-items.ss-plan')) === "none");
    check("레이어: 「개발」 이면 개발 블록이 보인다", (await disp('[data-defrow="1"] .ss-dev')) !== "none");
    check("레이어: 필터가 마커·행·항목 수에 영향이 없다 (CSS 전용)", await page.evaluate((b) =>
      document.querySelectorAll(".ss-marker").length === b.markers &&
      document.querySelectorAll(".ss-row").length === b.rows &&
      document.querySelector(".ss-cnt").textContent === b.cnt, base), JSON.stringify(base));
    check("레이어: 필터를 걸어도 행은 안 숨긴다 (번호·마커 대응 유지)", await page.evaluate(() =>
      [...document.querySelectorAll(".ss-row")].every((r) => getComputedStyle(r).display !== "none")));

    await page.click('[data-ly="all"]');
    await page.waitForTimeout(150);
    check("레이어: 「전체」 로 돌아온다", await page.evaluate(() =>
      !document.querySelector(".ss-defs-list").hasAttribute("data-layer")));

    /* 편집 — 걸러도 원래 인덱스에 쓴다 */
    await page.click(".ss-editbtn");
    await page.waitForTimeout(200);
    await page.click('[data-defrow="1"] .ss-dev [data-ed="t"]');
    await page.keyboard.press("Control+a");
    await page.keyboard.type("POST /api/items");
    await page.keyboard.press("Shift+Enter"); /* 0-6: Enter 는 새 줄 · Shift+Enter 는 여기서 그만 */
    await page.waitForTimeout(200);
    check("레이어: 개발 줄 편집이 «원래 인덱스» 에 정확히 들어간다", await page.evaluate(() =>
      window.SCREENSPEC.specs[0].defs.map((d) => (d.layer || "plan") + ":" + d.t).join("|") ===
      "plan:기획 한 줄|dev:POST /api/items|plan:기획 둘째 줄"),
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs));
    await page.click('[data-defrow="2"] [data-ec="adddev"]');
    await page.waitForTimeout(200);
    check("레이어: 「＋ 개발 줄」 이 layer:dev 로 붙는다", await page.evaluate(() => {
      const d = window.SCREENSPEC.specs[1].defs;
      return d.length === 2 && d[1].layer === "dev";
    }));
    check("레이어: 직렬화가 layer·screen.dev 를 잃지 않는다", await page.evaluate(() => {
      const w = {};
      new Function("window", window.ScreenSpec.serialize())(w);
      return w.SCREENSPEC.specs[0].defs[1].layer === "dev" && (w.SCREENSPEC.screen.dev || []).length === 2;
    }));

    /* 내보내기가 같은 축을 쓴다 — 그림 속 표를 레이어로 거른다 */
    const tableText = (layer) => page.evaluate(async (ly) => {
      let txt = null;
      const mo = new MutationObserver(() => {
        const t = document.querySelector(".ss-cap .ss-pr-table");
        if (t && txt === null) txt = t.innerText;
      });
      mo.observe(document.body, { childList: true, subtree: true });
      await window.ScreenSpec.exportImage({ table: true, layer: ly });
      mo.disconnect();
      return txt;
    }, layer);
    const tDev = await tableText("dev");
    check("레이어: 내보내기 「개발만」 이면 표에 기획 줄이 없다",
      tDev && tDev.includes("POST /api/items") && !tDev.includes("기획 한 줄"), tDev);
    check("레이어: 내보내기 「개발만」 에 화면 공통도 들어간다", tDev && tDev.includes("Bearer"), tDev);
    const tPlan = await tableText("plan");
    check("레이어: 내보내기 「기획만」 이면 표에 개발 줄이 없다",
      tPlan && tPlan.includes("기획 한 줄") && !tPlan.includes("POST /api/items") && !tPlan.includes("Bearer"), tPlan);

    /* 레이어는 «기능 설명 포함» 을 켜야 의미가 있다 — 표가 없으면 거를 것이 없다 */
    check("레이어: 기능 설명을 안 넣으면 레이어 선택이 꺼져 있다", await page.evaluate(() => {
      document.querySelector(".ss-prbtn").click();
      const d = document.querySelector(".ss-prdlg");
      const sel = d.querySelector("#ss-prLayer");
      return sel.disabled === true && sel.closest("label").classList.contains("ss-off");
    }));
    check("레이어: 기능 설명을 켜면 레이어 선택이 살아난다", await page.evaluate(() => {
      const d = document.querySelector(".ss-prdlg");
      const cb = d.querySelector("#ss-prTable");
      cb.checked = true;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
      const sel = d.querySelector("#ss-prLayer");
      const ok = sel.disabled === false && !sel.closest("label").classList.contains("ss-off");
      d.close();
      return ok;
    }));

    /* 하위 호환 — layer 를 안 쓰는 문서는 예전 그대로 */
    await boot(plain);
    check("레이어: 개발 정의가 없으면 칩을 만들지 않는다", (await page.locator(".ss-layerbar").count()) === 0);
    check("레이어: 개발 정의가 없으면 개발 블록도 0개", (await page.locator(".ss-dev").count()) === 0);
    check("레이어: 옛 문서는 정의서가 그대로 뜬다", (await page.locator(".ss-defs-list .ss-row").count()) === 2);
    check("레이어: 옛 문서의 내보내기 대화상자엔 레이어 선택이 없다", await page.evaluate(() => {
      document.querySelector(".ss-prbtn").click();
      const has = !!document.querySelector("#ss-prLayer");
      document.querySelector(".ss-prdlg").close();
      return !has;
    }));
  }
  /* ============ 최소 에디터 — 글 쓰듯 고치기 (0-6) ============
     Enter 는 «새 줄», Tab 은 «한 단». 편집 엔진을 넣지 않고 우리 스키마 위에 직접 짰다.
     여기서 확인하는 것은 «키가 데이터 구조를 옳게 옮기는가» 다 — 화면이 아니라 설정이 근거다. */
  console.log("[edit2] 최소 에디터 (0-6)");
  {
    const HTML2 = '<div id="a" data-spec="1">본문</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-A',name:'a'}," +
      "specs:[{n:1,target:'1',anno:'box',title:'영역',defs:[{t:'첫 줄'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(HTML2);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click(".ss-editbtn");
    await page.waitForTimeout(200);
    const defs = () => page.evaluate(() => JSON.parse(JSON.stringify(window.SCREENSPEC.specs[0].defs)));

    await page.click('.ss-dt[data-ed="t"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.type("둘째 줄");
    await page.click("#ss-mDoc"); /* 바깥을 누르면 반영 */
    await page.waitForTimeout(150);
    check("에디터: Enter 로 같은 층에 새 줄", (await defs()).length === 2, await defs());

    await page.click('.ss-dt[data-ed="t"][data-di="1"]');
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    let c = await defs();
    check("에디터: Tab 으로 앞 줄의 하위가 된다", c.length === 1 && !!c[0].subs && c[0].subs.length === 1, c);

    await page.keyboard.type("셋째");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.type("넷째");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    c = await defs();
    check("에디터: 3단까지 들어간다", !!(c[0].subs && c[0].subs[0] && c[0].subs[0].subs && c[0].subs[0].subs.length === 1), c);
    check("에디터: 3단은 번호 없이 글머리표로 그린다 (번호는 2단까지)",
      (await page.locator(".ss-items li.ss-sub3").count()) === 1 && (await page.locator(".ss-no").count()) >= 1);

    await page.keyboard.press("Shift+Tab");
    await page.waitForTimeout(200);
    c = await defs();
    check("에디터: Shift+Tab 으로 한 단 나온다", !(c[0].subs[0].subs || []).length, c);

    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);
    c = await defs();
    check("에디터: 빈 줄에서 Backspace 면 그 줄이 사라진다", (c[0].subs || []).length === 1, c);

    await page.keyboard.press("Control+z");
    await page.waitForTimeout(150);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(150);
    const undone = await defs();
    check("에디터: Ctrl+Z 는 여러 걸음 돌아간다", JSON.stringify(undone) !== JSON.stringify(c), undone);
    await page.keyboard.press("Control+Shift+z");
    await page.waitForTimeout(150);
    check("에디터: Ctrl+Shift+Z 로 다시 앞으로", JSON.stringify(await defs()) !== JSON.stringify(undone), await defs());

    await page.click('.ss-dt[data-ed="t"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    check("에디터: 빈 줄에서 / 를 치면 넣을 것을 고른다", (await page.locator(".ss-slash button").count()) === 4);
    await page.click('.ss-slash [data-sl="why"]');
    await page.waitForTimeout(250);
    check("에디터: / 메뉴의 «이유» 가 이유 칸을 만든다", (await page.locator('[data-ed="why"]').count()) > 0);

    check("에디터: 유형 드롭다운이 anno 8종", (await page.locator(".ss-annopick option").count()) === 8);
    await page.selectOption(".ss-annopick", "input");
    await page.waitForTimeout(250);
    check("에디터: 유형을 고르면 설정이 바뀐다", (await page.evaluate(() => window.SCREENSPEC.specs[0].anno)) === "input");

    /* 편집을 끄면 정의서 DOM 이 편집 기능 없던 때와 같아야 한다 — 회귀 위험 0 이 이 기능의 전제다 */
    await page.click(".ss-editbtn");
    await page.waitForTimeout(200);
    check("에디터: 끄면 드롭다운·손잡이가 남지 않는다",
      (await page.locator(".ss-annopick").count()) === 0 && (await page.locator("[data-ed]").count()) === 0);

    /* 하위 호환 — subs 가 문자열뿐인 옛 문서 */
    await page.goto("about:blank");
    await page.setContent('<div id="a" data-spec="1">본문</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-B',name:'b'}," +
      "specs:[{n:1,target:'1',title:'영역',defs:[{t:'줄',subs:['가','나']}]}]};<" + "/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("에디터: 문자열 subs 만 쓰는 옛 문서가 그대로 그려진다",
      (await page.locator(".ss-items li.ss-sub").count()) === 2 && (await page.locator(".ss-items li.ss-sub3").count()) === 0);
  }

  /* ============ 움직이는 요소 추적 (#8) ============
     캐러셀처럼 transform 으로 미끄러지는 요소 «안쪽» 에 마커를 달면, 예전엔 번호만 제자리에 남았다.
     재배치 계기가 창 크기·DOM 변경뿐이었기 때문이다. 이제 움직이는 동안 따라가고 멈추면 스스로 멎는다. */
  console.log("[move] 움직이는 요소 안의 마커");
  {
    const MOVE_HTML =
      "<style>.win{width:200px;overflow:hidden}.track{display:flex;width:400px;transition:transform .4s linear}" +
      ".s{width:200px;height:80px;background:#eee}</style>" +
      '<div class="win"><div class="track" id="track">' +
      '<div class="s">1</div><div class="s" data-spec="two">2</div></div></div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-M',name:'캐러셀'}," +
      "specs:[{n:1,target:'two',title:'둘째 슬라이드',defs:[{t:'한 줄'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(MOVE_HTML);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(500);
    const spot = () => page.evaluate(() => {
      const m = document.querySelector(".ss-marker");
      const t = document.querySelector('[data-spec="two"]');
      if (!m || !t) return null;
      return { m: m.getBoundingClientRect().left, t: t.getBoundingClientRect().left };
    });
    const a = await spot();
    check("추적: 처음엔 마커가 대상 위에 있다", !!a && Math.abs(a.m - a.t) < 30, a);
    await page.evaluate(() => { document.getElementById("track").style.transform = "translateX(-200px)"; });
    await page.waitForTimeout(180); /* 0.4초 전환의 한가운데 */
    const mid = await spot();
    check("추적: 전환 «도중에도» 마커가 붙어 있다 (끝에서 한 번 튀는 게 아니라)",
      !!mid && Math.abs(mid.m - mid.t) < 30 && Math.abs(mid.m - a.m) > 20, { a: a, mid: mid });
    await page.waitForTimeout(700);
    const end = await spot();
    check("추적: 끝난 자리에서도 마커와 대상이 맞는다", !!end && Math.abs(end.m - end.t) < 30, end);
    check("추적: 실제로 슬라이드만큼 이동했다", !!end && Math.abs(end.m - a.m) > 100, { a: a, end: end });
    /* 멈춘 뒤에도 매 프레임 돌면 배터리를 태운다 — 스스로 멎는지 본다 */
    const frames = await page.evaluate(() => new Promise((done) => {
      let n = 0;
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = function (cb) { n++; return raf.call(window, cb); };
      setTimeout(() => { window.requestAnimationFrame = raf; done(n); }, 500);
    }));
    check("추적: 멈추면 스스로 멎는다 (500ms 동안 rAF 5회 미만)", frames < 5, frames);
  }



  /* ============ 인라인 빌드: 바깥 요청이 막힌 환경 재현 ============
     클로드 아티팩트처럼 외부 주소를 막는 환경을 흉내 내, 자체 완결 파일이 정말 자립하는지 본다. */
  console.log("[inline] 자체 완결 파일");
  {
    const { execFileSync } = require("child_process");
    const os = require("os");
    const out = path.join(os.tmpdir(), "ss-inline-test.html");
    execFileSync(process.execPath,
      [path.join(REPO, "scripts/inline.js"), path.join(REPO, "examples/shop.html"), "-o", out], { stdio: "pipe" });
    const blocked = [];
    await page.route("**", (route) => {
      const u = route.request().url();
      if (/^https?:/i.test(u)) { blocked.push(u); return route.abort(); }
      return route.continue();
    });
    await page.goto("file:///" + out.replace(/\\/g, "/"));
    await page.waitForTimeout(1000);
    check("인라인: 바깥 요청이 막혀도 부팅", await page.evaluate(() => !!window.ScreenSpec));
    check("인라인: screenspec.js 를 바깥에서 받지 않음",
      !blocked.some((u) => /screenspec/i.test(u)), JSON.stringify(blocked.slice(0, 3)));
    await page.click("#ss-mDoc");
    await page.waitForTimeout(500);
    check("인라인: 화면정의서 모드 정상", (await page.locator(".ss-defs-list .ss-row").count()) === 9);
    await page.unroute("**");
    fs.unlinkSync(out);
  }
  check("JS 에러 0건", errors.length === 0, errors.slice(0, 3));

  await browser.close();
  console.log("\n결과: PASS " + pass + " / FAIL " + fail);
  process.exit(fail ? 1 : 0);
})();
