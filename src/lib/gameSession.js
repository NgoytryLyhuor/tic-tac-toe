import mqtt from 'mqtt'
import {
  applyMove,
  createRoom,
  hashId,
  normalizeCode,
  normalizeName,
  requestRematch,
  resetForWaiting,
  seatGuest,
  toWireRoom,
} from './gameLogic.js'

/**
 * Free public MQTT relays over secure WebSockets. No account, no server, no database.
 * The first player to enter a code becomes the host; the second joins as the guest.
 */
export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://mqtt-dashboard.com:8884/mqtt',
]

const TOPIC_PREFIX = 'tictactoe-mini/v1/room/'
const PROBE_DELAY = 1600
const HEARTBEAT_MS = 2000
const PING_MS = 5000
const HOST_SILENCE_MS = 9000
const GUEST_SILENCE_MS = 15000

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '')
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export class GameSession {
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

    try {
      const { client, index } = await this.connectBroker(preferredBroker)
      if (this.stopped) {
        try {
          client.end(true)
        } catch {
          /* ignore */
        }
        return
      }

      this.client = client
      this.brokerIndex = index
      this.onBroker(index)
      this.attachClient()
      this.onStatus('probing')
      this.subscribe(() => this.sendHello())

      this.probeTimer = this.setTimer(() => {
        if (!this.isHost && !this.room && !this.rejected) this.becomeHost()
      }, PROBE_DELAY)

      this.setInterval(() => this.tick(), PING_MS)
      this.setInterval(() => this.watch(), 2000)
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
        clientId: `ttt_${this.playerId.slice(0, 6)}_${randomId().slice(0, 10)}`,
        clean: true,
        reconnectPeriod: 1500,
        connectTimeout: 7000,
        keepalive: 30,
        protocolVersion: 4,
      })

      client.on('error', () => {
        /* keep a permanent handler so teardown can never crash */
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
          } catch {
            /* ignore */
          }
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
    if (!this.client || !this.client.connected) return
    const message = { ...payload, from: this.instanceId, at: Date.now() }
    try {
      this.client.publish(this.topic, JSON.stringify(message), { qos })
    } catch {
      /* ignore */
    }
  }

  publishState() {
    if (!this.isHost || !this.room) return
    this.publish({ type: 'state', room: toWireRoom(this.room) }, 1)
  }

  emitState() {
    if (!this.room) return
    this.onState({ ...toWireRoom(this.room), you: 'X' })
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
          this.onError(message.message || 'Something went wrong.')
        }
        break
      case 'full':
        if (message.to && message.to !== this.playerId) return
        this.rejected = true
        this.clearProbe()
        this.room = null
        this.onState(null)
        this.onStatus('closed')
        this.onError('This match is already full. Ask your friend for a new code.')
        break
      case 'closed':
        if (this.isHost) return
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
      // Both devices picked the same code at the same time. Smallest token wins.
      if (token < this.hostToken) this.demote()
      return
    }

    if (this.hostTokenSeen && token && token > this.hostTokenSeen) return
    if (token) this.hostTokenSeen = token

    const mySeat = hashId(this.playerId)
    const seated = !wire.seatO || wire.seatO === mySeat

    if (!seated) {
      // Someone else is already seated as O. The host will answer our hello.
      return
    }

    this.rejected = false
    this.offline = false
    this.lastStateAt = Date.now()
    this.room = { ...wire, you: 'O' }
    this.onState(this.room)
    this.onStatus('guest')

    if (wire.status === 'waiting') this.sendHello()
  }

  handleHello(message) {
    if (!this.isHost || !this.room) return
    if (!message.playerId || message.playerId === this.playerId) return

    this.guestLastSeen = Date.now()
    this.room.opponentOnline = true

    if (this.room.players.O && this.room.players.O.id === message.playerId) {
      this.publishState()
      return
    }

    if (!this.room.players.O) {
      seatGuest(this.room, message.playerId, message.name)
      this.emitState()
      this.publishState()
      return
    }

    this.publish({ type: 'full', to: message.playerId }, 1)
  }

  handleGuestMove(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players.O || message.playerId !== this.room.players.O.id) return

    this.guestLastSeen = Date.now()
    this.room.opponentOnline = true

    const result = applyMove(this.room, 'O', message.cell)
    if (!result.ok) {
      this.publish({ type: 'error', to: message.playerId, message: result.error }, 1)
      return
    }

    this.emitState()
    this.publishState()
  }

  handleGuestRematch(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players.O || message.playerId !== this.room.players.O.id) return
    if (!requestRematch(this.room, 'O').ok) return

    this.emitState()
    this.publishState()
  }

  handleGuestLeave(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players.O || message.playerId !== this.room.players.O.id) return

    resetForWaiting(this.room)
    this.emitState()
    this.publishState()
  }

  handlePing(message) {
    if (!this.isHost || !this.room) return
    if (!this.room.players.O || message.playerId !== this.room.players.O.id) return
    this.guestLastSeen = Date.now()
  }

  becomeHost() {
    if (this.isHost || this.stopped || this.rejected) return

    this.clearProbe()
    this.isHost = true
    this.hostToken = randomId()
    this.room = createRoom(this.code, this.playerId, this.name, this.hostToken)
    this.room.opponentOnline = false
    this.emitState()
    this.publishState()
    this.startHeartbeat()
    this.onStatus('hosting')
  }

  demote() {
    this.isHost = false
    this.room = null
    this.hostToken = ''
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
        Boolean(this.room.players.O) &&
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

  move(cell) {
    if (!this.room) return { ok: false, error: 'Not connected to a match yet.' }

    if (this.isHost) {
      const result = applyMove(this.room, 'X', cell)
      if (!result.ok) return result
      this.emitState()
      this.publishState()
      return { ok: true }
    }

    this.publish({ type: 'move', playerId: this.playerId, cell }, 1)
    return { ok: true }
  }

  rematch() {
    if (!this.room) return { ok: false, error: 'Not connected to a match yet.' }

    if (this.isHost) {
      const result = requestRematch(this.room, 'X')
      if (!result.ok) return result
      this.emitState()
      this.publishState()
      return { ok: true }
    }

    this.publish({ type: 'rematch', playerId: this.playerId }, 1)
    return { ok: true }
  }

  leave() {
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
        } catch {
          /* ignore */
        }
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
  }

  pageHide() {
    // A guest refresh should keep its seat, so only the host announces a close.
    if (this.isHost) this.publish({ type: 'closed' }, 0)
  }

  stop() {
    const client = this.client
    this.stopped = true
    this.clearTimers()

    if (client) {
      try {
        client.end(true)
      } catch {
        /* ignore */
      }
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
