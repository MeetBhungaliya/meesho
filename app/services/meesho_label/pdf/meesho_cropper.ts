import { PDFDocument } from 'pdf-lib'
import { createRequire } from 'node:module'
import { MeeshoTemplateDetector } from '#services/meesho_label/pdf/meesho_template_detector'

const require = createRequire(import.meta.url)
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs')

export interface MeeshoCropBounds {
  left: number
  bottom: number
  right: number
  top: number
  width: number
  height: number
}

export class MeeshoCropper {
  /**
   * Standard Meesho Shipping Label Crop Bounding Box:
   * Left: 2.83465 pt (~1mm)
   * Bottom: 506.59465 pt
   * Right: 592.44185 pt
   * Top: 842.0 pt
   * Resulting dimensions: width = 589.6072 pt, height = 335.40535 pt
   */
  static readonly DEFAULT_CROP_BOUNDS: MeeshoCropBounds = {
    left: 2.83465,
    bottom: 499.0,
    right: 592.44185,
    top: 842.0,
    width: 589.6072,
    height: 343.0,
  }

  /**
   * Small padding (in pt) added below the detected "TAX INVOICE" Y position
   * so that the bottom border of the Product Details / SKU row is preserved
   * in the cropped output.
   */
  static readonly TAX_INVOICE_PADDING_PT = 13

  /**
   * Uses pdfjs-dist to locate the Y-coordinate of "TAX INVOICE" text on a
   * specific page.  Returns the Y value (in PDF coordinate space, measured
   * from the bottom of the page) or `undefined` when the text is not found.
   *
   * The transform matrix returned by pdfjs-dist for each text item is:
   *   [scaleX, skewX, skewY, scaleY, translateX, translateY]
   * translateY (index 5) gives the baseline Y position.
   */
  static async findTaxInvoiceY(pdfBuffer: Buffer, pageIndex: number): Promise<number | undefined> {
    const data = new Uint8Array(pdfBuffer)
    const doc = await getDocument({ data, useSystemFonts: true }).promise

    try {
      // pdfjs-dist pages are 1-indexed
      const page = await doc.getPage(pageIndex + 1)
      const textContent = await page.getTextContent()

      for (const item of textContent.items) {
        // Skip marker items that have no `str` property
        if (!('str' in item)) continue

        const text = (item as any).str as string
        if (text.toLowerCase().includes('tax invoice')) {
          // transform[5] = translateY = baseline Y from bottom of page
          const y = (item as any).transform[5] as number
          return y
        }
      }

      return undefined
    } finally {
      await doc.destroy()
    }
  }

  /**
   * Detects the "TAX INVOICE" Y positions for every page in the PDF buffer in
   * a single pdfjs-dist document load (more efficient than loading once per page).
   *
   * Returns a Map<pageIndex, taxInvoiceY>.
   */
  static async detectAllPages(pdfBuffer: Buffer): Promise<Map<number, number>> {
    const data = new Uint8Array(pdfBuffer)
    const doc = await getDocument({ data, useSystemFonts: true }).promise
    const results = new Map<number, number>()

    try {
      const pageCount = doc.numPages
      for (let i = 0; i < pageCount; i++) {
        const page = await doc.getPage(i + 1) // pdfjs is 1-indexed
        const textContent = await page.getTextContent()

        for (const item of textContent.items) {
          if (!('str' in item)) continue

          const text = (item as any).str as string
          if (text.toLowerCase().includes('tax invoice')) {
            const y = (item as any).transform[5] as number
            results.set(i, y)
            break
          }
        }
      }
    } finally {
      await doc.destroy()
    }

    return results
  }

  /**
   * Computes the crop bounding box for a given source page.
   *
   * When `taxInvoiceY` is provided the crop bottom is set dynamically to that
   * Y coordinate (plus a small padding so the row border is included).
   * Otherwise falls back to the legacy static label height.
   */
  static getCropBounds(
    pageHeight: number,
    pageWidth: number,
    taxInvoiceY?: number
  ): MeeshoCropBounds {
    const margin = 2.83465
    const right = pageWidth - margin
    const top = pageHeight

    let bottom: number
    if (taxInvoiceY !== undefined) {
      // taxInvoiceY is the baseline of "TAX INVOICE" text.
      // We crop just above the text baseline so the border line of the row
      // above is preserved but the TAX INVOICE header row itself is excluded.
      bottom = taxInvoiceY + this.TAX_INVOICE_PADDING_PT
    } else {
      // Fallback to the legacy static height
      const labelHeight = 343.0
      bottom = top - labelHeight
    }

    const width = right - margin
    const height = top - bottom

    return {
      left: margin,
      bottom,
      right,
      top,
      width,
      height,
    }
  }

  /**
   * Crops a single page from a source PDFDocument into a new single-page PDFDocument.
   * Vector content, barcodes, and QR codes are preserved 100% without rasterization.
   *
   * Uses dynamic "TAX INVOICE" detection when `pdfBuffer` is supplied.
   */
  static async cropSinglePage(
    srcDoc: PDFDocument,
    pageIndex: number,
    pdfBuffer?: Buffer
  ): Promise<PDFDocument> {
    const srcPage = srcDoc.getPage(pageIndex)
    const validation = MeeshoTemplateDetector.validatePageDimensions(srcPage)
    if (!validation.isValid) {
      throw new Error(`Page ${pageIndex + 1} validation failed: ${validation.reason}`)
    }

    // Dynamically detect crop point
    let taxInvoiceY: number | undefined
    if (pdfBuffer) {
      taxInvoiceY = await this.findTaxInvoiceY(pdfBuffer, pageIndex)
    }

    const bounds = this.getCropBounds(validation.pageHeight, validation.pageWidth, taxInvoiceY)
    const outDoc = await PDFDocument.create()

    const [embedded] = await outDoc.embedPages(
      [srcPage],
      [
        {
          left: bounds.left,
          bottom: bounds.bottom,
          right: bounds.right,
          top: bounds.top,
        },
      ]
    )

    const EXTRA_BOTTOM_MARGIN = 15
    const newPage = outDoc.addPage([bounds.width, bounds.height + EXTRA_BOTTOM_MARGIN])
    newPage.drawPage(embedded, { x: 0, y: EXTRA_BOTTOM_MARGIN })

    return outDoc
  }

  /**
   * Crops specified pages from srcDoc and appends them to targetDoc in vector format.
   *
   * When `pdfBuffer` is provided, all pages are scanned once upfront for the
   * "TAX INVOICE" Y position so each page is cropped dynamically.
   */
  static async appendCroppedPages(
    targetDoc: PDFDocument,
    srcDoc: PDFDocument,
    pageIndices: number[],
    pdfBuffer?: Buffer
  ): Promise<void> {
    // Batch-detect all pages at once for efficiency
    let taxInvoiceMap: Map<number, number> | undefined
    if (pdfBuffer) {
      taxInvoiceMap = await this.detectAllPages(pdfBuffer)
    }

    for (const pageIdx of pageIndices) {
      const srcPage = srcDoc.getPage(pageIdx)
      const validation = MeeshoTemplateDetector.validatePageDimensions(srcPage)
      const taxInvoiceY = taxInvoiceMap?.get(pageIdx)
      const bounds = this.getCropBounds(
        validation.pageHeight || 842,
        validation.pageWidth || 595,
        taxInvoiceY
      )

      const [embedded] = await targetDoc.embedPages(
        [srcPage],
        [
          {
            left: bounds.left,
            bottom: bounds.bottom,
            right: bounds.right,
            top: bounds.top,
          },
        ]
      )

      const EXTRA_BOTTOM_MARGIN = 15
      const newPage = targetDoc.addPage([bounds.width, bounds.height + EXTRA_BOTTOM_MARGIN])
      newPage.drawPage(embedded, { x: 0, y: EXTRA_BOTTOM_MARGIN })
    }
  }
}
