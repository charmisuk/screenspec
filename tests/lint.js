/*
 * ScreenSpec lint — 반복 사고를 기계로 막는 하드 게이트
 * 실행: node tests/lint.js  (의존성 없음)
 *
 * 잡는 것 (전부 실제로 겪은 사고·드리프트 기반):
 *  1) screenspec.js 문법 오류
 *  2) NUL 등 제어 바이트 오염 (2026-08-22 치환 사고)
 *  3) 버전 문자열 드리프트 — 헤더 주석 ↔ 워터마크 배지 ↔ 문서 CDN 태그
 *  4) 예제의 specs target ↔ data-spec 속성 정합 (마커 누락 예방)
 *  5) LICENSE 존재
 *  9) 코드가 읽는 설정 필드·anno·속성·API가 docs/config.md에 전부 있는지 (코드→문서 드리프트)
 * 10) 에이전트 진입점(AGENTS.md·llms.txt) 존재 + README 링크
 * 11) README 빠른 시작이 복붙 가능한 완성 HTML인지
 * 12) 코드가 가리키는 README 앵커가 실존하는지
 * 13) 라이브러리 헤더에 저작권·MIT 표기 (인라인 배포 시 LICENSE가 따라가지 않으므로)
 * 14) lint 자기 검증 — 추출기가 빈 배열을 돌려주면 검사가 조용히 통과한다. 추출 결과 최소 개수를 강제 (2026-08-24 회고)
 * 15) Screen·Spec 레벨 필드(route·root·anno·play…)도 docs/config.md 에 있는지 — RAW.x 만 보던 구멍
 * 16) console.info 부팅 로그 버전·CHANGELOG 최상단 버전 = 헤더 버전 (2026-08-24 수동 bump 때 놓칠 뻔)
 * 17) Part 타입 필드 = Spec 필드 − {n, parts} — 하위 요소는 같은 파이프라인을 쓰므로 필드가 같다.
       코드는 되는데 문서에만 없어 사용자가 못 찾는 드리프트를 막는다 (2026-08-24 #28: Part.optional 누락)
 *  6) 문서 드리프트 — 폐기된 설계 용어·클래스명이 README/SKILL/라이브러리에 남아 있으면 FAIL (CHANGELOG 제외)
 *  7) README 예제 목록 ↔ examples/*.html 파일 정합, README가 참조하는 이미지 파일 존재
 *  8) 하드코딩된 e2e 케이스 수("N케이스") 금지 — 숫자는 실행 결과로만 (2026-08-22 19↔35 드리프트)
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
let fail = 0;
function check(name, ok, detail) {
  if (ok) console.log("  PASS", name);
  else { fail++; console.log("  FAIL", name, detail !== undefined ? "→ " + detail : ""); }
}

/* 1) 문법 */
try {
  execFileSync(process.execPath, ["--check", path.join(REPO, "screenspec.js")], { stdio: "pipe" });
  check("screenspec.js 문법", true);
} catch (e) {
  check("screenspec.js 문법", false, String(e.stderr || e.message).slice(0, 200));
}

/* 2) 제어 바이트 */
{
  const buf = fs.readFileSync(path.join(REPO, "screenspec.js"));
  let bad = 0;
  for (const b of buf) if (b < 9 || (b > 13 && b < 32)) bad++;
  check("제어 바이트 오염 없음", bad === 0, bad + "개 발견");
}

/* 3) 버전 정합 */
{
  const lib = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8");
  const header = (lib.match(/ScreenSpec v(\d+\.\d+)/) || [])[1];
  const badges = [...lib.matchAll(/ScreenSpec<\/a> · v(\d+\.\d+)/g)].map((m) => m[1]);
  check("헤더 버전 존재", !!header, "주석에서 'ScreenSpec vX.Y'를 찾지 못함");
  check("배지 버전 = 헤더 버전 (" + header + ")", badges.length > 0 && badges.every((v) => v === header), JSON.stringify(badges));
  const docTags = [];
  for (const f of ["README.md", "SKILL.md"]) {
    const d = fs.readFileSync(path.join(REPO, f), "utf8");
    [...d.matchAll(/@v(\d+\.\d+\.\d+)/g)].forEach((m) => docTags.push(f + ":" + m[1]));
  }
  const uniq = [...new Set(docTags.map((t) => t.split(":")[1]))];
  check("문서 CDN 태그 단일 (" + (uniq[0] || "?") + ")", uniq.length === 1, JSON.stringify(docTags));
  check("문서 태그 = 헤더 버전 계열", uniq.length === 1 && uniq[0].startsWith(header + "."), uniq[0] + " vs v" + header);
  /* 16) 부팅 로그·CHANGELOG 도 같은 버전 */
  const infos = [...new Set([...lib.matchAll(/\[ScreenSpec v(\d+\.\d+)\]/g)].map((m) => m[1]))];
  check("console.info 버전 = 헤더 버전", infos.length === 1 && infos[0] === header, JSON.stringify(infos));
  const clTop = (fs.readFileSync(path.join(REPO, "CHANGELOG.md"), "utf8").match(/^## v(\d+\.\d+\.\d+)/m) || [])[1];
  check("CHANGELOG 최상단 = 문서 CDN 태그 (" + clTop + ")", !!clTop && uniq[0] === clTop, clTop + " vs " + uniq[0]);
}

/* 4) 예제 target ↔ data-spec 정합 */
{
  const dir = path.join(REPO, "examples");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".html"))) {
    const d = fs.readFileSync(path.join(dir, f), "utf8");
    const attrs = new Set([...d.matchAll(/data-spec="([^"]+)"/g)].map((m) => m[1]));
    const targets = [...d.matchAll(/target:\s*"([^"]+)"/g)].map((m) => m[1]);
    const missing = targets.filter((t) => !attrs.has(t));
    check("examples/" + f + " target 정합", missing.length === 0, "data-spec 없는 target: " + JSON.stringify(missing));
  }
}

/* 5) 액센트 묶음 무결성 — 액센트 계열 하드코딩 금지 (프리셋 정의부만 허용) */
{
  const lib = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8")
    .replace(/const ACCENT_PRESETS = \{[\s\S]*?\};/, "");
  const hard = lib.match(/#2952E3|#1E3FC4|41,\s*82,\s*227/gi) || [];
  check("액센트 하드코딩 없음 (토큰·color-mix만)", hard.length === 0, hard.length + "곳 발견");
}

/* 6) LICENSE */
check("LICENSE 존재", fs.existsSync(path.join(REPO, "LICENSE")));

/* 7) 문서 드리프트 — 폐기된 설계의 용어·클래스가 살아 있으면 에이전트가 옛 구조를 믿는다 */
{
  const STALE = /커맨드 팔레트|브레드크럼|섹션 라벨|centerOf|ss-toc-(sec|crumb|main)|private이므로|panel:\s*"left"(?![^\n]*(폐기|deprecated))|상위 \d+ · 하위|패널 ⇄|SpecLayer(?![^\n]*(별칭|alias|호환|legacy))/g;
  for (const f of ["README.md", "SKILL.md", "screenspec.js"]) {
    const d = fs.readFileSync(path.join(REPO, f), "utf8");
    const hits = [...d.matchAll(STALE)].map((m) => m[0]);
    check(f + " 폐기 용어 없음", hits.length === 0, JSON.stringify([...new Set(hits)]));
  }
}

/* 8) README 예제 목록 ↔ examples/ 파일, 참조 이미지 존재 */
{
  const md = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const files = fs.readdirSync(path.join(REPO, "examples")).filter((x) => x.endsWith(".html") && !x.startsWith("_"));
  const missingInReadme = files.filter((f) => !md.includes("examples/" + f));
  check("README 예제 목록 = examples/ 전수", missingInReadme.length === 0, "README에 없는 예제: " + JSON.stringify(missingInReadme));
  const imgs = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]).filter((p) => !/^https?:/.test(p));
  const missingImg = imgs.filter((p) => !fs.existsSync(path.join(REPO, p)));
  check("README 참조 이미지 존재", missingImg.length === 0, JSON.stringify(missingImg));
}

/* 9) 케이스 수 하드코딩 금지 */
{
  for (const f of ["README.md", ".github/workflows/ci.yml", "SKILL.md"]) {
    const d = fs.readFileSync(path.join(REPO, f), "utf8");
    const hits = d.match(/\d+\s*케이스/g) || [];
    check(f + " 케이스 수 하드코딩 없음", hits.length === 0, JSON.stringify(hits));
  }
}


/* 9) 설정 필드 커버리지 — 코드가 읽는 설정이 레퍼런스에 없으면 FAIL
   (2026-08-22: devices·widths가 어느 문서에도 없던 사고) */
{
  const lib = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8");
  const ref = fs.readFileSync(path.join(REPO, "docs/config.md"), "utf8");
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");

  const fields = [...new Set([...lib.matchAll(/\bRAW\.([a-zA-Z]+)/g)].map((m) => m[1]))];
  check("설정 필드 추출기 동작 (≥6개)", fields.length >= 6, JSON.stringify(fields)); /* 14) 빈손 통과 방지 */
  const undoc = fields.filter((f) => !new RegExp("\\b" + f + "\\b").test(ref));
  check("설정 필드 " + fields.length + "개 전부 docs/config.md에 문서화", undoc.length === 0, "누락: " + JSON.stringify(undoc));

  /* 15) Screen·Spec 레벨 필드 — 코드가 읽는 s.xxx / sc.xxx 가 레퍼런스에 없으면 FAIL */
  const SKIP = new Set(["length", "forEach", "map", "filter", "find", "some", "every", "push", "join", "slice", "indexOf", "replace", "match", "test", "trim", "toLowerCase", "includes", "style", "classList", "dataset", "root", "getClientRects", "getBoundingClientRect", "querySelector", "querySelectorAll", "textContent", "children", "byKey", "screen", "label", "mech"]);
  const objFields = [...new Set([...lib.matchAll(/\b(?:s|sc|spec|next|o|x|current|cur|sc2)\.([a-zA-Z]+)\b/g)].map((m) => m[1]))]
    .filter((f) => !SKIP.has(f) && !f.startsWith("_"));
  check("Screen·Spec 필드 추출기 동작 (≥10개)", objFields.length >= 10, JSON.stringify(objFields));
  const undocObj = objFields.filter((f) => !ref.includes("`" + f + "`") && !new RegExp("^\\s*" + f + "\\??:", "m").test(ref));
  check("Screen·Spec 필드 " + objFields.length + "개 전부 docs/config.md에 문서화", undocObj.length === 0, "누락: " + JSON.stringify(undocObj));

  const annos = [...new Set([...lib.matchAll(/^ {4}(\w+): +\{ label:/gm)].map((m) => m[1]))];
  check("anno 레지스트리 8종 추출", annos.length === 8, JSON.stringify(annos));
  [["README.md", readme], ["docs/config.md", ref]].forEach(([name, doc]) => {
    const miss = annos.filter((a) => !doc.includes("`" + a + "`"));
    check(name + " anno 표 정합", miss.length === 0, "누락: " + JSON.stringify(miss));
  });

  const attrs = [...new Set([...lib.matchAll(/data-ss-[a-z]+|data-spec/g)].map((m) => m[0]))];
  check("HTML 속성 추출기 동작 (data-spec 포함)", attrs.includes("data-spec"), JSON.stringify(attrs));
  const missAttr = attrs.filter((a) => !ref.includes(a));
  check("HTML 속성 전부 문서화", missAttr.length === 0, "누락: " + JSON.stringify(missAttr));

  const api = [...new Set([...lib.matchAll(/window\.ScreenSpec = \{([^}]+)\}/g)]
    .flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((x) => x[1])))];
  check("공개 API 추출기 동작 (≥4개)", api.length >= 4, JSON.stringify(api));
  const missApi = api.filter((a) => !ref.includes(a));
  check("공개 API 전부 문서화", missApi.length === 0, "누락: " + JSON.stringify(missApi));
}

/* 17) Part 필드 커버리지 — Spec 과 같은 필드를 쓰는데 문서에만 빠지면 사용자가 못 찾는다 (#28) */
{
  const ref = fs.readFileSync(path.join(REPO, "docs/config.md"), "utf8");
  const block = (name) => (ref.match(new RegExp("type " + name + " = \\{([\\s\\S]*?)\\n\\}")) || [])[1] || "";
  const names = (b) => [...b.matchAll(/^\s{2,}(\w+)\??:/gm)].map((m) => m[1]);
  const spec = names(block("Spec")), part = names(block("Part"));
  check("Spec·Part 타입 블록 추출 (각 ≥ 5개)", spec.length >= 5 && part.length >= 5, JSON.stringify([spec, part]));
  const want = spec.filter((f) => f !== "n" && f !== "parts");
  const missType = want.filter((f) => !part.includes(f));
  check("Part 타입에 Spec 필드 전부 (" + want.length + "개)", missType.length === 0, "누락: " + JSON.stringify(missType));
  const sec = (ref.split(/\r?\n### Part\r?\n/)[1] || "").split(/\r?\n## /)[0];
  check("### Part 절 존재", sec.length > 100, String(sec.length));
  const missRow = want.filter((f) => !sec.includes("`" + f + "`"));
  check("### Part 표에 Spec 필드 전부", missRow.length === 0, "누락: " + JSON.stringify(missRow));
}

/* 10) 에이전트 진입점 — 없으면 에이전트가 SKILL.md를 못 찾는다 */
{
  ["AGENTS.md", "llms.txt", "SKILL.md", "docs/config.md"].forEach((f) =>
    check(f + " 존재", fs.existsSync(path.join(REPO, f))));
  const llms = fs.readFileSync(path.join(REPO, "llms.txt"), "utf8");
  check("llms.txt가 SKILL·레퍼런스를 가리킴", llms.includes("SKILL.md") && llms.includes("config.md"));
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const missLink = ["SKILL.md", "docs/config.md", "AGENTS.md", "llms.txt"].filter((l) => !readme.includes(l));
  check("README가 하위 문서 전부 링크", missLink.length === 0, "누락: " + JSON.stringify(missLink));
}

/* 11) README 빠른 시작 = 복붙 가능한 완성 HTML (조각이면 FAIL) */
{
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const m = readme.match(/```html\r?\n([\s\S]*?)```/);
  const block = m ? m[1] : "";
  const ok = /<!doctype html>/i.test(block) && block.includes("window.SCREENSPEC") &&
    block.includes("screenspec.js") && /data-spec="1"/.test(block);
  check("README 빠른 시작 = 완성 HTML", ok, "doctype·설정·스크립트·data-spec 중 누락");
}

/* 12) 코드가 가리키는 README 앵커가 실제로 존재하는지 (안내 카드의 "복붙용 최소 예제" 링크) */
{
  const lib = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8");
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N} -]/gu, "").replace(/ +/g, "-");
  const anchors = [...readme.matchAll(/^#{2,3} +(.+)$/gm)].map((m) => slug(m[1]));
  const links = [...lib.matchAll(/screenspec#([^"\s]+)/g)].map((m) => decodeURIComponent(m[1]));
  const dead = links.filter((a) => !anchors.includes(a));
  check("코드→README 앵커 유효", dead.length === 0, "없는 앵커: " + JSON.stringify(dead) + " / 있는 앵커: " + JSON.stringify(anchors));
}

/* 13) 라이브러리 파일 안의 라이선스 표기 — 인라인으로 배포되면 LICENSE 파일이 따라가지 않는다 */
{
  const head = fs.readFileSync(path.join(REPO, "screenspec.js"), "utf8").slice(0, 600);
  const hasCopyright = /Copyright \(c\)/i.test(head);
  const hasMit = /MIT/.test(head);
  check("라이브러리 헤더에 저작권 표기", hasCopyright);
  check("라이브러리 헤더에 MIT 표기", hasMit);

  /* LICENSE 파일의 저작권자와 헤더의 저작권자가 같아야 한다 */
  const lic = fs.readFileSync(path.join(REPO, "LICENSE"), "utf8");
  const who = (s) => ((s.match(/Copyright \(c\)\s*\d{4}\s*([^\n·]+)/i) || [])[1] || "").trim();
  check("저작권자 = LICENSE와 동일 (" + who(lic) + ")", who(head) === who(lic), who(head) + " vs " + who(lic));
}

console.log("\nlint 결과: " + (fail ? "FAIL " + fail + "건" : "전부 통과"));
process.exit(fail ? 1 : 0);
