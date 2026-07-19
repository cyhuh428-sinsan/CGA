from app.api.routes import admin


def test_prefer_start_intent_replaces_card_node_with_detected_intent() -> None:
    assert admin._prefer_start_intent_or_module_name("Talk 1", "콜백 예약") == "콜백 예약"
    assert admin._prefer_start_intent_or_module_name("Rich Form", "콜백 예약") == "콜백 예약"
    assert admin._prefer_start_intent_or_module_name("Condition 1", "콜백 예약") == "콜백 예약"


def test_prefer_start_intent_keeps_existing_specific_name() -> None:
    assert admin._prefer_start_intent_or_module_name("콜백 예약", "Talk 1") == "콜백 예약"
