#!/usr/bin/env node
/**
 * Pèse ce que le navigateur télécharge réellement pour chaque page prérendue.
 *
 * `next build` affiche un « First Load JS » qui agrège déjà beaucoup de choses ;
 * ce script part de l'autre bout — les fichiers `/_next/static/...` effectivement
 * référencés dans le HTML généré — et additionne leur taille sur disque. C'est la
 * mesure qui permet de comparer un avant/après sans se fier à un résumé.
 *
 *   node scripts/measure-bundle.js
 *
 * Tailles non compressées : la compression est faite par Vercel et varie, alors
 * que l'octet sur disque est stable et directement comparable d'un build à l'autre.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const APP_DIR = path.join(ROOT, '.next', 'server', 'app')
const STATIC_DIR = path.join(ROOT, '.next', 'static')

if (!fs.existsSync(APP_DIR)) {
  console.error('Aucun build trouvé. Lancez `npm run build` d\'abord.')
  process.exit(1)
}

/** Tous les .html prérendus, récursivement. */
function htmlFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) htmlFiles(full, acc)
    else if (entry.name.endsWith('.html')) acc.push(full)
  }
  return acc
}

const sizeCache = new Map()
function assetSize(rel) {
  if (sizeCache.has(rel)) return sizeCache.get(rel)
  const full = path.join(STATIC_DIR, rel)
  const size = fs.existsSync(full) ? fs.statSync(full).size : 0
  sizeCache.set(rel, size)
  return size
}

const rows = []
const seenEverywhere = new Map() // asset -> nombre de pages qui le référencent

for (const file of htmlFiles(APP_DIR)) {
  const html = fs.readFileSync(file, 'utf8')
  // Chemins /_next/static/... présents dans les balises script/link du HTML.
  const assets = new Set()
  for (const m of html.matchAll(/\/_next\/static\/([^"'\\\s)]+)/g)) assets.add(m[1])

  let js = 0, css = 0, font = 0
  for (const a of assets) {
    const s = assetSize(a)
    if (a.endsWith('.js')) js += s
    else if (a.endsWith('.css')) css += s
    else if (/\.(woff2?|ttf|otf)$/.test(a)) font += s
    seenEverywhere.set(a, (seenEverywhere.get(a) ?? 0) + 1)
  }

  const route = '/' + path.relative(APP_DIR, file).replace(/\\/g, '/').replace(/\.html$/, '')
  rows.push({ route: route === '/index' ? '/' : route, js, css, font, total: js + css + font })
}

rows.sort((a, b) => b.total - a.total)

const kb = n => (n / 1024).toFixed(1).padStart(8) + ' Ko'
console.log('\nPoids par page prérendue (non compressé)\n')
console.log('  ' + 'route'.padEnd(28) + kb(0).replace(/[\d.]+ Ko/, '      JS') + kb(0).replace(/[\d.]+ Ko/, '     CSS') + kb(0).replace(/[\d.]+ Ko/, '  polices') + kb(0).replace(/[\d.]+ Ko/, '   total'))
console.log('  ' + '-'.repeat(28 + 44))
for (const r of rows) {
  console.log('  ' + r.route.padEnd(28) + kb(r.js) + kb(r.css) + kb(r.font) + kb(r.total))
}

const shared = [...seenEverywhere.entries()].filter(([, n]) => n === rows.length).map(([a]) => a)
const sharedBytes = shared.reduce((s, a) => s + assetSize(a), 0)
console.log('\n  Ressources communes à ' + rows.length + ' pages : ' + shared.length + ' fichiers, ' + kb(sharedBytes).trim())

console.log('\n  Plus gros fichiers référencés :')
const biggest = [...seenEverywhere.keys()].map(a => ({ a, s: assetSize(a), n: seenEverywhere.get(a) }))
  .sort((x, y) => y.s - x.s).slice(0, 12)
for (const b of biggest) {
  console.log('    ' + kb(b.s) + '  ×' + String(b.n).padStart(2) + ' pages  ' + b.a)
}
console.log()
