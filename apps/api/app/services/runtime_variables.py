from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from typing import Any, Callable


RuntimeEmptyCallback = Callable[[str], None]


_FUNCTION_CALL_RE = re.compile(r"\.([A-Za-z_][A-Za-z0-9_]*)\(")


class RuntimeDisplayList(list[Any]):
    pass


def var_key(name: str) -> str:
    stripped = str(name or "").strip()
    return stripped if stripped.startswith("$") else f"${stripped}"


def set_variable(variables: dict[str, Any], name: str | None, value: Any) -> None:
    key = str(name or "").strip()
    if not key:
        return
    variables[var_key(key)] = value


def _path_segments(path: str) -> list[str]:
    normalized = str(path or "").strip()
    if not normalized:
        return []
    normalized = normalized.replace("[]", "[0]")
    segments: list[str] = []
    token = ""
    index = 0
    while index < len(normalized):
        char = normalized[index]
        if char == ".":
            if token:
                segments.append(token)
                token = ""
            index += 1
            continue
        if char == "[":
            if token:
                segments.append(token)
                token = ""
            end_index = normalized.find("]", index + 1)
            if end_index == -1:
                return []
            raw_segment = normalized[index + 1 : end_index].strip()
            if len(raw_segment) >= 2 and raw_segment[0] == raw_segment[-1] and raw_segment[0] in {"'", '"'}:
                raw_segment = raw_segment[1:-1]
            if raw_segment:
                segments.append(raw_segment)
            index = end_index + 1
            continue
        token += char
        index += 1
    if token:
        segments.append(token)
    return segments


def _split_variable_expression(name: str) -> tuple[str, str]:
    lookup_key = str(name or "").strip().lstrip("$")
    dot_index = lookup_key.find(".")
    bracket_index = lookup_key.find("[")
    indexes = [index for index in (dot_index, bracket_index) if index >= 0]
    if not indexes:
        return lookup_key, ""
    split_index = min(indexes)
    root = lookup_key[:split_index]
    path = lookup_key[split_index + 1 :] if lookup_key[split_index] == "." else lookup_key[split_index:]
    return root, path


def object_path_value(source: Any, path: str) -> Any:
    segments = _path_segments(path)
    if not segments:
        return source
    current = source
    for segment in segments:
        if current is None:
            return None
        if isinstance(current, list):
            try:
                current = current[int(segment)]
            except (ValueError, IndexError):
                return None
        elif isinstance(current, dict):
            current = current.get(segment)
        else:
            return None
    return current


def get_variable(variables: dict[str, Any], name: str | None) -> Any:
    key = str(name or "").strip()
    if not key:
        return ""
    candidates = [key, var_key(key), key.lstrip("$")]
    for candidate in candidates:
        if candidate in variables:
            return variables[candidate]
    lookup_key = key.lstrip("$")
    root, path = _split_variable_expression(lookup_key)
    if not path:
        return ""
    for candidate in (root, var_key(root)):
        if candidate in variables:
            value = object_path_value(variables[candidate], path)
            return "" if value is None else value
    return ""


def stringify_variable(value: Any, accessor: str | None = None) -> str:
    if isinstance(value, dict):
        if accessor:
            return str(value.get(accessor, ""))
        if any(key in value for key in ("text", "value", "target")) and len(set(value.keys()) - {"text", "value", "target", "entity"}) == 0:
            return str(value.get("text", value.get("value", value.get("target", ""))))
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, RuntimeDisplayList):
        return ", ".join(stringify_variable(item) for item in value)
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value if value is not None else "")


def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _primitive_value(value: Any) -> Any:
    if isinstance(value, dict):
        if "target" in value:
            return value.get("target")
        if "value" in value:
            return value.get("value")
        if "text" in value:
            return value.get("text")
    return value


def _text_value(value: Any) -> str:
    primitive = _primitive_value(value)
    if isinstance(primitive, (dict, list)):
        return stringify_variable(primitive)
    return str(primitive if primitive is not None else "")


def _number_value(value: Any) -> float | None:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = _text_value(value).strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _format_number(value: float) -> int | float:
    return int(value) if value.is_integer() else value


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = _text_value(value).strip()
    if not text:
        return None
    normalized = text.replace("/", "-")
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y%m%d",
        "%Y-%m-%d %I:%M:%S %p",
        "%Y-%m-%d %I:%M %p",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _format_datetime(value: datetime, pattern: str) -> str:
    replacements = [
        ("yyyy", "%Y"),
        ("YYYY", "%Y"),
        ("MM", "%m"),
        ("dd", "%d"),
        ("DD", "%d"),
        ("HH", "%H"),
        ("hh", "%I"),
        ("mm", "%M"),
        ("ss", "%S"),
    ]
    fmt = pattern or "yyyy-MM-dd"
    for source, target in replacements:
        fmt = fmt.replace(source, target)
    return value.strftime(fmt)


def _split_arguments(raw: str) -> list[str]:
    args: list[str] = []
    token = ""
    quote: str | None = None
    depth = 0
    index = 0
    while index < len(raw):
        char = raw[index]
        if quote:
            token += char
            if char == quote and (index == 0 or raw[index - 1] != "\\"):
                quote = None
            index += 1
            continue
        if char in {"'", '"'}:
            quote = char
            token += char
            index += 1
            continue
        if char in "([{":
            depth += 1
        elif char in ")]}" and depth > 0:
            depth -= 1
        if char == "," and depth == 0:
            args.append(token.strip())
            token = ""
        else:
            token += char
        index += 1
    if token.strip() or raw.strip():
        args.append(token.strip())
    return args


def _parse_argument(raw: str) -> Any:
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1].replace(f"\\{value[0]}", value[0])
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if lowered == "null":
        return None
    try:
        number = float(value)
        return _format_number(number)
    except ValueError:
        return value


def _find_function_chain(expression: str) -> tuple[str, list[tuple[str, list[Any]]]]:
    matches = list(_FUNCTION_CALL_RE.finditer(expression))
    if not matches:
        return expression, []
    first = matches[0]
    base = expression[: first.start()]
    chain_text = expression[first.start() :]
    calls: list[tuple[str, list[Any]]] = []
    index = 0
    while index < len(chain_text):
        match = _FUNCTION_CALL_RE.match(chain_text, index)
        if not match:
            return expression, []
        name = match.group(1)
        args_start = match.end()
        depth = 1
        quote: str | None = None
        cursor = args_start
        while cursor < len(chain_text):
            char = chain_text[cursor]
            if quote:
                if char == quote and chain_text[cursor - 1] != "\\":
                    quote = None
                cursor += 1
                continue
            if char in {"'", '"'}:
                quote = char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    break
            cursor += 1
        if depth != 0:
            return expression, []
        raw_args = chain_text[args_start:cursor]
        calls.append((name, [_parse_argument(arg) for arg in _split_arguments(raw_args)]))
        index = cursor + 1
    return base, calls


def _jsonpath_child_values(value: Any, key: str) -> list[Any]:
    if isinstance(value, dict):
        child = value.get(key)
        return child if isinstance(child, list) else [child]
    if isinstance(value, list):
        values: list[Any] = []
        for item in value:
            values.extend(_jsonpath_child_values(item, key))
        return values
    return []


def _jsonpath_filter(values: list[Any], expression: str) -> list[Any]:
    match = re.fullmatch(r"@\.(?P<key>[A-Za-z0-9_-]+)\s*==\s*(?P<quote>['\"])(?P<value>.*?)\2", expression.strip())
    if not match:
        return values
    key = match.group("key")
    expected = match.group("value")
    return [item for item in values if isinstance(item, dict) and str(item.get(key, "")) == expected]


def _apply_jsonpath(value: Any, expression: str) -> Any:
    path = str(expression or "").strip()
    if not path:
        return ""
    if path.startswith("$"):
        path = path[1:]
    if path.startswith("."):
        path = path[1:]
    current: Any = value
    token = ""
    index = 0
    while index < len(path):
        char = path[index]
        if char == ".":
            if token:
                child_values = _jsonpath_child_values(current, token)
                current = child_values if len(child_values) != 1 else child_values[0]
                token = ""
            index += 1
            continue
        if char == "[":
            if token:
                child_values = _jsonpath_child_values(current, token)
                current = child_values if len(child_values) != 1 else child_values[0]
                token = ""
            end_index = path.find("]", index + 1)
            if end_index == -1:
                return ""
            raw = path[index + 1 : end_index].strip()
            if raw.startswith("?(") and raw.endswith(")"):
                items = current if isinstance(current, list) else [current]
                current = _jsonpath_filter(items, raw[2:-1])
            elif raw == "*":
                current = current if isinstance(current, list) else list(current.values()) if isinstance(current, dict) else []
            else:
                if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in {"'", '"'}:
                    raw = raw[1:-1]
                if isinstance(current, list):
                    try:
                        current = current[int(raw)]
                    except (ValueError, IndexError):
                        return ""
                elif isinstance(current, dict):
                    current = current.get(raw, "")
                else:
                    return ""
            index = end_index + 1
            continue
        token += char
        index += 1
    if token:
        child_values = _jsonpath_child_values(current, token)
        current = child_values if len(child_values) != 1 else child_values[0]
    return "" if current is None else current


def _apply_runtime_function(value: Any, name: str, args: list[Any]) -> Any:
    function = name.strip()
    lower_name = function.lower()

    if lower_name == "target":
        return value.get("target", "") if isinstance(value, dict) else value
    if lower_name == "value":
        return value.get("value", "") if isinstance(value, dict) else value
    if lower_name == "default":
        return args[0] if _is_empty(value) and args else value
    if lower_name == "empty":
        return _is_empty(value)
    if lower_name == "notempty":
        return not _is_empty(value)
    if lower_name == "tostring":
        return stringify_variable(value)
    if lower_name == "tonumber":
        number = _number_value(value)
        return "" if number is None else _format_number(number)
    if lower_name == "toboolean":
        text = _text_value(value).strip().lower()
        if text in {"true", "1", "y", "yes", "사용"}:
            return True
        if text in {"false", "0", "n", "no", "미사용", ""}:
            return False
        return bool(value)

    if lower_name == "size":
        if isinstance(value, (list, dict, str)):
            return len(value)
        return 0
    if lower_name == "at":
        if not isinstance(value, list) or not args:
            return ""
        try:
            return value[int(args[0])]
        except (ValueError, TypeError, IndexError):
            return ""
    if lower_name == "first":
        return value[0] if isinstance(value, list) and value else ""
    if lower_name == "last":
        return value[-1] if isinstance(value, list) and value else ""
    if lower_name == "range":
        if not isinstance(value, list):
            return ""
        try:
            start = int(args[0]) if len(args) > 0 else 0
            end = int(args[1]) if len(args) > 1 else len(value) - 1
        except (ValueError, TypeError):
            return ""
        return RuntimeDisplayList(value[start : end + 1])

    text = _text_value(value)
    if lower_name == "splitby":
        splitter = str(args[0]) if args else ","
        return RuntimeDisplayList(text.split(splitter))
    if lower_name == "concat":
        return text + (str(args[0]) if args else "")
    if lower_name == "contains":
        return str(args[0]) in text if args else False
    if lower_name == "substring":
        try:
            start = int(args[0]) if len(args) > 0 else 0
            end = int(args[1]) if len(args) > 1 else len(text)
        except (ValueError, TypeError):
            return ""
        return text[start:end]
    if lower_name == "trim":
        return text.strip()
    if lower_name == "lower":
        return text.lower()
    if lower_name == "upper":
        return text.upper()
    if lower_name == "replace":
        if len(args) < 2:
            return text
        return text.replace(str(args[0]), str(args[1]))
    if lower_name == "equals":
        return text == (str(args[0]) if args else "")
    if lower_name == "startswith":
        return text.startswith(str(args[0])) if args else False
    if lower_name == "endswith":
        return text.endswith(str(args[0])) if args else False
    if lower_name == "matches":
        if not args:
            return False
        try:
            return re.search(str(args[0]), text) is not None
        except re.error:
            return False

    if lower_name in {"add", "sub", "multi", "div"}:
        left = _number_value(value)
        right = _number_value(args[0]) if args else None
        if left is None or right is None:
            return ""
        if lower_name == "add":
            return _format_number(left + right)
        if lower_name == "sub":
            return _format_number(left - right)
        if lower_name == "multi":
            return _format_number(left * right)
        if right == 0:
            return ""
        return _format_number(left / right)

    dt = _parse_datetime(value)
    if lower_name == "year":
        return "" if dt is None else dt.year
    if lower_name == "month":
        return "" if dt is None else dt.month
    if lower_name == "day":
        return "" if dt is None else dt.day
    if lower_name == "hour":
        return "" if dt is None else dt.hour
    if lower_name == "format":
        return "" if dt is None else _format_datetime(dt, str(args[0]) if args else "yyyy-MM-dd")
    if lower_name == "adddays":
        if dt is None or not args:
            return ""
        number = _number_value(args[0])
        return "" if number is None else _format_datetime(dt + timedelta(days=int(number)), "yyyy-MM-dd")
    if lower_name == "diffdays":
        other = _parse_datetime(args[0]) if args else None
        return "" if dt is None or other is None else (dt.date() - other.date()).days
    if lower_name == "before":
        other = _parse_datetime(args[0]) if args else None
        return False if dt is None or other is None else dt < other
    if lower_name == "after":
        other = _parse_datetime(args[0]) if args else None
        return False if dt is None or other is None else dt > other

    if lower_name in {"get", "exists"}:
        path = str(args[0]) if args else ""
        result = object_path_value(value, path)
        return not _is_empty(result) if lower_name == "exists" else "" if result is None else result
    if lower_name == "jsonpath":
        return _apply_jsonpath(value, str(args[0]) if args else "")

    return value


def evaluate_expression(expression: str, variables: dict[str, Any]) -> Any:
    base_expression, calls = _find_function_chain(expression.strip())
    value = get_variable(variables, base_expression)
    for name, args in calls:
        value = _apply_runtime_function(value, name, args)
    return value


def render_text(text: str, variables: dict[str, Any], on_empty: RuntimeEmptyCallback | None = None) -> str:
    def replace(match: re.Match[str]) -> str:
        expression = match.group(1).strip()
        value = evaluate_expression(expression, variables)
        if value == "" and on_empty is not None:
            on_empty(expression)
        return stringify_variable(value)

    return re.sub(r"\{\{\s*([^}]+?)\s*\}\}", replace, text)
