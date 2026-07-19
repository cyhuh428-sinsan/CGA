"""DB 통합테스트용 안전한 테스트 데이터베이스 fixture."""

from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.config import settings


def _test_database_url() -> str:
    value = os.getenv("AIDOT_TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("AIDOT_TEST_DATABASE_URL이 설정되지 않아 DB 통합테스트를 보류합니다.")

    configured_url = settings.sqlalchemy_database_url.rstrip("/")
    candidate_url = value.replace("postgresql://", "postgresql+psycopg://", 1).rstrip("/")
    if candidate_url == configured_url:
        raise RuntimeError("AIDOT_TEST_DATABASE_URL은 개발/운영 DATABASE_URL과 달라야 합니다.")
    return candidate_url


@pytest.fixture(scope="session")
def test_engine() -> Generator[Engine, None, None]:
    engine = create_engine(_test_database_url(), future=True, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
    except Exception as error:
        engine.dispose()
        pytest.skip(f"테스트 DB에 연결할 수 없어 DB 통합테스트를 보류합니다: {error}")

    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine: Engine) -> Generator[Session, None, None]:
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, autoflush=False, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
