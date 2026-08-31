/*
 * QA 하네스 — 손으로 눌러 봐야 아는 것을 «한 파일» 에서 본다.
 *
 *   node scripts/qa.js            뽑기만  (tests/qa/qa.html → _qa/qa.html)
 *   node scripts/qa.js --open     뽑고 브라우저로 열기
 *
 * 왜 한 파일인가 (PM 2026-08-31):
 *   고칠 때마다 QA 파일을 새로 뽑아 탭을 여러 개 열면 쌓이지 않고, 어제 무엇을 봤는지도 안 남는다.
 *   ScreenSpec 자체가 다중 화면 도구이므로 «QA 시나리오 하나 = 화면 하나» 로 두고 목차에서 옮겨 다닌다.
 *
 * 어디에 무엇이 있나:
 *   tests/qa/qa.html   원본 — 저장소가 추적한다. 이슈를 고치면 여기에 확인 항목을 «더한다»
 *   _qa/qa.html        빌드 산출물 — gitignore. 라이브러리를 고칠 때마다 이 스크립트로 다시 뽑는다
 *
 * QA 절차는 그 화면의 정의서에 적혀 있다 — 오른쪽 패널이 곧 체크리스트다.
 * 자동저장·파일 고르기는 file:// 로 열어야 보이므로 인라인(자체 완결)으로 뽑는다.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const SRC = path.join(REPO, "tests", "qa", "qa.html");
const OUT_DIR = path.join(REPO, "_qa");
const OUT = path.join(OUT_DIR, "qa.html");

if (!fs.existsSync(SRC)) { console.error("✗ 원본이 없다: tests/qa/qa.html"); process.exit(1); }
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

execFileSync(process.execPath, [path.join(REPO, "scripts", "inline.js"), SRC, "-o", OUT], { stdio: "inherit" });

/* 화면 몇 개짜리인지 세어 둔다 — 화면을 더했는데 안 늘면 원본을 안 고친 것이다 */
const html = fs.readFileSync(OUT, "utf8");
const screens = (html.match(/id:\s*"QA-\d+-[A-Z]+"/g) || []).length;
console.log("\nQA 화면 " + screens + "개 · " + OUT.replace(REPO + path.sep, ""));
console.log("절차는 각 화면의 오른쪽 패널에 있다. 목차(왼쪽 위 화면 ID)로 옮겨 다닌다.");

if (process.argv.includes("--open")) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const args = process.platform === "darwin" ? ["-a", "Google Chrome", OUT] : [OUT];
  try { execFileSync(cmd, args, { stdio: "ignore", shell: process.platform === "win32" }); console.log("브라우저로 열었다 (자동저장은 크롬·엣지에서만 된다)"); }
  catch (e) { console.log("직접 열어라: " + OUT); }
}
