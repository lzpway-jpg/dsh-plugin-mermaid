# @lzpwap/dsh-plugin-mermaid

Render [Mermaid](https://mermaid.js.org/) diagrams inline in the DeepSeek Harness Web client — flowcharts, sequence diagrams, class/state/ER diagrams, Gantt, mindmaps, architecture, and every other Mermaid diagram type show up as live SVG right in the transcript, in place of their code fences.

## What it does

- Watches the transcript (and any other Markdown surface) for code fences whose language is `mermaid`, or whose content starts with a Mermaid diagram keyword — the final gate is always Mermaid's own parser, so plain code is never touched.
- Renders each detected fence as an SVG diagram in a card inserted beside the original code block; the code block collapses away and a hover toggle brings it back (**源代码 / Source** ↔ **图表 / Diagram**).
- Follows streaming replies: a growing fence renders as soon as it parses, and re-renders as it changes.
- Click a diagram (or the **详情 / Details** button) to open it in a fullscreen lightbox: zoom with the **+/−** buttons or the mouse wheel (anchored at the cursor), drag to pan once the diagram outgrows the window, click the percentage to re-fit, and close with **×**, **Esc**, or a backdrop click.
- Follows the GUI theme: diagrams re-render with Mermaid's `dark`/`default` theme when the skin switches between dark and light.
- Fences that fail to parse keep their ordinary code card; unloading or disabling the plugin restores every code block and removes all injected DOM, observers, and styles.

Zero configuration. No slots are occupied and no built-in renderer is replaced — the plugin is a single reversible DOM effect.

## Install

```sh
dsh plugin --profile web add @lzpwap/dsh-plugin-mermaid
```

Restart `dsh web`, refresh the GUI, and ask the assistant for a diagram — any ```` ```mermaid ```` fence in the reply renders inline.

Remove with `dsh plugin --profile web remove @lzpwap/dsh-plugin-mermaid`.

Requires dsh 0.1.7 or newer.

## Develop

```sh
npm install --legacy-peer-deps   # type packages track the @deepseek-ai next channel
npm run bundle                   # tsc (lib/types) → tsdown (lib/client.js, mermaid inlined + minified)
```

`lib/client.js` is a closure-factory bundle (`window.__ModuleLoader__.load`): the baseline modules (React, Cordis, ui-slots, ui-primitives) stay external and resolve through the shell's shared module table; everything else — mermaid and its layout engines included — is inlined, because `/plugins/<id>/client.js` is the only route a plugin gets. The bundle is ~3.5 MB minified for that reason.

### Offline verification

`dev/test-page.html` mounts the built bundle against a stub module loader with three fixture code blocks (explicit `mermaid` banner, content-detected fence, plain Python) and checks render, toggle, and unload-restore end to end:

```sh
npm run bundle
python3 -m http.server 18923 --bind 127.0.0.1
# open http://127.0.0.1:18923/dev/test-page.html — all checks should print PASS
```

### Install the local build

```sh
dsh plugin --profile web add /absolute/path/to/dsh-plugin-mermaid
```

The profile links the package (`link:`), so every `npm run bundle` is picked up on the next `dsh web` restart.

## How it works

The shell's Markdown pipeline renders every fence through its own `.md-code-block` card and exposes no per-language hook, and `mermaid` is not one of its Shiki grammars — so the plugin observes the document with a `MutationObserver`, extracts each card's source from its `pre`, and detects Mermaid either from an explicit `mermaid` banner label or a diagram-type keyword at the first meaningful line (frontmatter skipped). Detection is only a fast path: a source that Mermaid's parser rejects keeps its plain code card, and the rejection is cached until the source changes again. Diagram containers live as siblings of their code cards — React's own DOM is never reparented — and teardown on unload restores the document exactly.

## Publish

```sh
npm publish --access public   # prepublishOnly rebuilds the bundle
```

## License

MIT
