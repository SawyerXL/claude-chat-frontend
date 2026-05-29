import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import chatApiPlugin from './vite-chat-plugin'
import sessionApiPlugin from './vite-session-plugin'
import type { Plugin } from 'vite'

const indexHtmlPlugin: Plugin = {
  name: 'index-html-plugin',
  generateBundle(_options, bundle) {
    const entryChunk = Object.entries(bundle).find(
      ([, chunk]) => chunk.type === 'chunk' && chunk.isEntry
    )
    if (!entryChunk) return

    const entryName = entryChunk[0]
    const cssChunk = Object.entries(bundle).find(
      ([, chunk]) => chunk.type === 'asset' && chunk.fileName.endsWith('.css')
    )
    const cssFileName = cssChunk ? cssChunk[1].fileName : ''
    const cssLink = cssFileName
      ? `\n    <link rel="stylesheet" href="/${cssFileName}">`
      : ''

    this.emitFile({
      type: 'asset',
      fileName: 'index.html',
      source: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claude</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/favicon.svg" />
    <meta name="description" content="Chat with Claude - Your AI assistant" />
${cssLink}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${entryName}"></script>
  </body>
</html>`
    })
  }
}

export default defineConfig({
  plugins: [react(), chatApiPlugin(), sessionApiPlugin(), indexHtmlPlugin],
  build: {
    outDir: 'dist',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: './src/main.tsx',
      output: {
        manualChunks: undefined
      }
    }
  },
  esbuild: {
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment'
  }
})