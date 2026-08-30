/*
 * 불릿 위계 QA — 규칙대로 움직이는지 «자리마다» 확인하고 눈으로 볼 리포트를 만든다.
 *
 * 실행: playwright 가 있는 폴더에서
 *   node <레포>/scripts/qa-drag.js            → 표를 찍고 _qa/drag-report.html 생성
 *   node <레포>/scripts/qa-drag.js --open     → 만든 뒤 브라우저로 연다
 *
 * 매 빌드마다 돌릴 것은 아니다 (PM 2026-08-30) — 규칙을 손댔을 때 켠다.
 * 같은 검사가 e2e 에도 있다: node tests/e2e.js --grid
 *
 * ── 규칙 (여기 적힌 것이 «맞다» 의 정의다) ──
 *  1) 넣을 자리 : 눈에 보이는 «줄과 줄 사이» 하나. 커서에서 가장 가까운 경계로 붙는다
 *  2) 깊이     : 원래 깊이 + 잡은 곳에서 옆으로 간 칸수 (아래로만 끌면 같은 단)
 *  3) 깊이 상한 : 넣을 자리 바로 앞 블록보다 한 단까지 (최대 2단). 앞이 없으면 0단
 *  4) 끌고 있는 덩어리는 «이미 빠진 셈» 으로 본다 (자기가 자기 부모가 되지 않게)
 *  5) 안 그린다 : 자기 하위 안 · 놓아도 자리와 깊이가 그대로일 때
 *  6) 소속 박스 : 깊이 1 이상이면 «어느 덩어리 안» 인지 박스로 감싼다 (부모 + 그 하위 전체)
 *  6-1) 깊이 0 이면 박스가 없다 — 어느 덩어리에도 안 속한다는 뜻
 *  7) 옮길 때  : 딸린 하위가 통째로 따라오고 깊이 차이를 유지한다
 */
const path = require("path");
const fs = require("fs");
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), __dirname] }));

const REPO = path.resolve(__dirname, "..");
const OPEN = process.argv.includes("--open");
const OUT = path.join(REPO, "_qa", "drag-report.html");

/* 샘플 목록 — 「0A」 = 0단 A. 「끄는 것」 은 from 번째 블록 */
const SAMPLES = [
  { name: "평평한 목록", list: "0A,0B,0C", from: 1, 뜻: "가운데 B 를 끈다" },
  { name: "하위 하나", list: "0A,1B,0C,1D", from: 1, 뜻: "A 의 하위 B 를 끈다" },
  { name: "하위 둘 달린 부모", list: "0A,1P,1Q,0B", from: 0, 뜻: "부모 A 를 끈다 (P·Q 가 따라와야)" },
  { name: "손자 달린 하위", list: "0A,1P,2X,0B", from: 1, 뜻: "P 를 끈다 (손자 X 가 따라와야)" },
  { name: "가장 깊은 손자", list: "0A,1P,2X,0B", from: 2, 뜻: "맨 아래 손자 X 를 끈다" },
  { name: "맨 앞", list: "0A,0B,1P,1Q", from: 0, 뜻: "첫 블록 A 를 끈다" },
  { name: "맨 뒤 하위", list: "0A,1P,0B,1Q", from: 3, 뜻: "마지막 하위 Q 를 끈다" },
  { name: "손자 낀 하위", list: "0A,1P,2Q,1R,0B", from: 1, 뜻: "P 를 끈다 (Q 만 따라오고 R 은 아님)" },
  { name: "둘뿐", list: "0A,0B", from: 0, 뜻: "둘뿐인 목록에서 앞을 끈다" },
];
const DX = [-1, 0, 1, 2]; /* 잡은 곳에서 옆으로 민 칸수 */

const parse = (s) => s.split(",").filter(Boolean).map((x) => ({ t: x.slice(1), d: Number(x[0]) }));
const say = (l) => l.map((b) => b.d + b.t).join(",");

/* ---- 참조 구현: 위 규칙을 그대로 적은 것 ---- */
function ref(l, from, di, half, dx) {
  const ind = (i) => (l[i] ? l[i].d : 0);
  const sub = (i) => { let n = 1; while (i + n < l.length && ind(i + n) > ind(i)) n++; return n; };
  const n = sub(from);
  const at = half === "아래" ? di + 1 : di;
  if (at > from && at < from + n) return { show: false, why: "자기 하위 안" };
  let p = at - 1;
  while (p >= from && p < from + n) p--;
  const cap = p >= 0 ? Math.min(2, ind(p) + 1) : 0;
  const want = Math.max(0, Math.min(cap, ind(from) + dx));
  const at2 = at > from ? at - n : at;
  if (at2 === from && want === ind(from)) return { show: false, why: "놓아도 그대로" };
  let par = -1;
  if (want > 0) for (let i = at - 1; i >= 0; i--) {
    if (i >= from && i < from + n) continue;
    if (ind(i) === want - 1) { par = i; break; }
  }
  const cut = l.slice(from, from + n).map((b) => ({ t: b.t, d: b.d }));
  const rest = l.slice(0, from).concat(l.slice(from + n));
  const shift = want - cut[0].d;
  cut.forEach((b) => { b.d = Math.max(0, Math.min(2, b.d + shift)); });
  return { show: true, ind: want, par: par >= 0 ? l[par].t : null,
    after: say(rest.slice(0, at2).concat(cut, rest.slice(at2))) };
}

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message)));

  const rows = [];
  let cases = 0, bad = 0;
  for (const S of SAMPLES) {
    const l = parse(S.list);
    const defs = "[" + l.map((x) => x.d ? "{t:'" + x.t + "',indent:" + x.d + "}" : "{t:'" + x.t + "'}").join(",") + "]";
    /* 샘플마다 한 번만 띄우고, 드롭이 상태를 바꿨으면 Ctrl+Z 로 되돌린다 (케이스마다 재로딩 X) */
    await p.goto("about:blank");
    await p.setContent('<div id="a" data-spec="1">가</div>' +
      "<script>window.SCREENSPEC={screen:{id:'S-QA',name:'qa'},specs:[{n:1,target:'1',title:'T',defs:" + defs + "}]};<" + "/script>");
    await p.addScriptTag({ path: path.join(REPO, "screenspec.js") });
    await p.waitForTimeout(280);
    await p.click("#ss-mDoc");
    await p.waitForTimeout(180);
    for (let di = 0; di < l.length; di++) {
      for (const half of ["위", "아래"]) {
        for (const dx of DX) {
          const got = await p.evaluate(([f, i, h, v]) => {
            const src = document.querySelector('.ss-b[data-di="' + f + '"] .ss-g-grip');
            const dt = new DataTransfer();
            const step = 16, x0 = 500;
            src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: x0 }));
            const el = document.querySelector('.ss-b[data-di="' + i + '"]');
            const r = el.getBoundingClientRect();
            const y = h === "위" ? r.top + 2 : r.bottom - 2, x = x0 + v * step;
            el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientY: y, clientX: x }));
            const line = document.querySelector(".ss-drop-line"), par = document.querySelector(".ss-drop-in");
            const o = { show: !!line, ind: line ? parseInt(line.style.marginLeft || "0", 10) / 16 : null,
              par: par ? par.querySelector(".ss-dt").textContent.trim() : null };
            el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt, clientY: y, clientX: x }));
            src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
            return o;
          }, [S.from, di, half, dx]);
          let after = await p.evaluate(() =>
            window.SCREENSPEC.specs[0].defs.map((d) => (d.indent || 0) + d.t).join(","));
          const w = ref(l, S.from, di, half, dx);
          const wantAfter = w.show ? w.after : S.list;
          const ok = got.show === w.show && (!w.show || (got.ind === w.ind && got.par === w.par)) && after === wantAfter;
          cases++;
          if (!ok) bad++;
          rows.push({ 샘플: S.name, 목록: S.list, 끄는것: l[S.from].t, 자리: l[di].t + " " + half, 옆으로: dx,
            기대: w.show ? "선 " + w.ind + "단" + (w.par ? " (" + w.par + "의 하위)" : "") : "선 없음 · " + w.why,
            실제: got.show ? "선 " + got.ind + "단" + (got.par ? " (" + got.par + "의 하위)" : "") : "선 없음",
            기대결과: wantAfter, 실제결과: after, ok: ok });
          if (after !== S.list) {
            await p.keyboard.press("Control+z");
            await p.waitForTimeout(60);
          }
        }
      }
    }
  }
  await b.close();

  /* ---- 화면 표 ---- */
  const failed = rows.filter((r) => !r.ok);
  console.log("샘플 " + SAMPLES.length + "가지 · 검사 " + cases + "건 · 어긋남 " + bad + "건");
  if (failed.length) console.table(failed.slice(0, 25).map((r) => ({
    목록: r.목록, 끄는것: r.끄는것, 자리: r.자리, 옆으로: r.옆으로, 기대: r.기대, 실제: r.실제,
    기대결과: r.기대결과, 실제결과: r.실제결과 })));
  if (errs.length) console.log("JS 에러:", errs);

  /* ---- 눈으로 볼 리포트 ---- */
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const byS = SAMPLES.map((S) => {
    const rs = rows.filter((r) => r.샘플 === S.name && r.목록 === S.list);
    const nb = rs.filter((r) => !r.ok).length;
    return '<section><h2>' + esc(S.name) + ' <small>' + esc(S.list) + ' · ' + esc(S.뜻) + '</small>' +
      '<b class="' + (nb ? "no" : "yes") + '">' + (nb ? nb + "건 어긋남" : "전부 일치") + '</b></h2>' +
      '<table><tr><th>놓는 자리</th><th>옆으로</th><th>기대</th><th>실제</th><th>기대 결과</th><th>실제 결과</th></tr>' +
      rs.map((r) => '<tr class="' + (r.ok ? "" : "bad") + '"><td>' + esc(r.자리) + '</td><td>' + (r.옆으로 > 0 ? "+" : "") + r.옆으로 +
        '</td><td>' + esc(r.기대) + '</td><td>' + esc(r.실제) + '</td><td><code>' + esc(r.기대결과) +
        '</code></td><td><code>' + esc(r.실제결과) + '</code></td></tr>').join("") + '</table></section>';
  }).join("");
  fs.writeFileSync(OUT, '<!doctype html><meta charset="utf-8"><title>불릿 위계 QA</title>' +
    '<style>body{font:13px/1.6 "Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;margin:28px;color:#191919;background:#fafaf9}' +
    'h1{font-size:19px;margin:0 0 4px}p.sum{color:#666;margin:0 0 22px}' +
    'h2{font-size:14px;margin:26px 0 8px;display:flex;align-items:center;gap:9px}' +
    'h2 small{font-weight:400;color:#9b9a97;font-size:11.5px}' +
    'h2 b{margin-left:auto;font-size:11px;padding:2px 9px;border-radius:99px}' +
    'h2 b.yes{background:#E6F4EC;color:#2F8F5B}h2 b.no{background:#FDEAE5;color:#C0341A}' +
    'table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e9e9e7;border-radius:8px;overflow:hidden}' +
    'th,td{padding:5px 9px;text-align:left;border-bottom:1px solid #f1f1f0;font-size:12px}' +
    'th{background:#f7f7f6;font-size:11px;color:#666;font-weight:700}' +
    'code{font-family:ui-monospace,Consolas,monospace;font-size:11px;background:#f4f4f3;padding:1px 5px;border-radius:4px}' +
    'tr.bad td{background:#FFF6F4}tr.bad code{background:#FBE0D8}' +
    'section{margin-bottom:8px}</style>' +
    '<h1>불릿 위계 QA</h1><p class="sum">샘플 ' + SAMPLES.length + '가지 · 자리마다 검사 ' + cases + '건 · ' +
    (bad ? '<b style="color:#C0341A">어긋남 ' + bad + '건</b>' : '<b style="color:#2F8F5B">전부 일치</b>') +
    ' &nbsp;·&nbsp; 규칙은 <code>scripts/qa-drag.js</code> 머리말에 적혀 있다</p>' + byS);
  console.log("리포트: " + OUT);
  if (OPEN) require("child_process").exec('start "" "' + OUT + '"', { shell: "cmd.exe" });
  process.exit(bad ? 1 : 0);
})();
