import vine from '@vinejs/vine'

// ============================================
// PRODUCT VALIDATORS
// ============================================

export const createProductValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    price: vine.number().min(0).decimal([0, 2]),
    currentStock: vine.number().withoutDecimals().min(0).optional(),
    minimumStock: vine.number().withoutDecimals().min(0).optional(),
    note: vine.string().trim().maxLength(1000).optional(),
    image: vine.file({ extnames: ['jpg', 'png', 'jpeg', 'webp'], size: '5mb' }).optional(),
  })
)

export const updateProductValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    price: vine.number().min(0).decimal([0, 2]).optional(),
    minimumStock: vine.number().withoutDecimals().min(0).optional(),
    note: vine.string().trim().maxLength(1000).nullable().optional(),
    isActive: vine.boolean().optional(),
  })
)

export const adjustStockValidator = vine.create(
  vine.object({
    changeAmount: vine.number().withoutDecimals(),
    type: vine.enum(['manual_add', 'manual_deduct', 'adjustment'] as const),
    note: vine.string().trim().maxLength(1000).optional(),
  })
)

export const listProductsValidator = vine.create(
  vine.object({
    page: vine.number().withoutDecimals().min(1).optional(),
    pageSize: vine.number().withoutDecimals().min(1).max(100).optional(),
  })
)
