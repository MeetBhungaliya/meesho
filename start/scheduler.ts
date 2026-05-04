import AcceptOrders from '#jobs/accept_orders'

await AcceptOrders.schedule({}).every('15m').run()
