/*
 * 백로그 싱크 검사 — GitHub Issues(원본) ↔ Notion 보드(우선순위 판단용)
 *
 *   node scripts/backlog-sync.js            드리프트만 보고 (기본 = dry-run). 어긋나면 exit 1
 *   node scripts/backlog-sync.js --apply    노션 쪽을 실제로 맞춤 + 실행 후 재검증
 *
 * 보드는 컨베이어다: 백로그 → 검수 → 완료. «안 한다» 로 뺀 것만 보류.
 *   백로그  = 이슈만 있다. 이슈가 원본이고 카드는 이 스크립트가 만든다.
 *   검수    = 고쳤고 커밋이 main 에 있다. «(#N)» 으로 알아본다. 이슈는 아직 열려 있다 — PM 이 만져 볼 자리다.
 *   완료    = 배포됐다(= 이슈가 닫혔다). 닫는 것은 배포뿐이다: node scripts/release.js --bump --apply (#88).
 *   보류    = 사람 영역 — 이 스크립트가 건드리지 않는다.
 *
 * 왜 이렇게 바꿨나 (2026-09-01 PM): 전에는 «고친 순간» 이슈가 닫혀 검수 칸이 이름뿐이었다.
 *   PM: 「실제로 다 끝나고 닫는 방식이 좋겠다. 배포를 트리거로 잡자.」
 *   그래서 커밋 메시지에 fix #N(자동 종료)을 쓰지 않고 (#N) 으로 참조만 한다.
 *
 * 묶음(시나리오): GitHub 마일스톤 = 카드 1장, 그 안의 이슈 = 카드 속 체크 1줄 (2026-08-30 PM).
 *   보드에는 큰 시나리오만 보이고 눌러야 세부가 나온다. 체크·진행(n/m)은 이슈 상태로 기계가 맞춘다.
 *
 * 잡는 드리프트 4종:
 *   1) 열린 이슈인데 노션 카드가 없음        → 우선순위 판단에서 누락된다
 *   2) 카드가 있어야 할 칸에 없음            → 보드가 실제와 다른 말을 한다
 *   3) 카드의 GitHub 링크가 실존하지 않음     → 죽은 링크
 *
 * 자격증명: .env.local 의 NOTION_API_KEY (저장소에 커밋 금지 — .gitignore 처리됨)
 *           GitHub 토큰은 git credential 에서 읽는다
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const DB_ID = "3c5fe613-00de-81ae-8e72-ccd89658ba7e"; /* ScreenSpec 백로그 보드 */
const GH_REPO = "charmisuk/screenspec";
const APPLY = process.argv.includes("--apply");
const FROM_PUSH = process.argv.includes("--from-push"); /* 푸시 훅에서: 곧 닫힐 이슈를 미리 완료로 */

/* ---- 자격증명 ---- */
function notionKey() {
  const p = path.join(REPO, ".env.local");
  if (!fs.existsSync(p)) fail(".env.local 없음 — NOTION_API_KEY 를 넣어라 (커밋 금지)");
  const m = fs.readFileSync(p, "utf8").match(/NOTION_API_KEY=(.+)/);
  if (!m) fail(".env.local 에 NOTION_API_KEY 없음");
  return m[1].trim();
}
function ghToken() {
  const out = execSync("git credential fill", { cwd: REPO, input: "protocol=https\nhost=github.com\n\n" }).toString();
  const line = out.split("\n").find((l) => l.startsWith("password="));
  if (!line) fail("git credential 에서 GitHub 토큰을 못 읽음");
  return line.slice(9).trim();
}
function fail(msg) { console.error("✗ " + msg); process.exit(2); }

/* 푸시 훅 자동 설치 — .git/hooks 는 저장소에 따라오지 않는다. 새 컴퓨터에서 «훅 켜는 법» 을
   문서로 알려 주면 반드시 빠뜨리므로, 보드를 만지는 이 스크립트가 스스로 켠다. */
function ensureHook() {
  const hook = path.join(REPO, ".githooks", "pre-push");
  if (!fs.existsSync(hook)) return;
  let cur = '';
  try { cur = execSync("git config --get core.hooksPath", { cwd: REPO, stdio: ["pipe", "pipe", "ignore"] }).toString().trim(); } catch { cur = ""; }
  if (cur === ".githooks") return;
  try { execSync("git config core.hooksPath .githooks", { cwd: REPO }); console.log("· 푸시 훅을 켰다 (core.hooksPath = .githooks)"); } catch { /* 훅 없이도 동작한다 */ }
}

const NH = { "Notion-Version": "2022-06-28", "Content-Type": "application/json" };
const rt = (t) => [{ type: "text", text: { content: t } }];
const txt = (arr) => (arr || []).map((x) => x.plain_text).join("");
const issueNo = (url) => { const m = (url || "").match(/\/issues\/(\d+)/); return m ? Number(m[1]) : null; };
const msNo = (url) => { const m = (url || "").match(/\/milestone\/(\d+)/); return m ? Number(m[1]) : null; };

async function main() {
  ensureHook();
  const NK = notionKey(), GT = ghToken();
  const nApi = async (m, p, body) => {
    const r = await fetch("https://api.notion.com/v1" + p, {
      method: m, headers: { ...NH, Authorization: "Bearer " + NK }, body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) fail("Notion " + p + ": " + JSON.stringify(j).slice(0, 200));
    return j;
  };

  /* ---- 수집 ---- */
  const issues = [];
  for (let page = 1; page <= 5; page++) {
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/issues?state=all&per_page=100&page=${page}`,
      { headers: { Authorization: "token " + GT, "User-Agent": "backlog-sync" } });
    const j = await r.json();
    if (!Array.isArray(j)) fail("GitHub: " + JSON.stringify(j).slice(0, 200));
    issues.push(...j.filter((x) => !x.pull_request));
    if (j.length < 100) break;
  }
  const byNo = new Map(issues.map((i) => [i.number, i]));

  const cards = [];
  let cursor;
  do {
    const j = await nApi("POST", "/databases/" + DB_ID + "/query", { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    cards.push(...j.results);
    cursor = j.has_more ? j.next_cursor : null;
  } while (cursor);

  const card = (c) => ({
    id: c.id,
    name: txt(c.properties["이름"] && c.properties["이름"].title),
    status: (c.properties["상태"] && c.properties["상태"].select || {}).name || "",
    url: (c.properties["GitHub"] || {}).url || "",
    desc: txt(c.properties["설명"] && c.properties["설명"].rich_text),
  });
  const parsed = cards.map(card);
  const linked = new Map(parsed.filter((c) => issueNo(c.url)).map((c) => [issueNo(c.url), c]));

  /* ---- 판정 ---- */
  const drift = [];
  issues.filter((i) => i.state === "open" && !i.milestone).forEach((i) => {
    if (!linked.has(i.number)) drift.push({ kind: "카드 없음", issue: i, msg: `#${i.number} ${i.title}` });
  });
  /* «고쳤다» 는 커밋 제목의 (#N) 으로 알아본다 — 이슈를 닫지 않으므로 GitHub 상태로는 안 보인다 (#88).
     아직 안 올린 커밋도 센다: 푸시 훅은 push «직전» 에 도는데 그 커밋도 곧 main 이 된다. */
  const fixed = new Set();
  {
    let log = "";
    try { log = execSync("git log --format=%s -n 400", { cwd: REPO }).toString(); } catch (e) { log = ""; }
    const re = /\(#(\d+)\)/g; /* 정규식 리터럴 — 문자열로 쓰면 이스케이프가 한 겹 죽는다 */
    let m;
    while ((m = re.exec(log))) fixed.add(Number(m[1]));
    if (FROM_PUSH) {
      let ahead = "";
      try { ahead = execSync("git log --format=%s origin/main..HEAD", { cwd: REPO }).toString(); } catch (e) { ahead = ""; }
      console.log("푸시 범위: 커밋 " + (ahead.trim() ? ahead.trim().split("\n").length : 0) + "개");
    }
  }
  /* 카드가 «있어야 할» 칸. 이 하나로 네 갈래를 대신한다 — 규칙이 한 곳에만 있어야 어긋나지 않는다 */
  const want = (i) => (i.state === "closed" ? "완료" : fixed.has(i.number) ? "검수" : "백로그");
  /* ---- 묶음(마일스톤) 판정 — 보드에는 시나리오만, 세부는 카드 안 체크 목록 (2026-08-30 PM) ---- */
  /* 체크 표시는 «일이 끝났나» 다 — 배포 전이어도 고쳤으면 켠다 */
  const isDone = (i) => i.state === "closed" || fixed.has(i.number);
  const groups = new Map();
  issues.forEach((i) => {
    if (!i.milestone) return;
    const g = groups.get(i.milestone.number) ||
      { no: i.milestone.number, title: i.milestone.title, url: i.milestone.html_url, issues: [] };
    g.issues.push(i);
    groups.set(i.milestone.number, g);
  });
  const msCards = new Map(parsed.filter((c) => msNo(c.url)).map((c) => [msNo(c.url), c]));
  for (const g of groups.values()) {
    g.issues.sort((a, b) => a.number - b.number);

    g.done = g.issues.filter(isDone).length;
    /* 쓰는 쪽(msChecklist)도 «끝났나» 는 이 판단 하나를 쓴다 — 술어가 둘이면 반영이 겉돈다:
       판정은 「고침(검수)도 끝」 인데 쓰기는 「닫힘만 끝」 이라, 검수 이슈가 영영 안 체크되고
       재검증이 매번 어긋났다 (2026-09-03 실측: #48 푸시 직후) */
    g.doneSet = new Set(g.issues.filter(isDone).map((i) => i.number));
    g.desc = "진행 " + g.done + "/" + g.issues.length;
    const c = msCards.get(g.no);
    if (!c) { drift.push({ kind: "묶음 카드 없음", group: g, msg: g.title + " (세부 " + g.issues.length + "건)" }); continue; }
    if (c.status === "보류") continue; /* 보류는 사람이 «안 한다» 고 정한 칸 */
    /* 진행 문구만 비교하면 안 된다 — 푸시 훅이 «곧 닫힘» 으로 문구를 먼저 써버리면
       나중에 진짜 닫혔을 때 문구가 그대로라 체크가 영영 안 켜진다 (2026-08-30 실측) */
    const want = g.issues.map((i) => (isDone(i) ? "1" : "0")).join("");
    const have = await msMarks(c.id);
    if ((c.desc || "") !== g.desc || have !== want) {
      drift.push({ kind: "체크 갱신", group: g, card: c, msg: g.title + " · " + g.desc });
    }
    /* 묶음도 같은 규칙이다 — 다 닫혔으면 완료, 다 고쳤지만 아직 안 나갔으면 검수 */
    const shipped = g.issues.filter((i) => i.state === "closed").length;
    const to = shipped === g.issues.length ? "완료" : g.done === g.issues.length ? "검수" : "백로그";
    if (c.status !== to) drift.push({ kind: "묶음 " + to + "로", group: g, card: c, to: to, msg: g.title + " · " + g.desc });
  }


  parsed.forEach((c) => {
    const n = issueNo(c.url);
    if (n === null) return;
    const i = byNo.get(n);
    if (!i) { drift.push({ kind: "죽은 링크", card: c, msg: `${c.name} → #${n} 없음` }); return; }
    if (c.status === "보류") return; /* 보류는 사람이 «안 한다» 고 정한 칸 — 기계가 되돌리지 않는다 */
    const to = want(i);
    if (c.status !== to) drift.push({ kind: to + "로", card: c, to: to, msg: `${c.name} (#${n} ${i.state === "closed" ? "닫힘" : fixed.has(n) ? "고침·배포 전" : "열림"} · 카드 ${c.status || "없음"})` });
  });

  console.log(`이슈 ${issues.length}건(열림 ${issues.filter((i) => i.state === "open").length}) · 카드 ${parsed.length}장`);
  if (!drift.length) { console.log("\n싱크 결과: 일치"); return 0; }

  console.log("\n어긋난 항목 " + drift.length + "건");
  drift.forEach((d) => console.log("  [" + d.kind + "] " + d.msg));

  if (!APPLY) {
    console.log("\n고치려면: node scripts/backlog-sync.js --apply");
    return 1;
  }

/* 카드 본문 = 세부 태스크 체크 목록. PM 은 보드에서 시나리오만 보고, 눌러야 이게 나온다.
   줄줄 읽는 글이 아니라 «체크체크체크» 여야 하므로 to_do 블록 한 줄씩만 쓴다.
   매번 통째로 다시 써서(지우고 새로) 이슈 상태와 어긋날 여지를 없앤다. */
/* 카드에 이미 그려진 체크 상태를 «1/0» 문자열로 — 무엇이 달라졌는지 판정하는 근거 */
async function msMarks(pageId) {
  const r = await nApi("GET", "/blocks/" + pageId + "/children?page_size=100");
  return (r.results || []).filter((b) => b.type === "to_do").map((b) => (b.to_do.checked ? "1" : "0")).join("");
}
async function msChecklist(pageId, g) {
  const old = await nApi("GET", "/blocks/" + pageId + "/children?page_size=100");
  for (const b of old.results || []) {
    try { await nApi("DELETE", "/blocks/" + b.id); } catch { /* 이미 지워졌으면 통과 */ }
  }
  const done = (i) => (g.doneSet ? g.doneSet.has(i.number) : i.state === "closed");
  const rows = g.issues.map((i) => ({
    object: "block", type: "to_do",
    to_do: {
      checked: done(i),
      rich_text: [
        { type: "text", text: { content: i.title.replace(/^\[[^\]]+\]\s*/, "") + "  " } },
        { type: "text", text: { content: "#" + i.number, link: { url: i.html_url } },
          annotations: { code: true, color: "gray" } },
      ],
    },
  }));
  if (!rows.length) return;
  for (let k = 0; k < rows.length; k += 90) {
    await nApi("PATCH", "/blocks/" + pageId + "/children", { children: rows.slice(k, k + 90) });
  }
}

  /* ---- 반영 (--apply) ---- */
  console.log("\n반영 중...");
  const label = (i) => (i.labels || []).map((l) => l.name).join(",");
  for (const d of drift) {
    if (d.kind === "카드 없음") {
      const i = d.issue;
      await nApi("POST", "/pages", {
        parent: { database_id: DB_ID },
        properties: {
          "이름": { title: rt(i.title.replace(/^\[[^\]]+\]\s*/, "")) },
          /* 이미 고쳐진 이슈의 카드는 만들 때부터 그 칸이다. 백로그로 만들어 두면 «옮길 것» 판정은
             이미 지나간 뒤라 이 판에서는 못 옮기고, 이어지는 재검증이 그걸 드리프트로 잡아
             푸시 훅이 매번 실패했다 (2026-08-31 실측) */
          "상태": { select: { name: want(i) } },
          "유형": { select: { name: /버그|bug/i.test(i.title + label(i)) ? "버그" : "기능" } },
          "근거": { select: { name: "내부 발견" } },
          "우선순위": { select: { name: "P2" } }, /* 들어온 직후는 P2. 전체 재비교에서 올린다 */
          "GitHub": { url: i.html_url },
          "설명": { rich_text: rt((i.body || "").replace(/\r?\n+/g, " ").slice(0, 300) || "GitHub 이슈에서 자동 생성") },
        },
      });
      console.log("  + 카드 생성: #" + i.number);
    } else if (d.to && d.card && !d.group) {
      await nApi("PATCH", "/pages/" + d.card.id, { properties: { "상태": { select: { name: d.to } } } });
      console.log("  ~ " + d.to + "로: " + d.card.name +
        (d.to === "검수" ? "  (완료는 배포가 옮긴다)" : ""));
    } else if (d.kind === "묶음 카드 없음") {
      const g = d.group;
      const pg = await nApi("POST", "/pages", {
        parent: { database_id: DB_ID },
        properties: {
          "이름": { title: rt(g.title) },
          "상태": { select: { name: g.issues.length && g.issues.every((i) => i.state === "closed") ? "완료"
            : g.done === g.issues.length && g.issues.length ? "검수" : "백로그" } },
          "유형": { select: { name: "기능" } },
          "근거": { select: { name: "내부 발견" } },
          "우선순위": { select: { name: "P1" } },
          "GitHub": { url: g.url },
          "설명": { rich_text: rt(g.desc) },
        },
      });
      await msChecklist(pg.id, g);
      console.log("  + 묶음 카드: " + g.title + " (" + g.desc + ")");
    } else if (d.kind === "체크 갱신") {
      await nApi("PATCH", "/pages/" + d.card.id, { properties: { "설명": { rich_text: rt(d.group.desc) } } });
      await msChecklist(d.card.id, d.group);
      console.log("  ~ 체크: " + d.group.title + " (" + d.group.desc + ")");
    } else if (d.to && d.group) {
      await nApi("PATCH", "/pages/" + d.card.id, { properties: { "상태": { select: { name: d.to } } } });
      console.log("  ~ " + d.to + "로: " + d.group.title + " (" + d.group.desc + ")");
    } else {
      console.log("  ! 수동 확인 필요: [" + d.kind + "] " + d.msg);
    }
  }
  return null; /* 재검증 신호 */
}

main().then(async (code) => {
  if (code !== null) process.exit(code);
  console.log("\n실행 후 재검증...");
  /* 재검증도 «곧 닫힐 이슈» 를 같이 알아야 한다 — 모르면 방금 옮긴 카드를 어긋난 것으로 본다 (2026-08-28 실측) */
  const r = execSync(`node "${__filename}"` + (FROM_PUSH ? " --from-push" : ""), { cwd: REPO }).toString();
  console.log(r.split("\n").slice(-3).join("\n"));
}).catch((e) => fail(String(e.message || e)));
