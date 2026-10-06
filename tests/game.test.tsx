import { expect, mock, test } from 'claude-code/testing'

const pane = (columns: number, rows: number) =>
  ({ component: 'Pane', requestId: 'sniper', props: { title: 'Снайпер', bodyColumns: columns, scroll: { bodyRows: rows } } as never }) as const

const PANE = pane(100, 30)

test('игра стартует по клику, этап и цели в HUD', async ($, on) => {
  mock.store(on, { best: 0 })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'sniper', surface, ...PANE })
    await ui.resize({ columns: 100, rows: 30, in: 'game' })
    expect(await ui.find({ type: 'Text', text: /SNIPER 2026/, in: 'game' })).toBeDefined()

    await ui.pointer({ type: 'down', x: 50, y: 5, button: 'left', in: 'game' })
    expect(await ui.find({ type: 'Text', text: /этап 1\/2/, in: 'game' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /цели 0\/3/, in: 'game' })).toBeDefined()
    await ui.unmount()
  }
})

test('зум включается клавишей Z и E, кликом по кнопке и слетает после выстрела', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })

  await ui.key({ key: 'z', in: 'game' })
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /ZOOM 2×/, in: 'game' })).toBeDefined()

  // выстрел сбрасывает оптику
  await ui.key({ key: ' ', in: 'game' })
  await ui.advance(100)
  expect(await ui.find({ type: 'Text', text: /ЗУМ  \[Z\/E\]/, in: 'game' })).toBeDefined()

  await ui.advance(900)
  await ui.key({ key: 'e', in: 'game' })
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /ZOOM 2×/, in: 'game' })).toBeDefined()
  await ui.key({ key: 'e', in: 'game' })

  // кнопка в правом углу HUD
  await ui.pointer({ type: 'down', x: 95, y: 0, button: 'left', in: 'game' })
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /ZOOM 2×/, in: 'game' })).toBeDefined()
  await ui.unmount()
})

test('пустой магазин — провал, R перезапускает', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })
  // стреляем в угол у ног снайпера: патронов 3 цели + 3 запасных
  await ui.pointer({ type: 'move', x: 2, y: 28, in: 'game' })
  for (let i = 0; i < 6; i++) {
    await ui.key({ key: ' ', in: 'game' })
    await ui.advance(800)
  }
  await ui.advance(400)
  expect(await ui.find({ type: 'Text', text: /МИССИЯ ПРОВАЛЕНА/, in: 'game' })).toBeDefined()

  // пробел сразу после проигрыша не перезапускает, R — да
  await ui.key({ key: ' ', in: 'game' })
  expect(await ui.find({ type: 'Text', text: /МИССИЯ ПРОВАЛЕНА/, in: 'game' })).toBeDefined()
  await ui.key({ key: 'r', in: 'game' })
  expect(await ui.find({ type: 'Text', text: /цели 0\/3/, in: 'game' })).toBeDefined()
  await ui.unmount()
})

test('«Очень сложно»: одна жизнь и патронов ровно по целям', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /4\. Очень сложно/, in: 'game' })).toBeDefined()
  await ui.key({ key: '4', in: 'game' })
  const texts = (await ui.findAll({ type: 'Text', in: 'game' })).map(t => t.text ?? '')
  const hud = texts.find(t => t.includes('Очень сложно')) ?? ''
  expect(hud).toContain('▮▮▮ ')
  expect(hud).not.toContain('▮▮▮▮')
  expect(hud).not.toContain('♥♥')
  await ui.unmount()
})

test('выстрел, перезарядка и музыка звучат', async ($, on) => {
  mock.store(on, { best: 0 })
  const played: string[] = []
  on('audio.play', async ($, e) => {
    const clip = e.clip as { asset?: string }
    played.push(clip.asset ?? '?')
    return undefined as never
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

test('широкая панель держится в лимитах дерева во время боя', async ($, on) => {
  mock.store(on, { best: 0 })
  for (const [columns, rows] of [
    [160, 32],
    [230, 40],
  ] as const) {
    const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...pane(columns, rows) })
    await ui.resize({ columns, rows, in: 'game' })
    await ui.key({ key: '1', in: 'game' })
    for (let i = 0; i < 80; i++) await ui.advance(50)
    expect(await ui.find({ type: 'Text', text: /этап 1\//, in: 'game' })).toBeDefined()
    await ui.unmount()
  }
})

test('код Konami даёт радужные трассеры и +10 патронов', async ($, on) => {
  mock.store(on, { best: 0 })
  const ui = await $.ui.mount({ plugin: 'sniper', surface: 'terminal', ...PANE })
  await ui.resize({ columns: 100, rows: 30, in: 'game' })
  await ui.key({ key: '2', in: 'game' })
  for (const key of ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']) await ui.key({ key, in: 'game' })
  expect(await ui.find({ type: 'Text', text: /радужные трассеры/, in: 'game' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▮×16/, in: 'game' })).toBeDefined()
  await ui.unmount()
})
