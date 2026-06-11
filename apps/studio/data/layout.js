export const screenLayout = [
  { id: "access-management", group: "system-admin", visible: true, order: 10, mode: "public" },
  { id: "bot-management", group: "workspace", visible: true, order: 20, mode: "public" },
  { id: "workspace-home", group: "workspace", visible: true, order: 30, mode: "public" },
  { id: "create", group: "workflow", visible: true, order: 30, mode: "public" },
  { id: "configure", group: "workflow", visible: true, order: 40, mode: "public" },
  { id: "detail", group: "workflow", visible: true, order: 50, mode: "public" },
  { id: "build", group: "workflow", visible: true, order: 60, mode: "public" },
  { id: "test", group: "workflow", visible: true, order: 70, mode: "public" },
  { id: "evaluate", group: "workflow", visible: true, order: 80, mode: "public" },
  { id: "operate", group: "operation", visible: true, order: 85, mode: "public" },
  { id: "analysis", group: "operation", visible: true, order: 86, mode: "public" },
  { id: "team-dashboard", group: "workspace", visible: true, order: 90, mode: "public" },
  { id: "api-answer-source", group: "workspace", visible: true, order: 100, mode: "public" },
  { id: "collaboration-platform", group: "hidden", visible: false, order: 905, mode: "public" },
  { id: "state-readiness", group: "hidden", visible: false, order: 915, mode: "public" },
  { id: "i18n-policy", group: "hidden", visible: false, order: 925, mode: "public" },
  { id: "commercial-availability", group: "hidden", visible: false, order: 935, mode: "public" },
  { id: "aidot-feature-coverage", group: "hidden", visible: false, order: 900, mode: "public" },
  { id: "locked-vs-runtime", group: "hidden", visible: false, order: 910, mode: "public" },
  { id: "module-boundary", group: "hidden", visible: false, order: 920, mode: "public" },
  { id: "public-contracts", group: "hidden", visible: false, order: 930, mode: "public" },
  { id: "open-core", group: "hidden", visible: false, order: 940, mode: "public" }
];

export const layoutPolicy = Object.freeze({
  source: "apps/studio/data/layout.js",
  rule: "Screen order, visibility, and grouping must be changed here first.",
  htmlRule: "HTML sections are presentation shells and should not own workflow order.",
  futureRule: "When CGA moves to a framework, this layout config becomes route/sidebar metadata."
});

export function getVisibleLayout() {
  return screenLayout
    .filter((section) => section.visible)
    .slice()
    .sort((a, b) => a.order - b.order);
}
