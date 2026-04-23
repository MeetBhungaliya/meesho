import type AcceptedOrders from '#events/accepted_orders'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'order:accepted': AcceptedOrders
  }
}
