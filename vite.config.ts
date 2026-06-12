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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
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
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (
            id.includes('node_modules/antd/') ||
            id.includes('node_modules/@ant-design/') ||
            id.includes('node_modules/rc-') ||
            id.includes('node_modules/@rc-component/')
          ) {
            return 'vendor-antd'
          }
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/remark-') ||
            id.includes('node_modules/mdast-') ||
            id.includes('node_modules/unified') ||
            id.includes('node_modules/hast-') ||
            id.includes('node_modules/micromark') ||
            id.includes('node_modules/react-syntax-highlighter') ||
            id.includes('node_modules/refractor') ||
            id.includes('node_modules/lowlight') ||
            id.includes('node_modules/hast-util-') ||
            id.includes('node_modules/html2canvas')
          ) {
            return 'vendor-markdown'
          }
          if (
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/docx') ||
            id.includes('node_modules/pptxgenjs') ||
            id.includes('node_modules/mammoth') ||
            id.includes('node_modules/html-docx-js') ||
            id.includes('node_modules/jspdf')
          ) {
            return 'vendor-export'
          }
          if (
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/qrcode') ||
            id.includes('node_modules/ddg')
          ) {
            return 'vendor-misc'
          }
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'vendor-pdf'
          }
          return 'vendor'
        },
      },
    },
  },
  esbuild: {
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment'
  }
})