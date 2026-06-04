import { DEFAULT_BUILD_TARGET, REVIEW_DECISION, WORK_ITEM_STATUS, WORK_ITEM_TYPE, createEditLock, createWorkItem } from "../../contracts/src/collaboration-contract.js";

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

export function summarizeTeamDashboard(state, { currentUserId = null } = {}) {
  const usersById = new Map((state?.users || []).map((user) => [user.id, user]));
  const workItems = state?.workItems || [];
  const myTasks = currentUserId ? workItems.filter((item) => item.assignee_id === currentUserId) : [];
  const reviewQueue = workItems.filter((item) => item.status === WORK_ITEM_STATUS.REVIEW);
  const blockedItems = workItems.filter((item) => item.status === WORK_ITEM_STATUS.BLOCKED);
  const byStatus = Object.values(WORK_ITEM_STATUS).map((status) => ({
    status,
    count: workItems.filter((item) => item.status === status).length
  }));
  return {
    currentUserId,
    currentUser: usersById.get(currentUserId) || null,
    myTasks,
    reviewQueue,
    blockedItems,
    byStatus,
    workItems: workItems.map((item) => ({
      ...item,
      assignee: usersById.get(item.assignee_id) || null
    }))
  };
}

export function lockWorkItem(state, { workItemId, userId, lockedAt = "2026-06-04T00:00:00.000Z", expiresAt = "2026-06-04T00:30:00.000Z" }) {
  return {
    ...state,
    workItems: state.workItems.map((item) => {
      if (item.id !== workItemId) return item;
      if (item.lock && item.lock.user_id !== userId) return item;
      return {
        ...item,
        lock: createEditLock({ userId, lockedAt, expiresAt }),
        status: item.status === WORK_ITEM_STATUS.TODO ? WORK_ITEM_STATUS.IN_PROGRESS : item.status,
        updated_at: lockedAt
      };
    })
  };
}

export function releaseWorkItemLock(state, { workItemId, userId, releasedAt = "2026-06-04T00:30:00.000Z" }) {
  return {
    ...state,
    workItems: state.workItems.map((item) => {
      if (item.id !== workItemId) return item;
      if (item.lock && item.lock.user_id !== userId) return item;
      return {
        ...item,
        lock: null,
        updated_at: releasedAt
      };
    })
  };
}

export function submitReviewDecision(state, { workItemId, reviewerId, decision, decidedAt = "2026-06-04T01:00:00.000Z" }) {
  const nextStatus = {
    [REVIEW_DECISION.APPROVE]: WORK_ITEM_STATUS.APPROVED,
    [REVIEW_DECISION.REQUEST_CHANGES]: WORK_ITEM_STATUS.TODO,
    [REVIEW_DECISION.COMMENT]: WORK_ITEM_STATUS.REVIEW
  }[decision] || WORK_ITEM_STATUS.REVIEW;
  return {
    ...state,
    workItems: state.workItems.map((item) => {
      if (item.id !== workItemId) return item;
      return {
        ...item,
        status: nextStatus,
        reviewers: [...item.reviewers, { user_id: reviewerId, decision, reviewed_at: decidedAt }],
        lock: null,
        updated_at: decidedAt
      };
    })
  };
}
