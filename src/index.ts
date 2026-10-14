/**
 * Node half of dsh-plugin-mermaid. The empty apply gives the Loader a
 * host-side row; the browser half ships through exports["./client"] and does
 * all the work — watching the transcript DOM and rendering Mermaid fences.
 * The plugin is zero-config, so no Config schema is served.
 */

export const name = 'dsh-plugin-mermaid'

/** Host plugin body — this package contributes browser presentation only. */
export function apply(): void {}
