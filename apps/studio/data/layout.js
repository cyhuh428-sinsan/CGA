export const screenLayout = [
  { id: "workspace-home", group: "workspace", visible: true, order: 10, mode: "public" },
  { id: "team-dashboard", group: "workspace", visible: true, order: 12, mode: "public" },
  { id: "create", group: "workflow", visible: true, order: 20, mode: "public" },
  { id: "configure", group: "workflow", visible: true, order: 30, mode: "public" },
  { id: "detail", group: "workflow", visible: true, order: 40, mode: "public" },
  { id: "api-answer-source", group: "workflow", visible: true, order: 45, mode: "public" },
  { id: "build", group: "workflow", visible: true, order: 50, mode: "public" },
  { id: "test", group: "workflow", visible: true, order: 60, mode: "public" },
  { id: "operate", group: "workflow", visible: true, order: 70, mode: "public" },
  { id: "access-management", group: "system-admin", visible: true, order: 100, mode: "public" },
  { id: "collaboration-platform", group: "reference", visible: true, order: 120, mode: "public" },
  { id: "locked-vs-runtime", group: "reference", visible: true, order: 130, mode: "public" },
  { id: "state-readiness", group: "reference", visible: true, order: 140, mode: "public" },
  { id: "i18n-policy", group: "reference", visible: true, order: 150, mode: "public" },
  { id: "aidot-feature-coverage", group: "reference", visible: true, order: 160, mode: "public" },
  { id: "public-contracts", group: "reference", visible: true, order: 170, mode: "public" },
  { id: "module-boundary", group: "business", visible: true, order: 180, mode: "public" },
  { id: "commercial-availability", group: "business", visible: true, order: 190, mode: "public" },
  { id: "open-core", group: "business", visible: true, order: 200, mode: "public" },
  { id: "hero", group: "temporary", visible: true, order: 900, mode: "public" }
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
