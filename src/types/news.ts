export interface AccordNewsItem {
  id: number;
  section: string;
  subsection: string;
  published_at: string;
  heading: string;
  summary: string;
  body: string;
  fincode: string | null;
  feed_name: string;
}

export interface AccordNewsResponse {
  news: AccordNewsItem[];
  has_more: boolean;
}

export interface GetAccordNewsParams {
  section?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
