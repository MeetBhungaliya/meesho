import AcceptOrders from '#jobs/accept_orders'
import AggregateAcceptedOrders from '#jobs/aggregate_accepted_orders'
import { TIMEZONE } from '#services/external_api/constants'

await AcceptOrders.schedule({}).every('5m').run()

await AggregateAcceptedOrders.schedule({}).cron('0 0 * * *').timezone(TIMEZONE).run()
