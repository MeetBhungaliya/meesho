import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { MeeshoScheduleHelper } from '#services/meesho_label/meesho_schedule_helper'

test.group('MeeshoScheduleHelper', () => {
  test('calculates next daily run when current time is before target time', ({ assert }) => {
    // 08:00 AM on 2026-09-16 in Asia/Kolkata
    const refDate = DateTime.fromISO('2026-09-16T08:00:00.000+05:30')
    const nextRun = MeeshoScheduleHelper.calculateNextRun(
      'Asia/Kolkata',
      'daily',
      '09:30',
      null,
      refDate
    )

    assert.equal(nextRun.hour, 9)
    assert.equal(nextRun.minute, 30)
    assert.equal(nextRun.day, 16)
    assert.equal(nextRun.month, 9)
    assert.equal(nextRun.year, 2026)
  })

  test('calculates next daily run as tomorrow when current time is after target time', ({
    assert,
  }) => {
    // 14:00 PM on 2026-09-16 in Asia/Kolkata
    const refDate = DateTime.fromISO('2026-09-16T14:00:00.000+05:30')
    const nextRun = MeeshoScheduleHelper.calculateNextRun(
      'Asia/Kolkata',
      'daily',
      '09:30',
      null,
      refDate
    )

    assert.equal(nextRun.hour, 9)
    assert.equal(nextRun.minute, 30)
    assert.equal(nextRun.day, 17) // Tomorrow
    assert.equal(nextRun.month, 9)
    assert.equal(nextRun.year, 2026)
  })

  test('calculates weekly run for specific days of week (Mon/Wed/Fri)', ({ assert }) => {
    // 2026-09-16 is a Wednesday (weekday 3) at 10:00 AM
    const refDate = DateTime.fromISO('2026-09-16T10:00:00.000+05:30')
    // Target is Mon(1), Wed(3), Fri(5) at 09:30 AM
    // Since 09:30 on Wednesday passed, next must be Friday (2026-09-18)
    const nextRun = MeeshoScheduleHelper.calculateNextRun(
      'Asia/Kolkata',
      'weekly',
      '09:30',
      [1, 3, 5],
      refDate
    )

    assert.equal(nextRun.weekday, 5) // Friday
    assert.equal(nextRun.day, 18)
    assert.equal(nextRun.hour, 9)
    assert.equal(nextRun.minute, 30)
  })

  test('calculateDelayMs returns positive number for future target and 0 for past', ({
    assert,
  }) => {
    const future = DateTime.now().plus({ hours: 2 })
    const past = DateTime.now().minus({ hours: 2 })

    assert.isAbove(MeeshoScheduleHelper.calculateDelayMs(future), 0)
    assert.equal(MeeshoScheduleHelper.calculateDelayMs(past), 0)
  })

  test('getRunKey creates deterministic unique string', ({ assert }) => {
    const target = DateTime.fromISO('2026-09-16T09:30:00.000Z')
    const key = MeeshoScheduleHelper.getRunKey(42, target)

    assert.equal(key, 'schedule:42:2026-09-16T09:30:00.000Z')
  })
})
