import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIntentDownloadCsv,
  buildIntentUploadTemplateCsv,
  findMissingNewIntentAnswerNames,
  groupIntentImportRows,
  parseIntentImportRows,
} from "../lib/intent-import.ts";

test("의도 업로드 양식은 새 의도의 답변 열을 포함한다", () => {
  assert.equal(
    buildIntentUploadTemplateCsv(),
    "의도명,표시명,의도 Key,학습문장,태그,답변\n" +
      "주문조회,주문조회,,주문 상태 알려줘,주문|배송,주문조회입니다",
  );
});

test("같은 의도의 모든 학습문장과 첫 번째 답변을 보존한다", () => {
  const rows = parseIntentImportRows(
    "의도명,표시명,의도 Key,학습문장,태그,답변\n" +
      "대출상담,대출상담,,대출이 필요해요,,상담 안내입니다\n" +
      "대출상담,대출상담,,대출 한도를 알고 싶어요,,\n" +
      "대출상담,대출상담,,대출 금리를 알려줘,,다른 답변",
  );

  assert.deepEqual(groupIntentImportRows(rows), [
    {
      name: "대출상담",
      displayName: "대출상담",
      dialogKey: "",
      utterances: ["대출이 필요해요", "대출 한도를 알고 싶어요", "대출 금리를 알려줘"],
      tags: [],
      answer: "상담 안내입니다",
    },
  ]);
});

test("기존 의도 갱신용 5열 CSV는 답변이 빈 값인 이전 형식으로 계속 읽는다", () => {
  const [row] = parseIntentImportRows(
    "의도명,표시명,의도 Key,학습문장,태그\n기존의도,기존의도,key-1,기존 문장,기존태그",
  );

  assert.equal(row.answer, "");
  assert.equal(row.utterance, "기존 문장");
});

test("답변 누락 검사는 새 의도만 차단하고 기존 의도 갱신은 허용한다", () => {
  const groups = groupIntentImportRows(parseIntentImportRows(
    "의도명,표시명,의도 Key,학습문장,태그,답변\n" +
      "기존의도,기존의도,,추가 문장,,\n" +
      "새의도,새의도,,새 문장,,",
  ));

  assert.deepEqual(findMissingNewIntentAnswerNames(groups, [" 기존의도 "]), ["새의도"]);
});

test("다운로드 CSV는 대화 흐름의 답변을 포함해 다시 업로드할 수 있다", () => {
  const csv = buildIntentDownloadCsv(
    [
      {
        id: "intent-1",
        dialogType: 1,
        name: "대출상담",
        displayName: "대출상담",
        dialogKey: "loan",
        tags: ["금융"],
        utterances: [{ text: "대출이 필요해요" }],
      },
    ],
    new Map([["intent-1", "상담 안내입니다"]]),
  );

  assert.equal(
    csv,
    "의도명,표시명,의도 Key,학습문장,태그,답변\n" +
      "대출상담,대출상담,loan,대출이 필요해요,금융,상담 안내입니다",
  );
});
