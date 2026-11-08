// SPDX-FileCopyrightText: 2026 Miguel Euraque
// SPDX-License-Identifier: MIT

// Behaviour test for desktop/plugin.js against a simulated Hermes model
// catalog DOM. Requires jsdom (`npm i -D jsdom`, or run inside the
// hermes-agent repo where it is a dev dependency):
//
//   node tests/plugin.test.mjs
//
// Exits 0 when jsdom is unavailable so the suite stays runnable anywhere.

let JSDOM
try {
  ;({ JSDOM } = await import('jsdom'))
} catch {
  console.log('SKIP — jsdom not installed')
  process.exit(0)
}

const PLUGIN_PATH = new URL('../desktop/plugin.js', import.meta.url).pathname

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
const { window } = dom

for (const key of ['document', 'MutationObserver', 'HTMLElement']) {
  globalThis[key] = window[key]
}
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0)
globalThis.cancelAnimationFrame = clearTimeout
globalThis.CSS = { escape: s => String(s).replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`) }

const { default: plugin } = await import(PLUGIN_PATH)

const results = []
const check = (name, cond) => results.push([cond ? 'PASS' : 'FAIL', name])
const flush = () => new Promise(resolve => setTimeout(resolve, 20))

// Mock ctx.i18n mirroring the real contract: bundles per locale, t() resolves
// the ACTIVE locale, onLocaleChange notifies listeners.
const BUNDLES = {
  en: { priceLabel: 'Price' },
  es: { priceLabel: 'Precio' },
  ja: { priceLabel: '価格' }
}
let activeLocale = 'en'
const localeListeners = []
const ctx = {
  onDispose: fn => disposers.push(fn),
  i18n: {
    register: bundles => {
      Object.assign(BUNDLES, bundles)
      return () => {}
    },
    t: key => BUNDLES[activeLocale]?.[key] ?? BUNDLES.en[key] ?? key,
    onLocaleChange: listener => {
      localeListeners.push(listener)
      return () => {}
    }
  }
}
const disposers = []
plugin.register(ctx)

const makeMenu = ({ id, triggerClass = 'group/model', priceHtml = '', labels = true }) => {
  const trigger = document.createElement('div')
  trigger.setAttribute('data-slot', 'dropdown-menu-sub-trigger')
  trigger.className = `flex items-center gap-2 px-2.5 py-1 text-xs ${triggerClass}`
  trigger.setAttribute('aria-controls', id)
  trigger.innerHTML = `<span class="flex min-w-0 flex-1 items-center gap-1.5"><span class="min-w-0 truncate">Model</span></span>${priceHtml}<i aria-hidden="true" class="codicon codicon-check text-foreground" style="font-size:0.75rem"></i><i aria-hidden="true" class="codicon codicon-chevron-right ml-auto text-(--ui-text-tertiary)"></i>`

  const content = document.createElement('div')
  content.id = id
  content.setAttribute('data-slot', 'dropdown-menu-sub-content')
  content.className = 'w-52 p-0'
  content.innerHTML = labels
    ? `<div data-slot="dropdown-menu-label" class="px-2 py-1 text-xs font-medium text-(--ui-text-tertiary) px-2.5 pt-1 pb-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-(--ui-text-secondary)">Options</div>
       <div role="menuitem">Thinking<switch></switch></div>
       <div role="separator" aria-orientation="horizontal" data-slot="dropdown-menu-separator" class="my-1 h-px bg-(--ui-stroke-tertiary) mx-0"></div>
       <div data-slot="dropdown-menu-label" class="px-2 py-1 text-xs font-medium text-(--ui-text-tertiary) px-2.5 pt-1 pb-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-(--ui-text-secondary)">Effort</div>
       <div role="group"><div role="menuitemradio">Low</div></div>`
    : '<div class="px-2.5 py-3 text-xs">No options</div>'

  document.body.append(trigger, content)
  return { trigger, content }
}

const PAID_PRICE = `<span class="flex shrink-0 items-center gap-1.5 pl-2 text-[0.625rem] tabular-nums text-(--ui-text-tertiary)" title="Input $0.30 / Output $1.20">
  <span>$0.30/$1.20</span>
  <span class="text-(--ui-text-quaternary)" title="Cache read $0.10/Mtok">·$0.10</span>
  <span class="rounded bg-(--ui-green)/10 px-1 py-px font-medium text-(--ui-green)">−30%</span>
</span>`

// ── Paid model row with a reasoning submenu ─────────────────────────────────
const { trigger, content } = makeMenu({ id: 'radix-:r7:', priceHtml: PAID_PRICE })
await flush()

const style = document.querySelector('style[data-plugin="model-price-submenu"]')
check('style injected', Boolean(style))
check('css hides row price', style?.textContent.includes('display: none !important') && style.textContent.includes('group/model'))
check('css hides selected-check icon', style?.textContent.includes('i.codicon-check'))

const block = content.querySelector(':scope > [data-model-price-submenu]')
check('block appended as last child', Boolean(block) && content.lastElementChild === block)

const [separator, label, row] = block?.children ?? []
check('separator role', separator?.getAttribute('role') === 'separator')
check(
  'separator matches native classes',
  Boolean(separator?.className.includes('h-px')) &&
    separator.className.includes('bg-(--ui-stroke-tertiary)') &&
    separator.className.includes('mx-0')
)

check('label between separator and price', label?.hasAttribute('data-model-price-submenu-label') && row?.hasAttribute('data-model-price-submenu-row'))
check('label text is localized "Price"', label?.textContent === 'Price')
check(
  'label clones section-label classes',
  Boolean(
    label?.className.includes('text-[0.625rem]') &&
      label.className.includes('uppercase') &&
      label.className.includes('tracking-wide') &&
      label.className.includes('text-(--ui-text-secondary)')
  )
)

const clone = row?.firstElementChild
check('price cloned below label', Boolean(clone))
check('clone shows paid rates', Boolean(clone?.textContent.includes('$0.30/$1.20')))
check('clone keeps cache read', Boolean(clone?.textContent.includes('·$0.10')))
check('clone keeps discount tag', Boolean(clone?.textContent.includes('−30%')))
check('clone drops row padding', !clone?.classList.contains('pl-2'))
check('clone keeps price look', Boolean(clone?.classList.contains('text-[0.625rem]') && clone.classList.contains('tabular-nums')))

const original = trigger.querySelector(':scope > span[class~="pl-2"]')
check('row price kept mounted for React', Boolean(original) && original.classList.contains('pl-2'))

// Pricing still warming: the row node mutates, the clone must follow.
original.querySelector('span').textContent = '$0.40/$1.50'
await flush()
check('clone refreshes on price update', Boolean(row.firstElementChild.textContent.includes('$0.40/$1.50')))

// ── Locale switch while the submenu stays open ───────────────────────────────
activeLocale = 'es'
for (const listener of localeListeners) listener()
await flush()
check('label follows locale switch (es)', label.textContent === 'Precio')
activeLocale = 'ja'
for (const listener of localeListeners) listener()
await flush()
check('label follows locale switch (ja)', label.textContent === '価格')
activeLocale = 'en'

// ── "free" variant ──────────────────────────────────────────────────────────
const { content: freeContent } = makeMenu({
  id: 'radix-:r9:',
  priceHtml: '<span class="shrink-0 pl-2 text-[0.625rem] text-(--ui-green)">free</span>'
})
await flush()
const freeClone = freeContent.querySelector('[data-model-price-submenu-row]')?.firstElementChild
check('free variant injected', freeClone?.textContent === 'free')
check('free variant keeps green', Boolean(freeClone?.className.includes('text-(--ui-green)')))
check('free variant also labelled', freeContent.querySelector('[data-model-price-submenu-label]')?.textContent === 'Price')

// ── "no options" panel: no template label — fallback classes still apply ─────
const { content: bareContent } = makeMenu({ id: 'radix-:rC:', priceHtml: PAID_PRICE, labels: false })
await flush()
const bareLabel = bareContent.querySelector('[data-model-price-submenu-label]')
check('label fallback on label-less panel', Boolean(bareLabel) && bareLabel.className.includes('uppercase'))

// ── A non-model submenu is left alone ───────────────────────────────────────
const { content: otherContent } = makeMenu({
  id: 'radix-:rA:',
  triggerClass: '',
  priceHtml: '<span class="pl-2 text-[0.625rem]">$1/$2</span>'
})
await flush()
check('non-model submenu untouched', !otherContent.querySelector('[data-model-price-submenu]'))

// ── A model row without price gets no block ─────────────────────────────────
const { content: poorContent } = makeMenu({ id: 'radix-:rB:' })
await flush()
check('priceless row untouched', !poorContent.querySelector('[data-model-price-submenu]'))

// ── Disposal restores the DOM ───────────────────────────────────────────────
for (const dispose of disposers) {
  dispose()
}
check('blocks removed on dispose', !document.querySelector('[data-model-price-submenu]'))
check('style removed on dispose', !document.querySelector('style[data-plugin="model-price-submenu"]'))

let ok = true
for (const [status, name] of results) {
  if (status === 'FAIL') {
    ok = false
  }
  console.log(status, name)
}
console.log(ok ? 'ALL PASS' : 'FAILURES')
process.exit(ok ? 0 : 1)
