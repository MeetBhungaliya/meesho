import ProcessImageShippingPrices from '#jobs/process_image_shipping_prices'
import { globals } from '#libs/globals'
import ShippingPrice from '#models/shipping_price'
import {
  deleteImagesValidator,
  getImagesValidator,
  retryImagesValidator,
  uploadImagesParamsValidator,
  uploadImagesValidator,
} from '#validators/image'
import type { HttpContext } from '@adonisjs/core/http'

export default class ImagesController {
  async index({ request, auth, params }: HttpContext) {
    const { accountId } = await request.validateUsing(uploadImagesParamsValidator, { data: params })
    const payload = await request.validateUsing(getImagesValidator)

    const page = payload.page || 1
    const limit = payload.limit || 20

    const query = ShippingPrice.query()
      .whereHas('account', (q) => {
        q.where('userId', auth.user!.id)
      })
      .where('accountId', accountId)
      .select(
        'id',
        'accountId',
        'imagePath',
        'batchName',
        'meeshoImageUrl',
        'price',
        'isProcessed',
        'errorMessage',
        'createdAt',
        'updatedAt'
      )

    if (payload.ids && payload.ids.length > 0) {
      query.whereIn('id', payload.ids)
    }

    if (payload.batchName) {
      query.where('batchName', payload.batchName)
    }

    if (payload.subSubCategoryId) {
      query.where('subSubCategoryId', payload.subSubCategoryId)
    }

    if (payload.isProcessed !== undefined) {
      query.where('isProcessed', payload.isProcessed)
    }

    if (payload.hasPrice !== undefined) {
      if (payload.hasPrice) {
        query.whereNotNull('price')
      } else {
        query.whereNull('price')
      }
    }

    if (payload.price !== undefined) {
      query.where('price', payload.price)
    }

    if (payload.priceMin !== undefined) {
      query.where('price', '>=', payload.priceMin)
    }
    if (payload.priceMax !== undefined) {
      query.where('price', '<=', payload.priceMax)
    }
    if (payload.priceGt !== undefined) {
      query.where('price', '>', payload.priceGt)
    }
    if (payload.priceLt !== undefined) {
      query.where('price', '<', payload.priceLt)
    }

    const sortBy = payload.sortBy || 'createdAt'
    const sortOrder = payload.sortOrder || 'desc'

    if (sortBy === 'price') {
      query.orderByRaw(`price ${sortOrder} NULLS LAST`)
    } else {
      query.orderBy(sortBy, sortOrder)
    }

    const data = await query.paginate(page, limit)

    return {
      meta: data.getMeta(),
      data: data.all(),
    }
  }

  async upload({ request, auth, params }: HttpContext) {
    const { accountId } = await request.validateUsing(uploadImagesParamsValidator, { data: params })
    const { subSubCategoryId, batchName, images } =
      await request.validateUsing(uploadImagesValidator)

    const imagesArr = Array.isArray(images) ? images : [images]
    const userId = auth.user!.id
    const savedFiles: { path: string; clientName: string }[] = []
    let delayMultiplier = 0

    for (const image of imagesArr) {
      const filePath = globals.getShippingImagePath(userId, image.clientName)
      await image.moveToDisk(filePath, { visibility: 'private' })

      if (image.state === 'moved') {
        savedFiles.push({ path: filePath, clientName: image.clientName })

        const shippingPrice = await ShippingPrice.create({
          accountId: Number(accountId),
          subSubCategoryId: Number(subSubCategoryId),
          imagePath: filePath,
          batchName: batchName ?? null,
        })

        await ProcessImageShippingPrices.dispatch({
          accountId,
          userId,
          subSubCategoryId: Number(subSubCategoryId),
          file: {
            path: filePath,
            clientName: image.clientName,
            shippingPriceId: shippingPrice.id,
          },
        }).in(delayMultiplier * 2000)

        delayMultiplier++
      }
    }

    if (savedFiles.length > 0) {
      return {
        message: 'Upload received, process started in background. Watch your stream for updates.',
      }
    }

    return { message: 'No images were uploaded' }
  }

  async retry({ request, auth, params, response }: HttpContext) {
    const { accountId } = await request.validateUsing(uploadImagesParamsValidator, { data: params })
    const payload = await request.validateUsing(retryImagesValidator)
    const userId = auth.user!.id

    const query = ShippingPrice.query()
      .whereHas('account', (q) => {
        q.where('userId', userId)
      })
      .where('accountId', accountId)
      .select('id', 'accountId', 'subSubCategoryId', 'imagePath')

    if (payload.ids && payload.ids.length > 0) {
      query.whereIn('id', payload.ids)
    }

    if (payload.batchName) {
      query.where('batchName', payload.batchName)
    }

    if (payload.subSubCategoryId) {
      query.where('subSubCategoryId', payload.subSubCategoryId)
    }

    if (payload.hasPrice !== undefined) {
      if (payload.hasPrice) {
        query.whereNotNull('price')
      } else {
        query.whereNull('price')
      }
    }

    const isProcessed = payload.isProcessed ?? false
    query.where('isProcessed', isProcessed)

    const records = await query

    if (records.length === 0) {
      return response.badRequest({ message: 'No matching records found to retry.' })
    }

    await ShippingPrice.query()
      .whereIn(
        'id',
        records.map((r) => r.id)
      )
      .update({ isProcessed: false, errorMessage: null })

    let delayMultiplier = 0

    for (const record of records) {
      await ProcessImageShippingPrices.dispatch({
        accountId: record.accountId,
        userId,
        subSubCategoryId: record.subSubCategoryId,
        file: {
          path: record.imagePath,
          clientName: record.imagePath.split('/').pop() ?? 'image',
          shippingPriceId: record.id,
        },
      }).in(delayMultiplier * 2000)

      delayMultiplier++
    }

    return {
      message: `Retry started for ${records.length} image(s). Watch your stream for updates.`,
      queued: records.length,
    }
  }

  async destroy({ request, auth, params, response }: HttpContext) {
    const { accountId } = await request.validateUsing(uploadImagesParamsValidator, { data: params })
    const payload = await request.validateUsing(deleteImagesValidator)
    const userId = auth.user!.id

    const query = ShippingPrice.query()
      .whereHas('account', (q) => {
        q.where('userId', userId)
      })
      .where('accountId', accountId)
      .select('id', 'imagePath')

    if (payload.ids && payload.ids.length > 0) {
      query.whereIn('id', payload.ids)
    }

    if (payload.batchName) {
      query.where('batchName', payload.batchName)
    }

    if (payload.subSubCategoryId) {
      query.where('subSubCategoryId', payload.subSubCategoryId)
    }

    if (payload.isProcessed !== undefined) {
      query.where('isProcessed', payload.isProcessed)
    }

    if (payload.hasPrice !== undefined) {
      if (payload.hasPrice) {
        query.whereNotNull('price')
      } else {
        query.whereNull('price')
      }
    }

    if (payload.price !== undefined) {
      query.where('price', payload.price)
    }

    if (payload.priceMin !== undefined) {
      query.where('price', '>=', payload.priceMin)
    }
    if (payload.priceMax !== undefined) {
      query.where('price', '<=', payload.priceMax)
    }
    if (payload.priceGt !== undefined) {
      query.where('price', '>', payload.priceGt)
    }
    if (payload.priceLt !== undefined) {
      query.where('price', '<', payload.priceLt)
    }

    const records = await query

    if (records.length === 0) {
      return response.badRequest({ message: 'No matching records found to delete.' })
    }

    const s3 = globals.s3()
    await Promise.allSettled(records.map((record) => s3.delete(record.imagePath)))

    await ShippingPrice.query()
      .whereIn(
        'id',
        records.map((r) => r.id)
      )
      .delete()

    return {
      message: `Deleted ${records.length} record(s) and their S3 files.`,
      deleted: records.length,
    }
  }
}
