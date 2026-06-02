import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = join(__dirname, '../public/og-image.png')

const svg = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f1117"/>
  <text x="600" y="290" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" fill="#ffffff" text-anchor="middle">Scooter Unlock</text>
  <text x="600" y="370" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="500" fill="#00d4ff" text-anchor="middle">Tuning Keys für Ninebot</text>
</svg>
`

await sharp(Buffer.from(svg)).png().toFile(outputPath)
console.log(`Created ${outputPath}`)
