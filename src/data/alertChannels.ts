import type {
  AlertChannel,
  AlertChannelId,
  AlertPreferences,
  AlertScope,
} from '../types/alerts.ts';

export const ALERT_SCOPES: readonly AlertScope[] = ['stocks', 'fno'];

/**
 * What a user can be alerted about, per tab. The ids are the backend's channel column names
 * (services/notifications/kinds.go), so the two clients and the server all name the same
 * switch the same way.
 *
 * Split by horizon rather than by feature, because the horizon is what decides whether an alert
 * is useful or an interruption: someone who only trades swing setups does not want a 9:20am
 * intraday ping, and the reverse costs them the entry entirely. Each channel is one promise
 * about when the phone buzzes.
 */
export const ALERT_CHANNELS: Record<AlertScope, AlertChannel[]> = {
  stocks: [
    {
      id: 'stocks_intraday',
      label: 'Intraday stock picks',
      description:
        'Same-day picks as the screener publishes them, around 9:20am.',
    },
    {
      id: 'stocks_swing',
      label: 'Swing stock picks',
      description: 'Multi-day setups, sent once when the pick is finalized.',
    },
    {
      id: 'strategies_intraday',
      label: 'Intraday strategies',
      description:
        "Today's premium intraday strategies and the symbol each is running on.",
    },
    {
      id: 'strategies_swing',
      label: 'Swing strategies',
      description: 'Strategies that hold for days to weeks, sent on publish.',
    },
  ],
  fno: [
    {
      id: 'fno_intraday',
      label: 'Intraday option ideas',
      description: 'Same-day structures on the nearest expiry.',
    },
    {
      id: 'fno_positional',
      label: 'Positional option ideas',
      description: 'Multi-day structures on the further-dated series.',
    },
    {
      id: 'fno_expiry',
      label: 'Expiry-day setups',
      description: 'Weekly expiry plays, sent on expiry morning.',
    },
    {
      id: 'fno_exits',
      label: 'Exit alerts on my positions',
      description:
        'When an open F&O position hits its planned exit or its risk gate.',
    },
  ],
};

/**
 * The tab an alert channel belongs to, or null if the id isn't a channel at all. Derived from
 * ALERT_CHANNELS rather than a second hand-written map, so a new channel routes its
 * notification tap with no further edit.
 */
export const alertScopeForChannel = (channelId: string): AlertScope | null => {
  for (const scope of ALERT_SCOPES) {
    if (ALERT_CHANNELS[scope].some(c => c.id === channelId)) return scope;
  }
  return null;
};

/**
 * What turning the master switch on subscribes you to.
 *
 * Deliberately not "everything": four channels firing at once on day one is the fastest route
 * to the notifications being muted at the OS level, after which none of them work again.
 * Intraday only, and the rest are one tap away.
 */
const DEFAULT_ON: Record<AlertScope, AlertChannelId[]> = {
  stocks: ['stocks_intraday', 'strategies_intraday'],
  fno: ['fno_intraday', 'fno_exits'],
};

/** Alerts are opt-in — nothing is sent until the user turns the master on. */
export const defaultAlertPreferences = (
  scope: AlertScope,
): AlertPreferences => {
  const channels: Partial<Record<AlertChannelId, boolean>> = {};
  for (const channel of ALERT_CHANNELS[scope]) {
    channels[channel.id] = DEFAULT_ON[scope].includes(channel.id);
  }
  return {enabled: false, channels};
};
