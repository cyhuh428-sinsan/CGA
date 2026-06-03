# CGA Open Core Module Boundary

작성 기준: CGA Studio public 공개 전제, Aidot 호환 유지 원칙, 상용 가치 모듈 분리 결정
작성 목적: GitHub public 공개 범위와 상용 모듈 분리 범위를 명확히 한다.

## 1. 기본 원칙

CGA는 Public Core만으로도 기본 봇 제작과 운영이 가능해야 한다.

Commercial Module은 CGA를 더 빠르고, 더 잘 만들고, 더 안정적으로 운영하게 만드는 고급 기능이다.

공개 저장소에 단순 잠금장치를 넣는 방식은 핵심 전략이 아니다. 상용 가치를 가진 기능 구현체를 별도 모듈로 분리하는 것이 핵심 전략이다.

## 2. 모듈 구분

| 구분 | 공개 여부 | 목적 |
| --- | --- | --- |
| CGA Public Core | GitHub public | 기본 봇 제작, 기본 테스트, 기본 배포, Aidot 호환 계약 제공 |
| Advanced Builder Module | 비공개 또는 상용 패키지 | 고급 봇 생성 자동화와 품질 개선 |
| Operations Monitor Module | 비공개 또는 상용 패키지 | 운영 품질, 비용, 장애, 리포트 관리 |
| License / Entitlement Module | 비공개 또는 상용 서비스/패키지 | 상용 기능 권한과 사용 제한 관리 |

## 3. 화면별 공개/상용 경계

| CGA 화면 | Public Core | Commercial Module 후보 | 비고 |
| --- | --- | --- | --- |
| 01 Create Bot | 봇명, 설명, 언어, 버전, 기본 채널 선택 | 조직별 봇 생성 제한, 템플릿 추천 | 제한 기능은 Entitlement 후보 |
| 02 Configure Bot | 학습문장 입력, 기본 의도 후보 반영, PDF 업로드 저장 | PDF Q&A 생성 고도화, 의도 자동 병합, Handoff 결과 검증 | Advanced Builder 후보 |
| 02 Review Preview | 기본 의도 목록, 학습문장 확인, 답변 초안 수정 | 중복 의도 감지, 품질 점수, 답변 개선 제안 | Advanced Builder 후보 |
| 03 Detail Settings | 의도/답변, 동의어, 개체, 사전, 시나리오, API 도구 화면 연결 | 고급 시나리오 추천, API 매핑 자동 제안 | Advanced Builder 후보 |
| 04 Build | 기본 학습 실행 상태, 배포 준비 체크 | 빌드 품질 점수, 위험 예측, 자동 수정 제안 | Advanced Builder 후보 |
| 05 Test | Aidot 시뮬레이터 표시, 매칭 의도/변수/응답 확인 | 회귀 테스트 세트 자동 생성, 실패 원인 자동 분류 | Advanced Builder 후보 |
| 06 Operate | 채널 상태, 기본 대화량, 운영 버전, 기본 분석 | LLM 비용 집계, 장애 알림, 미정의 의도 감지, 운영 리포트 | Operations Monitor 후보 |
| Open Core Strategy | 공개/상용 모듈 안내 | 라이선스 상태, 기능 권한 표시 | Entitlement 후보 |

## 4. 기능별 공개/상용 경계

### 4.1 Public Core에 남길 기능

- Aidot 호환 API 계약
- Webchat / AM / 채널 API 호환 계약
- 런타임 변수·함수 규칙
- 기본 봇 생성
- 기본 봇 설정
- 학습문장 입력
- PDF 파일 업로드 저장
- 기본 의도 목록 표시
- 의도/답변 편집
- 동의어/개체/사전/시나리오/API 도구 화면 연결
- 기본 학습 상태 표시
- 기본 시뮬레이터 화면
- 기본 배포 체크리스트
- 기본 채널 상태 표시

### 4.2 Advanced Builder Module 후보

- PDF 기반 Q&A 의도 생성 고도화
- 학습문장 기반 의도 자동 분류 고도화
- 수동 LLM Handoff 결과 검증
- 의도 자동 병합 추천
- 중복 의도 감지
- 답변 품질 점검
- 프롬프트 템플릿 관리
- 시나리오 추천
- API 매핑 자동 제안
- 회귀 테스트 세트 자동 생성
- 테스트 실패 원인 자동 분류

### 4.3 Operations Monitor Module 후보

- LLM 호출 건수와 토큰 비용 집계
- LLM 비용 임계치 알림
- 채널 응답 실패 알림
- 미정의 질문 감지
- 오분류 분석
- 재학습 후보 추천
- 운영 리포트 생성
- 컨테이너 헬스체크 고도화
- 이상 대화량 급증/급감 알림

### 4.4 License / Entitlement Module 후보

- 라이선스 키 검증
- 조직별 기능 권한
- 봇 개수 제한
- 채널 개수 제한
- 고급 모듈 활성화 여부
- 만료일 확인
- 상용 기능 사용 로그

## 5. 인터페이스 원칙

Commercial Module과 연결되는 인터페이스는 공개 가능하다. 하지만 구현체는 Public Core에 포함하지 않는다.

권장 구조:

```text
cga/
├─ apps/studio
├─ apps/orchestrator
├─ packages/contracts
├─ packages/public-core
├─ packages/module-interfaces
└─ commercial-modules      # Public repo에는 포함하지 않음
   ├─ advanced-builder
   ├─ operations-monitor
   └─ entitlement
```

Public Core는 Commercial Module이 없어도 실행되어야 한다.

Commercial Module이 없는 경우 화면은 아래 중 하나로 동작한다.

- Basic 기능으로 대체
- 비활성 상태 표시
- `Commercial Module Required` 안내
- `Entitlement Not Connected` 안내

## 6. 구현 전 승인 필요

1. Public Core 라이선스 선택
2. Commercial Module 저장소 분리 방식
3. Commercial Module 패키지 배포 방식
4. License / Entitlement 검증 방식
5. Advanced Builder 1차 기능 범위
6. Operations Monitor 1차 기능 범위


## 7. Public Contracts

Public Core와 Commercial Module은 공개 계약을 통해 연결한다.

| 계약 | 파일 | 목적 |
| --- | --- | --- |
| Error Contract | `packages/contracts/src/error-contract.js` | 에러 코드, message key, fallback message 구조 고정 |
| Module Contract | `packages/contracts/src/module-contract.js` | 상용 모듈 상태와 기능 사용 가능 여부 표현 |
| Workflow Contract | `packages/contracts/src/workflow-contract.js` | 사용자 노출 6단계와 Aidot 내부 기능 매핑 고정 |

계약은 공개 가능하지만, Commercial Module 구현체는 public repo에 포함하지 않는다.
