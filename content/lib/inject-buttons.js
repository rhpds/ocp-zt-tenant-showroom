'use strict'

// Antora extension: inject buttons.js into every page after HTML composition.
// Uses pagesComposed (Antora 3.x) — fires after each page is rendered to full HTML.

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/rhpds/ocp-zt-tenant-showroom@main/content/supplemental-ui'
const INJECT = [
  `<link rel="stylesheet" href="${CDN_BASE}/css/site-extra.css">`,
  `<script src="${CDN_BASE}/js/buttons.js"></script>`,
].join('\n')

module.exports.register = function () {
  this.on('pagesComposed', ({ contentCatalog }) => {
    const pages = contentCatalog.getPages().filter((p) => p.contents && p.out)
    console.log(`[inject-buttons] pagesComposed — processing ${pages.length} pages`)
    pages.forEach((page) => {
      const html = page.contents.toString()
      if (html.includes('buttons.js')) return
      const updated = html.replace('</body>', INJECT + '\n</body>')
      if (updated !== html) page.contents = Buffer.from(updated)
    })
  })
}
