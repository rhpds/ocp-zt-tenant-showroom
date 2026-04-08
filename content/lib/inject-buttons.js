'use strict'

// Antora extension: inject buttons.js and site-extra.css into every page
// Hooks into pagesComposed — fires after full HTML is assembled per page
// so we can do a simple string replacement on the final HTML output.

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/rhpds/ocp-zt-tenant-showroom@main/content/supplemental-ui'
const INJECT = [
  `<link rel="stylesheet" href="${CDN_BASE}/css/site-extra.css">`,
  `<script src="${CDN_BASE}/js/buttons.js"></script>`,
].join('\n')

module.exports = function () {
  this.on('pagesComposed', ({ contentCatalog }) => {
    contentCatalog.getPages()
      .filter((page) => page.contents && page.out)
      .forEach((page) => {
        const html = page.contents.toString()
        if (html.includes('buttons.js')) return // already injected
        const updated = html.replace('</body>', INJECT + '\n</body>')
        if (updated !== html) page.contents = Buffer.from(updated)
      })
  })
}
