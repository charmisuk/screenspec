/*
 * 인라인 빌드 — 프로토타입 HTML 안에 screenspec.js 를 통째로 넣어 자체 완결 파일로 만든다.
 *
 *   node scripts/inline.js <프로토타입.html> [-o 출력.html]
 *
 * 왜 필요한가: 클로드 아티팩트 같은 미리보기 환경은 바깥 주소(CDN)로의 요청을 막는다.
 * 그런 곳에 올릴 결과물은 라이브러리가 파일 안에 들어 있어야 동작한다.
 * 이 스크립트는 파일을 이어붙이므로 AI가 6만 자를 직접 타이핑할 필요가 없다.
 *
 * 원본은 건드리지 않고 새 파일(<이름>.inline.html)을 만든다. 실행 후 자동 검증한다.
 */
const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const LIB_PATH = path.join(REPO, "screenspec.js");
const CLOSE = "</scr" + "ipt>"; /* 이 파일 자체가 인라인될 때를 대비해 분리 */

function die(msg) { console.error("✗ " + msg); process.exit(1); }

const args = process.argv.slice(2).filter((a) => a !== "--apply");
const oIdx = args.indexOf("-o");
const outArg = oIdx >= 0 ? args[oIdx + 1] : null;
const input = args.filter((a, i) => oIdx < 0 || (i !== oIdx && i !== oIdx + 1))[0];

if (!input) {
  console.log("사용법: node scripts/inline.js <프로토타입.html> [-o 출력.html]");
  process.exit(0);
}
if (!fs.existsSync(input)) die("파일이 없다: " + input);
if (!fs.existsSync(LIB_PATH)) die("screenspec.js 를 찾을 수 없다: " + LIB_PATH);

const lib = fs.readFileSync(LIB_PATH, "utf8");
if (lib.includes(CLOSE)) die("라이브러리에 스크립트 종료 태그가 있어 인라인할 수 없다");

let html = fs.readFileSync(input, "utf8");

/* screenspec.js 를 가리키는 스크립트 태그 찾기 — CDN·상대경로 모두 */
const TAG = /<script[^>]+src=["'][^"']*screenspec(?:\.min)?\.js[^"']*["'][^>]*><\/script>/i;
if (!TAG.test(html)) {
  die("screenspec.js 를 불러오는 <script> 태그를 찾지 못했다.\n" +
      "  먼저 프로토타입에 <script src=\"...screenspec.js\"></script> 를 넣어라.");
}

const before = html.match(TAG)[0];
html = html.replace(TAG, () => "<script>\n" + lib + "\n" + CLOSE);

const out = outArg || input.replace(/\.html?$/i, "") + ".inline.html";
fs.writeFileSync(out, html);

/* ---- 실행 후 자동 검증 ---- */
const check = fs.readFileSync(out, "utf8");
const problems = [];
if (!check.includes("__SCREENSPEC_BOOTED__")) problems.push("라이브러리 본문이 들어가지 않았다");
if (/<script[^>]+src=["']https?:\/\/[^"']*screenspec/i.test(check)) problems.push("바깥 주소를 가리키는 태그가 남아 있다");
if (check.length < lib.length) problems.push("출력이 라이브러리보다 작다");
if (problems.length) die("검증 실패:\n  - " + problems.join("\n  - "));

console.log("입력 : " + input);
console.log("치환 : " + before.slice(0, 72) + (before.length > 72 ? "…" : ""));
console.log("출력 : " + out + "  (" + Math.round(check.length / 1024) + "KB)");
console.log("\n검증 통과 — 바깥에 요청을 보내지 않으므로 미리보기 환경에서도 동작한다.");
