"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { loadAuthSession } from "@/lib/auth";
import { useI18n } from "@/components/language-provider";
import { getStudioPageLabel, STUDIO_PAGE_CATALOGS } from "@/lib/i18n/studio-pages";
import {
  fetchStudioBots,
  fetchStudioHub,
  fetchStudioHubRetrainingCandidates,
  type StudioBotApiItem,
  type StudioHub,
  type StudioHubRetrainingCandidate,
} from "@/lib/studio-bots-api";

type Props = { hubId: string };

const RESULT_LABELS: Record<StudioHubRetrainingCandidate["result_kind"], string> = {
  intent_classified: "의도 분류",
  bot_unclassified: "하위 봇 미분류",
  hub_unclassified: "봇 허브 미분류",
  error: "처리 오류",
};

function dateText(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("ko-KR");
}

function dateParam(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function BotHubRetrainingPage({ hubId }: Props) {
  const { language: uiLanguage } = useI18n();
  const copy = STUDIO_PAGE_CATALOGS[uiLanguage];
  const [hub, setHub] = useState<StudioHub | null>(null);
  const [bots, setBots] = useState<StudioBotApiItem[]>([]);
  const [candidates, setCandidates] = useState<StudioHubRetrainingCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [memberBotId, setMemberBotId] = useState("");
  const [channelType, setChannelType] = useState("");
  const [resultKind, setResultKind] = useState<StudioHubRetrainingCandidate["result_kind"] | "">("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setMessage("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMessage("");
    Promise.all([
      fetchStudioHub(session.access_token, hubId),
      fetchStudioBots(session.access_token),
      fetchStudioHubRetrainingCandidates(session.access_token, hubId, {
        memberBotId: memberBotId || undefined,
        channelType: channelType || undefined,
        resultKind: resultKind || undefined,
        pageSize: 100,
      }),
    ])
      .then(([nextHub, nextBots, response]) => {
        if (cancelled) return;
        setHub(nextHub);
        setBots(nextBots);
        setCandidates(response.items);
        setTotal(response.total);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "봇 허브 재학습 후보를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelType, hubId, memberBotId, resultKind]);

  const members = useMemo(() => {
    if (!hub) return [];
    const botsById = new Map(bots.map((bot) => [bot.id, bot]));
    return hub.members
      .map((member) => ({ member, bot: botsById.get(member.bot_id) ?? null }))
      .sort((left, right) => left.member.sort_order - right.member.sort_order);
  }, [bots, hub]);

  const channelOptions = useMemo(
    () => [...new Set(candidates.map((candidate) => candidate.channel_type).filter(Boolean))].sort(),
    [candidates],
  );

  if (!hub && loading) {
    return <main className="page"><p className="bot-hub__notice">{getStudioPageLabel(copy,"봇 허브 재학습 후보를 불러오는 중입니다...")}</p></main>;
  }

  return (
    <main className="page bot-hub">
      <header className="bot-hub__header">
        <div>
          <Link href={`/studio/hubs/${hubId}`} className="bot-hub__back">{hub?.name || "봇 허브"} 구성</Link>
          <h1>{getStudioPageLabel(copy,"봇 허브 재학습")}</h1>
          <p>{getStudioPageLabel(copy, "봇 허브를 거쳐 처리된 사용자 발화를 확인하고, 선택된 하위 봇의 운영 버전에 학습문장을 반영합니다.")}</p>
        </div>
      </header>

      {message ? <p className="bot-hub__notice bot-hub__notice--error">{message}</p> : null}

      <section className="bot-hub__panel bot-hub__retraining">
        <div className="bot-hub__panel-title">
          <h2>{getStudioPageLabel(copy, "재학습 후보 이력")}</h2>
          <span>{total}건</span>
        </div>
        <div className="bot-hub__filters">
          <label>{getStudioPageLabel(copy,"하위 봇")}<select value={memberBotId} onChange={(event) => setMemberBotId(event.target.value)}>
              <option value="">{getStudioPageLabel(copy,"전체 하위 봇")}</option>
              {members.map(({ member, bot }) => (
                <option key={member.bot_id} value={member.bot_id}>{member.display_name || bot?.name || member.name || "삭제된 봇"}</option>
              ))}
            </select>
          </label>
          <label>{getStudioPageLabel(copy,"채널")}<select value={channelType} onChange={(event) => setChannelType(event.target.value)}>
              <option value="">{getStudioPageLabel(copy,"전체 채널")}</option>
              {channelOptions.map((channel) => <option key={channel} value={channel}>{channel}</option>)}
            </select>
          </label>
          <label>{getStudioPageLabel(copy,"처리 결과")}<select value={resultKind} onChange={(event) => setResultKind(event.target.value as StudioHubRetrainingCandidate["result_kind"] | "")}>
              <option value="">{getStudioPageLabel(copy,"전체 결과")}</option>
              {Object.entries(RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <p className="bot-hub__help">{getStudioPageLabel(copy, "Rule, SmallTalk, Exact Matching으로 처리된 대화는 학습 후보가 아닙니다. 학습할 후보는 하위 봇 재학습 화면에서 발화와 대상 의도를 확인한 뒤 저장합니다.")}</p>

        <div className="bot-hub__history-table" role="table" aria-label={getStudioPageLabel(copy,"봇 허브 재학습 후보 이력")}>
          <div className="bot-hub__history-head" role="row">
            <span>{getStudioPageLabel(copy,"사용자 발화")}</span><span>{getStudioPageLabel(copy,"하위 봇")}</span><span>{getStudioPageLabel(copy,"처리 결과")}</span><span>{getStudioPageLabel(copy,"채널")}</span><span>{getStudioPageLabel(copy,"발생 일시")}</span><span>{getStudioPageLabel(copy,"반영")}</span>
          </div>
          {candidates.map((candidate) => {
            const bot = candidate.member_bot_id ? bots.find((item) => item.id === candidate.member_bot_id) ?? null : null;
            const version = bot?.active_version;
            const retrainingHref = bot && version
              ? `/studio/bots/${encodeURIComponent(bot.id)}/versions/${encodeURIComponent(version.name)}/retraining?date=${encodeURIComponent(dateParam(candidate.created_at))}&hubId=${encodeURIComponent(hubId)}&queueEventId=${encodeURIComponent(candidate.queue_event_id)}&hubCandidateId=${encodeURIComponent(candidate.queue_event_id)}&hubCandidateUtterance=${encodeURIComponent(candidate.user_utterance || "")}&hubCandidateChannel=${encodeURIComponent(candidate.channel_type || "")}&hubCandidateOccurredAt=${encodeURIComponent(candidate.created_at || "")}&hubCandidateResultType=${encodeURIComponent(RESULT_LABELS[candidate.result_kind])}`
              : null;
            return (
              <div key={candidate.queue_event_id} className="bot-hub__history-row" role="row">
                <strong>{candidate.user_utterance || "발화를 확인할 수 없습니다."}</strong>
                <span>{candidate.member_bot_name || "-"}</span>
                <span>{candidate.intent_name || RESULT_LABELS[candidate.result_kind]}</span>
                <span>{candidate.channel_type}</span>
                <time dateTime={candidate.created_at || undefined}>{dateText(candidate.created_at)}</time>
                {retrainingHref ? <Link className="bot-hub__secondary" href={retrainingHref}>{getStudioPageLabel(copy,"학습 반영")}</Link> : <span className="bot-hub__help">{getStudioPageLabel(copy,"대상 없음")}</span>}
              </div>
            );
          })}
          {!loading && candidates.length === 0 ? <p className="bot-hub__empty">{getStudioPageLabel(copy, "조건에 맞는 봇 허브 대화 이력이 없습니다.")}</p> : null}
        </div>
      </section>
    </main>
  );
}
