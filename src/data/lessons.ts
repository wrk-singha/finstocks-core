import type {Lesson} from '../types/learn.ts';

/**
 * How someone learns FinStocks.
 *
 * The unit of learning is the unit of doing. This product's core interaction is a prompt, so
 * every lesson is a prompt that runs — on live data, in the user's own account — rather than a
 * description of one. Someone who finishes the core seven has asked about a stock, built a
 * rule, backtested it, read the drawdown and connected a broker.
 *
 * Ordering is the first-run path, top to bottom. `surfaces` lets the page the user is stuck on
 * pull its own lesson to the front without reshuffling the rest — confusion is local, so the
 * answer should be too. Route strings are web paths; mobile's Expo Router mirrors them, and
 * where its spelling differs (the templates surface) both prefixes are listed.
 */
export const LESSONS: Lesson[] = [
  {
    id: 'ask-a-stock',
    title: 'Ask about any stock in plain English',
    blurb:
      'You get the levels, the risk and the reasoning — not a one-word verdict.',
    minutes: 1,
    cta: 'Run it on RELIANCE',
    core: true,
    surfaces: ['/market'],
    action: {
      kind: 'ask',
      prompt:
        'Should I buy RELIANCE right now? Give me the entry, the stop loss and the target, show me the chart, and tell me what would make this trade wrong.',
      context: {
        label: 'Ask about a stock',
        sublabel: 'Lesson',
        symbol: 'RELIANCE',
      },
    },
  },
  {
    id: 'read-a-pick',
    title: "Know what's behind a FinStocks pick",
    blurb:
      'Every pick carries a real backtest. This is how to check it before you act on it.',
    minutes: 2,
    cta: 'Ask the assistant',
    core: true,
    surfaces: ['/market'],
    action: {
      kind: 'ask',
      prompt:
        'Explain how FinStocks picks stocks. What data goes into a recommendation, what the win rate actually means, and what it does not promise me.',
      context: {label: 'How picks work', sublabel: 'Lesson'},
    },
  },
  {
    id: 'build-a-strategy',
    title: 'Turn your own rule into a strategy',
    blurb:
      'Describe your setup in one sentence. No code, no builder, no menus.',
    minutes: 2,
    cta: 'Try an example',
    core: true,
    surfaces: ['/strategy-templates', '/templates'],
    action: {
      kind: 'ask',
      prompt:
        'Build me a strategy: buy when the 20 EMA crosses above the 50 EMA on the 15-minute chart, stop loss 1%, target 2%, square off everything by 3:15pm. Show me the rules you understood before running anything.',
      context: {label: 'Build a strategy', sublabel: 'Lesson'},
    },
  },
  {
    id: 'backtest-it',
    title: 'Backtest it before you risk anything',
    blurb:
      'Run the rule over real history and see the drawdown, not just the return.',
    minutes: 3,
    cta: 'Run a backtest',
    core: true,
    action: {
      kind: 'ask',
      prompt:
        'Backtest this on NIFTY 50 stocks over the last 2 years: buy when RSI(14) drops below 30 and then closes back above it, stop loss 2%, target 4%. Show me the win rate, the max drawdown and the worst losing streak.',
      context: {label: 'Run a backtest', sublabel: 'Lesson'},
    },
  },
  {
    id: 'read-a-backtest',
    title: 'Read a backtest honestly',
    blurb:
      'Win rate flatters. Drawdown and losing streaks decide whether you can actually hold it.',
    minutes: 4,
    cta: 'Open the guide',
    core: true,
    action: {kind: 'go', to: '/prompt-book/backtesting'},
  },
  {
    id: 'connect-broker',
    title: 'Connect your broker',
    blurb:
      'Zerodha, Groww, Dhan or Upstox. Nothing is placed until you confirm it yourself.',
    minutes: 2,
    cta: 'Connect',
    core: true,
    action: {kind: 'go', to: '/connect-broker'},
  },
  {
    id: 'autopilot',
    title: 'Let a strategy run without you',
    blurb: 'What Autopilot does, what it will never do, and how to stop it.',
    minutes: 4,
    cta: 'Open the guide',
    core: true,
    action: {kind: 'go', to: '/prompt-book/autopilot'},
  },
  {
    id: 'screener',
    title: 'Screen the market on your own filters',
    blurb:
      'Your conditions, the whole market, sorted the way you asked for it.',
    minutes: 2,
    cta: 'Open the screener',
    action: {kind: 'go', to: '/market/screener'},
  },
  {
    id: 'explain-my-pnl',
    title: 'Ask why your P&L moved',
    blurb: 'Your actual holdings, attributed — not a number with no story.',
    minutes: 1,
    cta: 'Ask about my portfolio',
    surfaces: ['/portfolio'],
    action: {
      kind: 'ask',
      prompt:
        'Go through my portfolio and explain what actually moved my P&L this week. Which positions drove it, which are dragging, and what risk am I carrying that I might not have noticed?',
      context: {label: 'Explain my P&L', sublabel: 'Lesson'},
    },
  },
  {
    id: 'research',
    title: 'Research a company properly',
    blurb: 'Fundamentals, news and the numbers behind them, in one pass.',
    minutes: 4,
    cta: 'Open the guide',
    action: {kind: 'go', to: '/prompt-book/research'},
  },
  {
    // Deliberately about risk and sizing, not "how to trade options". SEBI's own data has
    // ~93% of retail F&O traders losing money — putting a strategy tutorial in front of that
    // cohort teaches the wrong thing and carries a real regulatory hazard besides.
    id: 'fno-risk',
    title: 'Understand F&O risk before you trade it',
    blurb:
      "SEBI's data: about 93% of retail F&O traders lose money. What that changes about sizing.",
    minutes: 3,
    cta: 'Ask the assistant',
    surfaces: ['/market'],
    action: {
      kind: 'ask',
      prompt:
        "Explain F&O risk for a retail trader in India, using SEBI's own numbers. How should I size an options position against my capital, and what should make me not take the trade at all?",
      context: {label: 'F&O risk', sublabel: 'Lesson'},
    },
  },
  {
    id: 'replay-tour',
    title: 'Replay the app tour',
    blurb: 'The 60-second walkthrough of where everything lives.',
    minutes: 1,
    cta: 'Replay',
    action: {kind: 'tour'},
  },
];

export const CORE_LESSONS: Lesson[] = LESSONS.filter(l => l.core);

/**
 * The list for a given page: whatever that page is about first, then the rest in first-run
 * order. Stable within each group, so the rail never reshuffles under someone mid-scroll.
 */
export function lessonsForRoute(pathname: string): Lesson[] {
  const local = (l: Lesson): boolean =>
    l.surfaces?.some(s => pathname.startsWith(s)) ?? false;
  return [...LESSONS.filter(local), ...LESSONS.filter(l => !local(l))];
}
