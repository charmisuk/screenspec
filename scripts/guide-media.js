#!/usr/bin/env node
/*
 * guide-media.js — 3분 가이드(guide/)의 그림을 만든다.
 *
 *   node scripts/guide-media.js
 *
 * 사람이 화면을 녹화하는 대신 브라우저를 실제로 조작해 찍는다. 그래서 판이 바뀌면 다시 돌리면 된다.
 * 움직임은 .webm (브라우저가 그대로 재생한다 — 변환 도구가 필요 없다), 정지는 .jpg.
 *
 * 커서는 브라우저 녹화에 안 찍히므로 가짜 커서를 하나 심어 옮긴다. 클릭 순간에 잠깐 멈춘다.
 * 파일 고르기 창은 운영체제 것이라 자동으로 열 수 없다 — 4장은 정지 컷으로 대신한다.
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const REPO = path.resolve(__dirname, "..");
const OUT = path.join(REPO, "guide", "media");
const W = 1200, H = 800; /* 액자가 3 대 2 라 그 비율로 찍는다 */
const PORT = 4321;
const SHOP = "http://localhost:" + PORT + "/examples/shop.html";

/* 왜 file:// 이 아니라 http 인가 — 로컬 파일은 «파일을 연결하기 전에는 고쳐지지 않는다»(의도된 동작).
   주소로 연 문서는 쓸 파일이 애초에 없으므로 막지 않는다. 편집을 보여 주려면 이쪽이어야 한다 */
function serve() {
  const http = require("http");
  const srv = http.createServer((req, res) => {
    const rel = req.url.split("?")[0];
    const f = path.join(REPO, rel === "/" ? "/examples/shop.html" : rel);
    if (!f.startsWith(REPO) || !fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
    res.setHeader("content-type", f.endsWith(".js") ? "text/javascript" : "text/html");
    res.end(fs.readFileSync(f));
  });
  return new Promise((r) => srv.listen(PORT, () => r(srv)));
}
const fail = (m) => { console.error("✗ " + m); process.exitCode = 1; };
const markers = (page) => page.evaluate(() => document.querySelectorAll(".ss-marker").length);

const CURSOR = `
  (function () {
    var c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;" +
      "pointer-events:none;transition:transform .55s cubic-bezier(.4,0,.2,1);will-change:transform";
    c.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22">' +
      '<path d="M4 2 L4 17 L8.2 13.2 L11 19.5 L13.6 18.3 L10.9 12.2 L16.5 12Z" ' +
      'fill="#fff" stroke="#191919" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    window.__moveCur = function (x, y) { c.style.transform = "translate(" + x + "px," + y + "px)"; };
    window.__clickCur = function () {
      var r = document.createElement("div");
      r.style.cssText = c.style.cssText.replace("transition", "x-transition") +
        ";width:26px;height:26px;border-radius:50%;background:rgba(41,82,227,.35);transition:none";
      r.style.transform = c.style.transform;
      document.body.appendChild(r);
      setTimeout(function () { r.remove(); }, 320);
    };
  })();
`;

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch();

  /* 마우스를 «보이게» 옮기고 누른다 — 옮기는 데 0.55초, 누르고 0.5초 멈춘다 */
  const mk = (page) => ({
    async to(sel, dx, dy) {
      const b = await page.locator(sel).first().boundingBox();
      const x = Math.round(b.x + (dx == null ? b.width / 2 : dx));
      const y = Math.round(b.y + (dy == null ? b.height / 2 : dy));
      await page.evaluate(([a, c]) => window.__moveCur(a, c), [x, y]);
      await page.waitForTimeout(650);
      return { x, y };
    },
    async tap(sel, dx, dy) {
      await this.to(sel, dx, dy);
      await page.evaluate(() => window.__clickCur && window.__clickCur());
      await page.waitForTimeout(180);
      /* 좌표가 아니라 선택자로 누른다 — 패널이 움직이면 좌표는 빗나간다 */
      await page.locator(sel).first().click();
      await page.waitForTimeout(320);
    },
  });

  async function shot(name, fn) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(SHOP);
    await page.waitForTimeout(700);
    await fn(page, mk(page));
    await page.screenshot({ path: path.join(OUT, name + ".jpg"), quality: 82, type: "jpeg" });
    await ctx.close();
    console.log("정지  " + name + ".jpg");
  }

  async function clip(name, fn) {
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      recordVideo: { dir: OUT, size: { width: W, height: H } },
    });
    const page = await ctx.newPage();
    await page.goto(SHOP);
    await page.waitForTimeout(600);
    await page.evaluate(CURSOR);
    /* http 로 열었을 때만 뜨는 「파일에 못 씁니다」 띠를 가린다.
       가이드가 가르치는 흐름(로컬 파일 + 자동저장 연결, 4장)에서는 이 띠가 안 뜬다 —
       녹화를 위해 http 를 쓴 탓에 생긴 것이므로 감추는 쪽이 실제와 가깝다 */
    await page.addStyleTag({ content: ".ss-nofile,.ss-nofile-why{display:none!important}" });
    await page.evaluate(() => window.__moveCur(80, 700));
    await fn(page, mk(page));
    await page.waitForTimeout(600);
    /* 첫 프레임 대체용 그림도 같이 남긴다 — 영상을 못 트는 곳에서 이게 뜬다 */
    await page.screenshot({ path: path.join(OUT, name + ".jpg"), quality: 82, type: "jpeg" });
    const v = page.video();
    await ctx.close();
    const src = await v.path();
    fs.renameSync(src, path.join(OUT, name + ".webm"));
    const kb = Math.round(fs.statSync(path.join(OUT, name + ".webm")).size / 1024);
    console.log("움직임 " + name + ".webm  (" + kb + "KB)");
  }

  /* ---- 1장 표지 : 화면정의서 모드 전체 ---- */
  await shot("s1", async (page) => {
    await page.click("#ss-mDoc");
    await page.waitForTimeout(900);
  });

  /* ---- 2장 글자 고치기 : 설명 줄을 눌러 고치고 Enter 로 줄을 늘린다 ---- */
  await clip("s2", async (page, m) => {
    await m.tap("#ss-mDoc");
    await page.waitForTimeout(700);
    await m.tap('.ss-dt[data-ed="b"][data-di="0"]', 60, null);
    await page.waitForTimeout(400);
    await page.keyboard.press("End");
    await page.keyboard.type(" · 스크롤해도 고정", { delay: 85 });
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.keyboard.type("로그인 전에는 알림 아이콘 미노출", { delay: 70 });
    await page.waitForTimeout(800);
    const txt = await page.locator(".ss-defs-list").first().textContent();
    if (txt.indexOf("스크롤해도 고정") < 0) fail("s2: 고친 글자가 화면에 없다 — 편집이 안 걸렸다");
    if (txt.indexOf("알림 아이콘 미노출") < 0) fail("s2: 새 줄이 안 생겼다");
  });

  /* ---- 3장 번호 붙이기 : / 메뉴에서 「번호」를 고르고 화면에서 찍는다 ---- */
  await clip("s3", async (page, m) => {
    await m.tap("#ss-mDoc");
    await page.waitForTimeout(700);
    const n0 = await markers(page);
    await m.tap('.ss-dt[data-ed="b"][data-di="0"]', 60, null);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    await page.keyboard.press("/");
    await page.waitForTimeout(800);
    if (!(await page.locator(".ss-slash").count())) fail("s3: 슬래시 메뉴가 안 열렸다");
    await m.tap('.ss-slash [data-sl="num"]');
    await page.waitForTimeout(600);
    if (!(await page.evaluate(() => document.body.classList.contains("ss-picking")))) fail("s3: 찍기 모드가 아니다");
    const tile = page.locator(".ss-sheet").getByText("신발", { exact: true }).first();
    const bb = await tile.boundingBox();
    await page.evaluate(([x, y]) => window.__moveCur(x, y),
      [Math.round(bb.x + bb.width / 2), Math.round(bb.y + bb.height / 2)]);
    await page.waitForTimeout(800);
    await tile.hover({ force: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__clickCur());
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(1200);
    const n1 = await markers(page);
    if (n1 !== n0 + 1) fail("s3: 번호가 안 늘었다 (" + n0 + " → " + n1 + ")");
  });

  /* ---- 4장 자동 저장 : 파일 고르기 창은 운영체제 것이라 정지 컷으로 ---- */
  await shot("s4", async (page) => {
    await page.click("#ss-mDoc");
    await page.waitForTimeout(700);
    const marked = await page.evaluate(() => {
      /* 짚는 것은 하나다 — 넷을 다 두르면 어디를 누르라는 건지 알 수 없다 */
      const el = [].slice.call(document.querySelectorAll(".ss-toolbar .ss-headbtn"))
        .find((e) => e.textContent.indexOf("자동저장") >= 0);
      if (!el) return false;
      el.style.outline = "2px solid #2952E3";
      el.style.outlineOffset = "4px";
      el.style.borderRadius = "8px";
      return true;
    });
    if (!marked) fail("s4: 「자동저장 켜기」 단추를 못 찾았다");
    await page.waitForTimeout(300);
  });

  /* ---- 5장 전달본 : 자체 완결 파일을 뽑아 그대로 연다 ---- */
  const os = require("os");
  const inlineOut = path.join(os.tmpdir(), "ss-guide-inline.html");
  require("child_process").execFileSync(process.execPath,
    [path.join(REPO, "scripts/inline.js"), path.join(REPO, "examples/shop.html"), "-o", inlineOut], { stdio: "pipe" });
  {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    /* 바깥 요청을 통째로 막아도 열린다는 것이 이 장의 요지다 */
    await page.route("**", (r) => (/^https?:/i.test(r.request().url()) ? r.abort() : r.continue()));
    await page.goto(require("url").pathToFileURL(inlineOut).href);
    await page.waitForTimeout(900);
    await page.click("#ss-mDoc");
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, "s5.jpg"), quality: 82, type: "jpeg" });
    await ctx.close();
    fs.unlinkSync(inlineOut);
    console.log("정지  s5.jpg");
  }

  await browser.close();
  srv.close();

  const total = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
  console.log("\n합계 " + Math.round(total / 1024) + "KB  (상한 5120KB)");
  if (total > 5 * 1024 * 1024) { console.error("✗ 용량 상한 초과"); process.exit(1); }
}

run().catch((e) => { console.error(e); process.exit(1); });
