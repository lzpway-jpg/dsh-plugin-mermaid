import { defineConfig } from 'tsdown'

/**
 * The shell's shared module-table specifiers (packages/client/web platform
 * baseline + the preloaded runtime row). These stay external and resolve
 * through the require the loader injects; everything else — mermaid included —
 * must inline, because /plugins/<id>/client.js is the only route a plugin
 * gets.
 */
const MODULE_TABLE_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
])

const id = '@lzpwap/dsh-plugin-mermaid'

export default defineConfig({
  name: `${id}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  // Mermaid outweighs the whole shell baseline unminified; keep the one
  // artifact small enough to serve on every GUI boot.
  minify: true,
  deps: {
    neverBundle: (specifier: string) => MODULE_TABLE_EXTERNALS.has(specifier),
    alwaysBundle: (specifier: string) => !MODULE_TABLE_EXTERNALS.has(specifier),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    // Mermaid lazy-loads layout engines and KaTeX behind dynamic import();
    // fold everything back into the single file the plugin route serves.
    inlineDynamicImports: true,
    // Closure-factory contract: the module table registers this factory under
    // the package id and materializes it with the shared require.
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
