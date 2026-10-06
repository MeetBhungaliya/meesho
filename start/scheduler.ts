import ScheduleMeeshoAdsSyncJob from '#jobs/schedule_meesho_ads_sync'

/**
 * Schedules automatic Meesho Ads background sync for all active accounts.
 * Runs every 30 minutes. ScheduleMeeshoAdsSyncJob discovers all active accounts
 * and dispatches per-account SyncMeeshoAdsAccountJob instances, each protected
 * by a distributed Redis lock to prevent duplicates.
 *
 * Future optimization: differentiate frequency by campaign status
 * (LIVE -> frequent, PAUSED -> lower frequency) by passing statusFilter.
 */
await ScheduleMeeshoAdsSyncJob.schedule({}).every('30m').run()
