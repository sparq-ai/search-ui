export type {
  FacetValue,
  Item,
  NumericRange,
  SearchError,
  SearchErrorType,
  SearchResults,
  SearchState,
  SearchStatus,
  UiState,
} from './state';
export { cloneUiState, defaultUiState } from './state';

export type { SearchRequest, SearchResponse, SparqClient } from './client/types';
export { isAbortError, normalizeToSearchError, searchErrorFromStatus } from './client/types';
export { createSparqClient, type SparqClientConfig } from './client/sparqClient';
export { createMockClient, type MockClientOptions } from './client/mockClient';

export {
  SearchController,
  type ControllerEventName,
  type ControllerOptions,
  type Refinement,
  type SearchHooks,
  type WidgetRegistration,
  type WidgetRole,
} from './controller/SearchController';
export { buildRequest, canonicalKey, type RegisteredFacets } from './controller/requestBuilder';
export { LruCache } from './controller/cache';

export {
  AutocompleteController,
  modeForInput,
  sourceActiveInMode,
  type AcMode,
  type AcShowOn,
  type AcSourceConfig,
  type AcSourceState,
  type AutocompleteControllerOptions,
  type AutocompleteState,
} from './controller/AutocompleteController';

export { compileItemTemplate, renderBlank, type ItemRenderer } from './template/compileItemTemplate';
export { isSafeUrl } from './template/sanitize';

export { attachUrlSync, parseUrlState, serializeUrlState } from './routing/urlSync';

export {
  Insights,
  configureInsights,
  getInsights,
  setTrackingConsent,
  trackPurchase,
  type InsightsConfig,
  type PurchaseData,
  type PurchaseItem,
} from './insights/insights';
// Engine internals re-exported from the canonical SDK (ARCHITECTURE §20) so
// existing consumers of these names keep working.
export { WireClient as InsightsClient, clearClickMap, queryIdFor, rememberClick } from '@sparq/analytics-js';
