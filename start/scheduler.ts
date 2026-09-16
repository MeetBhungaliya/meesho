import AcceptOrders from '#jobs/accept_orders'
import MeeshoLabelScheduleReconcileJob from '#jobs/meesho_label/meesho_label_schedule_reconcile_job'

await AcceptOrders.schedule({}).every('15m').run()
await MeeshoLabelScheduleReconcileJob.schedule({}).every('5m').run()
