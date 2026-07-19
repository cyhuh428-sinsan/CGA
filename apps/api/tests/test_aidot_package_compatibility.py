from __future__ import annotations

from copy import deepcopy
import unittest

from app.services.aidot_package_compatibility import (
    aidot_bot_package_to_version_document,
    aidot_package_summary,
    is_aidot_bot_package,
    version_document_to_aidot_bot_package,
)


SAMPLE_PACKAGE = {
    "AIDOTAssistantVersion": "1.0.9",
    "messageDigest": "digest-from-aidot",
    "botVo": {"botId": "aidot-1", "botName": "호환봇", "futureBotField": {"keep": True}},
    "licenseVo": {"licenseId": "license-1", "futureLicenseField": "keep"},
    "botSystemConfigVoList": [{"configKey": "bot.defaultLocale", "configValue": "ko", "future": 7}],
    "dialogList": [{"dialogId": "intent-1", "dialogType": 1, "displayName": "문의", "futureDialogField": "keep"}],
    "dialogFlowGraphList": [{"dialogId": "intent-1", "flowGraph": [{"objectType": "Start"}]}],
    "entityTypeList": [
        {"entityName": "국가", "entityValue": "북아메리카", "entityType": "S", "detail": "바하마", "futureEntityField": "keep"},
        {"entityName": "이메일", "entityValue": "email", "entityType": "P", "detail": r"\\b.+@.+\\b"},
    ],
    "faqDialogList": [{"dialogId": "faq-1", "question": "질문", "answer": "답변"}],
    "floatingButtonVoList": [{"buttonId": "button-1", "label": "상담"}],
    "ruleVoList": [{"ruleName": "예약", "ruleExpression": ".*예약.*", "targetDialogId": "intent-1"}],
    "smallTalkVoList": [{"trigger": "안녕", "response": "안녕하세요"}],
    "dictionaryVoList": [{"word": "상담", "synonyms": ["문의"], "futureDictionaryField": "keep"}],
    "blacklistList": [{"blacklistName": "무시", "blacklistType": "0", "expression": "아"}],
    "futureTopLevelField": {"keep": [1, 2, 3]},
}


class AidotPackageCompatibilityTests(unittest.TestCase):
    def test_detects_and_maps_aidot_package(self) -> None:
        self.assertTrue(is_aidot_bot_package(SAMPLE_PACKAGE))
        document = aidot_bot_package_to_version_document(SAMPLE_PACKAGE)
        self.assertEqual(document["dialogs"][0]["id"], "intent-1")
        self.assertEqual(document["dialogs"][0]["name"], "문의")
        self.assertEqual(len(document["entities"]), 2)
        self.assertEqual(document["entities"][0]["rows"][0]["value"], "북아메리카")
        self.assertEqual(document["dictionary"][0]["synonyms"], ["문의"])

    def test_unchanged_package_round_trip_is_lossless(self) -> None:
        document = aidot_bot_package_to_version_document(SAMPLE_PACKAGE)
        exported = version_document_to_aidot_bot_package(document)
        self.assertEqual(exported, SAMPLE_PACKAGE)

    def test_modified_known_asset_preserves_unknown_fields(self) -> None:
        document = aidot_bot_package_to_version_document(SAMPLE_PACKAGE)
        document = deepcopy(document)
        document["dictionary"][0]["synonyms"].append("고객센터")
        exported = version_document_to_aidot_bot_package(document)
        self.assertEqual(exported["messageDigest"], "")
        self.assertEqual(exported["futureTopLevelField"], {"keep": [1, 2, 3]})
        self.assertEqual(exported["botVo"]["futureBotField"], {"keep": True})
        self.assertEqual(exported["dictionaryVoList"][0]["futureDictionaryField"], "keep")
        self.assertEqual(exported["dictionaryVoList"][0]["synonyms"], ["문의", "고객센터"])

    def test_rejects_non_aidot_json(self) -> None:
        with self.assertRaises(ValueError):
            aidot_bot_package_to_version_document({"version_json": {}})

    def test_summary_uses_source_asset_counts(self) -> None:
        summary = aidot_package_summary(SAMPLE_PACKAGE)
        self.assertEqual(summary["dialogs"], 1)
        self.assertEqual(summary["entities"], 2)
        self.assertEqual(summary["dictionary"], 1)


if __name__ == "__main__":
    unittest.main()
