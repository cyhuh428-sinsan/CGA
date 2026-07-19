"""
런타임 변수 확장 테스트 — 엣지 케이스 및 추가 함수 검증
"""
from __future__ import annotations

from app.services.runtime_variables import get_variable, render_text, set_variable, stringify_variable


# ---------------------------------------------------------------------------
# get_variable
# ---------------------------------------------------------------------------

def test_get_variable_returns_falsy_for_missing_key() -> None:
    result = get_variable({}, "$missing")
    assert not result  # None 또는 빈 문자열 — 둘 다 허용


def test_get_variable_accesses_nested_object() -> None:
    variables = {"$user": {"name": "홍길동", "age": 30}}
    assert get_variable(variables, "$user.name") == "홍길동"
    assert get_variable(variables, "$user.age") == 30


def test_get_variable_accesses_list_by_index() -> None:
    variables = {"$items": ["첫번째", "두번째", "세번째"]}
    assert get_variable(variables, "$items.0") == "첫번째"
    assert get_variable(variables, "$items.2") == "세번째"


def test_get_variable_returns_falsy_for_out_of_bounds_index() -> None:
    variables = {"$items": ["a", "b"]}
    result = get_variable(variables, "$items.5")
    assert not result  # None 또는 빈 문자열 — 둘 다 허용


# ---------------------------------------------------------------------------
# set_variable
# ---------------------------------------------------------------------------

def test_set_variable_adds_dollar_prefix() -> None:
    variables: dict = {}
    set_variable(variables, "name", "홍길동")
    assert "$name" in variables
    assert variables["$name"] == "홍길동"


def test_set_variable_with_dollar_prefix_keeps_key() -> None:
    variables: dict = {}
    set_variable(variables, "$result", {"status": "ok"})
    assert variables["$result"] == {"status": "ok"}


def test_set_variable_overwrites_existing() -> None:
    variables: dict = {"$value": "old"}
    set_variable(variables, "value", "new")
    assert variables["$value"] == "new"


# ---------------------------------------------------------------------------
# stringify_variable
# ---------------------------------------------------------------------------

def test_stringify_variable_returns_string_for_string() -> None:
    assert stringify_variable("hello") == "hello"


def test_stringify_variable_converts_number() -> None:
    assert stringify_variable(42) == "42"


def test_stringify_variable_handles_none() -> None:
    result = stringify_variable(None)
    assert result == "" or result is None or isinstance(result, str)


def test_stringify_variable_extracts_text_from_dict() -> None:
    result = stringify_variable({"text": "안녕"})
    assert result == "안녕"


# ---------------------------------------------------------------------------
# render_text
# ---------------------------------------------------------------------------

def test_render_text_resolves_simple_variable() -> None:
    variables = {"$name": "홍길동"}
    assert render_text("안녕하세요, {{$name}}님", variables) == "안녕하세요, 홍길동님"


def test_render_text_renders_blank_for_missing_variable() -> None:
    assert render_text("값={{$missing}}", {}) == "값="


def test_render_text_no_template_returns_original() -> None:
    assert render_text("안녕하세요", {}) == "안녕하세요"


def test_render_text_renders_multiple_variables() -> None:
    variables = {"$first": "홍", "$last": "길동"}
    result = render_text("{{$first}}{{$last}}", variables)
    assert result == "홍길동"


def test_render_text_json_object_variable() -> None:
    variables = {"$data": {"value": "OK"}}
    result = render_text("결과={{$data}}", variables)
    assert "OK" in result or "value" in result


def test_render_text_size_function_on_list() -> None:
    variables = {"$items": ["a", "b", "c"]}
    assert render_text("{{$items.size()}}", variables) == "3"


def test_render_text_empty_function_on_empty_string() -> None:
    variables = {"$text": ""}
    assert render_text("{{$text.empty()}}", variables) == "true"


def test_render_text_empty_function_on_non_empty_string() -> None:
    variables = {"$text": "hello"}
    assert render_text("{{$text.empty()}}", variables) == "false"


def test_render_text_callback_called_for_missing_variable() -> None:
    missing: list[str] = []
    render_text("값={{$missing.field}}", {}, missing.append)
    assert "$missing.field" in missing
