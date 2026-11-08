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
 */

const PLUGIN_ID = 'model-price-submenu'
const SUB_CONTENT_SELECTOR = '[data-slot="dropdown-menu-sub-content"]'
const SUB_TRIGGER_SELECTOR = '[data-slot="dropdown-menu-sub-trigger"]'
// ModelFamilyRow marks its trigger `group/model` — the gate that keeps this
// plugin away from every other submenu in the app.
const MODEL_ROW_CLASS = 'group/model'
const BLOCK_ATTR = 'data-model-price-submenu'
const ROW_ATTR = 'data-model-price-submenu-row'
const LABEL_ATTR = 'data-model-price-submenu-label'
const PRICE_SELECTOR = 'span[class~="pl-2"][class~="text-[0.625rem]"]'

// The section labels ("OPTIONS", "EFFORT") are stored title-case and painted
// uppercase by the menu's own label class — the bundles follow that and ship
// the word in the locale's casing.
const LABEL_BUNDLES = {
  en: { priceLabel: 'Price' },
  de: { priceLabel: 'Preis' },
  es: { priceLabel: 'Precio' },
  fr: { priceLabel: 'Prix' },
  ja: { priceLabel: '価格' },
  ru: { priceLabel: 'Цена' },
  zh: { priceLabel: '价格' },
  'zh-hant': { priceLabel: '價格' },
  ar: { priceLabel: 'السعر' }
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

/** A "PRICE" label typed exactly like the submenu's own section labels:
 *  clone one's classes when the panel has labels (the "no options" panel has
 *  none — fall back to the same tokens `dropdownMenuSectionLabel` carries). */
function buildLabel(content, text) {
  const template = content.querySelector('[data-slot="dropdown-menu-label"]')
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
  row.appendChild(priceClone(price))

  block.append(separator, buildLabel(content, labelText), row)

  return block
}

function syncContent(content, labelText) {
  const trigger = findRowTrigger(content)
  const price = trigger ? findRowPrice(trigger) : null
  const block = content.querySelector(`:scope > [${BLOCK_ATTR}]`)

  if (!price) {
    block?.remove()
    return
  }

  const row = block?.querySelector(`[${ROW_ATTR}]`) ?? null
  const label = block?.querySelector(`[${LABEL_ATTR}]`) ?? null

  if (!block || !row || !label) {
    // Missing (or someone stripped a part out of) the block: rebuild whole.
    block?.remove()
    content.appendChild(buildBlock(content, price, labelText))
    return
  }

  // The active locale can flip while a submenu stays open — the label is the
  // only localized node we own, so keep its text honest.
  if (label.textContent !== labelText) {
    label.textContent = labelText
  }

  // Pricing can still be warming in the row while the sub is open: refresh
  // the clone only when it actually differs — a blind replaceChildren would
  // retrigger the observer and loop.
  const clone = priceClone(price)
  const current = row.firstElementChild

  if (!current || !current.isEqualNode(clone)) {
    row.replaceChildren(clone)
  }
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

    // Plugin-scoped bundles resolve against the app's active locale (English
    // fallback built in). Older shells without ctx.i18n degrade to English.
    ctx.i18n?.register(LABEL_BUNDLES)
    const labelText = () => ctx.i18n?.t('priceLabel') ?? LABEL_BUNDLES.en.priceLabel

    const sync = () => {
      if (disposed) {
        return
      }

      const text = labelText()

      for (const content of document.querySelectorAll(SUB_CONTENT_SELECTOR)) {
        if (content instanceof HTMLElement) {
          syncContent(content, text)
        }
      }
    }

    const scheduleSync = () => {
      if (disposed) {
        return
      }

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(sync)
    }

    const mutationObserver = new MutationObserver(() => scheduleSync())

    ctx.onDispose(() => {
      disposed = true
      cancelAnimationFrame(frame)
      mutationObserver.disconnect()
      for (const block of document.querySelectorAll(`[${BLOCK_ATTR}]`)) {
        block.remove()
      }
      style.remove()
    })

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
