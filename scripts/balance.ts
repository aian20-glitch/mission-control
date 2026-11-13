// Balance check: prints resources and score for a set of designs.
// Run: npm run balance
import { evaluateDesign } from '../src/logic/scoring'
import { partsData, planetsData } from '../src/logic/data'
import type { Design, DestinationId, OrbitId } from '../src/logic/types'

interface Case {
  label: string
  destination: DestinationId
  orbit: OrbitId
  design: Design
  month?: number
}

const d = (launchVehicle: string, power: string, instruments: string[], comms: string, extras: string[] = []): Design => ({
  launchVehicle,
  power,
  instruments,
  comms,
  extras,
})

const cases: Case[] = [
  { label: 'default', destination: 'moon', orbit: 'orbiter', design: partsData.defaultDesign },
  { label: 'default', destination: 'mars', orbit: 'orbiter', design: partsData.defaultDesign },
  { label: 'default', destination: 'europa', orbit: 'flyby', design: partsData.defaultDesign },
  { label: 'GDD example', destination: 'mars', orbit: 'orbiter', design: d('lv_medium', 'solar_l', ['camera', 'spectrometer'], 'antenna_small') },
  { label: 'mars 3 instr', destination: 'mars', orbit: 'orbiter', design: d('lv_medium', 'solar_l', ['camera', 'spectrometer', 'radar'], 'antenna_hga') },
  { label: 'mars flyby cheap', destination: 'mars', orbit: 'flyby', design: d('lv_light', 'solar_s', ['camera', 'spectrometer'], 'antenna_small') },
  { label: 'mars lander rtg', destination: 'mars', orbit: 'lander', design: d('lv_medium', 'rtg', ['spectrometer', 'seismometer'], 'antenna_hga', ['heat_shield']) },
  { label: 'mars lander no shield', destination: 'mars', orbit: 'lander', design: d('lv_medium', 'solar_l', ['spectrometer'], 'antenna_hga') },
  { label: 'mars bad window', destination: 'mars', orbit: 'orbiter', design: d('lv_light', 'solar_s', ['camera'], 'antenna_small'), month: 10 },
  { label: 'moon lander solar', destination: 'moon', orbit: 'lander', design: d('lv_medium', 'solar_s', ['radar', 'spectrometer'], 'antenna_small') },
  { label: 'moon lander rtg', destination: 'moon', orbit: 'lander', design: d('lv_medium', 'rtg', ['radar', 'spectrometer'], 'antenna_small') },
  { label: 'europa solar', destination: 'europa', orbit: 'flyby', design: d('lv_heavy', 'solar_l', ['radar', 'magnetometer'], 'antenna_hga') },
  { label: 'europa camera too', destination: 'europa', orbit: 'flyby', design: d('lv_heavy', 'rtg', ['radar', 'magnetometer', 'camera'], 'antenna_hga') },
  { label: 'europa orbiter', destination: 'europa', orbit: 'orbiter', design: d('lv_heavy', 'rtg', ['radar', 'magnetometer'], 'antenna_hga', ['redundancy']) },
]

for (const dest of planetsData.destinations) {
  for (const alt of dest.alternatives) {
    cases.push({ label: 'ALT ' + alt.label, destination: dest.id, orbit: alt.orbit, design: alt.design })
  }
}

for (const c of cases) {
  const { report, result } = evaluateDesign(c.destination, c.orbit, c.design, c.month ?? null, false)
  const bars = report.bars.map((b) => b.label[0] + ':' + b.display + (b.status === 'ok' ? '' : '!' + b.status)).join(' | ')
  console.log(
    `${c.destination.padEnd(6)} ${c.orbit.padEnd(7)} ${c.label.padEnd(22)} launch=${report.canLaunch ? 'Y' : 'N'} ` +
      `S${result.science} E${result.efficiency} D${result.decisions} T${result.total} ${'★'.repeat(result.stars)}${result.lost ? ' LOST' : ''}`,
  )
  console.log('    ' + bars)
  for (const issue of report.issues) {
    console.log('    - ' + issue.severity + (issue.critical ? '!' : '') + ' ' + issue.text)
  }
}
