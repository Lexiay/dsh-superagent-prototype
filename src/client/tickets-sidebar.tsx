/**
 * Right-sidebar Tickets page: the tab type, its guide entry, and the session-scoped body.
 *
 * The page reuses the management API and the panel's own controls and status marks, so a Ticket looks
 * the same on the right as in the Execution tab. It is intentionally compact: a list to scan and a
 * detail to act on, without the panel's full navigation.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SidebarRightTabInfo, UseSidebarRightTabInfo } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { openKnownSession, SessionNavigationError } from '../navigation.ts'
import { ApiError, usePoll, type TicketPageView, type TicketRow } from './api.ts'
import { Button, Icon, SegmentedControl, Tag } from './controls.tsx'
import { NS } from './locales.ts'
import { ticketMark } from './marks.ts'
import { PanelProvider, usePanel, usePanelData } from './provider.tsx'
import { actorName, readableMarkers, reasonLabel, valueLabel, when, type T } from './text.ts'
import { ActionLink, ConfirmButton, ExternalLink, Hint, KeyValues, LoadMore, LoadState, MarkdownLite, Section, SessionButton,
  StageMark, When } from './widgets.tsx'

export type SidebarClientContext = Context & { sessions: ISessions }
/** Implementation identity of the tab type; also the key its body registers under. */
export const TICKETS_TAB_ID = 'dsh-superagent/tickets'
/** Type discriminator: what `sidebarRight.openTab` names. */
export const TICKETS_TAB_KIND = 'dsh-superagent-tickets'
const FILTERS = ['open', 'person', 'ended'] as const
type Filter = typeof FILTERS[number]

/** Guide card and tab glyph: a ticket with two written lines. */
function TicketsIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M9 9.5h6M9 14.5h3.5" />
  </svg>
}

/** Register the Tickets tab type, its guide entry, and the body seat for the plugin's lifetime. */
export function registerTicketsSidebar(ctx: SidebarClientContext, t: T): void {
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TICKETS_TAB_ID,
    kind: TICKETS_TAB_KIND,
    title: () => t('ticketsTab'),
    guide: [{ id: 'tickets', order: 50, title: () => t('ticketsTab'), description: () => t('ticketsTabHint'), icon: TicketsIcon }],
  }), 'dsh-superagent: Tickets tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: TICKETS_TAB_ID, locale: NS },
    (props: { t: T; useTabInfo: UseSidebarRightTabInfo }) =>
      <TicketsSidebar ctx={ctx} t={props.t} useTabInfo={props.useTabInfo} />))
}

/** Session opener shared by the page's Session buttons; mirrors the panel's localized catalog errors. */
function sidebarSessionOpener(ctx: SidebarClientContext, t: T) {
  return async (id: string) => {
    try {
      await openKnownSession(ctx.sessions, id as SessionId, target => { ctx.uiWorkspace.openSession(target) }, new AbortController().signal)
    } catch (error) {
      if (error instanceof SessionNavigationError) {
        throw new Error(t(error.code === 'not-ready' ? 'sessionListNotReady' : 'sessionNotListed'))
      }
      throw error
    }
  }
}

/** Panel provider scope so Tickets in the right sidebar share copy, error messages, and open-Session behavior. */
function TicketsSidebar({ ctx, t, useTabInfo }: { ctx: SidebarClientContext; t: T; useTabInfo: UseSidebarRightTabInfo }) {
  return <PanelProvider t={t} openSession={sidebarSessionOpener(ctx, t)}>
    <TicketsPage useTabInfo={useTabInfo} />
  </PanelProvider>
}

/** Bind the standard refresh command to the visible page's loader. */
function useTabRefresh(tab: SidebarRightTabInfo, reload: () => Promise<unknown>) {
  const { actions } = tab.tab
  useEffect(() => actions.bindCommands({ refresh: () => { void reload() } }), [actions, reload])
}

/** Swap between the list and one Ticket without adding another navigation surface. */
function TicketsPage({ useTabInfo }: { useTabInfo: UseSidebarRightTabInfo }) {
  const [filter, setFilter] = useState<Filter>('open')
  const [selected, setSelected] = useState<string>()
  const tab = useTabInfo()
  return <div className="dt-rb">
    {selected ? <TicketDetail id={selected} tab={tab} onBack={() => setSelected(undefined)} />
      : <TicketList filter={filter} tab={tab} onFilter={setFilter} onSelect={setSelected} />}
  </div>
}

function RefreshButton({ reload }: { reload: () => Promise<unknown> }) {
  const { t } = usePanel()
  return <Button variant="ghost" size="sm" icon={<Icon name="refresh" size={14} />} aria-label={t('refresh')} title={t('refresh')}
    onClick={() => { void reload() }} />
}

function TicketList({ filter, tab, onFilter, onSelect }: {
  filter: Filter; tab: SidebarRightTabInfo; onFilter: (next: Filter) => void; onSelect: (id: string) => void
}) {
  const { t, call } = usePanel()
  const [limit, setLimit] = useState(20)
  const { data, error, reload } = usePoll(() => call('GET tickets', { query: { state: filter, limit } }), [call, filter, limit])
  useEffect(() => { setLimit(20) }, [filter])
  useTabRefresh(tab, reload)
  return <>
    <div className="dt-rb-bar">
      <SegmentedControl label={t('ticketsFilter')} value={filter} onChange={onFilter}
        options={FILTERS.map(value => ({ value, label: t(`ticketFilter.${value}`) }))} />
      <RefreshButton reload={reload} />
    </div>
    <LoadState error={error} loading={!data} />
    {data && (data.items.length ? <ul className="dt-list dt-rb-list">{data.items.map(ticket => <TicketLine key={ticket.id}
      ticket={ticket} onOpen={() => onSelect(ticket.id)} />)}</ul>
      : <Hint>{t('ticketsEmpty', { filter: t(`ticketFilter.${filter}`) })}</Hint>)}
    {data?.next_offset != null && <LoadMore onMore={() => setLimit(limit + 20)} />}
  </>
}

function TicketLine({ ticket, onOpen }: { ticket: TicketRow; onOpen: () => void }) {
  const { t } = usePanel()
  const status = ticketMark(t, ticket)
  return <li className="dt-row dt-link dt-rb-row">
    <div className="dt-row-main">
      <div className="dt-row-title"><button type="button" className="dt-open" title={ticket.title} onClick={onOpen}>{ticket.title}</button></div>
      <div className="dt-row-meta">
        <StageMark state={status.dot} icon={status.icon} label={status.label} />
        {ticket.undelivered > 0 && <Tag tone="warning">{t('ticketUndeliveredLabel')} {ticket.undelivered}</Tag>}
        <When at={ticket.updatedAt} />
      </div>
    </div>
  </li>
}

function TicketInputs({ inputs }: { inputs: TicketPageView['inputs'] }) {
  const { t } = usePanel()
  return <ul className="dt-list">{inputs.map(input => {
    const trigger = input.kind === 'trigger' ? input.trigger : undefined
    const who = trigger ? actorName(t, trigger.actor) : valueLabel(t, 'input', input.kind)
    const text = trigger ? trigger.preview : input.text
    return <li key={input.id} className="dt-row">
      <div className="dt-row-main">
        <div className="dt-row-meta">{who}<When at={input.at} /></div>
        {text && <div className="dt-row-quote">{readableMarkers(t, text)}</div>}
      </div>
    </li>
  })}</ul>
}

function TicketDetail({ id, tab, onBack }: { id: string; tab: SidebarRightTabInfo; onBack: () => void }) {
  const { t, call } = usePanel()
  const { state } = usePanelData()
  const paused = !!state?.paused
  const { data, error, reload } = usePoll(() => call('GET tickets/:id', { id }), [id])
  useTabRefresh(tab, reload)
  const after = async (request: Promise<unknown>) => { await request; await reload() }
  const back = <Button variant="ghost" size="sm" icon={<Icon name="chevron-left" />} onClick={onBack}>{t('ticketsBack')}</Button>
  if (!data) return <>
    <div className="dt-rb-bar">{back}<span style={{ marginLeft: 'auto' }}><RefreshButton reload={reload} /></span></div>
    {error instanceof ApiError && error.missing ? <Hint>{t('ticketNotFound')}</Hint> : <LoadState error={error} loading />}
  </>
  const status = ticketMark(t, data)
  const actor = actorName(t, data.mandate.actor)
  const undelivered = data.inputs.filter(input => !input.delivered)
  const channel = data.channels[0]
  const failed = data.stage === 'person' && data.action === 'failed'
  const failedText = /^(?:\w+Error|Error)\b[:：]/.test(data.summary)
  const ended = data.ended && (() => {
    const time = when(data.ended.at, t('lang')), outcome = valueLabel(t, 'outcome', data.ended.outcome)
    const reason = reasonLabel(t, data.ended.reason)
    return reason ? t('endedAt', { time, outcome, reason }) : t('endedAtShort', { time, outcome })
  })()
  const facts: [string, ReactNode][] = [
    [t('ticketMandateLabel'), valueLabel(t, 'strength', data.mandate.strength)],
    [t('ticketActorLabel'), `${valueLabel(t, 'source', data.mandate.actor.source)} · ${actor}`],
    ...data.mandate.scope ? [[t('term.scope'), data.mandate.scope] as [string, ReactNode]] : [],
    ...data.directory ? [[t('executionDirectory'), <span key="dir" className="dt-mono">{data.directory}</span>] as [string, ReactNode]] : [],
  ]
  return <>
    <div className="dt-rb-bar">{back}<span style={{ marginLeft: 'auto' }}><RefreshButton reload={reload} /></span></div>
    <h2 className="dt-rb-title">{data.title}</h2>
    <div className="dt-row-meta"><StageMark state={status.dot} icon={status.icon} label={status.label} /><When at={data.updatedAt} /></div>
    {ended && <Hint>{ended}</Hint>}
    {data.attention && <div className="dt-banner"><span className="dt-banner-label">{t('attentionPrefix')}</span><MarkdownLite
      text={data.attention.question} />
      {channel && <div className="dt-banner-actions"><ActionLink href={channel.url} icon="message">{t('answerIn',
        { source: valueLabel(t, 'source', channel.source) })}</ActionLink></div>}
    </div>}
    {data.actions.retry && data.summary && <p className={`dt-banner${failed ? ' dt-danger' : ''}${failedText ? ' dt-mono' : ''}`}>
      <span className="dt-banner-label">{t(failed ? 'failedPrefix' : 'blockedPrefix')}</span>{data.summary}
    </p>}
    {data.deliveryError && <p className="dt-banner dt-danger dt-mono"><span className="dt-banner-label">{t('deliveryFailedPrefix')}</span>
      {data.deliveryError}</p>}
    <Section title={t('mandateDetails')} icon="shield"><KeyValues rows={facts} /></Section>
    {undelivered.length > 0 && <Section title={t('undeliveredInputs')} count={undelivered.length}>
      <Hint>{data.deliveryError ? t('inputRetryHint') : paused ? t('inputPausedHint') : t('inputWaitingHint')}</Hint>
      <TicketInputs inputs={undelivered} />
    </Section>}
    {data.threads.length > 0 && <Section title={t('subscribedThreads')} count={data.threads.length}>
      <ul className="dt-plain-list">{data.threads.map(thread => <li key={thread.key}>
        {thread.url ? <ExternalLink href={thread.url} icon={thread.source === 'github' ? 'pull' : 'message'}>
          {readableMarkers(t, thread.title)}
        </ExternalLink> : <span>{readableMarkers(t, thread.title)}</span>}
      </li>)}</ul>
    </Section>}
    {(data.actions.retry || data.sessionId) && <div className="dt-rb-actions">
      {data.actions.retry && <ConfirmButton variant="outline" icon="refresh" label={t('retry')} title={t('retryTitle')}
        message={t('retryConfirm', { title: data.title })} onConfirm={() => after(call('POST tickets/:id/retry', { id }))} />}
      {data.sessionId && <SessionButton variant="outline" sessionId={data.sessionId} />}
    </div>}
    {data.actions.stop && <div className="dt-danger-zone">
      <span className="dt-hint">{t('stopHint')}</span>
      <ConfirmButton variant="outline" label={t('stop')} title={t('stopConfirmTitle')} message={t('stopConfirm', { title: data.title })}
        onConfirm={() => after(call('POST tickets/:id/stop', { id }))} />
    </div>}
  </>
}