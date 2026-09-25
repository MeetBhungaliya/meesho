import { DateTime } from 'luxon'

export class MeeshoScheduleHelper {
  /**
   * Calculates the next occurrence DateTime in the specified IANA timezone.
   *
   * @param timezone IANA timezone (e.g. 'Asia/Kolkata')
   * @param runTime 'HH:mm' format (e.g. '09:30')
   * @param fromDate Reference DateTime, defaults to now in the schedule's timezone
   */
  static calculateNextRun(
    timezone: string = 'Asia/Kolkata',
    runTime: string = '09:30',
    fromDate?: DateTime
  ): DateTime {
    const [hourStr, minuteStr] = runTime.split(':')
    const targetHour = Number.parseInt(hourStr || '9', 10)
    const targetMinute = Number.parseInt(minuteStr || '30', 10)

    const nowInZone = (fromDate || DateTime.now()).setZone(timezone)

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
