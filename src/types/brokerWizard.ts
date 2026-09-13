import type {BrokerOptions} from './broker.ts';

/**
 * Config contract driving the Broker Connect wizard and the shared credential form: a single
 * per-broker config feeds both the stepped flow and the field renderer, so there are no
 * per-broker components.
 */
export interface WizardStepDef {
  title: string;
  body: string;
  /** Optional mono code block, e.g. a redirect URL to copy. */
  code?: string;
  /** Optional amber warning callout. */
  warn?: string;
  /** Render the broker credential inputs on this step. */
  showFields?: boolean;
  /** Submit the credentials when advancing from this step. */
  submits?: boolean;
  /** Render the reserved static-IP reveal on this step. */
  showIP?: boolean;
}

export interface BrokerFieldDef {
  /** Key used to read/write the value in the field map. */
  key: string;
  label: string;
  placeholder: string;
  /** Password-masked when true. */
  secret?: boolean;
  /** Field is not required for the save to proceed. */
  optional?: boolean;
}

export interface BrokerWizardDef {
  broker: BrokerOptions;
  /** Display name, e.g. "Zerodha". */
  name: string;
  fields: BrokerFieldDef[];
  steps: WizardStepDef[];
  /** Where the user pastes the reserved IP (broker-specific whitelist hint). */
  ipWhere: string;
  /** YouTube video id for the "Watch the walkthrough" thumbnail. */
  videoId?: string;
}

/** One row of the connected-state summary card. */
export interface SummaryField {
  label: string;
  value: string;
}
