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
| Getting Started | 봇 생성 | `apps/web/app/studio/bots/new/page.tsx`, `apps/web/components/bot-create-dialog.tsx` | 소스 확인 | 절차 초안 | 실제 생성 결과 확인 필요 |
| Getting Started | NLU 방식 선택 | `apps/web/lib/nlu-options.ts` | 소스 확인 | 설명 수록 | ML·Semantic·LLM 실행 가능 조합 확인 필요 |
| Getting Started | 답변 방식 선택 | `apps/web/lib/answer-options.ts` | 소스 확인 | 설명 수록 | 조합별 실행 확인 필요 |
| Getting Started | 테스트 | `apps/web/app/studio/bots/[botId]/versions/[versionId]/simulator/page.tsx` | 소스 확인 | 경로만 | 실제 테스트 결과 확인 필요 |
| 사용자 설명서 | 봇 목록·버전 | `apps/web/app/studio/bots/page.tsx`, `apps/web/app/studio/bots/[botId]/versions/page.tsx` | 소스 확인 | 수록 | 실제 화면 확인 필요 |
| 사용자 설명서 | 의도·개체·사전 | 해당 `intents`, `entities`, `dictionary` routes | 소스 확인 | 수록 | 저장 결과 확인 필요 |
| 사용자 설명서 | QA | `apps/web/app/studio/bots/[botId]/versions/[versionId]/qa/page.tsx` | 소스 확인 | 수록 | 업로드·검색 결과 확인 필요 |
| 사용자 설명서 | 분석·평가 | `analysis`, `evaluation` routes 및 `analysis-page.tsx` | 소스 확인 | 수록 | 실제 결과와 지표 확인 필요 |
| 사용자 설명서 | 관리자 메뉴 | `apps/web/components/admin-console-layout.tsx` | 소스 확인 | 수록 | 역할별 접근 확인 필요 |
| NLU 가이드 | ML 설정·모델 | `apps/web/lib/nlu-options.ts` | 소스 확인 | 원칙 수록 | 학습·분류 실행 확인 필요 |
| NLU 가이드 | Semantic Vector Worker | `apps/web/lib/nlu-options.ts`, `apps/vector-worker/README.md` | 소스 확인 | 주의사항 수록 | 인덱싱·검색 실행 확인 필요 |
| NLU 가이드 | Semantic External Embedding | `apps/web/components/bot-create-dialog.tsx` | 소스 확인 | 설정 설명 수록 | 외부 API 연동 확인 필요 |
| NLU 가이드 | LLM Provider·모델 | `apps/web/components/bot-create-dialog.tsx`, `apps/web/lib/llm-options.ts` | 소스 확인 | 설정 설명 수록 | 실제 호출·응답 확인 필요 |
| NLU 가이드 | 엔진별 품질 개선 | Aidot NLU 참고자료 및 CGA 분석 화면 | 참고 확인 | 원칙만 | CGA 기능과 연결되는 부분 확인 필요 |

## 현재 미확인 영역

- 실제 브라우저에서 로그인부터 봇 생성, 학습 또는 인덱싱, 시뮬레이터 테스트까지 이어지는 성공 경로
- ML·Semantic·LLM별 실제 학습·분류 결과와 오류 메시지
- Semantic 외부 임베딩 API의 운영 연결 조건
- LLM Provider와 세부 모델의 실제 호출 결과·비용·지연
- 각 관리자 메뉴의 역할별 접근과 저장 결과

위 항목은 초안의 확정 기능으로 표현하지 않고, 후속 브라우저·운영 유사 환경 검증 대상으로 남깁니다.
