import mqtt from 'mqtt'
import {
  applyMovePawn,
  applyPlaceWall,
  createBarricadeRoom,
  hashId,
  normalizeCode,
  normalizeName,
  requestBarricadeRematch,
  resetBarricadeForWaiting,
  seatBarricadeGuest,
  toWireBarricadeRoom,
} from './barricadeLogic.js'
import {
  clearBarricadeHostSession,
  loadBarricadeHostSession,
  saveBarricadeHostSession,
} from './player.js'

export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt-dashboard.com:8884/mqtt',
]

const TOPIC_PREFIX = 'barricade-mini/v1/room/'
const PROBE_DELAY = 1600
const HEARTBEAT_MS = 2000
const PING_MS = 5000
const RETRY_MS = 1500
const HOST_SILENCE_MS = 9000
const GUEST_SILENCE_MS = 15000

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export class BarricadeSession {
  constructor({ playerId, onState, onStatus, onError, onBroker }) {
    this.playerId = playerId
    this.onState = onState || (() => {})
    this.onStatus = onStatus || (() => {})
    this.onError = onError || (() => {})
    this.onBroker = onBroker || (() => {})

    this.client = null
    this.topic = ''
    this.code = ''
    this.name = ''
    this.isHost = false
    this.room = null
    this.hostToken = ''
    this.hostTokenSeen = ''
    this.instanceId = randomId()
    this.brokerIndex = -1
    this.lastStateAt = 0
    this.guestLastSeen = 0
    this.offline = false
    this.rejected = false
    this.stopped = false
    this.generation = 0
    this.pending = null
    this.lastGuestActionId = ''
    this.probeTimer = null
    this.heartbeatTimer = null
    this.timers = new Set()
  }

  async join(code, name, preferredBroker = -1) {
    this.stop()
    this.stopped = false
    this.rejected = false
    this.code = normalizeCode(code)
    this.name = normalizeName(name, 'Player')
    this.topic = TOPIC_PREFIX + this.code
    this.onStatus('connecting')

    // Check if we are resuming an active host session in this browser tab
    const savedHost = loadBarricadeHostSession(this.code)
    if (savedHost && savedHost.hostToken && savedHost.room) {
      this.isHost = true
      this.hostToken = savedHost.hostToken
      this.room = savedHost.room
      this.lastGuestActionId = ''
    }

    try {
      const { client, index } = await this.connectBroker(preferredBroker)
      if (this.stopped) {
        try {
          client.end(true)
        } catch {}
        return
      }

      this.client = client
      this.brokerIndex = index
      this.onBroker(index)
      this.attachClient()

      if (this.isHost && this.room) {
        this.emitState()
        this.onStatus('hosting')
        this.subscribe(() => {
          this.publishState()
          this.startHeartbeat()
        })
      } else {
        this.onStatus('probing')
        this.subscribe(() => this.sendHello())

        this.probeTimer = this.setTimer(() => {
          if (!this.isHost && !this.room && !this.rejected) this.becomeHost()
        }, PROBE_DELAY)
      }

      this.setInterval(() => this.tick(), PING_MS)
      this.setInterval(() => this.watch(), 2000)
      this.setInterval(() => this.sendPending(), RETRY_MS)
    } catch (error) {
      if (this.stopped) return
      this.onStatus('error')
      this.onError(error?.message || 'Could not reach the game relay. Check your connection.')
    }
  }

  async connectBroker(preferredBroker) {
    const order = []
    if (
      Number.isInteger(preferredBroker) &&
      preferredBroker >= 0 &&
      preferredBroker < BROKERS.length
    ) {
      order.push(preferredBroker)
    }
    for (let i = 0; i < BROKERS.length; i += 1) {
      if (!order.includes(i)) order.push(i)
    }

    let lastError = null
    for (const index of order) {
      try {
        const client = await this.tryConnect(BROKERS[index])
        return { client, index }
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('No game relay is reachable right now.')
  }

  tryConnect(url) {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(url, {
        clientId: `barricade_${this.playerId.slice(0, 6)}_${randomId().slice(0, 10)}`,
        clean: true,
        reconnectPeriod: 1500,
        connectTimeout: 7000,
        keepalive: 30,
        protocolVersion: 4,
      })

      client.on('error', () => {
        /* keep permanent handler */
      })

      let settled = false
      const timer = setTimeout(() => finish(new Error('Connection timed out.')), 9000)

      function finish(error, value) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        client.off('connect', onConnect)
        client.off('error', onError)
        if (error) {
          try {
            client.end(true)
          } catch {}
          reject(error)
        } else {
          resolve(value)
        }
      }

      function onConnect() {
        finish(null, client)
      }
      function onError(error) {
        finish(error)
      }

      client.once('connect', onConnect)
      client.once('error', onError)
    })
  }

  attachClient() {
    const client = this.client
    const generation = (this.generation += 1)

    client.on('connect', () => {
      if (this.stopped || this.generation !== generation) return
      this.hostTokenSeen = ''
      this.lastStateAt = Date.now()

      this.subscribe(() => {
        if (this.stopped || this.generation !== generation) return
        if (this.isHost) {
          this.publishState()
          this.onStatus('hosting')
        } else {
          this.sendHello()
          this.onStatus(this.room ? 'guest' : 'probing')
        }
      })
    })

    client.on('reconnect', () => {
      if (!this.stopped && this.generation === generation) this.onStatus('reconnecting')
    })
    client.on('offline', () => {
      if (!this.stopped && this.generation === generation) this.onStatus('offline')
    })
    client.on('close', () => {
      if (!this.stopped && this.generation === generation) this.onStatus('reconnecting')
    })
    client.on('message', (topic, payload) => {
      if (this.stopped || this.generation !== generation) return
      if (topic !== this.topic) return
      this.handleMessage(payload)
    })
  }

  subscribe(callback) {
    if (!this.client) {
      callback?.()
      return
    }
    try {
      this.client.subscribe(this.topic, { qos: 1 }, (error) => {
        if (!error) callback?.()
      })
    } catch {
      callback?.()
    }
  }

  publish(payload, qos = 0) {
    if (!this.client || !this.client.connected) return false
    const message = { ...payload, from: this.instanceId, at: Date.now() }
    try {
      this.client.publish(this.topic, JSON.stringify(message), { qos })
      return true
    } catch {
      return false
    }
  }

  sendPending(force = false) {
    const pending = this.pending
    if (!pending) return
    if (this.isHost || !this.client?.connected) return

    const now = Date.now()
    if (!force && now - pending.sentAt < RETRY_MS - 200) return

    pending.sentAt = now
    pending.attempts += 1

    if (pending.kind === 'move') {
      this.publish(
        {
          type: 'move',
          playerId: this.playerId,
          row: pending.row,
          col: pending.col,
          actionId: pending.id,
        },
        1,
      )
    } else if (pending.kind === 'wall') {
      this.publish(
        {
          type: 'wall',
          playerId: this.playerId,
          row: pending.row,
          col: pending.col,
          orientation: pending.orientation,
          actionId: pending.id,
        },
        1,
      )
    } else if (pending.kind === 'rematch') {
      this.publish({ type: 'rematch', playerId: this.playerId, actionId: pending.id }, 1)
    }
  }

  queuePending(kind, data = {}) {
    if (this.pending && this.pending.kind === kind) return
    this.pending = {
      kind,
      ...data,
      id: randomId(),
      baseVersion: this.room?.version || 0,
      sentAt: 0,
      attempts: 0,
    }
    this.sendPending(true)
  }

  clearPending() {
    this.pending = null
  }

  publishState() {
    if (!this.isHost || !this.room) return
    this.publish({ type: 'state', room: toWireBarricadeRoom(this.room) }, 1)
  }

  emitState() {
    if (!this.room) return
    this.onState({ ...toWireBarricadeRoom(this.room), you: 0 })
  }

  sendHello() {
    if (this.isHost || this.rejected || !this.client?.connected) return
    this.publish({ type: 'hello', playerId: this.playerId, name: this.name }, 1)
  }

  handleMessage(payload) {
    let message
    try {
      message = JSON.parse(payload.toString())
    } catch {
      return
    }
    if (!message || typeof message !== 'object') return
    if (message.from === this.instanceId) return

    switch (message.type) {
      case 'state':
        this.handleState(message)
        break
      case 'hello':
        this.handleHello(message)
        break
      case 'move':
        this.handleGuestMove(message)
        break
      case 'wall':
        this.handleGuestWall(message)
        break
      case 'rematch':
        this.handleGuestRematch(message)
        break
      case 'leave':
        this.handleGuestLeave(message)
        break
      case 'ping':
        this.handlePing(message)
        break
      case 'error':
        if (!message.to || message.to === this.playerId) {
          if (message.actionId && message.actionId === this.pending?.id) {
            if (this.pending.rollback && this.room) {
              if (this.pending.rollback.pawns) this.room.pawns = this.pending.rollback.pawns
              if (this.pending.rollback.walls) this.room.walls = this.pending.rollback.walls
              if (this.pending.rollback.wallsLeft) this.room.wallsLeft = this.pending.rollback.wallsLeft
              if (this.pending.rollback.turn !== undefined) this.room.turn = this.pending.rollback.turn
              this.onState({ ...this.room })
            }
            this.clearPending()
          }
          this.onError(message.message || 'Something went wrong.')
        }
        break
      case 'full':
        if (message.to && message.to !== this.playerId) return
        this.rejected = true
        this.clearProbe()
        this.clearPending()
        this.room = null
        this.onState(null)
        this.onStatus('closed')
        this.onError('This match is already full. Ask your friend for a new code.')
        break
      case 'closed':
        if (this.isHost) return
        this.clearPending()
        this.room = null
        this.onState(null)
        this.onStatus('closed')
        this.onError('Your friend left the match. Enter the code again to start a new one.')
        break
      default:
        break
    }
  }

  handleState(message) {
    const wire = message.room
    if (!wire || wire.code !== this.code) return

    const token = String(wire.hostToken || '')
    this.clearProbe()

    if (this.isHost) {
      if (!token || token === this.hostToken) return
      // Conflict resolution: smaller token wins
      if (token < this.hostToken) this.demote()
      return
    }

    if (this.hostTokenSeen && token && token > this.hostTokenSeen) return
    if (token) this.hostTokenSeen = token

    const mySeat = hashId(this.playerId)
    const seated = !wire.seat1 || wire.seat1 === mySeat

    if (!seated) {
      return
    }

    this.rejected = false
    this.offline = false
    this.lastStateAt = Date.now()
    this.room = { ...wire, you: 1 }

    if (this.pending && Number(wire.version) > this.pending.baseVersion) {
      this.clearPending()
    }

    this.onState(this.room)
    this.onStatus('guest')

    if (wire.status === 'waiting') this.sendHello()
  }

  handleHello(message) {
    if (!this.isHost || !this.room) return
    if (!message.playerId || message.playerId === this.playerId) return

    this.guestLastSeen = Date.now()
    this.room.opponentOnline = true

    if (this.room.players[1] && this.room.players[1].id === message.playerId) {
      this.publishState()
      return
    }

    if (!this.room.players[1]) {
      this.lastGuestActionId = ''
      seatBarricadeGuest(this.room, message.playerId, message.name)
      saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
      this.emitState()
      this.publishState()
      return
    }

    this.publish({ type: 'full', to: message.playerId }, 1)
  }

  handleGuestMove(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players[1] || message.playerId !== this.room.players[1].id) return

    this.guestLastSeen = Date.now()
    this.room.opponentOnline = true

    if (message.actionId && message.actionId === this.lastGuestActionId) {
      this.publishState()
      return
    }

    const result = applyMovePawn(this.room, message.row, message.col)
    if (!result.ok) {
      this.publish(
        {
          type: 'error',
          to: message.playerId,
          message: result.error,
          actionId: message.actionId || null,
        },
        1,
      )
      return
    }

    this.lastGuestActionId = message.actionId || ''
    saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
    this.emitState()
    this.publishState()
  }

  handleGuestWall(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players[1] || message.playerId !== this.room.players[1].id) return

    this.guestLastSeen = Date.now()
    this.room.opponentOnline = true

    if (message.actionId && message.actionId === this.lastGuestActionId) {
      this.publishState()
      return
    }

    const result = applyPlaceWall(this.room, message.row, message.col, message.orientation)
    if (!result.ok) {
      this.publish(
        {
          type: 'error',
          to: message.playerId,
          message: result.error,
          actionId: message.actionId || null,
        },
        1,
      )
      return
    }

    this.lastGuestActionId = message.actionId || ''
    saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
    this.emitState()
    this.publishState()
  }

  handleGuestRematch(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players[1] || message.playerId !== this.room.players[1].id) return

    if (message.actionId && message.actionId === this.lastGuestActionId) {
      this.publishState()
      return
    }

    if (!requestBarricadeRematch(this.room, 1).ok) return

    this.lastGuestActionId = message.actionId || ''
    saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
    this.emitState()
    this.publishState()
  }

  handleGuestLeave(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players[1] || message.playerId !== this.room.players[1].id) return

    this.lastGuestActionId = ''
    resetBarricadeForWaiting(this.room)
    saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
    this.emitState()
    this.publishState()
  }

  handlePing(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players[1] || message.playerId !== this.room.players[1].id) return
    this.guestLastSeen = Date.now()
  }

  becomeHost() {
    if (this.isHost || this.stopped || this.rejected) return

    this.clearProbe()
    this.clearPending()
    this.isHost = true
    this.lastGuestActionId = ''
    this.hostToken = randomId()
    this.room = createBarricadeRoom(this.code, this.playerId, this.name, this.hostToken)
    this.room.opponentOnline = false
    saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
    this.emitState()
    this.publishState()
    this.startHeartbeat()
    this.onStatus('hosting')
  }

  demote() {
    clearBarricadeHostSession(this.code)
    this.isHost = false
    this.room = null
    this.hostToken = ''
    this.lastGuestActionId = ''
    this.clearPending()
    this.stopHeartbeat()
    this.onState(null)
    this.sendHello()
    this.onStatus('probing')
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = this.setInterval(() => {
      if (!this.isHost || !this.room) return

      const online =
        Boolean(this.room.players[1]) &&
        this.guestLastSeen > 0 &&
        Date.now() - this.guestLastSeen < GUEST_SILENCE_MS

      const changed = this.room.opponentOnline !== online
      this.room.opponentOnline = online

      this.publishState()
      if (changed) this.emitState()
    }, HEARTBEAT_MS)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.timers.delete(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  tick() {
    if (this.stopped || this.isHost) return
    this.publish({ type: 'ping', playerId: this.playerId }, 0)
    if (!this.rejected && (!this.room || this.room.status === 'waiting')) this.sendHello()
  }

  watch() {
    if (this.stopped || this.isHost || !this.room || this.offline) return
    if (Date.now() - this.lastStateAt > HOST_SILENCE_MS) {
      this.offline = true
      this.onStatus('offline')
    }
  }

  movePawn(row, col) {
    if (!this.room) return { ok: false, error: 'Not connected to a match yet.' }

    if (this.isHost) {
      if (this.room.turn !== 0) return { ok: false, error: "It's not your turn yet." }
      const result = applyMovePawn(this.room, row, col)
      if (!result.ok) return result
      saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
      this.emitState()
      this.publishState()
      return { ok: true }
    }

    if (this.pending?.kind === 'move') return { ok: true }
    if (this.room.status !== 'playing' || this.room.turn !== 1) {
      return { ok: false, error: "It's not your turn yet." }
    }

    // Optimistic update for guest
    const rollback = {
      pawns: this.room.pawns.map((p) => ({ ...p })),
      turn: this.room.turn,
    }
    const newPawns = this.room.pawns.map((p) => ({ ...p }))
    newPawns[1] = { row, col }
    this.room = {
      ...this.room,
      pawns: newPawns,
      turn: 0,
    }
    this.onState(this.room)

    this.queuePending('move', { row, col, rollback })
    return { ok: true }
  }

  placeWall(row, col, orientation) {
    if (!this.room) return { ok: false, error: 'Not connected to a match yet.' }

    if (this.isHost) {
      if (this.room.turn !== 0) return { ok: false, error: "It's not your turn yet." }
      const result = applyPlaceWall(this.room, row, col, orientation)
      if (!result.ok) return result
      saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
      this.emitState()
      this.publishState()
      return { ok: true }
    }

    if (this.pending?.kind === 'wall') return { ok: true }
    if (this.room.status !== 'playing' || this.room.turn !== 1) {
      return { ok: false, error: "It's not your turn yet." }
    }

    // Optimistic update for guest
    const rollback = {
      walls: this.room.walls.map((w) => ({ ...w })),
      wallsLeft: [...this.room.wallsLeft],
      turn: this.room.turn,
    }
    const newWalls = [...this.room.walls, { row, col, orientation, placedBy: 1 }]
    const newWallsLeft = [...this.room.wallsLeft]
    newWallsLeft[1] = Math.max(0, newWallsLeft[1] - 1)
    this.room = {
      ...this.room,
      walls: newWalls,
      wallsLeft: newWallsLeft,
      turn: 0,
    }
    this.onState(this.room)

    this.queuePending('wall', { row, col, orientation, rollback })
    return { ok: true }
  }

  rematch() {
    if (!this.room) return { ok: false, error: 'Not connected to a match yet.' }

    if (this.isHost) {
      const result = requestBarricadeRematch(this.room, 0)
      if (!result.ok) return result
      saveBarricadeHostSession(this.code, { hostToken: this.hostToken, room: this.room })
      this.emitState()
      this.publishState()
      return { ok: true }
    }

    if (this.pending?.kind === 'rematch') return { ok: true }

    if (this.room && this.room.rematch) {
      this.room = {
        ...this.room,
        rematch: {
          ...this.room.rematch,
          1: true,
        },
      }
      this.onState(this.room)
    }

    this.queuePending('rematch')
    return { ok: true }
  }

  leave() {
    clearBarricadeHostSession(this.code)
    const client = this.client
    if (client) {
      if (this.isHost) this.publish({ type: 'closed' }, 1)
      else this.publish({ type: 'leave', playerId: this.playerId }, 1)
    }

    this.stopped = true
    this.clearTimers()

    if (client) {
      setTimeout(() => {
        try {
          client.end(true)
        } catch {}
      }, 300)
    }

    this.client = null
    this.room = null
    this.isHost = false
    this.hostToken = ''
    this.hostTokenSeen = ''
    this.lastStateAt = 0
    this.guestLastSeen = 0
    this.offline = false
    this.rejected = false
    this.clearPending()
    this.lastGuestActionId = ''
  }

  pageHide() {
    // Avoid sending closed on app switch or minimisation
  }

  stop() {
    const client = this.client
    this.stopped = true
    this.clearTimers()

    if (client) {
      try {
        client.end(true)
      } catch {}
    }

    this.client = null
    this.room = null
    this.isHost = false
    this.hostToken = ''
    this.hostTokenSeen = ''
    this.lastStateAt = 0
    this.guestLastSeen = 0
    this.offline = false
    this.rejected = false
    this.clearPending()
    this.lastGuestActionId = ''
  }

  clearProbe() {
    if (this.probeTimer) {
      clearTimeout(this.probeTimer)
      this.timers.delete(this.probeTimer)
      this.probeTimer = null
    }
  }

  setTimer(fn, ms) {
    const id = setTimeout(fn, ms)
    this.timers.add(id)
    return id
  }

  setInterval(fn, ms) {
    const id = setInterval(fn, ms)
    this.timers.add(id)
    return id
  }

  clearTimers() {
    for (const id of this.timers) {
      clearTimeout(id)
      clearInterval(id)
    }
    this.timers.clear()
    this.probeTimer = null
    this.heartbeatTimer = null
  }
}
