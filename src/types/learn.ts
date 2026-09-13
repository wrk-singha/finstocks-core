import type {ChatContext} from './chat.ts';

/**
 * What a lesson does when tapped.
 *
 * There is no "watch" kind on purpose. A lesson that ends in a video ends with the user still
 * holding a blank composer — the gap in a chat product is at the keyboard, not in theory. Every
 * lesson ends inside the product having already done the thing, on live data.
 */
export type LessonAction =
  /** Seeds a real chat with a real prompt and runs it. */
  | {kind: 'ask'; prompt: string; context?: ChatContext}
  /** Lands on the route the lesson is about (a web path; mobile's Expo Router mirrors them). */
  | {kind: 'go'; to: string}
  /** Re-arms the onboarding coach marks and returns to the assistant / home tab. */
  | {kind: 'tour'};

export interface Lesson {
  id: string;
  /** Phrased as the thing the user will have done, not the topic. */
  title: string;
  blurb: string;
  /** Honest minutes. Used to make the list skimmable, not to gamify it. */
  minutes: number;
  cta: string;
  action: LessonAction;
  /** In the first-run path. Only these count toward the progress the bar shows. */
  core?: boolean;
  /** Route prefixes where this lesson jumps to the top of the list. */
  surfaces?: string[];
}
