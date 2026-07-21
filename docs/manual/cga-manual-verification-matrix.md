# CGA 문서 기능 검증표

상태: 초안
작성일: 2026-07-21

이 표는 세 문서에 기능을 수록할 때 근거와 검증 수준을 추적하기 위한 내부 검토표입니다.

## 검증 수준

- `소스 확인`: 현재 코드에서 메뉴·필드·옵션을 확인함. 실제 브라우저 조작은 미확인.
- `참고 확인`: Aidot 또는 Brity 참고자료에 설명이 있음. CGA 기능의 근거로 단독 사용하지 않음.
- `브라우저 확인`: 실제 화면에서 클릭·입력·저장·결과를 확인함.
- `미수록`: 근거가 부족하거나 CGA 동작을 확정할 수 없어 사용자 문서 본문에 수록하지 않음.

## 문서 대상

| 문서 | 기능 또는 단계 | 현재 근거 | 검증 수준 | 초안 수록 | 비고 |
|---|---|---|---|---|---|
| Getting Started | 로그인 | `apps/web/app/login/page.tsx` | 소스 확인 | 개요만 | 실제 로그인 성공 확인 필요 |
| Getting Started | 봇 생성 화면 진입 | `https://cga.sinsan.kr/studio/bots/new` | 브라우저 확인 | 절차 수록 | 인증된 운영 화면에서 생성 화면과 기본 필드 확인 |
| Getting Started | 봇 기본 정보 입력 항목 | 봇 유형·모드·프로필·이름·언어·소개 | 브라우저 확인 | 절차 수록 | 생성 제출 및 저장 결과는 미확인 |
| Getting Started | NLU 방식 선택 | ML·Semantic Vector Worker·Semantic External Embedding·LLM Engine | 브라우저 확인 | 설명 수록 | 선택 상태와 지원 조합 표시 확인; 실제 실행은 미확인 |
| Getting Started | 답변 방식 선택 | 정해진 답변·Semantic RAG·LLM RAG·LLM 답변 | 브라우저 확인 | 설명 수록 | 선택 상태와 지원 조합 표시 확인; 실제 실행은 미확인 |
| Getting Started | 테스트 | `apps/web/app/studio/bots/[botId]/versions/[versionId]/simulator/page.tsx` | 소스 확인 | 경로만 | 실제 테스트 결과 확인 필요 |
| 사용자 설명서 | 봇 생성 화면의 구조 요약·지원 상태 | 언어·NLU 방식·모델·답변 방식·LLM·버전 및 `실행/학습 가능`·`설정 저장만 가능` 표시 | 브라우저 확인 | 수록 | `확인` 제출 이후 결과는 미확인 |
| 사용자 설명서 | 봇 목록·버전 | `apps/web/app/studio/bots/page.tsx`, `apps/web/app/studio/bots/[botId]/versions/page.tsx` | 소스 확인 | 수록 | 실제 화면 확인 필요 |
| 사용자 설명서 | 의도·개체·사전 | 해당 `intents`, `entities`, `dictionary` routes | 소스 확인 | 수록 | 저장 결과 확인 필요 |
| 사용자 설명서 | 대화 흐름·API | 해당 `flows`, `apis` routes | 소스 확인 | 수록 | 저장·외부 연동 결과 확인 필요 |
| 사용자 설명서 | QA | `apps/web/app/studio/bots/[botId]/versions/[versionId]/qa/page.tsx` | 소스 확인 | 수록 | 업로드·검색 결과 확인 필요 |
| 사용자 설명서 | 분석·평가 | `analysis`, `evaluation` routes 및 `analysis-page.tsx` | 소스 확인 | 수록 | 실제 결과와 지표 확인 필요 |
| 사용자 설명서 | 관리자 메뉴 | `apps/web/components/admin-console-layout.tsx` | 소스 확인 | 수록 | 역할별 접근 확인 필요 |
| NLU 가이드 | ML 설정·모델 | 봇 생성 화면의 ML 모델 선택지 | 브라우저 확인 | 원칙 수록 | DeepLearning Lite·TF-IDF Linear·Keyword Baseline 표시 확인; 학습·분류 실행은 미확인 |
| NLU 가이드 | Semantic Vector Worker | 봇 생성 화면의 기본 Vector Worker 설정 | 브라우저 확인 | 주의사항 수록 | 기본 연결 표시 확인; 인덱싱·검색 실행은 미확인 |
| NLU 가이드 | Semantic External Embedding | 외부 검색 API·Index·API Key 설정 필드 | 브라우저 확인 | 설정 설명 수록 | 필드 표시 확인; 외부 API 연동은 미확인 |
| NLU 가이드 | LLM Provider·모델 | LLM Provider·세부 모델 선택지 | 브라우저 확인 | 설정 설명 수록 | ChatGPT·Gemini 등 Provider와 GPT-4o mini·GPT-4o 표시 확인; 실제 호출·응답은 미확인 |
| NLU 가이드 | 엔진별 품질 개선 | Aidot NLU 참고자료 및 CGA 분석 화면 | 참고 확인 | 원칙만 | CGA 기능과 연결되는 부분 확인 필요 |

## 현재 미확인 영역

- 실제 브라우저에서 로그인부터 봇 생성 제출, 학습 또는 인덱싱, 시뮬레이터 테스트까지 이어지는 성공 경로
- ML·Semantic·LLM별 실제 학습·분류 결과와 오류 메시지
- Semantic 외부 임베딩 API의 운영 연결 조건
- LLM Provider와 세부 모델의 실제 호출 결과·비용·지연
- 각 관리자 메뉴의 역할별 접근과 저장 결과

위 항목은 초안의 확정 기능으로 표현하지 않고, 후속 브라우저·운영 유사 환경 검증 대상으로 남깁니다.

## 메뉴얼 릴리스 판단

| 단계 | 완료 기준 | 현재 상태 |
|---|---|---|
| 콘텐츠 작성 | 세 문서의 목적·대상·절차·주의사항 작성 | 완료 |
| 용어·링크 검토 | 세 문서의 화면 명칭과 상대 링크 일치 | 완료 |
| 화면 확인 | 실제 CGA 화면에서 메뉴·필드·엔진 선택지 확인 | 부분 완료 |
| 실행 검증 | 봇 생성 제출, 학습·인덱싱, 시뮬레이터 결과 확인 | 미완료 |
| 운영 릴리스 | 실행 검증 결과를 반영하고 상태를 최종 확정 | 미완료 |

현재 세 문서는 콘텐츠 검토본으로 사용할 수 있습니다. 실행 검증이 완료되기 전에는 `실행/학습 가능` 표시를 실제 성공 결과로 해석하지 않으며, 생성·학습·인덱싱·모델 호출 성공을 운영 확정 기능으로 표현하지 않습니다.
