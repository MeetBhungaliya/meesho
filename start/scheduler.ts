import AcceptOrders from '#jobs/accept_orders'

await AcceptOrders.schedule({}).every('30m').run()
