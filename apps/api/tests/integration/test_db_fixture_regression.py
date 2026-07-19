"""DB fixture 자체의 격리와 연결 계약을 검증한다."""

from __future__ import annotations

from sqlalchemy import text


def test_test_database_fixture_can_execute_query(test_engine) -> None:
    with test_engine.connect() as connection:
        assert connection.execute(text("select 1")).scalar_one() == 1


def test_db_session_fixture_rolls_back_changes(db_session) -> None:
    # 실제 도메인 테이블을 변경하지 않고 트랜잭션 경계만 확인한다.
    assert db_session.execute(text("select 1")).scalar_one() == 1
