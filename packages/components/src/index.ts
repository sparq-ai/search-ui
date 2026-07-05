/** ESM entry — side-effect-free. Call register() yourself, or import './auto'. */
export { register } from './register';
export { configure, setClient } from './config';
export { SparqSearchElement } from './provider/SparqSearch';
export { SparqSsrElement } from './provider/SparqSsr';
export { SparqAutocompleteElement, type AutocompleteHooks } from './autocomplete/SparqAutocomplete';
export { SparqAcSourceElement } from './autocomplete/SparqAcSource';
export {
  AutocompleteController,
  type AcShowOn,
  type AcSourceConfig,
  type AcSourceState,
  type AutocompleteState,
} from '@sparq/search-core';
export {
  SearchController,
  createMockClient,
  createSparqClient,
  type ControllerOptions,
  type FacetValue,
  type Item,
  type Refinement,
  type SearchError,
  type SearchHooks,
  type SearchRequest,
  type SearchResponse,
  type SearchResults,
  type SearchState,
  type SparqClient,
  type UiState,
} from '@sparq/search-core';
