import { DateTime } from 'luxon'

export class MeeshoScheduleHelper {
  /**
   * Calculates the next occurrence DateTime in the specified IANA timezone.
   *
   * @param timezone IANA timezone (e.g. 'Asia/Kolkata')
   * @param frequency 'daily' | 'weekly' | 'custom_cron'
   * @param runTime 'HH:mm' format (e.g. '09:30')
   * @param daysOfWeek Array of weekday numbers (1 = Monday, 7 = Sunday in Luxon)
   * @param fromDate Reference DateTime, defaults to now in the schedule's timezone
   */
  static calculateNextRun(
    timezone: string = 'Asia/Kolkata',
    frequency: string = 'daily',
    runTime: string = '09:30',
    daysOfWeek: number[] | null = null,
    fromDate?: DateTime
  ): DateTime {
    const [hourStr, minuteStr] = runTime.split(':')
    const targetHour = Number.parseInt(hourStr || '9', 10)
    const targetMinute = Number.parseInt(minuteStr || '30', 10)

    const nowInZone = (fromDate || DateTime.now()).setZone(timezone)

    if (frequency === 'daily') {
      let target = nowInZone.set({
        hour: targetHour,
        minute: targetMinute,
        second: 0,
        millisecond: 0,
      })

      // If target time has already passed today, advance to tomorrow
      if (target <= nowInZone) {
        target = target.plus({ days: 1 })
      }
      return target
    }

    if (frequency === 'weekly') {
      const allowedDays =
        Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek : [1, 2, 3, 4, 5, 6, 7]

      // Check up to 14 days ahead to find next matching day of week
      for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
        const candidate = nowInZone.plus({ days: dayOffset }).set({
          hour: targetHour,
          minute: targetMinute,
          second: 0,
          millisecond: 0,
        })

        if (candidate > nowInZone && allowedDays.includes(candidate.weekday)) {
          return candidate
        }
      }

      // Default fallback
      return nowInZone.plus({ days: 1 }).set({
        hour: targetHour,
        minute: targetMinute,
        second: 0,
        millisecond: 0,
      })
    }

    // Default fallback if frequency is unknown
    let target = nowInZone.set({
      hour: targetHour,
      minute: targetMinute,
      second: 0,
      millisecond: 0,
    })
    if (target <= nowInZone) {
      target = target.plus({ days: 1 })
    }
    return target
  }

  /**
   * Calculates the delay in milliseconds from now until the target execution time.
   */
  static calculateDelayMs(targetTime: DateTime): number {
    const nowMs = DateTime.now().toMillis()
    const targetMs = targetTime.toMillis()
    return Math.max(0, targetMs - nowMs)
  }

  /**
   * Creates a deterministic run key for idempotency:
   * e.g. "schedule:1:2026-09-16T09:30:00.000Z"
   */
  static getRunKey(scheduleId: number, scheduledFor: DateTime): string {
    return `schedule:${scheduleId}:${scheduledFor.toUTC().toISO()}`
  }
}
