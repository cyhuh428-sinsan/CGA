# Aidot 상호 업로드·다운로드 호환 계약

## 1. 목적과 기준

CGA는 Aidot의 화면 복제품이 아니라 Aidot 자산을 가져와 편집하고 다시 Aidot으로 돌려보낼 수 있는 운영 도구여야 한다.
외부 파일 형식의 기준은 `D:\Project\cga\Aidot\docs\asset-import-export-format.md`이며, CGA 내부 JSON 구조는 외부 Aidot 형식을 임의로 바꾸는 근거가 될 수 없다.

WebChat은 CGA와 Aidot 모두 사용하지 않으므로 이 계약과 구현 범위에서 제외한다.

## 2. 호환성 등급

- `무손실 왕복`: 가져온 파일을 편집하지 않고 다시 내보내면 JSON 의미와 미확인 필드가 보존된다.
- `편집 왕복`: CGA에서 수정한 알려진 필드가 Aidot 필드로 반영되고, 알 수 없는 필드는 유지된다.
- `운영 동등`: Aidot에서 다시 업로드·학습·실행한 결과가 동일하다. 실제 Aidot 샘플과 Aidot 실행 검증이 끝나야 확정할 수 있다.

현재 구현은 전체 봇 패키지의 `무손실 왕복`과 알려진 자산의 1차 `편집 왕복`을 목표로 한다. `운영 동등`은 아직 확정하지 않는다.

## 3. 고정 원칙

1. Aidot 전체 봇 JSON의 최상위 키와 알 수 없는 추가 필드를 삭제하지 않는다.
2. `Dictionary`, `Entity`, `Intent`는 서로 다른 자산으로 유지한다.
3. TXT 업로드는 기존 자산을 지우지 않는 병합 방식으로 처리한다.
4. JSON 업로드는 해당 JSON 자산의 교체 방식으로 처리한다.
5. CGA 내부 버전 백업(`aidot-version-package-v1`)과 Aidot 전체 봇 패키지는 서로 다른 파일 형식으로 유지한다.
6. 운영 버전에는 파일을 직접 덮어쓰지 않는다.
7. 출처가 확인되지 않은 AI 엔진 값이나 `messageDigest`를 임의로 생성하지 않는다.
8. 변경된 Aidot 패키지의 digest 계산 규칙을 모르면 기존 digest를 재사용하지 않고 빈 값으로 내보낸다.

## 4. 전체 봇 패키지 계약

Aidot 최상위 키:

- `AIDOTAssistantVersion`
- `messageDigest`
- `botVo`
- `licenseVo`
- `botSystemConfigVoList`
- `dialogList`
- `dialogFlowGraphList`
- `entityTypeList`
- `faqDialogList`
- `floatingButtonVoList`
- `ruleVoList`
- `smallTalkVoList`
- `dictionaryVoList`
- `blacklistList`

CGA 내부 매핑:

| Aidot | CGA 버전 문서 | 처리 |
| --- | --- | --- |
| `dialogList` | `dialogs` | `dialogId`, `dialogType`, `displayName` 매핑 및 원본 보존 |
| `dialogFlowGraphList` | `dialog_flow_graphs` | JSON 배열 보존 |
| `entityTypeList` | `entities` | 개체명으로 묶고 값/유형/상세를 행으로 매핑 |
| `dictionaryVoList` | `dictionary` | 대표어와 동의어 매핑 |
| `faqDialogList` | `faq_dialogs` | 원본 필드 보존 |
| `floatingButtonVoList` | `floating_buttons` | 원본 필드 보존 |
| `ruleVoList` | `rules` | 알려진 필드 별칭 매핑 및 원본 보존 |
| `smallTalkVoList` | `small_talk` | 원본 필드 보존 |
| `blacklistList` | `blacklists` | 알려진 필드 별칭 매핑 및 원본 보존 |
| `botSystemConfigVoList` | `system_config.aidot_bot_system_config` | 배열 원형 보존 |
| `botVo`, `licenseVo`, 미확인 최상위 필드 | `_aidot_package_compatibility.source_package` | 왕복용 원본 보존 |

API:

- `GET /api/v1/bots/{bot_id}/versions/{version_id}/aidot-package`
- `POST /api/v1/bots/{bot_id}/versions/{version_id}/aidot-package`

POST는 Aidot 자산을 교체하지만 Aidot 전체 봇 패키지에 포함되지 않는 CGA API 자산과 CGA 운영 설정은 보존한다.

## 5. 자산별 구현 현황

| 자산 | Aidot 파일 | 현재 상태 | 다음 검증 |
| --- | --- | --- | --- |
| 전체 봇 | JSON | API·화면 업로드/다운로드 1차 구현 | 실제 Aidot 전체 봇 샘플 |
| CGA 내부 버전 백업 | JSON | 기존 기능 유지 | 기존 회귀 테스트 |
| 개체 | TXT | 헤더 및 병합 구현 | S/P 공식 명칭과 다중 상세 샘플 |
| 동의어 사전 | TXT | 두 헤더 형식 및 병합 구현 | 다중 동의어 실제 샘플 |
| Blocklist | TXT | 헤더·다운로드·동일 이름 병합/갱신 구현 | 실제 Aidot 유형 전체 값 |
| Rule | TXT | 헤더·다운로드·동일 이름 병합/갱신 구현 | 연결 대상 참조 검증 |
| 의도 발화문 | TXT | 헤더 유무·T/V 업로드/다운로드 구현 | T/V 공식 명칭 확인 |
| 대화모듈/의도 | JSON | CGA 내부 그래프 JSON만 구현, Aidot FlowDesign 형식 미완료 | 실제 FlowDesign 샘플과 참조 ID 재매핑 규칙 |
| API 정의 | JSON | 기본 import/export 구현 | 실제 Aidot API JSON 스키마, replace 규칙 |

## 6. 검증 기준

전체 봇 패키지는 최소한 다음을 자동 검증한다.

1. `botVo`와 Aidot 자산 목록이 없는 JSON은 거부한다.
2. 수정하지 않은 패키지는 원본과 동일하게 왕복한다.
3. 알려진 자산을 수정해도 미확인 최상위 필드, `botVo`, 자산별 추가 필드가 보존된다.
4. 패키지가 변경되면 확인되지 않은 기존 `messageDigest`를 재사용하지 않는다.
5. 운영 버전 덮어쓰기는 거부한다.
6. WebChat 파일과 경로는 읽거나 쓰지 않는다.

## 7. 아직 확정하지 않은 부분

- `messageDigest` 공식 계산 알고리즘
- 대화모듈 `Jump.targetDialogId` 등 참조 ID 재매핑 규칙
- 의도 발화문 T/V의 공식 명칭과 전체 허용값
- Entity S/P의 공식 명칭과 상세 컬럼의 다중 값 규칙
- API JSON의 정확한 최상위 키와 필수 필드
- Aidot에서 실제 재업로드·학습·실행까지의 운영 동등성

이 항목은 추측으로 구현하지 않고 실제 Aidot 샘플 또는 매뉴얼이 확보되면 확정한다.
