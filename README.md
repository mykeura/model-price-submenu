# Model Price Submenu

**A cleaner model picker for Hermes Desktop.** Prices on providers like Nous Research crowd every row — the model name ends up squeezed between the rate, the variant tag and the effort chip. This plugin takes the price off the row and puts it where it actually helps: inside the panel that opens when you hover a model, below the reasoning level. And since that panel already edits the reasoning effort, the composer's separate reasoning pill folds into a small level chip right on the model pill.

- **Readable rows.** Each model shows just its name, variant and setting chips — no `$in/$out` figures fighting for space.
- **Price one hover away.** Hover any priced model and its panel shows a **PRICE** section under a divider identical to the one above the effort levels, with the same format Hermes uses on the row — input/output per Mtok, cached-read rate, discount tag or "free".
- **Always there.** It works even when Hermes' own "Show model pricing" setting is off, and on usage-window plans where the row shows your plan level instead of a price.
- **Speaks your language.** The PRICE heading and the price's own text follow Hermes' interface language automatically.
- **One less pill in the composer.** The separate reasoning-level pill next to the model name is hidden — the model pill carries the selected level as a small chip, the same style the model list uses, so the bar where you type stays clear.
- **Nothing to configure.** Enable it and it works; disable it and every row goes back to showing its price.

## Requirements

- Hermes Desktop, with a provider that lists prices (Nous Research today).
- The plugin is opt-in like every unified package: it installs disabled and turns on with one toggle.

## Install

Copy the `model-price-submenu` folder so that `plugin.yaml` ends up at:

```
~/.hermes/plugins/model-price-submenu/plugin.yaml
```

Then, in Hermes Desktop:

1. Run **⌘K → Reload desktop plugins** (or restart the app).
2. Open the **Plugins** panel and enable **Model Price Submenu**.

That's it. Open the model picker and hover a priced model — its row reads clean, and the price now lives in the side panel below **EFFORT**.

If you update the plugin later, reload desktop plugins again so the new copy is picked up.

## Disabling

Toggle **Model Price Submenu** off in the Plugins panel — the prices move back to the rows instantly, no restart needed. To remove it completely, delete the folder:

```
~/.hermes/plugins/model-price-submenu/
```

## A small way to support the project

If you are considering the Nous Portal **Plus** plan, you can use [my Nous Portal referral link](https://portal.nousresearch.com/r/mykeura). Your first month costs **$5 instead of $20**, and I receive a $10 referral credit that helps cover the API usage behind my ongoing work on Model Price Submenu and related Hermes plugins. It is entirely optional, but it is a simple way for both of us to benefit.

The offer is for new customers starting a new Plus subscription. It applies to the first invoice, and each payment card can be used for only one referral. If the card has already backed another referral, the discount is reversed and no referral reward is paid.

If you would rather support my work directly, you can also [sponsor me on GitHub](https://github.com/sponsors/mykeura). Every bit helps me keep building and maintaining these open-source plugins. Thank you!

## License

This project is licensed under the [MIT License](LICENSE).
