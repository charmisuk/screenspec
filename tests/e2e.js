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
  check("MOA 홈 기능 설명 9행", (await page.locator(".ss-defs-list .ss-row").count()) === 9);
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

  /* ============ overlay: 하위경로(basePath) 환경 ============ */
  console.log("[overlay] SPA (하위경로 서빙)");
  const srv = http.createServer((req, res) => {
    if (req.url.endsWith("screenspec.js")) { res.setHeader("content-type", "text/javascript"); res.end(LIB); return; }
    res.setHeader("content-type", "text/html");
    res.end(fs.readFileSync(path.join(REPO, "examples/overlay-spa.html"), "utf8")
      .replace("../screenspec.js", "/screenspec.js")
      .replace("window.SCREENSPEC = {", 'window.SCREENSPEC = { accent: "#7C3AED",')); /* accent 주입 (e2e 전용) */
  });
  await new Promise((r) => srv.listen(4179, r));
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
  check("목차 → route 소프트 내비게이션", await page.evaluate(() =>
    window.ScreenSpec.current() === "S-09" && location.pathname === "/members" &&
    document.body.innerText.includes("이용자 명단")));
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
  srv.close();


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
    check("빠른 시작: 마커 2개", (await page.locator(".ss-marker").count()) === 2);
    await page.click('[data-play="2"]');
    await page.waitForTimeout(400);
    check("빠른 시작: 동작 재생이 실제로 동작", await page.evaluate(() => document.getElementById("save").textContent === "저장됨"));
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
