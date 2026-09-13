import type {ChatCategory} from '../types/chat.ts';
import {ACTION_ICON_NAMES} from './actionIcons.ts';

export interface ChatCategoryOption {
  key: ChatCategory;
  label: string;
  /** Lucide icon name; the app resolves it to its own icon component. */
  icon: string;
}

/**
 * The branches a chat can be filed under, as the chat search offers them.
 *
 * These are the llm service's routes (`llm/graph/routing/routes.py`), not the composer's tool
 * menu — a chat is categorised by what actually answered it. One of that file's six routes is
 * deliberately absent: `chart` never writes `last_route`, so a Chart chip would always come
 * back empty. Icons come from `ACTION_ICON_NAMES` where the action already has one, so a chip
 * carries the same mark as the tool it names.
 */
export const CHAT_CATEGORIES: ChatCategoryOption[] = [
  {key: 'research', label: 'Research', icon: ACTION_ICON_NAMES.research},
  {key: 'strategy', label: 'Strategy', icon: ACTION_ICON_NAMES.strategy},
  {key: 'autopilot', label: 'Autopilot', icon: ACTION_ICON_NAMES.autopilot},
  {key: 'portfolio', label: 'Portfolio', icon: 'briefcase'},
  {key: 'order', label: 'Orders', icon: 'receipt'},
];
