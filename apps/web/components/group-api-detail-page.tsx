"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiEditorDialog } from "@/components/api-store-list-page";
import { useI18n } from "@/components/language-provider";
import { normalizeApiAssets, type VersionApiAsset } from "@/lib/api-assets";
import { hasApiWriteRole, loadAuthSession, type AuthSession } from "@/lib/auth";
import { API_MANAGEMENT_CATALOGS } from "@/lib/i18n/api-management";
import { fetchStudioGroupApis, updateStudioGroupApis } from "@/lib/studio-bots-api";

type OutputRow = {
  key: string;
  name: string;
  dataType: string;
  depth: number;
};

function apiIdentity(api: VersionApiAsset) {
  return api.apiKey || api.id;
}

function formatDateTime(value: string) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

function getOutputDepth(path: string) {
  const normalizedPath = path.replace(/^root\.?/, "").replace(/\[\]/g, "");
  return normalizedPath.split(".").filter(Boolean).length;
}

function getOutputRows(method: VersionApiAsset["methods"][number]): OutputRow[] {
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

export function GroupApiDetailPage() {
  const { language: uiLanguage } = useI18n();
  const copy = API_MANAGEMENT_CATALOGS[uiLanguage];
  const params = useParams<{ apiId: string }>();
  const router = useRouter();
  const apiId = decodeURIComponent(params.apiId);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [apis, setApis] = useState<VersionApiAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [testInputs, setTestInputs] = useState<Record<string, Record<string, string>>>({});
  const [testOutputs, setTestOutputs] = useState<Record<string, string>>({});
  const [testingMethodId, setTestingMethodId] = useState("");

  useEffect(() => {
    const session = loadAuthSession();
    setAuthSession(session);
    if (!session) {
      setLoading(false);
      setErrorMessage("로그인이 필요합니다.");
      return;
    }

    let ignore = false;
    setLoading(true);
    setErrorMessage("");

    fetchStudioGroupApis(session.access_token)
      .then((response) => {
        if (!ignore) {
          setApis(normalizeApiAssets(response.items));
        }
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : "API 정보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const api = useMemo(
    () =>
      normalizeApiAssets(apis).find((item) => {
        const candidates = [apiIdentity(item), item.id, item.apiKey].filter(Boolean);
        return candidates.includes(apiId);
      }) ?? null,
    [apiId, apis],
  );
  const canWriteApi = hasApiWriteRole(authSession?.user.roles ?? []);

  async function handleSaveApi(nextApi: VersionApiAsset) {
    if (!authSession || !api) {
      router.replace("/login");
      return;
    }
    if (!canWriteApi) {
      setErrorMessage("API 수정 권한이 없습니다.");
      setEditing(false);
      return;
    }

    const targetKey = apiIdentity(api);
    const nextApis = normalizeApiAssets(apis).map((item) =>
      apiIdentity(item) === targetKey
        ? {
            ...nextApi,
            id: item.id || nextApi.id,
            type: "api" as const,
            category: item.category || "API",
            apiKey: item.apiKey || nextApi.apiKey,
            updatedAt: new Date().toISOString(),
            updatedBy: authSession.user.login_id,
          }
        : item,
    );

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      const response = await updateStudioGroupApis(authSession.access_token, nextApis);
      setApis(normalizeApiAssets(response.items));
      setEditing(false);
      setMessage("API가 수정되었습니다.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "API 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApi() {
    if (!authSession || !api) {
      router.replace("/login");
      return;
    }
    if (!canWriteApi) {
      setErrorMessage("API 삭제 권한이 없습니다.");
      return;
    }
    if (!window.confirm(copy.confirmDelete)) {
      return;
    }

    const targetKey = apiIdentity(api);
    const nextApis = normalizeApiAssets(apis).filter((item) => apiIdentity(item) !== targetKey);

    setSaving(true);
    setMessage("");
    setErrorMessage("");
    try {
      await updateStudioGroupApis(authSession.access_token, nextApis);
      router.push("/studio/apis");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "API 삭제 중 오류가 발생했습니다.");
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
        [methodId]: error instanceof Error ? error.message : "API 테스트 중 오류가 발생했습니다.",
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
            <Link href="/studio/apis">API</Link>
            <span>&gt;</span>
            <span>{copy.view}</span>
          </h1>
          <p>{api?.baseUrl ?? copy.summary}</p>
        </div>
        <div className="api-detail-page__actions">
          {api && canWriteApi ? (
            <>
              <button type="button" className="studio-table-page__ghost" disabled={saving} onClick={handleDeleteApi}>
                {copy.delete}
              </button>
              <button type="button" className="studio-table-page__primary" disabled={saving} onClick={() => setEditing(true)}>
                {copy.edit}
              </button>
            </>
          ) : null}
          <Link className="studio-table-page__ghost" href="/studio/apis">
            {copy.list}
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
              <strong>{copy.basic}</strong>
              <div className="api-detail-page__info-grid">
                <dl>
                  <dt>{copy.apiName}</dt>
                  <dd>{api.name}</dd>
                  <dt>{copy.description}</dt>
                  <dd>{api.description || "-"}</dd>
                  <dt>{copy.createdAt}</dt>
                  <dd>{formatDateTime(api.updatedAt)}</dd>
                  <dt>{copy.updatedAt}</dt>
                  <dd>{formatDateTime(api.updatedAt)}</dd>
                </dl>
                <dl>
                  <dt>API Key</dt>
                  <dd>{api.apiKey}</dd>
                  <dt>{copy.baseUrl}</dt>
                  <dd>{api.baseUrl}</dd>
                  <dt>{copy.creator}</dt>
                  <dd>{api.updatedBy || "-"}</dd>
                  <dt>{copy.updatedBy}</dt>
                  <dd>{api.updatedBy || "-"}</dd>
                </dl>
              </div>
            </section>

            <section className="api-detail-page__section">
              <strong>{copy.methods}</strong>
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
                          <span className="api-detail-page__method-description">
                            {method.description || copy.methodDescription}
                          </span>
                        </span>
                      </span>
                      <span className="api-detail-page__method-chevron">⌄</span>
                    </summary>
                    <div className="api-detail-page__method-body">
                      <strong className="api-detail-page__method-subhead">{copy.basicInfo}</strong>
                      <div className="api-detail-page__method-config">
                        <dl>
                          <dt>{copy.methodUrl}</dt>
                          <dd>{method.methodUrl || "-"}</dd>
                          <dt>{copy.type}</dt>
                          <dd>
                            <label>
                              <input type="checkbox" checked={method.loggingEnabled} readOnly /> {copy.logging}
                            </label>
                            <label>
                              <input type="checkbox" checked={method.proxyEnabled} readOnly /> {copy.proxy}
                            </label>
                          </dd>
                        </dl>
                        <dl>
                          <dt>{copy.description}</dt>
                          <dd>{method.description || "-"}</dd>
                          <dt>{copy.transfer}</dt>
                          <dd>
                            <label>
                              <input type="radio" checked readOnly /> {copy.sync}
                            </label>
                            <label className="is-disabled">
                              <input type="radio" disabled readOnly /> {copy.async}
                            </label>
                          </dd>
                        </dl>
                      </div>
                      <div className="api-detail-page__method-main">
                        <section>
                          <strong>{copy.parameters}</strong>
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>{copy.parameterDescription}</th>
                                <th>{copy.parameterType}</th>
                                <th>Data type</th>
                                <th>{copy.testInput}</th>
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
                          <strong>{copy.response}</strong>
                          <div className="api-detail-page__output-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Data type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getOutputRows(method).map((row) => (
                                  <tr key={row.key}>
                                    <td>
                                      <span className="api-detail-page__output-name" style={{ paddingLeft: `${row.depth * 12}px` }}>
                                        {row.name}
                                      </span>
                                    </td>
                                    <td>{row.dataType}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      </div>
                      <section className="api-detail-page__test-output">
                        <div className="api-detail-page__test-output-head">
                          <strong>Test Output</strong>
                          <button type="button" disabled={testingMethodId === method.id} onClick={() => void handleTestMethod(method.id)}>
                            Test
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
      ) : loading ? (
        <p className="manual-main__status">{copy.loading}</p>
      ) : (
        <p className="manual-main__status manual-main__status--error">{errorMessage || copy.notFound}</p>
      )}
    </section>
  );
}
