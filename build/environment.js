// Check the emitted module graph, not just whether demo buttons are hidden in the UI.
const demoModule = /\/(?:data\/(?:api\.demo|mockApi|mockAuth|mockDb|seed|catalog|articles)\.js|app\/DevPanel\.jsx)$/
const demoMarkers = ['ruangkpr:demo', 'ruangkpr:prototype:v1', 'ruangkpr123', 'Demo KPR Primary', 'MODE DEMO', 'Isi data contoh', 'Unggah semua (demo)', '3174012345678901', 'firdi.audi@email.com']

export function productionBoundary() {
  return {
    name: 'production-boundary',
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue
        const leaked = Object.entries(item.modules)
          .filter(([id, info]) => info.renderedLength > 0 && demoModule.test(id.replaceAll('\\', '/')))
          .map(([id]) => id)
        if (leaked.length) this.error(`Modul demo masuk ke production: ${leaked.join(', ')}`)
        const marker = demoMarkers.find((value) => item.code.includes(value))
        if (marker) this.error(`Konten demo masuk ke production: ${marker}`)
      }
    },
  }
}
