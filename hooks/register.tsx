import type { Register } from 'claude-code'

const PANE = 'sniper'

const SFX: Record<string, number> = {
  shot: 0.9,
  reload: 0.8,
  hit: 0.9,
  headshot: 1,
  miss: 0.5,
  empty: 0.6,
  hurt: 0.9,
  zoom: 0.4,
  boom: 0.8,
  win: 0.7,
  lose: 0.7,
  glass: 0.7,
  splat: 0.8,
  explode: 1,
  stage: 0.7,
  move: 0.6,
  thunder: 0.8,
  alarm: 0.45,
  ricochet: 0.6,
  pickup: 0.7,
  focus: 0.7,
  meow: 0.7,
}

// the music plays while this controller is alive
let music: AbortController | undefined
const stopMusic = () => {
  music?.abort()
  music = undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sniper',
      description: 'Sniper: clear the street while Claude thinks',
    })

    return next(e)
  })

  on('command.run', { command: 'sniper' }, async $ => {
    const ru = (await $.store.get('lang')) === 'ru'
    await $.ui.open({ id: PANE, title: ru ? 'Снайпер' : 'Sniper', focus: true, closeOnEscape: true, rows: 32 })

    return { text: ru ? 'Снайпер на позиции. Кликни по панели, чтобы она получила клавиатуру.' : 'Sniper in position. Click the panel to give it the keyboard.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)
      return <Text>Sniper runs only in the terminal or the desktop app.</Text>
    }
    const { Client } = $.ui.resolve({ ...e, surface: e.surface })
    const best = Number((await $.store.get('best')) ?? 0)
    const save = (await $.store.get('save')) ?? null
    const lang = (await $.store.get('lang')) ?? 'en'
    // the region takes the pane body size, otherwise it shrinks to what is drawn
    const columns = Math.max(1, e.props?.bodyColumns ?? e.viewport?.columns ?? 80)
    const rows = Math.max(1, e.props?.scroll?.bodyRows ?? 30)

    return <Client key="game" module="./game.tsx" props={{ best, save, lang }} width={columns} height={rows} />
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopMusic()
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    stopMusic()
    return next(e)
  })

  on('ui.message', async ($, e) => {
    const data = e.data as { best?: unknown; sfx?: unknown; music?: unknown; save?: unknown; lang?: unknown } | null
    if (data?.lang === 'en' || data?.lang === 'ru') await $.store.set('lang', data.lang)
    // progress: the checkpoint at the start of a stage
    if (data?.save !== undefined) await $.store.set('save', data.save as never)

    for (const name of Array.isArray(data?.sfx) ? data.sfx : []) {
      const gain = typeof name === 'string' ? SFX[name] : undefined
      if (gain !== undefined) void $.audio.play({ asset: `sounds/${name}.wav` }, { gain }).catch(() => {})
    }
    if (data?.music === true && !music) {
      const ctl = new AbortController()
      music = ctl
      void $.audio
        .play({ asset: 'sounds/music.wav' }, { shouldLoop: true, gain: 0.35, signal: ctl.signal })
        .catch(() => {})
    } else if (data?.music === false) stopMusic()

    if (data?.best === undefined) return {}
    const score = Number(data.best)
    const best = Number((await $.store.get('best')) ?? 0)
    if (score > best) {
      await $.store.set('best', score)
      $.ui.toast((await $.store.get('lang')) === 'ru' ? `Снайпер: новый рекорд — ${score}` : `Sniper: new best — ${score}`)
    }

    return { props: { best: Math.max(score, best), save: (await $.store.get('save')) ?? null, lang: (await $.store.get('lang')) ?? 'en' } }
  })
}
