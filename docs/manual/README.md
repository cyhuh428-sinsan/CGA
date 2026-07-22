# CGA 메뉴얼

CGA 메뉴얼은 사용 목적에 따라 다음 세 문서로 나누어 작성합니다.

## 어떤 문서를 읽을까요?

| 문서 | 대상 | 목적 |
|---|---|---|
| [CGA Getting Started](cga-getting-started/README.md) | 처음 사용하는 사용자 | 봇 생성 화면을 이해하고 첫 테스트를 준비합니다. |
| [CGA 사용자 설명서](cga-user-manual/README.md) | 일반 사용자·봇 운영자·시스템 관리자 | 봇·버전·대화 설계·테스트·관리자 메뉴의 전체 흐름을 확인합니다. |
| [CGA NLU 활용 가이드](cga-nlu-guide/README.md) | 봇·대화 설계 운영자·AI/NLU 담당자 | ML·Semantic·LLM 엔진의 선택·데이터 준비·품질 개선 방법을 확인합니다. |

## 권장 읽기 순서

1. 처음 사용하는 경우 [CGA Getting Started](cga-getting-started/README.md)에서 기본 흐름을 확인합니다.
2. 메뉴와 운영 절차가 필요하면 [CGA 사용자 설명서](cga-user-manual/README.md)를 확인합니다.
3. 엔진 선택이나 학습·검색·생성 품질을 다룰 때는 [CGA NLU 활용 가이드](cga-nlu-guide/README.md)를 확인합니다.
4. 기능의 확인 수준이 필요한 경우 [기능 검증표](cga-manual-verification-matrix.md)를 확인합니다.

## 문서 작성 기준

- CGA 화면과 소스에서 확인된 명칭을 우선 사용합니다.
- 참고자료에만 있고 CGA에서 확인되지 않은 기능은 운영 확정 기능처럼 표현하지 않습니다.
- 실제 생성·저장·학습·인덱싱·모델 호출 결과가 확인되지 않은 항목은 검증표에서 별도로 표시합니다.
- 사용자는 DB나 CLI를 직접 조작하지 않고 화면의 상태·오류·대상 정보를 기준으로 운영 담당자에게 전달합니다.

문서의 현재 확인 수준과 남은 검증 영역은 [기능 검증표](cga-manual-verification-matrix.md)에서 관리합니다.

## Word 문서

현재 Markdown 본문을 기준으로 생성한 Word 문서입니다.

- [CGA 사용자 설명서.docx](dist/CGA%20사용자%20설명서.docx)
- [CGA Getting Started.docx](dist/CGA%20Getting%20Started.docx)
- [CGA NLU 활용 가이드.docx](dist/CGA%20NLU%20활용%20가이드.docx)

Word 문서는 `build_manual_docx.py`로 다시 생성할 수 있습니다. 이 환경에서는 LibreOffice PDF 변환이 완료되지 않아 페이지 이미지 시각 검증은 보류 상태입니다.

## PDF 문서

화면 도움말에서 제공하는 최종 PDF 원본입니다.

- [CGA 사용자 설명서.pdf](CGA%20사용자%20설명서.pdf) - 카카오톡 채널 연결 절차 포함
- [CGA NLU 활용 가이드.pdf](CGA%20NLU%20활용%20가이드.pdf)

운영 Web은 위 원본과 동일한 파일을 `apps/web/public/manuals/`에 배치하여 `/manuals/cga-user-manual.pdf`, `/manuals/cga-nlu-guide.pdf` 경로로 제공합니다.
