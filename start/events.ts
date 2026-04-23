import { listeners } from '#generated/listeners'
import emitter from '@adonisjs/core/services/emitter'

emitter.on('order:accepted', [listeners.TrackAcceptedOrders, 'handle'])
