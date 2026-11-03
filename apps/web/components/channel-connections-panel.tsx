"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  actOnChannelConnection, buildConnectionPayload, credentialFieldsForProvider, fetchChannelConnections, saveChannelConnection,
  type ChannelConnection, type ConnectionAction, type ConnectionDraft,
} from "@/lib/channel-connections-api";
import { CONNECTION_COPY, connectionErrorMessage } from "@/lib/i18n/channel-connections";
import type { SupportedLanguage } from "@/lib/language";

const EMPTY_DRAFT: ConnectionDraft = {name:"", bot_id:"", installation_id:"", account_id:"", target_id:""};
type NoticeKey = "saved" | "configOk" | "deleted" | "connecting" | "disconnected" | "";
const SAFE_ERROR_CODES = new Set([
  "CONNECTION_KEY_UNAVAILABLE", "CONNECTION_CREDENTIALS_UNAVAILABLE", "CONNECTION_TARGET_DUPLICATE",
  "CONNECTION_ACTIVE", "INVALID_CREDENTIALS", "INVALID_CONNECTION", "CONNECTION_CREDENTIALS_REQUIRED",
  "CONNECTION_WORKER_UNAVAILABLE", "CHANNEL_PACKET_RUNTIME_UNAVAILABLE",
]);

function safeErrorCode(error: unknown): string {
  const code = error instanceof Error ? error.message.split(":", 1)[0] : "";
  // 서버 오류 원문/입력값은 state에도 보관하지 않고 알려진 code만 유지한다.
  return SAFE_ERROR_CODES.has(code) ? code : "UNKNOWN_ERROR";
}

export function ChannelConnectionsPanel({token, channel, language, onClose}: {
  token: string; channel: {id: string; name: string; data_json: Record<string, unknown>}; language: SupportedLanguage; onClose: () => void;
}) {
  const copy = CONNECTION_COPY[language];
  const [items, setItems] = useState<ChannelConnection[]>([]);
  const [bots, setBots] = useState<{id: string; name: string}[]>([]);
  const [draft, setDraft] = useState<ConnectionDraft>(EMPTY_DRAFT);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<NoticeKey>("");
  const active = useRef(true);
  const fields = credentialFieldsForProvider(channel.data_json.provider);

  useEffect(() => {
    let live = true;
    active.current = true;
    setLoading(true);
    fetchChannelConnections(token, channel.id)
      .then(result => {if (live) {setItems(result.items); setBots(result.bots);}})
      .catch(error => {if (live) setError(safeErrorCode(error));})
      .finally(() => {if (live) setLoading(false);});
    return () => {live = false; active.current = false;};
  }, [token, channel.id]);

  function resetForm() {setDraft(EMPTY_DRAFT); setCredentials({}); setEditing(undefined); setFormOpen(false);}
  async function reload() {
    const result = await fetchChannelConnections(token, channel.id);
    if (active.current) {setItems(result.items); setBots(result.bots);}
  }
  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await saveChannelConnection(token, channel.id, buildConnectionPayload(draft, credentials), editing);
      if (active.current) {resetForm(); setNotice("saved"); await reload();}
    } catch (error) {if (active.current) setError(safeErrorCode(error));}
    finally {if (active.current) setBusy(false);}
  }
  async function action(item: ChannelConnection, name: ConnectionAction) {
    if (busy || (name === "delete" && !window.confirm(copy.confirmDelete))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await actOnChannelConnection(token, channel.id, item.id, name);
      if (active.current) {
        if (name === "delete" && editing === item.id) resetForm();
        setNotice(name === "check" ? "configOk" : name === "delete" ? "deleted" : name === "connect" ? "connecting" : "disconnected");
        await reload();
      }
    } catch (error) {if (active.current) setError(safeErrorCode(error));}
    finally {if (active.current) setBusy(false);}
  }
  function edit(item: ChannelConnection) {
    setDraft({name:item.name, bot_id:item.bot_id, installation_id:item.installation_id, account_id:item.account_id, target_id:item.target_id});
    setEditing(item.id); setCredentials({}); setFormOpen(true); setError(""); setNotice("");
  }

  return <section className="admin-page" aria-label={copy.title} aria-busy={loading || busy}>
    <div className="admin-page__table-actions">
      <h2>{channel.name} · {copy.title}</h2>
      <button type="button" className="admin-page__ghost" disabled={busy} onClick={() => {resetForm(); onClose();}}>{copy.close}</button>
    </div>
    <p>{copy.pending}</p>
    {error ? <p role="alert">{connectionErrorMessage(new Error(error), copy)}</p> : null}
    {notice ? <p role="status">{copy[notice]}</p> : null}
    {loading ? <p role="status">{copy.loading}</p> : null}
    <button type="button" className="admin-page__primary" disabled={busy || loading} onClick={() => {resetForm(); setFormOpen(true);}}>{copy.add}</button>
    {!loading && !items.length ? <p>{copy.empty}</p> : null}
    <ul>{items.map(item => {
      const editable = item.desired_state === "disconnected" && ["disconnected", "error"].includes(item.observed_state);
      return <li key={item.id}>
        <h3>{item.name}</h3>
        <p>{item.installation_id} / {item.account_id} / {item.target_id}</p>
        <p>{copy.bot}: {bots.find(bot => bot.id === item.bot_id)?.name ?? copy.selectBot}</p>
        <p>{copy[item.observed_state === "error" ? "stateError" : item.observed_state]} · {copy.credentials}: {item.credentials_registered ? copy.registered : copy.missing}</p>
        <p>{copy.lastChecked}: {item.last_checked_at ? new Intl.DateTimeFormat(language, {dateStyle:"medium", timeStyle:"short"}).format(new Date(item.last_checked_at)) : copy.notChecked}</p>
        {item.last_error_code ? <p role="status">{copy.verificationFailed} ({item.last_error_code})</p> : null}
        <div className="admin-page__table-actions">
          <button type="button" className="admin-page__ghost" disabled={busy} onClick={() => action(item,"check")}>{copy.check}</button>
          <button type="button" className="admin-page__ghost" disabled={busy || item.desired_state === "connected"} title={copy.pending} onClick={() => action(item,"connect")}>{copy.connect}</button>
          <button type="button" className="admin-page__ghost" disabled={busy} onClick={() => action(item,"disconnect")}>{copy.disconnect}</button>
          <button type="button" className="admin-page__ghost" disabled={busy || !editable} onClick={() => edit(item)}>{copy.edit}</button>
          <button type="button" className="admin-page__ghost" disabled={busy || !editable} onClick={() => action(item,"delete")}>{copy.remove}</button>
        </div>
      </li>;
    })}</ul>
    {formOpen ? <form className="admin-variable-dialog__body" onSubmit={handleSave}>
      <label>{copy.name}<input name="name" required maxLength={120} value={draft.name} disabled={busy} onChange={event => setDraft(current => ({...current,name:event.target.value}))}/></label>
      <label>{copy.bot}<select name="bot_id" required value={draft.bot_id} disabled={busy} onChange={event => setDraft(current => ({...current,bot_id:event.target.value}))}>
        <option value="">{copy.selectBot}</option>{bots.map(bot => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
      </select></label>
      {([["installation_id","installation"],["account_id","account"],["target_id","target"]] as const).map(([field,label]) =>
        <label key={field}>{copy[label]}<input name={field} required maxLength={200} value={draft[field]} disabled={busy} onChange={event => setDraft(current => ({...current,[field]:event.target.value}))}/></label>)}
      <fieldset disabled={busy}><legend>{copy.credentials}</legend><p>{copy.preserve}</p>
        {fields.map(field => <label key={field}>{field}<input name={field} type="password" autoComplete="new-password" maxLength={24000} value={credentials[field] ?? ""}
          onChange={event => setCredentials(current => ({...current,[field]:event.target.value}))}/></label>)}
      </fieldset>
      <div className="admin-page__table-actions">
        <button type="button" className="secondary-action" disabled={busy} onClick={resetForm}>{copy.cancel}</button>
        <button type="submit" className="primary-action" disabled={busy}>{copy.save}</button>
      </div>
    </form> : null}
  </section>;
}
