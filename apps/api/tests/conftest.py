"""공통 테스트 수집 설정."""

from __future__ import annotations

from importlib.util import find_spec


# FastAPI TestClient는 httpx를 선택적으로 요구한다. 의존성이 없는 로컬 환경에서는
# 통합 테스트를 수집 오류로 만들지 않고, 설치 후 자동으로 활성화한다.
collect_ignore = [] if find_spec("httpx") else ["test_api_access_integration_regression.py"]
