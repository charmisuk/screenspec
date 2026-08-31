/*
 * 릴리스 — 태그 → 푸시 → jsDelivr 퍼지 → 실물 확인을 한 번에.
 *
 *   node scripts/release.js                  검사만 (기본 = dry-run). 나갈 준비가 됐는지
 *   node scripts/release.js --apply          로컬에서 실제로 태그·푸시·퍼지하고 결과를 확인
 *   node scripts/release.js --notes          CHANGELOG 최상단 절만 출력 (릴리스 본문용)
 *   node scripts/release.js --pre            버전 정합만 확인 (태그 없어도 통과 — 릴리스 직전 CI 용)
 *   node scripts/release.js --tag-gate      문서가 가리키는 태그가 원격에 실재하는지만 (CI 상시 게이트)
 *   node scripts/release.js --verify         실물만 확인 (git 상태 검사 없음 — CI 용)
 *   node scripts/release.js --expect v0.19.3 넘긴 버전이 CHANGELOG·문서와 같은지 확인 (다른 모드와 겸용)
 *
 * 왜 스크립트인가 (2026-08-25 사고):
 *   버전 문자열만 올리고 태그를 안 만들면 README·SKILL 이 존재하지 않는 CDN 주소를 가리킨다.
 *   그 주소를 그대로 심은 프로토타입은 조용히 아무것도 안 뜬다. lint 는 이걸 못 잡는다 —
 *   헤더·배지·CHANGELOG·문서 태그가 "서로 같은지"만 보지, 그 태그가 "실재하는지"는 안 보기 때문이다
 *   (의존성 0 정적 검사라 네트워크를 쓰지 않는다). 그 구멍을 여기서 막는다.
 *
 * 잡는 것:
 *   1) main 의 문서가 미출시 태그를 가리킴        → 사용자가 404 를 심게 된다
 *   2) 태그는 있는데 CDN 이 옛 내용을 물고 있음     → 퍼지 누락 (@0 별칭이 특히 늦다)
 *   3) 작업 트리가 더럽거나 main 이 아님            → 엉뚱한 커밋에 태그가 박힌다
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const GH_REPO = "charmisuk/screenspec";
const CDN = (tag) => `https://cdn.jsdelivr.net/gh/${GH_REPO}@${tag}/screenspec.js`;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const APPLY = has("--apply");
const VERIFY = has("--verify"); /* CI: 체크아웃이 detached 라 git 상태 검사를 건너뛴다 */
const NOTES = has("--notes");
const PRE = has("--pre"); /* 릴리스 직전: 버전 정합만. 태그는 아직 없는 게 정상이다 */
const GATE = has("--tag-gate"); /* 상시 게이트: 문서 버전의 태그가 원격에 있는가. CDN 은 안 본다(전파 지연으로 깜빡임) */
const EXPECT = argv[argv.indexOf("--expect") + 1] && has("--expect") ? argv[argv.indexOf("--expect") + 1] : null;

let bad = 0;
const ok = (m) => console.log("  ✓ " + m);
const no = (m) => { bad++; console.log("  ✗ " + m); };
const die = (m) => { console.error("\n✗ " + m); process.exit(1); };
const git = (c) => execSync("git " + c, { cwd: REPO }).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 200 이고 그 버전의 라이브러리가 맞는지까지 본다 (엣지가 옛 파일을 주면 헤더가 다르다) */
async function fetchLib(url) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return { status: r.status };
    const body = await r.text();
    return { status: r.status, ver: (body.match(/ScreenSpec v(\d+\.\d+)/) || [])[1] };
  } catch (e) { return { status: 0, err: String(e.message || e) }; }
}
/* jsDelivr 는 태그를 바로 못 볼 수 있다 — 조건이 참이 될 때까지 짧게 기다린다 */
async function until(label, fn, tries = 8, gap = 5000) {
  for (let i = 1; i <= tries; i++) {
    const r = await fn();
    if (r) return r;
    if (i < tries) { process.stdout.write(`    … ${label} 대기 ${i}/${tries - 1}\n`); await sleep(gap); }
  }
  return null;
}

/* ---- 버전은 CHANGELOG 최상단이 원본, 문서 CDN 태그가 그 사본 ---- */
const changelog = fs.readFileSync(path.join(REPO, "CHANGELOG.md"), "utf8");
const version = (changelog.match(/^## v(\d+\.\d+\.\d+)/m) || [])[1];
if (!version) die("CHANGELOG.md 최상단에서 '## vX.Y.Z' 를 찾지 못했다");
const tag = "v" + version;

if (NOTES) { console.log((changelog.split(/^## /m)[1] || "").split("\n").slice(1).join("\n").trim()); process.exit(0); }

const docTags = new Set();
for (const f of ["README.md", "SKILL.md"]) {
  const d = fs.readFileSync(path.join(REPO, f), "utf8");
  [...d.matchAll(/@v(\d+\.\d+\.\d+)/g)].forEach((m) => docTags.add(m[1]));
}

(async () => {
  console.log("[릴리스] " + (APPLY ? "실행 (--apply)" : VERIFY ? "실물 확인 (--verify)" : GATE ? "태그 게이트 (--tag-gate)" : PRE ? "버전 정합 (--pre)" : "검사만 — 실제로 내보내려면 --apply"));

  /* ---- 1. 나갈 수 있는 상태인가 (CI 는 건너뛴다) ---- */
  if (!VERIFY && !PRE && !GATE) {
    console.log("\n작업 상태");
    const branch = git("rev-parse --abbrev-ref HEAD");
    const dirty = git("status --porcelain");
    branch === "main" ? ok("브랜치 main") : no(`브랜치가 main 이 아니다 (${branch}) — 릴리스는 main 에서만`);
    dirty ? no("작업 트리에 커밋 안 된 변경이 있다\n" + dirty) : ok("작업 트리 깨끗");

    try { execSync("node tests/lint.js", { cwd: REPO, stdio: "pipe" }); ok("lint 통과"); }
    catch { no("lint 실패 — node tests/lint.js 먼저 통과시켜라"); }
    console.log("    (e2e·smoke 는 브라우저가 필요해 여기서 돌리지 않는다 — AGENTS.md 절차대로 미리 돌려라)");
  }

  /* ---- 2. 무슨 버전을 내보내는가 ---- */
  console.log("\n버전");
  ok(`CHANGELOG 최상단 ${tag}`);
  docTags.size === 1 && docTags.has(version)
    ? ok(`문서 CDN 태그도 ${tag}`)
    : no(`문서 CDN 태그가 어긋난다: ${JSON.stringify([...docTags])} vs ${version}`);
  if (EXPECT) {
    EXPECT === tag ? ok(`요청한 버전 ${EXPECT} 일치`)
                   : no(`요청한 버전 ${EXPECT} 이 CHANGELOG 최상단(${tag})과 다르다 — CHANGELOG 를 먼저 올려라`);
  }

  if (PRE) {
    console.log("\n결과: " + (bad ? `문제 ${bad}건` : "버전 정합 이상 없음 — 태그는 릴리스 단계에서 만든다"));
    process.exit(bad ? 1 : 0);
  }

  /* 상시 게이트 — 문서가 가리키는 태그가 원격에 실재하는가.
     버전만 올리고 릴리스를 안 하면 README·SKILL 이 404 를 가리킨 채 main 에 남는다.
     그 실패는 «릴리스를 낼 때만» 도는 검사로는 절대 안 잡힌다 — 안 내는 것이 실패이기 때문이다.
     그래서 push 마다 여기서 본다. CDN 실물은 전파 지연으로 깜빡이므로 이 모드에선 안 본다. (2026-08-28) */
  if (GATE) {
    const live = git(`ls-remote --tags origin ${tag}`).length > 0;
    live ? ok(`원격에 ${tag} 태그 있음`)
         : no(`원격에 ${tag} 태그가 없다 — 문서는 ${tag} 를 가리키는데 그 주소는 404 다. 릴리스하거나 문서 버전을 되돌려라`);
    console.log("\n결과: " + (bad ? `문제 ${bad}건` : "문서 버전 = 출시된 태그"));
    process.exit(bad ? 1 : 0);
  }

  const tagged = git(`ls-remote --tags origin ${tag}`).length > 0;
  if (tagged) ok(`원격에 ${tag} 태그 있음 (이미 릴리스)`);
  else if (APPLY) ok(`원격에 ${tag} 없음 → 지금 만든다`);
  else no(`원격에 ${tag} 태그가 없다 — 문서는 ${tag} 를 가리키는데 그 주소는 404 다. --apply 로 릴리스하거나 문서 태그를 되돌려라`);

  /* ---- 3. 실물 확인 (검사 모드·CI 모드) ---- */
  if (!APPLY) {
    if (tagged) {
      console.log("\n실물 확인");
      const major = version.split(".").slice(0, 2).join(".");
      const pinned = await until(`${tag} 반영`, async () => {
        const r = await fetchLib(CDN(tag));
        return r.status === 200 && r.ver === major ? r : null;
      }, VERIFY ? 8 : 1);
      pinned ? ok(`${tag} 200 · 헤더 v${pinned.ver}`) : no(`${tag} 가 아직 안 뜬다`);

      if (VERIFY) {
        /* «실물 파일» 로 잰다 (2026-08-31). 전에는 메타 API(data.jsdelivr.com/…/resolved)를 봤는데,
           그쪽은 파일 캐시와 따로 놀아 파일이 이미 새 판을 내보내는데도 며칠 옛 번호를 답한다.
           사람에게 나가는 것은 파일이지 메타가 아니다 — 그걸로 릴리스를 실패로 잡으면 늑대 소년이 된다 */
        const alias = await until("@0 재해석", async () => {
          const r = await fetchLib(CDN("0"));
          return r.status === 200 && r.ver === major ? r.ver : null;
        });
        alias ? ok(`@0 → v${alias} (실물 파일 헤더)`) : no(`@0 가 아직 v${major} 로 안 간다 — 퍼지 후 지연일 수 있다`);
        for (const t of docTags) {
          const r = await fetchLib(CDN("v" + t));
          r.status === 200 ? ok(`문서의 @v${t} 열림`) : no(`문서가 가리키는 @v${t} → HTTP ${r.status}`);
        }
      }
    }
    console.log("\n결과: " + (bad ? `문제 ${bad}건` : "이상 없음"));
    process.exit(bad ? 1 : 0);
  }

  if (bad) die(`문제 ${bad}건 — 고치고 다시 실행해라 (태그는 만들지 않았다)`);

  /* ---- 4. 태그 · 푸시 ---- */
  console.log("\n태그·푸시");
  if (!tagged) { git(`tag ${tag}`); ok(`태그 ${tag} 생성`); }
  git("push origin main --tags");
  ok("origin/main + 태그 푸시");

  /* ---- 5. 퍼지 — 태그가 생긴 뒤라야 의미가 있다 ---- */
  await purge();

  /* ---- 6. 실제로 나갔는지 확인 ---- */
  await verifyLive();

  const notes = (changelog.split(/^## /m)[1] || "").trim();
  console.log("\n남은 절차 — GitHub Release (본문은 아래 CHANGELOG 절)");
  console.log(`  gh release create ${tag} --title "${tag}" --notes-file <파일>`);
  console.log("  ─".repeat(30) + "\n" + notes.split("\n").map((l) => "  " + l).join("\n"));

  console.log("\n결과: " + (bad ? `릴리스는 했으나 확인 ${bad}건 실패` : `${tag} 릴리스 완료`));
  process.exit(bad ? 1 : 0);

  async function purge() {
    console.log("\njsDelivr 퍼지");
    for (const t of [tag, "0"]) {
      const u = `https://purge.jsdelivr.net/gh/${GH_REPO}@${t}/screenspec.js`;
      try { const r = await fetch(u); ok(`@${t} 퍼지 요청 (HTTP ${r.status})`); }
      catch (e) { no(`@${t} 퍼지 실패 — ${e.message}`); }
    }
  }
  async function verifyLive() {
    console.log("\n검증");
    const major = version.split(".").slice(0, 2).join(".");
    const pinned = await until(`${tag} 반영`, async () => {
      const r = await fetchLib(CDN(tag));
      return r.status === 200 && r.ver === major ? r : null;
    });
    pinned ? ok(`${tag} 200 · 헤더 v${pinned.ver}`) : no(`${tag} 가 아직 안 뜬다 — 잠시 후 다시 확인해라`);

    const alias = await until("@0 재해석", async () => {
      try {
        const r = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${GH_REPO}/resolved?specifier=0`);
        const j = await r.json();
        return j.version === version ? j.version : null;
      } catch { return null; }
    });
    alias ? ok(`@0 → ${alias}`) : no(`@0 가 아직 ${version} 로 안 간다 — 퍼지 후 지연일 수 있다`);

    /* 문서가 시키는 주소가 진짜 열리는가 — 이 검사가 없어서 404 를 문서에 실을 뻔했다 */
    for (const t of docTags) {
      const r = await fetchLib(CDN("v" + t));
      r.status === 200 ? ok(`문서의 @v${t} 열림`) : no(`문서가 가리키는 @v${t} → HTTP ${r.status}`);
    }
  }
})();
