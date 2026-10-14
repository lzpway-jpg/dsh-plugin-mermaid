/**
 * Transcript Mermaid renderer as one reversible DOM effect.
 *
 * The shell renders every code fence through its own `.md-code-block` card
 * and exposes no per-language render hook, so this effect observes the
 * document for such cards, detects Mermaid sources (an explicit `mermaid`
 * language label, or a diagram-type keyword at the first meaningful line —
 * always gated by Mermaid's own parser), then mounts a diagram container as
 * the card's sibling and collapses the card. Cards React re-renders while
 * streaming simply fail the parse gate until the fence completes; cards that
 * unmount are torn down with their containers. Unloading the effect restores
 * every card and removes every container, observer, and style tag.
 */
import mermaid from 'mermaid'
import { openDiagramLightbox, type CloseLightbox } from './lightbox'
import { MERMAID_CSS } from './styles'

/** Class both the shell's markdown pipeline and its code cards stamp on a fence root. */
const CODE_BLOCK_SELECTOR = '.md-code-block'
/** Attribute marking containers this effect owns, so its own mutations are ignored. */
const CONTAINER_ATTR = 'data-dsh-mermaid'
/** Injected stylesheet id, removed on unload. */
const STYLE_ID = 'dsh-plugin-mermaid-styles'
/** Sources beyond this never reach Mermaid (its own maxTextSize is aligned). */
const MAX_SOURCE_BYTES = 100_000
/** Trailing debounce for transcript scans; streaming chunks mutate the DOM per frame. */
const SCAN_DEBOUNCE_MS = 200

/**
 * Diagram-type keywords accepted at the first meaningful line of a fence.
 * Mermaid's parser remains the final gate: a look-alike source that fails to
 * parse keeps its plain code card.
 */
const DIAGRAM_HEAD = /^(?:flowchart\b|graph\b|sequenceDiagram\b|classDiagram\b|stateDiagram(?:-v2)?\b|erDiagram\b|gantt\b|journey\b|gitGraph\b|mindmap\b|timeline\b|quadrantChart\b|xychart-beta\b|block-beta\b|packet-beta\b|kanban\b|architecture(?:-beta)?\b|requirementDiagram\b|C4[A-Za-z]*\b|sankey-beta\b|radar-beta\b|treemap-beta\b|zenuml\b|pie(?:\s|$))/
/** Optional Mermaid frontmatter (`---\ntitle: …\n---`) skipped before the keyword test. */
const FRONTMATTER = /^\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/

/** One fenced code card swapped for (or awaiting) its diagram. */
interface Tracked {
  /** The shell's code card, hidden while its diagram is expanded. */
  readonly block: HTMLElement
  /** Diagram container inserted after the card; detached until the first successful render. */
  readonly container: HTMLElement
  /** Subtree receiving the rendered SVG. */
  readonly diagram: HTMLElement
  /** Toolbar toggle between diagram and source views. */
  readonly toggle: HTMLButtonElement
  /** Toolbar button opening the lightbox detail view. */
  readonly expand: HTMLButtonElement
  /** Source as last seen; changes schedule a re-render. */
  source: string
  /** Diagram view is expanded (card hidden) rather than collapsed to a thin bar. */
  expanded: boolean
  /** A successful render populated the diagram at least once. */
  hasSvg: boolean
  /** A render is in flight; a pending source change waits as `stale`. */
  rendering: boolean
  /** The source changed while a render was in flight. */
  stale: boolean
}

/** Labels the toggle, expand button, and lightbox need, matched to the document language. */
function labels(): {
  source: string
  diagram: string
  expand: string
  zoomIn: string
  zoomOut: string
  fit: string
  close: string
} {
  const lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase()
  return lang.startsWith('zh')
    ? { source: '源代码', diagram: '图表', expand: '详情', zoomIn: '放大', zoomOut: '缩小', fit: '适应窗口', close: '关闭' }
    : { source: 'Source', diagram: 'Diagram', expand: 'Details', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit to window', close: 'Close' }
}

/** The fence source exactly as the card displays it (the card's own copy action reads the same node). */
function extractSource(block: HTMLElement): string {
  const pre = block.querySelector('[data-code-block-content] pre') ?? block.querySelector('pre')
  return pre?.textContent ?? ''
}

/**
 * The language the card's banner reports. The toolbar arm substitutes a
 * localized fallback for grammars it cannot highlight, so only the simple
 * banner arm (or a future Mermaid grammar) ever reports a literal `mermaid`.
 */
function headerLanguage(block: HTMLElement): string | undefined {
  const banner = block.querySelector('[data-code-block-banner]')
  const infostring = banner?.querySelector('[class*="infostring"]')?.textContent?.trim()
  if (infostring) return infostring
  const language = banner?.querySelector('[class*="language"]')?.textContent?.trim()
  return language || undefined
}

/** Cheap pre-filter before the parse gate: a diagram keyword at the first meaningful line. */
function looksLikeMermaid(source: string): boolean {
  if (source.length === 0 || source.length > MAX_SOURCE_BYTES) return false
  const body = source.replace(FRONTMATTER, '').trimStart()
  return DIAGRAM_HEAD.test(body)
}

/** Whether the shell is currently in dark presentation (ui-theme's body marker). */
function darkActive(): boolean {
  return document.body.hasAttribute('data-ds-dark-theme')
}

let renderSeq = 0

/**
 * Start the effect: inject styles, observe the transcript and the theme
 * marker, scan once, and yield disposers that restore the document.
 */
export function* mermaidDomEffect(): Generator<() => void> {
  let mermaidTheme: 'default' | 'dark' | undefined
  const byBlock = new Map<HTMLElement, Tracked>()
  /** Sources that already failed the parse gate for one card, to avoid retry storms. */
  const failed = new WeakMap<HTMLElement, string>()
  /** The one lightbox allowed at a time; opening another replaces it. */
  let activeLightbox: CloseLightbox | null = null

  function openLightboxFor(tracked: Tracked): void {
    const svg = tracked.diagram.querySelector('svg')
    if (!(svg instanceof SVGSVGElement)) return
    activeLightbox?.()
    activeLightbox = openDiagramLightbox(svg, labels(), () => {
      activeLightbox = null
    })
  }

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = MERMAID_CSS
  document.head.appendChild(style)

  function ensureMermaid(): void {
    const theme = darkActive() ? 'dark' : 'default'
    if (mermaidTheme === theme) return
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      maxEdges: 2000,
      maxTextSize: MAX_SOURCE_BYTES,
    })
    mermaidTheme = theme
  }

  function applyView(tracked: Tracked): void {
    const { block, container, toggle } = tracked
    const showDiagram = tracked.expanded && tracked.hasSvg
    block.style.display = showDiagram ? 'none' : ''
    container.classList.toggle('is-collapsed', !showDiagram)
    toggle.textContent = showDiagram ? labels().source : labels().diagram
  }

  function createTracked(block: HTMLElement, source: string): Tracked {
    const container = document.createElement('div')
    container.className = 'dsh-mermaid is-collapsed'
    container.setAttribute(CONTAINER_ATTR, '')
    const toolbar = document.createElement('div')
    toolbar.className = 'dsh-mermaid-toolbar'
    const expand = document.createElement('button')
    expand.type = 'button'
    expand.className = 'dsh-mermaid-toggle dsh-mermaid-expand'
    expand.textContent = labels().expand
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'dsh-mermaid-toggle'
    toolbar.append(expand, toggle)
    const diagram = document.createElement('div')
    diagram.className = 'dsh-mermaid-diagram'
    container.append(toolbar, diagram)
    const tracked: Tracked = {
      block, container, diagram, toggle, expand, source,
      expanded: true, hasSvg: false, rendering: false, stale: false,
    }
    toggle.addEventListener('click', () => {
      tracked.expanded = !tracked.expanded
      if (tracked.expanded && !tracked.hasSvg) scheduleRender(tracked)
      applyView(tracked)
    })
    expand.addEventListener('click', () => openLightboxFor(tracked))
    diagram.addEventListener('click', () => openLightboxFor(tracked))
    applyView(tracked)
    return tracked
  }

  function teardown(tracked: Tracked): void {
    tracked.container.remove()
    tracked.block.style.display = ''
    byBlock.delete(tracked.block)
  }

  async function render(tracked: Tracked): Promise<void> {
    tracked.rendering = true
    ensureMermaid()
    const id = `dsh-mermaid-svg-${(renderSeq += 1)}`
    try {
      const { svg } = await mermaid.render(id, tracked.source)
      if (!tracked.block.isConnected || byBlock.get(tracked.block) !== tracked) {
        teardown(tracked)
        return
      }
      tracked.diagram.innerHTML = svg
      tracked.hasSvg = true
      if (tracked.container.parentElement === null) {
        tracked.block.insertAdjacentElement('afterend', tracked.container)
      }
      applyView(tracked)
      // Concurrent renders can leave Mermaid's `d${id}` measuring div behind.
      document.getElementById(`d${id}`)?.remove()
    } catch {
      // Mermaid may drop an error graphic with the render id; never leave it behind.
      document.getElementById(id)?.remove()
      document.getElementById(`d${id}`)?.remove()
      if (tracked.block.isConnected && byBlock.get(tracked.block) === tracked) {
        failed.set(tracked.block, tracked.source)
        teardown(tracked)
      }
    } finally {
      tracked.rendering = false
      if (tracked.stale) {
        tracked.stale = false
        if (byBlock.get(tracked.block) === tracked) void render(tracked)
      }
    }
  }

  function scheduleRender(tracked: Tracked): void {
    if (tracked.rendering) {
      tracked.stale = true
      return
    }
    void render(tracked)
  }

  function scan(): void {
    for (const tracked of Array.from(byBlock.values())) {
      if (!tracked.block.isConnected) {
        teardown(tracked)
        continue
      }
      // Transcript paging can re-anchor a card away from its container.
      if (tracked.hasSvg && tracked.block.nextElementSibling !== tracked.container) {
        tracked.block.insertAdjacentElement('afterend', tracked.container)
      }
    }
    for (const element of Array.from(document.querySelectorAll(CODE_BLOCK_SELECTOR))) {
      if (!(element instanceof HTMLElement)) continue
      const source = extractSource(element)
      const tracked = byBlock.get(element)
      if (tracked !== undefined) {
        if (source !== tracked.source) {
          tracked.source = source
          if (headerLanguage(element) === 'mermaid' || looksLikeMermaid(source)) scheduleRender(tracked)
          else teardown(tracked)
        }
        continue
      }
      if (failed.get(element) === source) continue
      if (headerLanguage(element) !== 'mermaid' && !looksLikeMermaid(source)) continue
      const created = createTracked(element, source)
      byBlock.set(element, created)
      scheduleRender(created)
    }
  }

  let scanTimer: ReturnType<typeof setTimeout> | undefined
  function scheduleScan(): void {
    if (scanTimer !== undefined) clearTimeout(scanTimer)
    scanTimer = setTimeout(() => {
      scanTimer = undefined
      scan()
    }, SCAN_DEBOUNCE_MS)
  }

  const domObserver = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target
      if (target instanceof Element && target.closest(`[${CONTAINER_ATTR}]`) !== null) continue
      scheduleScan()
      return
    }
  })
  domObserver.observe(document.body, { childList: true, subtree: true, characterData: true })

  const themeObserver = new MutationObserver(() => {
    mermaidTheme = undefined
    for (const tracked of byBlock.values()) {
      if (tracked.hasSvg) scheduleRender(tracked)
    }
  })
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  scan()

  yield () => {
    domObserver.disconnect()
    themeObserver.disconnect()
    if (scanTimer !== undefined) clearTimeout(scanTimer)
    activeLightbox?.()
  }
  yield () => {
    for (const tracked of Array.from(byBlock.values())) teardown(tracked)
  }
  yield () => {
    style.remove()
  }
}
