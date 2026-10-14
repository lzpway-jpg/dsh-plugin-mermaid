/**
 * Browser half of dsh-plugin-mermaid. No slots are occupied: the renderer is
 * a pure DOM effect that watches the transcript for Mermaid code fences and
 * swaps each one for its diagram, so every built-in renderer stays in place.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { mermaidDomEffect } from './mermaid-effect'

/** No cordis services are consumed; the effect only needs the base context. */
export const inject: string[] = []

/**
 * Register the Mermaid transcript effect.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => mermaidDomEffect(), 'dsh-plugin-mermaid: transcript renderer')
}
