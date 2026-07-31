"""다국어 카탈로그의 '값' 미번역을 감시하는 회귀 테스트.

배경:
`apps/web/lib/i18n/*.ts`의 카탈로그는 `satisfies Record<SupportedLanguage, XCatalog>`로
선언되어 **키 누락은 TypeScript가 컴파일 시점에 차단**한다. 그러나 키가 존재하고 값만
한국어 원문 복사본으로 남아 있는 경우는 컴파일러가 통과시킨다.

또한 `test_multilingual_support_contract.py`의 한국어 리터럴 검사는 컴포넌트 `.tsx`만
대상으로 하므로, 카탈로그 파일 내부는 어떤 자동 검사도 감시하지 않는 공백이 있었다.
실제로 QA 라운드에서 `analysis.ts`의 도움말 5개 키가 한국어를 제외한 6개 언어 전부에서
한국어 원문으로 남아 있는 것이 이 공백을 통해 발견됐다
(`docs/testing/qa-multilingual-test-report-2026-07-30.md` 5.1절).

판정 규칙:
비한국어 값이 **ko 값과 문자열 단위로 완전히 동일하면서 한글을 포함**할 때만 위반으로 본다.
- 완전 동일 + 한글 → 번역하지 않고 복사한 것이 확실하다.
- 부분적으로 한글이 남은 경우는 위반으로 보지 않는다. 예를 들어
  `entity-list.ts`의 `uploadHeaderHelp`는 문장은 번역되어 있고(`"Use the header ..."`)
  백틱 안 한국어만 실제 CSV 파일이 요구하는 컬럼명이라 유지가 맞다.
이 규칙 덕분에 별도 예외 목록 없이 오탐 0으로 동작한다.

카탈로그는 파일마다 구조가 달라(중첩·스프레드·모듈 간 참조) 텍스트 파싱이 취약하므로,
Node와 저장소에 이미 설치된 TypeScript로 실제 로드해 비교한다. 두 도구가 없는 환경에서는
검사가 조용히 사라지지 않도록 명시적으로 실패한다.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest


ROOT_DIR = Path(__file__).resolve().parents[3]
WEB_DIR = ROOT_DIR / "apps" / "web"
I18N_DIR = WEB_DIR / "lib" / "i18n"
COMPONENTS_DIR = WEB_DIR / "components"

SUPPORTED_LANGUAGES = ("ko", "en", "zh-CN", "ja", "vi", "fr", "de")

# `@/` 별칭을 해석하며 카탈로그를 실제로 로드한 뒤,
# ko와 완전히 동일하면서 한글을 포함한 비한국어 값을 위반으로 수집한다.
_COLLECT_UNTRANSLATED_JS = r"""
const fs = require("fs");
const path = require("path");
const WEB = process.argv[1];
const ts = require(path.join(WEB, "node_modules", "typescript"));
const LANGS = ["ko", "en", "zh-CN", "ja", "vi", "fr", "de"];
const NON_KO = LANGS.filter((l) => l !== "ko");
const HANGUL = /[가-힣]/;

const cache = new Map();
function load(specifier) {
  let file = specifier;
  if (specifier.startsWith("@/")) file = path.join(WEB, specifier.slice(2));
  if (!file.endsWith(".ts")) file += ".ts";
  if (cache.has(file)) return cache.get(file);
  if (!fs.existsSync(file)) { cache.set(file, {}); return {}; }
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  new Function("exports", "module", "require", js)(mod.exports, mod, load);
  cache.set(file, mod.exports);
  return mod.exports;
}

function flatten(value, prefix, acc) {
  if (typeof value === "string") { acc[prefix] = value; return acc; }
  if (Array.isArray(value)) {
    value.forEach((item, i) => flatten(item, prefix + "[" + i + "]", acc));
    return acc;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? prefix + "." + k : k, acc);
  }
  return acc;
}

const violations = [];
const loadFailures = [];
let comparedStrings = 0;
let catalogCount = 0;

for (const name of fs.readdirSync(path.join(WEB, "lib", "i18n")).filter((f) => f.endsWith(".ts")).sort()) {
  let exported;
  try {
    exported = load(path.join(WEB, "lib", "i18n", name));
  } catch (error) {
    loadFailures.push(name + ": " + error.message);
    continue;
  }
  for (const [exportName, candidate] of Object.entries(exported)) {
    if (!candidate || typeof candidate !== "object") continue;
    if (!LANGS.every((l) => candidate[l] && typeof candidate[l] === "object")) continue;
    catalogCount += 1;
    const ko = flatten(candidate.ko, "", {});
    for (const lang of NON_KO) {
      const translated = flatten(candidate[lang], "", {});
      for (const [key, koValue] of Object.entries(ko)) {
        const value = translated[key];
        if (typeof value !== "string") continue;
        comparedStrings += 1;
        if (value === koValue && HANGUL.test(value)) {
          violations.push({ file: name, catalog: exportName, language: lang, key: key, value: value });
        }
      }
    }
  }
}

process.stdout.write(JSON.stringify({ violations, loadFailures, comparedStrings, catalogCount }));
"""


def _load_untranslated_report() -> dict:
    node = shutil.which("node")
    if node is None:
        pytest.fail("Node를 찾을 수 없어 카탈로그 로드 검사를 실행할 수 없습니다.")
    if not (WEB_DIR / "node_modules" / "typescript").is_dir():
        pytest.fail("apps/web에 typescript가 설치되지 않아 카탈로그 로드 검사를 실행할 수 없습니다.")

    completed = subprocess.run(
        [node, "-e", _COLLECT_UNTRANSLATED_JS, str(WEB_DIR)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=300,
    )
    assert completed.returncode == 0, f"카탈로그 로드 스크립트가 실패했습니다:\n{completed.stderr}"
    return json.loads(completed.stdout)


def test_locale_catalogs_load_without_error() -> None:
    """모든 카탈로그가 실제로 로드되어야 검사가 의미를 갖는다."""

    report = _load_untranslated_report()

    assert not report["loadFailures"], "카탈로그 로드 실패:\n" + "\n".join(report["loadFailures"])
    assert report["catalogCount"] > 0, "언어별 카탈로그를 하나도 찾지 못했습니다."
    assert report["comparedStrings"] > 0, "비교한 문자열이 없습니다."


def test_no_catalog_value_is_an_untranslated_korean_copy() -> None:
    """비한국어 값이 ko 값과 동일한 한국어 복사본으로 남아 있으면 안 된다."""

    report = _load_untranslated_report()
    violations = report["violations"]

    if violations:
        by_key: dict[str, list[str]] = {}
        for item in violations:
            by_key.setdefault(f"{item['file']}::{item['catalog']}::{item['key']}", []).append(item["language"])
        lines = [
            f"  {key} → {', '.join(sorted(languages))}"
            for key, languages in sorted(by_key.items())
        ]
        pytest.fail(
            "번역되지 않은 한국어 원문이 비한국어 카탈로그에 남아 있습니다 "
            f"({len(violations)}개 문자열 / {len(by_key)}개 키):\n" + "\n".join(lines)
        )


def test_supported_language_list_matches_frontend_definition() -> None:
    """검사 대상 언어 목록이 프론트엔드 정의와 어긋나면 검사가 조용히 축소된다."""

    source = (WEB_DIR / "lib" / "language.ts").read_text(encoding="utf-8")
    declared = re.findall(r'code:\s*"([^"]+)"', source)

    assert tuple(declared) == SUPPORTED_LANGUAGES, (
        f"language.ts의 지원 언어가 변경되었습니다: {declared}. "
        "이 테스트와 Node 스크립트의 언어 목록을 함께 갱신하세요."
    )


# ---------------------------------------------------------------------------
# 컴포넌트 전체 스윕
#
# test_multilingual_support_contract.py는 컴포넌트 14개만 하드코딩 목록으로 검사한다.
# 신규 컴포넌트가 자동으로 감시되지 않는 공백을 메우기 위해 전체를 스윕한다.
# ---------------------------------------------------------------------------

# 화면에 한국어로 남는 것이 올바른 리터럴. 실제 파일 형식이 한국어 컬럼명을 요구한다.
ALLOWED_KOREAN_LITERAL_LINES = {
    # evaluation-page.tsx: CSV 업로드 형식 예시를 <code>로 그대로 보여준다.
    "evaluation-page.tsx": (
        "<code>문장,정답 의도</code>",
        "<code>사람이랑 통화할래요,상담사 전환 요청</code>",
        "<code>결과: 문장,정답 의도,예측 의도,점수,후보 의도1,점수,후보 의도2,점수,후보 의도3,점수,Feature,결과</code>",
    ),
}

_ATTRIBUTE_LITERAL = re.compile(
    r'(?:title|description|help|placeholder|aria-label|label)="[^"]*[가-힣][^"]*"'
)
_CHILD_LITERAL = re.compile(r">[^<>{\n]*[가-힣][^<>{\n]*<")


def test_no_component_renders_hardcoded_korean_outside_the_locale_catalog() -> None:
    """모든 컴포넌트의 사용자 노출 문자열은 카탈로그를 경유해야 한다."""

    violations: list[str] = []
    for path in sorted(COMPONENTS_DIR.glob("*.tsx")):
        allowed = ALLOWED_KOREAN_LITERAL_LINES.get(path.name, ())
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            stripped = line.strip()
            if any(exception in stripped for exception in allowed):
                continue
            if _ATTRIBUTE_LITERAL.search(line) or _CHILD_LITERAL.search(line):
                violations.append(f"  {path.name}:{line_number}: {stripped}")

    assert not violations, (
        "카탈로그를 경유하지 않는 한국어 UI 리터럴이 있습니다. 번역이 필요하면 카탈로그로 옮기고, "
        "파일 형식 예시처럼 한국어 유지가 맞다면 ALLOWED_KOREAN_LITERAL_LINES에 근거와 함께 추가하세요:\n"
        + "\n".join(violations)
    )
