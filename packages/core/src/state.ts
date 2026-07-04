export type SearchStatus = 'idle' | 'loading' | 'stalled' | 'success' | 'error';

/** A single search-result record. */
export type Item = Record<string, unknown>;

export interface NumericRange {
  min?: number;
  max?: number;
}

/** The serializable "input" half of search state — what URL sync reads/writes. */
export interface UiState {
  query: string;
  /** 0-based internally; 1-based in URLs and UI. */
  page: number;
  itemsPerPage: number;
  sort: string | null;
  /** OR within an attribute, AND across attributes. */
  facetFilters: Record<string, string[]>;
  numericFilters: Record<string, NumericRange>;
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

export interface SearchResults {
  items: Item[];
  totalItems: number;
  page: number;
  totalPages: number;
  facets: Record<string, FacetValue[]>;
  facetStats: Record<string, { min: number; max: number }>;
  processingTimeMs: number;
  /** Snapshot of the UiState these results correspond to. */
  forUiState: UiState;
}

export type SearchErrorType = 'network' | 'auth' | 'rate-limit' | 'server' | 'client';

export interface SearchError {
  type: SearchErrorType;
  status?: number;
  message: string;
  retryable: boolean;
}

export interface SearchState extends UiState {
  status: SearchStatus;
  results: SearchResults | null;
  /** Infinite-scroll append buffer; reset whenever a refinement replaces results. */
  accumulatedItems: Item[];
  error: SearchError | null;
  suggestions: string[];
}

export function defaultUiState(): UiState {
  return {
    query: '',
    page: 0,
    itemsPerPage: 20,
    sort: null,
    facetFilters: {},
    numericFilters: {},
  };
}

export function cloneUiState(ui: UiState): UiState {
  return {
    query: ui.query,
    page: ui.page,
    itemsPerPage: ui.itemsPerPage,
    sort: ui.sort,
    facetFilters: Object.fromEntries(Object.entries(ui.facetFilters).map(([k, v]) => [k, [...v]])),
    numericFilters: Object.fromEntries(Object.entries(ui.numericFilters).map(([k, v]) => [k, { ...v }])),
  };
}
