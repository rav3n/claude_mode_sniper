import { expect, mock, test } from 'claude-code/testing'

const pane = (columns: number, rows: number) =>
  ({ component: 'Pane', requestId: 'sniper', props: { title: 'Sniper', bodyColumns: columns, scroll: { bodyRows: rows } } as never }) as const

const PANE = pane(100, 30)

test('the game starts on click, HUD shows stage and targets', async ($, on) => {
  mock.store(on, { best: 0 })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'sniper', surface, ...PANE })
    await ui.resize({ columns: 100, rows: 30, in: 'game' })
    expect(await ui.find({ type: 'Text', text: /SNIPER 2026/, in: 'game' })).toBeDefined()

    await ui.pointer({ type: 'down', x: 50, y: 5, button: 'left', in: 'game' })
    expect(await ui.find({ type: 'Text', text: /stage 1\/2/, in: 'game' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /targets 0\/3/, in: 'game' })).toBeDefined()
    await ui.unmount()
  }
})

test('zoom toggles with Z, E and the HUD button and drops after a shot', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })

  await ui.key({ key: 'z', in: 'game' })
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /ZOOM 2×/, in: 'game' })).toBeDefined()

  // a shot drops the scope
  await ui.key({ key: ' ', in: 'game' })
  await ui.advance(100)
  expect(await ui.find({ type: 'Text', text: /ZOOM \[Z\/E\]/, in: 'game' })).toBeDefined()

  await ui.advance(900)
  await ui.key({ key: 'e', in: 'game' })
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /ZOOM 2×/, in: 'game' })).toBeDefined()
  await ui.key({ key: 'e', in: 'game' })

  // the button in the HUD corner
  await ui.pointer({ type: 'down', x: 95, y: 0, button: 'left', in: 'game' })
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /ZOOM 2×/, in: 'game' })).toBeDefined()
  await ui.unmount()
})

test('an empty magazine fails the mission, R restarts', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })
  // shoot at the corner by the sniper: 3 targets + 3 spare rounds
  await ui.pointer({ type: 'move', x: 2, y: 28, in: 'game' })
  for (let i = 0; i < 6; i++) {
    await ui.key({ key: ' ', in: 'game' })
    await ui.advance(800)
  }
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /MISSION FAILED/, in: 'game' })).toBeDefined()

  // space right after a loss does not restart, R does
  await ui.key({ key: ' ', in: 'game' })
  expect(await ui.find({ type: 'Text', text: /MISSION FAILED/, in: 'game' })).toBeDefined()
  await ui.key({ key: 'r', in: 'game' })
  expect(await ui.find({ type: 'Text', text: /targets 0\/3/, in: 'game' })).toBeDefined()
  await ui.unmount()
})

test('Very hard: one life and exactly one round per target', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /4\. Very hard/, in: 'game' })).toBeDefined()
  await ui.key({ key: '4', in: 'game' })
  const texts = (await ui.findAll({ type: 'Text', in: 'game' })).map(t => t.text ?? '')
  const hud = texts.find(t => t.includes('Very hard')) ?? ''
  expect(hud).toContain('▮▮▮ ')
  expect(hud).not.toContain('▮▮▮▮')
  expect(hud).not.toContain('♥♥')
  await ui.unmount()
})

test('shot, reload and music play', async ($, on) => {
  mock.store(on, { best: 0 })
  const played: string[] = []
  on('audio.play', async ($, e) => {
    const clip = e.clip as { asset?: string }
    played.push(clip.asset ?? '?')
    return undefined as never
  })
  // on Windows the sounds go to the PowerShell player through its queue
  mock.env(on, { TEMP: 'C:\\Temp' })
  on('process.spawn', async function* () {
    return { code: 0, signal: null }
  })
  on('fs.write', async ($, e) => {
    const m = /sounds\\(\w+)\.wav$/.exec(e.text.trim())
    if (m) played.push(`sounds/${m[1]}.wav`)
    return null as never
  })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })
  await ui.advance(50)
  await ui.key({ key: ' ', in: 'game' })
  for (let i = 0; i < 12; i++) await ui.advance(50)
  expect(played).toContain('sounds/music.wav')
  expect(played).toContain('sounds/shot.wav')
  expect(played).toContain('sounds/reload.wav')
  await ui.unmount()
})

test('a wide panel stays within the tree limits in combat', async ($, on) => {
  mock.store(on, { best: 0 })
  for (const [columns, rows] of [
    [160, 32],
    [230, 40],
  ] as const) {
    const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...pane(columns, rows) })
    await ui.resize({ columns, rows, in: 'game' })
    await ui.key({ key: '1', in: 'game' })
    for (let i = 0; i < 80; i++) await ui.advance(50)
    expect(await ui.find({ type: 'Text', text: /stage 1\//, in: 'game' })).toBeDefined()
    await ui.unmount()
  }
})

test('the Konami code gives rainbow tracers and +10 ammo', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })
  for (const key of ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']) await ui.key({ key, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /rainbow tracers/, in: 'game' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▮×16/, in: 'game' })).toBeDefined()
  await ui.unmount()
})

test('save: after reopening the panel the menu offers to continue', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /C — continue/, in: 'game' })).toBeUndefined()
  await ui.key({ key: '2', in: 'game' })
  await ui.advance(100)
  await ui.unmount()

  const again = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await again.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await again.find({ type: 'Text', text: /C — continue: level 1, stage 1, score 0/, in: 'game' })).toBeDefined()
  await again.unmount()
})

test('save: C returns to the saved stage', async ($, on) => {
  mock.store(on, { best: 0, save: { level: 3, stage: 1, score: 1234, shots: 5, hits: 4, diff: 1, hp: 2 } })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /C — continue: level 3, stage 2, score 1234/, in: 'game' })).toBeDefined()
  await ui.key({ key: 'c', in: 'game' })
  expect(await ui.find({ type: 'Text', text: /lv\.3 stage 2\/3/, in: 'game' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /♥♥♡/, in: 'game' })).toBeDefined()
  await ui.unmount()
})

test('L switches the language and it is remembered', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /L — language: English/, in: 'game' })).toBeDefined()
  await ui.key({ key: 'l', in: 'game' })
  expect(await ui.find({ type: 'Text', text: /L — язык: русский/, in: 'game' })).toBeDefined()
  await ui.advance(100)
  await ui.unmount()

  const again = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await again.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await again.find({ type: 'Text', text: /Пробел или клик — начать/, in: 'game' })).toBeDefined()
  await again.unmount()
})
