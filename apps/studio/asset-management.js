const PAGE_SIZES = [10, 25, 50, 100];

export function createAssetManagementController(api) {
  const ui = {
    entity: { query: "", page: 1, size: 25, sort: "name", direction: 1, selected: new Set(), menu: false },
    dictionary: { query: "", page: 1, size: 25, sort: "word", direction: 1, selected: new Set(), menu: false }
  };
  const esc = (value) => api.escapeText(String(value == null ? "" : value));
  const auditAt = (item) => item.updatedAt || item.updated_at || "-";
  const auditBy = (item) => item.updatedBy || item.updated_by || "-";
  const stamp = (item) => Object.assign({}, item, { updatedAt: new Date().toISOString(), updatedBy: api.getActorId() || "system" });
  const makeId = (prefix) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const modalBody = () => document.querySelector("[data-help-body]");

  function prepareModal(small) {
    const modal = document.querySelector("[data-help-modal]");
    if (!modal) return;
    modal.classList.add("asset-modal-open");
    modal.classList.toggle("asset-modal-small", Boolean(small));
  }

  function entityGroups() {
    const groups = new Map();
    api.getEntities().forEach((row) => {
      const name = String(row.name || "").trim();
      if (!name) return;
      const key = (row.system ? "system:" : "user:") + name;
      if (!groups.has(key)) groups.set(key, { id: key, name, system: Boolean(row.system), rows: [], updatedAt: auditAt(row), updatedBy: auditBy(row) });
      const group = groups.get(key);
      group.rows.push(row);
      if (String(auditAt(row)) > String(group.updatedAt)) {
        group.updatedAt = auditAt(row);
        group.updatedBy = auditBy(row);
      }
    });
    return Array.from(groups.values());
  }

  function dictionaryRows() {
    return api.getDictionary().map((item, index) => Object.assign({}, item, { id: item.id || "dictionary-" + index, sourceIndex: index }));
  }

  function sortValue(kind, row, key) {
    if (key === "updatedAt") return row.updatedAt || auditAt(row);
    if (key === "updatedBy") return row.updatedBy || auditBy(row);
    if (kind === "entity") {
      if (key === "category") return row.system ? "시스템 개체" : "사용자 개체";
      if (key === "value") return row.rows.map((item) => item.value).join(", ");
      return row[key] || "";
    }
    if (key === "synonyms") return (row.synonyms || []).join(", ");
    if (key === "count") return (row.synonyms || []).length;
    if (key === "enabled") return row.enabled === false ? 0 : 1;
    return row[key] || "";
  }

  function sorted(kind, rows) {
    const state = ui[kind];
    return rows.slice().sort((left, right) => {
      const a = sortValue(kind, left, state.sort);
      const b = sortValue(kind, right, state.sort);
      const result = typeof a === "number" ? a - b : String(a).localeCompare(String(b), "ko", { numeric: true });
      return result * state.direction;
    });
  }

  function sortHeader(kind, key, label) {
    const state = ui[kind];
    const mark = state.sort === key ? (state.direction === 1 ? "▲" : "▼") : "↕";
    return '<button type="button" class="asset-sort" data-sort="' + key + '">' + esc(label) + " <span>" + mark + "</span></button>";
  }

  function toolbar(kind, total) {
    const state = ui[kind];
    const entityMode = kind === "entity";
    const sizes = PAGE_SIZES.map((size) => '<option value="' + size + '" ' + (state.size === size ? "selected" : "") + ">" + size + "개씩 보기</option>").join("");
    return '<div class="asset-management__toolbar">' +
      '<label class="asset-search">⌕ <input type="search" data-query value="' + esc(state.query) + '" placeholder="' + (entityMode ? "개체명, 개체값, 정규식 또는 패턴을 검색하세요." : "단어 또는 동의어를 검색하세요.") + '"></label>' +
      '<div class="asset-actions"><button type="button" class="primary-button" data-add>+ ' + (entityMode ? "개체명" : "단어") + ' 추가</button><button type="button" class="asset-kebab" data-menu aria-label="파일 메뉴">⋮</button>' +
      '<div class="asset-file-menu" ' + (state.menu ? "" : "hidden") + '><button type="button" data-asset-upload="' + kind + '">파일 업로드</button><button type="button" data-asset-download="' + kind + '">파일 다운로드</button></div></div></div>' +
      '<div class="asset-management__meta"><strong>전체 ' + total + '건</strong><select data-size>' + sizes + '</select><button type="button" class="ghost-button" data-delete ' + (state.selected.size ? "" : "disabled") + '>삭제</button>' +
      (entityMode ? "" : '<button type="button" class="ghost-button" data-bulk="on" ' + (state.selected.size ? "" : "disabled") + '>의도 사용</button><button type="button" class="ghost-button" data-bulk="off" ' + (state.selected.size ? "" : "disabled") + '>의도 미사용</button>') + "</div>";
  }

  function entityRow(group) {
    const summary = group.rows.map((row) => row.value).filter(Boolean).slice(0, 3).join(", ") || "-";
    return '<div class="asset-management__row"><span><input type="checkbox" data-select="' + esc(group.id) + '" ' + (group.system ? "disabled" : "") + '></span><span>' +
      (group.system ? "시스템 개체" : "사용자 개체") + '</span><span><button type="button" class="asset-text-link" data-entity="' + esc(group.id) + '">' + esc(group.name) + '</button></span><span title="' + esc(summary) + '">' +
      esc(summary) + "</span><span>" + esc(group.updatedAt) + "</span><span>" + esc(group.updatedBy) + "</span></div>";
  }

  function dictionaryRow(item) {
    const synonyms = (item.synonyms || []).join(", ") || "-";
    const enabled = item.enabled !== false;
    return '<div class="asset-management__row"><span><input type="checkbox" data-select="' + esc(item.id) + '"></span><span><button type="button" class="asset-text-link" data-word="' + esc(item.id) + '">' +
      esc(item.word || "-") + '</button></span><span title="' + esc(synonyms) + '">' + esc(synonyms) + "</span><span>" + (item.synonyms || []).length + '</span><span><button type="button" class="table-toggle ' +
      (enabled ? "is-active" : "") + '" data-toggle="' + esc(item.id) + '">' + (enabled ? "사용" : "미사용") + "</button></span><span>" + esc(auditAt(item)) + "</span><span>" + esc(auditBy(item)) + "</span></div>";
  }

  function render(kind) {
    const entityMode = kind === "entity";
    const state = ui[kind];
    const all = entityMode ? entityGroups() : dictionaryRows();
    const query = state.query.trim().toLocaleLowerCase();
    const rows = sorted(kind, all.filter((row) => !query || JSON.stringify(row).toLocaleLowerCase().includes(query)));
    const pageCount = Math.max(1, Math.ceil(rows.length / state.size));
    state.page = Math.min(state.page, pageCount);
    const visible = rows.slice((state.page - 1) * state.size, state.page * state.size);
    const headers = entityMode
      ? sortHeader(kind, "category", "구분") + sortHeader(kind, "name", "개체명") + sortHeader(kind, "value", "개체값") + sortHeader(kind, "updatedAt", "최종수정일시") + sortHeader(kind, "updatedBy", "최종수정자")
      : sortHeader(kind, "word", "단어") + sortHeader(kind, "synonyms", "동의어") + sortHeader(kind, "count", "동의어 개수") + sortHeader(kind, "enabled", "의도 사용여부") + sortHeader(kind, "updatedAt", "최종수정일시") + sortHeader(kind, "updatedBy", "최종수정자");
    const rowsHtml = visible.map(entityMode ? entityRow : dictionaryRow).join("") || '<div class="asset-management__empty">등록된 ' + (entityMode ? "개체" : "단어") + "가 없습니다.</div>";
    const content = '<div class="asset-management" data-asset-management="' + kind + '">' + toolbar(kind, entityMode ? all.filter((row) => !row.system).length : all.length) +
      '<div class="asset-management__table asset-management__table--' + kind + '"><div class="asset-management__row asset-management__row--header"><span><input type="checkbox" data-all aria-label="전체 선택"></span>' +
      headers + "</div><div class=\"asset-management__table-body\">" + rowsHtml + '</div></div><div class="asset-management__pager"><button type="button" data-page="-1" ' + (state.page <= 1 ? "disabled" : "") + ">‹</button><strong>" + state.page +
      "</strong><span>/ " + pageCount + '</span><button type="button" data-page="1" ' + (state.page >= pageCount ? "disabled" : "") + ">›</button></div></div>";
    const section = api.renderShell(entityMode ? "entity-management" : "dictionary-management", "04", entityMode ? "개체 관리" : "사전 관리", entityMode ? "개체명과 개체값을 관리합니다." : "대표어와 동의어를 관리합니다.", content, { showSave: false });
    bindList(section, kind, visible);
    api.bindTransfers();
  }

  function bindList(section, kind, visible) {
    if (!section) return;
    const state = ui[kind];
    section.querySelector("[data-query]")?.addEventListener("change", (event) => { state.query = event.target.value; state.page = 1; render(kind); });
    section.querySelector("[data-size]")?.addEventListener("change", (event) => { state.size = Number(event.target.value) || 25; state.page = 1; render(kind); });
    section.querySelector("[data-menu]")?.addEventListener("click", () => { state.menu = !state.menu; render(kind); });
    section.querySelector("[data-add]")?.addEventListener("click", () => kind === "entity" ? openEntityName() : openDictionary());
    section.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.sort; state.direction = state.sort === key ? state.direction * -1 : 1; state.sort = key; render(kind); }));
    section.querySelectorAll("[data-select]").forEach((input) => { input.checked = state.selected.has(input.dataset.select); input.addEventListener("change", () => { input.checked ? state.selected.add(input.dataset.select) : state.selected.delete(input.dataset.select); render(kind); }); });
    section.querySelector("[data-all]")?.addEventListener("change", (event) => { visible.forEach((row) => { if (kind !== "entity" || !row.system) event.target.checked ? state.selected.add(String(row.id)) : state.selected.delete(String(row.id)); }); render(kind); });
    section.querySelector("[data-delete]")?.addEventListener("click", () => removeSelected(kind));
    section.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page += Number(button.dataset.page); render(kind); }));
    section.querySelectorAll("[data-entity]").forEach((button) => button.addEventListener("click", () => openEntityManager(button.dataset.entity)));
    section.querySelectorAll("[data-word]").forEach((button) => button.addEventListener("click", () => openDictionary(button.dataset.word)));
    section.querySelectorAll("[data-toggle]").forEach((button) => button.addEventListener("click", () => toggleDictionary(button.dataset.toggle)));
    section.querySelectorAll("[data-bulk]").forEach((button) => button.addEventListener("click", () => bulkDictionary(button.dataset.bulk === "on")));
  }

  async function commit(kind, next, previous) {
    kind === "entity" ? api.setEntities(next) : api.setDictionary(next);
    const saved = await api.save().catch(() => false);
    if (!saved) { kind === "entity" ? api.setEntities(previous) : api.setDictionary(previous); window.alert("저장에 실패했습니다. 현재 작업 봇을 다시 선택한 뒤 재시도하세요."); }
    ui[kind].selected.clear();
    render(kind);
    return saved;
  }

  function removeSelected(kind) {
    const state = ui[kind];
    if (!state.selected.size) return;
    if (kind === "entity") {
      const names = new Set(entityGroups().filter((group) => state.selected.has(group.id) && !group.system).map((group) => group.name));
      const previous = api.getEntities();
      commit(kind, previous.filter((row) => row.system || !names.has(row.name)), previous);
    } else {
      const previous = api.getDictionary();
      commit(kind, previous.filter((row, index) => !state.selected.has(row.id || "dictionary-" + index)), previous);
    }
  }

  function toggleDictionary(key) {
    const previous = api.getDictionary();
    const next = previous.map((row, index) => (row.id || "dictionary-" + index) === key ? stamp(Object.assign({}, row, { enabled: row.enabled === false })) : row);
    commit("dictionary", next, previous);
  }

  function bulkDictionary(enabled) {
    const previous = api.getDictionary();
    const next = previous.map((row, index) => ui.dictionary.selected.has(row.id || "dictionary-" + index) ? stamp(Object.assign({}, row, { enabled })) : row);
    commit("dictionary", next, previous);
  }

  function openDictionary(key) {
    const all = dictionaryRows();
    const item = all.find((row) => row.id === (key || ""));
    const draft = { word: item?.word || "", synonyms: (item?.synonyms || []).slice(), enabled: item?.enabled !== false };
    api.openModal(item ? "단어 수정" : "단어 등록", '<form class="asset-editor" data-dictionary-form><label class="asset-field"><span>단어</span><div class="asset-inline"><input name="word" maxlength="100" required value="' +
      esc(draft.word) + '"><button type="button" class="ghost-button" data-recommend>동의어 추천</button></div><small><b data-word-count>' + draft.word.length + '</b>/100</small></label><div class="asset-editor__split"><label class="asset-field"><span>동의어 검색</span><input type="search" data-synonym-search placeholder="동의어를 검색하세요."></label><label class="asset-field"><span>동의어</span><div class="asset-inline"><input maxlength="100" data-synonym-input><button type="button" class="ghost-button" data-synonym-add>추가</button></div><small><b data-synonym-count>0</b>/100</small></label></div><p class="asset-help">동의어는 없어도 저장할 수 있습니다. 최대 500개까지 등록할 수 있습니다.</p><div class="asset-list-head"><strong>동의어 목록</strong><button type="button" class="danger-button" data-synonym-delete>삭제</button></div><div class="asset-editor-list" data-synonym-list></div><label class="asset-usage"><input type="checkbox" data-enabled ' +
      (draft.enabled ? "checked" : "") + '> 의도 사용여부</label><div class="modal-actions"><button type="button" class="ghost-button" data-cancel>취소</button><button type="submit" class="primary-button">저장</button></div></form>');
    prepareModal(false);
    const root = modalBody();
    const form = root?.querySelector("[data-dictionary-form]");
    const draw = () => {
      const query = String(root.querySelector("[data-synonym-search]")?.value || "").toLocaleLowerCase();
      root.querySelector("[data-synonym-list]").innerHTML = draft.synonyms.map((value, index) => ({ value, index })).filter((entry) => !query || entry.value.toLocaleLowerCase().includes(query)).map((entry) =>
        '<label><input type="checkbox" data-synonym-select="' + entry.index + '"><input value="' + esc(entry.value) + '" data-synonym-edit="' + entry.index + '" maxlength="100"></label>').join("") || "<p>등록된 동의어가 없습니다.</p>";
      root.querySelectorAll("[data-synonym-edit]").forEach((input) => input.addEventListener("change", () => { draft.synonyms[Number(input.dataset.synonymEdit)] = input.value.trim(); }));
    };
    draw();
    form?.elements.word.addEventListener("input", (event) => { root.querySelector("[data-word-count]").textContent = event.target.value.length; });
    root?.querySelector("[data-synonym-search]")?.addEventListener("input", draw);
    root?.querySelector("[data-synonym-input]")?.addEventListener("input", (event) => { root.querySelector("[data-synonym-count]").textContent = event.target.value.length; });
    root?.querySelector("[data-synonym-add]")?.addEventListener("click", () => { const input = root.querySelector("[data-synonym-input]"); const value = input.value.trim(); if (value && draft.synonyms.length < 500 && !draft.synonyms.includes(value)) draft.synonyms.push(value); input.value = ""; draw(); });
    root?.querySelector("[data-synonym-delete]")?.addEventListener("click", () => { const selected = new Set(Array.from(root.querySelectorAll("[data-synonym-select]:checked")).map((input) => Number(input.dataset.synonymSelect))); draft.synonyms = draft.synonyms.filter((_, index) => !selected.has(index)); draw(); });
    root?.querySelector("[data-recommend]")?.addEventListener("click", () => { const word = form.elements.word.value.trim(); all.filter((row) => row.word === word).flatMap((row) => row.synonyms || []).forEach((value) => { if (draft.synonyms.length < 500 && !draft.synonyms.includes(value)) draft.synonyms.push(value); }); draw(); });
    root?.querySelector("[data-cancel]")?.addEventListener("click", api.closeModal);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const word = form.elements.word.value.trim();
      if (!word) return;
      const previous = api.getDictionary();
      const record = stamp({ id: item?.id || makeId("dictionary"), word, synonyms: draft.synonyms.map((value) => value.trim()).filter(Boolean), enabled: root.querySelector("[data-enabled]").checked });
      const next = item ? previous.map((row, index) => index === item.sourceIndex ? record : row) : previous.concat(record);
      if (await commit("dictionary", next, previous)) api.closeModal();
    });
  }

  function openEntityName() {
    api.openModal("개체명 추가", '<form class="asset-editor asset-editor--small" data-name-form><label class="asset-field"><span>개체명 <b>*</b></span><input name="name" maxlength="100" required><small><b data-count>0</b>/100</small></label><div class="modal-actions"><button type="button" class="ghost-button" data-cancel>취소</button><button type="submit" class="primary-button">확인</button></div></form>');
    prepareModal(true);
    const root = modalBody();
    const form = root?.querySelector("[data-name-form]");
    form?.elements.name.addEventListener("input", (event) => { root.querySelector("[data-count]").textContent = event.target.value.length; });
    root?.querySelector("[data-cancel]")?.addEventListener("click", api.closeModal);
    form?.addEventListener("submit", (event) => { event.preventDefault(); const name = form.elements.name.value.trim(); if (name && !entityGroups().some((group) => group.name === name)) openEntityManager("", { name, rows: [], originalName: "", isNew: true }); });
  }

  function openSystemEntity(group) {
    const rows = group.rows.map((row) => '<div class="entity-value-row"><span></span><span>' + esc(row.value || "-") + "</span><span>" + (row.rowType === "P" ? "패턴" : "동의어") + "</span><span>" + esc(row.detail || "-") + "</span></div>").join("");
    api.openModal("시스템 개체 조회", '<div class="asset-editor"><p class="asset-help">시스템 개체는 Aidot 기준 기본 개체이며 수정하거나 삭제할 수 없습니다.</p><div class="entity-value-table"><div class="entity-value-row entity-value-row--head"><span></span><span>개체값</span><span>유형</span><span>동의어/패턴</span></div>' + rows + '</div><div class="modal-actions"><button type="button" class="primary-button" data-close>확인</button></div></div>');
    prepareModal(false);
    modalBody()?.querySelector("[data-close]")?.addEventListener("click", api.closeModal);
  }

  function openEntityManager(key, supplied) {
    const group = entityGroups().find((entry) => entry.id === key);
    if (group?.system) return openSystemEntity(group);
    const session = supplied || { name: group?.name || "", rows: (group?.rows || []).map((row) => Object.assign({}, row)), originalName: group?.name || "", isNew: !group };
    const title = session.isNew ? "개체값 조회(개체 생성)" : "개체값 조회";
    api.openModal(title, '<div class="asset-editor"><div class="asset-management__meta"><strong>전체 ' + session.rows.length + '건</strong><select><option>25개씩 보기</option></select><button type="button" class="ghost-button" data-value-delete disabled>삭제</button><span class="asset-spacer"></span><button type="button" class="ghost-button" data-pick>+ 사전 불러오기</button><button type="button" class="primary-button" data-value-add>+ 개체값 추가</button></div><label class="asset-search asset-search--box"><input type="search" data-value-search placeholder="개체값, 동의어 또는 패턴을 검색하세요."></label><div class="entity-value-table"><div class="entity-value-row entity-value-row--head"><span><input type="checkbox" data-value-all></span><span>개체값</span><span>유형</span><span>동의어/패턴</span></div><div data-value-rows></div></div><div class="asset-management__pager"><strong>1</strong></div><div class="modal-actions"><button type="button" class="ghost-button" data-cancel>취소</button><button type="button" class="primary-button" data-manager-save>저장</button></div></div>');
    prepareModal(false);
    const root = modalBody();
    const draw = () => {
      const query = String(root.querySelector("[data-value-search]")?.value || "").toLocaleLowerCase();
      root.querySelector("[data-value-rows]").innerHTML = session.rows.map((row, index) => ({ row, index })).filter((entry) => !query || JSON.stringify(entry.row).toLocaleLowerCase().includes(query)).map((entry) =>
        '<div class="entity-value-row"><span><input type="checkbox" data-value-select="' + entry.index + '"></span><span><button type="button" class="asset-text-link" data-value-edit="' + entry.index + '">' + esc(entry.row.value || "-") +
        "</button></span><span>" + (entry.row.rowType === "P" ? "패턴" : "동의어") + "</span><span>" + esc(entry.row.detail || "-") + "</span></div>").join("") || '<p class="asset-empty-row">등록된 개체값이 없습니다. 먼저 개체값을 추가해주세요.</p>';
      root.querySelectorAll("[data-value-edit]").forEach((button) => button.addEventListener("click", () => openEntityValueEditor(session, Number(button.dataset.valueEdit))));
      root.querySelectorAll("[data-value-select]").forEach((input) => input.addEventListener("change", () => { root.querySelector("[data-value-delete]").disabled = !root.querySelector("[data-value-select]:checked"); }));
    };
    draw();
    root?.querySelector("[data-value-search]")?.addEventListener("input", draw);
    root?.querySelector("[data-value-add]")?.addEventListener("click", () => openEntityValueEditor(session));
    root?.querySelector("[data-pick]")?.addEventListener("click", () => openDictionaryPicker(session));
    root?.querySelector("[data-value-delete]")?.addEventListener("click", () => { const selected = new Set(Array.from(root.querySelectorAll("[data-value-select]:checked")).map((input) => Number(input.dataset.valueSelect))); session.rows = session.rows.filter((_, index) => !selected.has(index)); draw(); });
    root?.querySelector("[data-value-all]")?.addEventListener("change", (event) => { root.querySelectorAll("[data-value-select]").forEach((input) => { input.checked = event.target.checked; }); root.querySelector("[data-value-delete]").disabled = !event.target.checked; });
    root?.querySelector("[data-cancel]")?.addEventListener("click", api.closeModal);
    root?.querySelector("[data-manager-save]")?.addEventListener("click", async () => {
      const previous = api.getEntities();
      const kept = previous.filter((row) => row.system || row.name !== session.originalName);
      const added = session.rows.map((row) => stamp(Object.assign({}, row, { id: row.id || makeId("entity-value"), name: session.name, system: false })));
      if (await commit("entity", kept.concat(added), previous)) api.closeModal();
    });
  }

  function openEntityValueEditor(session, index) {
    const sourceIndex = Number.isInteger(index) ? index : -1;
    const original = sourceIndex >= 0 ? session.rows[sourceIndex] : null;
    const draft = { value: original?.value || "", type: original?.rowType === "P" ? "P" : "S", details: String(original?.detail || "").split(",").map((value) => value.trim()).filter(Boolean) };
    api.openModal(sourceIndex >= 0 ? "개체값 수정" : "개체값 생성", '<form class="asset-editor" data-value-form><label class="asset-field"><span>개체값 <b>*</b></span><input name="value" maxlength="100" required value="' + esc(draft.value) + '"><small><b data-count>' + draft.value.length + '</b>/100</small></label><div class="entity-type"><strong>유형</strong><label><input type="radio" name="type" value="S" ' + (draft.type === "S" ? "checked" : "") + '> 동의어</label><label><input type="radio" name="type" value="P" ' + (draft.type === "P" ? "checked" : "") + ' > 패턴</label></div><div data-details></div><div class="modal-actions"><button type="button" class="ghost-button" data-back>취소</button><button type="submit" class="primary-button">저장</button></div></form>');
    prepareModal(false);
    const root = modalBody();
    const form = root?.querySelector("[data-value-form]");
    const draw = () => {
      const pattern = draft.type === "P";
      root.querySelector("[data-details]").innerHTML = '<label class="asset-field"><span>' + (pattern ? "패턴 *" : "동의어") + '</span><div class="asset-inline"><input data-detail-input maxlength="' + (pattern ? 256 : 100) + '"><button type="button" class="ghost-button" data-detail-add>추가</button></div></label>' +
        (pattern ? '<button type="button" class="ghost-button" data-regex-check>정규식 확인</button>' : "") + '<div class="asset-list-head"><strong>' + (pattern ? "패턴" : "동의어") + ' 목록</strong><button type="button" class="danger-button" data-detail-delete>삭제</button></div><div class="asset-editor-list">' +
        (draft.details.map((value, detailIndex) => '<label><input type="checkbox" data-detail-select="' + detailIndex + '"><span>' + esc(value) + "</span></label>").join("") || "<p>등록된 항목이 없습니다.</p>") + "</div>" +
        (pattern ? '<div class="regex-test"><strong>정규식 테스트</strong><div class="asset-inline"><input data-test-text placeholder="테스트할 문장을 입력하세요."><button type="button" class="ghost-button" data-regex-test>테스트</button></div><p data-regex-result></p></div>' : "");
      root.querySelector("[data-detail-add]")?.addEventListener("click", () => { const input = root.querySelector("[data-detail-input]"); const value = input.value.trim(); if (value && !draft.details.includes(value)) draft.details.push(value); draw(); });
      root.querySelector("[data-detail-delete]")?.addEventListener("click", () => { const selected = new Set(Array.from(root.querySelectorAll("[data-detail-select]:checked")).map((input) => Number(input.dataset.detailSelect))); draft.details = draft.details.filter((_, detailIndex) => !selected.has(detailIndex)); draw(); });
      root.querySelector("[data-regex-check]")?.addEventListener("click", () => { try { draft.details.forEach((value) => new RegExp(value)); alert("정규식이 유효합니다."); } catch (error) { alert("정규식 오류: " + error.message); } });
      root.querySelector("[data-regex-test]")?.addEventListener("click", () => { try { const text = root.querySelector("[data-test-text]").value; root.querySelector("[data-regex-result]").textContent = draft.details.some((value) => new RegExp(value).test(text)) ? "일치합니다." : "일치하지 않습니다."; } catch (error) { root.querySelector("[data-regex-result]").textContent = "정규식 오류: " + error.message; } });
    };
    draw();
    form?.elements.value.addEventListener("input", (event) => { root.querySelector("[data-count]").textContent = event.target.value.length; });
    form?.querySelectorAll("[name=type]").forEach((input) => input.addEventListener("change", () => { draft.type = input.value; draft.details = []; draw(); }));
    root?.querySelector("[data-back]")?.addEventListener("click", () => openEntityManager("", session));
    form?.addEventListener("submit", (event) => { event.preventDefault(); const value = form.elements.value.value.trim(); if (!value || (draft.type === "P" && !draft.details.length)) return; const next = Object.assign({}, original, { value, rowType: draft.type, detail: draft.details.join(", ") }); if (sourceIndex >= 0) session.rows[sourceIndex] = next; else session.rows.push(next); openEntityManager("", session); });
  }

  function openDictionaryPicker(session) {
    const rows = dictionaryRows();
    api.openModal("사전 불러오기", '<div class="asset-editor"><div class="asset-management__meta"><strong>전체 ' + rows.length + '건</strong><select><option>25개씩 보기</option></select></div><label class="asset-search asset-search--box"><input type="search" data-picker-search placeholder="단어 또는 동의어를 검색하세요."></label><div class="asset-editor-list" data-picker-list></div><div class="modal-actions"><button type="button" class="ghost-button" data-back>취소</button><button type="button" class="primary-button" data-load>불러오기</button></div></div>');
    prepareModal(false);
    const root = modalBody();
    const draw = () => { const query = String(root.querySelector("[data-picker-search]")?.value || "").toLocaleLowerCase(); root.querySelector("[data-picker-list]").innerHTML = rows.filter((row) => !query || JSON.stringify(row).toLocaleLowerCase().includes(query)).map((row) => '<label><input type="checkbox" data-picker="' + esc(row.id) + '"><span><b>' + esc(row.word) + "</b> " + (row.synonyms || []).map(esc).join(", ") + "</span></label>").join("") || "<p>불러올 수 있는 사전이 없습니다.</p>"; };
    draw();
    root?.querySelector("[data-picker-search]")?.addEventListener("input", draw);
    root?.querySelector("[data-back]")?.addEventListener("click", () => openEntityManager("", session));
    root?.querySelector("[data-load]")?.addEventListener("click", () => { const selected = new Set(Array.from(root.querySelectorAll("[data-picker]:checked")).map((input) => input.dataset.picker)); rows.filter((row) => selected.has(row.id)).forEach((row) => { if (!session.rows.some((item) => item.value === row.word)) session.rows.push({ value: row.word, rowType: "S", detail: (row.synonyms || []).join(", ") }); }); openEntityManager("", session); });
  }

  return { renderEntity: () => render("entity"), renderDictionary: () => render("dictionary") };
}
