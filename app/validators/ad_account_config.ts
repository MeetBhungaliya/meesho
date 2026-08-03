import vine from '@vinejs/vine'

export const upsertAdAccountConfigValidator = vine.create(
  vine.object({
    accountId: vine.number().positive(),
    apiUrl: vine.string().url().maxLength(2048),
    payload: vine.object({}).allowUnknownProperties(),
    dynamicFields: vine.array(vine.string().maxLength(500)).optional(),
  })
)
