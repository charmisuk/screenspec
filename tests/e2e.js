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
/* 정의는 트리다. 시험은 «0A,1B» 표기로 읽는다 — 눈으로 읽기 쉽고, 깊이·순서가 한눈에 보인다 */
const FLAT = "(function(l){var w=function(x,d){return (x||[]).reduce(function(o,b){" +
  "return o.concat([d+b.t], w(b.c,d+1));},[]);};return w(l,0).join(',');})";
const LIB = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8");
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), __dirname] }));
const MOD = process.platform === "darwin" ? "Meta" : "Control"; /* 전체선택·undo 같은 네이티브 단축키는 macOS 크로미엄에서 Cmd 만 듣는다 */

let pass = 0, fail = 0;
/* 섹션 필터 (#79) — 한 건 고치는 동안 전체 158초를 두 번 기다리지 않게 한다.
   커밋 게이트는 그대로 «전체 실행» 이다. 부분 실행은 결과 줄에 그렇게 찍어 오해를 막는다 */
const ONLY = (process.argv.find((a) => a.indexOf("--only") === 0) || "").split("=")[1] ||
  (process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "") || "";
const LIST = process.argv.includes("--list");
const SECS = [];
function sec(name) {
  SECS.push(name);
  if (LIST) return false;
  if (ONLY && name.indexOf(ONLY) < 0) return false;
  console.log(name);
  return true;
}
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
  if (sec("[wrap] demo.html")) {
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
  }

  /* ============ wrap: multi-screen.html ============ */
  if (sec("[wrap] multi-screen.html")) {
    await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/multi-screen.html");
    await page.waitForTimeout(800);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="2"]');
    await page.waitForTimeout(500);
    check("flow → 화면·정의서 동시 전환", await page.evaluate(() => window.ScreenSpec.current()) === "SCR-EX-DTL-002");
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="4"]');
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
  }

  /* ============ wrap: shop.html (대표 데모 — MOA) ============ */
  if (sec("[wrap] shop.html")) {
    await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/shop.html");
    await page.waitForTimeout(1200);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(500);
    check("MOA 홈 기능 설명 11행", (await page.locator(".ss-defs-list .ss-row").count()) === 11);
    /* #51: 번호는 숫자만이다 — 1a·1b 라벨도, 하위 블록도 없다 */
    check("번호는 숫자만 (1a·1b 없음)", await page.evaluate(() => {
      const labels = [...document.querySelectorAll(".ss-marker")].map((m) => m.textContent);
      return document.getElementById("ss-cnt").textContent === "항목 11개" &&
        labels.every((x) => /^\d+$/.test(x)) && document.querySelectorAll(".ss-part").length === 0;
    }), await page.evaluate(() => document.getElementById("ss-cnt").textContent));
    check("앱형 시트 여백 0 (탭바 하단 밀착)", await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".ss-sheet"));
      return cs.paddingBottom === "0px" && cs.paddingTop === "0px";
    }));
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="8"]'); /* #51: 홈 번호가 2씩 밀렸다 (옛 1a·1b → 번호 2·3) */
    await page.waitForTimeout(400);
    check("쿠폰 popup → 실제 바텀시트", await page.evaluate(() => document.getElementById("couponSheet").classList.contains("open")));
    await page.click("#couponSheet .ok");
    await page.waitForTimeout(300);
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="10"]');
    await page.waitForTimeout(500);
    check("추천 카드 flow → 상세 + 정의서 전환", await page.evaluate(() =>
      window.ScreenSpec.current() === "SCR-MOA-PDP-002" &&
      document.querySelector('[data-ss-screen="SCR-MOA-PDP-002"]').style.display !== "none"));
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="5"]');
    await page.waitForTimeout(300);
    check("구매 바 action → 토스트", await page.evaluate(() => document.getElementById("toast").classList.contains("show")));
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="1"]');
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
  }

  /* ============ wrap: floating.html — 고정·플로팅 요소가 기기 화면을 벗어나지 않는가 ============
     프로토타입의 position:fixed 는 기본적으로 브라우저 창에 붙는다. 시트 밖으로 새면 폰 옆 허공에 뜨고
     우리 툴바까지 덮는다. .ss-frame 의 transform 이 이것을 가둔다 — 두 모드·두 폭 모두에서 (v0.19.2) */
  if (sec("[wrap] floating.html (고정 요소 가둠)")) {
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
    /* #51 이후 번호는 숫자만이다 — 옛 하위 5a·5b 는 줄로 합쳤다 */
    check("정의서 모드: 마커 6개", (await page.locator(".ss-marker").count()) === 6);

    /* PC 폭(1920 시트 → 축소 배치)에서도 같은 규칙 */
    await page.click('#ss-seg button[data-w="pc"]');
    await page.waitForTimeout(500);
    for (const [name, sel] of [["앱바", ".appbar"], ["FAB", ".fab"], ["탭바", ".tabbar"]]) {
      check("정의서 모드 PC 폭: " + name + " 가 기기 화면 안", (await inSheet(sel)) === true);
    }
    await page.click('#ss-seg button[data-w="mobile"]');
    await page.waitForTimeout(300);
  }

  /* ============ overlay: 하위경로(basePath) 환경 ============ */
  if (sec("[overlay] SPA (하위경로 서빙)")) {
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
    /* FTUE (PM 2026-08-29) — 처음 온 사람에게 코드 고치는 법이 아니라 «누를 것» 을 준다 */
    check("빈 화면: 코드 설명 대신 번호 찍기 단추", await page.evaluate(() => {
      const e = document.querySelector(".ss-ov-panel .ss-start");
      const n = document.querySelectorAll("[data-spec]").length;
      return !!e && !!e.querySelector('[data-ftue="pick"]') &&
        e.textContent.includes("화면에서 번호 찍기") && e.textContent.includes(n + "개") &&
        document.querySelector("#ss-ovCnt").textContent === "항목 0개";
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
  }


  /* ============ frame: 액자 모드 (같은 SPA 예제를 iframe 에 담고 뷰어는 바깥) ============ */
  if (sec("[frame] SPA (액자 모드)")) {
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
  }


  /* ============ 문서 검증: README 빠른 시작이 진짜 동작하는가 ============
     README의 복붙 예제를 그대로 실행한다. API가 바뀌었는데 문서를 안 고치면 여기서 FAIL. */
  if (sec("[docs] README 빠른 시작 예제")) {
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
    await page.evaluate((s) => document.querySelector(s).click(), '[data-play="2"]');
    await page.waitForTimeout(400);
    check("빠른 시작: 동작 재생이 실제로 동작", await page.evaluate(() => document.getElementById("save").textContent === "저장됨"));
  }

  /* ============ 누락 경고: 어느 정의가 빠졌는지 + state 제외 (#20) ============ */
  if (sec("[docs] 누락 정의 경고")) {
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
    /* #57 — why 는 별도 속성이 아니라 «화살표 블록» 이다. 화면에 「이유:」 라벨을 쓰지 않는다 */
    check("def.why → 화살표 블록으로 펴진다 (#57)", await page.evaluate(() => {
      const el = document.querySelector('[data-defrow="1"] .ss-b-why');
      return !!el && el.querySelector(".ss-dt").textContent === "근거 한 줄" &&
        !!el.querySelector(".ss-b-arrow") && el.textContent.indexOf("이유") < 0;
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


  /* ============ 번호는 숫자만 (#51) ============
     하위 요소(parts, 라벨 1a·1b)를 제품에서 없앴다. 옛 문서에 남아 있어도 «조용히 무시» 해야 한다 —
     열자마자 깨지면 그건 없앤 게 아니라 부순 것이다. */
  if (sec("[nums] 번호는 숫자만")) {
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">상단</div><div data-spec="1a">뱃지</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-N',name:'n'},specs:[" +
      '{n:1,target:"1",title:"상단 타이틀 영역",defs:[{t:"화면 상단에 고정"}],parts:[' +
      '{title:"뱃지",target:"1a",defs:[{t:"숫자 표시"}]}]}]};<' + "/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("번호: 옛 parts 문서를 열어도 깨지지 않는다", await page.evaluate(() => !!window.ScreenSpec));
    check("번호: 마커는 숫자 하나뿐 (1a 없음)", await page.evaluate(() => {
      const l = [...document.querySelectorAll(".ss-marker")].map((m) => m.textContent);
      return l.length === 1 && l[0] === "1";
    }), await page.evaluate(() => [...document.querySelectorAll(".ss-marker")].map((m) => m.textContent)));
    check("번호: 패널에 하위 블록이 없다", (await page.locator(".ss-part").count()) === 0);
    check("번호: 헤더에 «세부» 표기가 없다",
      !(await page.locator("#ss-cnt").textContent()).includes("세부"));
  }


  /* ============ accent = CSS 변수 참조 (#18) ============ */
  if (sec("[docs] accent var(--x)")) {
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

  /* ============ anno 하위호환 (#63): 옛 타입이 통합된 타입으로 열린다 ============ */
  if (sec("[docs] anno 하위호환 (옛 input·motion·popup)")) {
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">A</div><div data-spec="2">B</div><button data-spec="3">C</button><script>window.SCREENSPEC={screen:{id:"S-L",name:"l"},specs:[' +
      '{n:1,target:"1",title:"입력",anno:"input"},{n:2,target:"2",title:"모션",anno:"motion"},' +
      '{n:3,target:"3",title:"팝업",anno:"popup",play:{selector:"button",label:"팝업 열기"}}]}</script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("옛 input·motion·popup → 마커 3개 전부 선다", await page.locator(".ss-marker").count() === 3);
    await page.locator(".ss-marker").nth(2).click();
    await page.waitForTimeout(300);
    check("옛 popup → ▶ 버튼이 선다 (action 과 동일)", await page.locator(".ss-play").count() >= 1);
  }

  /* ============ 잘못된 파일을 고르면 안 쓴다 (#70) ============
     PM: 「이상한 거 하면 어떻게 돼? 그 파일 덮어쓰나?」 설정이 없는 파일은 원래 쓸 자리를 못 찾아
     안전했지만, «설정이 있는 다른 프로토타입» 은 그대로 덮어쓰고 있었다. 화면 ID 로 가린다. */
  if (sec("[편집] 잘못된 파일은 안 쓴다 (#70)")) {
    /* 가짜 파일 손잡이 — 진짜 파일 고르기 창은 자동화로 못 연다. 쓴 내용은 written 에 담긴다 */
    const fakePicker = (name, text) => `window.__written = null;
      window.showOpenFilePicker = async () => [{
        name: ${JSON.stringify(name)},
        getFile: async () => ({ text: async () => ${JSON.stringify(text)}, lastModified: 1 }),
        createWritable: async () => ({ write: async (v) => { window.__written = v; }, close: async () => {} }),
        queryPermission: async () => "granted",
        requestPermission: async () => "granted"
      }];`;
    const mine = '<div data-spec="1">A</div><script>window.SCREENSPEC={screen:{id:"S-MINE",name:"m"},' +
      'specs:[{n:1,target:"1",title:"제목",defs:[{t:"정의"}]}]}<\/script>';
    const other = '<div data-spec="1">B</div><script>window.SCREENSPEC={screen:{id:"S-OTHER",name:"o"},' +
      'specs:[{n:1,target:"1",title:"남의 것",defs:[{t:"남의 정의"}]}]}<\/script>';
    const run = async (fileName, fileText) => {
      await page.goto("about:blank");
      await page.setContent(mine);
      await page.addInitScript({ content: "" });
      await page.evaluate(fakePicker(fileName, fileText));
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(400);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(300);
      await page.click(".ss-svbtn");
      await page.waitForTimeout(500);
      return page.evaluate(() => ({
        written: window.__written,
        msg: (document.querySelector(".ss-edmsg") || {}).textContent || "",
      }));
    };
    const a = await run("남의것.html", other);
    check("설정이 있는 «다른 프로토타입» 은 덮어쓰지 않는다", a.written === null, JSON.stringify(a).slice(0, 160));
    check("무엇이 다른지 말해 준다 (그 파일의 화면 · 지금 문서)",
      a.msg.includes("이 화면정의서의 파일이 아닙니다") && a.msg.includes("S-OTHER") && a.msg.includes("S-MINE"), a.msg);
    const b = await run("아무것.html", "<html><body>설정이 없다</body></html>");
    check("설정이 없는 파일도 안 쓴다", b.written === null && b.msg.includes("설정이 없습니다"), b.msg);
    const c = await run("내것.html", mine);
    check("같은 화면 ID 를 가진 «이 문서» 는 정상으로 쓴다", typeof c.written === "string" && c.written.includes("S-MINE"),
      JSON.stringify(c).slice(0, 160));
  }

  /* ============ 화면 개요 (#82) ============
     특정 영역이 아니라 «화면 전체» 를 설명하는 자리. 마커도 번호도 없이 목록 맨 위에 온다.
     사람과 에이전트가 번갈아 고치므로 «명시»(anno:"overview")로 둔다 — target 을 빠뜨린
     실수와 구분되지 않으면 「마커를 못 찾았다」 경고가 조용히 사라진다 */
  if (sec("[개요] 화면 전체를 설명하는 자리 (#82)")) {
    /* 화면을 둘 둔다 — 하나뿐이면 root 추론이 애초에 안 돌아 «개요가 추론을 깨는가» 를 못 잰다 */
    const warns0 = [];
    const onW0 = (m) => { if (m.type() === "warning") warns0.push(m.text()); };
    page.on("console", onW0);
    await page.goto("about:blank");
    await page.setContent('<div id="A"><h1 data-spec="1">제목</h1><p data-spec="2">본문</p></div>' +
      '<div id="B"><h1 data-spec="3">둘째</h1></div>' +
      '<script>window.SCREENSPEC={mode:"wrap",screens:[' +
      '{id:"S-OV",name:"o",path:["o"],specs:[' +
      '{n:1,target:"1",title:"제목 영역",defs:[{t:"가"}]},' +
      '{n:2,target:"2",title:"본문 영역",defs:[{t:"나"}]},' +
      '{n:0,anno:"overview",title:"화면 개요",defs:[{t:"이 화면이 무엇인가"}]}]},' +
      '{id:"S-OV2",name:"p",path:["p"],specs:[{n:1,target:"3",title:"둘째 영역",defs:[{t:"다"}]}]}]}<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    const rows = () => page.evaluate(() => [...document.querySelectorAll(".ss-defs-list [data-defrow]")]
      .map((e) => (e.querySelector(".ss-no") || {}).textContent + "|" + (e.querySelector(".ss-t") || {}).textContent));
    check("개요는 적은 순서와 무관하게 맨 위에 온다 (#82)",
      (await rows())[0] === "개요|화면 개요", JSON.stringify(await rows()));
    check("개요에는 번호가 아니라 «개요» 가 붙는다 (#82)", (await rows())[1] === "1|제목 영역", JSON.stringify(await rows()));
    check("개요는 마커를 만들지 않는다 (#82)", (await page.locator(".ss-marker").count()) === 2,
      await page.locator(".ss-marker").count());
    check("개요에는 「현재 미표시」 뱃지가 안 붙는다 (#82)",
      (await page.locator('[data-defrow="0"] .ss-nowtag').count()) === 0);
    /* 가리키는 요소가 없다고 «못 찾았다» 고도, «연결 안 됐다» 고도 하면 안 된다 */
    await page.waitForTimeout(2600);
    page.off("console", onW0);
    check("개요가 있어도 화면 연결(root 추론)이 살아 있다 (#82)",
      !warns0.some((t) => t.indexOf("연결되지 않은 화면") >= 0), JSON.stringify(warns0.slice(0, 2)));
    check("개요는 누락 경고를 부르지 않는다 (#82)",
      !warns0.some((t) => t.indexOf("못 찾은 정의") >= 0), JSON.stringify(warns0.slice(0, 2)));
    /* 사람이 손으로 만들 수 있어야 한다 — 없으면 AI 만 쓰는 기능이 된다 */
    await page.goto("about:blank");
    await page.setContent('<h1 data-spec="1">제목</h1>' +
      '<script>window.SCREENSPEC={screen:{id:"S-OV2",name:"o"},specs:[' +
      '{n:1,target:"1",title:"제목 영역",defs:[{t:"가"}]}]}<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    /* 만드는 손짓은 «빈 줄에서 슬래시» 하나로 통일한다 (PM 2026-08-31: 「노션처럼 깔끔한 상태에서
       쌓아나가는 것이 철학에 더 맞다」). 화면에 늘 떠 있는 «만들 자리» 는 두지 않는다 */
    await page.locator('[data-defrow="1"] .ss-kids [data-ed]').first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.keyboard.type("/");
    await page.waitForTimeout(400);
    check("빈 줄에서 슬래시를 치면 «화면» 묶음에 화면 개요가 있다 (#82)",
      (await page.locator('.ss-slash [data-sl="brief"]').count()) === 1 &&
      (await page.locator(".ss-slash .ss-slash-g").nth(1).textContent()) === "화면",
      await page.locator(".ss-slash").textContent());
    await page.locator('.ss-slash [data-sl="brief"]').click();
    await page.waitForTimeout(400);
    check("골라서 만들면 맨 위에 개요가 생긴다 (#82)",
      (await rows())[0] === "개요|화면 개요", JSON.stringify(await rows()));
    check("슬래시를 친 빈 줄은 남지 않는다 (#82)",
      (await page.evaluate(() => [...document.querySelectorAll('[data-defrow="1"] .ss-kids [data-ed]')]
        .filter((e) => !e.textContent.trim()).length)) === 0);
    check("만들자마자 그 자리에서 쓸 수 있다 (#82)",
      (await page.locator('[data-defrow="0"] .ss-kids [data-ed]').first().getAttribute("contenteditable")) === "true");
    check("기존 항목 번호는 그대로 1부터다 (#82)", (await rows())[1] === "1|제목 영역", JSON.stringify(await rows()));
    /* 화면당 하나 — 이미 있으면 메뉴에 안 나온다 */
    await page.locator('[data-defrow="1"] .ss-kids [data-ed]').first().click();
    await page.waitForTimeout(200);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.keyboard.type("/");
    await page.waitForTimeout(400);
    check("개요가 이미 있으면 슬래시에 «화면 개요» 가 안 나온다 (#82)",
      (await page.locator('.ss-slash [data-sl="brief"]').count()) === 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    /* 고른 상태에서 딱지가 «파란 배경 + 회색 글자» 로 남으면 안 읽힌다 (PM 2026-08-31 지적) */
    await page.locator('[data-defrow="0"] .ss-t').click();
    await page.waitForTimeout(300);
    check("개요를 고르면 딱지가 번호와 같은 대비를 갖는다 (#82)",
      await page.evaluate(() => {
        const no = document.querySelector('[data-defrow="0"] .ss-no');
        if (!no) return false;
        const c = getComputedStyle(no);
        return c.color === "rgb(255, 255, 255)" && c.backgroundColor !== "rgba(0, 0, 0, 0)";
      }), await page.evaluate(() => {
        const no = document.querySelector('[data-defrow="0"] .ss-no');
        return no ? getComputedStyle(no).color + " / " + getComputedStyle(no).backgroundColor : "(없음)";
      }));

  }

  /* ============ 파일에 연결 안 되면 못 고친다 (#68) ============
     자동저장을 안 켠 채로 고치면 그 수정은 브라우저 메모리에만 남는다 — 파일을 읽는
     사람도 AI 도 못 본다. 그래서 «고치기 전에» 붙잡는다. 단 로컬 파일로 열었을 때만이다 */
  if (sec("[편집] 파일에 연결 안 되면 붙잡는다 (#68)")) {
    await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/demo.html");
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    const cell = page.locator("[data-ed]").first();
    await cell.click();
    await page.waitForTimeout(200);
    check("로컬 파일: 연결 전에는 글자가 안 고쳐진다",
      (await cell.getAttribute("contenteditable")) !== "true");
    check("로컬 파일: 파일 연결 레이어가 뜬다 (#78)",
      await page.locator(".ss-lay.ss-show").count() === 1);
    check("레이어가 «무슨 파일을 고르라는지» 를 말해 준다 (#78)",
      (await page.locator(".ss-lay-name").innerText()) === "demo.html" &&
      (await page.locator(".ss-lay-go").innerText()).includes("demo.html"),
      (await page.locator(".ss-lay-name").innerText()) + " / " + (await page.locator(".ss-lay-go").innerText()));
    check("레이어는 패널 안쪽에만 깔린다 (프로토타입을 안 가린다) (#78)",
      await page.evaluate(() => {
        const l = document.querySelector(".ss-lay");
        return !!(l && l.closest(".ss-defs"));
      }));
    await page.locator(".ss-lay-later").click();
    await page.waitForTimeout(200);
    check("「나중에 하기」 를 누르면 내려간다 (#78)", await page.locator(".ss-lay.ss-show").count() === 0);
    await cell.click();
    await page.waitForTimeout(250);
    check("그래도 고치려 하면 다시 뜬다 (#78)", await page.locator(".ss-lay.ss-show").count() === 1);
    /* 주소로 받아 온 문서는 쓸 파일이 애초에 없다 — 막지 않는다 (「설명 복사」가 유일한 길) */
    await page.goto("about:blank");
    await page.setContent('<h1 data-spec="1">A</h1><script>window.SCREENSPEC={screen:{id:"S-G",name:"g"},' +
      'specs:[{n:1,target:"1",title:"제목",defs:[{t:"정의"}]}]}<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    const cell2 = page.locator("[data-ed]").first();
    await cell2.click();
    await page.waitForTimeout(200);
    check("파일이 아닌 문서는 그대로 고쳐진다", (await cell2.getAttribute("contenteditable")) === "true");
    /* 막지는 않되 «어디로 옮겨야 하는지» 를 한 번은 말해 준다 (#84) —
       조작하는 곳(패널 안)과 「자동저장 안 됨」 표시(툴바 구석)가 떨어져 있어 눈에 안 들어온다 */
    check("주소로 연 문서: 첫 편집에서 «파일에 못 쓴다» 고 알린다 (#84)",
      await page.locator(".ss-nofile.ss-show").count() === 1);
    check("어디로 옮겨야 하는지 말한다 (설명 복사) (#84)",
      (await page.locator(".ss-nofile").textContent()).indexOf("설명 복사") >= 0,
      await page.locator(".ss-nofile").textContent());
    await page.locator('.ss-nofile [data-nc="close"]').click();
    await page.waitForTimeout(200);
    check("닫으면 내려간다 (#84)", await page.locator(".ss-nofile.ss-show").count() === 0);
    await cell2.click();
    await page.keyboard.type("가");
    await page.waitForTimeout(300);
    check("한 번만 알린다 — 다시 고쳐도 또 안 뜬다 (#84)",
      await page.locator(".ss-nofile.ss-show").count() === 0);
  }

  /* ============ 저장을 호스트가 맡는다 (#87) ============
     앱(Next.js 등)에 심으면 «문서 = 파일» 이 깨진다 — 브라우저에 뜬 것은 주소이고
     정의가 사는 곳은 소스 파일이다. save.write 훅이 있으면 파일 손잡이 없이도 저장이 돈다. */
  if (sec("[편집] 저장을 호스트가 맡는다 (#87)")) {
    const hookDoc = (body) =>
      '<h1 id="t">홈</h1><button id="buy" data-spec="1" style="margin:40px">구매하기</button>' +
      "<script>window.SCREENSPEC={save:{async write(t){window.__calls=(window.__calls||0)+1;" + body +
      "}},screen:{id:'S-H',name:'홈'},specs:[{n:1,target:'1',title:'구매',defs:[{t:'첫 줄'}]}]};<" + "/script>";
    const stat = () => page.locator(".ss-savest").textContent();
    const row = '[data-defrow="1"] .ss-dt[data-ed="b"][data-di="0"]';

    await page.goto("about:blank");
    await page.setContent(hookDoc("window.__wrote=t;"));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("훅이 있으면 «자동저장 꺼짐» 이 아니다 — 이미 쓸 곳이 있다",
      (await stat()).indexOf("저장") === 0 && (await stat()).indexOf("꺼짐") < 0, await stat());
    check("저장 단추가 «자동저장 켜기» 가 아니라 «저장» 이다",
      (await page.locator(".ss-svbtn").textContent()) === "저장");
    await page.click(row);
    await page.waitForTimeout(200);
    check("훅이 있으면 그 자리에서 바로 고쳐진다 (파일을 안 고른다)",
      (await page.locator(row).getAttribute("contenteditable")) === "true");
    check("«파일에 못 쓴다» 안내가 안 뜬다 (#84 와 갈린다)",
      await page.locator(".ss-nofile.ss-show").count() === 0);
    check("파일 고르기 레이어도 안 뜬다 (#78 와 갈린다)",
      await page.locator(".ss-lay.ss-show").count() === 0);

    await page.keyboard.press("End");
    await page.keyboard.type(" 호스트가 쓴다");
    await page.waitForTimeout(1600); /* 자동저장 1.2초 */
    const wrote = await page.evaluate(() => window.__wrote || "");
    check("자동저장이 훅으로 간다", wrote.indexOf("호스트가 쓴다") >= 0, wrote.slice(0, 140));
    check("넘기는 것은 설정 블록 텍스트 한 덩어리다",
      wrote.indexOf("window.SCREENSPEC = ") === 0, wrote.slice(0, 60));
    /* 훅이 되쓰이면 호스트가 그것을 소스에 저장하는 순간 훅이 사라진다 — 한 번 저장하고 끝난다 */
    check("훅 자신은 안 실린다", !/\bsave\s*:/.test(wrote), wrote.slice(0, 200));
    check("저장되면 «저장됨» 으로 바뀐다", (await stat()).indexOf("저장됨") === 0, await stat());

    /* 호스트가 실패하면 — 끄지 않는다. 호스트 사정이고 다음 수정에서 다시 쓴다 */
    await page.goto("about:blank");
    await page.setContent(hookDoc('throw new Error("개발 서버가 안 떠 있습니다");'));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    await page.click(row);
    await page.keyboard.press("End");
    await page.keyboard.type(" 가");
    await page.waitForTimeout(1600);
    check("호스트가 실패하면 그 말을 그대로 전한다",
      (await page.locator(".ss-edmsg").textContent()).indexOf("개발 서버가 안 떠 있습니다") >= 0,
      await page.locator(".ss-edmsg").textContent());
    check("실패하면 «저장됨» 이 되지 않는다", (await stat()).indexOf("저장됨") < 0, await stat());
    check("«자동저장을 껐습니다» 라고 거짓말하지 않는다 — 훅은 그대로 살아 있다",
      (await page.locator(".ss-edmsg").textContent()).indexOf("껐습니다") < 0,
      await page.locator(".ss-edmsg").textContent());
    await page.keyboard.type("나");
    await page.waitForTimeout(1600);
    check("실패해도 자동저장을 끄지 않는다 — 다음 수정에서 다시 쓴다",
      (await page.evaluate(() => window.__calls || 0)) >= 2,
      await page.evaluate(() => window.__calls || 0));
  }

  /* ============ 표 블록 (#97) ============
     조건·결과 짝이 줄 나열로는 안 읽힌다. 표는 «한 블록» 이고 맨 위 층에만 온다.
     그리는 곳이 셋(뷰어·PNG·컨플루언스)이라 하나라도 빠지면 그 경로에서 내용이 조용히 사라진다. */
  if (sec("[표] 조건·결과를 표로 (#97)")) {
    const TDOC = '<h1 id="t">홈</h1><button id="b" data-spec="1" style="margin:40px">초대</button>' +
      "<script>window.SCREENSPEC={screen:{id:'S-T',name:'홈'},specs:[{n:1,target:'1',title:'초대 버튼',defs:[" +
      "{t:'버튼 문구로 현재 상태 표시'}," +
      "{kind:'table',head:['상태','버튼 문구'],rows:[['정상','{N}명 초대하기'],['오류','오류 {N}건']]}" +
      "]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(TDOC);
    /* 조립 상자가 붙는 «순간» 을 붙잡는다 — PNG 캡처 뒤에는 치워진다 */
    await page.evaluate(() => {
      const orig = Element.prototype.appendChild;
      Element.prototype.appendChild = function (n) {
        /* 요소를 «들고» 있는다 — 붙는 순간에는 아직 비어 있고, 캡처 뒤 떼어져도 내용은 읽힌다 */
        if (n && n.classList && n.classList.contains("ss-cap")) (window.__caps = window.__caps || []).push(n);
        return orig.call(this, n);
      };
    });
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);

    check("설정에 쓴 표가 뷰어에 표로 나온다", await page.evaluate(() => {
      const t = document.querySelector(".ss-tbl");
      if (!t) return false;
      return [...t.querySelectorAll("th")].map((x) => x.textContent).join("|") === "상태|버튼 문구" &&
        [...t.querySelectorAll("td")].map((x) => x.textContent).join("|") === "정상|{N}명 초대하기|오류|오류 {N}건";
    }), await page.$$eval(".ss-tbl th,.ss-tbl td", (e) => e.map((x) => x.textContent)));
    /* 이것이 위계 규칙(272자리)을 지키는 근거다 — 표가 쪼개지면 그 전제가 깨진다 */
    check("표는 «한 블록» 이다", await page.evaluate(() =>
      document.querySelectorAll('.ss-b[data-kind="table"]').length === 1));
    check("좁으면 접지 않고 블록 안에서 가로로 굴린다", await page.evaluate(() =>
      getComputedStyle(document.querySelector(".ss-tbl-wrap")).overflowX === "auto"));

    await page.click('.ss-tcell[data-r="0"][data-c="1"]');
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.type("고침");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("셀을 고치면 설정에 남는다 (t 가 비어도 안 지워진다)", await page.evaluate(() => {
      const s = window.ScreenSpec.serialize();
      return s.indexOf("고침") >= 0 && /kind:\s*"table"/.test(s);
    }), (await page.evaluate(() => window.ScreenSpec.serialize())).slice(0, 200));

    await page.click('.ss-tcell[data-r="0"][data-c="0"]');
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    check("Tab 으로 다음 칸으로 간다", await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && a.dataset.ed === "cell" && a.dataset.r === "0" && a.dataset.c === "1";
    }), await page.evaluate(() => { const a = document.activeElement; return a ? a.dataset.r + "/" + a.dataset.c : "none"; }));
    await page.click('.ss-tcell[data-r="1"][data-c="1"]');
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    check("마지막 칸에서 Enter 면 행이 는다", await page.evaluate(() =>
      document.querySelectorAll(".ss-tbl tbody tr").length === 3));

    /* PNG — 그리는 곳 둘째. 빠지면 그림에서만 내용이 사라진다 */
    await page.click(".ss-prbtn");
    await page.waitForTimeout(300);
    await page.evaluate(() => (document.querySelector("#ss-prTable").checked = true));
    await page.click('[data-pr="go"]');
    await page.waitForTimeout(1200);
    const cap = await page.evaluate(() => ((window.__caps || []).map((n) => n.innerHTML).join("")) || "");
    /* 앞에서 셀을 「고침」 으로 바꿔 놨다 — 옛 값이 아니라 지금 값으로 찾는다 */
    check("PNG 조립물에도 표로 들어간다 (#97)",
      cap.indexOf("ss-pr-in-tbl") >= 0 && cap.indexOf("고침") >= 0 && cap.indexOf("상태") >= 0,
      "길이 " + cap.length + " · in-tbl " + (cap.indexOf("ss-pr-in-tbl") >= 0) + " · 고침 " + (cap.indexOf("고침") >= 0));
    await page.click('[data-pr="cancel"]');
    await page.waitForTimeout(200);

    /* 슬래시로 만들기 */
    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.keyboard.press("/");
    await page.waitForTimeout(300);
    check("슬래시 메뉴에 «표» 가 있다", (await page.locator('.ss-slash [data-sl="tbl"]').count()) === 1);
    await page.click('.ss-slash [data-sl="tbl"]');
    await page.waitForTimeout(500);
    check("슬래시로 표가 생긴다", await page.evaluate(() =>
      document.querySelectorAll('.ss-b[data-kind="table"]').length === 2));
    check("만들면 첫 머리칸에 커서가 간다 — 만들자마자 쓴다", await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && a.dataset.ed === "cell" && a.dataset.r === "-1";
    }));

    /* 지우는 길 (#97, PM 2026-09-02) — 표는 «비울» 수가 없어서 Backspace 로 지울 길이 없었다.
       늘 보이는 × 는 여전히 안 만든다(2026-08-30 결정) — 이미 있는 ⠿ 를 «눌렀을 때» 를 쓴다 */
    await page.goto("about:blank");
    await page.setContent(TDOC);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    /* 빈 행에서 Backspace → 그 행만 */
    await page.click('.ss-tcell[data-r="1"][data-c="0"]');
    await page.keyboard.press(MOD + "+a"); await page.keyboard.press("Delete");
    await page.keyboard.press("Tab");
    await page.keyboard.press(MOD + "+a"); await page.keyboard.press("Delete");
    await page.waitForTimeout(150);
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(400);
    check("빈 행에서 Backspace 면 그 행이 지워진다 (#97)", await page.evaluate(() =>
      document.querySelectorAll(".ss-tbl tbody tr").length === 1),
      await page.evaluate(() => document.querySelectorAll(".ss-tbl tbody tr").length));
    /* ⠿ → 메뉴 → 삭제 */
    await page.click('.ss-b[data-kind="table"] .ss-g-grip');
    await page.waitForTimeout(300);
    check("⠿ 를 누르면 블록 메뉴가 뜬다 (#97)", (await page.locator(".ss-blkmenu").count()) === 1);
    await page.click('.ss-blkmenu [data-bm="del"]');
    await page.waitForTimeout(400);
    check("메뉴의 삭제로 표가 통째로 사라진다 (#97)", await page.evaluate(() =>
      document.querySelectorAll('.ss-b[data-kind="table"]').length === 0 &&
      window.ScreenSpec.serialize().indexOf('kind: "table"') < 0));
    check("옆의 글자 줄은 그대로다", await page.evaluate(() =>
      window.ScreenSpec.serialize().indexOf("버튼 문구로 현재 상태 표시") >= 0));
    /* 같은 길이 글자 블록에도 통한다 — 표만의 특례를 만들지 않는다 */
    await page.click('.ss-b:not([data-kind="table"]) .ss-g-grip');
    await page.waitForTimeout(300);
    await page.click('.ss-blkmenu [data-bm="del"]');
    await page.waitForTimeout(400);
    check("글자 블록도 같은 메뉴로 지워진다 (#97)", await page.evaluate(() =>
      window.ScreenSpec.serialize().indexOf("버튼 문구로 현재 상태 표시") < 0));
  }

  /* ============ 출처 각주 (#100) ============
     출처는 사전에 한 번, 줄은 ref 키만. 번호는 화면별 첫 등장 순서로 자동.
     낡은 문서를 최신으로 오인하는 사고가 실제로 셋 있었다 — 값 옆에 근거가 서는 것이 목적이다. */
  if (sec("[출처] 근거 각주 (#100)")) {
    const RDOC = '<h1 id="t">홈</h1><button id="b" data-spec="1" style="margin:40px">초대</button>' +
      "<script>window.SCREENSPEC={" +
      "sources:{kps:{label:'KPS 연동 정책',href:'https://example.com/kps'}," +
      "ctrl:{label:'Ctrl.R 방문자 초대',href:'https://example.com/ctrl'}}," +
      "screen:{id:'S-R',name:'홈'},specs:[{n:1,target:'1',title:'차량번호',defs:[" +
      "{t:'형식을 검사하지 않음',ref:'kps'}," +
      "{t:'16자째부터 입력되지 않음',ref:'kps'}," +
      "{t:'초대 상한은 계약 기간 총량',ref:'ctrl'}," +
      "{t:'근거 없는 줄'}," +
      "{t:'죽은 키를 가리키는 줄',ref:'ghost'}" +
      "]}]};<" + "/script>";
    const rWarns = [];
    const onRW = (m) => { if (m.type() === "warning") rWarns.push(m.text()); };
    page.on("console", onRW);
    await page.goto("about:blank");
    await page.setContent(RDOC);
    await page.evaluate(() => {
      const orig = Element.prototype.appendChild;
      window.__caps = [];
      Element.prototype.appendChild = function (n) {
        if (n && n.classList && n.classList.contains("ss-cap")) window.__caps.push(n);
        return orig.call(this, n);
      };
    });
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);

    check("줄 끝에 각주가 선다 — 같은 출처는 같은 번호, 첫 등장 순서", await page.evaluate(() => {
      const sups = [...document.querySelectorAll(".ss-ref a")].map((a) => a.textContent);
      return sups.join("|") === "1|1|2";
    }), await page.$$eval(".ss-ref a", (e) => e.map((x) => x.textContent)));
    check("번호가 곧 링크다 (새 탭 · 원본 제목)", await page.evaluate(() => {
      const a = document.querySelector(".ss-ref a");
      return a.getAttribute("href") === "https://example.com/kps" && a.target === "_blank" &&
        a.getAttribute("title") === "KPS 연동 정책";
    }));
    check("화면 발치에 「출처」 목록 — 이 화면이 무엇에 근거하나", await page.evaluate(() => {
      const box = document.querySelector(".ss-srcs");
      if (!box) return false;
      const items = [...box.querySelectorAll("li a")].map((a) => a.textContent);
      return items.join("|") === "KPS 연동 정책|Ctrl.R 방문자 초대";
    }), await page.$$eval(".ss-srcs li a", (e) => e.map((x) => x.textContent)));
    check("죽은 키는 각주를 안 달고 콘솔로 말한다",
      (await page.locator(".ss-ref a").count()) === 3 && rWarns.some((t) => t.indexOf('ref "ghost"') >= 0),
      rWarns.slice(-2));

    /* 글자를 고쳐도 ref 는 산다 */
    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.type(" (고침)");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("줄을 고쳐도 ref 가 설정에 남는다", await page.evaluate(() => {
      const t = window.ScreenSpec.serialize();
      return t.indexOf('ref: "kps"') >= 0 && t.indexOf("(고침)") >= 0 && /sources:/.test(t);
    }), (await page.evaluate(() => window.ScreenSpec.serialize())).slice(0, 260));

    /* PNG — 번호와 출처 절이 그림에 같이 실린다 */
    await page.click(".ss-prbtn");
    await page.waitForTimeout(300);
    await page.evaluate(() => (document.querySelector("#ss-prTable").checked = true));
    await page.click('[data-pr="go"]');
    await page.waitForTimeout(1200);
    const rcap = await page.evaluate(() => ((window.__caps || []).map((n) => n.innerHTML).join("")) || "");
    check("PNG 조립물에 위첨자 번호 + 「출처」 절이 실린다 (#100)",
      rcap.indexOf("ss-pr-ref") >= 0 && rcap.indexOf("ss-pr-srcs") >= 0 && rcap.indexOf("KPS 연동 정책") >= 0,
      rcap.slice(-200));
    await page.click('[data-pr="cancel"]');
    page.off("console", onRW);
  }

  /* ============ 머메이드 블록 (#98) ============
     순서도 «코드» 를 블록으로 담는다 — 원본이 하나이고 목적지마다 그쪽 뷰어가 그린다.
     mermaid.js 는 그 블록이 있는 문서에서만 CDN 지연 로드. 여기서는 네트워크를 안 탄다 —
     window.mermaid 가 있으면 로더가 CDN 을 안 부르므로 가짜를 먼저 심는다. 실물 CDN 은 QA-09. */
  if (sec("[머메이드] 순서도 코드 블록 (#98)")) {
    const MDOC = '<h1 id="t">홈</h1><button id="b" data-spec="1" style="margin:40px">초대</button>' +
      "<script>window.SCREENSPEC={screen:{id:'S-M',name:'홈'},specs:[{n:1,target:'1',title:'초대 버튼',defs:[" +
      "{t:'상태 우선순위'}," +
      "{kind:'mermaid',code:'graph TD; A-->B'}" +
      "]}]};<" + "/script>";
    /* ── 그려지는 길: 가짜 mermaid 가 svg 를 준다 ── */
    await page.goto("about:blank");
    await page.setContent(MDOC);
    await page.evaluate(() => {
      window.mermaid = { initialize() {}, render: async (id, code) => ({ svg: '<svg data-fake="1"><text>' + code.length + "</text></svg>" }) };
      const orig = Element.prototype.appendChild;
      window.__caps = [];
      Element.prototype.appendChild = function (n) {
        if (n && n.classList && n.classList.contains("ss-cap")) window.__caps.push(n);
        return orig.call(this, n);
      };
    });
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(500);
    check("설정의 머메이드 블록이 그려진다 (코드는 숨는다)", await page.evaluate(() => {
      const svg = document.querySelector('.ss-mm-svg svg[data-fake]');
      const code = document.querySelector(".ss-mm-code");
      return !!svg && !!code && code.hidden === true;
    }));
    check("직렬화에 코드가 그대로 남는다 — t 가 비어도 안 지워진다", await page.evaluate(() => {
      const t = window.ScreenSpec.serialize();
      return /kind:\s*"mermaid"/.test(t) && t.indexOf("graph TD; A-->B") >= 0;
    }), (await page.evaluate(() => window.ScreenSpec.serialize())).slice(0, 200));
    /* PNG — 뷰어가 그려 둔 svg 를 재사용한다 */
    await page.click(".ss-prbtn");
    await page.waitForTimeout(300);
    await page.evaluate(() => (document.querySelector("#ss-prTable").checked = true));
    await page.click('[data-pr="go"]');
    await page.waitForTimeout(1200);
    const mcap = await page.evaluate(() => ((window.__caps || []).map((n) => n.innerHTML).join("")) || "");
    check("PNG 조립물에 그린 svg 가 들어간다 (#98)", mcap.indexOf('data-fake="1"') >= 0, mcap.slice(0, 160));
    await page.click('[data-pr="cancel"]');
    /* ⠿ 로 지워진다 — 표와 같은 길 */
    await page.click('.ss-b[data-kind="mermaid"] .ss-g-grip');
    await page.waitForTimeout(250);
    await page.click('.ss-blkmenu [data-bm="del"]');
    await page.waitForTimeout(300);
    check("⠿ 메뉴로 지워진다 (표와 같은 길)", await page.evaluate(() =>
      !document.querySelector('.ss-b[data-kind="mermaid"]') &&
      window.ScreenSpec.serialize().indexOf("mermaid") < 0));

    /* ── 바닥: 그리기가 실패하면 코드가 그대로 남는다 ── */
    await page.goto("about:blank");
    await page.setContent(MDOC);
    const mWarns = [];
    const onMW = (m) => { if (m.type() === "warning") mWarns.push(m.text()); };
    page.on("console", onMW);
    await page.evaluate(() => {
      window.mermaid = { initialize() {}, render: async () => { throw new Error("문법이 틀렸다"); } };
    });
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(500);
    check("실패하면 코드 블록이 바닥이다 — 내용이 사라지지 않는다", await page.evaluate(() => {
      const code = document.querySelector(".ss-mm-code");
      return !!code && code.hidden !== true && code.textContent === "graph TD; A-->B" &&
        !!document.querySelector(".ss-mm-note");
    }));
    check("왜 못 그렸는지 콘솔로 말한다", mWarns.some((t) => t.indexOf("머메이드를 못 그렸") >= 0), mWarns.slice(-2));
    page.off("console", onMW);
  }

  /* ============ 폰 폭에서 툴바가 접힌다 (#94) ============
     툴바가 546px 를 요구해 «화면정의서» 버튼이 「모바일」 아래에 깔렸다 — 폰에서는
     문서 모드에 들어갈 수조차 없었다. 좁은 폭: 폭 시뮬레이터 숨김 + 도구는 ⋯ 로. */
  if (sec("[모바일] 폰 폭에서 툴바가 접힌다 (#94)")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("file:///" + REPO.replace(/\\/g, "/") + "/examples/shop.html");
    await page.waitForTimeout(600);
    check("«화면정의서» 버튼이 다른 버튼 아래 깔리지 않는다", await page.evaluate(() => {
      const b = document.getElementById("ss-mDoc"), r = b.getBoundingClientRect();
      const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return hit === b || b.contains(hit);
    }));
    check("폭 시뮬레이터는 숨는다 — 자기 화면이 곧 기기다", await page.evaluate(() => {
      const w = document.querySelector(".ss-widthsim");
      return !w || !w.getClientRects().length;
    }));
    check("보이는 툴바 요소가 화면 밖으로 안 잘린다", await page.evaluate(() =>
      [...document.querySelectorAll(".ss-toolbar *")].every((el) => {
        if (!el.getClientRects().length) return true;
        const r = el.getBoundingClientRect();
        return r.right <= innerWidth + 1 && r.left >= -1;
      })));
    check("도구는 ⋯ 뒤로 접힌다 (개별 버튼 비표시)", await page.evaluate(() => {
      const more = document.querySelector(".ss-more");
      const sv = document.querySelector(".ss-svbtn");
      return !!more && more.getClientRects().length > 0 && sv && !sv.getClientRects().length;
    }));
    await page.click(".ss-more");
    await page.waitForTimeout(200);
    check("⋯ 를 누르면 도구가 펼쳐진다", await page.evaluate(() => {
      const sv = document.querySelector(".ss-svbtn"), pr = document.querySelector(".ss-prbtn");
      return sv && sv.getClientRects().length > 0 && pr && pr.getClientRects().length > 0;
    }));
    await page.click("body", { position: { x: 200, y: 500 } });
    await page.waitForTimeout(200);
    check("바깥을 누르면 닫힌다", await page.evaluate(() =>
      !document.querySelector(".ss-toolbar").classList.contains("ss-tools-open")));
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("폰 폭에서 문서 모드 전환이 «탭으로» 된다", await page.evaluate(() =>
      document.body.classList.contains("ss-mode-doc")));
    /* 넓은 폭으로 돌아오면 전과 같다 */
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    check("넓은 폭: ⋯ 는 없고 도구가 한 줄로 보인다", await page.evaluate(() => {
      const more = document.querySelector(".ss-more");
      const pr = document.querySelector(".ss-prbtn");
      const w = document.querySelector(".ss-widthsim .ss-seg");
      return more && !more.getClientRects().length && pr && pr.getClientRects().length > 0 &&
        w && w.getClientRects().length > 0;
    }));
  }

  /* ============ 슬래시는 아무 데서나 열린다 (#85) ============
     빈 줄에서만 열리던 것을 노션과 맞춘다 — 글자 뒤에 쳐도 그 자리에서 열리고,
     고르면 «/» 와 그 뒤에 친 글자가 사라진다. 안 걸리면 그냥 글자다. */
  if (sec("[슬래시] 아무 데서나 열린다 (#85)")) {
    const DOC = '<h1 id="t">홈</h1><button id="b" data-spec="1" style="margin:40px">사기</button>' +
      "<script>window.SCREENSPEC={screen:{id:'S-SL',name:'홈'},specs:[{n:1,target:'1',title:'구매'," +
      "defs:[{t:'첫 줄'}]}]};<" + "/script>";
    const line = '.ss-dt[data-ed="b"][data-di="0"]';
    const open = () => page.locator(".ss-slash").count();
    const fresh = async () => {
      await page.goto("about:blank");
      await page.setContent(DOC);
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(400);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(300);
      await page.click(line);
      await page.keyboard.press("End");
    };

    await fresh();
    await page.keyboard.press("/");
    await page.waitForTimeout(250);
    check("글자가 있는 줄에서도 / 로 열린다", (await open()) === 1);
    check("«넣기» 셋은 그대로 나온다",
      (await page.locator('.ss-slash [data-sl="num"], .ss-slash [data-sl="bul"], .ss-slash [data-sl="why"]').count()) === 3,
      await page.locator(".ss-slash [data-sl]").allTextContents());
    /* 개요는 줄이 아니라 항목이다 — 글자가 있는 줄을 개요로 바꿀 수는 없다 */
    check("글자가 있는 줄에는 «화면 개요» 를 안 준다",
      (await page.locator('.ss-slash [data-sl="brief"]').count()) === 0);
    await page.click('.ss-slash [data-sl="why"]');
    await page.waitForTimeout(300);
    check("고르면 «/» 가 글에 안 남는다",
      (await page.locator(line).textContent()).indexOf("/") < 0,
      await page.locator(line).textContent());
    check("고른 것이 적용된다 (화살표 블록)", (await page.locator('.ss-b[data-kind="why"]').count()) > 0);
    check("원래 글자는 그대로다", (await page.locator(line).textContent()).indexOf("첫 줄") === 0,
      await page.locator(line).textContent());

    /* 이어 친 글자로 걸러진다 — 노션과 같다 */
    await fresh();
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    await page.keyboard.type("불");
    await page.waitForTimeout(250);
    check("이어 친 글자로 걸러진다", (await page.locator(".ss-slash [data-sl]").count()) === 1 &&
      (await page.locator(".ss-slash [data-sl]").getAttribute("data-sl")) === "bul",
      await page.locator(".ss-slash [data-sl]").allTextContents());
    await page.click('.ss-slash [data-sl="bul"]');
    await page.waitForTimeout(300);
    check("고르면 «/» 와 거르려고 친 글자까지 걷힌다",
      (await page.locator(line).textContent()) === "첫 줄", await page.locator(line).textContent());

    /* 걸리는 것이 없으면 «/» 는 그냥 글자다 */
    await fresh();
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    await page.keyboard.type("결제수단");
    await page.waitForTimeout(250);
    check("안 걸리면 메뉴가 닫힌다", (await open()) === 0);
    check("안 걸리면 «/» 는 그냥 글자로 남는다",
      (await page.locator(line).textContent()) === "첫 줄/결제수단",
      await page.locator(line).textContent());

    /* 빈 줄에서는 «화면» 묶음이 그대로 붙는다 (#82 와 갈리지 않는다) */
    await fresh();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("/");
    await page.waitForTimeout(250);
    check("빈 줄에서는 «화면 개요» 가 그대로 나온다 (#82)",
      (await page.locator('.ss-slash [data-sl="brief"]').count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("Esc 로 닫힌다", (await open()) === 0);

    /* 슬래시가 낀 «그냥 글» 을 빠르게 쳐도 한 글자도 안 사라진다.
       메뉴는 «/» 가 들어간 다음 판에 열리므로, 그 사이에 더 친 글자를 못 보면
       뒤늦게 빈 메뉴가 떠서 다음 키(Shift+Enter)를 삼킨다 — 전체 e2e 가 이걸 잡았다 */
    await fresh();
    await page.keyboard.press("End");
    await page.keyboard.type(" POST /api/items");
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(300);
    check("슬래시가 낀 글을 빨리 쳐도 안 잘린다 (#85)",
      (await page.locator(line).textContent()) === "첫 줄 POST /api/items",
      await page.locator(line).textContent());
    check("그 뒤에 메뉴가 남아 있지 않다 (#85)", (await open()) === 0);

    /* 메뉴가 떠 있어도 Shift+Enter 는 «여기서 그만» 이다 — 어디서나 같은 뜻이어야 한다 */
    await fresh();
    await page.keyboard.press("/");
    await page.waitForTimeout(250);
    check("메뉴가 떠 있는 것을 확인하고", (await open()) === 1);
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(300);
    check("Shift+Enter 를 메뉴가 가로채지 않는다 (#85)",
      (await page.locator(line).textContent()) === "첫 줄/" &&
      (await page.locator(".ss-pickbar, .ss-picking").count()) === 0,
      await page.locator(line).textContent());
  }

  /* ============ route 로도 화면이 간다 (#99) ============
     전에는 목차만 route 를 소프트로 시도했고(접두도 안 붙였다), setScreen·flow ▶ 는 문서만 바꿨다.
     한 길(setScreen→goRoute)로 접었다: 신호(screenspec:screenchange) → 호스트가 안 맡으면
     frame 은 액자를 우리가 옮기고, overlay 는 pushState+popstate 소프트 시도. */
  if (sec("[화면] route 로도 간다 (#99)")) {
    const mkSrv = (mode) => http.createServer((req, res) => {
      if (req.url.endsWith("screenspec.js")) { res.setHeader("content-type", "text/javascript"); res.end(LIB); return; }
      res.setHeader("content-type", "text/html");
      res.end(fs.readFileSync(path.join(REPO, "examples/overlay-spa.html"), "utf8")
        .replace("../screenspec.js", "/screenspec.js").replace('mode: "overlay"', 'mode: "' + mode + '"'));
    });
    /* ── frame: 액자는 우리가 소유한다 — 우리가 옮긴다 ── */
    const sF = mkSrv("frame");
    await new Promise((r) => sF.listen(4197, r));
    const infos = [];
    const onInfo = (m) => { if (m.type() === "info") infos.push(m.text()); };
    page.on("console", onInfo);
    await page.goto("http://localhost:4197/screenspec/examples/overlay-spa.html");
    await page.waitForTimeout(1200);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(900);
    const fst = () => page.evaluate(() => {
      const f = document.querySelector("iframe[data-ss-frame]");
      return { cur: window.ScreenSpec.current(), inner: f && f.contentWindow ? f.contentWindow.location.pathname : null };
    });
    await page.evaluate(() => window.ScreenSpec.setScreen("S-09"));
    await page.waitForTimeout(1300);
    let a = await fst();
    check("frame·API: 액자가 따라간다 — 접두(basePath)를 도로 붙여서", a.inner === "/screenspec/examples/members" && a.cur === "S-09", a);
    await page.click(".ss-toc-btn");
    await page.waitForTimeout(300);
    await page.click('[data-toc="S-01"]');
    await page.waitForTimeout(1300);
    a = await fst();
    check("frame·목차: 같은 길이라 같이 고쳐졌다 (#74 의 교훈)", a.inner === "/screenspec/examples/home" && a.cur === "S-01", a);
    await page.evaluate(() => window.ScreenSpec.setScreen("S-10"));
    await page.waitForTimeout(600);
    a = await fst();
    check("frame·패턴 라우트: 갈 주소가 없다 — 문서만 바꾸고 콘솔로 말한다",
      a.cur === "S-10" && a.inner === "/screenspec/examples/home" && infos.some((t) => t.indexOf("패턴이라") >= 0),
      { a: a, tail: infos.slice(-1) });
    const got = await page.evaluate(async () => {
      let d = null;
      window.addEventListener("screenspec:screenchange", (e) => { d = e.detail; e.preventDefault(); }, { once: true });
      window.ScreenSpec.setScreen("S-11");
      await new Promise((r) => setTimeout(r, 700));
      const f = document.querySelector("iframe[data-ss-frame]");
      return { d: d, inner: f.contentWindow.location.pathname };
    });
    check("frame·신호: screenchange(detail id·route) 가 오고, preventDefault 면 우리는 비킨다",
      !!got.d && got.d.id === "S-11" && got.d.route === "/members/invite" && got.inner === "/screenspec/examples/home", got);
    page.off("console", onInfo);
    sF.close();

    /* ── overlay: 앱이 라우팅을 소유한다 — 소프트 시도 + 신호 ── */
    const sO = mkSrv("overlay");
    await new Promise((r) => sO.listen(4196, r));
    await page.goto("http://localhost:4196/screenspec/examples/overlay-spa.html");
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.ScreenSpec.setScreen("S-09"));
    await page.waitForTimeout(700);
    const o = await page.evaluate(() => ({ cur: window.ScreenSpec.current(), path: location.pathname }));
    check("overlay·API: 소프트 시도로 popstate 듣는 라우터가 따라온다 — 접두 보존",
      o.cur === "S-09" && o.path === "/screenspec/examples/members", o);
    const og = await page.evaluate(async () => {
      let d = null, pathRight = null;
      window.addEventListener("screenspec:screenchange", (e) => { d = e.detail; e.preventDefault(); }, { once: true });
      window.ScreenSpec.setScreen("S-01");
      pathRight = location.pathname; /* preventDefault 직후 — 우리는 주소를 안 건드렸다 */
      await new Promise((r) => setTimeout(r, 400));
      return { d: d, pathRight: pathRight, revert: window.ScreenSpec.current() };
    });
    check("overlay·신호: preventDefault 면 주소를 안 건드리고, 호스트가 안 가면 감지가 정직하게 되돌린다",
      !!og.d && og.d.id === "S-01" && og.pathRight === "/screenspec/examples/members" && og.revert === "S-09", og);
    await page.evaluate(() => { const l = [...document.querySelectorAll("a")].find((x) => /home/.test(x.getAttribute("href") || "")); if (l) l.click(); });
    await page.waitForTimeout(700);
    const fin = await page.evaluate(() => ({ cur: window.ScreenSpec.current(), path: location.pathname }));
    check("overlay·신호: 호스트가 정말로 이동하면 문서가 따라온다", fin.cur === "S-01" && /home$/.test(fin.path), fin);
    sO.close();
  }

  /* ============ root 없는 화면도 전환된다 (#67) ============
     목차에서 골라도 «설명만» 바뀌고 프로토타입은 그대로였다. 정의가 가리키는 요소의
     공통 조상을 찾아 세운다. 어느 요소인지 모호하면 세우지 않고 «말로» 알린다. */
  if (sec("[화면] root 없이도 전환 (#67)")) {
    const scr = (id, a, b) => '{id:"' + id + '",name:"' + id + '",path:["' + id + '"],specs:[' +
      '{n:1,target:"' + a + '",title:"제목",defs:[{t:"정의"}]},{n:2,target:"' + b + '",title:"본문",defs:[{t:"정의"}]}]}';
    /* ① target 이 화면마다 다르다 → 공통 조상을 찾아 세운다 */
    const two = '<div id="A"><h1 data-spec="1">A</h1><p data-spec="2">a</p></div>' +
      '<div id="B"><h1 data-spec="3">B</h1><p data-spec="4">b</p></div>' +
      '<script>window.SCREENSPEC={mode:"wrap",screens:[' + scr("S-01", "1", "2") + ',' + scr("S-02", "3", "4") + ']}<\/script>';
    await page.goto("about:blank");
    await page.setContent(two);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    const shows = () => page.evaluate(() => ["A", "B"].map((i) => document.getElementById(i).getClientRects().length > 0));
    check("처음 모습은 프로토타입의 것 (아무것도 숨기지 않는다)", JSON.stringify(await shows()) === "[true,true]");
    await page.evaluate(() => window.ScreenSpec.setScreen("S-02"));
    await page.waitForTimeout(300);
    check("root 를 안 적어도 두 번째 화면으로 전환된다", JSON.stringify(await shows()) === "[false,true]");
    await page.evaluate(() => window.ScreenSpec.setScreen("S-01"));
    await page.waitForTimeout(300);
    check("되돌아온다", JSON.stringify(await shows()) === "[true,false]");
    /* 정의서 모드는 «지금 설명하는 화면» 만 보인다 (#75). 새로 띄워 «둘 다 보이는» 데서 시작해야
       좁혔는지를 잴 수 있다 — 앞의 setScreen 이 이미 하나를 숨겨 둔 상태에서 재면 늘 통과한다
       (돌연변이 검사가 이 가짜를 잡아냈다, 2026-08-31) */
    await page.goto("about:blank");
    await page.setContent(two);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    const before75 = JSON.stringify(await shows());
    check("정의서 모드로 들어가기 전에는 둘 다 보인다 (#75 시험의 전제)", before75 === "[true,true]", before75);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("정의서 모드: 설명하는 화면만 보인다 (#75)", JSON.stringify(await shows()) === "[true,false]",
      JSON.stringify(await shows()));
    await page.click("#ss-mProto");
    await page.waitForTimeout(400);
    check("프로토타입 모드로 돌아가면 들어오기 직전 모습 그대로 (#75)", JSON.stringify(await shows()) === before75,
      before75 + " → " + JSON.stringify(await shows()));
    /* 사람이 실제로 누르는 길로 잰다 (#74) — setScreen 만 재면 목차의 제 경로가 안 잡힌다 */
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.locator(".ss-toc-btn").first().click({ force: true });
    await page.waitForTimeout(300);
    await page.locator("[data-toc='S-02']").first().click({ force: true });
    await page.waitForTimeout(500);
    check("목차에서 골라도 프로토타입이 바뀐다 (#74)", JSON.stringify(await shows()) === "[false,true]",
      JSON.stringify(await shows()));
    check("고른 화면이 유지된다 (화면 감지가 되돌리지 않는다)",
      (await page.evaluate(() => window.ScreenSpec.current())) === "S-02");
    /* ② 화면마다 target 이 같아 «어느 것인지» 모른다 → 세우지 않고 경고한다 */
    const warns = [];
    const onMsg = (m) => { if (m.type() === "warning") warns.push(m.text()); };
    page.on("console", onMsg);
    await page.goto("about:blank");
    await page.setContent('<div id="A"><h1 data-spec="1">A</h1><p data-spec="2">a</p></div>' +
      '<div id="B"><h1 data-spec="1">B</h1><p data-spec="2">b</p></div>' +
      '<script>window.SCREENSPEC={mode:"wrap",screens:[' + scr("S-01", "1", "2") + ',' + scr("S-02", "1", "2") + ']}<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    page.off("console", onMsg);
    check("모호하면 조용히 넘어가지 않는다 (연결 안 된 화면을 콘솔로 알린다)",
      warns.some((t) => t.includes("연결되지 않은 화면")));
    /* 연결 안 된 화면을 골라도 «설명은» 바뀌어야 한다 (#77).
       한쪽은 세워지고 한쪽은 못 세워지는 판이어야 진짜 시험이다 — 둘 다 연결 안 되면
       감지가 고를 후보 자체가 없어 가드가 있든 없든 통과한다 (돌연변이 검사가 잡은 가짜, 2026-08-31) */
    await page.goto("about:blank");
    await page.setContent('<div id="A"><h1 data-spec="1">A</h1><p data-spec="2">a</p></div>' +
      '<div id="B"><h1 data-spec="9">B</h1><p data-spec="9">b</p></div>' +
      '<script>window.SCREENSPEC={mode:"wrap",screens:[' + scr("S-01", "1", "2") + ',' + scr("S-02", "9", "9") + ']}<\/script>');
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.locator(".ss-toc-btn").first().click({ force: true });
    await page.waitForTimeout(300);
    await page.locator("[data-toc='S-02']").first().click({ force: true });
    await page.waitForTimeout(900);
    check("연결 안 된 화면도 고른 대로 남는다 (감지가 뒤집지 않는다) (#77)",
      (await page.evaluate(() => window.ScreenSpec.current())) === "S-02",
      await page.evaluate(() => window.ScreenSpec.current()));
  }

  /* ============ 목차 검색 (#9): 화면 8개 이상 ============ */
  if (sec("[docs] 목차 검색")) {
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
  if (sec("[docs] checklist")) {
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

    /* 「공통 처리」 축 (#89) — 축은 살아 있는데 화면마다 적지는 않는다.
       전에는 화면마다 skip 사유를 되풀이하거나 축을 통째로 버리거나 둘뿐이었다 */
    const kWarns = [];
    const onKMsg = (msg) => { if (msg.type() === "warning") kWarns.push(msg.text()); };
    page.on("console", onKMsg);
    await page.goto("about:blank");
    await page.setContent(covHtml('checklist:["빈 상태",{name:"로딩",common:"공통 컴포넌트가 처리"},' +
      '{name:"오류",common:"공통 컴포넌트가 처리"}],'));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    await page.evaluate(() => window.ScreenSpec.setScreen("S-B"));
    await page.waitForTimeout(300);
    check("공통 처리: 화면마다 안 적어도 경고가 안 난다 (#89)",
      (await page.locator(".ss-cov").count()) === 0,
      await page.locator(".ss-cov").allInnerTexts());
    await page.click(".ss-toc-btn");
    await page.waitForTimeout(300);
    check("공통 처리: 목차 배지도 안 붙는다 (#89)",
      (await page.locator('[data-toc="S-B"] .ss-toc-cov').count()) === 0);
    /* 축이 사라지는 것이 아니다 — 문서에 «한 번» 남는다 */
    check("공통 처리: 목차 발치에 한 번 보여 준다 (#89)", await page.evaluate(() => {
      const el = document.querySelector(".ss-toc-common");
      return !!el && el.innerText.includes("공통 처리") && el.innerText.includes("로딩") &&
        el.innerText.includes("오류") && el.innerText.includes("공통 컴포넌트가 처리");
    }), await page.locator(".ss-toc-common").allInnerTexts());
    /* 화면마다 챙기기로 한 축은 그대로 잡는다 — 이 기능의 값이 사라지면 안 된다 */
    check("공통 처리: 남은 축(빈 상태)은 여전히 잡는다 (#89)", await page.evaluate(() =>
      ((document.querySelector('[data-toc="S-C"] .ss-toc-cov') || {}).textContent || "") === "⚠ 빈 상태 미정의"),
      await page.locator('[data-toc="S-C"] .ss-toc-cov').allTextContents());
    await page.click(".ss-toc-x");
    await page.waitForTimeout(200);
    page.off("console", onKMsg);

    /* 사유 없는 common → 보통 축 + 경고 */
    const jWarns = [];
    const onJMsg = (msg) => { if (msg.type() === "warning") jWarns.push(msg.text()); };
    page.on("console", onJMsg);
    await page.goto("about:blank");
    await page.setContent(covHtml('checklist:["빈 상태","로딩",{name:"오류",common:true}],'));
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    await page.click(".ss-toc-btn");
    await page.waitForTimeout(300);
    check("공통 처리: 사유가 없으면 보통 축이다 (#89)", await page.evaluate(() =>
      ((document.querySelector('[data-toc="S-B"] .ss-toc-cov') || {}).textContent || "") === "⚠ 로딩 · 오류 미정의"),
      await page.locator('[data-toc="S-B"] .ss-toc-cov').allTextContents());
    check("공통 처리: 그때는 왜인지 말해 준다 (#89)",
      jWarns.some((w) => w.includes("common 에 사유")), jWarns.join(" | ").slice(0, 200));
    await page.click(".ss-toc-x");
    await page.waitForTimeout(200);
    page.off("console", onJMsg);

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
      bWarns.some((w) => w.includes("checklist 는 문자열 또는 { name, common } 의 배열이어야 합니다")), bWarns.join(" | ").slice(0, 160));
    page.off("console", onBMsg);
  }

  /* ============ 상태 재현 (#27): preview 이벤트 ============
     빈 상태·오류처럼 지금 화면에 없는 상태는 클릭할 요소가 없다 — 라이브러리는 표준 이벤트를 쏘고 앱이 만든다.
     앱이 detail.handled = true 로 확인응답을 해야 버튼이 켜진다 (아무도 안 들으면 그 사실을 행에 적는다). */
  if (sec("[docs] preview")) {
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

    /* 5) 영역 «안» 의 작은 요소도 같은 파이프라인 — #51 이후 그것도 그냥 번호다 */
    await page.goto("about:blank");
    await page.setContent('<div data-spec="1">목록<span data-spec="1a">3</span></div>' +
      '<script>window.SCREENSPEC={screen:{id:"S-PV3",name:"목록"},specs:[{n:1,target:"1",title:"목록 영역"},' +
      '{n:2,target:"1a",title:"항목 수",anno:"state",preview:{label:"0건 보기"}}]};' +
      'window.__pv=[];addEventListener("screenspec:preview",function(e){window.__pv.push(e.detail.n+":"+e.detail.on+":"+e.detail.title);' +
      'if(e.detail.n==="2"){document.querySelector("[data-spec=\'1a\']").textContent=e.detail.on?"0":"3";e.detail.handled=true;}});<' + "/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("preview: 그 번호의 행에 스위치가 붙는다", await page.evaluate(() => {
      const b = document.querySelector('[data-preview="2"]');
      return !!b && b.closest(".ss-row").dataset.defrow === "2" && !document.querySelector('[data-preview="1"]');
    }));
    await page.click('[data-preview="2"]');
    await page.waitForTimeout(300);
    /* 띠가 정의서 헤더를 덮지 않는다 — 뜨면 그 높이(28px)만큼 아래를 민다 (#29 QA 실측) */
    check("preview: 재현 중 띠가 정의서 헤더를 덮지 않는다", await page.evaluate(() => {
      const bar = document.querySelector(".ss-pvbar").getBoundingClientRect();
      const dh = document.querySelector(".ss-dh").getBoundingClientRect();
      return getComputedStyle(document.querySelector(".ss-pvbar")).display !== "none" && bar.bottom <= dh.top + 0.5;
    }));
    check("preview: 실제로 동작 (detail.n = 2)", await page.evaluate(() =>
      window.__pv.join("|") === "2:true:항목 수" &&
      document.querySelector('[data-spec="1a"]').textContent === "0" &&
      document.querySelector('[data-preview="2"]').getAttribute("aria-pressed") === "true"));

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
  if (sec("[docs] 설정 없음 상태")) {
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
  if (sec("[docs] off 스위치")) {
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
  if (sec("[docs] style 설정")) {
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
  if (sec("[edit] 편집 모드")) {
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
    /* #58 — 편집은 «상태» 가 아니다. 노션처럼 누르면 바로 고쳐진다 */
    check("편집: 편집 토글이 없다 (#58)", (await page.locator(".ss-editbtn").count()) === 0);
    check("편집: 켤 필요 없이 body 에 표시", await page.evaluate(() => document.body.classList.contains("ss-editing")));
    check("편집: 고칠 수 있는 글자에 표식이 붙는다", (await page.locator("[data-ed]").count()) >= 6);
    check("편집: 패널 머리는 «쓰는 자리» — 서식 단추가 보인다", await page.evaluate(() =>
      getComputedStyle(document.querySelector(".ss-edbar")).display === "flex" &&
      [...document.querySelectorAll(".ss-edbar [data-fm]")].map((x) => x.dataset.fm).join(",") === "bold"));
    check("편집: 저장 경로는 위 툴바로 옮겼다 (#58)", await page.evaluate(() => {
      const t = [...document.querySelectorAll(".ss-headbtn")].map((x) => x.textContent).join(",");
      return t.indexOf("저장") >= 0 && t.indexOf("설명 복사") >= 0 && !document.querySelector(".ss-edbar [data-sv]");
    }));
    check("편집: 새 고정 요소를 만들지 않는다 (마커·띠를 가릴 일이 없다)", await page.evaluate(() =>
      [".ss-edbar", ".ss-draft", ".ss-editbtn"].every((s) => {
        const el = document.querySelector(s);
        return !el || getComputedStyle(el).position !== "fixed";
      })));

    /* --- 글자 고치기 --- */
    await page.click('[data-defrow="1"] .ss-t');
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.type("고친 머리");
    await page.keyboard.press("Shift+Enter"); /* 0-6: 제목에서 Enter 를 치면 아래에 새 설명 줄이 생긴다 */
    await page.waitForTimeout(200);
    check("편집: 항목명이 설정에 들어간다", await page.evaluate(() => window.SCREENSPEC.specs[0].title === "고친 머리"));
    check("편집: 화면에도 그대로", await page.evaluate(() => document.querySelector('[data-defrow="1"] .ss-t').textContent === "고친 머리"));
    check("편집: 미저장 표시가 글자로 뜬다", await page.evaluate(() =>
      document.querySelector(".ss-edwhen").textContent.indexOf("저장 안 됨") >= 0 && window.ScreenSpec.dirty()));
    check("편집: 빨간 점 대신 «전부 삭제» 가 있다 (PM 2026-08-29)", await page.evaluate(() =>
      !document.querySelector(".ss-dirty-dot") &&
      (document.querySelector(".ss-wipeall") || {}).textContent === "전부 삭제"));

    await page.click('[data-defrow="1"] [data-ed="b"][data-di="0"]');
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.type("고친 첫 줄");
    await page.keyboard.press("Shift+Enter"); /* 0-6: Enter 는 새 줄 · Shift+Enter 가 «여기서 그만» */
    await page.waitForTimeout(200);
    check("편집: 설명 줄도 고쳐진다", await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t === "고친 첫 줄"));

    /* --- Esc 는 «여기서 그만» (PM 2026-08-29) ---
       치는 즉시 반영되는 이상 Esc 로 없던 일을 만들 수 없다. 되돌리기는 Ctrl+Z 가 한다.
       그리고 «한 칸을 고친 것» 은 글자 수와 상관없이 한 걸음이어야 한다 */
    await page.click('[data-defrow="2"] .ss-t');
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.type("바꾼 값");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    check("편집: Esc 는 쓴 것을 지우지 않는다", await page.evaluate(() => window.SCREENSPEC.specs[1].title === "바꾼 값"),
      await page.evaluate(() => window.SCREENSPEC.specs[1].title));
    check("편집: Esc 는 그 칸에서 빠져나온다", await page.evaluate(() => !document.querySelector(".ss-ed-on")));
    await page.keyboard.press(MOD + "+z");
    await page.waitForTimeout(250);
    check("편집: Ctrl+Z 한 번이 그 칸 전체를 되돌린다 (글자 하나씩 X)",
      await page.evaluate(() => window.SCREENSPEC.specs[1].title === "몸통"),
      await page.evaluate(() => window.SCREENSPEC.specs[1].title));

    /* --- 구조 — #45 이후 넣기는 버튼이 아니라 Enter·슬래시가 한다 --- */
    await page.click('[data-defrow="2"] [data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.type("보탠 줄");
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(200);
    check("편집: Enter 로 줄 추가", await page.evaluate(() => window.SCREENSPEC.specs[1].defs.length === 2));
    /* 지우기 버튼은 없앴다 (PM 2026-08-30) — 빈 줄에서 Backspace 가 그 일을 한다 */
    await page.click('[data-defrow="1"] .ss-dt[data-ed="b"][data-di="0"]');
    await page.waitForTimeout(150);
    /* Control+a 는 «문서 전체» 를 고른다 — 그 줄만 비운다 */
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(250);
    /* 옛 문서(why·subs)는 부팅 때 «평평한 블록» 으로 펴진다 (#55): 첫 줄 · 근거(↳) · 둘째 줄 · 하위 */
    /* 옛 문서(why·subs)는 부팅 때 트리로 선다: 첫 줄 > 근거(↳) · 둘째 줄 > 하위.
       첫 줄을 지우면 그 하위(근거)는 «있던 자리» 로 올라온다 — 딸린 것이 사라지면 안 된다 */
    check("편집: 줄 삭제 — 지운 줄의 하위는 그 자리에 남는다",
      (await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)")) === "0근거,0둘째 줄,1하위",
      await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)"));
    /* 화살표는 슬래시 또는 빈 줄에서 «>» 로 (#57) — 「이유」 라벨도 ＋이유 버튼도 없앴다 */
    await page.click('[data-defrow="1"] [data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press(">");
    await page.waitForTimeout(250);
    await page.keyboard.type("근거 한 줄");
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(200);
    check("편집: «>» 로 화살표 블록 붙이기 (#57)", await page.evaluate(() => {
      const seen = [];
      (function w(l) { (l || []).forEach((b) => { seen.push(b); w(b.c); }); })(window.SCREENSPEC.specs[0].defs);
      return seen.some((d) => d.kind === "why" && d.t === "근거 한 줄");
    }), await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)"));
    /* #49 이후 순서는 «잡아서 옮긴다» (↑↓ 버튼 없음) */
    await page.evaluate(() => {
      const src = document.querySelector('[data-defrow="2"] > .ss-gut .ss-g-grip');
      const dst = document.querySelector('[data-defrow="1"]');
      const dt = new DataTransfer();
      const sx = src.getBoundingClientRect();
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: sx.left + sx.width / 2 }));
      const r = dst.getBoundingClientRect();
      dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientY: r.top + 2, clientX: r.left + 5 }));
      dst.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt, clientY: r.top + 2, clientX: r.left + 5 }));
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    });
    await page.waitForTimeout(300);
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
    await page.click('[data-defrow="1"] [data-ed="b"][data-di="0"]');
    await page.keyboard.press(MOD + "+a");
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
    /* 저장은 툴바 단추 하나다 (#58) — 파일에 직접 쓰기가 없는 환경이면 내려받기로 떨어진다 */
    await page.evaluate(() => { delete window.showOpenFilePicker; });
    const dl = await Promise.all([page.waitForEvent("download"), page.click(".ss-svbtn")]);
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
    await page.click('[data-defrow="1"] .ss-t');
    await page.keyboard.press(MOD + "+a");
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
    check("readonly: 고칠 수 있는 표식을 아예 만들지 않는다", (await page.locator("[data-ed]").count()) === 0);
    check("readonly: 저장바도 없다", (await page.locator(".ss-edbar").count()) === 0);
    check("readonly: edit() 를 불러도 편집이 안 켜진다", await page.evaluate(() => {
      window.ScreenSpec.edit(true);
      return !document.body.classList.contains("ss-editing");
    }));
    check("readonly: 정의서 자체는 정상", (await page.locator(".ss-defs-list .ss-row").count()) === 2);
    /* 서버를 닫기 «전» 에 그 서버에서 떠나야 한다 — 요청이 남아 있으면 다음 이동이 취소된다 (플래키) */
    await page.goto("about:blank");
    srv.close();
  }

  /* ============ PNG 내보내기 (#40) — 컨플·노션에 붙일 그림 한 장 ============
     실제로 PNG 를 만들어 «백지가 아닌지(잉크 비율)» 까지 본다. 클래스만 세는 검사는
     「그림이 제대로 나오는가」를 검증하지 못한다. 세 모드(wrap·overlay·frame) 전부 확인한다. */
  if (sec("[export] PNG 내보내기")) {
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
  if (sec("[layer] 개발 정의 레이어")) {
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
      [...document.querySelectorAll('[data-defrow="1"] .ss-dev .ss-b .ss-dt')].map((x) => x.textContent).join() === "GET /api/items"));
    check("레이어: 기획 줄은 개발 블록 밖에 그대로", await page.evaluate(() =>
      [...document.querySelectorAll('[data-defrow="1"] .ss-kids .ss-b .ss-dt')].map((x) => x.textContent).join() === "기획 한 줄,기획 둘째 줄"));
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
    check("레이어: 「기획」 이어도 기획 줄은 그대로", (await disp('[data-defrow="1"] .ss-kids')) !== "none");
    check("레이어: 「기획」 이면 화면 공통(개발)도 숨는다", (await disp(".ss-dev-common")) === "none");

    await page.click('[data-ly="dev"]');
    await page.waitForTimeout(150);
    check("레이어: 「개발」 을 고르면 기획 줄이 안 보인다", (await disp('[data-defrow="1"] .ss-kids')) === "none");
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
    await page.waitForTimeout(200);
    await page.click('[data-defrow="1"] .ss-dev [data-ed="b"]');
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.type("POST /api/items");
    await page.keyboard.press("Shift+Enter"); /* 0-6: Enter 는 새 줄 · Shift+Enter 는 여기서 그만 */
    await page.waitForTimeout(200);
    check("레이어: 개발 줄 편집이 «그 자리» 에 정확히 들어간다", await page.evaluate(() =>
      window.SCREENSPEC.specs[0].defs.map((d) => (d.layer || "plan") + ":" + d.t).join("|") ===
      "plan:기획 한 줄|dev:POST /api/items|plan:기획 둘째 줄"),
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs));
    /* #46: 개발 정의를 «만드는 길» 은 아카이브했다 — 버튼도 슬래시 항목도 없어야 한다 */
    check("레이어: 개발 줄을 만드는 버튼이 없다 (#46 아카이브)",
      (await page.locator('[data-ec="adddev"]').count()) === 0);
    check("레이어: 슬래시에도 개발 항목이 없다", await page.evaluate(() => {
      const el = document.querySelector('[data-defrow="1"] [data-ed="b"]');
      return !document.querySelector('.ss-slash [data-sl="dev"]') && !!el;
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
  if (sec("[edit2] 최소 에디터 (0-6)")) {
    const HTML2 = '<div id="a" data-spec="1">본문</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-A',name:'a'}," +
      "specs:[{n:1,target:'1',anno:'box',title:'영역',defs:[{t:'첫 줄'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(HTML2);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.waitForTimeout(200);
    const defs = () => page.evaluate(() => JSON.parse(JSON.stringify(window.SCREENSPEC.specs[0].defs)));

    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.type("둘째 줄");
    await page.click("#ss-mDoc"); /* 바깥을 누르면 반영 */
    await page.waitForTimeout(150);
    check("에디터: Enter 로 같은 층에 새 줄", (await defs()).length === 2, await defs());

    await page.click('.ss-dt[data-ed="b"][data-di="1"]');
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    let c = await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)");
    check("에디터: Tab 으로 한 단 들어간다", c === "0첫 줄,1둘째 줄", c);

    await page.keyboard.type("셋째");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.type("넷째");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    c = await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)");
    check("에디터: 2단까지 들어간다 (더는 안 들어간다)", c === "0첫 줄,1둘째 줄셋째,2넷째", c);
    check("에디터: 2단 블록도 같은 글머리표로 그린다", (await page.locator(".ss-b.ss-in2").count()) === 1 &&
      (await page.locator(".ss-no").count()) >= 1);

    await page.keyboard.press("Shift+Tab");
    await page.waitForTimeout(200);
    c = await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)");
    check("에디터: Shift+Tab 으로 한 단 나온다", c === "0첫 줄,1둘째 줄셋째,1넷째", c);

    await page.keyboard.press(MOD + "+a");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);
    c = await page.evaluate(FLAT + "(window.SCREENSPEC.specs[0].defs)");
    check("에디터: 빈 줄에서 Backspace 면 그 줄이 사라진다", c === "0첫 줄,1둘째 줄셋째", c);

    await page.keyboard.press(MOD + "+z");
    await page.waitForTimeout(150);
    await page.keyboard.press(MOD + "+z");
    await page.waitForTimeout(150);
    const undone = await defs();
    check("에디터: Ctrl+Z 는 여러 걸음 돌아간다", JSON.stringify(undone) !== JSON.stringify(c), undone);
    await page.keyboard.press(MOD + "+Shift+z");
    await page.waitForTimeout(150);
    check("에디터: Ctrl+Shift+Z 로 다시 앞으로", JSON.stringify(await defs()) !== JSON.stringify(undone), await defs());

    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    /* «넣기» 묶음은 셋이다 (번호·불릿·화살표). 개요가 없는 화면에서는 «화면» 묶음이 하나 더 붙는다 (#82) */
    check("에디터: 빈 줄에서 / 를 치면 «넣기» 셋을 고른다 (번호·불릿·화살표)",
      (await page.locator('.ss-slash [data-sl="num"], .ss-slash [data-sl="bul"], .ss-slash [data-sl="why"]').count()) === 3,
      await page.locator(".ss-slash [data-sl]").allTextContents());
    check("에디터: 오른쪽에 마크다운 단축키가 보인다",
      (await page.locator(".ss-sl-key").allTextContents()).join(",").includes("-"));
    await page.click('.ss-slash [data-sl="why"]');
    await page.waitForTimeout(250);
    check("에디터: / 메뉴의 «화살표» 가 화살표 블록을 만든다 (#57)", (await page.locator('.ss-b[data-kind="why"]').count()) > 0);

    /* #46 아카이브 + #50: 만드는 길도 없고 오른쪽 유형 라벨 표시도 뺐다 (데이터·동작은 그대로) */
    check("에디터: 유형 드롭다운이 없다 (#46)", (await page.locator(".ss-annopick").count()) === 0);
    check("에디터: 오른쪽 유형 라벨도 보이지 않는다 (#50)", (await page.locator(".ss-tag").count()) === 0);

    /* #58 — 끄고 켜는 상태가 없다. 대신 손잡이가 «흐름 배치» 라 화면을 가리지 않는 것이 전제다 */
    await page.waitForTimeout(200);
    check("에디터: 손잡이가 고정(fixed) 요소를 만들지 않는다", await page.evaluate(() =>
      [...document.querySelectorAll(".ss-gut")].every((g) => getComputedStyle(g).position === "absolute")));

    /* 하위 호환 — subs 가 문자열뿐인 옛 문서 */
    await page.goto("about:blank");
    await page.setContent('<div id="a" data-spec="1">본문</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-B',name:'b'}," +
      "specs:[{n:1,target:'1',title:'영역',defs:[{t:'줄',subs:['가','나']}]}]};<" + "/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    check("에디터: 문자열 subs 만 쓰는 옛 문서가 한 단 들어간 블록으로 펴진다 (#55)",
      (await page.locator(".ss-b.ss-in1").count()) === 2 && (await page.locator(".ss-b.ss-in2").count()) === 0);
  }

  /* ============ 블록 에디터 + 패널 폭 (#52·#53) ============
     PM: 「편집 누르면 노션처럼 빈칸 쭉 나오고 플러스 버튼 있고 드래그할 수 있는 점 6개 보이고.
     편집모드 들어간다고 밑에 쉐이드 있고 이런 거 싫어. 지금은 점 6개가 맨 아래에 나와서 말이 안 돼.」 */
  if (sec("[blk] 블록 에디터 · 패널 폭")) {
    const BLK_HTML = '<div id="a" data-spec="1">가</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-B',name:'블록'}," +
      "specs:[{n:1,target:'1',title:'영역',defs:[{t:'첫 줄'},{t:'둘째 줄'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(BLK_HTML);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.waitForTimeout(250);

    check("블록: 거터가 블록마다 있다", (await page.locator(".ss-gut").count()) >= 3,
      await page.locator(".ss-gut").count());
    check("블록: 거터에 ＋ 와 ⠿ 가 함께", await page.evaluate(() => {
      const g = document.querySelector(".ss-gut");
      return !!g.querySelector("[data-add]") && !!g.querySelector("[data-g]");
    }));
    check("블록: 손잡이가 블록 «앞» 에 온다 (맨 아래가 아니라)", await page.evaluate(() =>
      document.querySelector(".ss-row").firstElementChild.classList.contains("ss-gut")));
    check("블록: 편집 음영이 없다", await page.evaluate(() => {
      const bg = getComputedStyle(document.querySelector('[data-ed="b"]')).backgroundColor;
      return bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
    }));
    /* 거터는 마우스를 올려야 보인다(opacity 0 → 1). 클릭 판정에 걸리므로 이벤트로 직접 누른다 */
    await page.evaluate(() => document.querySelector(".ss-b .ss-gut [data-add]")
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })));
    await page.waitForTimeout(400);
    check("블록: ＋ 가 슬래시와 같은 메뉴를 연다",
      (await page.locator('.ss-slash [data-sl="num"], .ss-slash [data-sl="bul"], .ss-slash [data-sl="why"]').count()) === 3,
      await page.locator(".ss-slash [data-sl]").allTextContents());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    /* 폭 조절 (#53) — 저장은 localStorage 라 file:/about:blank 이 아닌 곳에서 봐야 한다 */
    check("폭: 손잡이가 있고 기본은 화면의 절반 (PM 2026-08-29)", await page.evaluate(() =>
      !!document.querySelector(".ss-defs-resize") &&
      Math.abs(document.querySelector(".ss-defs").getBoundingClientRect().width - window.innerWidth / 2) <= 2),
      await page.evaluate(() => [document.querySelector(".ss-defs").getBoundingClientRect().width, window.innerWidth]));
    /* 마커가 대상 왼쪽 위 모서리에 «붙어 있는가» — 폭이 바뀌면 대상 크기 자체가 달라지므로
       px 간격을 그대로 비교하면 안 된다. 붙어 있다는 것은 모서리에서 마커 한 개 거리 안이라는 뜻이다 */
    const stuck = () => page.evaluate(() => {
      const m = document.querySelector(".ss-marker").getBoundingClientRect();
      const t = document.querySelector('[data-spec="1"]').getBoundingClientRect();
      return Math.hypot(m.left + m.width / 2 - t.left, m.top + m.height / 2 - t.top) <= m.width;
    });
    check("폭: 마커가 대상 모서리에 붙어 있다 (바꾸기 전)", await stuck());
    const rz = await page.locator(".ss-defs-resize").boundingBox();
    await page.mouse.move(rz.x + 3, rz.y + 60);
    await page.mouse.down();
    await page.mouse.move(rz.x - 120, rz.y + 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    check("폭: 끌면 넓어진다", await page.evaluate(() =>
      document.querySelector(".ss-defs").getBoundingClientRect().width > 540));
    /* 폭이 이미 바뀌었으니 손잡이 위치를 «다시» 잰다 — 옛 좌표로 끌면 엉뚱한 곳을 잡는다 */
    const rz2 = await page.locator(".ss-defs-resize").boundingBox();
    await page.mouse.move(rz2.x + 3, rz2.y + 60);
    await page.mouse.down();
    await page.mouse.move(rz2.x - 900, rz2.y + 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    /* 상한은 화면의 90% — 프로토타입이 완전히 사라지지는 않게 (PM 2026-08-29) */
    check("폭: 상한은 화면의 90%", await page.evaluate(() =>
      Math.abs(document.querySelector(".ss-defs").getBoundingClientRect().width - window.innerWidth * 0.9) <= 2),
      await page.evaluate(() => [document.querySelector(".ss-defs").getBoundingClientRect().width, window.innerWidth]));
    check("폭: 90% 로 밀어도 마커가 대상 모서리에 붙어 있다", await stuck(), await page.evaluate(() => {
      const m = document.querySelector(".ss-marker").getBoundingClientRect();
      const t = document.querySelector('[data-spec="1"]').getBoundingClientRect();
      return [Math.round(m.left - t.left), Math.round(m.top - t.top), Math.round(t.width)];
    }));
  }

  /* ============ 잡아서 옮기기 (#49) ============
     ↑↓ 버튼을 없앴다. 순서는 손잡이를 잡아 옮긴다. 지우기는 «지금 고치는 칸» 에만 나온다.
     HTML5 드래그는 마우스 조작으로는 안 뜨므로 이벤트를 직접 만들어 보낸다. */
  if (sec("[dnd] 손잡이 · 잡아서 옮기기")) {
    const DND_HTML = '<div id="a" data-spec="1">가</div><div id="b" data-spec="2">나</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-D',name:'드래그'},specs:[" +
      "{n:1,target:'1',title:'첫 항목',defs:[{t:'A'},{t:'B'},{t:'C'}]}," +
      "{n:2,target:'2',title:'둘째 항목',defs:[{t:'X'}]}]};<" + "/script>";
    /* dx = 잡은 곳에서 오른쪽으로 민 픽셀 = 몇 단 더 들어가느냐. 글머리칸 16px 이 한 단.
       깊이는 커서의 «절대 위치» 가 아니라 «잡은 곳에서의 이동» 으로 정해진다 — 손잡이가 글 왼쪽
       거터에 있어서, 절대 위치로 재면 그냥 아래로만 끌어도 0단으로 떨어진다 (PM 2026-08-30) */
    const dragTo = (fromSel, toSel, after, dx) => page.evaluate(([f, t, af, x]) => {
      const src = document.querySelector(f), dst = document.querySelector(t);
      if (!src || !dst) return "대상 없음";
      const dt = new DataTransfer();
      const sr = src.getBoundingClientRect();
      const x0 = sr.left + sr.width / 2; /* 실제로 잡는 자리 */
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: x0 }));
      const r = dst.getBoundingClientRect();
      const y = af ? r.bottom - 2 : r.top + 2;
      const cx = x0 + (x || 0); /* 잡은 곳에서 x 만큼 옆으로 */
      dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientY: y, clientX: cx }));
      dst.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt, clientY: y, clientX: cx }));
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      return "ok";
    }, [fromSel, toSel, after, dx]);
    const defsOf = (n) => page.evaluate((i) =>
      (function w(l,d){return (l||[]).reduce(function(o,b){return o.concat([d+b.t], w(b.c,d+1));},[]);})(window.SCREENSPEC.specs[i].defs, 0).join(","), n);
    /* 위계 시험은 «앞 시험의 결과» 에 얹히면 못 읽는다 — 매번 새 문서로 시작한다.
       («0A,1a1» = 0단 A · 1단 a1) */
    const setDefs = async (a, b) => {
      const mk = (t) => "[" + t.split(",").filter(Boolean).map((x) => Number(x[0])
        ? "{t:'" + x.slice(1) + "',indent:" + Number(x[0]) + "}" : "{t:'" + x.slice(1) + "'}").join(",") + "]";
      await page.goto("about:blank");
      await page.setContent('<div id="a" data-spec="1">가</div><div id="b" data-spec="2">나</div>' +
        "<script>window.SCREENSPEC={screen:{id:'S-D',name:'드래그'},specs:[" +
        "{n:1,target:'1',title:'첫 항목',defs:" + mk(a) + "}," +
        "{n:2,target:'2',title:'둘째 항목',defs:" + mk(b) + "}]};<" + "/script>");
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(400);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(300);
    };

    await page.goto("about:blank");
    await page.setContent(DND_HTML);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.waitForTimeout(250);

    check("옮기기: ↑↓ 버튼이 없다", (await page.locator('[data-ec="up"],[data-ec="down"]').count()) === 0);
    check("옮기기: 뜻 모를 ⋮ 가 없다", !(await page.locator(".ss-defs-list").textContent()).includes("⋮"));
    check("옮기기: 손잡이가 있다", (await page.locator(".ss-g-grip").count()) > 0);
    check("옮기기: 줄마다 붙는 지우기 버튼이 없다", (await page.locator(".ss-wipe").count()) === 0);
    /* 항목 삭제는 제목 줄 오른쪽으로 옮겼다 (PM: 「원래 그 상태값 쪽으로」) */
    check("옮기기: 항목 삭제가 제목 줄 오른쪽에 있다", await page.evaluate(() => {
      const d = document.querySelector('[data-defrow="1"] .ss-rowdel');
      return !!d && !!d.closest(".ss-title");
    }));

    await dragTo('[data-defrow="1"] .ss-b[data-di="0"] .ss-g-grip', '[data-defrow="1"] .ss-b[data-di="2"]', true);
    await page.waitForTimeout(300);
    check("옮기기: 줄을 잡아 옮기면 순서가 바뀐다",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].defs.map((d) => d.t).join(""))) === "BCA",
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs.map((d) => d.t)));

    /* ---- 위계 규칙 (PM 2026-08-29) ---- */
    /* 1) 가로로 밀면 «바로 앞 블록의 하위» 가 된다 */
    await setDefs("0A,0B,0C", "0X");
    await dragTo('[data-defrow="1"] .ss-b[data-di="2"] .ss-g-grip', '[data-defrow="1"] .ss-b[data-di="0"]', true, 30);
    check("위계: 오른쪽으로 밀어 놓으면 한 단 들어간다", (await defsOf(0)) === "0A,1C,0B", await defsOf(0));

    /* 2) 앞에 부모가 없으면 들여쓸 수 없다 — 허공에 뜬 하위를 만들지 않는다 */
    await setDefs("0A,0B,0C", "0X");
    await dragTo('[data-defrow="1"] .ss-b[data-di="2"] .ss-g-grip', '[data-defrow="1"] .ss-b[data-di="0"]', false, 300);
    check("위계: 맨 앞에는 아무리 밀어도 0단 (허공의 하위 X)", (await defsOf(0)) === "0C,0A,0B", await defsOf(0));

    /* 3) 한 번에 한 단까지만 — 두 단은 건너뛸 수 없다 */
    await setDefs("0A,0B,0C", "0X");
    await dragTo('[data-defrow="1"] .ss-b[data-di="2"] .ss-g-grip', '[data-defrow="1"] .ss-b[data-di="0"]', true, 300);
    check("위계: 한 번에 두 단은 못 들어간다", (await defsOf(0)) === "0A,1C,0B", await defsOf(0));

    /* 4) 부모를 끌면 딸린 하위가 통째로 따라온다 (노션과 같다) */
    await setDefs("0A,1a1,1a2,0B", "0X");
    await dragTo('[data-defrow="1"] .ss-b[data-di="0"] .ss-g-grip', '[data-defrow="2"] .ss-b[data-di="0"]', true, 0);
    check("위계: 부모를 끌면 하위도 같이 간다",
      (await defsOf(0)) === "0B" && (await defsOf(1)) === "0X,0A,1a1,1a2",
      [await defsOf(0), await defsOf(1)]);

    /* 6) 「놓으면 무엇이 바뀌나」가 선을 그릴지 정한다 (노션 영상 분석 2026-08-30)
       PM: 「지금은 그냥 모든 곳에서 다 뜨는 것 같고 그래서 버그가 발생하는 것으로 보여.」
       노션은 자기 자리 근처에서 선을 아예 안 띄운다. 뜨면 반드시 무언가 바뀐다. */
    await setDefs("0A,1B,0C,1D", "0X");
    /* dx = 잡은 곳에서 옆으로 민 «칸수». 0 이면 원래 깊이 그대로다 */
    const hint = (di, half, dx) => page.evaluate(([i, h, v]) => {
      const src = document.querySelector('.ss-b[data-di="1"] .ss-g-grip');
      const dt = new DataTransfer();
      const sr = src.getBoundingClientRect();
      const step = 16, x0 = sr.left + sr.width / 2;
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: x0 }));
      const el = document.querySelector('.ss-b[data-di="' + i + '"]');
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt,
        clientY: h === "top" ? r.top + 2 : r.bottom - 2, clientX: x0 + v * step }));
      const line = document.querySelector(".ss-drop-line");
      const par = document.querySelector(".ss-drop-in");
      const parText = par ? (() => {
        const i = par.dataset.parent;
        const el = document.querySelector('.ss-b[data-di="' + i + '"] .ss-dt');
        return el ? el.textContent.trim() : null;
      })() : null;
      const out = { 선: !!line, 깊이: line ? Number(line.dataset.ind) : null, 부모: parText };
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      return out;
    }, [di, half, dx]);

    check("드롭선: 놓아도 그대로인 자리엔 안 그린다 (제자리 위)", (await hint(1, "top", 1)).선 === false, await hint(1, "top", 1));
    check("드롭선: 놓아도 그대로인 자리엔 안 그린다 (제자리 아래)", (await hint(1, "bottom", 1)).선 === false, await hint(1, "bottom", 1));
    check("드롭선: 앞 블록 아래 같은 깊이도 제자리면 안 그린다", (await hint(0, "bottom", 1)).선 === false, await hint(0, "bottom", 1));
    check("드롭선: 자리는 같아도 깊이가 바뀌면 그린다", (await hint(1, "bottom", -1)).선 === true, await hint(1, "bottom", -1));
    check("드롭선: 맨 위로는 그린다", (await hint(0, "top", 0)).선 === true, await hint(0, "top", 0));
    const inC = await hint(2, "bottom", 0);
    check("드롭선: 하위로 들어가면 부모가 될 블록을 밝힌다", inC.선 === true && inC.부모 === "C" && inC.깊이 === 1, inC);
    /* 끄는 동안 «막힘 표시(🚫)» 가 어디에도 뜨지 않아야 한다 (PM QA 2026-08-30).
       한 곳이라도 dragover 를 안 받으면 그 위에서 브라우저가 🚫 를 띄우고, 그건 「고장」 처럼 읽힌다.
       노션은 끄는 내내 그 표시가 없다 — 놓을 수 없는 자리는 «아무 일도 안 일어나는 것» 으로 족하다 */
    check("드롭선: 끄는 동안 어디에도 «막힘» 표시가 안 뜬다", await page.evaluate(() => {
      const src = document.querySelector('[data-defrow="1"] .ss-b[data-di="0"] .ss-g-grip');
      const dt = new DataTransfer();
      const sx = src.getBoundingClientRect();
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: sx.left + sx.width / 2 }));
      const spots = [".ss-sheet", ".ss-defs-head", ".ss-toolbar", ".ss-defs-list", ".ss-badge"];
      const bad = [];
      spots.forEach((sel) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const r = el.getBoundingClientRect();
        /* dragenter 도 함께 본다 — 이것을 안 막으면 새 요소에 «들어가는 한 프레임» 동안
           🚫 가 떴다 사라진다. 블록 사이를 지날 때마다 깜빡이던 것이 그것이다 (2026-08-30) */
        ["dragenter", "dragover"].forEach((type) => {
          const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt,
            clientX: r.left + r.width / 2, clientY: r.top + Math.min(10, r.height / 2) });
          el.dispatchEvent(ev);
          if (!ev.defaultPrevented) bad.push(sel + "/" + type);
        });
      });
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      return bad.length === 0 ? true : bad;
    }));

    const sib = await hint(2, "bottom", -1);
    check("드롭선: 형제로 붙을 때는 부모를 안 밝힌다", sib.선 === true && sib.부모 === null && sib.깊이 === 0, sib);

    /* 5) 하위 하나만 남의 번호로 보낼 수도 있다 */
    await setDefs("0A,1a1,1a2", "0X");
    await dragTo('[data-defrow="1"] .ss-b[data-di="1"] .ss-g-grip', '[data-defrow="2"] .ss-b[data-di="0"]', true, 0);
    check("위계: 하위 하나만 남의 번호로 보낼 수 있다 (옆으로 안 밀면 깊이 그대로)",
      (await defsOf(0)) === "0A,1a2" && (await defsOf(1)) === "0X,1a1",
      [await defsOf(0), await defsOf(1)]);

    /* 4) 번호와 번호 사이에는 블록을 놓을 수 없다 — 되지도 않는 자리를 보여 주지 않는다 */
    const rowDrop = await page.evaluate(() => {
      const src = document.querySelector('[data-defrow="2"] .ss-b[data-di="0"] .ss-g-grip');
      const dst = document.querySelector('[data-defrow="1"]');
      const dt = new DataTransfer();
      const sx = src.getBoundingClientRect();
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: sx.left + sx.width / 2 }));
      const r = dst.getBoundingClientRect();
      dst.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientY: r.top + 2, clientX: r.left + 5 }));
      const drew = !!document.querySelector(".ss-drop-line");
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      return drew;
    });
    /* PM 2026-08-30: 「아주 특정한 위치 아니면 안 뜨게끔 되고 있어.」
       이제는 커서가 어디에 있든 «가장 가까운 넣을 자리» 로 붙는다. 번호와 번호 사이를 가리켜도
       그 근처의 진짜 자리가 잡힌다 — 아무 표시도 없는 «먹통» 구간을 만들지 않는다 */
    check("위계: 어디를 가리켜도 가장 가까운 자리가 잡힌다", rowDrop === true);

    await dragTo('[data-defrow="1"] > .ss-gut .ss-g-grip', '[data-defrow="2"]', true);
    await page.waitForTimeout(350);
    check("옮기기: 항목을 옮기면 번호를 1부터 다시 매긴다",
      (await page.evaluate(() => window.SCREENSPEC.specs.map((s) => s.n + ":" + s.title).join(","))) === "1:둘째 항목,2:첫 항목",
      await page.evaluate(() => window.SCREENSPEC.specs.map((s) => s.n + ":" + s.title)));
    check("옮기기: 마커 번호도 따라온다",
      (await page.evaluate(() => [...document.querySelectorAll(".ss-marker")].map((x) => x.textContent).join())) === "1,2");
  }

  /* ============ 인라인 서식 (#44) — 굵게와 링크, 딱 둘 ============
     저장 형식을 컨플루언스 XHTML 의 최소 부분집합(<strong>·<a href>)으로 못박았는지 본다.
     이게 지켜지면 컨플루언스로 내보낼 때 변환기가 아예 필요 없다. */
  if (sec("[rich] 굵게 · 링크")) {
    const RICH_HTML = '<div id="a" data-spec="1">본문</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-R',name:'서식'}," +
      "specs:[{n:1,target:'1',title:'영역',defs:[{t:'첫 줄 글자'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(RICH_HTML);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.waitForTimeout(200);

    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.waitForTimeout(150);
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.press(MOD + "+b");
    await page.waitForTimeout(150);
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(250);
    const t1 = await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t);
    check("서식: 굵게가 <strong> 으로 저장된다 (<b> 아님)",
      t1.indexOf("<strong>") >= 0 && t1.indexOf("<b>") < 0, t1);
    check("서식: 화면에도 굵게 그려진다",
      (await page.locator('[data-defrow="1"] .ss-kids strong').count()) >= 1);

    /* 허용 목록 밖 서식은 붙여넣어도 남지 않는다 (살균) */
    await page.evaluate(() => {
      const el = document.querySelector('[data-defrow="1"] .ss-dt[data-ed="b"]');
      el.click();
      el.innerHTML = '<i>기울임</i> <u>밑줄</u> <span style="color:red">빨강</span> 남는글자';
    });
    await page.click('[data-defrow="1"] .ss-t');
    await page.waitForTimeout(300);
    const t2 = await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t);
    check("서식: 기울임·밑줄·색은 글자만 남는다",
      !/<i|<u|<span/.test(t2) && t2.indexOf("남는글자") >= 0, t2);

    /* 링크를 «만드는 길» 은 없앴다 (PM 2026-08-29) — 단추도 Ctrl+K 도 없다.
       그래도 이미 있는 링크는 살아야 하고, 위험한 주소는 들어와도 죽어야 한다 */
    check("서식: 링크를 만드는 길이 없다", await page.evaluate(() =>
      !document.querySelector('.ss-edbar [data-fm="link"]')));
    await page.evaluate(() => {
      const el = document.querySelector('[data-defrow="1"] .ss-dt[data-ed="b"]');
      el.click();
      el.innerHTML = '<a href="https://example.com/문서">문서</a> 와 <a href="javascript:alert(1)">위험</a>';
    });
    await page.click('[data-defrow="1"] .ss-t');
    await page.waitForTimeout(300);
    const tL = await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t);
    check("서식: 이미 있는 <a href> 는 살아남는다", /<a href="https:\/\/example\.com/.test(tL), tL);
    check("서식: javascript: 주소는 글자만 남는다", tL.indexOf("javascript:") < 0, tL);

    /* 이게 이 기능의 계약이다 — 저장 전체에 두 태그 말고는 없다 */
    const tags = await page.evaluate(() => {
      const txt = window.ScreenSpec.serialize();
      return [...new Set((txt.match(/<\/?[a-zA-Z][^>\s"]*/g) || []).map((x) => x.replace("<", "").replace("/", "").toLowerCase()))];
    });
    check("서식: 저장 전체에 strong·a 외 태그가 없다",
      tags.every((t) => t === "strong" || t === "a"), tags);

    /* 따옴표가 편집할 때마다 한 겹씩 쌓이던 버그 (PM 2026-08-30 발견).
       원인은 «글자 이스케이프» 와 «HTML 살균» 을 한 함수가 겸한 것 — 이제 언제나 HTML 로 읽어서 다시 쓴다 */
    const QT = '마감(00:00:00) 시 타이머를 "오늘 딜 종료"로 교체';
    await page.click('[data-defrow="1"] .ss-dt[data-ed="b"]');
    await page.waitForTimeout(150);
    await page.keyboard.press(MOD + "+a");
    await page.keyboard.type(QT);
    await page.keyboard.press("Shift+Enter");
    await page.waitForTimeout(250);
    /* 들락거려도 한 겹씩 쌓이지 않아야 한다 */
    for (let i = 0; i < 3; i++) {
      await page.click('[data-defrow="1"] .ss-dt[data-ed="b"]');
      await page.waitForTimeout(120);
      await page.keyboard.press("Shift+Enter");
      await page.waitForTimeout(150);
    }
    check("서식: 따옴표가 편집을 거듭해도 늘어나지 않는다",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t)) === QT,
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t));
    check("서식: 화면에도 따옴표가 그대로 보인다",
      (await page.locator('[data-defrow="1"] .ss-kids .ss-b').first().textContent()).indexOf('"오늘 딜 종료"') >= 0);
  }

  /* ============ 번호 찍기 (#43) ============
     지금까지 번호는 프로토타입에 미리 심어 둔 data-spec 이 있어야만 붙었다. 이제 화면에서 고른다.
     여기서 확인하는 것: 후보 판정 · 방향키로 넓히기 · 확정 뒤 «프로토타입에 이름표가 남는가»(동작 불변). */
  if (sec("[pick] 번호를 화면에서 찍는다")) {
    const PICK_HTML =
      '<div id="a" data-spec="1">본문</div>' +
      '<div id="target" style="padding:14px;border:1px solid #ccc">' +
      '<div class="inner" style="padding:8px;background:#eee">안쪽 상자<span class="tiny" style="font-size:9px">작은글자</span></div></div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-P',name:'찍기'}," +
      "specs:[{n:1,target:'1',title:'영역',defs:[{t:'첫 줄'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(PICK_HTML);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(400);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.waitForTimeout(200);

    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    await page.click('.ss-slash [data-sl="num"]');
    await page.waitForTimeout(300);
    check("찍기: 슬래시 「번호」 로 찍기 모드에 들어간다",
      await page.evaluate(() => document.body.classList.contains("ss-picking")));

    await page.hover(".tiny");
    await page.waitForTimeout(250);
    const tip1 = await page.locator(".ss-pick-tip").textContent();
    check("찍기: 작은 글자에 올려도 잡을 만한 것으로 넓혀 잡는다 (이름표에 크기)", /\d+×\d+/.test(tip1), tip1);

    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);
    const tip2 = await page.locator(".ss-pick-tip").textContent();
    check("찍기: ↑ 로 부모까지 넓어진다", tip2 !== tip1, { tip1: tip1, tip2: tip2 });

    await page.hover("#target");
    await page.waitForTimeout(150);
    await page.click("#target", { force: true });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      picking: document.body.classList.contains("ss-picking"),
      specs: window.SCREENSPEC.specs.length,
      stamped: [...document.querySelectorAll("[data-spec]")].map((e) => e.getAttribute("data-spec")),
      markers: document.querySelectorAll(".ss-marker").length,
    }));
    check("찍기: 클릭하면 모드가 끝난다", after.picking === false);
    check("찍기: 항목이 하나 늘어난다", after.specs === 2, after);
    check("찍기: 프로토타입에 이름표(data-spec)가 남는다 — 동작 불변(D7)", after.stamped.length === 2, after.stamped);
    check("찍기: 마커가 그 자리에 그려진다", after.markers === 2);
    check("찍기: 저장 텍스트에도 새 항목이 실린다", await page.evaluate(() => {
      const w = {};
      new Function("window", window.ScreenSpec.serialize())(w);
      return w.SCREENSPEC.specs.length === 2;
    }));

    /* 이미 번호가 있는 곳을 다시 찍으면 새로 만들지 않는다 */
    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    await page.click('.ss-slash [data-sl="num"]');
    await page.waitForTimeout(250);
    await page.hover("#a");
    await page.waitForTimeout(150);
    await page.click("#a", { force: true });
    await page.waitForTimeout(350);
    check("찍기: 이미 번호가 있는 곳은 새로 만들지 않는다",
      await page.evaluate(() => window.SCREENSPEC.specs.length === 2),
      await page.evaluate(() => window.SCREENSPEC.specs.map((s) => s.target)));

    /* Esc 로 취소하면 아무 일도 없다 */
    await page.click('.ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    await page.keyboard.press("/");
    await page.waitForTimeout(200);
    await page.click('.ss-slash [data-sl="num"]');
    await page.waitForTimeout(250);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    check("찍기: Esc 로 취소하면 모드만 끝나고 항목은 그대로",
      await page.evaluate(() => !document.body.classList.contains("ss-picking") && window.SCREENSPEC.specs.length === 2));
  }

  /* ============ 움직이는 요소 추적 (#8) ============
     캐러셀처럼 transform 으로 미끄러지는 요소 «안쪽» 에 마커를 달면, 예전엔 번호만 제자리에 남았다.
     재배치 계기가 창 크기·DOM 변경뿐이었기 때문이다. 이제 움직이는 동안 따라가고 멈추면 스스로 멎는다. */
  if (sec("[move] 움직이는 요소 안의 마커")) {
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



  /* ============ 처음 오는 사람 (FTUE) ============
     PM 2026-08-29: 「링크 클릭 → 프로토타입 → 숫자 켜는 법 인지 → 숫자 클릭 → 입력하는 법 인지」.
     여기가 막히면 이 도구는 시작조차 못 한다. 다섯 걸음을 실제로 걸어 본다. */
  if (sec("[ftue] 처음 오는 사람")) {
    const errs = [];
    const onErr = (e) => errs.push(String(e.message));
    page.on("pageerror", onErr);
    await page.goto("about:blank");
    /* data-spec 이 하나도 없는 «맨땅» 프로토타입 — 기획자가 코드를 못 여는 상황 그대로 */
    await page.setContent('<h1 id="t">쇼핑몰 홈</h1><button id="buy" style="margin:40px">구매하기</button>' +
      "<script>window.SCREENSPEC={screen:{id:'S-1',name:'홈'},specs:[]};<" + "/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);

    check("FTUE: 빈 화면이 «번호 찍기» 를 준다", await page.locator('[data-ftue="pick"]').isVisible());
    await page.click('[data-ftue="pick"]');
    await page.waitForTimeout(300);
    check("FTUE: 누르면 찍기 모드로 들어간다", await page.evaluate(() => document.body.classList.contains("ss-picking")));
    const bb = await page.locator("#buy").boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(250);
    check("FTUE: 겨눈 곳에 조준틀이 뜬다", (await page.locator(".ss-pick-box").count()) > 0);
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(450);
    check("FTUE: 코드를 안 고쳐도 번호가 붙는다", await page.evaluate(() =>
      window.SCREENSPEC.specs.length === 1 && document.querySelectorAll(".ss-marker").length === 1));
    /* 「새 영역」 이 진짜 글자로 박혀 있으면 타이핑이 그 뒤에 붙는다 (PM 2026-08-29) */
    check("FTUE: 이름 칸은 비어 있고 자리안내만 뜬다", await page.evaluate(() => {
      const el = document.querySelector('[data-ed="title"]');
      return el.textContent === "" && getComputedStyle(el, "::after").content.indexOf("영역 이름") >= 0;
    }));
    check("FTUE: 커서가 바로 이름 칸에 있다", await page.evaluate(() =>
      (document.activeElement || {}).dataset && document.activeElement.dataset.ed === "title"));
    await page.keyboard.type("구매 버튼");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    check("FTUE: 이름이 그대로 들어간다 (앞에 «새 영역» 이 안 붙는다)",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].title)) === "구매 버튼",
      await page.evaluate(() => window.SCREENSPEC.specs[0].title));
    check("FTUE: 이름에서 Enter — 빈 줄을 둘 만들지 않는다",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].defs.length)) === 1,
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs));

    /* 여기가 2026-08-29 에 PM 이 잡은 버그다 — 「바깥을 누르면 반영」 이 패널 목록 «안» 에서만 돌았다 */
    await page.keyboard.type("누르면 결제 화면으로");
    await page.click(".ss-defs-head h2");
    await page.waitForTimeout(400);
    check("FTUE: 패널 머리를 눌러도 쓴 글이 남는다",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].defs[0].t)) === "누르면 결제 화면으로",
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs));
    await page.click('[data-defrow="1"] .ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.type("- ");
    await page.keyboard.type("불릿 줄");
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForTimeout(400);
    check("FTUE: 프로토타입을 눌러도 쓴 글이 남는다",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].defs.map((d) => d.t).join("|"))) === "누르면 결제 화면으로|불릿 줄",
      await page.evaluate(() => window.SCREENSPEC.specs[0].defs));
    /* ---- 찍은 번호가 «저장하고 다시 열어도» 살아 있는가 ----
       저장은 설정 블록만 갈아끼우므로, 찍을 때 화면에 붙인 data-spec 속성은 파일에 남지 않는다.
       그래서 선택자(sel)를 같이 적어 두고, 다시 열 때 그것으로 찾아 속성을 되붙인다.
       이게 깨지면 FTUE 의 약속(코드 안 열고 번호 붙이기)이 새로고침 한 번에 무너진다 */
    check("FTUE: 찍은 번호에 되찾을 선택자가 적힌다", await page.evaluate(() => {
      const sp = window.SCREENSPEC.specs[0];
      if (!sp.sel) return false;
      const root = document.querySelector(".ss-sheet");
      return root.querySelector(sp.sel) === root.querySelector("#buy");
    }), await page.evaluate(() => window.SCREENSPEC.specs[0].sel));
    /* id 가 있으면 그것으로 — 프로토타입을 고쳐도 잘 안 흔들리는 길이다 */
    check("FTUE: id 가 있으면 id 로 적는다",
      (await page.evaluate(() => window.SCREENSPEC.specs[0].sel)) === '[id="buy"]',
      await page.evaluate(() => window.SCREENSPEC.specs[0].sel));

    const cfg = await page.evaluate(() => window.ScreenSpec.serialize());
    await page.goto("about:blank");
    /* 저장본을 다시 연 상황 — data-spec 속성이 «없는» 프로토타입 + 저장된 설정 */
    await page.setContent('<h1 id="t">쇼핑몰 홈</h1><button id="buy" style="margin:40px">구매하기</button>' +
      "<script>" + cfg + "<" + "/script>");
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);
    check("FTUE: 저장본을 다시 열어도 마커가 살아 있다", await page.evaluate(() =>
      document.querySelectorAll(".ss-marker").length === 1 &&
      !document.querySelector('[data-defrow="1"]').classList.contains("ss-now-hidden")));
    check("FTUE: 이름표(data-spec)가 저절로 되붙는다",
      await page.evaluate(() => document.querySelector("#buy").getAttribute("data-spec") === "1"));

    check("FTUE: 도중에 JS 에러 0건", errs.length === 0, errs);
    page.off("pageerror", onErr);
  }

  /* ============ 위계: Tab 과 드래그는 «같은 규칙» 이다 ============
     PM QA 2026-08-30: 「같은 위계 불릿과 그 밑에 들어가는 불릿이 될 때도 있고 안 될 때도 있다.」
     원인은 Tab 이 그 줄의 숫자만 1 올리고 있었던 것 — 잡아 끌 때의 규칙과 갈라져 있었다.
     규칙은 하나여야 한다: 바로 앞 블록보다 한 단까지 · 딸린 하위는 통째로 따라온다. */
  if (sec("[tier] 위계 — Tab 과 드래그가 같은 규칙")) {
    const mk = (t) => "[" + t.split(",").filter(Boolean).map((x) => Number(x[0])
      ? "{t:'" + x.slice(1) + "',indent:" + Number(x[0]) + "}" : "{t:'" + x.slice(1) + "'}").join(",") + "]";
    const setup = async (defs) => {
      await page.goto("about:blank");
      await page.setContent('<div id="a" data-spec="1">가</div>' +
        "<script>window.SCREENSPEC={screen:{id:'S-T',name:'위계'},specs:[{n:1,target:'1',title:'T',defs:" + mk(defs) + "}]};<" + "/script>");
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(400);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(300);
    };
    const now = () => page.evaluate(() =>
      (function w(l,d){return (l||[]).reduce(function(o,b){return o.concat([d+b.t], w(b.c,d+1));},[]);})(window.SCREENSPEC.specs[0].defs, 0).join(","));
    const tab = async (di, shift) => {
      await page.click('[data-defrow="1"] .ss-dt[data-ed="b"][data-di="' + di + '"]');
      await page.keyboard.press(shift ? "Shift+Tab" : "Tab");
      await page.waitForTimeout(250);
    };
    const said = () => page.locator(".ss-edmsg").textContent();

    await setup("0A,0B,0C");
    await tab(0);
    check("위계: 맨 앞 줄은 Tab 으로 들어갈 수 없다 (부모 없는 하위 X)",
      (await now()) === "0A,0B,0C" && (await said()).indexOf("앞에 붙일 줄이 없어") >= 0, [await now(), await said()]);

    await setup("0A,0B,0C");
    await tab(1);
    check("위계: Tab 은 앞 줄의 하위가 된다", (await now()) === "0A,1B,0C", await now());
    await tab(1);
    /* 트리에서 «들어간다» = 바로 앞 형제의 하위가 되는 것이다. 방금 들어간 줄은 그 안에서 맨 앞이라
       앞 형제가 없다 — 그래서 더 못 들어간다. 깊이를 «건너뛰는» 상태가 애초에 만들어지지 않는다 */
    check("위계: Tab 을 또 눌러도 두 단은 건너뛰지 않는다",
      (await now()) === "0A,1B,0C" && (await said()).indexOf("앞에 붙일 줄이 없어") >= 0, [await now(), await said()]);

    await setup("0A,1a1,1x,0B");
    await tab(2);
    check("위계: 앞이 1단이면 2단까지 들어간다", (await now()) === "0A,1a1,2x,0B", await now());

    await setup("0A,1a1,1a2,0B,0C");
    await tab(3);
    check("위계: Tab 은 딸린 하위를 두고 가지 않는다 (부모+자식 함께)",
      (await now()) === "0A,1a1,1a2,1B,0C", await now());

    await setup("0A,1a1,2a1a,0B");
    await tab(1, true);
    check("위계: Shift+Tab 도 손자까지 함께 나온다 (고아 X)",
      (await now()) === "0A,0a1,1a1a,0B", await now());

    /* 앞 줄이 허락해도 «딸린 하위» 가 3단이 되어 버리면 막는다 (최대 2단) */
    await setup("0A,1p,1c,2cc");
    await tab(2);
    check("위계: 하위가 너무 깊어지는 Tab 은 막는다",
      (await now()) === "0A,1p,1c,2cc" && (await said()).indexOf("깊어") >= 0, [await now(), await said()]);

    /* 글머리 세로 위치 — 글자의 잉크 중심에 맞춘다 (PM QA 2026-08-30: 「살짝 위에 있는 것 같아」) */
    await setup("0A,1a1");
    check("위계: 글머리가 줄 상자가 아니라 «글자» 에 맞춰 내려와 있다", await page.evaluate(() => {
      const d = document.querySelector(".ss-b-dot");
      const t = getComputedStyle(d).transform;
      if (t === "none") return false;
      const m = t.match(/matrix\(([^)]+)\)/);
      return m ? parseFloat(m[1].split(",")[5]) > 0 : false;
    }), await page.evaluate(() => getComputedStyle(document.querySelector(".ss-b-dot")).transform));
  }

  /* ============ 위계 전수 검증 ============
     PM 2026-08-30: 「노션 로직을 먼저 상세히 정리하고, 그대로 재현되는지 하나하나 체크하는 게 맞지 않나.」

     그래서 규칙을 «참조 구현» 으로 적어 두고, 자리 × 위아래 × 깊이를 전부 돌려 실제와 대조한다.
     눈으로 몇 번 끌어 보는 것과 다르다 — 200건 중 하나만 어긋나도 여기서 걸린다.

     규칙 (노션 영상 분석 + PM 확인):
       1) 넣을 자리   : 눈에 보이는 «줄과 줄 사이» 하나. 커서에서 가장 가까운 경계로 붙는다
       2) 깊이       : 원래 깊이 + «잡은 곳에서 옆으로 간 칸수». 아래로만 끌면 같은 단이다
       2-1) 깊이 상한 : 넣을 자리 «바로 앞» 블록보다 한 단까지 (최대 2단). 앞이 없으면 0단
       3) 끌고 있는 덩어리는 «이미 빠진 셈» 으로 본다 — 자기를 앞 블록으로 세면 자기가 자기 하위가 된다
       4) 안 그린다   : 자기 하위 안 · 놓아도 자리와 깊이가 그대로일 때
       5) 부모 표시   : 깊이 1 이상이면 «누구의 하위가 되는지» 를 통째로 밝힌다
       6) 옮길 때     : 딸린 하위가 통째로 따라오고, 깊이 차이를 그대로 유지한다 */
  /* 매 빌드마다 돌릴 필요는 없다 (PM 2026-08-30) — 200번 넘게 페이지를 다시 띄우므로 느리다.
     규칙을 손댈 때만 켠다:  node tests/e2e.js --grid   (또는 SS_GRID=1) */
  const GRID = process.argv.includes("--grid") || process.env.SS_GRID === "1";
  /* 이름은 언제나 등록한다 — --list 가 «있는 섹션» 을 다 보여야 문서의 숫자와 맞는다 (2026-09-01) */
  if (sec("[grid] 위계 전수 검증") && GRID) {
    const ind = (l, i) => (l[i] ? (l[i].d | 0) : 0);
    const sub = (l, i) => { let n = 1; while (i + n < l.length && ind(l, i + n) > ind(l, i)) n++; return n; };
    /* 참조 구현 — «맞다» 고 정한 규칙을 그대로 적은 것 */
    const ref = (l, from, di, half, dx) => {
      const n = sub(l, from);
      const at = half === "bottom" ? di + 1 : di;
      if (at > from && at < from + n) return { show: false };
      let p = at - 1;
      while (p >= from && p < from + n) p--;
      const cap = p >= 0 ? Math.min(2, ind(l, p) + 1) : 0;
      const want = Math.max(0, Math.min(cap, ind(l, from) + dx)); /* 원래 깊이 + 옆으로 간 칸수 */
      const at2 = at > from ? at - n : at;
      if (at2 === from && want === ind(l, from)) return { show: false };
      let par = -1;
      if (want > 0) for (let i = at - 1; i >= 0; i--) {
        if (i >= from && i < from + n) continue;
        if (ind(l, i) === want - 1) { par = i; break; }
      }
      const cut = l.slice(from, from + n).map((b) => ({ t: b.t, d: b.d | 0 }));
      const rest = l.slice(0, from).concat(l.slice(from + n));
      const shift = want - cut[0].d;
      cut.forEach((b) => { b.d = Math.max(0, Math.min(2, b.d + shift)); });
      return { show: true, ind: want, par: par,
        after: rest.slice(0, at2).concat(cut, rest.slice(at2)).map((b) => b.d + b.t).join(",") };
    };
    const FIX = [
      { l: [{ t: "A", d: 0 }, { t: "B", d: 1 }, { t: "C", d: 0 }, { t: "D", d: 1 }], from: 1 },
      { l: [{ t: "A", d: 0 }, { t: "P", d: 1 }, { t: "Q", d: 1 }, { t: "B", d: 0 }], from: 0 },
      { l: [{ t: "A", d: 0 }, { t: "B", d: 0 }, { t: "C", d: 0 }], from: 1 },
      { l: [{ t: "A", d: 0 }, { t: "P", d: 1 }, { t: "X", d: 2 }, { t: "B", d: 0 }], from: 1 },
      { l: [{ t: "A", d: 0 }, { t: "P", d: 1 }, { t: "X", d: 2 }, { t: "B", d: 0 }], from: 2 },
      { l: [{ t: "A", d: 0 }, { t: "B", d: 0 }, { t: "P", d: 1 }, { t: "Q", d: 1 }], from: 0 },
      { l: [{ t: "A", d: 0 }, { t: "P", d: 1 }, { t: "B", d: 0 }, { t: "Q", d: 1 }], from: 3 },
      { l: [{ t: "A", d: 0 }, { t: "P", d: 1 }, { t: "Q", d: 2 }, { t: "R", d: 1 }, { t: "B", d: 0 }], from: 1 },
      { l: [{ t: "A", d: 0 }, { t: "B", d: 0 }], from: 0 },
    ];
    let cases = 0;
    const bad = [];
    for (const fx of FIX) {
      const defs = "[" + fx.l.map((x) => x.d ? "{t:'" + x.t + "',indent:" + x.d + "}" : "{t:'" + x.t + "'}").join(",") + "]";
      const same = fx.l.map((x) => x.d + x.t).join(",");
      /* 판마다 한 번만 띄운다 — 드롭이 상태를 바꿨으면 Ctrl+Z 로 되돌린다 (검수 2026-08-30).
         케이스마다 페이지를 다시 띄우면 272회 × 0.5초의 «기다림» 이 전부다 */
      await page.goto("about:blank");
      await page.setContent('<div id="a" data-spec="1">가</div>' +
        "<script>window.SCREENSPEC={screen:{id:'S-G',name:'g'},specs:[{n:1,target:'1',title:'T',defs:" + defs + "}]};<" + "/script>");
      await page.addScriptTag({ content: LIB });
      await page.waitForTimeout(300);
      await page.click("#ss-mDoc");
      await page.waitForTimeout(200);
      for (let di = 0; di < fx.l.length; di++) {
        for (const half of ["top", "bottom"]) {
          for (const dx of [-1, 0, 1, 2]) {
            const got = await page.evaluate(([f, i, h, v]) => {
              const src = document.querySelector('.ss-b[data-di="' + f + '"] .ss-g-grip');
              const dt = new DataTransfer();
              const sr = src.getBoundingClientRect();
              const step = 16, x0 = sr.left + sr.width / 2; /* 실제로 잡는 자리 */
              src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: x0 }));
              const el = document.querySelector('.ss-b[data-di="' + i + '"]');
              const r = el.getBoundingClientRect();
              const y = h === "top" ? r.top + 2 : r.bottom - 2, x = x0 + v * step;
              el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientY: y, clientX: x }));
              const line = document.querySelector(".ss-drop-line"), par = document.querySelector(".ss-drop-in");
              const pt = par ? (document.querySelector('.ss-b[data-di="' + par.dataset.parent + '"] .ss-dt') || {}).textContent : null;
              const o = { show: !!line, ind: line ? Number(line.dataset.ind) : null,
                par: pt ? pt.trim() : null };
              el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt, clientY: y, clientX: x }));
              src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
              return o;
            }, [fx.from, di, half, dx]);
            let after = await page.evaluate(() =>
              (function w(l,d){return (l||[]).reduce(function(o,b){return o.concat([d+b.t], w(b.c,d+1));},[]);})(window.SCREENSPEC.specs[0].defs, 0).join(","));
            const w = ref(fx.l, fx.from, di, half, dx);
            const wantAfter = w.show ? w.after : same;
            const wantPar = w.show && w.par >= 0 ? fx.l[w.par].t : null;
            cases++;
            if (!(got.show === w.show && (!w.show || (got.ind === w.ind && got.par === wantPar)) && after === wantAfter)) {
              bad.push("[" + same + "] " + fx.l[fx.from].t + " → di" + di + "/" + half + "/dx" + dx +
                " 기대 " + (w.show ? "선d" + w.ind + (wantPar ? "⊂" + wantPar : "") : "선없음") + "→" + wantAfter +
                " · 실제 " + (got.show ? "선d" + got.ind + (got.par ? "⊂" + got.par : "") : "선없음") + "→" + after);
            }
            /* 상태가 바뀌었으면 되돌려서 다음 케이스가 같은 판에서 시작하게 한다 */
            if (after !== same) {
              await page.keyboard.press(MOD + "+z");
              await page.waitForTimeout(60);
              const back = await page.evaluate(() =>
                (function w(l,d){return (l||[]).reduce(function(o,b){return o.concat([d+b.t], w(b.c,d+1));},[]);})(window.SCREENSPEC.specs[0].defs, 0).join(","));
              if (back !== same) { bad.push("[" + same + "] 되돌리기 실패: " + back); break; }
            }
          }
        }
      }
    }
    check("위계 전수: " + cases + "가지 자리에서 규칙과 실제가 같다", bad.length === 0, bad.slice(0, 6));
  } else if (!ONLY && !LIST) console.log("[grid] 위계 전수 검증 — 건너뜀 (규칙을 손댔으면 --grid 로 돌린다)");

  /* ============ 자동저장 ============
     PM 2026-08-29: 「번호 넣고 입력하면 구글 시트 자동저장되듯이 로컬에 계속 저장되면서 가면
     그게 프로토타입 파일에 반영되고 그걸 또 클로드가 픽스하고 핑퐁이 되지 않을까.」
     브라우저 파일 고르기는 사람 손이 필요하므로 «가짜 손잡이» 로 그 자리를 대신한다. */
  if (sec("[auto] 자동저장")) {
    const errs = [];
    const onErr = (e) => errs.push(String(e.message));
    page.on("pageerror", onErr);
    const PROTO = '<h1 id="t">홈</h1><button id="buy" data-spec="1" style="margin:40px">구매하기</button>' +
      "<script>window.SCREENSPEC={screen:{id:'S-1',name:'홈'},specs:[{n:1,target:'1',title:'구매',defs:[{t:'첫 줄'}]}]};<" + "/script>";
    await page.goto("about:blank");
    await page.setContent(PROTO);
    await page.evaluate((src) => {
      window.__file = "<html><body>" + src + "</body></html>";
      window.__writes = 0;
      window.__mt = 1000;
      window.showOpenFilePicker = async () => [{
        name: "proto.html",
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        getFile: async () => ({ text: async () => window.__file, lastModified: window.__mt }),
        createWritable: async () => ({
          write: async (t) => { window.__file = t; window.__mt += 10; window.__writes++; },
          close: async () => {},
        }),
      }];
    }, PROTO);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(400);

    const st = () => page.locator(".ss-savest").textContent();
    const writes = () => page.evaluate(() => window.__writes);
    check("자동저장: 처음에는 꺼져 있다고 «오른쪽 위» 에 말한다", (await st()) === "자동저장 꺼짐" &&
      (await page.locator(".ss-svbtn").textContent()) === "자동저장 켜기", await st());
    await page.click(".ss-svbtn");
    await page.waitForTimeout(500);
    check("자동저장: 파일을 한 번 고르면 켜진다", (await st()).indexOf("저장됨") === 0 &&
      (await page.locator(".ss-svbtn").textContent()) === "저장" && (await writes()) === 1, await st());

    await page.click('[data-defrow="1"] .ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.press("End");
    await page.keyboard.type(" 추가한 글");
    await page.waitForTimeout(250);
    check("자동저장: 치는 동안 «저장 대기» 로 보인다", (await st()) === "저장 대기", await st());
    await page.waitForTimeout(1500);
    check("자동저장: 손이 멈추면 저장된다", (await st()).indexOf("저장됨") === 0 && (await writes()) === 2, [await st(), await writes()]);
    /* 이게 핵심이다 — 저장하려고 편집을 끊으면 커서가 튄다 */
    check("자동저장: 커서를 뺏지 않는다 (치던 자리 그대로)", await page.evaluate(() =>
      document.activeElement && document.activeElement.dataset.ed === "b"));
    check("자동저장: 파일 안 설정이 실제로 바뀐다", await page.evaluate(() =>
      window.__file.indexOf("첫 줄 추가한 글") >= 0));

    await page.keyboard.press("Enter");
    await page.keyboard.type("둘째 줄");
    await page.waitForTimeout(1600);
    check("자동저장: 새 줄도 파일까지 간다", await page.evaluate(() => window.__file.indexOf("둘째 줄") >= 0));
    check("자동저장: 저장한 파일을 다시 읽으면 같은 설정이다", await page.evaluate(() => {
      const m = window.__file.match(/window\.SCREENSPEC\s*=\s*[\s\S]*?;\n/);
      if (!m) return false;
      const w = {};
      new Function("window", m[0])(w);
      return JSON.stringify(w.SCREENSPEC.specs[0].defs.map((d) => d.t)) ===
        JSON.stringify(window.SCREENSPEC.specs[0].defs.map((d) => d.t));
    }));
    /* 저장 단추는 «누를 일이 있을 때만» 눌린다 (PM 2026-08-30) */
    check("자동저장: 저장할 게 없으면 저장 단추가 꺼진다",
      (await page.locator(".ss-svbtn").isDisabled()) === true &&
      (await page.locator(".ss-svbtn").textContent()) === "저장");

    /* ---- 밖에서 바뀐 파일 ----
       PM 이 에이전트에게 프로토타입을 고치라고 하면 파일은 바뀌는데 브라우저는 모른다.
       모르는 채로 자동저장이 돌면 그 변경을 덮어쓴다 — 그래서 알아채고 «멈춰야» 한다 */
    check("파일감시: 바뀌기 전에는 띠가 없다",
      (await page.locator(".ss-outside").evaluate((e) => getComputedStyle(e).display)) === "none");
    /* ① 정의서도 밖에서 바뀌었다 = 진짜 충돌. 이때만 «어느 쪽을 버릴지» 를 묻는다 (#83) */
    await page.click('[data-defrow="1"] .ss-dt[data-ed="b"][data-di="0"]'); /* 미저장을 만든다 */
    await page.keyboard.type("X");
    await page.evaluate(() => {
      window.__file = window.__file.replace("홈", "홈 화면").replace("첫 줄", "밖에서 고친 줄");
      window.__mt += 99999;
    });
    await page.waitForTimeout(3600);
    check("파일감시: 정의서도 바뀌면 띠가 뜬다", await page.evaluate(() =>
      getComputedStyle(document.querySelector(".ss-outside")).display === "flex"));
    check("파일감시: 무엇이 바뀌었는지 말한다 (기능 설명도) (#83)",
      (await page.locator(".ss-out-what").textContent()) === "기능 설명도 밖에서 바뀌었습니다",
      await page.locator(".ss-out-what").textContent());
    check("파일감시: 단추가 «무엇을 버리는지» 를 말한다 (#83)",
      (await page.locator('.ss-outside [data-oc="reload"]').textContent()).indexOf("내 미저장 버림") >= 0 &&
      (await page.locator('.ss-outside [data-oc="keep"]').isVisible()) === true);
    check("파일감시: 그동안 상태는 «저장 멈춤»", (await page.locator(".ss-savest").textContent()) === "저장 멈춤",
      await page.locator(".ss-savest").textContent());
    const w0 = await writes();
    await page.keyboard.type("Y");
    await page.waitForTimeout(1800);
    check("파일감시: 멈춘 동안에는 파일에 쓰지 않는다 (남의 변경을 안 덮는다)", (await writes()) === w0, [w0, await writes()]);
    check("파일감시: 멈춘 동안 고치면 그 사실을 말한다 (#83)",
      (await page.locator(".ss-out-stuck").textContent()).indexOf("파일에 안 갑니다") >= 0,
      await page.locator(".ss-out-stuck").textContent());
    await page.click('.ss-outside [data-oc="keep"]');
    await page.waitForTimeout(1600);
    check("파일감시: 「내 것으로」 를 고르면 띠가 닫히고 저장이 다시 돈다",
      (await page.locator(".ss-outside").evaluate((e) => getComputedStyle(e).display)) === "none" &&
      (await writes()) > w0, [await writes(), w0]);
    /* ② 프로토타입만 바뀌었고 내가 편집 중이면 — 묻되 «버릴 것이 없으니» 단추는 하나다 */
    await page.click('[data-defrow="1"] .ss-dt[data-ed="b"][data-di="0"]');
    await page.keyboard.type("Z");
    await page.evaluate(() => { window.__file = window.__file.replace("구매하기", "지금 구매"); window.__mt += 99999; });
    await page.waitForTimeout(3600);
    check("파일감시: 프로토타입만 바뀌면 그렇게 말한다 (#83)",
      (await page.locator(".ss-out-what").textContent()) === "프로토타입이 밖에서 바뀌었습니다" &&
      (await page.locator(".ss-out-why").textContent()).indexOf("내 정의는 그대로") >= 0,
      await page.locator(".ss-out-what").textContent());
    check("파일감시: 버릴 것이 없으면 «내 것으로» 단추를 안 준다 (#83)",
      (await page.locator('.ss-outside [data-oc="keep"]').isVisible()) === false);

    /* ③ 잃을 것이 없으면 안 묻는다 — 조용히 새로 읽는다 (#83).
       페이지를 다시 읽으므로 이 판이 끝난다. 그래서 이 섹션의 «맨 끝» 에 둔다 */
    await page.click('.ss-outside [data-oc="reload"]').catch(() => {});
    await page.waitForTimeout(300);
    await page.goto("about:blank");
    await page.setContent(PROTO);
    await page.evaluate((src) => {
      window.__file = "<html><body>" + src + "</body></html>";
      window.__writes = 0; window.__mt = 1000;
      window.showOpenFilePicker = async () => [{
        name: "proto.html", queryPermission: async () => "granted", requestPermission: async () => "granted",
        getFile: async () => ({ text: async () => window.__file, lastModified: window.__mt }),
        createWritable: async () => ({ write: async (t) => { window.__file = t; window.__mt += 10; window.__writes++; }, close: async () => {} }),
      }];
    }, PROTO);
    await page.addScriptTag({ content: LIB });
    await page.waitForTimeout(500);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(300);
    await page.click(".ss-svbtn");
    await page.waitForTimeout(600);
    check("조용히 반영: 전제 — 연결됐고 미저장이 없다 (#83)",
      (await page.locator(".ss-savest").textContent()).indexOf("저장됨") === 0,
      await page.locator(".ss-savest").textContent());
    await page.evaluate(() => { window.__file = window.__file.replace("구매하기", "밖에서 바꾼 글"); window.__mt += 99999; });
    await page.waitForTimeout(3800);
    check("조용히 반영: 프로토타입만 바뀌고 잃을 게 없으면 안 묻고 새로 읽는다 (#83)",
      await page.evaluate(() => !window.ScreenSpec));

    check("자동저장: 도중에 JS 에러 0건", errs.length === 0, errs);
    page.off("pageerror", onErr);
  }

  /* ============ 인라인 빌드: 바깥 요청이 막힌 환경 재현 ============
     클로드 아티팩트처럼 외부 주소를 막는 환경을 흉내 내, 자체 완결 파일이 정말 자립하는지 본다. */
  if (sec("[inline] 자체 완결 파일")) {
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
    check("인라인: 화면정의서 모드 정상", (await page.locator(".ss-defs-list .ss-row").count()) === 11);
    await page.unroute("**");
    fs.unlinkSync(out);
  }
  check("JS 에러 0건", errors.length === 0, errors.slice(0, 3));

  await browser.close();
  if (LIST) { console.log("섹션 " + SECS.length + "개:"); SECS.forEach((n) => console.log("  " + n)); return; }
  console.log("\n결과: PASS " + pass + " / FAIL " + fail +
    (ONLY ? "  ← 부분 실행 (--only " + ONLY + " · 섹션 " + SECS.filter((n) => n.indexOf(ONLY) >= 0).length +
      "/" + SECS.length + "). 전체는 CI 가 돈다" : ""));
  process.exit(fail ? 1 : 0);
})();
