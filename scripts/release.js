/*
 * 릴리스 — 태그 → 푸시 → jsDelivr 퍼지 → 실물 확인을 한 번에.
 *
 *   node scripts/release.js                  검사만 (기본 = dry-run). 나갈 준비가 됐는지
 *   node scripts/release.js --bump --apply   ★ 배포 한 번 — 버전 7곳 → 커밋 → 태그 → 푸시 → 퍼지 → Release → 확인 → 이슈·보드 정리
 *   node scripts/release.js --bump           그 배포가 무엇을 고칠지만 보여 준다
 *   node scripts/release.js --apply          버전은 이미 올라가 있을 때 (태그부터)
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
/* 판 번호를 손으로 일곱 곳 고치던 것을 없앤다 (#86).
   «다음 판이 무엇인가» 는 사람이 CHANGELOG 최상단에 이미 적었다 — 기계는 그것을 코드로 옮길 뿐이다.
   그래서 major/minor/patch 를 따로 받지 않는다: 받으면 같은 답을 두 곳에서 말하게 되고, 어긋날 자리가 생긴다 */
const BUMP = has("--bump");

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
/* 이 판에 나간 이슈 = CHANGELOG 최상단 절이 적은 #N 들 (#88).
   판의 내용은 사람이 쓰고, 거기 안 적힌 것은 나간 것이 아니다 — 그래서 이것이 유일한 기준이다 */
const shipped = [...new Set([...((changelog.split(/^## /m)[1] || "").matchAll(/#(\d+)/g))].map((m) => m[1]))];

if (NOTES) { console.log((changelog.split(/^## /m)[1] || "").split("\n").slice(1).join("\n").trim()); process.exit(0); }

const DOC_FILES = ["README.md", "SKILL.md"];
const readDocTags = () => {
  const set = new Set();
  for (const f of DOC_FILES) {
    const d = fs.readFileSync(path.join(REPO, f), "utf8");
    [...d.matchAll(/@v(\d+\.\d+\.\d+)/g)].forEach((m) => set.add(m[1]));
  }
  return set;
};
let docTags = readDocTags();

/* ---- 버전 문자열 일곱 곳 (#86) ----
   라이브러리는 «판 계열»(v0.26)을, 문서 CDN 태그는 «판»(@v0.26.0)을 쓴다 — 그 둘은 다른 글자다.
   고친 개수를 세어 예상과 다르면 멈춘다: 문자열이 늘거나 줄었는데 조용히 지나가면 lint 가 뒤에서 잡고,
   그때는 이미 커밋·태그가 나간 뒤다 */
function bumpFiles(fromMajor, toMajor, fromTag, toTag) {
  const done = [];
  const one = (file, from, to, want) => {
    const at = path.join(REPO, file);
    const src = fs.readFileSync(at, "utf8");
    const n = src.split(from).length - 1;
    if (n !== want) return `${file}: "${from}" 가 ${n}곳 (예상 ${want}곳) — 손으로 확인해라`;
    fs.writeFileSync(at, src.split(from).join(to));
    done.push(`${file} ${want}곳`);
    return null;
  };
  const errs = [
    one("screenspec.js", "v" + fromMajor, "v" + toMajor, 5),
    one("README.md", "@v" + fromTag, "@v" + toTag, 1),
    one("SKILL.md", "@v" + fromTag, "@v" + toTag, 1),
  ].filter(Boolean);
  return { errs, done };
}

(async () => {
  console.log("[릴리스] " + (APPLY ? "실행 (--apply)" : VERIFY ? "실물 확인 (--verify)" : GATE ? "태그 게이트 (--tag-gate)" : PRE ? "버전 정합 (--pre)" : "검사만 — 실제로 내보내려면 --apply"));

  /* ---- 1. 나갈 수 있는 상태인가 (CI 는 건너뛴다) ---- */
  if (!VERIFY && !PRE && !GATE) {
    console.log("\n작업 상태");
    const branch = git("rev-parse --abbrev-ref HEAD");
    const dirty = git("status --porcelain");
    branch === "main" ? ok("브랜치 main") : no(`브랜치가 main 이 아니다 (${branch}) — 릴리스는 main 에서만`);
    /* --bump 는 «판 내용을 방금 쓴» 상태에서 부르는 것이 자연스럽다 —
       CHANGELOG 한 파일만 더러운 것은 봐 주고, 그 변경은 아래 release 커밋에 같이 담긴다 (#86) */
    const stray = BUMP ? dirty.split("\n").filter((l) => l && !/\sCHANGELOG\.md$/.test(l)).join("\n") : dirty;
    stray ? no("작업 트리에 커밋 안 된 변경이 있다\n" + stray)
          : ok(dirty ? "작업 트리 깨끗 (CHANGELOG 만 새로 쓴 상태 — release 커밋에 담는다)" : "작업 트리 깨끗");

    /* --bump 일 때는 여기서 lint 를 안 본다: CHANGELOG 를 먼저 쓰므로 «판 번호가 어긋난다» 가
       정상이기 때문이다. 그 어긋남을 없애는 것이 bump 의 일이고, 바로 뒤에서 다시 본다 (#86) */
    if (BUMP) ok("lint 는 bump 뒤에 본다 (지금은 판 번호가 어긋나 있는 것이 정상)");
    else {
      try { execSync("node tests/lint.js", { cwd: REPO, stdio: "pipe" }); ok("lint 통과"); }
      catch { no("lint 실패 — node tests/lint.js 먼저 통과시켜라"); }
    }
    console.log("    (e2e·smoke 는 브라우저가 필요해 여기서 돌리지 않는다 — AGENTS.md 절차대로 미리 돌려라)");
    /* 「손댔을 때만」 으로 두었더니 20자리가 빨간 채로 다섯 판이 나갔다 (#91).
       여기서 돌릴 수는 없지만(브라우저), 물어는 본다 — 안 물으면 또 아무도 안 돌린다 */
    console.log("    · 전체 e2e · 전체 돌연변이 · node tests/e2e.js --grid  ← 이 셋을 돌렸나?");
  }

  /* ---- 1.5 판 번호를 코드로 옮긴다 (#86) ---- */
  /* 사전 검사가 깨졌으면 «버전에 손도 대기 전에» 멈춘다. 올려 놓고 태그를 못 달면
     문서가 없는 태그를 가리킨 채 main 이 빨개진다 — 이 스크립트가 없애려던 바로 그 상태다 */
  if (BUMP && bad) die(`문제 ${bad}건 — 버전은 손도 안 댔다. 고치고 다시 실행해라`);

  if (BUMP) {
    console.log("\n버전 올리기");
    const libSrc = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8");
    const curMajor = (libSrc.match(/ScreenSpec v(\d+\.\d+)/) || [])[1];
    const toMajor = version.split(".").slice(0, 2).join(".");
    const curTag = [...docTags][0];
    if (!curMajor) die("screenspec.js 헤더에서 판 번호를 못 읽었다");
    if (docTags.size !== 1) die(`문서 CDN 태그가 여럿이다: ${JSON.stringify([...docTags])} — 먼저 하나로 맞춰라`);
    if (curMajor === toMajor && curTag === version) {
      ok(`이미 ${tag} 다 — 고칠 것 없음`);
    } else {
      /* 판의 «내용» 은 사람이 쓴다. 기계가 지어낼 수 없으므로, 안 적혀 있으면 여기서 멈춘다 */
      if (curTag === version) die(`문서는 이미 ${tag} 인데 라이브러리는 v${curMajor} 다 — 반만 올라간 상태다. 손으로 맞춰라`);
      const title = (changelog.split(/^## /m)[1] || "").split("\n")[0].trim();
      console.log(`  v${curMajor}/@v${curTag} → v${toMajor}/@v${version}`);
      console.log(`  판 이름: ${title}`);
      if (!APPLY) {
        ok("고칠 곳: screenspec.js 5 · README.md 1 · SKILL.md 1 (일곱 곳)");
        console.log("\n결과: --apply 를 붙이면 위대로 고치고 커밋·태그·푸시·퍼지·Release 까지 간다");
        process.exit(0);
      }
      const r = bumpFiles(curMajor, toMajor, curTag, version);
      if (r.errs.length) { r.errs.forEach(no); die("버전 문자열을 못 찾았다 — 아무것도 안 고쳤다면 그대로, 고친 게 있으면 git checkout 으로 되돌려라"); }
      r.done.forEach((d) => ok("고침 " + d));
      docTags = readDocTags();
      try { execSync("node tests/lint.js", { cwd: REPO, stdio: "pipe" }); ok("bump 후 lint 통과"); }
      catch (e) {
        /* 되돌려 놓고 죽는다 — 반쯤 고쳐진 파일을 남기면 다음 사람이 무엇이 원본인지 모른다.
           CHANGELOG 는 사람이 방금 쓴 글이라 건드리지 않는다 */
        try { execSync("git checkout -- screenspec.js README.md SKILL.md", { cwd: REPO }); } catch (e2) { /* 그대로 둔다 */ }
        die("bump 후 lint 실패 — 고친 일곱 곳을 되돌렸다. node tests/lint.js 로 확인해라");
      }
      git("add -A");
      execSync(`git commit -q -m ${JSON.stringify("release: " + tag + " — " + title.replace(/^v[\d.]+ \([^)]*\) — /, ""))}`, { cwd: REPO });
      ok(`커밋 ${git("rev-parse --short HEAD")}`);
      /* 여기서 커밋이 났으므로 아래 «원격에 태그 없음» 은 정상이다 */
    }
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
  if (!APPLY && !VERIFY) {
    console.log("\n이 판에 나갈 이슈 (닫는 것은 배포뿐이다 — #88)");
    shipped.length ? ok(shipped.map((n) => "#" + n).join(" ")) : ok("CHANGELOG 최상단에 이슈 번호가 없다");
  }
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

  /* ---- 7. GitHub Release — 본문은 CHANGELOG 그 절 그대로 ---- */
  console.log("\nGitHub Release");
  const notes = (changelog.split(/^## /m)[1] || "").split("\n").slice(1).join("\n").trim();
  const relUrl = `https://github.com/${GH_REPO}/releases/tag/${tag}`;
  let already = false;
  try { execSync(`gh release view ${tag}`, { cwd: REPO, stdio: "pipe" }); already = true; } catch (e) { /* 없다 = 정상 */ }
  if (already) ok(`${tag} Release 가 이미 있다 — 건드리지 않는다`);
  else {
    const at = path.join(REPO, ".release-notes.tmp.md");
    try {
      fs.writeFileSync(at, notes + "\n");
      execSync(`gh release create ${tag} --title ${JSON.stringify(tag)} --notes-file ${JSON.stringify(at)} --latest`,
        { cwd: REPO, stdio: "pipe" });
      ok(`${tag} Release 발행 (Latest)`);
    } catch (e) {
      no(`Release 발행 실패 — ${String((e.stderr || e.message || e)).trim().split("\n")[0]}`);
      console.log(`    손으로: gh release create ${tag} --title "${tag}" --notes-file <파일> --latest`);
    } finally { try { fs.unlinkSync(at); } catch (e) { /* 이미 없다 */ } }
  }

  /* ---- 8. 이 판에 나간 이슈를 닫고 보드를 옮긴다 (#88, PM 2026-09-01) ----
     PM: 「실제로 다 끝나고 닫는 방식이 좋겠다. 배포를 트리거로 잡자.」
     고친 순간 닫으면 PM 이 만져 볼 자리가 없다. «배포해 달라» 는 말이 곧 인수다.
     그러니 커밋 메시지는 fix #N 이 아니라 (#N) 이고, 닫는 일은 여기 한 곳에서만 일어난다 */
  console.log("\n이슈 정리");
  if (!shipped.length) ok("CHANGELOG 최상단에 이슈 번호가 없다 — 닫을 것 없음");
  for (const n of shipped) {
    let state = "";
    try { state = JSON.parse(execSync(`gh issue view ${n} --json state`, { cwd: REPO, stdio: "pipe" }).toString()).state; }
    catch (e) { no(`#${n} 을 못 찾았다 — CHANGELOG 의 번호가 맞는지 봐라`); continue; }
    if (state !== "OPEN") { ok(`#${n} 은 이미 닫혀 있다`); continue; }
    try {
      execSync(`gh issue close ${n} -c ${JSON.stringify(tag + " 로 나갔습니다. " + relUrl)}`, { cwd: REPO, stdio: "pipe" });
      ok(`#${n} 닫음`);
    } catch (e) { no(`#${n} 을 못 닫았다 — ${String(e.stderr || e.message || e).trim().split("\n")[0]}`); }
  }
  console.log("\n보드");
  try { execSync("node scripts/backlog-sync.js --apply", { cwd: REPO, stdio: "pipe" }); ok("노션 보드 반영 (닫힌 것은 완료 칸으로)"); }
  catch (e) { no("보드 반영 실패 — node scripts/backlog-sync.js --apply 로 따로 확인해라"); }

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

    /* 메타 API 가 아니라 «실물 파일» 로 잰다 — 사람에게 나가는 것은 파일이다 (2026-08-31 과 같은 이유) */
    const alias = await until("@0 재해석", async () => {
      const r = await fetchLib(CDN("0"));
      return r.status === 200 && r.ver === major ? r.ver : null;
    });
    alias ? ok(`@0 → v${alias} (실물 파일 헤더)`) : no(`@0 가 아직 v${major} 로 안 간다 — 퍼지 후 지연일 수 있다`);

    /* 문서가 시키는 주소가 진짜 열리는가 — 이 검사가 없어서 404 를 문서에 실을 뻔했다 */
    for (const t of docTags) {
      const r = await fetchLib(CDN("v" + t));
      r.status === 200 ? ok(`문서의 @v${t} 열림`) : no(`문서가 가리키는 @v${t} → HTTP ${r.status}`);
    }
  }
})();
