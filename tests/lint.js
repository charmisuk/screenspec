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
  const STALE = /커맨드 팔레트|브레드크럼|섹션 라벨|centerOf|ss-toc-(sec|crumb|main)|private이므로|SpecLayer(?![^\n]*(별칭|alias|호환|legacy))/g;
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

console.log("\nlint 결과: " + (fail ? "FAIL " + fail + "건" : "전부 통과"));
process.exit(fail ? 1 : 0);
