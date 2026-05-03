import ProcessImageShippingPrices from '#jobs/process_image_shipping_prices'
import { globals } from '#libs/globals'
import ShippingPrice from '#models/shipping_price'
import { getImagesValidator, uploadImagesParamsValidator, uploadImagesValidator } from '#validators/image'
import { HttpContext } from '@adonisjs/core/http'

export default class ImagesController {
  async index({ request, auth }: HttpContext) {
    const payload = await request.validateUsing(getImagesValidator)

    const page = payload.page || 1
    const limit = payload.limit || 20

    const query = ShippingPrice.query()
      .whereHas('account', (q) => {
        q.where('userId', auth.user!.id)
      })

    if (payload.accountId) {
      query.where('accountId', payload.accountId)
    }

    if (payload.subSubCategoryId) {
      query.where('subSubCategoryId', payload.subSubCategoryId)
    }

    if (payload.hasPrice !== undefined) {
      if (payload.hasPrice) {
        query.whereNotNull('prices')
      } else {
        query.whereNull('prices')
      }
    }

    if (payload.prices !== undefined) {
      query.where('prices', payload.prices)
    }

    const sortBy = payload.sortBy || 'createdAt'
    const sortOrder = payload.sortOrder || 'desc'

    if (sortBy === 'prices') {
      query.orderByRaw(`prices ${sortOrder} NULLS LAST`)
    } else {
      query.orderBy(sortBy, sortOrder)
    }

    const images = await query.paginate(page, limit)

    const serializedImages = await Promise.all(
      images.all().map(async (img) => {
        const url = await globals.s3().getSignedUrl(img.imagePath, { expiresIn: 60 * 60 })
        return {
          ...img.serialize(),
          url,
        }
      })
    )

    return {
      meta: images.getMeta(),
      data: serializedImages,
    }
  }

  async upload({ request, auth, params }: HttpContext) {
    const { accountId } = await request.validateUsing(uploadImagesParamsValidator, { data: params })
    const { sub_sub_category_id, images } = await request.validateUsing(uploadImagesValidator)

    const imagesArr = Array.isArray(images)
      ? images
      : [images]

    const userId = auth.user!.id

    const savedFiles: { path: string; clientName: string }[] = []
    let delayMultiplier = 0

    for (const image of imagesArr) {
      const filePath = globals.getShippingImagePath(userId, image.clientName)
      await image.moveToDisk(filePath, { visibility: 'private' })

      if (image.state === 'moved') {
        savedFiles.push({
          path: filePath,
          clientName: image.clientName,
        })
        
        const shippingPrice = await ShippingPrice.create({
          accountId: Number(accountId),
          subSubCategoryId: Number(sub_sub_category_id),
          imagePath: filePath,
        })

        const jobPayload = {
          accountId,
          userId,
          sub_sub_category_id: Number(sub_sub_category_id),
          file: {
            path: filePath,
            clientName: image.clientName,
            shippingPriceId: shippingPrice.id,
          },
        }

        await ProcessImageShippingPrices.dispatch(jobPayload).in(delayMultiplier * 2000)
        delayMultiplier++
      }
    }
    
    if (savedFiles.length > 0) {
      return { message: 'Upload received, process started in background. Watch your stream for updates.' }
    }

    return { message: 'No images were uploaded' }

  }
}