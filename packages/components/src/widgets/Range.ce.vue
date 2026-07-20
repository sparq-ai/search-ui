<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useHost, watchEffect } from 'vue';
import { parseBoolAttr, parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';
import {
  clampThumb,
  isUsableBounds,
  pickThumb,
  rangeFromThumbs,
  resolveBounds,
  thumbsFromRange,
  toPercent,
  valueFromPointer,
  type Bounds,
} from './rangeLogic';

const APPLY_DEBOUNCE_MS = 300;

// Read config BEFORE registering so the numeric attribute reaches the request builder.
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
if (!attribute) console.error('[sparq] <sparq-range> requires an attribute="..." attribute.');

const { controller } = useController({ role: 'range', numericAttribute: attribute ?? undefined });

const prefix = host.getAttribute('prefix') ?? '';
// A range had no heading of its own, so a sidebar that labels its facets had to
// wrap it — the same wrapper that then needs hiding when the widget is empty.
const header = host.getAttribute('header');
const collapsible = parseBoolAttr(host.getAttribute('collapsible'));
const isCollapsed = ref(collapsible && parseBoolAttr(host.getAttribute('collapsed')));
const step = parseNumAttr(host.getAttribute('step'), 1);
const attrMin = host.getAttribute('min');
const attrMax = host.getAttribute('max');

const bounds = ref<Bounds | null>(null);
const thumbMin = ref(0);
const thumbMax = ref(0);
const minInput = ref('');
const maxInput = ref('');
/** True while the user is interacting — external state must not fight them. */
const editing = ref(false);
const sliderEl = ref<HTMLElement | null>(null);
let applyTimer: ReturnType<typeof setTimeout> | undefined;
let dragging: 'min' | 'max' | null = null;

const usable = computed(() => isUsableBounds(bounds.value));
const fillStyle = computed(() => {
  const b = bounds.value;
  if (!isUsableBounds(b)) return { left: '0%', right: '100%' };
  return {
    left: `${toPercent(thumbMin.value, b)}%`,
    right: `${100 - toPercent(thumbMax.value, b)}%`,
  };
});

// External state → widget (bounds policy + thumb/input positions).
watchEffect(() => {
  if (!attribute) return;
  const state = controller.value?.state;
  if (!state) return;
  const activeFilter = state.numericFilters[attribute];
  bounds.value = resolveBounds(bounds.value, {
    attrMin: attrMin !== null ? Number(attrMin) : undefined,
    attrMax: attrMax !== null ? Number(attrMax) : undefined,
    stats: state.results?.facetStats[attribute] ?? null,
    hasActiveFilter: activeFilter !== undefined,
  });
  if (editing.value) return;
  if (isUsableBounds(bounds.value)) {
    const thumbs = thumbsFromRange(activeFilter, bounds.value);
    thumbMin.value = thumbs.min;
    thumbMax.value = thumbs.max;
  }
  minInput.value = activeFilter?.min !== undefined ? String(activeFilter.min) : '';
  maxInput.value = activeFilter?.max !== undefined ? String(activeFilter.max) : '';
});

function scheduleApply(): void {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(apply, APPLY_DEBOUNCE_MS);
}

function apply(): void {
  clearTimeout(applyTimer);
  applyTimer = undefined;
  if (!attribute) return;
  const b = bounds.value;
  if (isUsableBounds(b)) {
    controller.value?.setNumericRange(attribute, rangeFromThumbs(thumbMin.value, thumbMax.value, b));
    return;
  }
  // No bounds yet (stats still loading): fall back to the raw typed values.
  const min = minInput.value === '' ? undefined : Number(minInput.value);
  const max = maxInput.value === '' ? undefined : Number(maxInput.value);
  controller.value?.setNumericRange(attribute, min === undefined && max === undefined ? null : { min, max });
}

function setThumb(which: 'min' | 'max', raw: number): void {
  const b = bounds.value;
  if (!isUsableBounds(b)) return;
  if (which === 'min') {
    thumbMin.value = clampThumb('min', raw, thumbMax.value, b);
    minInput.value = thumbMin.value > b.min ? String(thumbMin.value) : '';
  } else {
    thumbMax.value = clampThumb('max', raw, thumbMin.value, b);
    maxInput.value = thumbMax.value < b.max ? String(thumbMax.value) : '';
  }
  scheduleApply();
}

/** Keyboard on the native inputs (arrows, Home/End, page keys). */
function onSlide(which: 'min' | 'max', e: Event): void {
  const input = e.target as HTMLInputElement;
  setThumb(which, input.valueAsNumber);
  input.value = String(which === 'min' ? thumbMin.value : thumbMax.value);
}

/**
 * Pointer interaction lives on the track container: press picks the nearest
 * thumb (recoverable even when both are stacked at an extreme) and drags it.
 * Firefox ignores pointer-events on range-thumb pseudos, so the native inputs
 * are keyboard/AT-only (pointer-events: none).
 */
function onTrackPointerDown(e: PointerEvent): void {
  const b = bounds.value;
  if (!isUsableBounds(b) || e.button !== 0) return;
  const rect = sliderEl.value!.getBoundingClientRect();
  const value = valueFromPointer(e.clientX, rect, b, step);
  dragging = pickThumb(value, thumbMin.value, thumbMax.value);
  editing.value = true;
  sliderEl.value!.setPointerCapture(e.pointerId);
  setThumb(dragging, value);
}

function onTrackPointerMove(e: PointerEvent): void {
  const b = bounds.value;
  if (!dragging || !isUsableBounds(b)) return;
  setThumb(dragging, valueFromPointer(e.clientX, sliderEl.value!.getBoundingClientRect(), b, step));
}

function onTrackPointerUp(): void {
  if (!dragging) return;
  dragging = null;
  stopSliding();
}

function onTypedInput(which: 'min' | 'max', e: Event): void {
  const raw = (e.target as HTMLInputElement).value;
  if (which === 'min') minInput.value = raw;
  else maxInput.value = raw;
}

function onTypedChange(): void {
  const b = bounds.value;
  if (isUsableBounds(b)) {
    thumbMin.value = clampThumb('min', minInput.value === '' ? b.min : Number(minInput.value), thumbMax.value, b);
    thumbMax.value = clampThumb('max', maxInput.value === '' ? b.max : Number(maxInput.value), thumbMin.value, b);
    minInput.value = thumbMin.value > b.min ? String(thumbMin.value) : '';
    maxInput.value = thumbMax.value < b.max ? String(thumbMax.value) : '';
  }
  editing.value = false;
  apply();
}

function startEditing(): void {
  editing.value = true;
}

function stopSliding(): void {
  // Flush any pending debounced apply BEFORE editing turns off — otherwise the
  // state-sync effect re-runs against the not-yet-applied filter and snaps the
  // thumbs back (state mutates synchronously in apply(), so the effect that
  // fires after this sees the applied range and keeps the thumbs in place).
  if (applyTimer !== undefined) apply();
  editing.value = false;
}

onBeforeUnmount(() => clearTimeout(applyTimer));
</script>

<template>
  <div class="sq-root" part="root" role="group" :aria-label="`${header ?? attribute ?? ''} range`">
    <button
      v-if="header && collapsible"
      class="header header-toggle"
      part="header"
      type="button"
      :aria-expanded="isCollapsed ? 'false' : 'true'"
      @click="isCollapsed = !isCollapsed"
    >
      <span class="header-text">{{ header }}</span>
      <span class="caret" part="caret" :class="{ collapsed: isCollapsed }" aria-hidden="true"></span>
    </button>
    <div v-else-if="header" class="header" part="header">{{ header }}</div>

    <div v-show="!isCollapsed" class="body" part="body">
    <div
      ref="sliderEl"
      class="slider"
      part="slider"
      @pointerdown="onTrackPointerDown"
      @pointermove="onTrackPointerMove"
      @pointerup="onTrackPointerUp"
      @pointercancel="onTrackPointerUp"
    >
      <div class="track" part="track"></div>
      <div class="fill" part="fill" :style="fillStyle"></div>
      <input
        class="thumb-input"
        part="range-min"
        type="range"
        :min="bounds?.min ?? 0"
        :max="bounds?.max ?? 100"
        :step="step"
        :value="thumbMin"
        :disabled="!usable"
        :aria-label="`Minimum ${attribute ?? ''}`"
        :aria-valuetext="`${prefix}${thumbMin}`"
        @input="onSlide('min', $event)"
        @focus="startEditing"
        @blur="stopSliding"
      />
      <input
        class="thumb-input"
        part="range-max"
        type="range"
        :min="bounds?.min ?? 0"
        :max="bounds?.max ?? 100"
        :step="step"
        :value="thumbMax"
        :disabled="!usable"
        :aria-label="`Maximum ${attribute ?? ''}`"
        :aria-valuetext="`${prefix}${thumbMax}`"
        @input="onSlide('max', $event)"
        @focus="startEditing"
        @blur="stopSliding"
      />
    </div>
    <div class="inputs">
      <span v-if="prefix" class="prefix" part="prefix">{{ prefix }}</span>
      <input
        class="input"
        part="input-min"
        type="number"
        inputmode="decimal"
        :step="step"
        :placeholder="bounds ? String(bounds.min) : 'min'"
        :value="minInput"
        aria-label="Minimum"
        @focus="startEditing"
        @input="onTypedInput('min', $event)"
        @change="onTypedChange"
      />
      <span class="sep" part="separator">–</span>
      <span v-if="prefix" class="prefix" part="prefix">{{ prefix }}</span>
      <input
        class="input"
        part="input-max"
        type="number"
        inputmode="decimal"
        :step="step"
        :placeholder="bounds ? String(bounds.max) : 'max'"
        :value="maxInput"
        aria-label="Maximum"
        @focus="startEditing"
        @input="onTypedInput('max', $event)"
        @change="onTypedChange"
      />
    </div>
    </div>
  </div>
</template>

<style>
.header {
  font-weight: 600;
  margin-bottom: calc(var(--sparq-spacing, 8px));
}
.header-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--sparq-spacing, 8px));
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.caret {
  flex: 0 0 auto;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid currentColor;
  transform: rotate(180deg);
  transition: transform 0.15s ease;
}
.caret.collapsed {
  transform: rotate(0deg);
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
}
/* Fixed height from first paint — bounds arriving later must not shift layout. */
.slider {
  position: relative;
  height: 28px;
  touch-action: none; /* horizontal thumb drags must not fight page scroll */
  cursor: pointer;
}
.track,
.fill {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 4px;
  border-radius: 999px;
}
.track {
  left: 0;
  right: 0;
  background: var(--sparq-color-border, #d1d5db);
}
.fill {
  background: var(--sparq-color-primary, #2563eb);
}

/* Two full-width native ranges overlaid, keyboard/AT-only: ALL pointer input
   is handled by the track container (Firefox ignores pointer-events on
   range-thumb pseudos, so a thumb-level exception is not portable). */
.thumb-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 28px;
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
}
.thumb-input::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  border: 0;
}
.thumb-input::-moz-range-track {
  background: transparent;
  border: 0;
}
.thumb-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -1px;
  border-radius: 50%;
  background: var(--sparq-color-bg, #fff);
  border: 2px solid var(--sparq-color-primary, #2563eb);
}
.thumb-input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--sparq-color-bg, #fff);
  border: 2px solid var(--sparq-color-primary, #2563eb);
}
.thumb-input:focus-visible {
  outline: none;
}
.thumb-input:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px var(--sparq-color-focus, rgba(37, 99, 235, 0.4));
}
.thumb-input:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 3px var(--sparq-color-focus, rgba(37, 99, 235, 0.4));
}
.thumb-input:disabled::-webkit-slider-thumb {
  border-color: var(--sparq-color-border, #d1d5db);
  cursor: default;
}
.thumb-input:disabled::-moz-range-thumb {
  border-color: var(--sparq-color-border, #d1d5db);
  cursor: default;
}

.inputs {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}
.input {
  width: 6em;
  padding: calc(var(--sparq-spacing, 8px) * 0.75);
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius-sm, 4px);
  background: var(--sparq-color-bg, #fff);
}
.sep,
.prefix {
  color: var(--sparq-color-text-muted, #6b7280);
}
</style>
