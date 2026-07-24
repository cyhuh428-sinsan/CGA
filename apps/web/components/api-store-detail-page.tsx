"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiEditorDialog } from "@/components/api-store-list-page";
import { useI18n } from "@/components/language-provider";
import { useStudioWorkspace } from "@/components/studio-workspace-provider";
import { normalizeApiAssets, withUpdatedApiAssets, type VersionApiAsset } from "@/lib/api-assets";
import { applyUpdatedVersionToBot } from "@/lib/dialog-assets";
import { API_MANAGEMENT_CATALOGS } from "@/lib/i18n/api-management";
import { hasApiWriteRole, saveLastBotScreen, type AuthSession } from "@/lib/auth";
import {
  fetchStudioBotVersionApis,
  type StudioBotApiItem,
  type StudioBotVersionApiItem,
  updateStudioBotVersionApis,
} from "@/lib/studio-bots-api";
import { normalizeVersionDocument } from "@/lib/version-document";

type OutputRow = {
  key: string;
  name: string;
  dataType: string;
  depth: number;
};

function getOutputDepth(path: string) {
  const normalizedPath = path.replace(/^root\.?/, "").replace(/\[\]/g, "");
  const segmentCount = normalizedPath.split(".").filter(Boolean).length;
  return segmentCount;
}

function getOutputRows(method: VersionApiAsset["methods"][number]) {
  if (method.outputParameters.length > 0) {
    const rows = method.outputParameters.map((parameter) => ({
      key: parameter.id,
      name: parameter.name || parameter.path || "-",
      dataType: parameter.dataType,
      depth: getOutputDepth(parameter.path),
    }));
    const hasRoot = method.outputParameters.some((parameter) => parameter.path === "root");
    return hasRoot
      ? rows
      : [
          {
            key: "root",
            name: "root",
            dataType: "object",
            depth: 0,
          },
          ...rows,
        ];
  }

  return [
    {
      key: "root",
      name: "root",
      dataType: "object",
      depth: 0,
    },
  ];
}

export function ApiStoreDetailPage() {
  const workspace = useStudioWorkspace();
  const { language: uiLanguage } = useI18n();
  const common = API_MANAGEMENT_CATALOGS[uiLanguage];
  const params = useParams<{ botId: string; versionId: string; apiId: string }>();
  const router = useRouter();
  const botId = workspace.bot.id || decodeURIComponent(params.botId);
  const versionId = decodeURIComponent(params.versionId);
  const apiId = decodeURIComponent(params.apiId);
  const sectionFetchKeyRef = useRef("");
  const [authSession, setAuthSession] = useState<AuthSession | null>(workspace.session);
  const [bot, setBot] = useState<StudioBotApiItem | null>(workspace.bot);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [testInputs, setTestInputs] = useState<Record<string, Record<string, string>>>({});
  const [testOutputs, setTestOutputs] = useState<Record<string, string>>({});
  const [testingMethodId, setTestingMethodId] = useState("");

  useEffect(() => {
    setAuthSession(workspace.session);
    setBot(workspace.bot);
    setErrorMessage("");
    saveLastBotScreen(`/studio/bots/${botId}/versions/${versionId}/intents`);
  }, [botId, versionId, workspace.bot, workspace.session]);

  useEffect(() => {
    const version = bot?.active_version;
    if (!authSession || !bot || !version) {
      return;
    }

    const fetchKey = `${bot.id}:${version.id}`;
    if (sectionFetchKeyRef.current === fetchKey) {
      return;
    }
    sectionFetchKeyRef.current = fetchKey;

    let ignore = false;
    fetchStudioBotVersionApis(authSession.access_token, bot.id, version.id)
      .then((response) => {
        if (ignore) {
          return;
        }
        const nextDocument = withUpdatedApiAssets(normalizeVersionDocument(version.version_json), normalizeApiAssets(response.items));
        const updatedVersion: StudioBotVersionApiItem = {
          ...response.version,
          version_json: nextDocument,
          asset_counts: response.asset_counts,
          scenario_validation: response.scenario_validation,
        };
        setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : common.detailLoadFailed);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authSession, bot, bot?.active_version]);

  const api = useMemo(() => {
    const document = normalizeVersionDocument(bot?.active_version?.version_json);
    return normalizeApiAssets(document.apis).find((item) => item.id === apiId) ?? null;
  }, [apiId, bot?.active_version?.version_json]);
  const canWriteApi = hasApiWriteRole(authSession?.user.roles ?? []);

  async function handleSaveApi(nextApi: VersionApiAsset) {
    if (!authSession || !bot?.active_version || !api) {
      router.replace("/login");
      return;
    }
    if (!canWriteApi) {
      setErrorMessage(common.editForbidden);
      setEditing(false);
      return;
    }

    const document = normalizeVersionDocument(bot.active_version.version_json);
    const apis = normalizeApiAssets(document.apis);
    const nextApis = apis.map((item) =>
      item.id === api.id
        ? {
            ...nextApi,
            id: api.id,
            type: "api" as const,
            category: api.category,
            apiKey: api.apiKey,
            updatedAt: new Date().toISOString(),
            updatedBy: authSession.user.login_id,
          }
        : item,
    );

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await updateStudioBotVersionApis(authSession.access_token, bot.id, bot.active_version.id, nextApis);
      const nextDocument = withUpdatedApiAssets(document, normalizeApiAssets(response.items));
      const updatedVersion: StudioBotVersionApiItem = {
        ...response.version,
        version_json: nextDocument,
        asset_counts: response.asset_counts,
        scenario_validation: response.scenario_validation,
      };
      setBot((current) => (current ? applyUpdatedVersionToBot(current, updatedVersion) : current));
      setEditing(false);
      setMessage(common.updatedWithDesignNotice);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : common.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApi() {
    if (!authSession || !bot?.active_version || !api) {
      router.replace("/login");
      return;
    }
    if (!canWriteApi) {
      setErrorMessage(common.deleteForbidden);
      return;
    }
    if (!window.confirm(common.confirmDelete)) {
      return;
    }

    const document = normalizeVersionDocument(bot.active_version.version_json);
    const apis = normalizeApiAssets(document.apis);
    const nextApis = apis.filter((item) => item.id !== api.id);

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const nextDocument = withUpdatedApiAssets(document, nextApis);
      await updateStudioBotVersionApis(authSession.access_token, bot.id, bot.active_version.id, nextDocument.apis);
      router.push(`/studio/bots/${botId}/versions/${versionId}/apis`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : common.deleteFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestMethod(methodId: string) {
    if (!api) {
      return;
    }

    const method = api.methods.find((item) => item.id === methodId);
    const parameterValues =
      method?.parameters.reduce<Record<string, string>>((values, parameter) => {
        values[parameter.name] = testInputs[methodId]?.[parameter.name] ?? parameter.defaultValue;
        return values;
      }, {}) ?? {};

    setTestingMethodId(methodId);
    setErrorMessage("");
    try {
      const response = await fetch("/api/function/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api,
          methodId,
          variables: {},
          parameterValues,
        }),
      });
      const result = await response.json();
      setTestOutputs((current) => ({
        ...current,
        [methodId]: JSON.stringify(result, null, 2),
      }));
    } catch (error) {
      setTestOutputs((current) => ({
        ...current,
        [methodId]: error instanceof Error ? error.message : common.testFailed,
      }));
    } finally {
      setTestingMethodId("");
    }
  }

  if (api && editing) {
    return (
      <section className="studio-table-page api-store-page api-store-page--editor">
        <ApiEditorDialog
          initialApi={api}
          apiKeyLocked
          saving={saving}
          onClose={() => setEditing(false)}
          onSave={handleSaveApi}
        />
      </section>
    );
  }

  return (
    <section className="studio-table-page api-detail-page">
      <header className="studio-table-page__title-row">
        <div>
          <h1>
            <Link href={`/studio/bots/${botId}/versions/${versionId}/apis`}>API</Link>
            <span>&gt;</span>
            <span>{common.detailTitle}</span>
          </h1>
          <p>{api?.baseUrl ?? common.detailIntro}</p>
        </div>
        <div className="api-detail-page__actions">
          {api && canWriteApi ? (
            <>
              <button type="button" className="studio-table-page__ghost" disabled={saving} onClick={handleDeleteApi}>
                {common.delete}
              </button>
              <button type="button" className="studio-table-page__primary" disabled={saving} onClick={() => setEditing(true)}>
                {common.edit}
              </button>
            </>
          ) : null}
          <Link className="studio-table-page__ghost" href={`/studio/bots/${botId}/versions/${versionId}/apis`}>
            {common.list}
          </Link>
        </div>
      </header>

      {api ? (
        <div className="api-detail-page__body">
          {message || errorMessage ? (
            <div className="api-detail-page__status-slot">
              {message ? <p className="manual-main__status manual-main__status--success">{message}</p> : null}
              {errorMessage ? <p className="manual-main__status manual-main__status--error">{errorMessage}</p> : null}
            </div>
          ) : null}
          <div className="api-detail-page__content">
            <section className="api-detail-page__section">
              <strong>{common.apiBasic}</strong>
              <div className="api-detail-page__info-grid">
                <dl>
                  <dt>{common.apiName}</dt>
                  <dd>{api.name}</dd>
                  <dt>{common.description}</dt>
                  <dd>{api.description || "-"}</dd>
                  <dt>{common.createdAt}</dt>
                  <dd>{api.updatedAt ? api.updatedAt.replace("T", " ").slice(0, 19) : "-"}</dd>
                  <dt>{common.updatedAt}</dt>
                  <dd>{api.updatedAt ? api.updatedAt.replace("T", " ").slice(0, 19) : "-"}</dd>
                </dl>
                <dl>
                  <dt>API Key</dt>
                  <dd>{api.apiKey}</dd>
                  <dt>{common.baseUrl}</dt>
                  <dd>{api.baseUrl}</dd>
                  <dt>{common.creator}</dt>
                  <dd>{api.updatedBy || "-"}</dd>
                  <dt>{common.updatedBy}</dt>
                  <dd>{api.updatedBy || "-"}</dd>
                </dl>
              </div>
            </section>

            <section className="api-detail-page__section">
              <strong>{common.methods}</strong>
              <div className="api-detail-page__method-list">
              {api.methods.map((method) => (
                <details key={method.id} className="api-detail-page__method">
                  <summary>
                    <span className="api-detail-page__method-summary">
                      <span>
                        <span className="api-detail-page__method-badge api-detail-page__method-badge--get">{method.httpMethod}</span>
                        <span className="api-detail-page__method-url">{method.methodUrl || "-"}</span>
                      </span>
                      <span>
                        <span className="api-detail-page__method-badge api-detail-page__method-badge--sync">Sync</span>
                        <span className="api-detail-page__method-description">{method.description || common.methodDescription}</span>
                      </span>
                    </span>
                    <span className="api-detail-page__method-chevron">⌄</span>
                  </summary>
                  <div className="api-detail-page__method-body">
                    <strong className="api-detail-page__method-subhead">{common.basicInfo}</strong>
                    <div className="api-detail-page__method-config">
                      <dl>
                        <dt>{common.methodUrl}</dt>
                        <dd>{method.methodUrl || "-"}</dd>
                        <dt>{common.type}</dt>
                        <dd>
                          <label>
                            <input type="checkbox" checked={method.loggingEnabled} readOnly /> {common.logging}
                          </label>
                          <label>
                            <input type="checkbox" checked={method.proxyEnabled} readOnly /> {common.proxy}
                          </label>
                        </dd>
                      </dl>
                      <dl>
                        <dt>{common.description}</dt>
                        <dd>{method.description || "-"}</dd>
                        <dt>{common.transfer}</dt>
                        <dd>
                          <label>
                            <input type="radio" checked readOnly /> {common.sync}
                          </label>
                          <label className="is-disabled">
                            <input type="radio" disabled readOnly /> {common.async}
                          </label>
                        </dd>
                      </dl>
                    </div>
                    <div className="api-detail-page__method-main">
                      <section>
                        <strong>{common.parameters}</strong>
                        <table>
                          <thead>
                            <tr>
                              <th>{common.name}</th>
                              <th>{common.parameterDescription}</th>
                              <th>{common.parameterType}</th>
                              <th>{common.dataType}</th>
                              <th>{common.testInput}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {method.parameters.length > 0 ? (
                              method.parameters.map((parameter) => (
                                <tr key={parameter.id}>
                                  <td>{parameter.name || "-"}</td>
                                  <td>{parameter.description || "-"}</td>
                                  <td>{parameter.location}</td>
                                  <td>{parameter.dataType}</td>
                                  <td>
                                    <input
                                      value={testInputs[method.id]?.[parameter.name] ?? parameter.defaultValue}
                                      onChange={(event) =>
                                        setTestInputs((current) => ({
                                          ...current,
                                          [method.id]: {
                                            ...(current[method.id] ?? {}),
                                            [parameter.name]: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} />
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </section>
                      <section>
                        <strong>{common.response}</strong>
                        <div className="api-detail-page__output-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>{common.name}</th>
                                <th>{common.dataType}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getOutputRows(method).length > 0 ? (
                                getOutputRows(method).map((row) => (
                                  <tr key={row.key}>
                                    <td>
                                      <span
                                        className="api-detail-page__output-name"
                                        style={{ paddingLeft: `${row.depth * 12}px` }}
                                      >
                                        {row.name}
                                      </span>
                                    </td>
                                    <td>{row.dataType}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={2} />
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </div>
                    <section className="api-detail-page__test-output">
                      <div className="api-detail-page__test-output-head">
                        <strong>{common.testOutput}</strong>
                        <button type="button" disabled={testingMethodId === method.id} onClick={() => void handleTestMethod(method.id)}>
                          {common.test}
                        </button>
                      </div>
                      <pre>{testOutputs[method.id] ?? ""}</pre>
                    </section>
                  </div>
                </details>
              ))}
              </div>
            </section>
          </div>
        </div>
      ) : !errorMessage ? (
        <p className="manual-main__status">{common.detailLoading}</p>
      ) : null}
    </section>
  );
}
