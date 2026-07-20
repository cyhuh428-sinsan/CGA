"use client";

import { useEffect, useMemo, useState } from "react";

import { BotSettingsShell } from "@/components/bot-settings-shell";
import { SortHeaderLabel } from "@/components/sort-header-label";
import { fetchChannels, type AdminChannelItem } from "@/lib/admin-api";
import {
  type BotStationChannelConfig,
  type BotStationSettingsConfig,
} from "@/lib/bot-settings";

type AdminChannelMeta = {
  provider: string;
  rendererType: string;
  endpointUrl: string;
  authType: string;
};

function isKakaoMeta(meta: AdminChannelMeta | null) {
  return Boolean(meta && (meta.provider.trim().toLowerCase() === "kakao" || meta.rendererType.trim().toLowerCase() === "kakao"));
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function readAdminChannelMeta(adminChannel: AdminChannelItem): AdminChannelMeta {
  const source = adminChannel.data_json ?? {};
  return {
    provider: typeof source.provider === "string" && source.provider.trim() ? source.provider.trim() : "webchat",
    rendererType:
      typeof source.renderer_type === "string" && source.renderer_type.trim()
        ? source.renderer_type.trim()
        : "webchat",
    endpointUrl:
      typeof source.endpoint_url === "string" && source.endpoint_url.trim() ? source.endpoint_url.trim() : "",
    authType: typeof source.auth_type === "string" && source.auth_type.trim() ? source.auth_type.trim() : "none",
  };
}

function normalizeChannel(channel: Partial<BotStationChannelConfig>): BotStationChannelConfig {
  const channelId = channel.channelId ?? channel.id ?? "";
  const channelCode = channel.channelCode ?? channel.id ?? "";
  const channelName = channel.channelName ?? channel.name ?? "";

  return {
    id: channel.id ?? channelId,
    channelId,
    channelCode,
    channelName,
    botIdentifier: channel.botIdentifier ?? "",
    botName: channel.botName ?? "",
    name: channel.name ?? channelName,
    enabled: Boolean(channel.enabled),
    appId: channel.appId ?? "",
    appSecret: channel.appSecret ?? "",
    callbackUrl: channel.callbackUrl ?? "",
    description: channel.description ?? "",
    updatedAt: channel.updatedAt ?? "",
  };
}

function buildChannelConfig(
  adminChannel: AdminChannelItem,
  current?: Partial<BotStationChannelConfig>,
  bot?: { id: string; name: string },
): BotStationChannelConfig {
  const channelMeta = readAdminChannelMeta(adminChannel);
  return normalizeChannel({
    ...current,
    id: adminChannel.id,
    channelId: adminChannel.id,
    channelCode: adminChannel.code,
    channelName: adminChannel.name,
    botIdentifier: current?.botIdentifier ?? bot?.id ?? "",
    botName: current?.botName ?? bot?.name ?? "",
    name: adminChannel.name,
    callbackUrl: current?.callbackUrl ?? channelMeta.endpointUrl,
    description: current?.description ?? adminChannel.description ?? "",
  });
}

function hasConnectionInfo(channel: BotStationChannelConfig) {
  return Boolean(
    channel.appId.trim() ||
      channel.appSecret.trim() ||
      channel.callbackUrl.trim() ||
      channel.botIdentifier.trim() ||
      channel.description.trim(),
  );
}

function connectionSummary(adminChannel: AdminChannelItem, channel: BotStationChannelConfig) {
  const meta = readAdminChannelMeta(adminChannel);
  const hasSaved = hasConnectionInfo(channel);
  if (hasSaved) {
    return "저장됨";
  }
  if (meta.endpointUrl) {
    return "기본 webhook 사용";
  }
  return "저장되지 않음";
}

export function BotStationSettingsPage() {
  return (
    <BotSettingsShell activeMenu="botstation">
      {({ bot, token, versionSettings, saveVersionSettings, setErrorMessage, setMessage }) => {
        const [adminChannels, setAdminChannels] = useState<AdminChannelItem[]>([]);
        const [loadingChannels, setLoadingChannels] = useState(true);
        const [form, setForm] = useState<BotStationSettingsConfig>(versionSettings.botstation);
        const [saving, setSaving] = useState(false);
        const [editingChannel, setEditingChannel] = useState<BotStationChannelConfig | null>(null);

        useEffect(() => {
          if (!token) {
            return;
          }

          let ignore = false;
          setLoadingChannels(true);
          fetchChannels(token)
            .then((response) => {
              if (!ignore) {
                setAdminChannels(response.items);
              }
            })
            .catch((error) => {
              if (!ignore) {
                setErrorMessage(error instanceof Error ? error.message : "채널 목록을 불러오지 못했습니다.");
              }
            })
            .finally(() => {
              if (!ignore) {
                setLoadingChannels(false);
              }
            });

          return () => {
            ignore = true;
          };
        }, [setErrorMessage, token]);

        useEffect(() => {
          setForm({
            ...versionSettings.botstation,
            channels: versionSettings.botstation.channels.map(normalizeChannel),
          });
          setEditingChannel(null);
        }, [versionSettings]);

        const channelRows = useMemo(() => {
          const savedChannels = new Map(
            form.channels.map((channel) => {
              const normalized = normalizeChannel(channel);
              return [normalized.channelId || normalized.id, normalized];
            }),
          );

          return adminChannels.map((adminChannel) => {
            const saved = savedChannels.get(adminChannel.id);
            return {
              adminChannel,
              channel: buildChannelConfig(adminChannel, saved, bot),
            };
          });
        }, [adminChannels, bot, form.channels]);

        async function persist(nextForm: BotStationSettingsConfig, successMessage: string) {
          setSaving(true);
          setErrorMessage("");
          setMessage("");
          try {
            await saveVersionSettings(
              {
                botstation: nextForm,
              },
              successMessage,
            );
          } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "봇스테이션 저장 중 오류가 발생했습니다.");
          } finally {
            setSaving(false);
          }
        }

        function handleConnect() {
          const now = new Date().toISOString();
          const nextForm = {
            ...form,
            connected: true,
            enabled: true,
            connectedAt: now,
          };
          setForm(nextForm);
          void persist(nextForm, "봇스테이션이 연결되었습니다.");
        }

        function handleToggleBotStation() {
          const nextForm = {
            ...form,
            enabled: !form.enabled,
          };
          setForm(nextForm);
          void persist(nextForm, "봇스테이션 설정이 저장되었습니다.");
        }

        function handleToggleChannel(adminChannel: AdminChannelItem, channel: BotStationChannelConfig) {
          const now = new Date().toISOString();
          const nextChannel = {
            ...buildChannelConfig(adminChannel, channel, bot),
            enabled: !channel.enabled,
            updatedAt: now,
          };
          const nextChannels = form.channels.some(
            (item) => normalizeChannel(item).channelId === nextChannel.channelId,
          )
            ? form.channels.map((item) =>
                normalizeChannel(item).channelId === nextChannel.channelId ? nextChannel : item,
              )
            : [...form.channels, nextChannel];
          const nextForm = {
            ...form,
            channels: nextChannels.map(normalizeChannel),
          };
          setForm(nextForm);
          void persist(nextForm, "봇스테이션 설정이 저장되었습니다.");
        }

        function openConnectionDialog(adminChannel: AdminChannelItem, channel: BotStationChannelConfig) {
          setEditingChannel(buildChannelConfig(adminChannel, channel, bot));
          setMessage("");
          setErrorMessage("");
        }

        function handleSaveChannel() {
          if (!editingChannel) {
            return;
          }

          const nextChannel = {
            ...editingChannel,
            updatedAt: new Date().toISOString(),
          };
          const nextChannels = form.channels.some(
            (item) => normalizeChannel(item).channelId === nextChannel.channelId,
          )
            ? form.channels.map((item) =>
                normalizeChannel(item).channelId === nextChannel.channelId ? nextChannel : item,
              )
            : [...form.channels, nextChannel];
          const nextForm = {
            ...form,
            channels: nextChannels.map(normalizeChannel),
          };
          setForm(nextForm);
          setEditingChannel(null);
          void persist(nextForm, "봇스테이션 설정이 저장되었습니다.");
        }

        return (
          <>
            <section className="botstation-settings">
              {!form.connected ? (
                <div className="botstation-settings__empty">
                  <span className="botstation-settings__connected">봇이 연결되지 않았습니다.</span>
                  <button
                    type="button"
                    className="studio-table-page__primary"
                    disabled={saving}
                    onClick={handleConnect}
                  >
                    연결
                  </button>
                </div>
              ) : (
                <>
                  <div className="botstation-settings__status">
                    <span>봇스테이션</span>
                    <label className="botstation-settings__switch">
                      <input type="checkbox" checked={form.enabled} onChange={handleToggleBotStation} />
                      <span>{form.enabled ? "사용" : "미사용"}</span>
                    </label>
                    <span className="botstation-settings__connected">
                      {form.connectedAt ? `연결일시 ${formatDateTime(form.connectedAt)}` : "봇이 연결되었습니다."}
                    </span>
                    <button
                      type="button"
                      className="studio-table-page__primary"
                      disabled={saving}
                      onClick={handleConnect}
                    >
                      연결
                    </button>
                  </div>

                  <div className="botstation-settings__table-wrap">
                    <div className="botstation-settings__count">
                      {loadingChannels ? "채널 조회 중" : `전체 ${channelRows.length}`}
                    </div>
                    <div className="settings-list-card">
                      <div className="settings-list-card__header settings-list-card__header--botstation">
                        <span>
                          <SortHeaderLabel label="채널" />
                        </span>
                        <span>설정정보</span>
                        <span>상태</span>
                      </div>

                      {channelRows.map(({ adminChannel, channel }) => (
                        <div key={adminChannel.id} className="settings-list-row settings-list-row--botstation">
                          <button
                            type="button"
                            className="settings-link-button"
                            onClick={() => openConnectionDialog(adminChannel, channel)}
                          >
                            {adminChannel.name}
                          </button>
                          <span>{connectionSummary(adminChannel, channel)}</span>
                          <label className="botstation-settings__switch botstation-settings__switch--small">
                            <input
                              type="checkbox"
                              checked={channel.enabled}
                              onChange={() => handleToggleChannel(adminChannel, channel)}
                            />
                            <span>{channel.enabled ? "사용" : "미사용"}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    {!loadingChannels && channelRows.length === 0 ? (
                      <p className="botstation-settings__notice">관리자 기능에 등록된 채널이 없습니다.</p>
                    ) : null}
                    <div className="bot-settings-page__pagination">
                      <button type="button" className="secondary-action" disabled>
                        «
                      </button>
                      <button type="button" className="secondary-action" disabled>
                        ‹
                      </button>
                      <strong>1</strong>
                      <button type="button" className="secondary-action" disabled>
                        ›
                      </button>
                      <button type="button" className="secondary-action" disabled>
                        »
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {editingChannel ? (
              <div className="entity-editor-backdrop" role="presentation">
                <div className="botstation-dialog" role="dialog" aria-modal="true" aria-label="채널 연결 정보">
                  <div className="entity-editor-dialog__header">
                    <strong>{editingChannel.channelName}</strong>
                    <button
                      type="button"
                      className="entity-editor-dialog__close"
                      aria-label="닫기"
                      onClick={() => setEditingChannel(null)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="botstation-dialog__body">
                    {(() => {
                      const channelMeta = adminChannels.find((item) => item.id === editingChannel.channelId);
                      const meta = channelMeta ? readAdminChannelMeta(channelMeta) : null;
                      return meta ? (
                        <>
                          <label className="botstation-dialog__field">
                            <span>Provider</span>
                            <input className="bot-settings-card__input" value={meta.provider} readOnly />
                          </label>
                          <label className="botstation-dialog__field">
                            <span>렌더러</span>
                            <input className="bot-settings-card__input" value={meta.rendererType} readOnly />
                          </label>
                          <label className="botstation-dialog__field">
                            <span>인증방식</span>
                            <input className="bot-settings-card__input" value={meta.authType} readOnly />
                          </label>
                        </>
                      ) : null;
                    })()}
                    <label className="botstation-dialog__field">
                      <span>채널 아이디</span>
                      <input className="bot-settings-card__input" value={editingChannel.channelCode} readOnly />
                    </label>
                    <label className="botstation-dialog__field">
                      <span>채널</span>
                      <input className="bot-settings-card__input" value={editingChannel.channelName} readOnly />
                    </label>
                    <label className="botstation-dialog__field">
                      <span>봇 UUID</span>
                      <input
                        className="bot-settings-card__input"
                        value={editingChannel.botIdentifier}
                        readOnly
                      />
                    </label>
                    <label className="botstation-dialog__field">
                      <span>봇 이름</span>
                      <input className="bot-settings-card__input" value={editingChannel.botName} readOnly />
                    </label>
                    <label className="botstation-dialog__field">
                      <span className="admin-inline-label">
                        App ID
                        <span
                          className="admin-inline-help"
                          data-help="카카오 앱 또는 스킬 식별값입니다. 운영 식별 용도이며, token 방식 검증값과는 별개입니다."
                          tabIndex={0}
                          role="img"
                          aria-label="App ID 설명"
                        >
                          i
                        </span>
                      </span>
                      <input
                        className="bot-settings-card__input"
                        value={editingChannel.appId}
                        onChange={(event) =>
                          setEditingChannel((current) =>
                            current ? { ...current, appId: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="botstation-dialog__field">
                      <span className="admin-inline-label">
                        App Secret
                        <span
                          className="admin-inline-help"
                          data-help="카카오 webhook 보호용 비밀값입니다. 1차 운영에서는 보통 채널 인증 정보 JSON의 token 또는 appSecret 값과 같은 의미로 맞춰 사용합니다."
                          tabIndex={0}
                          role="img"
                          aria-label="App Secret 설명"
                        >
                          i
                        </span>
                      </span>
                      <input
                        className="bot-settings-card__input"
                        value={editingChannel.appSecret}
                        onChange={(event) =>
                          setEditingChannel((current) =>
                            current ? { ...current, appSecret: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    <label className="botstation-dialog__field botstation-dialog__field--wide">
                      <span className="admin-inline-label">
                        Callback URL
                        <span
                          className="admin-inline-help"
                          data-help="카카오 관리자센터 또는 스킬 설정 화면에 등록할 실제 호출 주소입니다. 보통 기본 webhook 값을 그대로 사용합니다."
                          tabIndex={0}
                          role="img"
                          aria-label="Callback URL 설명"
                        >
                          i
                        </span>
                      </span>
                      <input
                        className="bot-settings-card__input"
                        value={editingChannel.callbackUrl}
                        onChange={(event) =>
                          setEditingChannel((current) =>
                            current ? { ...current, callbackUrl: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                    {(() => {
                      const channelMeta = adminChannels.find((item) => item.id === editingChannel.channelId);
                      const meta = channelMeta ? readAdminChannelMeta(channelMeta) : null;
                      if (!meta) {
                        return null;
                      }
                      return (
                        <div className="admin-form-guide admin-form-guide--wide">
                          <strong>{isKakaoMeta(meta) ? "Kakao 연결 입력 안내" : "채널 연결 입력 안내"}</strong>
                          {meta.endpointUrl ? (
                            <p>
                              기본 webhook: <code>{meta.endpointUrl}</code>
                            </p>
                          ) : null}
                          {isKakaoMeta(meta) ? (
                            <>
                              <p>
                                <code>App ID</code>는 카카오 앱/스킬 식별값, <code>App Secret</code>은 webhook 보호용 비밀값입니다.
                              </p>
                              <p>
                                <code>Callback URL</code>에는 카카오 관리자센터에 등록할 실제 호출 주소를 넣습니다. 보통 기본 webhook 값을 그대로 사용하면 됩니다.
                              </p>
                              <p>
                                1차 테스트는 채널 관리에서 인증 방식을 <code>없음</code>으로 두고 응답 왕복을 먼저 확인한 뒤, 운영 전환 시 <code>Token</code>으로 올리는 순서를 권장합니다.
                              </p>
                            </>
                          ) : (
                            <p>이 화면의 입력값은 메신저 연동 상세정보 팝업과 동일한 연결 정보입니다.</p>
                          )}
                        </div>
                      );
                    })()}
                    <label className="botstation-dialog__field botstation-dialog__field--wide">
                      <span>설명</span>
                      <textarea
                        className="bot-settings-intro__textarea"
                        value={editingChannel.description}
                        onChange={(event) =>
                          setEditingChannel((current) =>
                            current ? { ...current, description: event.target.value } : current,
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="entity-editor-dialog__footer">
                    <button type="button" className="secondary-action" onClick={() => setEditingChannel(null)}>
                      취소
                    </button>
                    <button type="button" className="primary-action" onClick={handleSaveChannel}>
                      확인
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        );
      }}
    </BotSettingsShell>
  );
}
