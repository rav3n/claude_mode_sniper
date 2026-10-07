import type { ClientKeyEvent, ClientModule, ClientPointerEvent, ClientSurface } from 'claude-code'

// Sniper: a neon street of several stages. Enemies pop out of windows, doors,
// from behind cars and barricades, drones fly overhead. Clear a position and the
// camera moves on down the street. Character graphics: one cell, one object.

// Checkpoint: the start of a stage. Kept in the plugin store between runs.
type Save = { level: number; stage: number; score: number; shots: number; hits: number; diff: number; hp: number; ap?: number }
type Lang = 'en' | 'ru'
type Props = { best?: number; save?: Save | null; lang?: Lang; askStar?: boolean }

type SpawnKind = 'window' | 'door' | 'car' | 'barrier' | 'roof'
type Spawn = { kind: SpawnKind; x: number; y: number; rows: number; busy: boolean; used: boolean }

type EnemySt = 'rise' | 'aim' | 'sink' | 'hidden' | 'run' | 'fly' | 'dead'
type Pose = 'hang' | 'lie' | 'fall' | 'wreck'

type Enemy = {
  id: number
  kind: SpawnKind | 'drone' | 'runner'
  spawn: number // index into spawns, -1 for a drone
  x: number // world column
  y: number // head row
  rows: number
  st: EnemySt
  t: number // ms in the current state
  aimMs: number // when it fires
  vx: number
  tx: number // where it runs to
  dead: number // ms since death; 1e9 — left alive
  pose: Pose
  vy: number
  pool: number
  helmet: boolean // helmet: the first head hit knocks it off
  civ: boolean // civilian: does not shoot, must not be hit
  sniper: boolean // rooftop sniper: aims faster, gives itself away with a glint
}

// stick — a blood drop: lives until it reaches the sidewalk
type Part = { x: number; y: number; vx: number; vy: number; life: number; ch: string; fg: string; stick: boolean }
type Drip = { x: number; y: number; len: number; max: number; t: number }
type Fx = { x: number; y: number; text: string; fg: string; ms: number; max: number; rise: boolean }
type Car = { x: number; color: string; alarm: number }
type Barrel = { x: number; alive: boolean; fuse: number }
type Decal = { ch: string; fg: string; bg?: string }

type Layer = { ch: string[]; fg: string[]; bg: string[] }

// Level theme: sky, share of lit windows, weather
type Theme = { sky: [string, string]; lit: number; rain: boolean; snow: boolean; dim: number }
const THEMES: Theme[] = [
  { sky: ['#070a1f', '#3a1850'], lit: 0.45, rain: false, snow: false, dim: 0 },
  { sky: ['#1a1040', '#a8456a'], lit: 0.35, rain: false, snow: false, dim: 0 },
  { sky: ['#06081a', '#24104a'], lit: 0.55, rain: false, snow: false, dim: 0 },
  { sky: ['#2a1438', '#ff8a3d'], lit: 0.25, rain: false, snow: false, dim: 0 },
  { sky: ['#0a1018', '#2a3440'], lit: 0.4, rain: true, snow: false, dim: 0.15 },
  { sky: ['#020308', '#0c0f1a'], lit: 0.1, rain: false, snow: false, dim: 0.45 },
  { sky: ['#0a1430', '#4a5a80'], lit: 0.4, rain: false, snow: true, dim: 0 },
]

// ---------- texts ----------

type Texts = {
  diffs: { name: string; hint: string }[]
  news: Record<number, string> // what a level unlocks (from it onwards)
  levelNew: (level: number, news: string) => string
  levelStage: (level: number, stage: number, stages: number) => string
  streetClear: (hp: number) => string
  moving: string
  shot: string
  noAmmo: string
  stageClear: (stage: number, stages: number, bonus: number) => string
  reloading: string
  empty: string
  hostage: string
  clang: string
  onTheMove: string
  plusLife: string
  plusAmmo: string
  plusAp: (n: number) => string
  apStreak: string
  pierced: string
  ufo: string
  moonSniper: string
  moon: (n: number) => string
  claude: string
  stopLoss: string
  meow: string
  catSleeps: string
  konami: string
  intro: string[]
  difficulty: string
  start: string
  resume: (s: Save) => string
  newGame: string
  lang: string
  levelDone: (level: number) => string
  scoreAcc: (score: number, acc: number) => string
  nextHint: string
  failed: string
  failedStats: (level: number, stage: number, stages: number, score: number, best: number) => string
  failedHint: (saved: boolean) => string
  paused: string
  pauseHint: string
  confirmTitle: string
  confirmLoss: (s: Save) => string
  confirmHint: string
  starTitle: string
  starText: string[]
  starHint: string
  hudLevel: (level: number, stage: number, stages: number) => string
  hudTargets: (k: number, n: number) => string
  hudAmmo: string
  hudAp: (n: number, on: boolean) => string
  hudFocus: string
  hudFocusReady: string
  hudFocusOn: string
  hudHeat: string
  hudWind: string
  hudScore: (n: number) => string
  hudBest: (n: number) => string
  hudReloading: string
  hudSoundOff: string
  hudMusicOff: string
  zoomBtn: string
  help: string
  tooSmall: (w: number, h: number) => string
}

const TEXTS: Record<Lang, Texts> = {
  en: {
    diffs: [
      { name: 'Easy', hint: '5 lives, plenty of ammo, slow enemies' },
      { name: 'Normal', hint: '3 lives, some spare ammo, shots drift without the scope' },
      { name: 'Hard', hint: '2 lives, 1 spare round per stage, the scope sways' },
      { name: 'Very hard', hint: '1 life, exactly one round per target: a miss means failure. Use the scope' },
    ],
    news: {
      2: 'helmets — aim for the body · F — focus',
      3: 'hostages in windows · T — thermal',
      4: 'rooftop snipers · supply drones',
      5: 'wind pushes the bullet',
      6: 'blackout — switch on thermal',
      7: 'snow and every enemy at once',
    },
    levelNew: (l, n) => `LEVEL ${l} · NEW: ${n}`,
    levelStage: (l, s, n) => `LEVEL ${l} · STAGE ${s}/${n}`,
    streetClear: hp => `Street clear. Life bonus: ${hp} × 100`,
    moving: 'MOVING ON →',
    shot: 'You got shot',
    noAmmo: 'Out of ammo',
    stageClear: (s, n, b) => `STAGE ${s}/${n} CLEAR · ammo +${b}`,
    reloading: 'reloading',
    empty: 'empty',
    hostage: 'HOSTAGE! −300',
    clang: 'CLANG!',
    onTheMove: ' ON THE MOVE',
    plusLife: '+1 LIFE',
    plusAmmo: '+3 AMMO',
    plusAp: n => `+${n} AP ${n > 1 ? 'ROUNDS' : 'ROUND'} [A]`,
    apStreak: '3 HEADSHOTS IN A ROW · +1 AP ROUND [A]',
    pierced: ' PIERCED',
    ufo: 'UFO DOWN! · X-FILES +2500',
    moonSniper: 'MOON SNIPER · +1000',
    moon: n => `moon ${n}/3`,
    claude: 'CLAUDE: “Hey, I’m trying to think here!” · +42',
    stopLoss: 'STOP-LOSS TRIGGERED · +500',
    meow: 'MEOW!',
    catSleeps: 'the cat went to sleep',
    konami: '↑↑↓↓←→←→BA · rainbow tracers · +10 ammo',
    intro: [
      'The street has several stages. Clear a position —',
      'the sniper moves on to the next one.',
      'A blinking "!" — the enemy is about to fire. Barrels explode.',
      'Every level adds something: helmets, hostages, snipers, wind…',
      'Shots drift without the scope. The scope drops after each shot.',
    ],
    difficulty: 'Difficulty (1–4, arrows, click a line):',
    start: 'Space or click — start',
    resume: s => `Click or C — continue: level ${s.level}, stage ${s.stage + 1}, score ${s.score}`,
    newGame: 'N or 1–4 — new game',
    lang: 'L — language: English',
    levelDone: l => `LEVEL ${l} COMPLETE`,
    scoreAcc: (sc, a) => `Score ${sc} · accuracy ${a}%`,
    nextHint: 'Click or N — next level · M — menu',
    failed: 'MISSION FAILED',
    failedStats: (l, s, n, sc, b) => `Level ${l} · stage ${s}/${n} · score ${sc} · best ${b}`,
    failedHint: saved => (saved ? 'Click or C — retry the stage · M — menu' : 'Click or M — menu'),
    paused: 'PAUSED',
    pauseHint: 'P — resume',
    confirmTitle: 'START OVER?',
    confirmLoss: s => `The save is lost: level ${s.level}, stage ${s.stage + 1}, score ${s.score}`,
    confirmHint: 'Y — yes, start over · N — no',
    starTitle: 'IS EVERYTHING WORKING?',
    starText: ['If you like the game, star it on GitHub:', 'that helps other people find it.'],
    starHint: 'Y — yes, star the repo ⭐ · N — not now',
    hudLevel: (l, s, n) => `│ lv.${l} stage ${s}/${n} `,
    hudTargets: (k, n) => `│ targets ${k}/${n} `,
    hudAmmo: '│ ammo ',
    hudAp: (n, on) => ` AP×${n}${on ? ' ON' : ' [A]'}`,
    hudFocus: 'focus',
    hudFocusReady: 'focus [F]',
    hudFocusOn: 'FOCUS!',
    hudHeat: 'heat [T]',
    hudWind: 'wind',
    hudScore: n => ` │ score ${n} `,
    hudBest: n => `│ best ${n} `,
    hudReloading: '│ reloading ',
    hudSoundOff: '│ sound off ',
    hudMusicOff: '│ ♪ off ',
    zoomBtn: '◎ ZOOM   [Z]',
    help: ' mouse/arrows — aim · click/space — fire · Z/RMB — zoom · A — AP rounds · F — focus · T — thermal · P — pause · L — language · B — background music · S — sound · Esc — quit',
    tooSmall: (w, h) => `Needs at least 50×16 cells, now ${w}×${h}. Make the panel bigger.`,
  },
  ru: {
    diffs: [
      { name: 'Легко', hint: '5 жизней, много патронов, враги медленные' },
      { name: 'Нормально', hint: '3 жизни, запас патронов, без зума пуля гуляет' },
      { name: 'Сложно', hint: '2 жизни, 1 запасной патрон на этап, прицел качается' },
      { name: 'Очень сложно', hint: '1 жизнь, патронов ровно по целям: промах = провал. Без зума не попасть' },
    ],
    news: {
      2: 'каски — бей в тело · F — фокус',
      3: 'заложники в окнах · T — тепловизор',
      4: 'снайперы на крышах · дроны снабжения',
      5: 'ветер сносит пулю',
      6: 'блэкаут — включай тепловизор',
      7: 'снег и все враги разом',
    },
    levelNew: (l, n) => `УРОВЕНЬ ${l} · НОВОЕ: ${n}`,
    levelStage: (l, s, n) => `УРОВЕНЬ ${l} · ЭТАП ${s}/${n}`,
    streetClear: hp => `Улица чиста. Бонус за жизни: ${hp} × 100`,
    moving: 'ПЕРЕБЕЖКА →',
    shot: 'Тебя подстрелили',
    noAmmo: 'Кончились патроны',
    stageClear: (s, n, b) => `ЭТАП ${s}/${n} ЗАЧИЩЕН · патроны +${b}`,
    reloading: 'перезарядка',
    empty: 'пусто',
    hostage: 'ЗАЛОЖНИК! −300',
    clang: 'ДЗЫНЬ!',
    onTheMove: ' НА ХОДУ',
    plusLife: '+1 ЖИЗНЬ',
    plusAmmo: '+3 ПАТРОНА',
    plusAp: n => `+${n} ${n > 1 ? 'БРОНЕБОЙНЫХ' : 'БРОНЕБОЙНЫЙ'} [A]`,
    apStreak: '3 ХЕДШОТА ПОДРЯД · +1 БРОНЕБОЙНЫЙ [A]',
    pierced: ' ПРОБИЛ',
    ufo: 'НЛО СБИТО! · X-FILES +2500',
    moonSniper: 'ЛУННЫЙ СНАЙПЕР · +1000',
    moon: n => `луна ${n}/3`,
    claude: 'CLAUDE: «Эй, я тут вообще-то думаю!» · +42',
    stopLoss: 'СТОП-ЛОСС СРАБОТАЛ · +500',
    meow: 'МЯУ!',
    catSleeps: 'кот ушёл спать',
    konami: '↑↑↓↓←→←→BA · радужные трассеры · +10 патронов',
    intro: [
      'Улица из нескольких этапов. Зачистил позицию —',
      'снайпер сам переходит к следующей.',
      'Мигающий «!» — враг сейчас выстрелит. Бочки взрываются.',
      'С каждым уровнем новое: каски, заложники, снайперы, ветер…',
      'Без зума пуля гуляет. После выстрела оптика слетает.',
    ],
    difficulty: 'Сложность (1–4, стрелки, клик по строке):',
    start: 'Пробел или клик — начать',
    resume: s => `Клик или C — продолжить: ур. ${s.level}, этап ${s.stage + 1}, счёт ${s.score}`,
    newGame: 'N или 1–4 — новая игра',
    lang: 'L — язык: русский',
    levelDone: l => `УРОВЕНЬ ${l} ПРОЙДЕН`,
    scoreAcc: (sc, a) => `Счёт ${sc} · точность ${a}%`,
    nextHint: 'Клик или N — следующий уровень · M — меню',
    failed: 'МИССИЯ ПРОВАЛЕНА',
    failedStats: (l, s, n, sc, b) => `Уровень ${l} · этап ${s}/${n} · счёт ${sc} · рекорд ${b}`,
    failedHint: saved => (saved ? 'Клик или C — с начала этапа · M — меню' : 'Клик или M — меню'),
    paused: 'ПАУЗА',
    pauseHint: 'P — продолжить',
    confirmTitle: 'НАЧАТЬ ЗАНОВО?',
    confirmLoss: s => `Сохранение пропадёт: уровень ${s.level}, этап ${s.stage + 1}, счёт ${s.score}`,
    confirmHint: 'Y — да, заново · N — нет',
    starTitle: 'ВСЁ РАБОТАЕТ?',
    starText: ['Если игра понравилась, поставь звезду на GitHub —', 'так её найдут другие.'],
    starHint: 'Y — да, поставить звезду ⭐ · N — не сейчас',
    hudLevel: (l, s, n) => `│ ур.${l} этап ${s}/${n} `,
    hudTargets: (k, n) => `│ цели ${k}/${n} `,
    hudAmmo: '│ патроны ',
    hudAp: (n, on) => ` ББ×${n}${on ? ' ВКЛ' : ' [A]'}`,
    hudFocus: 'фокус',
    hudFocusReady: 'фокус [F]',
    hudFocusOn: 'ФОКУС!',
    hudHeat: 'тепло [T]',
    hudWind: 'ветер',
    hudScore: n => ` │ счёт ${n} `,
    hudBest: n => `│ рекорд ${n} `,
    hudReloading: '│ перезарядка ',
    hudSoundOff: '│ звук выкл ',
    hudMusicOff: '│ ♪ выкл ',
    zoomBtn: '◎ ЗУМ    [Z]',
    help: ' мышь/стрелки — прицел · клик/пробел — огонь · Z/ПКМ — зум · A — бронебойные · F — фокус · T — тепловизор · P — пауза · L — язык · B — музыка · S — звук · Esc — выйти',
    tooSmall: (w, h) => `Нужно хотя бы 50×16 клеток, сейчас ${w}×${h}. Растяни панель.`,
  },
}

type Sign = { x: number; y: number; len: number; hit: boolean }
type Flyer = { x: number; y: number; vx: number } // UFO and supply drone, screen coordinates

type Phase = 'intro' | 'play' | 'clear' | 'move' | 'won' | 'lost'

type Diff = {
  color: string
  hp: number
  up: number // multiplier of the enemy's time to fire
  spare: (level: number) => number // spare rounds per stage on top of the targets
  alive: number // extra enemies alive at once
  drones: [number, number] // from which level and how likely
  miss: number // chance an unscoped shot drifts
  settle: number // ms for the scope to settle
  sway: number // scope sway amplitude, cells
  mul: number // score multiplier
}

const DIFFS: Diff[] = [
  { color: '#7dff6b', hp: 5, up: 1.4, spare: l => Math.max(3, 6 - l), alive: -1, drones: [3, 0.12], miss: 0.35, settle: 150, sway: 0, mul: 0.5 },
  { color: '#2ef2ff', hp: 3, up: 1, spare: l => Math.max(2, 4 - l), alive: 0, drones: [2, 0.18], miss: 0.6, settle: 250, sway: 0, mul: 1 },
  { color: '#ffb02e', hp: 2, up: 0.75, spare: () => 1, alive: 1, drones: [1, 0.24], miss: 0.8, settle: 350, sway: 0.7, mul: 1.5 },
  { color: '#ff3d3d', hp: 1, up: 0.55, spare: () => 0, alive: 2, drones: [1, 0.3], miss: 1, settle: 450, sway: 1.3, mul: 2.5 },
]

type Game = {
  W: number
  H: number
  WW: number // street width in cells: one screen per stage
  offX: number // the field is centred on a wide panel
  phase: Phase
  paused: boolean
  reason: string
  level: number
  stage: number
  stages: number
  toKill: number
  killed: number
  maxAlive: number
  upMs: number
  gapMs: number
  ammo: number
  hp: number
  score: number
  best: number
  shots: number
  hits: number
  combo: number
  ax: number
  ay: number
  zoom: boolean
  zoomT: number
  cooldown: number
  flash: number
  hurt: number
  kick: number
  shake: number
  slow: number
  nextSpawn: number
  outOfAmmoT: number
  seed: number
  time: number
  endT: number
  phaseT: number
  camX: number
  moveFrom: number
  near: Layer // buildings, sidewalk, road; '' — transparent (sky)
  far: Layer // far skyline, scrolls slower
  windows: Set<number>
  broken: Set<number>
  spawns: Spawn[]
  enemies: Enemy[]
  parts: Part[]
  drips: Drip[]
  decals: Map<number, Decal>
  fx: Fx[]
  cars: Car[]
  barrels: Barrel[]
  carRow: number
  tracer: { x: number; y: number; ms: number; ap: boolean } | null
  stars: [number, number, string][]
  nextId: number
  diff: number
  menuY: number
  banner: string
  bannerColor: string
  bannerMs: number
  sfx: string[] // sounds until the next frame
  reloadAt: number // when to cycle the bolt, -1 — no need
  sound: boolean
  music: boolean
  sent: string // the last music state sent to the hooks
  bestPending: number
  lang: Lang
  langPending: boolean // the language changed, tell the hooks
  saved: Save | null
  savePending: Save | null | undefined // what to send to the hooks; undefined — nothing
  armed: boolean // a real game is on, not the menu backdrop — saving is allowed
  confirm: boolean // asking before a new game wipes the save
  askStar: boolean // the first launch: is it working, star the repository?
  starPending: boolean | undefined // the answer to send to the hooks; undefined — nothing
  ap: number // armor-piercing rounds: go through helmets, kept between stages
  apOn: boolean // the next shots use them
  heads: number // headshot kills in a row, every third gives an AP round
  theme: Theme
  wind: number // wind drift of the bullet, cells
  focus: number // focus charge 0..1
  focusT: number // how long focus still lasts
  thermal: boolean
  battery: number // thermal battery, ms
  streak: number
  streakT: number
  civT: number // when the next civilian looks out
  supply: Flyer | null
  supplyT: number
  ufo: Flyer | null
  ufoT: number
  moonHits: number
  moonDone: boolean
  claude: Sign | null // the CLAUDE neon sign
  chart: Sign | null // the window with a chart
  cat: { x: number; y: number; jumps: number } | null
  keys: string[] // recent keys, for the Konami code
  rainbow: boolean
}

type State = { g: Game; frame: number }

// ---------- utils ----------

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const rnd = (g: Game) => {
  g.seed = (g.seed * 1664525 + 1013904223) >>> 0
  return g.seed / 4294967296
}
const ri = (g: Game, lo: number, hi: number) => lo + Math.floor(rnd(g) * (hi - lo + 1))
const pick = <T,>(g: Game, list: readonly T[]): T => list[Math.floor(rnd(g) * list.length)]!

const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
const rgb = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
const mix = (a: string, b: string, k: number) => {
  const x = rgb(a)
  const y = rgb(b)
  return '#' + x.map((v, i) => hex(v + (y[i]! - v) * k)).join('')
}
const darkCache = new Map<string, string>()
const darken = (c: string) => {
  let d = darkCache.get(c)
  if (!d) {
    d = mix(c, '#000000', 0.72)
    darkCache.set(c, d)
  }
  return d
}

const layer = (W: number, H: number, fill = ' '): Layer => ({
  ch: new Array(W * H).fill(fill),
  fg: new Array(W * H).fill('#ffffff'),
  bg: new Array(W * H).fill('#000000'),
})

const put = (l: Layer, W: number, H: number, x: number, y: number, ch: string, fg?: string, bg?: string) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = y * W + x
  l.ch[i] = ch
  if (fg) l.fg[i] = fg
  if (bg) l.bg[i] = bg
}

const diffOf = (g: Game) => DIFFS[g.diff] ?? DIFFS[1]!
const tx = (g: Game) => TEXTS[g.lang]

const BLOOD = '#c0101c'
const GORE = '#6e0810'

// ---------- street generation ----------

const FACADES = ['#3b2a35', '#2c3444', '#30283f', '#25333a', '#3a3030', '#2a2f3d']
const NEON = ['#ff3df2', '#2ef2ff', '#ffe14d', '#7dff6b', '#ff7a3d']
const SIGNS = ['RAMEN', '24/7', 'NEURO', 'VR', 'BAR', 'HOTEL', 'AI', 'TACO', 'CYBER', 'DOCS', 'CLUB', 'PAWN']
const CAR_COLORS = ['#c0392b', '#2980b9', '#e5e5e5', '#f1c40f', '#16a085', '#8e44ad']

// sidewalk row
const sidewalk = (g: Game) => g.H - 4

const buildStreet = (g: Game) => {
  const { W, H } = g
  const WW = W * g.stages
  g.WW = WW
  const S = sidewalk(g)
  const L = layer(WW, H, '')
  const FW = Math.ceil(WW * 0.4) + W
  const F = layer(FW, H, '')
  g.windows = new Set()
  g.broken = new Set()
  g.spawns = []
  g.cars = []
  g.barrels = []
  g.decals = new Map()
  g.parts = []
  g.drips = []
  g.carRow = H - 2

  // stars stay put, like the sky
  g.stars = []
  for (let i = 0; i < W / 3; i++) g.stars.push([ri(g, 0, W - 1), ri(g, 0, Math.floor(S / 2)), pick(g, ['#8890b0', '#c8d0ff', '#6a7090'])])

  // far skyline with a few lights
  for (let x = 0; x < FW; ) {
    const w = ri(g, 3, 8)
    const top = ri(g, Math.floor(S * 0.2), Math.floor(S * 0.6))
    for (let xx = x; xx < Math.min(FW, x + w); xx++)
      for (let y = top; y < S; y++) put(F, FW, H, xx, y, rnd(g) < 0.06 ? '·' : ' ', '#c9a24a', '#141a2e')
    x += w
  }

  // near buildings
  const th = g.theme
  const doors: [number, number][] = []
  g.claude = null
  g.chart = null
  g.cat = null
  const claudeAt = ri(g, 0, g.stages * 4) // which building carries the easter-egg sign
  let nBld = 0
  let x = ri(g, 0, 2)
  while (x < WW - 8) {
    const bw = Math.min(ri(g, 11, 17), WW - x - 1)
    if (bw < 9) break
    const top = ri(g, 3, Math.max(4, Math.floor(S * 0.45)))
    const face = mix(pick(g, FACADES), '#000000', th.dim)
    const trim = mix(face, '#ffffff', 0.25)
    for (let y = top; y < S; y++) for (let xx = x; xx < x + bw; xx++) put(L, WW, H, xx, y, ' ', trim, face)
    for (let xx = x; xx < x + bw; xx++) put(L, WW, H, xx, top, '▀', th.snow ? '#e8eef8' : trim, face)

    if (nBld === claudeAt || rnd(g) < 0.75) {
      const claude = nBld === claudeAt
      const text = claude ? 'CLAUDE' : pick(g, SIGNS)
      const neon = claude ? '#d97757' : pick(g, NEON)
      const sx = x + Math.floor((bw - text.length) / 2)
      for (let i = 0; i < text.length; i++) put(L, WW, H, sx + i, top + 1, text[i]!, neon, '#120a18')
      if (claude) g.claude = { x: sx, y: top + 1, len: text.length, hit: false }
    }
    nBld++
    if (rnd(g) < 0.5) put(L, WW, H, x + ri(g, 1, bw - 2), top - 1, '╽', '#777e8c')
    if (top >= 3) g.spawns.push({ kind: 'roof', x: x + ri(g, 2, bw - 3), y: top - 2, rows: 2, busy: false, used: false })

    for (let wy = top + 2; wy + 1 <= S - 5; wy += 3)
      for (let wx = x + 2; wx + 2 <= x + bw - 3; wx += 4) {
        const r = rnd(g)
        const glass = r < th.lit ? '#e8b85a' : r < th.lit + 0.15 ? '#4a7bd1' : r < th.lit + 0.22 ? '#d04fa8' : '#141b28'
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 3; dx++) {
            put(L, WW, H, wx + dx, wy + dy, ' ', '#000000', glass)
            g.windows.add((wy + dy) * WW + wx + dx)
          }
        g.spawns.push({ kind: 'window', x: wx + 1, y: wy, rows: 2, busy: false, used: false })
      }

    const dx0 = x + Math.floor(bw / 2) - 1
    for (let dy = S - 3; dy < S; dy++) for (let dx = 0; dx < 3; dx++) put(L, WW, H, dx0 + dx, dy, ' ', '#000000', '#1a0f0a')
    for (let dx = -1; dx < 4; dx++) put(L, WW, H, dx0 + dx, S - 4, '▁', pick(g, NEON), face)
    g.spawns.push({ kind: 'door', x: dx0 + 1, y: S - 3, rows: 3, busy: false, used: false })
    doors.push([dx0 - 2, dx0 + 5])

    x += bw + ri(g, 1, 3)
  }

  // sidewalk and road
  for (let xx = 0; xx < WW; xx++) {
    put(L, WW, H, xx, S, '▔', '#9aa0aa', '#4a4f5a')
    put(L, WW, H, xx, S + 1, xx % 8 < 4 ? '─' : ' ', '#c9a227', '#202329')
    put(L, WW, H, xx, S + 2, ' ', '#000000', '#202329')
    put(L, WW, H, xx, S + 3, ' ', '#000000', '#202329')
  }

  const covered = (bx: number, w: number) => doors.some(([a, b]) => bx + w >= a && bx <= b)

  // barricades
  const nb = Math.max(2, Math.floor(WW / 26))
  for (let i = 0, tries = 0; i < nb && tries < 200; tries++) {
    const bx = ri(g, 1, WW - 7)
    if (covered(bx, 5)) continue
    if (g.spawns.some(s => s.kind === 'barrier' && Math.abs(s.x - bx - 2) < 8)) continue
    const kind = rnd(g) < 0.5
    const col = kind ? '#8a8f99' : '#2f6b3a'
    for (let dx = 0; dx < 5; dx++) {
      put(L, WW, H, bx + dx, S - 1, kind ? '▄' : '▆', col)
      put(L, WW, H, bx + dx, S, kind && dx % 2 ? '▒' : '█', kind ? (dx % 2 ? '#e67e22' : col) : col, '#4a4f5a')
    }
    g.spawns.push({ kind: 'barrier', x: bx + 2, y: S - 3, rows: 2, busy: false, used: false })
    i++
  }

  // cars are drawn over enemies, so they are kept apart
  const nc = Math.max(2, Math.floor(WW / 28))
  for (let i = 0, tries = 0; i < nc && tries < 200; tries++) {
    const cx = ri(g, 1, WW - 10)
    if (g.cars.some(c => Math.abs(c.x - cx) < 12)) continue
    g.cars.push({ x: cx, color: pick(g, CAR_COLORS), alarm: 0 })
    g.spawns.push({ kind: 'car', x: cx + 4, y: S, rows: 2, busy: false, used: false })
    i++
  }

  // red barrels by the sidewalk: they explode
  const nbar = Math.max(2, Math.floor(WW / 34))
  for (let i = 0, tries = 0; i < nbar && tries < 200; tries++) {
    const bx = ri(g, 2, WW - 4)
    if (covered(bx, 2) || g.barrels.some(b => Math.abs(b.x - bx) < 10)) continue
    if (g.spawns.some(s => s.kind === 'barrier' && Math.abs(s.x - bx) < 5)) continue
    g.barrels.push({ x: bx, alive: true, fuse: -1 })
    i++
  }

  // easter eggs: a window with a chart and a cat on a roof
  const wins = g.spawns.filter(sp => sp.kind === 'window')
  const cw = wins.length ? pick(g, wins) : undefined
  if (cw) {
    cw.used = true
    g.chart = { x: cw.x - 1, y: cw.y, len: 3, hit: false }
  }
  const roofs = g.spawns.filter(sp => sp.kind === 'roof')
  const cr = roofs.length && rnd(g) < 0.7 ? pick(g, roofs) : undefined
  if (cr) g.cat = { x: cr.x + 2, y: cr.y + 1, jumps: 0 }

  g.near = L
  g.far = F
}

const drawCar = (l: Layer, g: Game, c: Car, x0: number) => {
  const { W, H } = g
  const y = g.carRow
  const road = '#202329'
  const blink = c.alarm > 0 && Math.floor(c.alarm / 150) % 2 === 0
  const glass = '#5d8fb0'
  const top = [' ', '▄', '█', 'g', 'g', 'g', '█', '▄', ' ']
  top.forEach((ch, i) => {
    if (ch === ' ') return
    if (ch === 'g') put(l, W, H, x0 + i, y, ' ', glass, glass)
    else put(l, W, H, x0 + i, y, ch, c.color, road)
  })
  for (let i = 0; i < 9; i++) {
    const wheel = i === 1 || i === 7
    put(l, W, H, x0 + i, y + 1, wheel ? '●' : '█', wheel ? '#111111' : c.color, wheel ? c.color : road)
  }
  put(l, W, H, x0 + 8, y + 1, '▌', blink ? '#ff3030' : '#ffe680', c.color)
  put(l, W, H, x0, y + 1, '▐', blink ? '#ff3030' : '#ff6060', c.color)
}

// ---------- levels and stages ----------

const newGame = (W: number, H: number, best: number, seed: number): Game => {
  const g = {
    W,
    H,
    phase: 'intro',
    paused: false,
    reason: '',
    level: 1,
    stage: 0,
    stages: 2,
    score: 0,
    best,
    shots: 0,
    hits: 0,
    seed,
    ax: Math.floor(W / 2),
    ay: Math.floor(H / 2),
    time: 0,
    endT: 0,
    phaseT: 0,
    camX: 0,
    moveFrom: 0,
    offX: 0,
    enemies: [],
    fx: [],
    tracer: null,
    nextId: 1,
    diff: 1,
    menuY: -1,
    banner: '',
    bannerColor: '#ffffff',
    bannerMs: 0,
    shake: 0,
    slow: 0,
    sfx: [],
    reloadAt: -1,
    sound: true,
    music: true,
    sent: '',
    bestPending: -1,
    lang: 'en',
    langPending: false,
    saved: null,
    savePending: undefined,
    armed: false,
    confirm: false,
    askStar: false,
    starPending: undefined,
    ap: 0,
    apOn: false,
    heads: 0,
    theme: THEMES[0]!,
    wind: 0,
    focus: 0,
    focusT: 0,
    thermal: false,
    battery: 5000,
    streak: 0,
    streakT: -1e9,
    civT: 4000,
    supply: null,
    supplyT: 15000,
    ufo: null,
    ufoT: 1e9,
    moonHits: 0,
    moonDone: false,
    keys: [],
    rainbow: false,
  } as unknown as Game
  startLevel(g, 1)
  g.phase = 'intro'
  return g
}

const checkpoint = (g: Game, save: Save) => {
  g.saved = save
  g.savePending = save
}

const startLevel = (g: Game, level: number, stage = 0) => {
  g.level = level
  g.stages = Math.min(4, 2 + Math.floor((level - 1) / 2))
  g.hp = diffOf(g).hp
  g.theme = THEMES[(level - 1) % THEMES.length]!
  g.enemies = []
  g.fx = []
  buildStreet(g)
  startStage(g, Math.min(stage, g.stages - 1))
}

const startStage = (g: Game, stage: number) => {
  const d = diffOf(g)
  g.stage = stage
  g.camX = stage * g.W
  g.toKill = Math.min(9, 2 + g.level + Math.floor(stage / 2))
  g.killed = 0
  g.maxAlive = Math.max(1, Math.min(6, 1 + Math.floor(g.level / 2) + d.alive))
  g.upMs = Math.max(900, (3600 - g.level * 280) * d.up)
  g.gapMs = Math.max(400, 1500 - g.level * 140)
  g.ammo = g.toKill + d.spare(g.level)
  g.combo = 0
  g.zoom = false
  g.zoomT = 0
  g.cooldown = 0
  g.flash = 0
  g.hurt = 0
  g.kick = 0
  g.slow = 0
  g.nextSpawn = 1100
  g.outOfAmmoT = 0
  g.enemies = g.enemies.filter(e => e.st === 'dead')
  for (const s of g.spawns) s.busy = false
  g.phase = 'play'
  g.paused = false
  g.wind = g.level >= 5 ? (rnd(g) < 0.5 ? -1 : 1) * ri(g, 1, 2) : 0
  g.thermal = false
  g.focusT = 0
  g.civT = 2500 + ri(g, 0, 3000)
  g.supply = null
  g.supplyT = 9000 + ri(g, 0, 9000)
  g.ufo = null
  g.ufoT = g.level >= 3 && rnd(g) < 0.4 ? ri(g, 3000, 20000) : 1e9
  if (g.armed) checkpoint(g, { level: g.level, stage, score: g.score, shots: g.shots, hits: g.hits, diff: g.diff, hp: g.hp, ap: g.ap })
  const news = stage === 0 ? tx(g).news[Math.min(g.level, 7)] : undefined
  if (news && g.level <= 7) showBanner(g, tx(g).levelNew(g.level, news), '#7dff6b', 3500)
  else showBanner(g, tx(g).levelStage(g.level, stage + 1, g.stages), '#ffe14d', 1500)
}

const showBanner = (g: Game, text: string, color: string, ms: number) => {
  g.banner = text
  g.bannerColor = color
  g.bannerMs = ms
}

// ---------- logic ----------

// where the barrel really points: on hard levels the scope breathes
const aim = (g: Game): [number, number] => {
  const amp = g.zoom ? diffOf(g).sway : 0
  const sx = amp * Math.sin(g.time / 650) * 2
  const sy = amp * Math.cos(g.time / 1030)
  return [clamp(Math.round(g.ax + sx), 0, g.W - 1), clamp(Math.round(g.ay + sy), 0, g.H - 1)]
}

// enemy cells in world coordinates; the first is the head
const visibleCells = (e: Enemy): [number, number][] => {
  if (e.st === 'dead' || e.st === 'hidden') return []
  const x = Math.round(e.x)
  if (e.kind === 'drone') return [[x - 1, e.y], [x, e.y], [x + 1, e.y]]
  const rows = (e.st === 'rise' && e.t < 220) || (e.st === 'sink' && e.t > 120) ? 1 : e.rows
  const cells: [number, number][] = []
  for (let r = 0; r < rows; r++) cells.push([x, e.y + r])
  return cells
}

const inStage = (g: Game, x: number) => x >= g.camX + 2 && x <= g.camX + g.W - 3

const spawnEnemy = (g: Game) => {
  const free = g.spawns
    .map((s, i) => i)
    .filter(i => {
      const s = g.spawns[i]!
      return !s.busy && !s.used && inStage(g, s.x)
    })
  const [from, chance] = diffOf(g).drones
  const mk = (kind: Enemy['kind'], spawn: number, x: number, y: number, rows: number, st: EnemySt): Enemy => ({
    id: g.nextId++,
    kind,
    spawn,
    x,
    y,
    rows,
    st,
    t: 0,
    aimMs: g.upMs + ri(g, -200, 400),
    vx: 0,
    tx: x,
    dead: -1,
    pose: 'lie',
    vy: 0,
    pool: 0,
    helmet: kind !== 'drone' && g.level >= 2 && rnd(g) < (g.level >= 7 ? 0.5 : 0.3),
    civ: false,
    sniper: false,
  })
  if (g.level >= from && rnd(g) < chance) {
    const dir = rnd(g) < 0.5 ? 1 : -1
    const e = mk('drone', -1, dir > 0 ? g.camX + 1 : g.camX + g.W - 2, ri(g, 1, Math.max(2, Math.floor(g.H * 0.3))), 1, 'fly')
    e.vx = dir * (6 + g.level)
    e.aimMs *= 1.6
    g.enemies.push(e)
    return
  }
  if (free.length === 0) return
  const i = pick(g, free)
  const s = g.spawns[i]!
  // from a door an enemy may run to the nearest barricade — a moving target
  if (s.kind === 'door' && rnd(g) < 0.6) {
    const ci = free.filter(k => g.spawns[k]!.kind === 'barrier').sort((a, b) => Math.abs(g.spawns[a]!.x - s.x) - Math.abs(g.spawns[b]!.x - s.x))[0]
    const cover = ci === undefined ? undefined : g.spawns[ci]
    if (ci !== undefined && cover) {
      cover.busy = true
      const e = mk('runner', ci, s.x, s.y, 3, 'run')
      e.tx = cover.x
      e.vx = Math.sign(cover.x - s.x) * (7 + g.level)
      g.enemies.push(e)
      return
    }
  }
  s.busy = true
  const e = mk(s.kind, i, s.x, s.y, s.rows, 'rise')
  if (s.kind === 'roof' && g.level >= 4 && rnd(g) < 0.5) {
    e.sniper = true
    e.aimMs *= 0.7
  }
  g.enemies.push(e)
}

// a civilian looks out of a window and hides — do not shoot
const spawnCiv = (g: Game) => {
  const free = g.spawns.map((s, i) => i).filter(i => {
    const s = g.spawns[i]!
    return s.kind === 'window' && !s.busy && !s.used && inStage(g, s.x)
  })
  if (!free.length) return
  const i = pick(g, free)
  const s = g.spawns[i]!
  s.busy = true
  g.enemies.push({
    id: g.nextId++, kind: 'window', spawn: i, x: s.x, y: s.y, rows: 2, st: 'rise', t: 0, aimMs: 2600, vx: 0, tx: s.x,
    dead: -1, pose: 'lie', vy: 0, pool: 0, helmet: false, civ: true, sniper: false,
  })
}

const addFx = (g: Game, x: number, y: number, text: string, fg: string, ms: number, rise = false) =>
  g.fx.push({ x, y, text, fg, ms, max: ms, rise })

const freeSpawn = (g: Game, e: Enemy) => {
  const s = g.spawns[e.spawn]
  if (s) s.busy = false
}

const finish = (g: Game, phase: Phase, reason: string) => {
  g.phase = phase
  g.reason = reason
  g.endT = g.time
  g.zoom = false
  if (g.score > g.best) g.best = g.score
  g.bestPending = g.score
  g.sfx.push(phase === 'won' ? 'win' : 'lose')
  // level complete — the next one starts from here
  if (phase === 'won') checkpoint(g, { level: g.level + 1, stage: 0, score: g.score, shots: g.shots, hits: g.hits, diff: g.diff, hp: diffOf(g).hp, ap: g.ap })
}

// blood spray flies out and falls
const splash = (g: Game, x: number, y: number, n: number, power: number, gore = false) => {
  for (let k = 0; k < n; k++) {
    const a = rnd(g) * Math.PI * 2
    const sp = power * (2 + rnd(g) * 4)
    g.parts.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(a) * sp * 1.6,
      vy: Math.sin(a) * sp - power * 3,
      life: 200 + rnd(g) * 300,
      ch: gore && rnd(g) < 0.4 ? pick(g, ['▪', '•', '*']) : pick(g, ['·', '•', '·', '∙']),
      fg: rnd(g) < 0.35 ? GORE : BLOOD,
      stick: true,
    })
  }
}

const decal = (g: Game, x: number, y: number, d: Decal) => {
  if (x < 0 || y < 0 || x >= g.WW || y >= g.H) return
  const i = y * g.WW + x
  if (g.near.ch[i] === '') return // blood does not stick to the sky
  g.decals.set(i, d)
}

const hurtPlayer = (g: Game, e: Enemy) => {
  g.hp -= 1
  g.hurt = 500
  g.shake = 300
  g.sfx.push('hurt')
  g.combo = 0
  addFx(g, Math.round(e.x) - g.camX + 1, e.y + 1, '✶', '#ffe14d', 160)
}

const tickEnemy = (g: Game, e: Enemy, dt: number) => {
  e.t += dt
  const fire = () => {
    if (e.t < e.aimMs) return
    if (e.civ) {
      e.st = 'sink'
      e.t = 0
      return
    }
    hurtPlayer(g, e)
    e.t = 0
    if (e.kind === 'drone') e.aimMs = g.upMs * 1.6
    else e.st = 'sink'
  }
  switch (e.st) {
    case 'rise':
      if (e.t >= 260) {
        e.st = 'aim'
        e.t = 0
      }
      break
    case 'aim':
      fire()
      break
    case 'sink':
      if (e.t < 240) break
      if (e.kind === 'barrier' || e.kind === 'car' || e.kind === 'runner') {
        // hides behind cover and will pop up again
        e.st = 'hidden'
        e.t = 0
        e.aimMs = g.upMs + ri(g, -200, 400)
      } else {
        freeSpawn(g, e)
        e.dead = 1e9
        e.st = 'dead'
      }
      break
    case 'hidden':
      if (e.t > 1000 + (e.id % 7) * 150) {
        e.st = 'rise'
        e.t = 0
      }
      break
    case 'run':
      e.x += (e.vx * dt) / 1000
      if ((e.vx > 0 && e.x >= e.tx) || (e.vx < 0 && e.x <= e.tx) || e.vx === 0) {
        // reached the barricade — now hides behind it
        const s = g.spawns[e.spawn]
        e.x = e.tx
        if (s) {
          e.y = s.y
          e.rows = s.rows
        }
        e.st = 'aim'
        e.t = 0
        e.aimMs = Math.max(700, e.aimMs * 0.7)
      }
      break
    case 'fly':
      e.x += (e.vx * dt) / 1000
      if (e.x < g.camX + 1 || e.x > g.camX + g.W - 2) {
        e.vx = -e.vx
        e.x = clamp(e.x, g.camX + 1, g.camX + g.W - 2)
      }
      fire()
      break
  }
}

// bodies stay: pools grow, rooftop bodies fall down
const tickCorpse = (g: Game, e: Enemy, dt: number) => {
  if (e.dead > 1e8) return
  e.dead += dt
  const x = Math.round(e.x)
  const S = sidewalk(g)
  if (e.pose === 'fall') {
    e.vy += (40 * dt) / 1000
    e.y += (e.vy * dt) / 1000
    if (e.y >= S - 1) {
      e.y = S - 1
      e.pose = 'lie'
      e.dead = 0
      g.sfx.push('splat')
      g.shake = Math.max(g.shake, 150)
      splash(g, x, S - 1, 14, 1)
    }
    return
  }
  if (e.pose === 'wreck') {
    if (e.y < S) e.y += (12 * dt) / 1000
    return
  }
  if (e.pose === 'lie' && e.pool < 5 && e.dead > 300 + e.pool * 350) {
    // the pool spreads along the row under the body
    const row = Math.min(g.H - 1, Math.round(e.y) + 1)
    const k = e.pool
    for (const dx of [-k, k]) {
      const i = row * g.WW + x + dx
      decal(g, x + dx, row, { ch: '▀', fg: k < 2 ? BLOOD : GORE, bg: g.near.bg[i] })
    }
    e.pool++
  }
}

// kills charge focus, a quick kill streak gives a bonus
const onKill = (g: Game) => {
  if (g.level >= 2) g.focus = Math.min(1, g.focus + 0.34)
  g.streak = g.time - g.streakT < 2500 ? g.streak + 1 : 1
  g.streakT = g.time
  if (g.streak < 2) return
  const name = g.streak === 2 ? 'DOUBLE KILL' : g.streak === 3 ? 'TRIPLE KILL' : 'RAMPAGE'
  g.score += 100 * g.streak
  showBanner(g, `${name} +${100 * g.streak}`, '#ff3df2', 1200)
}

const kill = (g: Game, e: Enemy, head: boolean, blast = false) => {
  e.st = 'dead'
  e.dead = 0
  if (!e.civ) {
    g.killed += 1
    onKill(g)
  }
  const x = Math.round(e.x)
  const y = Math.round(e.y)
  const s = g.spawns[e.spawn]
  if (s) {
    s.busy = false
    if (e.kind === 'window') s.used = true // the body stays in the window
  }
  if (e.kind === 'drone') {
    e.pose = 'wreck'
    g.sfx.push('boom')
    for (let k = 0; k < 14; k++)
      g.parts.push({ x: x + 0.5, y: y + 0.5, vx: (rnd(g) - 0.5) * 30, vy: -rnd(g) * 8, life: 400 + rnd(g) * 400, ch: pick(g, ['*', '+', '·']), fg: pick(g, ['#ffe9a0', '#ff8a1e']), stick: false })
    return
  }
  g.sfx.push(blast ? 'splat' : head ? 'headshot' : 'hit')
  splash(g, x, head ? y : y + 1, head ? 22 : blast ? 26 : 14, head ? 1.4 : 1, head)
  if (e.kind === 'window') {
    e.pose = 'hang'
    // the glass darkens with blood, a couple of drips run from the sill
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = 0; dy < 2; dy++) {
        const i = (y + dy) * g.WW + x + dx
        if (g.windows.has(i)) decal(g, x + dx, y + dy, { ch: ' ', fg: BLOOD, bg: mix(g.near.bg[i]!, '#5a0610', 0.75) })
      }
    for (const dx of [-1, 1]) if (rnd(g) < 0.7) g.drips.push({ x: x + dx, y: y + 2, len: 0, max: 2 + Math.floor(rnd(g) * 3), t: 0 })
  } else if (e.kind === 'roof') {
    e.pose = 'fall'
    e.vy = -4
  } else {
    e.pose = 'lie'
    e.y = y + e.rows - 1
  }
}

// last enemy of the stage — slow motion
const afterKill = (g: Game) => {
  if (g.killed >= g.toKill && !g.enemies.some(e => e.st !== 'dead' && !e.civ)) {
    g.slow = 900
    g.sfx.push('stage')
  }
}

const explode = (g: Game, b: Barrel) => {
  b.alive = false
  g.sfx.push('explode')
  g.shake = 500
  const S = sidewalk(g)
  for (let k = 0; k < 40; k++) {
    const a = rnd(g) * Math.PI * 2
    const sp = 6 + rnd(g) * 18
    g.parts.push({ x: b.x + 1, y: S - 1.5, vx: Math.cos(a) * sp * 1.8, vy: Math.sin(a) * sp * 0.6 - 4, life: 300 + rnd(g) * 500, ch: pick(g, ['*', '#', '@', '+', '░']), fg: pick(g, ['#ff8a1e', '#ffe14d', '#ff3d1e', '#70707a']), stick: false })
  }
  for (let dx = -3; dx <= 4; dx++) for (const dy of [-2, -1, 0]) if (rnd(g) < 0.6) decal(g, b.x + dx, S + dy, { ch: pick(g, ['▒', '░']), fg: '#1a1414' })
  let kills = 0
  for (const e of g.enemies) {
    if (e.st === 'dead' || e.st === 'hidden' || e.kind === 'drone' || e.kind === 'roof' || e.kind === 'window' || e.civ) continue
    if (Math.abs(e.x - b.x) <= 7) {
      kill(g, e, false, true)
      kills++
    }
  }
  if (kills) {
    const pts = Math.round(kills * 150 * diffOf(g).mul * (kills > 1 ? 2 : 1))
    g.score += pts
    addFx(g, b.x - g.camX - 2, S - 4, `+${pts} ${kills > 1 ? 'MULTIKILL' : 'BOOM'}`, '#ff9a3d', 1100, true)
  }
  for (const o of g.barrels) if (o.alive && o.fuse < 0 && Math.abs(o.x - b.x) <= 9) o.fuse = 200
  for (const c of g.cars) if (Math.abs(c.x + 4 - b.x) <= 10) c.alarm = 2600
}

const tick = (g: Game, realDt: number) => {
  g.time += realDt
  if (g.reloadAt >= 0 && g.time >= g.reloadAt) {
    g.reloadAt = -1
    g.sfx.push('reload')
  }
  g.bannerMs = Math.max(0, g.bannerMs - realDt)
  g.fx = g.fx.filter(f => (f.ms -= realDt) > 0)
  if (g.paused || g.confirm) return
  const dt = g.slow > 0 || g.focusT > 0 ? realDt * 0.3 : realDt
  g.slow = Math.max(0, g.slow - realDt)
  g.focusT = Math.max(0, g.focusT - realDt)
  if (g.thermal) {
    g.battery -= realDt
    if (g.battery <= 0) {
      g.battery = 0
      g.thermal = false
    }
  } else g.battery = Math.min(5000, g.battery + realDt * 0.4)
  g.shake = Math.max(0, g.shake - realDt)
  g.hurt = Math.max(0, g.hurt - realDt)
  if (g.tracer && (g.tracer.ms -= dt) <= 0) g.tracer = null
  for (const c of g.cars) c.alarm = Math.max(0, c.alarm - dt)

  // blood drops fall and vanish at the sidewalk
  const ground = sidewalk(g)
  const keep: Part[] = []
  for (const p of g.parts) {
    p.life -= dt
    p.vy += ((p.stick ? 45 : 30) * dt) / 1000
    if (p.stick) p.vx *= 0.88 // a drop quickly loses its spread and falls almost straight
    p.x += (p.vx * dt) / 1000
    p.y += (p.vy * dt) / 1000
    if (p.stick ? p.y < ground - 0.5 : p.life > 0) keep.push(p)
  }
  g.parts = keep.slice(-500)
  for (const d of g.drips) {
    if (d.len >= d.max) continue
    d.t += dt
    if (d.t < 220) continue
    d.t = 0
    const y = d.y + d.len
    const i = y * g.WW + d.x
    if (g.windows.has(i) || y >= sidewalk(g) || g.near.ch[i] === '') {
      d.max = d.len
      continue
    }
    decal(g, d.x, y, { ch: d.len + 1 >= d.max ? '╹' : '┃', fg: BLOOD })
    d.len++
  }
  for (const e of g.enemies) if (e.st === 'dead') tickCorpse(g, e, dt)
  for (const b of g.barrels) {
    if (!b.alive || b.fuse < 0) continue
    b.fuse -= dt
    if (b.fuse <= 0) {
      explode(g, b)
      afterKill(g)
    }
  }

  if (g.phase === 'move') {
    // the camera moves to the next position by itself
    g.phaseT += dt
    const k = clamp(g.phaseT / 1800, 0, 1)
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
    g.camX = Math.round(g.moveFrom + g.W * ease)
    if (k >= 1) startStage(g, g.stage + 1)
    return
  }
  if (g.phase === 'clear') {
    g.phaseT += realDt
    if (g.phaseT < 1500) return
    if (g.stage + 1 >= g.stages) {
      g.score += g.hp * 100
      finish(g, 'won', tx(g).streetClear(g.hp))
      return
    }
    g.phase = 'move'
    g.phaseT = 0
    g.moveFrom = g.camX
    showBanner(g, tx(g).moving, '#2ef2ff', 99999)
    g.sfx.push('move')
    return
  }
  if (g.phase !== 'play') return

  g.cooldown = Math.max(0, g.cooldown - dt)
  g.flash = Math.max(0, g.flash - dt)
  g.kick = Math.max(0, g.kick - dt / 180)
  if (g.zoom) g.zoomT += dt

  for (const e of g.enemies) if (e.st !== 'dead') tickEnemy(g, e, dt)
  g.enemies = g.enemies.filter(e => e.dead < 1e8)
  if (g.hp <= 0) return finish(g, 'lost', tx(g).shot)

  const alive = g.enemies.filter(e => e.st !== 'dead' && !e.civ).length
  if (g.level >= 3 && g.killed < g.toKill) {
    g.civT -= dt
    if (g.civT <= 0) {
      spawnCiv(g)
      g.civT = 4000 + ri(g, 0, 4000)
    }
  }
  // the supply drone and the UFO fly in screen coordinates
  if (g.level >= 4 && !g.supply && (g.supplyT -= dt) <= 0) {
    const dir = rnd(g) < 0.5 ? 1 : -1
    g.supply = { x: dir > 0 ? -3 : g.W + 3, y: ri(g, 2, 4), vx: dir * 9 }
    g.supplyT = 16000 + ri(g, 0, 10000)
  }
  if (!g.ufo && (g.ufoT -= dt) <= 0) {
    const dir = rnd(g) < 0.5 ? 1 : -1
    g.ufo = { x: dir > 0 ? -5 : g.W + 5, y: ri(g, 0, 1), vx: dir * 22 }
    g.ufoT = 1e9
  }
  for (const f of [g.supply, g.ufo]) if (f) f.x += (f.vx * dt) / 1000
  if (g.supply && (g.supply.x < -6 || g.supply.x > g.W + 6)) g.supply = null
  if (g.ufo && (g.ufo.x < -8 || g.ufo.x > g.W + 8)) g.ufo = null
  g.nextSpawn -= dt
  if (g.nextSpawn <= 0 && alive < Math.min(g.maxAlive, g.toKill - g.killed)) {
    spawnEnemy(g)
    g.nextSpawn = g.gapMs + ri(g, 0, 700)
  }

  // hostages hide before the sniper moves on
  const civs = g.enemies.some(e => e.st !== 'dead' && e.civ)
  if (g.killed >= g.toKill && alive === 0 && !civs && g.slow <= 0) {
    const bonus = g.ammo * 50
    g.score += bonus
    g.phase = 'clear'
    g.phaseT = 0
    g.zoom = false
    showBanner(g, tx(g).stageClear(g.stage + 1, g.stages, bonus), '#7dff6b', 1500)
    return
  }
  if (g.ammo === 0 && g.ap === 0 && g.killed < g.toKill && !g.barrels.some(b => b.alive && b.fuse >= 0)) {
    g.outOfAmmoT += dt
    if (g.outOfAmmoT > 600) return finish(g, 'lost', tx(g).noAmmo)
  }
}

const AP_MAX = 5

const addAp = (g: Game, n: number) => {
  g.ap = Math.min(AP_MAX, g.ap + n)
}

// three headshot kills in a row give an AP round, once helmets show up
const headStreak = (g: Game, head: boolean) => {
  g.heads = head ? g.heads + 1 : 0
  if (g.heads < 3 || g.level < 2) return
  g.heads = 0
  addAp(g, 1)
  g.sfx.push('pickup')
  showBanner(g, tx(g).apStreak, '#ff8a1e', 1800)
}

const shoot = (g: Game) => {
  if (g.phase !== 'play') return
  if (g.cooldown > 0) return addFx(g, Math.round(g.ax) + 2, Math.round(g.ay) - 1, tx(g).reloading, '#aaaaaa', 300)
  // an AP round goes when switched on, or when the plain ones are out
  const ap = g.ap > 0 && (g.apOn || g.ammo <= 0)
  if (g.ammo <= 0 && !ap) {
    g.sfx.push('empty')
    return addFx(g, Math.round(g.ax) + 2, Math.round(g.ay) - 1, tx(g).empty, '#ff5050', 400)
  }
  const d = diffOf(g)
  const steady = g.zoom && g.zoomT >= d.settle
  const [bx, by] = aim(g)
  if (ap) {
    g.ap -= 1
    if (!g.ap) g.apOn = false
  } else g.ammo -= 1
  g.shots += 1
  g.cooldown = 750
  g.flash = 90
  g.kick = ap ? 1.6 : 1
  if (ap) g.shake = Math.max(g.shake, 180)
  g.sfx.push(ap ? 'apshot' : 'shot')
  g.reloadAt = g.time + 260
  // the bolt cycles — the scope drops
  g.zoom = false

  // unscoped shots drift, a settled scope is exact
  let dx = 0
  let dy = 0
  if (!steady && Math.random() < d.miss) {
    dx = Math.random() < 0.5 ? -1 : 1
    const q = Math.random()
    dy = q < 0.25 ? -1 : q > 0.75 ? 1 : 0
  }
  const hx = clamp(bx + dx + g.wind, 0, g.W - 1) // the wind pushes the bullet
  const hy = clamp(by + dy, 0, g.H - 1)
  const wx = hx + g.camX
  g.tracer = { x: hx, y: hy, ms: ap ? 140 : 80, ap }

  for (const e of g.enemies) {
    const k = visibleCells(e).findIndex(([cx, cy]) => cx === wx && cy === hy)
    if (k < 0) continue
    const head = e.kind !== 'drone' && k === 0
    if (e.civ) {
      kill(g, e, head)
      g.score = Math.max(0, g.score - 300)
      g.combo = 0
      g.heads = 0
      g.hurt = 400
      g.sfx.push('hurt')
      showBanner(g, tx(g).hostage, '#ff4040', 1500)
      return
    }
    if (head && e.helmet && !ap) {
      // the helmet held: it flies off, the enemy flinches and fires sooner
      e.helmet = false
      g.heads = 0
      g.hits += 1
      g.sfx.push('ricochet')
      addFx(g, hx + 1, hy, tx(g).clang, '#c8d0dc', 600, true)
      for (let q = 0; q < 6; q++) g.parts.push({ x: wx + 0.5, y: hy + 0.5, vx: (rnd(g) - 0.5) * 20, vy: -rnd(g) * 6, life: 250, ch: '·', fg: '#ffe9a0', stick: false })
      e.t = Math.max(e.t, e.aimMs - 900)
      return
    }
    const moving = e.st === 'run' || e.kind === 'drone'
    const pierced = head && e.helmet
    if (pierced) {
      e.helmet = false
      g.sfx.push('ricochet')
    }
    g.combo += 1
    g.hits += 1
    const pts = Math.round((100 + (head ? 50 : 0) + (pierced ? 50 : 0) + (moving ? 75 : 0)) * Math.min(5, g.combo) * d.mul)
    g.score += pts
    kill(g, e, head)
    const label = pierced ? tx(g).pierced : head ? ' HEADSHOT' : moving ? tx(g).onTheMove : ''
    addFx(g, hx + 1, hy, `+${pts}${label}${g.combo > 1 ? ` x${Math.min(5, g.combo)}` : ''}`, pierced ? '#ff8a1e' : head ? '#ffe14d' : '#7dff6b', 900, true)
    headStreak(g, head)
    afterKill(g)
    return
  }

  if (shootExtras(g, hx, hy, wx)) return
  g.combo = 0
  g.heads = 0
  const S = sidewalk(g)
  const barrel = g.barrels.find(b => b.alive && (wx === b.x || wx === b.x + 1) && (hy === S - 1 || hy === S - 2))
  if (barrel) {
    explode(g, barrel)
    afterKill(g)
    return
  }
  const i = hy * g.WW + wx
  if (g.windows.has(i) && !g.broken.has(i)) {
    g.broken.add(i)
    g.sfx.push('glass')
  } else g.sfx.push('miss')
  for (const c of g.cars)
    if (wx >= c.x && wx < c.x + 9 && hy >= g.carRow && hy <= g.carRow + 1) {
      c.alarm = 2200
      g.sfx.push('alarm')
    }
  addFx(g, hx, hy, '*', '#ffffff', 260)
  // nearby enemies hear the shot and aim faster
  for (const e of g.enemies) if (e.st !== 'dead' && Math.abs(e.x - wx) <= 3 && Math.abs(e.y - hy) <= 3) e.t = Math.max(e.t, e.aimMs - 900)
}

// Supply drone, UFO and easter eggs. true — the bullet hit something.
const shootExtras = (g: Game, hx: number, hy: number, wx: number): boolean => {
  const d = diffOf(g)
  const sp = g.supply
  if (sp && ((hy === sp.y && Math.abs(hx - Math.round(sp.x)) <= 1) || (hy === sp.y + 1 && hx === Math.round(sp.x)))) {
    g.supply = null
    g.sfx.push('pickup')
    if (g.hp < d.hp) {
      g.hp += 1
      addFx(g, hx + 1, hy, tx(g).plusLife, '#ff4d6d', 1000, true)
    } else if (rnd(g) < 0.5) {
      addAp(g, 2)
      addFx(g, hx + 1, hy, tx(g).plusAp(2), '#ff8a1e', 1000, true)
    } else {
      g.ammo += 3
      addFx(g, hx + 1, hy, tx(g).plusAmmo, '#ffe14d', 1000, true)
    }
    return true
  }
  const u = g.ufo
  if (u && hy === u.y && Math.abs(hx - Math.round(u.x)) <= 2) {
    g.ufo = null
    g.score += 2500
    g.sfx.push('boom')
    showBanner(g, tx(g).ufo, '#7dff6b', 2000)
    for (let q = 0; q < 16; q++) g.parts.push({ x: wx + 0.5, y: hy + 0.5, vx: (rnd(g) - 0.5) * 30, vy: -rnd(g) * 6, life: 600, ch: pick(g, ['*', '+', '·']), fg: '#7dff6b', stick: false })
    return true
  }
  // the moon is visible only over the sky
  const moonX = g.W - 9
  if (!g.moonDone && hy === 1 && Math.abs(hx - moonX) <= 1 && g.near.ch[g.WW + moonX + g.camX] === '') {
    g.moonHits++
    g.sfx.push('ricochet')
    if (g.moonHits >= 3) {
      g.moonDone = true
      g.score += 1000
      showBanner(g, tx(g).moonSniper, '#f5ecc8', 2000)
    } else addFx(g, hx + 1, hy, tx(g).moon(g.moonHits), '#f5ecc8', 600)
    return true
  }
  const c = g.claude
  if (c && !c.hit && hy === c.y && wx >= c.x && wx < c.x + c.len) {
    c.hit = true
    g.score += 42
    g.sfx.push('glass')
    showBanner(g, tx(g).claude, '#d97757', 2500)
    return true
  }
  const ch = g.chart
  if (ch && !ch.hit && (hy === ch.y || hy === ch.y + 1) && wx >= ch.x && wx < ch.x + ch.len) {
    ch.hit = true
    g.score += 500
    g.sfx.push('glass')
    showBanner(g, tx(g).stopLoss, '#ef5350', 2000)
    return true
  }
  const cat = g.cat
  if (cat && hy === cat.y && Math.abs(wx - cat.x) <= 1) {
    // the cat cannot be hurt: it just jumps to another roof
    cat.jumps++
    g.sfx.push('meow')
    addFx(g, hx - 1, hy - 1, tx(g).meow, '#ffb347', 900, true)
    const roofs = g.spawns.filter(r => r.kind === 'roof' && Math.abs(r.x + 2 - cat.x) > 4)
    if (cat.jumps >= 3 || !roofs.length) {
      g.cat = null
      addFx(g, hx - 3, hy, tx(g).catSleeps, '#ffb347', 1400)
    } else {
      const r = pick(g, roofs)
      cat.x = r.x + 2
      cat.y = r.y + 1
    }
    return true
  }
  return false
}

// ---------- drawing ----------

// hot — target cells on screen, heat — warmth for thermal (2 alive, 1 cooling)
type Scene = Layer & { hot: Set<number>; heat: Map<number, number> }

const drawScene = (g: Game): Scene => {
  const { W, H } = g
  const S = sidewalk(g)
  const shake = g.shake > 0 ? Math.round(Math.sin(g.time / 23) * (g.shake / 250)) : 0
  const cam = g.camX + shake
  const l: Scene = { ...layer(W, H), hot: new Set(), heat: new Map() }
  const blink = Math.floor(g.time / 120) % 2 === 0
  const warm = (x: number, y: number, h: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) l.heat.set(y * W + x, h)
  }

  // sky and moon stay put, the far skyline scrolls slower than the street
  const farX = Math.floor(cam * 0.4)
  const FW = Math.ceil(g.WW * 0.4) + W
  for (let y = 0; y < H; y++) {
    const sky = mix(g.theme.sky[0], g.theme.sky[1], Math.min(1, y / S))
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const nx = x + cam
      const ni = y * g.WW + nx
      if (nx >= 0 && nx < g.WW && g.near.ch[ni] !== '') {
        l.ch[i] = g.near.ch[ni]!
        l.fg[i] = g.near.fg[ni]!
        l.bg[i] = g.near.bg[ni]!
        if (g.broken.has(ni)) {
          l.ch[i] = '╳'
          l.fg[i] = '#c8d0dc'
          l.bg[i] = '#141b28'
        }
        const dc = g.decals.get(ni)
        if (dc) {
          l.ch[i] = dc.ch
          l.fg[i] = dc.fg
          if (dc.bg) l.bg[i] = dc.bg
        }
        continue
      }
      const fx = x + farX
      const fi = y * FW + fx
      if (fx >= 0 && fx < FW && g.far.ch[fi]) {
        l.ch[i] = g.far.ch[fi]!
        l.fg[i] = g.far.fg[fi]!
        l.bg[i] = g.far.bg[fi]!
        continue
      }
      l.ch[i] = ' '
      l.bg[i] = sky
    }
  }
  for (const [x, y, c] of g.stars) if (l.ch[y * W + x] === ' ' && l.bg[y * W + x] !== '#141a2e') put(l, W, H, x, y, '·', c)
  if (l.ch[W + W - 9] === ' ') put(l, W, H, W - 9, 1, g.moonDone ? '◐' : '●', '#f5ecc8')

  // easter eggs: the CLAUDE sign goes dark when hit, the chart window, the cat
  const c = g.claude
  if (c?.hit && Math.floor(g.time / 700) % 5 !== 0) for (let i = 0; i < c.len; i++) put(l, W, H, c.x + i - cam, c.y, l.ch[c.y * W + c.x + i - cam] ?? ' ', '#3a2620')
  const ch = g.chart
  if (ch) {
    const up = ['▂▅▇', '▆██']
    const down = ['▇▃ ', '█▆▂']
    const rows = ch.hit ? down : up
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 3; dx++) put(l, W, H, ch.x + dx - cam, ch.y + dy, rows[dy]![dx]!, ch.hit ? '#ef5350' : '#26a69a', '#0b0f17')
  }
  if (g.cat) {
    const x = g.cat.x - cam
    put(l, W, H, x - 1, g.cat.y, '^', '#ffb347')
    put(l, W, H, x, g.cat.y, Math.floor(g.time / 1500) % 4 === 0 ? '-' : '.', '#ffb347')
    put(l, W, H, x + 1, g.cat.y, '^', '#ffb347')
    for (let dx = -1; dx <= 1; dx++) warm(x + dx, g.cat.y, 1.5)
  }

  // barrels
  for (const b of g.barrels) {
    if (!b.alive) continue
    const x = b.x - cam
    const color = b.fuse >= 0 && blink ? '#ffe14d' : '#c8341e'
    put(l, W, H, x, S - 2, '▄', color)
    put(l, W, H, x + 1, S - 2, '▄', color)
    put(l, W, H, x, S - 1, '☰', '#ffe14d', '#c8341e')
    put(l, W, H, x + 1, S - 1, '☰', '#ffe14d', '#c8341e')
  }

  // enemies and bodies
  for (const e of g.enemies) {
    if (e.dead > 1e8) continue
    const x = Math.round(e.x) - cam
    const y = Math.round(e.y)
    if (e.kind === 'drone') {
      if (e.st === 'dead') {
        if (e.dead < 6000) put(l, W, H, x, y, e.dead < 600 ? '*' : '⌁', e.dead < 600 ? '#ff9a3d' : '#5a6070')
        continue
      }
      const danger = e.t > e.aimMs - 900
      put(l, W, H, x - 1, y, '╾', '#9ad1ff')
      put(l, W, H, x, y, '◆', danger && blink ? '#ff3030' : '#d8ecff')
      put(l, W, H, x + 1, y, '╼', '#9ad1ff')
      for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < W && y >= 0 && y < H) {
        l.hot.add(y * W + x + dx)
        warm(x + dx, y, 2)
      }
      continue
    }
    if (e.st === 'hidden') {
      // behind cover it shows only on thermal
      if (g.thermal) for (let r = 0; r < e.rows; r++) {
        put(l, W, H, x, y + r, '░', '#ffffff')
        warm(x, y + r, 1.5)
      }
      continue
    }
    if (e.st === 'dead') {
      if (e.dead < 8000) for (const dx of [-1, 0, 1]) warm(x + dx, e.pose === 'hang' ? y + 1 : y, 1)
      if (e.pose === 'hang') {
        // slumped over the windowsill
        put(l, W, H, x, y + 1, '●', '#c9956a')
        put(l, W, H, x - 1, y + 1, '▀', '#8a1a14')
        put(l, W, H, x + 1, y + 1, '▀', '#8a1a14')
      } else if (e.pose === 'fall') {
        put(l, W, H, x, y, '●', '#f1c27d')
        put(l, W, H, x, y + 1, '▓', '#b3261e')
      } else {
        // lying on the ground
        put(l, W, H, x - 1, y, '●', '#c9956a')
        put(l, W, H, x, y, '▬', '#8a1a14')
        put(l, W, H, x + 1, y, '▬', '#3a3a44')
      }
      continue
    }
    const danger = !e.civ && e.st === 'aim' && e.t > e.aimMs - 900
    visibleCells(e).forEach(([wx, cy], r) => {
      const cx = wx - cam
      if (r === 0) put(l, W, H, cx, cy, e.helmet ? '◓' : '●', e.helmet ? '#8a92a0' : danger && blink ? '#ff3030' : '#f1c27d')
      else if (r === 1) put(l, W, H, cx, cy, '█', e.civ ? '#e4e4ea' : '#b3261e')
      else put(l, W, H, cx, cy, e.st === 'run' && blink ? 'ʌ' : 'Λ', '#3a3a44')
      if (cx >= 0 && cx < W && cy >= 0 && cy < H) l.hot.add(cy * W + cx)
      warm(cx, cy, 2)
    })
    if (danger && blink) put(l, W, H, x, y - 1, '!', '#ff3030')
    // a sniper gives itself away with a scope glint
    if (e.sniper && e.st === 'aim' && Math.floor(g.time / 250) % 3 === 0) put(l, W, H, x + 1, y, '✦', '#ffffff')
  }
  for (const c of g.cars) if (c.x - cam > -10 && c.x - cam < W) drawCar(l, g, c, c.x - cam)

  // the supply drone with a crate, and the UFO
  if (g.supply) {
    const x = Math.round(g.supply.x)
    const y = g.supply.y
    put(l, W, H, x - 1, y, '╾', '#9ad1ff')
    put(l, W, H, x, y, '■', '#7dff6b')
    put(l, W, H, x + 1, y, '╼', '#9ad1ff')
    put(l, W, H, x, y + 1, '▣', '#ffe14d')
  }
  if (g.ufo) {
    const x = Math.round(g.ufo.x)
    '-=●=-'.split('').forEach((c2, i) => put(l, W, H, x - 2 + i, g.ufo!.y, c2, c2 === '●' ? (blink ? '#ffffff' : '#7dff6b') : '#7dff6b'))
  }

  // particles
  for (const p of g.parts) put(l, W, H, Math.round(p.x) - cam, Math.round(p.y), p.ch, p.fg)

  // rain and snow
  if (g.theme.rain || g.theme.snow) {
    const n = Math.floor((W * H) / 70)
    const t = g.time / 1000
    for (let k = 0; k < n; k++) {
      const hx = (k * 2654435761) % 1000
      const hy = (k * 40503) % 997
      const speed = g.theme.rain ? 22 : 3 + (k % 3)
      const y = Math.floor((hy / 997) * H + t * speed) % H
      const drift = g.theme.rain ? -y * 0.4 - g.wind * y * 0.3 : Math.sin(t + k) * 1.5
      const x = (((Math.floor((hx / 1000) * W + drift) % W) + W) % W)
      if (l.hot.has(y * W + x)) continue
      put(l, W, H, x, y, g.theme.rain ? '╱' : k % 4 === 0 ? '*' : '·', g.theme.rain ? '#5a7aa6' : '#e8eef8')
    }
  }

  // an aiming enemy shows its barrel; it flashes right before the shot
  if (g.phase === 'play')
    for (const e of g.enemies) {
      if (e.st !== 'aim' || e.kind === 'drone') continue
      const danger = e.t > e.aimMs - 700
      put(l, W, H, Math.round(e.x) - cam + 1, Math.round(e.y) + 1, '╼', danger && blink ? '#ffe14d' : '#9aa0aa')
    }

  for (const f of g.fx) {
    const y = f.rise ? f.y - Math.floor((f.max - f.ms) / 300) : f.y
    for (let i = 0; i < f.text.length; i++) put(l, W, H, f.x + i, y, f.text[i]!, f.fg)
  }
  return l
}

// Crosshair with a hollow centre. It leaves enemy cells alone and only
// tints the background under the centre, so the target stays visible.
const crosshair = (l: Scene, W: number, H: number, cx: number, cy: number, color: string, arm: number, gap: number) => {
  const line = (x: number, y: number, ch: string) => {
    if (x < 0 || y < 0 || x >= W || y >= H || l.hot.has(y * W + x)) return
    put(l, W, H, x, y, ch, color)
  }
  for (let d = gap * 2; d <= arm; d++) {
    line(cx - d, cy, '─')
    line(cx + d, cy, '─')
  }
  for (let d = gap; d <= Math.ceil(arm / 2); d++) {
    line(cx, cy - d, '│')
    line(cx, cy + d, '│')
  }
  if (cx < 0 || cy < 0 || cx >= W || cy >= H) return
  const i = cy * W + cx
  if (l.hot.has(i)) l.bg[i] = mix(l.bg[i]!, '#ff0000', 0.45)
  else put(l, W, H, cx, cy, '·', color)
}

// glyphs safe to repeat when zoomed: lines and blocks tile
const TILE = new Set(['─', '│', '▀', '▄', '▔', '▁', '▒', '▆', '█', '╳', '╾', '╼', '┃', '▓', '░', '☰', '▬'])
// shape glyphs: filled with solid colour when zoomed
const SOLID = new Set(['◆', 'Λ', 'ʌ'])
// head, moon, wheels when zoomed: top ▟▙, bottom ▜▛
const ROUND = ['▟', '▙', '▜', '▛']

const view = (g: Game): Scene => {
  const { W, H } = g
  const scene = drawScene(g)
  if (g.thermal) thermalize(scene)
  const [ax, ay] = aim(g)
  const tint = g.rainbow ? NEON[Math.floor(g.time / 90) % NEON.length]! : ''
  if (g.tracer && g.phase === 'play') {
    // tracer from the sniper to the impact point
    const sx = Math.floor(W / 2)
    const sy = H - 1
    const n = Math.max(Math.abs(g.tracer.x - sx), Math.abs(g.tracer.y - sy), 1)
    for (let k = Math.floor(n / 3); k < n; k++) {
      const x = Math.round(sx + ((g.tracer.x - sx) * k) / n)
      const y = Math.round(sy + ((g.tracer.y - sy) * k) / n)
      if (!scene.hot.has(y * W + x)) put(scene, W, H, x, y, g.tracer.ap ? '•' : '·', tint || (g.tracer.ap ? '#ff8a1e' : '#fff3a0'))
    }
  }
  if (!g.zoom || g.phase !== 'play') {
    if (g.phase === 'play') crosshair(scene, W, H, ax, ay, tint || (g.apOn ? '#ff8a1e' : '#ff4040'), 3, 1)
    return scene
  }

  // the 2× scope lens follows the cursor, the rest goes dark
  const out: Scene = { ...layer(W, H), hot: new Set(), heat: new Map() }
  const ry = Math.max(4, Math.min(8, Math.floor(H / 3)))
  const rx = ry * 2
  const kick = Math.round(g.kick * 2)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const nx = (x - ax) / rx
      const ny = (y - ay) / ry
      const d = nx * nx + ny * ny
      if (d <= 1) {
        const wx = ax + Math.floor((x - ax) / 2)
        const wy = ay + Math.floor((y - ay + kick) / 2)
        if (wx < 0 || wy < 0 || wx >= W || wy >= H) {
          out.bg[i] = '#000000'
          continue
        }
        const j = wy * W + wx
        const ch = scene.ch[j]!
        const sub = ((x - ax) & 1) !== 0 || ((y - ay + kick) & 1) !== 0
        out.fg[i] = scene.fg[j]!
        out.bg[i] = scene.bg[j]!
        if (ch === '●') {
          // a circle of quarter blocks: 2×2 cells are 4×4 mini pixels
          out.ch[i] = ROUND[((y - ay + kick) & 1) * 2 + ((x - ax) & 1)]!
          if (scene.hot.has(j)) out.hot.add(i)
        } else if (scene.hot.has(j) || SOLID.has(ch)) {
          // stretch the enemy figure as solid colour, not copies of the glyph
          out.ch[i] = ' '
          out.bg[i] = scene.fg[j]!
          if (scene.hot.has(j)) out.hot.add(i)
        } else out.ch[i] = !sub || TILE.has(ch) ? ch : ' '
        if (d > 0.82) {
          out.ch[i] = ' '
          out.bg[i] = '#050505'
        }
      } else {
        out.ch[i] = scene.ch[i]!
        out.fg[i] = darken(scene.fg[i]!)
        out.bg[i] = darken(scene.bg[i]!)
      }
    }
  const steady = g.zoomT >= diffOf(g).settle
  crosshair(out, W, H, ax, ay, tint || (steady ? '#ff2020' : '#aa5050'), rx - 3, 2)
  // ballistic computer: where the bullet really lands with the wind
  if (g.wind) put(out, W, H, ax + g.wind * 2, ay, '•', '#ffe14d')
  return out
}

// Thermal: everything cold in three shades of blue, warm things glow yellow
const lumCache = new Map<string, number>()
const lum = (c: string) => {
  let v = lumCache.get(c)
  if (v === undefined) {
    const [r, gg, b] = rgb(c)
    v = 0.3 * r! + 0.59 * gg! + 0.11 * b!
    lumCache.set(c, v)
  }
  return v
}
const thermalize = (l: Scene) => {
  for (let i = 0; i < l.ch.length; i++) {
    const h = l.heat.get(i)
    if (h) {
      l.bg[i] = h >= 2 ? '#ffe14d' : h >= 1.5 ? '#ff8a1e' : '#a0306a'
      l.fg[i] = h >= 2 ? '#ff5a1e' : '#ffd0a0'
      continue
    }
    const v = lum(l.bg[i]!)
    l.bg[i] = v < 30 ? '#05061a' : v < 70 ? '#10144a' : '#24206e'
    l.fg[i] = '#3a3a8a'
  }
}

const centerText = (l: Layer, W: number, H: number, y: number, text: string, fg: string, bg: string) => {
  const x0 = Math.floor((W - text.length) / 2)
  for (let i = 0; i < text.length; i++) put(l, W, H, x0 + i, y, text[i]!, fg, bg)
}

const acc = (g: Game) => (g.shots ? Math.round((g.hits / g.shots) * 100) : 0)

const overlay = (g: Game, l: Layer) => {
  const { W, H } = g
  const lines: [string, string][] = []
  g.menuY = -1
  if (g.askStar && g.phase === 'intro') {
    lines.push([tx(g).starTitle, '#7dff6b'])
    lines.push(['', ''])
    for (const line of tx(g).starText) lines.push([line, '#e0e0e0'])
    lines.push(['', ''])
    lines.push([tx(g).starHint, '#ffe14d'])
    lines.push([tx(g).lang, '#9ad1ff'])
  } else if (g.confirm && g.saved) {
    lines.push([tx(g).confirmTitle, '#ff4040'])
    lines.push(['', ''])
    lines.push([tx(g).confirmLoss(g.saved), '#e0e0e0'])
    lines.push(['', ''])
    lines.push([tx(g).confirmHint, '#ffe14d'])
  } else if (g.phase === 'intro') {
    lines.push(['◎  SNIPER 2026  ◎', '#2ef2ff'])
    lines.push(['', ''])
    const t = tx(g)
    for (const line of t.intro) lines.push([line, '#e0e0e0'])
    lines.push(['', ''])
    lines.push([t.difficulty, '#aab0c0'])
    DIFFS.forEach((d, i) => lines.push([`${i === g.diff ? '▶' : ' '} ${i + 1}. ${t.diffs[i]!.name.padEnd(13)}`, i === g.diff ? d.color : '#7d8590']))
    lines.push([t.diffs[g.diff]!.hint, diffOf(g).color])
    lines.push(['', ''])
    // with a save the main action continues it; a new game is a separate key
    const sv = g.saved
    if (sv) {
      lines.push([t.resume(sv), '#7dff6b'])
      lines.push([t.newGame, '#ffe14d'])
    } else lines.push([t.start, '#ffe14d'])
    lines.push([t.lang, '#9ad1ff'])
  } else if (g.phase === 'won') {
    lines.push([tx(g).levelDone(g.level), '#7dff6b'])
    lines.push([g.reason, '#e0e0e0'])
    lines.push([tx(g).scoreAcc(g.score, acc(g)), '#e0e0e0'])
    lines.push(['', ''])
    lines.push([tx(g).nextHint, '#ffe14d'])
  } else if (g.phase === 'lost') {
    lines.push([tx(g).failed, '#ff4040'])
    lines.push([g.reason, '#e0e0e0'])
    lines.push([tx(g).failedStats(g.level, g.stage + 1, g.stages, g.score, g.best), '#e0e0e0'])
    lines.push(['', ''])
    lines.push([tx(g).failedHint(!!g.saved), '#ffe14d'])
  } else if (g.paused) {
    lines.push([tx(g).paused, '#ffe14d'])
    lines.push([tx(g).pauseHint, '#e0e0e0'])
  } else {
    if (g.bannerMs > 0 && g.banner) centerText(l, W, H, 1, ` ${g.banner} `, g.bannerColor, '#0d0f1a')
    return
  }
  const w = Math.min(W - 2, Math.max(...lines.map(([t]) => t.length)) + 6)
  const y0 = Math.max(0, Math.floor((H - lines.length) / 2) - 1)
  const x0 = Math.floor((W - w) / 2)
  for (let y = y0; y < y0 + lines.length + 2; y++) for (let x = x0; x < x0 + w; x++) put(l, W, H, x, y, ' ', '#ffffff', '#0d0f1a')
  lines.forEach(([t, c], i) => centerText(l, W, H, y0 + 1 + i, t, c, '#0d0f1a'))
  // row of the first menu item — a click there picks the difficulty
  if (g.phase === 'intro') g.menuY = y0 + 1 + 9
}

// ---------- rows for the tree ----------

type Span = { text: string; fg: string; bg: string }
type Item = { text: string; fg?: string; bg?: string }
type Row = { fg: string; bg: string; items: Item[] }

const rowSpans = (l: Layer, W: number, y: number): Span[] => {
  const spans: Span[] = []
  for (let x = 0; x < W; x++) {
    const i = y * W + x
    const ch = l.ch[i]!
    const fg = ch === ' ' ? '' : l.fg[i]!
    const last = spans[spans.length - 1]
    if (last && last.bg === l.bg[i] && (last.fg === fg || fg === '' || last.fg === '')) {
      last.text += ch
      if (last.fg === '') last.fg = fg
    } else spans.push({ text: ch, fg, bg: l.bg[i]! })
  }
  return spans
}

// row colours are the most frequent ones; matching spans become plain text
const toRow = (spans: Span[]): Row => {
  const bgs = new Map<string, number>()
  for (const s of spans) bgs.set(s.bg, (bgs.get(s.bg) ?? 0) + 1)
  const bg = [...bgs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#000000'
  const fgs = new Map<string, number>()
  for (const s of spans) if (s.fg && s.bg === bg) fgs.set(s.fg, (fgs.get(s.fg) ?? 0) + 1)
  const fg = [...fgs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#ffffff'
  const items: Item[] = []
  for (const s of spans) {
    const it: Item = { text: s.text, fg: !s.fg || s.fg === fg ? undefined : s.fg, bg: s.bg === bg ? undefined : s.bg }
    const last = items[items.length - 1]
    if (last && last.fg === it.fg && last.bg === it.bg) last.text += it.text
    else items.push(it)
  }
  return { fg, bg, items }
}

// rough size of a row in the serialized tree
const rowCost = (r: Row) => r.items.reduce((n, it) => n + it.text.length + (it.fg || it.bg ? 42 + (it.fg ? 22 : 0) + (it.bg ? 30 : 0) : 4), 110)

const ZOOM_W = 16 // width of the zoom button in the HUD

const hud = (g: Game): Span[] => {
  const bg = g.hurt > 0 ? '#5a0d0d' : '#0d0f1a'
  const d = diffOf(g)
  const t = tx(g)
  const hearts = '♥'.repeat(Math.max(0, g.hp)) + '♡'.repeat(Math.max(0, d.hp - g.hp))
  const ammo = g.ammo <= 12 ? '▮'.repeat(g.ammo) : `▮×${g.ammo}`
  const parts: [string, string][] = [
    [' ◎ SNIPER ', '#2ef2ff'],
    [`│ ${t.diffs[g.diff]!.name} `, d.color],
    [t.hudLevel(g.level, g.stage + 1, g.stages), '#aab0c0'],
    [t.hudTargets(g.killed, g.toKill), '#e0e0e0'],
    [t.hudAmmo, '#aab0c0'],
    [ammo || '—', g.ammo <= 2 ? '#ff5050' : '#ffe14d'],
    [g.ap ? t.hudAp(g.ap, g.apOn) : '', g.apOn ? '#ff8a1e' : '#b07a4a'],
    [' │ ', '#aab0c0'],
    [hearts, '#ff4d6d'],
    [g.level >= 2 ? ` │ ${g.focusT > 0 ? t.hudFocusOn : g.focus >= 1 ? t.hudFocusReady : `${t.hudFocus} ${'▮'.repeat(Math.floor(g.focus * 3))}${'▯'.repeat(3 - Math.floor(g.focus * 3))}`}` : '', g.focus >= 1 || g.focusT > 0 ? '#2ef2ff' : '#5a7a8a'],
    [g.level >= 3 ? ` │ ${t.hudHeat} ${'▮'.repeat(Math.ceil(g.battery / 1250))}` : '', g.thermal ? '#ffb02e' : '#8a6a4a'],
    [g.wind ? ` │ ${t.hudWind} ${g.wind < 0 ? '←'.repeat(-g.wind) : '→'.repeat(g.wind)}` : '', '#9ad1ff'],
    [t.hudScore(g.score), '#e0e0e0'],
    [t.hudBest(g.best), '#7d8590'],
    [g.cooldown > 0 && g.phase === 'play' ? t.hudReloading : '', '#ffb02e'],
    [g.slow > 0 ? '│ SLOW-MO ' : '', '#ff3df2'],
    [!g.sound ? t.hudSoundOff : !g.music ? t.hudMusicOff : '', '#7d8590'],
  ]
  const spans: Span[] = []
  let used = 0
  for (const [text, fg] of parts) {
    if (!text || used + text.length > g.W - ZOOM_W) continue
    spans.push({ text, fg, bg })
    used += text.length
  }
  // zoom button on the right — it is clickable
  const label = g.zoom ? (g.zoomT >= d.settle ? '◎ ZOOM 2× [Z]' : '◎ ZOOM …  [Z]') : t.zoomBtn
  spans.push({ text: ' '.repeat(Math.max(0, g.W - used - ZOOM_W)), fg: '#ffffff', bg })
  spans.push({ text: ` ${label} `.padEnd(ZOOM_W), fg: g.zoom ? '#0d0f1a' : '#ff5050', bg: g.zoom ? '#ff4040' : '#2a0d12' })
  return spans
}


const frame = (g: Game): Row[] => {
  const { W, H } = g
  const l = view(g)
  if (g.hurt > 0) {
    // wounded: the screen edges go red
    for (let x = 0; x < W; x++)
      for (const y of [0, H - 1]) {
        const i = y * W + x
        l.bg[i] = mix(l.bg[i]!, '#ff0000', 0.5)
      }
    for (let y = 0; y < H; y++)
      for (const x of [0, W - 1]) {
        const i = y * W + x
        l.bg[i] = mix(l.bg[i]!, '#ff0000', 0.5)
      }
  }
  if (g.focusT > 0) {
    // focus: time slows, the screen edges go cyan
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) l.bg[y * W + x] = mix(l.bg[y * W + x]!, '#2ef2ff', 0.45)
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) l.bg[y * W + x] = mix(l.bg[y * W + x]!, '#2ef2ff', 0.45)
  }
  if (g.flash > 0 && !g.zoom) put(l, W, H, ...aim(g), '*', '#ffffff')
  overlay(g, l)
  const rows: Row[] = [toRow(hud(g))]
  for (let y = 0; y < H; y++) rows.push(toRow(rowSpans(l, W, y)))
  return rows
}

// ---------- component ----------

// At most ~4400 cells: otherwise a frame exceeds the tree limit (100k characters)
const MAX_CELLS = 4400
const MAX_ROWS = 44

const Game: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const SW = surface.columns
  const H = Math.min(surface.rows - 2, MAX_ROWS)
  const W = Math.min(SW, Math.floor(MAX_CELLS / Math.max(1, H)))
  const best = props?.best ?? 0

  if (W < 50 || H < 14) {
    if (!surface.state && W > 0) init(surface, W, H, best, props?.save ?? null, props?.lang === 'ru' ? 'ru' : 'en', !!props?.askStar)
    return (
      <Box flexDirection="column" padding={1} width={Math.max(1, W)} height={Math.max(1, surface.rows)}>
        <Text color="#2ef2ff">◎ SNIPER 2026</Text>
        <Text dimColor>{TEXTS[props?.lang ?? 'en'].tooSmall(W, H + 2)}</Text>
      </Box>
    )
  }

  const st = surface.state ?? init(surface, W, H, best, props?.save ?? null, props?.lang === 'ru' ? 'ru' : 'en', !!props?.askStar)
  const g = st.g
  if (g.W !== W || g.H !== H) {
    // the size changed — rebuild the street and restart the stage
    g.W = W
    g.H = H
    g.ax = clamp(g.ax, 0, W - 1)
    g.ay = clamp(g.ay, 0, H - 1)
    const phase = g.phase
    g.enemies = []
    buildStreet(g)
    startStage(g, Math.min(g.stage, g.stages - 1))
    if (phase !== 'play' && phase !== 'move' && phase !== 'clear') g.phase = phase
  }
  if (best > g.best) g.best = best
  g.offX = Math.floor((SW - W) / 2)

  const rows = frame(g)

  return (
    <Box flexDirection="column" width={SW} height={surface.rows} alignItems="center">
    <Box flexDirection="column" width={W} height={H + 2}>
      {rows.map(row => (
        <Text wrap="truncate" color={row.fg} backgroundColor={row.bg}>
          {row.items.map(it => (it.fg || it.bg ? <Text color={it.fg} backgroundColor={it.bg}>{it.text}</Text> : it.text))}
        </Text>
      ))}
      <Text wrap="truncate" dimColor>
        {tx(g).help}
      </Text>
    </Box>
    </Box>
  )
}

// One post per frame: the engine keeps only the last one,
// so sounds, music, best score and save go together.
const flushPost = (g: Game, post: (d: unknown) => void) => {
  const fighting = g.phase === 'play' || g.phase === 'move' || g.phase === 'clear'
  const music = g.music && g.sound && fighting && !g.paused && !g.confirm ? 'on' : 'off'
  if (!g.sfx.length && music === g.sent && g.bestPending < 0 && g.savePending === undefined && !g.langPending && g.starPending === undefined) return
  const msg: { sfx?: string[]; music: boolean; best?: number; save?: Save | null; lang?: Lang; star?: boolean } = { music: music === 'on' }
  if (g.starPending !== undefined) msg.star = g.starPending
  g.starPending = undefined
  if (g.langPending) msg.lang = g.lang
  g.langPending = false
  if (g.sfx.length && g.sound) msg.sfx = [...new Set(g.sfx)]
  if (g.bestPending >= 0) msg.best = g.bestPending
  if (g.savePending !== undefined) msg.save = g.savePending
  g.sfx = []
  g.sent = music
  g.bestPending = -1
  g.savePending = undefined
  post(msg)
}

const init = (surface: ClientSurface<State>, W: number, H: number, best: number, save: Save | null, lang: Lang, askStar: boolean): State => {
  const g = newGame(Math.max(W, 50), Math.max(H, 14), best, (Date.now() & 0xffffffff) >>> 0)
  g.saved = save
  g.askStar = askStar
  g.lang = lang
  const first: State = { g, frame: 0 }
  surface.setState(first)
  const cur = () => (surface.state ?? first).g
  const post = (d: unknown) => surface.post(d as never)
  const redraw = () => surface.setState({ g: cur(), frame: (surface.state?.frame ?? 0) + 1 })

  surface.every(50, () => {
    tick(cur(), 50)
    flushPost(cur(), post)
    redraw()
  })

  const primary = () => {
    const g = cur()
    if ((g.phase === 'won' || g.phase === 'lost') && g.time - g.endT < 800) return
    // a new game starts only from the menu; after a loss the stage is retried
    if (g.phase === 'intro' && !g.saved) fresh(g)
    else if (g.phase === 'intro' || g.phase === 'lost') {
      if (g.saved) resume(g)
      else g.phase = 'intro'
    } else if (g.phase === 'won') startLevel(g, g.level + 1)
    else if (g.phase === 'play' && !g.paused) shoot(g)
  }
  const toggleZoom = () => {
    const g = cur()
    if (g.phase !== 'play' || g.paused) return
    g.zoom = !g.zoom
    g.sfx.push('zoom')
    g.zoomT = 0
  }

  surface.onPointer((e: ClientPointerEvent) => {
    const g = cur()
    const ex = e.x - g.offX
    if ((e.type === 'move' || e.type === 'down') && e.y >= 1) {
      g.ax = clamp(ex, 0, g.W - 1)
      g.ay = clamp(e.y - 1, 0, g.H - 1)
    }
    if (e.type === 'down') {
      const row = e.y - 1 - g.menuY
      if (e.y === 0 && ex >= g.W - ZOOM_W) toggleZoom()
      else if (g.confirm || g.askStar) {
        // a click does not answer the question: an accidental one must not wipe the save
      } else if (g.phase === 'intro' && g.menuY >= 0 && row >= 0 && row < DIFFS.length) {
        g.diff = row
        fresh(g)
      } else if (e.button === 'right') toggleZoom()
      else if (e.y >= 1) primary()
    }
    redraw()
  })

  surface.onKey((e: ClientKeyEvent) => {
    const g = cur()
    const k = e.key.toLowerCase()
    if (konami(g, k)) return redraw()
    const step = e.shift ? 4 : 1
    const n = Number(k)
    // Cyrillic letters are the same physical keys on a Russian layout
    if (g.askStar) {
      if (k === 'y' || k === 'н' || k === 'n' || k === 'т') {
        g.starPending = k === 'y' || k === 'н'
        g.askStar = false
      } else if (k === 'l' || k === 'д') {
        g.lang = g.lang === 'en' ? 'ru' : 'en'
        g.langPending = true
      }
    } else if (g.confirm) {
      if (k === 'y' || k === 'н') begin(g)
      else if (k === 'n' || k === 'т') g.confirm = false
    } else if ((k === 'c' || k === 'с') && (g.phase === 'intro' || g.phase === 'lost') && g.saved) resume(g)
    else if ((k === 'n' || k === 'т') && g.phase === 'intro') fresh(g)
    else if (g.phase === 'intro' && n >= 1 && n <= DIFFS.length) {
      g.diff = n - 1
      fresh(g)
    } else if (g.phase === 'intro' && k === 'up') g.diff = Math.max(0, g.diff - 1)
    else if (g.phase === 'intro' && k === 'down') g.diff = Math.min(DIFFS.length - 1, g.diff + 1)
    else if ((k === 'm' || k === 'ь') && (g.phase === 'won' || g.phase === 'lost')) g.phase = 'intro'
    else if (k === 'l' || k === 'д') {
      g.lang = g.lang === 'en' ? 'ru' : 'en'
      g.langPending = true
    } else if (k === 'b' || k === 'и') g.music = !g.music
    else if (k === 's' || k === 'ы') g.sound = !g.sound
    else if (k === 'left') g.ax = clamp(g.ax - step * 2, 0, g.W - 1)
    else if (k === 'right') g.ax = clamp(g.ax + step * 2, 0, g.W - 1)
    else if (k === 'up') g.ay = clamp(g.ay - step, 0, g.H - 1)
    else if (k === 'down') g.ay = clamp(g.ay + step, 0, g.H - 1)
    else if (k === ' ' || k === 'space' || k === 'return') primary()
    else if (k === 'z' || k === 'я') toggleZoom()
    else if ((k === 'f' || k === 'а') && g.phase === 'play' && g.focus >= 1 && !g.paused) {
      g.focus = 0
      g.focusT = 2500
      g.sfx.push('focus')
    } else if ((k === 'a' || k === 'ф') && g.phase === 'play' && !g.paused) {
      if (g.ap > 0) g.apOn = !g.apOn
      g.sfx.push(g.ap > 0 ? 'reload' : 'empty')
    } else if ((k === 't' || k === 'е') && g.phase === 'play' && g.level >= 3 && !g.paused) {
      if (g.thermal || g.battery > 300) g.thermal = !g.thermal
      g.sfx.push('zoom')
    } else if (k === 'p' || k === 'з') {
      if (g.phase === 'play') g.paused = !g.paused
    } else if ((k === 'n' || k === 'т') && g.phase === 'won') startLevel(g, g.level + 1)
    redraw()
  })

  return first
}

// ↑↑↓↓←→←→BA: rainbow tracers and +10 ammo, once per game
const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a']
const konami = (g: Game, k: string) => {
  g.keys = [...g.keys, k === 'и' ? 'b' : k === 'ф' ? 'a' : k].slice(-KONAMI.length)
  if (g.rainbow || g.keys.join() !== KONAMI.join()) return false
  // B and A are game keys too: undo the music toggle B made, A is swallowed
  g.music = !g.music
  g.rainbow = true
  g.ammo += 10
  g.sfx.push('pickup')
  showBanner(g, tx(g).konami, '#ff3df2', 3000)
  return true
}

const begin = (g: Game) => {
  g.confirm = false
  restart(g)
  g.phase = 'play'
}

// a new game overwrites the save: ask first when there is progress to lose
const fresh = (g: Game) => {
  const sv = g.saved
  if (sv && (sv.level > 1 || sv.stage > 0 || sv.score > 0)) {
    g.confirm = true
    g.zoom = false
  } else begin(g)
}

const restart = (g: Game) => {
  g.armed = true
  g.score = 0
  g.shots = 0
  g.hits = 0
  g.ap = 0
  g.apOn = false
  g.heads = 0
  startLevel(g, 1)
}

// continue from the saved stage
const resume = (g: Game) => {
  const sv = g.saved
  if (!sv) return
  g.armed = true
  g.diff = sv.diff
  g.score = sv.score
  g.shots = sv.shots
  g.hits = sv.hits
  g.ap = sv.ap ?? 0
  g.apOn = false
  g.heads = 0
  startLevel(g, sv.level, sv.stage)
  g.hp = Math.max(1, Math.min(sv.hp, diffOf(g).hp))
  checkpoint(g, { ...sv, stage: g.stage, hp: g.hp })
}

// for offline checks
export const _debug = { newGame, tick, frame, shoot, begin, startLevel, rowCost, visibleCells }

export default Game
