import vine from '@vinejs/vine'

export const uploadImagesParamsValidator = vine.create(
  vine.object({
    accountId: vine.number(),
  })
)

export const uploadImagesValidator = vine.create(
  vine.object({
    sub_sub_category_id: vine.number(),

    images: vine.union([
      vine.union.if(
        (value) => !Array.isArray(value),
        vine.file({ extnames: ['jpg', 'png', 'jpeg', 'webp'] })
      ),
      vine.union.if(
        (value) => Array.isArray(value),
        vine.array(vine.file({ extnames: ['jpg', 'png', 'jpeg', 'webp'] })).minLength(1)
      ),
    ]),
  })
)

export const getImagesValidator = vine.create(
  vine.object({
    page: vine.number().min(1).optional(),
    limit: vine.number().min(1).max(100).optional(),
    accountId: vine.number().optional(),
    subSubCategoryId: vine.number().optional(),
    hasPrice: vine.boolean().optional(),
    sortBy: vine.enum(['createdAt', 'prices', 'updatedAt']).optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional()
  })
)