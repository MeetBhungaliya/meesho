import vine from '@vinejs/vine'

export const uploadImagesParamsValidator = vine.create(
  vine.object({
    accountId: vine.number(),
  })
)

export const uploadImagesValidator = vine.create(
  vine.object({
    subSubCategoryId: vine.number(),
    batchName: vine.string().trim().optional(),
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
    ids: vine.array(vine.number()).optional(),
    batchName: vine.string().trim().optional(),
    subSubCategoryId: vine.number().optional(),
    isProcessed: vine.boolean().optional(),
    hasPrice: vine.boolean().optional(),
    price: vine.number().optional(),
    priceMin: vine.number().min(0).optional(),
    priceMax: vine.number().min(0).optional(),
    priceGt: vine.number().min(0).optional(),
    priceLt: vine.number().min(0).optional(),
    sortBy: vine.enum(['createdAt', 'price', 'updatedAt']).optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
  })
)

export const retryImagesValidator = vine.create(
  vine.object({
    ids: vine.array(vine.number()).optional(),
    batchName: vine.string().trim().optional(),
    subSubCategoryId: vine.number().optional(),
    isProcessed: vine.boolean().optional(),
    hasPrice: vine.boolean().optional(),
  })
)

export const deleteImagesValidator = vine.create(
  vine.object({
    ids: vine.array(vine.number()).optional(),
    batchName: vine.string().trim().optional(),
    subSubCategoryId: vine.number().optional(),
    isProcessed: vine.boolean().optional(),
    hasPrice: vine.boolean().optional(),
    price: vine.number().optional(),
    priceMin: vine.number().min(0).optional(),
    priceMax: vine.number().min(0).optional(),
    priceGt: vine.number().min(0).optional(),
    priceLt: vine.number().min(0).optional(),
  })
)
