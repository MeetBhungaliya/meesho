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

    const sortBy = payload.sortBy || 'createdAt'
    const sortOrder = payload.sortOrder || 'desc'

    query.orderBy(sortBy, sortOrder)

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
    const shippingPricesPayload = []

    for (const image of imagesArr) {
      const filePath = globals.getShippingImagePath(userId, image.clientName)
      await image.moveToDisk(filePath, { visibility: 'private' })

      if (image.state === 'moved') {
        savedFiles.push({
          path: filePath,
          clientName: image.clientName,
        })
        
        shippingPricesPayload.push({
          accountId: Number(accountId),
          subSubCategoryId: Number(sub_sub_category_id),
          imagePath: filePath,
        })
      }
    }
    
    if (shippingPricesPayload.length > 0) {
      const data = await ShippingPrice.createMany(shippingPricesPayload)

      const jobs = savedFiles.map((file, index) => ({
        accountId,
        userId,
        sub_sub_category_id: Number(sub_sub_category_id),
        file: {
          path: file.path,
          clientName: file.clientName,
          shippingPriceId: data[index].id,
        },
      }))

      await ProcessImageShippingPrices.dispatchMany(jobs)


    
      return { message: 'Upload received, process started in background. Watch your stream for updates.', data }
    }


    return { message: 'No images were uploaded' }
    


  }
}