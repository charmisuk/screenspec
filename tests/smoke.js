/*
 * ScreenSpec smoke — 예제 전수 클릭 검사 (사이클 종료·릴리스 전)
 * 실행: node tests/smoke.js  (playwright 필요 — e2e 와 동일)
 * 모든 examples/*.html 을 열고 정의서 모드 → 마커 전부 클릭 → 재생 버튼 전부 → 목차 행 → 480/1440 리사이즈.
 * JS 에러가 1건이라도 있으면 FAIL. 경고는 출력만 한다 (누락 정의 경고 등은 예제 특성일 수 있다).
 * e2e 가 "정해진 시나리오" 라면 smoke 는 "아무거나 다 눌러봐도 안 죽는가" 다.
 */
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), __dirname] })); const http=require("http"),fs=require("fs"),path=require("path");
const REPO=path.resolve(__dirname,".."); const LIB=fs.readFileSync(REPO+"/screenspec.js","utf8");
(async()=>{
  const srv=http.createServer((req,res)=>{ if(req.url.endsWith("screenspec.js")){res.setHeader("content-type","text/javascript");res.end(LIB);return;}
    const f=req.url.split("?")[0].replace(/^\/screenspec\//,"/"); const fp=path.join(REPO,f.endsWith(".html")?f:"/examples/overlay-spa.html");
    res.setHeader("content-type","text/html"); res.end(fs.existsSync(fp)?fs.readFileSync(fp,"utf8").replace("../screenspec.js","/screenspec.js"):"<html></html>"); });
  await new Promise(r=>srv.listen(4181,r));
  const b=await chromium.launch(); const out=[];
  for (const ex of fs.readdirSync(path.join(REPO,"examples")).filter(f=>f.endsWith(".html")&&!f.startsWith("_")).map(f=>f.replace(/\.html$/,""))) {
    const p=await b.newPage({viewport:{width:1440,height:900}}); const errs=[], warns=[];
    p.on("pageerror",e=>errs.push(String(e.message))); p.on("console",m=>{ if(m.type()==="error") errs.push(m.text()); if(m.type()==="warning") warns.push(m.text()); });
    const url = ex==="overlay-spa" ? "http://localhost:4181/screenspec/examples/overlay-spa.html" : "file://"+REPO+"/examples/"+ex+".html";
    await p.goto(url); await p.waitForTimeout(700);
    const docBtn = await p.locator("#ss-mDoc").count() ? "#ss-mDoc" : "#ss-ovDoc";
    await p.click(docBtn); await p.waitForTimeout(400);
    const markers = await p.locator(".ss-marker").count();
    for (let i=0;i<markers;i++){ const m=p.locator(".ss-marker").nth(i); if(await m.isVisible()) { await m.click({force:true}); await p.waitForTimeout(80);} }
    const plays = await p.locator("[data-play]").count();
    for (let i=0;i<plays;i++){ const el=p.locator("[data-play]").nth(i); if(await el.isVisible()) { await el.click({force:true}); await p.waitForTimeout(150);} }
    /* 재생 단추가 프로토타입의 «전체 화면 모달» 을 열어 둔 채로 올 수 있다 (shop.html 쿠폰 시트 등).
       그건 프로토타입 사정이지 우리 잘못이 아니므로, 마커와 같이 force 로 누른다 */
    if (await p.locator(".ss-toc-btn").count()) { await p.click(".ss-toc-btn",{force:true}); await p.waitForTimeout(200); const rows=await p.locator("[data-toc]").count();
      for (let i=0;i<Math.min(rows,6);i++){ if(!(await p.locator(".ss-toc").isVisible())) { await p.click(".ss-toc-btn",{force:true}); await p.waitForTimeout(150);} await p.locator("[data-toc]").nth(i).click({force:true}); await p.waitForTimeout(200);} }
    await p.setViewportSize({width:480,height:800}); await p.waitForTimeout(300); await p.setViewportSize({width:1440,height:900}); await p.waitForTimeout(300);
    const cur = await p.evaluate(()=>window.ScreenSpec&&window.ScreenSpec.current());
    out.push({ex, markers, plays, cur, errors:errs.length, warnings:warns.map(w=>w.slice(0,90))});
    await p.close();
  }
  await b.close(); srv.close();
  let fail=0; out.forEach(o=>{ const ok=o.errors===0; if(!ok) fail++; console.log((ok?"  PASS ":"  FAIL ")+"examples/"+o.ex+".html — 마커 "+o.markers+"·재생 "+o.plays+"·현재 "+o.cur+"·에러 "+o.errors+(o.warnings.length?"\n        경고: "+o.warnings.join(" | "):"")); });
  console.log("\nsmoke 결과: "+(fail?"FAIL "+fail+"건":"전부 통과 ("+out.length+"개 예제)")); process.exit(fail?1:0);
})();
