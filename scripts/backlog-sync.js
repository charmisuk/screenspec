/*
 * 백로그 싱크 검사 — GitHub Issues(원본) ↔ Notion 보드(우선순위 판단용)
 *
 *   node scripts/backlog-sync.js            드리프트만 보고 (기본 = dry-run). 어긋나면 exit 1
 *   node scripts/backlog-sync.js --apply    노션 쪽을 실제로 맞춤 + 실행 후 재검증
 *
 * 보드는 3칸 컨베이어다: 백로그 → 완료. «안 한다» 로 뺀 것만 보류.
 *   백로그에 넣는 규칙 = GitHub 이슈를 연다. 이슈가 원본이고 카드는 이 스크립트가 만든다.
 *   완료로 보내는 규칙 = 이슈가 닫힌다(= 커밋 메시지의 fix #N). 사람이 옮기지 않는다.
 *   보류는 사람 영역 — 이 스크립트가 건드리지 않는다.
 *
 * 잡는 드리프트 4종:
 *   1) 열린 이슈인데 노션 카드가 없음        → 우선순위 판단에서 누락된다
 *   2) 닫힌 이슈인데 카드가 '완료'가 아님     → 보드가 실제보다 밀린 것처럼 보인다
 *   3) 카드가 '완료'인데 이슈는 열려 있음     → 끝났다고 착각한다
 *   4) 카드의 GitHub 링크가 실존하지 않음     → 죽은 링크
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
  });
  const parsed = cards.map(card);
  const linked = new Map(parsed.filter((c) => issueNo(c.url)).map((c) => [issueNo(c.url), c]));

  /* ---- 판정 ---- */
  const drift = [];
  issues.filter((i) => i.state === "open").forEach((i) => {
    if (!linked.has(i.number)) drift.push({ kind: "카드 없음", issue: i, msg: `#${i.number} ${i.title}` });
  });
  /* 푸시될 커밋이 «fix #N» 으로 닫을 이슈들 — GitHub 이 닫기 전이라 아직 open 으로 보인다.
     푸시 훅은 push 직전에 도는데 GitHub 은 push 직후에 닫으므로, 여기서 미리 같은 결론을 낸다. */
  const closing = new Set();
  if (FROM_PUSH) {
    let log = '';
    try { log = execSync('git log --format=%B origin/main..HEAD', { cwd: REPO }).toString(); } catch { log = ''; }
    const re = /(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s*#(\d+)/gi; /* 정규식 리터럴 — 문자열로 쓰면 \\s 가 글자 s 가 된다 */
    let m;
    while ((m = re.exec(log))) closing.add(Number(m[1]));
    console.log("푸시 범위: 커밋 " + (log.trim() ? log.trim().split(/^commit /m).length : 0) + "덩이 · 닫을 이슈 " + (closing.size ? [...closing].map((n) => "#" + n).join(" ") : "없음"));
  }
  parsed.forEach((c) => {
    const n = issueNo(c.url);
    if (n === null) return;
    const i = byNo.get(n);
    if (!i) { drift.push({ kind: "죽은 링크", card: c, msg: `${c.name} → #${n} 없음` }); return; }
    if (c.status === "보류") return; /* 보류는 사람이 «안 한다» 고 정한 칸 — 기계가 되돌리지 않는다 */
    const done = i.state === "closed" || closing.has(n);
    if (done && c.status !== "완료") drift.push({ kind: "완료 반영 안 됨", card: c, msg: `${c.name} (#${n} ${i.state === 'closed' ? '닫힘' : '곧 닫힘'} · 카드 ${c.status})` });
    if (!done && c.status === "완료") drift.push({ kind: "완료인데 이슈 열림", card: c, msg: `${c.name} (#${n})` });
  });

  console.log(`이슈 ${issues.length}건(열림 ${issues.filter((i) => i.state === "open").length}) · 카드 ${parsed.length}장`);
  if (!drift.length) { console.log("\n싱크 결과: 일치"); return 0; }

  console.log("\n어긋난 항목 " + drift.length + "건");
  drift.forEach((d) => console.log("  [" + d.kind + "] " + d.msg));

  if (!APPLY) {
    console.log("\n고치려면: node scripts/backlog-sync.js --apply");
    return 1;
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
          "상태": { select: { name: "백로그" } },
          "유형": { select: { name: /버그|bug/i.test(i.title + label(i)) ? "버그" : "기능" } },
          "근거": { select: { name: "내부 발견" } },
          "우선순위": { select: { name: "P2" } }, /* 들어온 직후는 P2. 전체 재비교에서 올린다 */
          "GitHub": { url: i.html_url },
          "설명": { rich_text: rt((i.body || "").replace(/\r?\n+/g, " ").slice(0, 300) || "GitHub 이슈에서 자동 생성") },
        },
      });
      console.log("  + 카드 생성: #" + i.number);
    } else if (d.kind === "완료 반영 안 됨") {
      await nApi("PATCH", "/pages/" + d.card.id, { properties: { "상태": { select: { name: "완료" } } } });
      console.log("  ~ 완료 처리: " + d.card.name);
    } else {
      console.log("  ! 수동 확인 필요: [" + d.kind + "] " + d.msg);
    }
  }
  return null; /* 재검증 신호 */
}

main().then(async (code) => {
  if (code !== null) process.exit(code);
  console.log("\n실행 후 재검증...");
  const r = execSync(`node "${__filename}"`, { cwd: REPO }).toString();
  console.log(r.split("\n").slice(-3).join("\n"));
}).catch((e) => fail(String(e.message || e)));
