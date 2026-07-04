<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue';
import { parseBoolAttr, parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';

const { controller, host } = useController({ role: 'searchbox' });

const placeholder = host.getAttribute('placeholder') ?? 'Search…';
const wantsAutofocus = parseBoolAttr(host.getAttribute('autofocus'));
const suggestionsEnabled = parseBoolAttr(host.getAttribute('suggestions'));
const minChars = parseNumAttr(host.getAttribute('min-chars'), 1);

const inputEl = ref<HTMLInputElement | null>(null);
const inputValue = ref('');
const focused = ref(false);
const open = ref(false);
const activeIndex = ref(-1);

const suggestions = computed(() =>
  suggestionsEnabled && controller.value ? controller.value.state.suggestions : [],
);
const listVisible = computed(() => open.value && suggestions.value.length > 0);

// External state changes (routing, popstate, page JS) flow into the input —
// but never while the user is typing.
watchEffect(() => {
  const q = controller.value?.state.query ?? '';
  if (!focused.value) inputValue.value = q;
});

function onInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value;
  inputValue.value = value;
  activeIndex.value = -1;
  controller.value?.setQuery(value);
  if (suggestionsEnabled) {
    open.value = true;
    void controller.value?.fetchSuggestions(value.length >= minChars ? value : '');
  }
}

function submit(): void {
  const c = controller.value;
  if (!c) return;
  if (activeIndex.value >= 0 && suggestions.value[activeIndex.value] !== undefined) {
    pick(suggestions.value[activeIndex.value] as string);
    return;
  }
  c.setQuery(inputValue.value);
  c.searchNow();
  close();
}

function pick(suggestion: string): void {
  inputValue.value = suggestion;
  controller.value?.setQuery(suggestion);
  controller.value?.searchNow();
  close();
}

function clear(): void {
  inputValue.value = '';
  controller.value?.setQuery('');
  close();
  inputEl.value?.focus();
}

function close(): void {
  open.value = false;
  activeIndex.value = -1;
}

function onKeydown(e: KeyboardEvent): void {
  if (!listVisible.value) {
    if (e.key === 'Escape') close();
    return;
  }
  const count = suggestions.value.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % count;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = activeIndex.value <= 0 ? count - 1 : activeIndex.value - 1;
  } else if (e.key === 'Escape') {
    close();
  }
}

function onBlur(): void {
  focused.value = false;
  // Delay so a click on a suggestion lands before the list closes.
  setTimeout(close, 150);
}

onMounted(() => {
  if (wantsAutofocus) inputEl.value?.focus();
});
</script>

<template>
  <div class="sq-root" part="root">
    <form class="form" part="form" role="search" @submit.prevent="submit">
      <input
        ref="inputEl"
        class="input"
        part="input"
        type="search"
        :placeholder="placeholder"
        :value="inputValue"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="listVisible ? 'true' : 'false'"
        @input="onInput"
        @keydown="onKeydown"
        @focus="focused = true"
        @blur="onBlur"
      />
      <button
        v-if="inputValue"
        class="clear"
        part="clear-button"
        type="button"
        aria-label="Clear search"
        @click="clear"
      >
        ×
      </button>
      <ul v-if="listVisible" class="suggestions" part="suggestions" role="listbox">
        <li
          v-for="(s, i) in suggestions"
          :key="s"
          class="suggestion"
          :class="{ active: i === activeIndex }"
          :part="i === activeIndex ? 'suggestion suggestion-active' : 'suggestion'"
          role="option"
          :aria-selected="i === activeIndex ? 'true' : 'false'"
          @mousedown.prevent="pick(s)"
          @mousemove="activeIndex = i"
        >
          {{ s }}
        </li>
      </ul>
    </form>
  </div>
</template>

<style>
.form {
  position: relative;
  display: block;
}
.input {
  width: 100%;
  padding: calc(var(--sparq-spacing, 8px)) calc(var(--sparq-spacing, 8px) * 4) calc(var(--sparq-spacing, 8px)) calc(var(--sparq-spacing, 8px) * 1.5);
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius, 6px);
  background: var(--sparq-color-bg, #fff);
}
.input:focus {
  border-color: var(--sparq-color-primary, #2563eb);
}
.input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  position: absolute;
  right: calc(var(--sparq-spacing, 8px));
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.2em;
  line-height: 1;
  color: var(--sparq-color-text-muted, #6b7280);
  padding: 2px 6px;
}
/* Overlay, never push — dropdowns cause zero layout shift (ARCHITECTURE §17). */
.suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  list-style: none;
  background: var(--sparq-color-bg-elevated, var(--sparq-color-bg, #fff));
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius, 6px);
  box-shadow: var(--sparq-shadow-popup, 0 8px 24px rgba(0, 0, 0, 0.12));
  overflow: hidden;
}
.suggestion {
  padding: calc(var(--sparq-spacing, 8px)) calc(var(--sparq-spacing, 8px) * 1.5);
  cursor: pointer;
}
.suggestion.active {
  background: var(--sparq-color-primary, #2563eb);
  color: var(--sparq-color-primary-contrast, #fff);
}
</style>
