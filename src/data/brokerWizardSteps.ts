import type {BrokerOptions} from '../types/broker.ts';
import type {
  BrokerFieldDef,
  BrokerWizardDef,
  WizardStepDef,
} from '../types/brokerWizard.ts';
import {BROKER_NAMES} from './brokers.ts';

const DAILY_REFRESH_WARN =
  'Refresh your token daily between 8:00 AM and 9:15 AM, or trading will stop working.';

const secretField = (
  key: string,
  label: string,
  placeholder: string,
  optional?: boolean,
): BrokerFieldDef => ({
  key,
  label,
  placeholder,
  secret: true,
  ...(optional ? {optional} : {}),
});

const keyAndSecretFields = (name: string, prefix = ''): BrokerFieldDef[] => [
  {
    key: 'api_key',
    label: `${prefix}API Key`,
    placeholder: `Enter your ${name} API Key`,
  },
  secretField(
    'api_secret',
    `${prefix}API Secret`,
    `Enter your ${name} API Secret`,
  ),
];

const enableDdpiStep = (name: string): WizardStepDef => ({
  title: 'Enable DDPI',
  body: `Go to ${name} Settings and enable DDPI.`,
  warn: `Activate DDPI with ${name}, otherwise FinStocks cannot execute sell orders.`,
});

const finishStep = (warn?: string): WizardStepDef => ({
  title: 'Finish Setup',
  body: 'Save all changes and start using FinStocks.',
  ...(warn ? {warn} : {}),
});

const ZERODHA_FIELDS = keyAndSecretFields(BROKER_NAMES.zerodha);

const GROWW_FIELDS: BrokerFieldDef[] = [
  {
    key: 'api_key',
    label: 'TOTP Token',
    placeholder: 'Enter your Groww TOTP Token',
  },
  secretField('api_secret', 'TOTP QR Code', 'Paste your Groww TOTP QR Code'),
];

const DHANN_FIELDS: BrokerFieldDef[] = [
  {
    key: 'user_id',
    label: 'Client ID',
    placeholder: 'Enter your Dhan Client ID',
  },
  secretField('access_token', 'Access Token', 'Enter your Dhan Access Token'),
  secretField('pin', 'PIN (for auto-refresh)', 'Your 6-digit Dhan PIN', true),
  secretField(
    'totp_secret',
    'TOTP Secret (for auto-refresh)',
    'Base32 secret from Dhan TOTP setup',
    true,
  ),
];

const UPSTOX_FIELDS = keyAndSecretFields(BROKER_NAMES.upstox, 'Upstox ');

const ZERODHA_STEPS: WizardStepDef[] = [
  {
    title: 'Sign up / Login',
    body: 'Visit zerodha.com/products/api and create an account, or log in.',
  },
  {
    title: 'Get API credentials',
    body: 'Go to Create New App and set your Redirect URL, then copy your API Key and API Secret.',
    code: 'https://finstocks.ai/callback',
  },
  {
    title: 'Add in FinStocks',
    body: 'In Settings → Broker → Zerodha, paste your API Key and API Secret, then click Save.',
    showFields: true,
    submits: true,
  },
  {
    title: 'Generate Static IP',
    body: 'Click Update in FinStocks to generate your Static IP.',
    showIP: true,
  },
  {
    title: 'Whitelist IP',
    body: 'Copy the IP from FinStocks, paste it in your Zerodha API Dashboard, and click Update.',
  },
  enableDdpiStep(BROKER_NAMES.zerodha),
  finishStep(DAILY_REFRESH_WARN),
];

const GROWW_STEPS: WizardStepDef[] = [
  {
    title: 'Sign up / Login',
    body: 'Visit groww.in and create an account or log in. Account approval may take 24–48 hours.',
  },
  {
    title: 'Get API credentials',
    body: 'Go to Profile → Developer API and generate your TOTP Token and QR Code.',
  },
  {
    title: 'Add in FinStocks',
    body: 'In Settings → Broker → Groww, paste your Token and QR Code, then click Save.',
    showFields: true,
    submits: true,
  },
  {
    title: 'Generate Static IP',
    body: 'Click Update in FinStocks to get your Static IP.',
    showIP: true,
  },
  {
    title: 'Whitelist IP',
    body: 'Copy the IP from FinStocks and paste it in Groww Developer API.',
  },
  enableDdpiStep(BROKER_NAMES.groww),
  finishStep(),
];

const DHANN_STEPS: WizardStepDef[] = [
  {
    title: 'Sign up / Login',
    body: 'Visit web.dhan.co and create an account or log in.',
  },
  {
    title: 'Get API credentials',
    body: 'Go to DhanHQ Trading APIs, create a new app, copy your Client ID and Access Token. For auto-refresh, also enable TOTP and copy the base32 secret.',
  },
  {
    title: 'Add Credentials in FinStocks',
    body: 'Paste your Client ID and Access Token. Optionally add your PIN and TOTP Secret to enable automatic daily token refresh.',
    showFields: true,
    submits: true,
  },
  {
    title: 'Generate Static IP',
    body: 'Click Update in FinStocks to generate a Static IP.',
    showIP: true,
  },
  {
    title: 'Whitelist Static IP in Dhan',
    body: 'Copy the Static IP from FinStocks, go to the Dhan Developer API page, paste it, and click Save.',
  },
  enableDdpiStep(BROKER_NAMES.dhann),
  finishStep(
    'If you added your PIN and TOTP Secret, tokens refresh automatically. Otherwise, refresh your token daily between 8:00 AM and 9:15 AM.',
  ),
];

const UPSTOX_STEPS: WizardStepDef[] = [
  {
    title: 'Sign up / Login',
    body: 'Visit upstox.com and create an account or log in.',
  },
  {
    title: 'Create API App',
    body: 'Go to My Account → Apps and create a new app, setting its redirect URL to the address below.',
    code: 'https://finstocks.ai/callback_upstox',
  },
  {
    title: 'Connect Upstox',
    body: "Paste your API Key and API Secret, then click Connect Upstox. You'll be sent to Upstox to log in and authorize the app, then returned here connected.",
    showFields: true,
    submits: true,
  },
  {
    title: 'Static IP',
    body: 'FinStocks reserves your Static IP and registers it with Upstox automatically, so API orders are placed from a compliant address.',
    showIP: true,
  },
  finishStep(DAILY_REFRESH_WARN),
];

export const BROKER_WIZARDS: readonly BrokerWizardDef[] = [
  {
    broker: 'zerodha',
    name: BROKER_NAMES.zerodha,
    fields: ZERODHA_FIELDS,
    steps: ZERODHA_STEPS,
    videoId: 'RqIxeZLlDPE',
    ipWhere: 'Zerodha → My Apps → your app → Whitelisted IPs',
  },
  {
    broker: 'groww',
    name: BROKER_NAMES.groww,
    fields: GROWW_FIELDS,
    steps: GROWW_STEPS,
    videoId: 'nTIps6vlbDY',
    ipWhere: 'Groww → Developer API → IP Whitelist',
  },
  {
    broker: 'dhann',
    name: BROKER_NAMES.dhann,
    fields: DHANN_FIELDS,
    steps: DHANN_STEPS,
    videoId: 'h8oRR_D6Ge0',
    ipWhere: 'Dhan → DhanHQ Trading APIs → your app → Allowed IPs',
  },
  {
    broker: 'upstox',
    name: BROKER_NAMES.upstox,
    fields: UPSTOX_FIELDS,
    steps: UPSTOX_STEPS,
    videoId: 'GxCEEAws1LI',
    ipWhere: 'Upstox → My Account → Apps → your app → IP Whitelist',
  },
];

export const BROKER_WIZARD_BY_ID: Readonly<
  Record<BrokerOptions, BrokerWizardDef>
> = Object.fromEntries(BROKER_WIZARDS.map(w => [w.broker, w])) as Record<
  BrokerOptions,
  BrokerWizardDef
>;
