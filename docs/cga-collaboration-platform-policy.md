# CGA Collaboration Platform Policy

## 1. 기본 원칙

CGA의 1차 목표는 한 사람이 1~2일 안에 봇 하나를 만들 수 있게 하는 것이다. 다만 여러 명이 하나의 봇을 공동 제작할 수도 있어야 한다.

따라서 Public Core 단계부터 아래 구조가 필요하다.

## 1.1 UX 우선순위

1. 기본 화면은 1인 제작자가 빠르게 진행할 수 있어야 한다.
2. 협업 기능은 화면을 복잡하게 만들지 않고 필요할 때 열리는 구조여야 한다.
3. 내부 데이터 구조는 처음부터 공동 작업을 지원해야 한다.
4. 검수/잠금/이력은 봇 규모가 커질 때 자연스럽게 활성화되어야 한다.

## 1.3 다국어 공동 작업

CGA는 다양한 언어 사용자가 하나의 그룹에서 같은 봇을 공동 제작할 수 있어야 한다.

원칙:

- 그룹, 봇, 의도, 답변, API 설정은 같은 작업 대상을 공유한다.
- 각 사용자는 자기 `user.locale` 기준으로 CGA Studio UI를 본다.
- 에러 메시지, 운영 알림, 검수 알림은 사용자별 언어로 표시한다.
- 봇의 기본 언어와 사용자 UI 언어는 별도다.
- 예를 들어 같은 그룹 안에서 한국어 사용자는 한국어 UI로, 일본어 사용자는 일본어 UI로 같은 봇을 편집할 수 있다.
- 번역되지 않은 메시지는 English fallback을 사용한다.

## 1.2 제품 목표

- 기본 제작 모드: fast_solo
- 목표 제작 시간: 1~2일 안에 봇 1개 완성
- 협업 위치: 기본 흐름을 방해하지 않는 선택적 확장
- 협업 대상: 하나의 봇을 여러 명이 의도, 답변, API 답변, 시나리오, 평가, 배포 단위로 나누어 제작
- 화면 원칙: 초보 사용자는 혼자 만드는 흐름만 보아도 완료할 수 있어야 하며, 팀 기능은 필요할 때 열리거나 상태 패널로 확인한다.


- 사용자
- 로그인
- 역할
- 권한 범위
- 작업 항목
- 담당자 배정
- 검수 흐름
- 편집 잠금
- 변경 이력
- 팀 대시보드

## 2. 역할

- Owner
- Admin
- Builder
- Reviewer
- Operator
- Viewer

## 3. 작업 항목

작업 항목은 봇 제작 단위와 연결된다.

- Intent
- Answer
- Entity
- Dictionary
- Scenario
- API Answer
- Deployment
- Evaluation

## 4. 검수 흐름

상태:

- todo
- in_progress
- review
- approved
- blocked

검수 결정:

- approve
- request_changes
- comment

## 5. 편집 잠금

여러 사용자가 같은 항목을 동시에 수정하면 충돌이 생길 수 있다.

CGA는 같은 항목에 대해 짧은 edit lock을 제공해야 한다.

edit lock에는 아래 정보가 필요하다.

- user_id
- locked_at
- expires_at

## 6. 변경 이력

중요 변경은 아래 정보를 남긴다.

- actor
- target type
- target id
- before summary
- after summary
- timestamp
- review decision
