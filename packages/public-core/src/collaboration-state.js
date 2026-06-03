import { DEFAULT_BUILD_TARGET, WORK_ITEM_STATUS, WORK_ITEM_TYPE, createWorkItem } from "../../contracts/src/collaboration-contract.js";

export function createSampleCollaborationState() {
  return {
    buildTarget: DEFAULT_BUILD_TARGET,
    users: [
      { id: "u-owner", name: "Owner", role: "owner" },
      { id: "u-builder", name: "Builder", role: "builder" },
      { id: "u-reviewer", name: "Reviewer", role: "reviewer" },
      { id: "u-operator", name: "Operator", role: "operator" }
    ],
    workItems: [
      createWorkItem({ id: "wi-intent-password", type: WORK_ITEM_TYPE.INTENT, title: "password_reset", assigneeId: "u-builder", status: WORK_ITEM_STATUS.IN_PROGRESS }),
      createWorkItem({ id: "wi-answer-password", type: WORK_ITEM_TYPE.ANSWER, title: "password_reset answer", assigneeId: "u-reviewer", status: WORK_ITEM_STATUS.REVIEW }),
      createWorkItem({ id: "wi-api-order", type: WORK_ITEM_TYPE.API_ANSWER, title: "order_status_lookup", assigneeId: "u-builder", status: WORK_ITEM_STATUS.TODO }),
      createWorkItem({ id: "wi-deploy-web", type: WORK_ITEM_TYPE.DEPLOYMENT, title: "web deployment", assigneeId: "u-operator", status: WORK_ITEM_STATUS.BLOCKED })
    ]
  };
}

export function summarizeCollaboration(state) {
  const total = state?.workItems?.length || 0;
  const review = state?.workItems?.filter((item) => item.status === WORK_ITEM_STATUS.REVIEW).length || 0;
  const blocked = state?.workItems?.filter((item) => item.status === WORK_ITEM_STATUS.BLOCKED).length || 0;
  const target = state?.buildTarget || DEFAULT_BUILD_TARGET;
  return {
    total,
    review,
    blocked,
    mode: target.mode,
    targetDays: `${target.target_days_min}-${target.target_days_max}`,
    collaborationAvailable: target.collaboration_available
  };
}
