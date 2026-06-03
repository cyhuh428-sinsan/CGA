# CGA Screen Composition Policy

작성 목적: CGA Studio 화면 구성을 언제든지 쉽게 변경 가능한 구조로 유지한다.

## 1. 핵심 원칙

1. 화면 순서와 노출 여부를 HTML에 직접 고정하지 않는다.
2. 화면 구성 변경은 `apps/studio/data/layout.js`에서 먼저 처리한다.
3. HTML section은 표현 shell 역할만 한다.
4. workflow 단계 데이터는 `apps/studio/data/workflow.js`에서 관리한다.
5. i18n 문구는 `packages/i18n/locales`에서 관리한다.
6. Public Core / Commercial Module 경계는 `docs/cga-open-core-module-boundary.md`와 `packages/contracts`를 따른다.

## 2. 현재 구조

```text
apps/studio/
├─ index.html              # 화면 shell
├─ styles.css              # 스타일
├─ app.js                  # 화면 렌더링/레이아웃 적용
├─ i18n.js                 # 정적 화면용 locale 전환
└─ data/
   ├─ workflow.js          # 6단계 workflow 데이터
   └─ layout.js            # 화면 순서/노출/그룹 설정
```

## 3. 화면 변경 방법

### 3.1 화면 순서 변경

`apps/studio/data/layout.js`의 `order` 값을 수정한다.

### 3.2 화면 임시 비표시

`visible: false`로 변경한다. 단, Aidot 기능 화면을 제외한다는 의미가 아니다. 아직 배치가 확정되지 않았거나 검토 중인 화면만 임시로 비표시할 수 있다.

### 3.3 화면 그룹 변경

`group` 값을 변경한다.

권장 group:

- `overview`
- `workflow`
- `foundation`
- `business`

### 3.4 새 화면 추가

1. `index.html`에 `data-screen-id="새ID"` section shell 추가
2. `layout.js`에 같은 id 등록
3. 필요한 경우 `workflow.js` 또는 i18n locale 리소스 추가

## 4. 금지사항

- 화면 순서를 HTML 배치만으로 제어하지 않는다.
- 사용자 노출 문구를 JS/HTML에 계속 늘려 박지 않는다.
- Commercial Module 구현체를 Public Core 화면 코드에 직접 의존시키지 않는다.
- Aidot API, runtime, simulator, webchat 계약을 화면 편의 때문에 변경하지 않는다.

## 5. 실제 앱 전환 시 유지할 구조

현재 정적 화면에서 사용 중인 `layout.js`, `workflow.js`, `contracts`, `i18n` 구조는 실제 웹앱 프레임워크로 전환해도 유지한다.

프레임워크 전환 시 역할:

| 현재 파일 | 실제 앱 전환 후 역할 |
| --- | --- |
| `layout.js` | route/sidebar/screen registry |
| `workflow.js` | workflow metadata |
| `packages/i18n` | app/server 공용 i18n resource |
| `packages/contracts` | app/server/commercial modules 공용 계약 |


## 6. Aidot 기능 화면 보존

CGA 화면 구성 변경은 Aidot 기능 화면 제거를 의미하지 않는다. 모든 Aidot 기능 화면은 workflow, detail, operate, improve 영역 중 하나에 반드시 매핑되어야 한다.
