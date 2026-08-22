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
  check("목차 섹션 라벨 + 브레드크럼", await page.evaluate(() => {
    const t = document.querySelector(".ss-toc");
    const sec = [...t.querySelectorAll(".ss-toc-sec")].some((x) => x.textContent === "홈");
    const crumb = [...t.querySelectorAll(".ss-toc-crumb")].some((x) => x.textContent.includes("홈 › 과일 상점"));
    return sec && crumb;
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

  /* ============ overlay: 하위경로(basePath) 환경 ============ */
  console.log("[overlay] SPA (하위경로 서빙)");
  const srv = http.createServer((req, res) => {
    if (req.url.endsWith("screenspec.js")) { res.setHeader("content-type", "text/javascript"); res.end(LIB); return; }
    res.setHeader("content-type", "text/html");
    res.end(fs.readFileSync(path.join(REPO, "examples/overlay-spa.html"), "utf8").replace("../screenspec.js", "/screenspec.js"));
  });
  await new Promise((r) => srv.listen(4179, r));
  const bgBefore = "rgb(255, 255, 255)";
  await page.goto("http://localhost:4179/screenspec/examples/overlay-spa.html");
  await page.waitForTimeout(800);
  check("suffix 매칭 초기 화면", await page.evaluate(() => window.ScreenSpec.current()) === "S-01");
  check("호스트 body 배경 보존", await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === bgBefore);
  check("DOM 불변 (감싸지 않음)", await page.evaluate(() =>
    document.querySelector(".gnb").parentElement === document.body && !document.querySelector(".ss-sheet")));
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
  srv.close();

  check("JS 에러 0건", errors.length === 0, errors.slice(0, 3));

  await browser.close();
  console.log("\n결과: PASS " + pass + " / FAIL " + fail);
  process.exit(fail ? 1 : 0);
})();
