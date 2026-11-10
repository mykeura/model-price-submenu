// SPDX-FileCopyrightText: 2026 Miguel Euraque
// SPDX-License-Identifier: MIT

/**
 * Model Price Submenu for Hermes Desktop
 *
 * Moves the per-model price out of the catalog row and into the row's
 * hover-opened options submenu (Thinking / effort / fast), where it renders
 * below the reasoning section behind the same separator Hermes draws between
 * the toggles and the effort radios, headed by a localized "PRICE" label in
 * the section-label type. The row keeps just the model name, so crowded Nous
 * Portal rows read cleanly again.
 *
 * This is a runtime-only DOM/CSS adaptation. It does not modify Hermes core.
 *
 * Anchors (apps/desktop/src/app/shell/model-catalog-menu.tsx): the price is
 * the ONLY direct-child span of the row's DropdownMenuSubTrigger carrying
 * both the `pl-2` and `text-[0.625rem]` tokens — the paid `$in/$out ·cache
 * −N%` variant and the green "free" variant alike; badges, chips, the usage
 * tag and the load bar all use other sizes/padding. The submenu surfaces as
 * `data-slot="dropdown-menu-sub-content"`, linked to its open trigger by the
 * trigger's `aria-controls` (Radix sets it only while the sub is open).
 *
 * Two price sources, tried in order:
 *
 *  1. The row's own live `ModelPrice` node, cloned verbatim — exact when the
 *     "Show model pricing" setting is on and the account is not on a
 *     usage-window plan.
 *  2. A rebuilt node from the `model.options` catalog (`provider.pricing`),
 *     for when Hermes never mounts the row price at all: the setting is off,
 *     or the provider reports `plan_usage.kind === 'usage_window'` and core
 *     paints a UsageLevelTag instead. The catalog's `modelMenu.row`
 *     contribution point hands the plugin each row's {label, model,
 *     provider} through `decorate` — the plugin returns null there (bare
 *     row, no slot taken) and only keeps the identity so a submenu can map
 *     its trigger back to the pricing record. The rebuilt span repeats
 *     ModelPrice's own markup — paid `$in/$out`, cached-read suffix,
 *     discount chip and the green "free" variant — with the same localized
 *     words the app ships per locale.
 */

const PLUGIN_ID = 'model-price-submenu'
const SUB_CONTENT_SELECTOR = '[data-slot="dropdown-menu-sub-content"]'
const SUB_TRIGGER_SELECTOR = '[data-slot="dropdown-menu-sub-trigger"]'
const GROUP_SELECTOR = '[data-slot="dropdown-menu-group"]'
const MENU_LABEL_SELECTOR = '[data-slot="dropdown-menu-label"]'
const MENU_ITEM_SELECTOR = '[data-slot="dropdown-menu-item"]'
// ModelFamilyRow marks its trigger `group/model` — the gate that keeps this
// plugin away from every other submenu in the app.
const MODEL_ROW_CLASS = 'group/model'
const BLOCK_ATTR = 'data-model-price-submenu'
const ROW_ATTR = 'data-model-price-submenu-row'
const LABEL_ATTR = 'data-model-price-submenu-label'
const PRICE_SELECTOR = 'span[class~="pl-2"][class~="text-[0.625rem]"]'
// The contribution area core resolves row decorators from — a standing
// compatibility promise (model-menu-row-decorations.tsx).
const ROW_AREA_FALLBACK = 'modelMenu.row'
// Composer pills: the reasoning selector is its own button next to the model
// pill — an adjacent sibling in the same controls row (Tip and DropdownMenu
// both merge props onto the button, so no wrappers sit between them).
const REASONING_PILL_SELECTOR = 'button[data-testid="reasoning-pill"]'
const CHIP_ATTR = 'data-model-price-submenu-effort'
// Badge size="xs" variant="outline" + the uppercase tracking ModelChip adds —
// the same box the catalog rows use for the effort preset chip.
const EFFORT_CHIP_CLASS =
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-[3px] border border-(--ui-stroke-secondary) px-1 py-px font-medium leading-none whitespace-nowrap text-muted-foreground text-[0.6rem] uppercase tracking-wide'

// model.options is already the catalog the open menu just read; refetches
// stay lazy — at most one in flight, at most one per interval, fresh while
// the menu is being used.
const CATALOG_TTL_MS = 60_000
const CATALOG_MIN_INTERVAL_MS = 10_000

// The section labels ("OPTIONS", "EFFORT") are stored title-case and painted
// uppercase by the menu's own label class — the bundles follow that and ship
// the word in the locale's casing. The remaining keys mirror the words
// ModelPrice itself pulls from t.shell.modelMenu per locale, so a rebuilt
// node reads exactly like the cloned one.
const LABEL_BUNDLES = {
  en: {
    priceLabel: 'Price',
    free: 'free',
    cacheRead: 'cached read',
    titleInput: 'Input',
    titleOutput: 'Output',
    titleCache: 'Cached read'
  },
  de: {
    priceLabel: 'Preis',
    free: 'kostenlos',
    cacheRead: 'Cache-Lesung',
    titleInput: 'Eingabe',
    titleOutput: 'Ausgabe',
    titleCache: 'Cache-Lesung'
  },
  es: {
    priceLabel: 'Precio',
    free: 'gratis',
    cacheRead: 'lectura en caché',
    titleInput: 'Entrada',
    titleOutput: 'Salida',
    titleCache: 'Lectura en caché'
  },
  fr: {
    priceLabel: 'Prix',
    free: 'gratuit',
    cacheRead: 'lecture en cache',
    titleInput: 'Entrée',
    titleOutput: 'Sortie',
    titleCache: 'Lecture en cache'
  },
  ja: {
    priceLabel: '価格',
    free: '無料',
    cacheRead: 'キャッシュ読み取り',
    titleInput: '入力',
    titleOutput: '出力',
    titleCache: 'キャッシュ読み取り'
  },
  ru: {
    priceLabel: 'Цена',
    free: 'бесплатно',
    cacheRead: 'чтение из кэша',
    titleInput: 'Вход',
    titleOutput: 'Выход',
    titleCache: 'Чтение из кэша'
  },
  zh: {
    priceLabel: '价格',
    free: '免费',
    cacheRead: '缓存读取',
    titleInput: '输入',
    titleOutput: '输出',
    titleCache: '缓存读取'
  },
  'zh-hant': {
    priceLabel: '價格',
    free: '免費',
    cacheRead: '快取讀取',
    titleInput: '輸入',
    titleOutput: '輸出',
    titleCache: '快取讀取'
  },
  ar: {
    priceLabel: 'السعر',
    free: 'مجاني',
    cacheRead: 'قراءة من الذاكرة المؤقتة',
    titleInput: 'الإدخال',
    titleOutput: 'الإخراج',
    titleCache: 'قراءة من الذاكرة المؤقتة'
  }
}

const STYLE_TEXT = `
/* The price stays mounted for React (title + text still update while Nous
   pricing warms) but never paints on the row. */
${SUB_TRIGGER_SELECTOR}[class~="${MODEL_ROW_CLASS}"] > ${PRICE_SELECTOR} {
  display: none !important;
}

/* The ✓ on the selected row is redundant — the active highlight already marks
   it. Only codicon-check sits as a direct trigger child; the star lives inside
   its button and the submenu caret is codicon-chevron-right. */
${SUB_TRIGGER_SELECTOR}[class~="${MODEL_ROW_CLASS}"] > i.codicon-check {
  display: none !important;
}

/* The composer's reasoning pill duplicates the submenu every model row
   already carries — its level shows on the model pill's own chip instead.
   display:none keeps the button mounted so React keeps resolving the live
   effort label into it, which the chip mirrors. */
${REASONING_PILL_SELECTOR} {
  display: none !important;
}
`

/** The open SubContent's row trigger, or null when the sub belongs to a
 *  non-model menu (aria-controls is only set while the sub is open). */
function findRowTrigger(content) {
  if (!content.id) {
    return null
  }

  const trigger = document.querySelector(`${SUB_TRIGGER_SELECTOR}[aria-controls="${CSS.escape(content.id)}"]`)

  return trigger instanceof HTMLElement && trigger.classList.contains(MODEL_ROW_CLASS) ? trigger : null
}

function findRowPrice(trigger) {
  for (const child of trigger.children) {
    if (child instanceof HTMLElement && child.matches(PRICE_SELECTOR)) {
      return child
    }
  }

  return null
}

/** Clone the live price node so the submenu shows the identical string —
 *  paid, cached-read, discount and "free" variants included. `pl-2` was the
 *  gap from the model name on the row; the wrapper's own padding replaces it. */
function priceClone(price) {
  const clone = price.cloneNode(true)
  clone.classList.remove('pl-2')
  return clone
}

/** The provider-name texts surrounding this row, for label collisions across
 *  providers: favorites interleave `dropdown-menu-label` provider names above
 *  each provider's rows, while provider groups put the name in the group's
 *  collapsible heading item (its `span.truncate`). Section headings land in
 *  the same set but never equal a provider name, so they cannot win a match. */
function providerNameHints(trigger) {
  const hints = new Set()

  for (let sib = trigger.previousElementSibling; sib; sib = sib.previousElementSibling) {
    if (sib.getAttribute('data-slot') === 'dropdown-menu-label') {
      hints.add(sib.textContent.trim())
    }
  }

  const heading = trigger.closest(GROUP_SELECTOR)?.querySelector(`${MENU_ITEM_SELECTOR} .truncate`)
  if (heading) {
    hints.add(heading.textContent.trim())
  }

  return hints
}

/** ModelPricing -> the exact span ModelPrice renders, minus `pl-2` (the row
 *  gap; the wrapper's own padding replaces it, same as the clone path). */
function buildPrice(pricing, copy) {
  const input = pricing?.input || null
  const output = pricing?.output || null
  const cache = pricing?.cache || null

  if (pricing?.free) {
    const free = document.createElement('span')
    free.className = 'shrink-0 text-[0.625rem] text-(--ui-green)'
    free.textContent = copy.free
    return free
  }

  // Partial payloads: "" for unknown — render nothing rather than "—/—" when
  // neither side reports a rate.
  if (!input && !output) {
    return null
  }

  const discount =
    typeof pricing.discount_percent === 'number' && pricing.discount_percent > 0 ? pricing.discount_percent : null

  const el = document.createElement('span')
  el.className = 'flex shrink-0 items-center gap-1.5 text-[0.625rem] tabular-nums text-(--ui-text-tertiary)'
  el.title =
    `${copy.titleInput} ${input ?? '—'}/Mtok · ${copy.titleOutput} ${output ?? '—'}/Mtok` +
    (cache ? ` · ${copy.titleCache} ${cache}/Mtok` : '')

  const rates = document.createElement('span')
  rates.textContent = `${input ?? '—'}/${output ?? '—'}`
  el.appendChild(rates)

  if (cache) {
    const cached = document.createElement('span')
    cached.className = 'text-(--ui-text-quaternary)'
    cached.title = `${copy.cacheRead} ${cache}/Mtok`
    cached.textContent = `·${cache}`
    el.appendChild(cached)
  }

  if (discount) {
    const tag = document.createElement('span')
    tag.className = 'rounded bg-(--ui-green)/10 px-1 py-px font-medium text-(--ui-green)'
    tag.textContent = `−${discount}%`
    el.appendChild(tag)
  }

  return el
}

/** A "PRICE" label typed exactly like the submenu's own section labels:
 *  clone one's classes when the panel has labels (the "no options" panel has
 *  none — fall back to the same tokens `dropdownMenuSectionLabel` carries). */
function buildLabel(content, text) {
  const template = content.querySelector(MENU_LABEL_SELECTOR)
  const label = template ? template.cloneNode(false) : document.createElement('div')

  if (!template) {
    label.setAttribute('data-slot', 'dropdown-menu-label')
    label.className =
      'px-2.5 pt-1 pb-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-(--ui-text-secondary)'
  }

  label.setAttribute(LABEL_ATTR, '')
  label.textContent = text

  return label
}

/** Separator + label + price row, matching the menu's own parts: the
 *  separator is the same element `DropdownMenuSeparator className="mx-0"`
 *  renders between the toggles and the effort radios, the label clones the
 *  section-label type, and the row reuses the shared row padding. */
function buildBlock(content, price, labelText) {
  const block = document.createElement('div')
  block.setAttribute(BLOCK_ATTR, '')

  const separator = document.createElement('div')
  separator.setAttribute('data-slot', 'dropdown-menu-separator')
  separator.setAttribute('role', 'separator')
  separator.setAttribute('aria-orientation', 'horizontal')
  separator.className = 'mx-0 my-1 h-px bg-(--ui-stroke-tertiary)'

  const row = document.createElement('div')
  row.setAttribute(ROW_ATTR, '')
  row.className = 'flex items-center gap-2 rounded-none px-2.5 py-1 text-xs'
  row.appendChild(price)

  block.append(separator, buildLabel(content, labelText), row)

  return block
}

export default {
  id: PLUGIN_ID,
  name: 'Model Price Submenu',
  description: "Moves each model's price off the catalog row and into its hover submenu, below the reasoning level.",

  register(ctx) {
    const style = document.createElement('style')
    style.dataset.plugin = PLUGIN_ID
    style.textContent = STYLE_TEXT

    let frame = 0
    let disposed = false
    // label -> (provider\0model -> {model, provider}): one entry per painted
    // row, seeded by the row-probe contribution below.
    const rowRefs = new Map()
    // The live plugin SDK namespace: the loader installs the global before
    // this module evaluates, and only ever reaches the dynamic import on a
    // shell too old to — there the catalog path simply stays dark.
    let sdk = globalThis.__HERMES_PLUGIN_SDK__ ?? null
    let catalogData = null
    let catalogAt = 0
    let catalogInflight = false

    // Plugin-scoped bundles resolve against the app's active locale (English
    // fallback built in). Older shells without ctx.i18n degrade to English.
    ctx.i18n?.register(LABEL_BUNDLES)
    const copy = key => ctx.i18n?.t(key) ?? LABEL_BUNDLES.en[key]
    const copyBundle = () => ({
      free: copy('free'),
      cacheRead: copy('cacheRead'),
      titleInput: copy('titleInput'),
      titleOutput: copy('titleOutput'),
      titleCache: copy('titleCache')
    })

    const scheduleSync = () => {
      if (disposed) {
        return
      }

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    }

    /** Refetch the model.options catalog, throttled: one request in flight,
     *  at most one per CATALOG_MIN_INTERVAL_MS, skipped while the data is
     *  fresh — except while a provider is still warming its pricing, where a
     *  quicker retry lands the numbers on the next sync. */
    const ensureCatalog = () => {
      const request = sdk?.host?.request
      if (!request || catalogInflight) {
        return
      }

      const age = Date.now() - catalogAt
      const pending = catalogData?.providers?.some(p => p.pricing_pending || p.free_tier_pending)
      if (catalogData && age < CATALOG_TTL_MS && !pending) {
        return
      }

      if (age < CATALOG_MIN_INTERVAL_MS) {
        return
      }

      catalogAt = Date.now()
      catalogInflight = true
      request('model.options', { explicit_only: true })
        .then(data => {
          if (data) {
            catalogData = data
          }
        })
        .catch(() => {})
        .finally(() => {
          catalogInflight = false
          scheduleSync()
        })
    }

    /** The {model, provider} this trigger's row commits, recovered through the
     *  row-probe map. Display labels collide across providers rarely; when
     *  they do, the provider name painted around the row (favorites label or
     *  group heading) picks the right one. */
    const resolveRowRef = trigger => {
      const label = trigger.querySelector('span.truncate')?.textContent.trim()
      const inner = label ? rowRefs.get(label) : undefined

      if (!inner || inner.size === 0) {
        return null
      }

      const refs = [...inner.values()]

      if (refs.length === 1) {
        return refs[0]
      }

      const matches = sdk?.catalogProviderMatches
      const providerOf = ref => catalogData?.providers?.find(p => matches?.(p, ref.provider) ?? p.slug === ref.provider)
      const hints = providerNameHints(trigger)
      const hinted = refs.find(ref => hints.has(providerOf(ref)?.name))

      if (hinted) {
        return hinted
      }

      const pricingOf = ref => providerOf(ref)?.pricing?.[ref.model] ?? providerOf(ref)?.pricing?.[`${ref.model}-fast`]

      return refs.find(ref => pricingOf(ref)) ?? refs[0]
    }

    /** The node the submenu should show: the row's live price cloned when
     *  mounted, else rebuilt from provider.pricing — the path that serves
     *  usage-window plans (UsageLevelTag replaces the row price) and the
     *  "Show model pricing" setting being off. */
    const desiredPrice = trigger => {
      const live = findRowPrice(trigger)

      if (live) {
        return priceClone(live)
      }

      const ref = resolveRowRef(trigger)
      if (!ref) {
        return null
      }

      const matches = sdk?.catalogProviderMatches
      const provider = catalogData?.providers?.find(p => matches?.(p, ref.provider) ?? p.slug === ref.provider)
      const pricing = provider?.pricing?.[ref.model] ?? provider?.pricing?.[`${ref.model}-fast`]

      return pricing ? buildPrice(pricing, copyBundle()) : null
    }

    const syncContent = content => {
      const trigger = findRowTrigger(content)
      const block = content.querySelector(`:scope > [${BLOCK_ATTR}]`)

      if (!trigger) {
        block?.remove()
        return
      }

      const desired = desiredPrice(trigger)

      if (!desired) {
        block?.remove()
        return
      }

      const row = block?.querySelector(`[${ROW_ATTR}]`) ?? null
      const label = block?.querySelector(`[${LABEL_ATTR}]`) ?? null

      if (!block || !row || !label) {
        // Missing (or someone stripped a part out of) the block: rebuild whole.
        block?.remove()
        content.appendChild(buildBlock(content, desired, copy('priceLabel')))
        return
      }

      // The active locale can flip while a submenu stays open — the label is
      // the only localized node we own, so keep its text honest.
      const labelText = copy('priceLabel')
      if (label.textContent !== labelText) {
        label.textContent = labelText
      }

      // Pricing can still be warming in the row while the sub is open (and a
      // rebuilt node can go live-clone on a later sync): refresh the row only
      // when it actually differs — a blind replaceChildren would retrigger
      // the observer and loop.
      const current = row.firstElementChild

      if (!current || !current.isEqualNode(desired)) {
        row.replaceChildren(desired)
      }
    }

    /** The reasoning pill's level, mirrored onto the model pill as the same
     *  outlined chip the catalog rows use for an effort preset — one glance
     *  at the composer says which model runs and at which effort, and the
     *  hidden pill keeps React updating the source label. Pairs by sibling
     *  order so every composer surface (primary and tiles) gets its own. */
    const syncEffortChips = () => {
      const paired = new Set()

      for (const pill of document.querySelectorAll(REASONING_PILL_SELECTOR)) {
        const modelPill = pill.previousElementSibling
        const anchor = modelPill?.querySelector?.(':scope > span.truncate') ?? null
        let chip = modelPill?.querySelector?.(`[${CHIP_ATTR}]`) ?? null

        if (modelPill instanceof HTMLElement) {
          paired.add(modelPill)
        }

        // A pending effort renders a braille GlyphSpinner, not a level —
        // mirror nothing until a real label lands.
        const effort = anchor && !pill.querySelector('.glyph-spinner') ? pill.textContent.trim() : ''

        if (!effort) {
          chip?.remove()
          continue
        }

        if (!chip) {
          chip = document.createElement('span')
          chip.setAttribute(CHIP_ATTR, '')
          chip.setAttribute('data-slot', 'badge')
          chip.className = EFFORT_CHIP_CLASS
          anchor.after(chip)
        }

        if (chip.textContent !== effort) {
          chip.textContent = effort
        }
      }

      // Chips left behind by a vanished pair (compact pill, a model with no
      // reasoning control, a tile that unmounted its composer).
      for (const chip of document.querySelectorAll(`[${CHIP_ATTR}]`)) {
        if (!paired.has(chip.parentElement)) {
          chip.remove()
        }
      }
    }

    function sync() {
      if (disposed) {
        return
      }

      let wantsCatalog = false

      for (const content of document.querySelectorAll(SUB_CONTENT_SELECTOR)) {
        if (!(content instanceof HTMLElement)) {
          continue
        }

        // The catalog path only earns an RPC while a model submenu is open
        // whose row has no live price to clone — the only state where a
        // rebuilt node could be needed. Clone-path users never pay for it.
        const trigger = findRowTrigger(content)
        if (trigger && !findRowPrice(trigger)) {
          wantsCatalog = true
        }

        syncContent(content)
      }

      if (wantsCatalog) {
        ensureCatalog()
      }

      syncEffortChips()
    }

    const mutationObserver = new MutationObserver(() => scheduleSync())

    ctx.onDispose(() => {
      disposed = true
      cancelAnimationFrame(frame)
      mutationObserver.disconnect()
      for (const block of document.querySelectorAll(`[${BLOCK_ATTR}]`)) {
        block.remove()
      }
      for (const chip of document.querySelectorAll(`[${CHIP_ATTR}]`)) {
        chip.remove()
      }
      style.remove()
    })

    // The row-probe: a modelMenu.row data contribution whose decorate() sees
    // every painted row's {label, model, provider} and declines both slots —
    // the row renders exactly as core means it to; the plugin only keeps the
    // identity so a submenu can find its row's pricing record.
    const rowArea = sdk?.MODEL_MENU_ROW_AREA ?? ROW_AREA_FALLBACK
    ctx.register({
      id: 'row-probe',
      area: rowArea,
      data: {
        decorate: ({ label, model, provider }) => {
          if (label && model && provider) {
            let inner = rowRefs.get(label)
            if (!inner) {
              inner = new Map()
              rowRefs.set(label, inner)
            }
            inner.set(`${provider}${model}`, { model, provider })
          }
          return null
        }
      }
    })

    if (!sdk) {
      import('@hermes/plugin-sdk')
        .then(module => {
          if (!disposed) {
            sdk = module.default ?? module
            ensureCatalog()
            scheduleSync()
          }
        })
        .catch(() => {})
    }

    document.head.appendChild(style)
    // SubContent mounts per open (Radix Presence unmounts on close), price
    // text mutates while pricing warms, and aria-controls flips on open —
    // childList + characterData + that one attribute cover all three.
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-controls']
    })
    // A language switch repaints every core label; our injected one follows
    // through the same hook rather than waiting on a DOM mutation.
    ctx.i18n?.onLocaleChange(() => scheduleSync())
    sync()
  }
}
