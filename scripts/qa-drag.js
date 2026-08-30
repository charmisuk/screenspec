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
 *  0) 불변    : 내가 옮긴 것 «말고는» 아무것도 안 바뀐다 — 남의 깊이도, 남의 소속(부모)도.
 *              PM 2026-08-30: 「내가 바꾸는 건 그 하나의 불렛만. 그게 다른 곳을 바꾸면 안 돼.」
 *              ⚠ 지금 모형(평평한 목록 + 절대 깊이 숫자)으로는 이 약속을 지킬 수 없다.
 *              부모가 저장되지 않고 «앞쪽에서 깊이가 하나 작은 첫 블록» 으로 «계산» 되기 때문에,
 *              앞에 무엇이 끼거나 빠지면 뒤 블록의 부모가 조용히 바뀐다.
 *              아래 「R0 위반」 수가 그 빚이다. 트리로 옮기면 0 이 되어야 한다.
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

/* ---- 검사는 «결과 예측» 이 아니라 «불변 조건» 이다 ----
   트리로 옮긴 뒤에는 구현을 베껴 결과를 예측하는 것이 검증이 아니다 (같은 코드를 두 번 쓰는 셈).
   대신 «무슨 일이 있어도 지켜져야 하는 것» 을 재고, 하나라도 깨지면 그 자리를 보여 준다. */
const INV = [
  { name: "R0 남이 안 바뀜", why: "내가 옮긴 것 말고는 깊이도 소속도 그대로여야 한다" },
  { name: "개수 보존", why: "옮기다 줄이 사라지거나 늘면 안 된다" },
  { name: "하위 동행", why: "딸린 하위는 통째로 따라와야 한다 (R7)" },
  { name: "깊이 상한", why: "2단을 넘는 줄이 생기면 안 된다" },
  { name: "표시 = 변화", why: "선이 뜨면 반드시 바뀌고, 안 뜨면 반드시 그대로여야 한다" },
];
/* 「0A,1B」 표기 ↔ 부모 관계 */
const parentOf = (l) => {
  const m = {};
  l.forEach((b, i) => {
    m[b.t] = "(뿌리)";
    for (let j = i - 1; j >= 0; j--) if (l[j].d === b.d - 1) { m[b.t] = l[j].t; break; }
  });
  return m;
};
/* 그 블록에 딸린 하위들의 이름 (바로 뒤에서 더 깊은 동안) */
const kidsOf = (l, t) => {
  const i = l.findIndex((b) => b.t === t);
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < l.length && l[k].d > l[i].d; k++) out.push(l[k].t);
  return out;
};
/* 한 자리에서 지켜져야 하는 것들을 전부 재고, 깨진 것만 돌려준다 */
function checkInv(before, afterStr, movedT, drewLine) {
  const after = parse(afterStr);
  const bad = [];
  const pb = parentOf(before), pa = parentOf(after);
  const db = {}; before.forEach((b) => (db[b.t] = b.d));
  const da = {}; after.forEach((b) => (da[b.t] = b.d));
  const moved = new Set([movedT].concat(kidsOf(before, movedT)));

  before.forEach((b) => {
    if (moved.has(b.t)) return;
    if (da[b.t] !== db[b.t]) bad.push("R0: " + b.t + " 깊이 " + db[b.t] + "→" + da[b.t]);
    if (pa[b.t] !== pb[b.t]) bad.push("R0: " + b.t + " 부모 " + pb[b.t] + "→" + pa[b.t]);
  });
  if (after.length !== before.length) bad.push("개수 " + before.length + "→" + after.length);
  const kb = kidsOf(before, movedT).join("/"), ka = kidsOf(after, movedT).join("/");
  if (kb !== ka) bad.push("하위 [" + kb + "]→[" + ka + "]");
  after.forEach((b) => { if (b.d > 2) bad.push("깊이 " + b.t + "=" + b.d); });
  const same = afterStr === say(before);
  if (drewLine && same) bad.push("선은 떴는데 안 바뀜");
  if (!drewLine && !same) bad.push("선은 안 떴는데 바뀜");
  return bad;
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
            const sr = src.getBoundingClientRect();
            const step = 16, x0 = sr.left + sr.width / 2; /* 실제로 잡는 자리 */
            src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt, clientX: x0 }));
            const el = document.querySelector('.ss-b[data-di="' + i + '"]');
            const r = el.getBoundingClientRect();
            const y = h === "위" ? r.top + 2 : r.bottom - 2, x = x0 + v * step;
            el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt, clientY: y, clientX: x }));
            const line = document.querySelector(".ss-drop-line"), par = document.querySelector(".ss-drop-in");
            const pt = par ? (document.querySelector('.ss-b[data-di="' + par.dataset.parent + '"] .ss-dt') || {}).textContent : null;
            const o = { show: !!line, ind: line ? Number(line.dataset.ind) : null, par: pt ? pt.trim() : null };
            el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt, clientY: y, clientX: x }));
            src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
            return o;
          }, [S.from, di, half, dx]);
          /* 정의는 이제 트리다 — 펼쳐서 «깊이+글자» 로 읽는다 (하네스의 표기는 그대로 쓴다) */
          let after = await p.evaluate(() => {
            const walk = (l, d) => (l || []).reduce((o, b) => o.concat([d + b.t], walk(b.c, d + 1)), []);
            return walk(window.SCREENSPEC.specs[0].defs, 0).join(",");
          });
          const broke = checkInv(l, after, l[S.from].t, got.show);
          const ok = broke.length === 0;
          cases++;
          if (!ok) bad++;
          rows.push({ 샘플: S.name, 목록: S.list, 끄는것: l[S.from].t, 자리: l[di].t + " " + half, 옆으로: dx,
            R0: broke.filter((x) => x.indexOf("R0") === 0).join(" · "),
            표시: got.show ? "선 " + got.ind + "단" + (got.par ? " (" + got.par + "의 하위)" : "") : "선 없음",
            결과: after, 깨진것: broke.join(" · "), ok: ok });
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
  const hurt = rows.filter((r) => r.R0);
  console.log("샘플 " + SAMPLES.length + "가지 · 자리 " + cases + "곳 · 불변 조건이 깨진 곳 " + bad + "곳");
  console.log("  그중 R0(내가 안 건드린 것이 바뀜): " + hurt.length + "곳");
  INV.forEach((v) => console.log("    · " + v.name + " — " + v.why));
  if (failed.length) console.table(failed.slice(0, 25).map((r) => ({
    목록: r.목록, 끄는것: r.끄는것, 자리: r.자리, 옆으로: r.옆으로, 표시: r.표시, 결과: r.결과, 깨진것: r.깨진것 })));
  if (errs.length) console.log("JS 에러:", errs);

  /* ---- 눈으로 볼 리포트 ---- */
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const byS = SAMPLES.map((S) => {
    const rs = rows.filter((r) => r.샘플 === S.name && r.목록 === S.list);
    const nb = rs.filter((r) => !r.ok).length;
    return '<section><h2>' + esc(S.name) + ' <small>' + esc(S.list) + ' · ' + esc(S.뜻) + '</small>' +
      '<b class="' + (nb ? "no" : "yes") + '">' + (nb ? nb + "건 어긋남" : "전부 일치") + '</b></h2>' +
      '<table><tr><th>놓는 자리</th><th>옆으로</th><th>표시</th><th>결과</th><th>깨진 것</th></tr>' +
      rs.map((r) => '<tr class="' + (r.ok ? "" : "bad") + '"><td>' + esc(r.자리) + '</td><td>' + (r.옆으로 > 0 ? "+" : "") + r.옆으로 +
        '</td><td>' + esc(r.표시) + '</td><td><code>' + esc(r.결과) +
        '</code></td><td class="r0">' + esc(r.깨진것 || "") + '</td></tr>').join("") + '</table></section>';
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
    'td.r0{color:#C0341A;font-size:11px}' +
    'section{margin-bottom:8px}</style>' +
    '<h1>불릿 위계 QA</h1><p class="sum">샘플 ' + SAMPLES.length + '가지 · 자리마다 검사 ' + cases + '건 · ' +
    (bad ? '<b style="color:#C0341A">어긋남 ' + bad + '건</b>' : '<b style="color:#2F8F5B">전부 일치</b>') +
    ' &nbsp;·&nbsp; R0 위반 ' + rows.filter((r) => r.R0).length + '곳' +
    ' &nbsp;·&nbsp; 규칙은 <code>scripts/qa-drag.js</code> 머리말에 적혀 있다</p>' + byS);
  console.log("리포트: " + OUT);
  if (OPEN) require("child_process").exec('start "" "' + OUT + '"', { shell: "cmd.exe" });
  process.exit(bad ? 1 : 0);
})();
