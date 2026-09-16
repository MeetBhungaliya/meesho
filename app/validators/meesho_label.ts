import vine from '@vinejs/vine'

export const createManualDownloadValidator = vine.create(
  vine.object({
    accountIds: vine
      .array(
        vine.union([
          vine.union.if((val) => typeof val === 'number', vine.number().positive()),
          vine.union.if((val) => typeof val === 'string', vine.string().trim().minLength(1)),
        ])
      )
      .minLength(1),
    filter: vine.record(vine.any()).optional(),
  })
)

export const createScheduleValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    timezone: vine.string().trim().optional(),
    frequency: vine.enum(['daily', 'weekly', 'custom_cron'] as const),
    runTime: vine
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/),
    daysOfWeek: vine.array(vine.number().min(1).max(7)).optional(),
    cronExpression: vine.string().trim().optional(),
    accountIds: vine
      .array(
        vine.union([
          vine.union.if((val) => typeof val === 'number', vine.number().positive()),
          vine.union.if((val) => typeof val === 'string', vine.string().trim().minLength(1)),
        ])
      )
      .minLength(1),
  })
)

export const updateScheduleValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    timezone: vine.string().trim().optional(),
    frequency: vine.enum(['daily', 'weekly', 'custom_cron'] as const).optional(),
    runTime: vine
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    daysOfWeek: vine.array(vine.number().min(1).max(7)).optional(),
    cronExpression: vine.string().trim().optional(),
    accountIds: vine
      .array(
        vine.union([
          vine.union.if((val) => typeof val === 'number', vine.number().positive()),
          vine.union.if((val) => typeof val === 'string', vine.string().trim().minLength(1)),
        ])
      )
      .optional(),
    enabled: vine.boolean().optional(),
  })
)
