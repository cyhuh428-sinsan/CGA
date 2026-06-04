export const screenLayout = [
  { id: "hero", group: "overview", visible: true, order: 10, mode: "public" },
  { id: "aidot-feature-coverage", group: "foundation", visible: true, order: 12, mode: "public" },
  { id: "access-management", group: "foundation", visible: true, order: 15, mode: "public" },
  { id: "collaboration-platform", group: "foundation", visible: true, order: 18, mode: "public" },
  { id: "workspace-home", group: "workspace", visible: true, order: 19, mode: "public" },
  { id: "create", group: "workflow", visible: true, order: 20, mode: "public" },
  { id: "configure", group: "workflow", visible: true, order: 30, mode: "public" },
  { id: "detail", group: "workflow", visible: true, order: 40, mode: "public" },
  { id: "api-answer-source", group: "workflow", visible: true, order: 45, mode: "public" },
  { id: "build", group: "workflow", visible: true, order: 50, mode: "public" },
  { id: "test", group: "workflow", visible: true, order: 60, mode: "public" },
  { id: "operate", group: "workflow", visible: true, order: 70, mode: "public" },
  { id: "locked-vs-runtime", group: "foundation", visible: true, order: 80, mode: "public" },
  { id: "state-readiness", group: "foundation", visible: true, order: 140, mode: "public" },
  { id: "i18n-policy", group: "foundation", visible: true, order: 90, mode: "public" },
  { id: "commercial-availability", group: "business", visible: true, order: 100, mode: "public" },
  { id: "module-boundary", group: "foundation", visible: true, order: 110, mode: "public" },
  { id: "public-contracts", group: "foundation", visible: true, order: 120, mode: "public" },
  { id: "open-core", group: "business", visible: true, order: 130, mode: "public" }
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
