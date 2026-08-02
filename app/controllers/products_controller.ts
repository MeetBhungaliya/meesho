import Product from '#models/product'
import StockTransaction from '#models/stock_transaction'
import {
  createProductValidator,
  updateProductValidator,
  adjustStockValidator,
  listProductsValidator,
} from '#validators/product'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import transmit from '@adonisjs/transmit/services/main'
import env from '#start/env'
import { globals } from '#libs/globals'

export default class ProductsController {
  /**
   * GET /inventory/products
   * Paginated product list with search, sort, filter
   */
  async index({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const params = await request.validateUsing(listProductsValidator)

    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20

    const query = Product.query()
      .where('userId', user.id)
      .where('isActive', true)
      .orderBy('created_at', 'desc')

    const products = await query.paginate(page, pageSize)

    return response.ok({
      message: 'Products fetched successfully',
      data: products.all().map((p) => p.serialize()),
      meta: {
        total: products.total,
        page: products.currentPage,
        pageSize: products.perPage,
        totalPages: products.lastPage,
      },
    })
  }

  /**
   * POST /inventory/products
   * Create a new product with optional initial stock and image
   */
  async store({ request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(createProductValidator)

    const initialStock = payload.currentStock ?? 0
    const image = request.file('image')
    let imagePath: string | null = null

    if (image) {
      const disk = env.get('NODE_ENV') === 'development' ? 'fs' : env.get('DRIVE_DISK')
      const sanitizedName = globals.sanitizeFileName(image.clientName)
      const folderPath = `products/${user.id}`
      const fileName = `${Date.now()}-${sanitizedName}`
      const fullPath = `${folderPath}/${fileName}`

      await image.moveToDisk(fullPath, { visibility: 'public', disk })
      imagePath = fullPath
    }

    const product = await db.transaction(async (trx) => {
      const p = await Product.create(
        {
          userId: user.id,
          name: payload.name,
          price: payload.price,
          currentStock: initialStock,
          minimumStock: payload.minimumStock ?? 0,
          note: payload.note ?? null,
          isActive: true,
          imagePath: imagePath,
        },
        { client: trx }
      )

      // Log initial stock transaction if stock > 0
      if (initialStock > 0) {
        await StockTransaction.create(
          {
            productId: p.id,
            userId: user.id,
            changeAmount: initialStock,
            stockAfter: initialStock,
            type: 'initial',
            note: 'Initial stock on product creation',
          },
          { client: trx }
        )
      }

      return p
    })

    // Broadcast SSE event
    transmit.broadcast(`inventory/${user.id}`, {
      type: 'product_created',
      product: product.serialize(),
    })

    return response.created({
      message: 'Product created successfully',
      data: product.serialize(),
    })
  }

  /**
   * GET /inventory/products/:id
   * Single product with recent stock transactions
   */
  async show({ params, response, auth }: HttpContext) {
    const user = await auth.authenticate()

    const product = await Product.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    const recentTransactions = await StockTransaction.query()
      .where('productId', product.id)
      .orderBy('createdAt', 'desc')
      .limit(20)

    return response.ok({
      message: 'Product fetched successfully',
      data: {
        ...product.serialize(),
        recentTransactions: recentTransactions.map((t) => t.serialize()),
      },
    })
  }

  /**
   * PUT /inventory/products/:id
   * Update product details (not stock — use adjustStock for that)
   */
  async update({ params, request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(updateProductValidator)

    const product = await Product.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    product.merge(payload)
    await product.save()

    // Broadcast SSE event
    transmit.broadcast(`inventory/${user.id}`, {
      type: 'product_updated',
      product: product.serialize(),
    })

    return response.ok({
      message: 'Product updated successfully',
      data: product.serialize(),
    })
  }

  /**
   * DELETE /inventory/products/:id
   * Delete a product and its transactions
   */
  async destroy({ params, response, auth }: HttpContext) {
    const user = await auth.authenticate()

    const product = await Product.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    await product.delete()

    // Broadcast SSE event
    transmit.broadcast(`inventory/${user.id}`, {
      type: 'product_deleted',
      productId: product.id,
    })

    return response.ok({
      message: 'Product deleted successfully',
    })
  }

  /**
   * POST /inventory/products/:id/adjust-stock
   * Adjust stock with transaction logging and concurrency control
   */
  async adjustStock({ params, request, response, auth }: HttpContext) {
    const user = await auth.authenticate()
    const payload = await request.validateUsing(adjustStockValidator)

    const result = await db.transaction(async (trx) => {
      // Lock the row for update to prevent race conditions
      const product = await Product.query({ client: trx })
        .where('id', params.id)
        .where('userId', user.id)
        .forUpdate()
        .firstOrFail()

      const newStock = product.currentStock + payload.changeAmount

      if (newStock < 0) {
        return { error: 'Insufficient stock. Cannot reduce below zero.' }
      }

      product.currentStock = newStock
      await product.save()

      // Create audit trail
      const transaction = await StockTransaction.create(
        {
          productId: product.id,
          userId: user.id,
          changeAmount: payload.changeAmount,
          stockAfter: newStock,
          type: payload.type,
          note: payload.note ?? null,
        },
        { client: trx }
      )

      return { product, transaction }
    })

    if ('error' in result) {
      return response.badRequest({ message: result.error })
    }

    const { product, transaction } = result

    // Broadcast SSE event with optional low-stock alert
    const alert =
      product.currentStock <= product.minimumStock
        ? {
            type: product.currentStock <= 0 ? 'out_of_stock' : 'low_stock',
            productName: product.name,
            currentStock: product.currentStock,
            minimumStock: product.minimumStock,
          }
        : null

    transmit.broadcast(`inventory/${user.id}`, {
      type: 'stock_adjusted',
      product: product.serialize(),
      transaction: transaction.serialize(),
      alert,
    })

    return response.ok({
      message: 'Stock adjusted successfully',
      data: {
        product: product.serialize(),
        transaction: transaction.serialize(),
      },
    })
  }

  /**
   * GET /inventory/products/analytics
   * Summary analytics for the inventory dashboard
   */
  async analytics({ response, auth }: HttpContext) {
    const user = await auth.authenticate()

    const products = await Product.query()
      .where('userId', user.id)
      .where('isActive', true)

    const totalProducts = products.length
    let totalValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    for (const product of products) {
      const value = product.inventoryValue
      totalValue += value

      if (product.currentStock <= 0) {
        outOfStockCount++
      } else if (product.currentStock <= product.minimumStock) {
        lowStockCount++
      }
    }

    // Recent stock movements (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentTransactions = await StockTransaction.query()
      .where('userId', user.id)
      .where('createdAt', '>=', thirtyDaysAgo.toISOString())
      .orderBy('createdAt', 'asc')

    // Group transactions by date for chart data
    const dailyMovements: Record<string, { additions: number; deductions: number }> = {}
    for (const tx of recentTransactions) {
      const dateKey = tx.createdAt.toFormat('yyyy-MM-dd')
      if (!dailyMovements[dateKey]) {
        dailyMovements[dateKey] = { additions: 0, deductions: 0 }
      }
      if (tx.changeAmount > 0) {
        dailyMovements[dateKey].additions += tx.changeAmount
      } else {
        dailyMovements[dateKey].deductions += Math.abs(tx.changeAmount)
      }
    }

    const stockMovements = Object.entries(dailyMovements).map(([date, data]) => ({
      date,
      additions: data.additions,
      deductions: data.deductions,
    }))

    // Low stock items list
    const lowStockItems = products
      .filter((p) => p.currentStock <= p.minimumStock && p.currentStock > 0)
      .map((p) => p.serialize())
      .slice(0, 10)

    const outOfStockItems = products
      .filter((p) => p.currentStock <= 0)
      .map((p) => p.serialize())
      .slice(0, 10)

    return response.ok({
      message: 'Analytics fetched successfully',
      data: {
        totalProducts,
        totalValue: Number(totalValue.toFixed(2)),
        lowStockCount,
        outOfStockCount,
        categoryBreakdown: [],
        stockMovements,
        lowStockItems,
        outOfStockItems,
      },
    })
  }



  /**
   * GET /inventory/products/categories
   * Get distinct categories (Deprecated/Empty)
   */
  async categories({ response }: HttpContext) {
    return response.ok({
      message: 'Categories fetched successfully',
      data: [],
    })
  }
}
