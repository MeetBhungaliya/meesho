import { events } from '#generated/events'
import { listeners } from '#generated/listeners'
import emitter from '@adonisjs/core/services/emitter'

emitter.on(events.AcceptedOrders, [listeners.TrackAcceptedOrders, 'handle'])
