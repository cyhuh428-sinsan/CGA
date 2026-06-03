export const WORK_ITEM_STATUS = Object.freeze({
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  APPROVED: "approved",
  BLOCKED: "blocked"
});

export const WORK_ITEM_TYPE = Object.freeze({
  INTENT: "intent",
  ANSWER: "answer",
  ENTITY: "entity",
  DICTIONARY: "dictionary",
  SCENARIO: "scenario",
  API_ANSWER: "api_answer",
  DEPLOYMENT: "deployment",
  EVALUATION: "evaluation"
});

export const REVIEW_DECISION = Object.freeze({
  APPROVE: "approve",
  REQUEST_CHANGES: "request_changes",
  COMMENT: "comment"
});

export const BUILD_MODE = Object.freeze({
  FAST_SOLO: "fast_solo",
  TEAM_COLLABORATION: "team_collaboration"
});

export const DEFAULT_BUILD_TARGET = Object.freeze({
  mode: BUILD_MODE.FAST_SOLO,
  target_days_min: 1,
  target_days_max: 2,
  collaboration_available: true
});

export function createWorkItem({ id, type, title, assigneeId = null, status = WORK_ITEM_STATUS.TODO }) {
  return {
    id,
    type,
    title,
    assignee_id: assigneeId,
    status,
    reviewers: [],
    lock: null,
    updated_at: null
  };
}

export function createEditLock({ userId, lockedAt, expiresAt }) {
  return {
    user_id: userId,
    locked_at: lockedAt,
    expires_at: expiresAt
  };
}
