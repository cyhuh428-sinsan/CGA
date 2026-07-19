from app.services.runtime_variables import get_variable, render_text, set_variable, stringify_variable


def test_render_text_resolves_nested_object_and_array_paths() -> None:
    variables = {
        "$result": {
            "name": "신산",
            "items": [{"label": "첫번째"}, {"label": "두번째"}],
        }
    }

    assert render_text("고객={{$result.name}}, 항목={{$result.items[1].label}}", variables) == "고객=신산, 항목=두번째"
    assert get_variable(variables, "$result.items.0.label") == "첫번째"
    assert render_text("첫 항목={{$result.items[].label}}", variables) == "첫 항목=첫번째"


def test_render_text_resolves_quoted_bracket_object_paths() -> None:
    variables = {
        "$result": {
            "response": {
                "toggle-2": {"value": "Y"},
                "toggle2": {"value": "N"},
            }
        }
    }

    assert get_variable(variables, '$result["response"]["toggle-2"].value') == "Y"
    assert render_text('선택={{$result["response"]["toggle2"]["value"]}}', variables) == "선택=N"


def test_render_text_supports_target_and_value_accessors() -> None:
    variables = {
        "$choice": {
            "target": "계약",
            "value": "contract",
        }
    }

    assert render_text("{{$choice.target()}}/{{$choice.value()}}", variables) == "계약/contract"


def test_render_text_supports_array_builtin_functions() -> None:
    variables = {"$items": ["사과", "배", "감", "귤"]}

    assert render_text("{{$items.size()}}", variables) == "4"
    assert render_text("{{$items.first()}}/{{$items.last()}}/{{$items.at(1)}}", variables) == "사과/귤/배"
    assert render_text("{{$items.range(0,2)}}", variables) == "사과, 배, 감"


def test_render_text_supports_string_builtin_functions() -> None:
    variables = {"$text": " 아이디-비밀번호-재설정 "}

    assert render_text("{{$text.trim().contains('비밀번호')}}", variables) == "true"
    assert render_text("{{$text.trim().substring(0,3)}}", variables) == "아이디"
    assert render_text("{{$text.trim().splitby('-').last()}}", variables) == "재설정"
    assert render_text("{{$text.trim().replace('-', '/').concat(' 문의')}}", variables) == "아이디/비밀번호/재설정 문의"
    assert render_text("{{$text.lower().startsWith(' 아이디')}}/{{$text.endsWith(' ')}}", variables) == "true/true"


def test_render_text_supports_empty_default_and_type_functions() -> None:
    variables = {"$missingText": "", "$amount": "1,000", "$flag": "Y"}

    assert render_text("{{$missingText.empty()}}/{{$missingText.default('고객')}}", variables) == "true/고객"
    assert render_text("{{$amount.toNumber().add(50).div(2)}}", variables) == "525"
    assert render_text("{{$flag.toBoolean()}}/{{$amount.toString()}}", variables) == "true/1,000"


def test_render_text_supports_date_builtin_functions() -> None:
    variables = {"$date": "2026-05-18 13:45:30"}

    assert render_text("{{$date.year()}}/{{$date.month()}}/{{$date.day()}}/{{$date.hour()}}", variables) == "2026/5/18/13"
    assert render_text("{{$date.format(yyyy-MM-dd)}}", variables) == "2026-05-18"
    assert render_text("{{$date.addDays(2)}}", variables) == "2026-05-20"
    assert render_text("{{$date.diffDays('2026-05-16')}}", variables) == "2"
    assert render_text("{{$date.after('2026-05-17')}}/{{$date.before('2026-05-19')}}", variables) == "true/true"


def test_render_text_supports_json_access_builtin_functions() -> None:
    variables = {
        "$result": {
            "status": "ok",
            "items": [{"label": "첫번째"}, {"label": "두번째"}],
            "book": [{"author": "Elie Wiesel", "title": "Night"}],
        }
    }

    assert render_text("{{$result.get('items[1].label')}}", variables) == "두번째"
    assert render_text("{{$result.exists('items[0].label')}}/{{$result.exists('missing')}}", variables) == "true/false"
    assert render_text("{{$result.jsonpath($.book[?(@.author=='Elie Wiesel')]).first().get('title')}}", variables) == "Night"


def test_render_text_outputs_json_for_objects_without_special_accessor() -> None:
    variables = {"$result": {"ok": True, "count": 2}}

    assert render_text("{{$result}}", variables) == '{"ok": true, "count": 2}'


def test_missing_variable_invokes_empty_callback_and_renders_blank() -> None:
    empty_expressions: list[str] = []

    assert render_text("값={{$missing.name}}", {}, empty_expressions.append) == "값="
    assert empty_expressions == ["$missing.name"]


def test_set_variable_keeps_dollar_key_compatibility() -> None:
    variables: dict[str, object] = {}

    set_variable(variables, "result", {"text": "완료"})

    assert variables == {"$result": {"text": "완료"}}
    assert stringify_variable(get_variable(variables, "result")) == "완료"
