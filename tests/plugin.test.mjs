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

// The live plugin SDK namespace the loader installs before evaluating the
// module: host.request answers model.options, MODEL_MENU_ROW_AREA names the
// row-contribution area, catalogProviderMatches maps slugs.
const CATALOG = {
  providers: [
    {
      slug: 'nous',
      name: 'Nous Research',
      pricing: {
        'hermes-4-70b': { input: '$0.40', output: '$1.60', cache: '$0.10', free: false, discount_percent: 20 },
        'hermes-free': { input: '', output: '', free: true },
        'fast-only-fast': { input: '$1.00', output: '$2.00', free: false }
      }
    },
    {
      slug: 'openrouter',
      name: 'OpenRouter',
      pricing: { 'shared-model': { input: '$2.00', output: '$8.00', free: false } }
    },
    { slug: 'priceless', name: 'No Pricing Co' }
  ]
}
const modelOptionsCalls = []
globalThis.__HERMES_PLUGIN_SDK__ = {
  MODEL_MENU_ROW_AREA: 'modelMenu.row',
  catalogProviderMatches: (provider, slug) => provider?.slug === slug,
  host: {
    request: (method, params) => {
      modelOptionsCalls.push([method, params])
      return Promise.resolve(method === 'model.options' ? CATALOG : null)
    }
  }
}

const { default: plugin } = await import(PLUGIN_PATH)

const results = []
const check = (name, cond) => results.push([cond ? 'PASS' : 'FAIL', name])
const flush = () => new Promise(resolve => setTimeout(resolve, 20))

// Mock ctx mirroring the real contract: i18n bundles per locale (t() resolves
// the ACTIVE locale, onLocaleChange notifies), register() captures data
// contributions so the test can drive decorate() like core does per row.
const BUNDLES = {
  en: { priceLabel: 'Price' },
  es: { priceLabel: 'Precio' },
  ja: { priceLabel: '価格' }
}
let activeLocale = 'en'
const localeListeners = []
const contributions = []
const ctx = {
  onDispose: fn => disposers.push(fn),
  register: contribution => {
    contributions.push(contribution)
    return () => {}
  },
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

/** Drive the captured row-probe contribution the way core drives it: one
 *  decorate() call per painted row. */
const seedRow = (label, model, provider) => {
  const probe = contributions.find(c => c.area === 'modelMenu.row')
  probe.data.decorate({ label, model, provider })
}

const makeMenu = ({ id, triggerClass = 'group/model', priceHtml = '', labels = true, name = 'Model', group = null }) => {
  const trigger = document.createElement('div')
  trigger.setAttribute('data-slot', 'dropdown-menu-sub-trigger')
  trigger.className = `flex items-center gap-2 px-2.5 py-1 text-xs ${triggerClass}`
  trigger.setAttribute('aria-controls', id)
  trigger.innerHTML = `<span class="flex min-w-0 flex-1 items-center gap-1.5"><span class="min-w-0 truncate">${name}</span></span>${priceHtml}<i aria-hidden="true" class="codicon codicon-check text-foreground" style="font-size:0.75rem"></i><i aria-hidden="true" class="codicon codicon-chevron-right ml-auto text-(--ui-text-tertiary)"></i>`

  const content = document.createElement('div')
  content.id = id
  content.setAttribute('data-slot', 'dropdown-menu-sub-content')
  content.className = 'w-52 p-0'
  content.innerHTML = labels
    ? `<div data-slot="dropdown-menu-label" class="px-2.5 pt-1 pb-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-(--ui-text-secondary)">Options</div>
       <div role="menuitem">Thinking<switch></switch></div>
       <div role="separator" aria-orientation="horizontal" data-slot="dropdown-menu-separator" class="my-1 h-px bg-(--ui-stroke-tertiary) mx-0"></div>
       <div data-slot="dropdown-menu-label" class="px-2.5 pt-1 pb-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-(--ui-text-secondary)">Effort</div>
       <div role="group"><div role="menuitemradio">Low</div></div>`
    : '<div class="px-2.5 py-3 text-xs">No options</div>'

  if (group) {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-slot', 'dropdown-menu-group')
    wrap.append(trigger)
    document.body.append(wrap, content)

    if (group.providerLabel) {
      const label = document.createElement('div')
      label.setAttribute('data-slot', 'dropdown-menu-label')
      label.textContent = group.providerLabel
      wrap.insertBefore(label, trigger)
    }

    if (group.heading) {
      const heading = document.createElement('div')
      heading.setAttribute('data-slot', 'dropdown-menu-item')
      heading.innerHTML = `<span class="truncate">${group.heading}</span>`
      wrap.insertBefore(heading, wrap.firstChild)
    }
  } else {
    document.body.append(trigger, content)
  }

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
check('css hides composer reasoning pill', Boolean(style?.textContent.includes('data-testid="reasoning-pill"')))
check('row-probe contribution registered', contributions.some(c => c.area === 'modelMenu.row' && typeof c.data?.decorate === 'function'))
check('no model.options call while clone path suffices', !modelOptionsCalls.length)

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

// ── A model row with no live price AND no catalog ref gets no block ──────────
const { content: poorContent } = makeMenu({ id: 'radix-:rB:', name: 'Unmapped Model' })
await flush()
check('unmapped row untouched', !poorContent.querySelector('[data-model-price-submenu]'))

// ── Catalog path: pricing flag off / usage-window plan (no live price node) ──
seedRow('Hermes 4 70B', 'hermes-4-70b', 'nous')
const { content: planContent } = makeMenu({ id: 'radix-:rD:', name: 'Hermes 4 70B' })
await flush()
await flush()
check('model.options fetched for catalog path', modelOptionsCalls.some(([method]) => method === 'model.options'))
const synth = planContent.querySelector('[data-model-price-submenu-row]')?.firstElementChild
check('catalog price injected', Boolean(synth))
check('catalog price shows paid rates', Boolean(synth?.textContent.includes('$0.40/$1.60')))
check('catalog price keeps cache read', Boolean(synth?.textContent.includes('·$0.10')))
check('catalog price keeps discount tag', Boolean(synth?.textContent.includes('−20%')))
check('catalog price mirrors row markup', Boolean(synth?.className.includes('tabular-nums') && synth.className.includes('text-[0.625rem]')))
check(
  'catalog price composes localized title',
  synth?.getAttribute('title') === 'Input $0.40/Mtok · Output $1.60/Mtok · Cached read $0.10/Mtok'
)
check('catalog block labelled', planContent.querySelector('[data-model-price-submenu-label]')?.textContent === 'Price')

// A provider label above the row disambiguates colliding display names.
seedRow('Shared Name', 'shared-model', 'openrouter')
seedRow('Shared Name', 'hermes-4-70b', 'nous')
const { content: collidingContent } = makeMenu({
  id: 'radix-:rE:',
  name: 'Shared Name',
  group: { providerLabel: 'Nous Research' }
})
await flush()
const hinted = collidingContent.querySelector('[data-model-price-submenu-row]')?.firstElementChild
check('provider label disambiguates same-name rows', Boolean(hinted?.textContent.includes('$0.40/$1.60')))

// The provider group's collapsible heading disambiguates too.
const { content: headingContent } = makeMenu({
  id: 'radix-:rF:',
  name: 'Shared Name',
  group: { heading: 'OpenRouter' }
})
await flush()
const headed = headingContent.querySelector('[data-model-price-submenu-row]')?.firstElementChild
check('group heading disambiguates same-name rows', Boolean(headed?.textContent.includes('$2.00/$8.00')))

// Free tier from the catalog alone.
seedRow('Hermes Free', 'hermes-free', 'nous')
const { content: synthFreeContent } = makeMenu({ id: 'radix-:rG:', name: 'Hermes Free' })
await flush()
const synthFree = synthFreeContent.querySelector('[data-model-price-submenu-row]')?.firstElementChild
check('catalog free variant injected', synthFree?.textContent === 'free')
check('catalog free variant keeps green', Boolean(synthFree?.className.includes('text-(--ui-green)')))

// Pricing that only exists on the -fast sibling still lands.
seedRow('Fast Only', 'fast-only', 'nous')
const { content: fastContent } = makeMenu({ id: 'radix-:rH:', name: 'Fast Only' })
await flush()
check(
  '-fast sibling pricing falls back',
  Boolean(fastContent.querySelector('[data-model-price-submenu-row]')?.firstElementChild?.textContent.includes('$1.00/$2.00'))
)

// A provider without pricing data stays bare.
seedRow('No Price Model', 'whatever', 'priceless')
const { content: noPriceContent } = makeMenu({ id: 'radix-:rI:', name: 'No Price Model' })
await flush()
check('provider without pricing untouched', !noPriceContent.querySelector('[data-model-price-submenu]'))

// ── Composer: effort chip on the model pill, reasoning pill hidden ──────────
// The pills are adjacent siblings (Tip/DropdownMenu merge props, no wrappers).
const composer = document.createElement('div')
composer.innerHTML = `
  <button data-tour="model-pill" data-slot="dropdown-menu-trigger" type="button">
    <span class="truncate">Hermes 4 70B</span><svg></svg>
  </button>
  <button data-testid="reasoning-pill" data-slot="dropdown-menu-trigger" type="button">
    <span>High</span><svg></svg>
  </button>`
document.body.append(composer)
await flush()

const [modelPill, reasoningPill] = composer.children
const chip = modelPill.querySelector('[data-model-price-submenu-effort]')
check('effort chip on the model pill', Boolean(chip))
check('chip next to the model name', chip?.previousElementSibling?.classList.contains('truncate'))
check('chip carries the pill level', chip?.textContent === 'High')
check(
  'chip styled like a row setting chip',
  Boolean(
    chip?.className.includes('border') &&
      chip.className.includes('text-[0.6rem]') &&
      chip.className.includes('uppercase') &&
      chip.getAttribute('data-slot') === 'badge'
  )
)

// The hidden pill keeps updating — the chip mirrors the new level.
reasoningPill.firstElementChild.textContent = 'Ultra→Max'
await flush()
check('chip mirrors level changes', modelPill.querySelector('[data-model-price-submenu-effort]')?.textContent === 'Ultra→Max')

// A pending effort renders the GlyphSpinner instead of a level: no chip.
reasoningPill.innerHTML = '<span class="glyph-spinner">⠋</span>'
await flush()
check('no chip while effort is pending', !modelPill.querySelector('[data-model-price-submenu-effort]'))

// Level resolves again — the chip comes back.
reasoningPill.innerHTML = '<span>Low</span><svg></svg>'
await flush()
check('chip returns once effort resolves', modelPill.querySelector('[data-model-price-submenu-effort]')?.textContent === 'Low')

// Reasoning pill unmounts entirely (model without reasoning): the orphan goes.
reasoningPill.remove()
await flush()
check('chip removed when the pill is gone', !modelPill.querySelector('[data-model-price-submenu-effort]'))

// ── Disposal restores the DOM ───────────────────────────────────────────────
for (const dispose of disposers) {
  dispose()
}
check('blocks removed on dispose', !document.querySelector('[data-model-price-submenu]'))
check('effort chips removed on dispose', !document.querySelector('[data-model-price-submenu-effort]'))
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
