import { PDFDocument } from 'pdf-lib'
import { MeeshoTemplateDetector } from '#services/meesho_label/pdf/meesho_template_detector'

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
   * Computes the adaptive crop bounding box for a given source page.
   * If the page height differs slightly from 842, adjusts top/bottom proportionally.
   */
  static getCropBounds(pageHeight: number, pageWidth: number): MeeshoCropBounds {
    const labelHeight = 343.0
    const margin = 2.83465
    const right = pageWidth - margin
    const top = pageHeight
    const bottom = top - labelHeight
    const width = right - margin

    return {
      left: margin,
      bottom,
      right,
      top,
      width,
      height: labelHeight,
    }
  }

  /**
   * Crops a single page from a source PDFDocument into a new single-page PDFDocument.
   * Vector content, barcodes, and QR codes are preserved 100% without rasterization.
   */
  static async cropSinglePage(srcDoc: PDFDocument, pageIndex: number): Promise<PDFDocument> {
    const srcPage = srcDoc.getPage(pageIndex)
    const validation = MeeshoTemplateDetector.validatePageDimensions(srcPage)
    if (!validation.isValid) {
      throw new Error(`Page ${pageIndex + 1} validation failed: ${validation.reason}`)
    }

    const bounds = this.getCropBounds(validation.pageHeight, validation.pageWidth)
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

    const newPage = outDoc.addPage([bounds.width, bounds.height])
    newPage.drawPage(embedded, { x: 0, y: 0 })

    return outDoc
  }

  /**
   * Crops specified pages from srcDoc and appends them to targetDoc in vector format.
   */
  static async appendCroppedPages(
    targetDoc: PDFDocument,
    srcDoc: PDFDocument,
    pageIndices: number[]
  ): Promise<void> {
    for (const pageIdx of pageIndices) {
      const srcPage = srcDoc.getPage(pageIdx)
      const validation = MeeshoTemplateDetector.validatePageDimensions(srcPage)
      const bounds = this.getCropBounds(validation.pageHeight, validation.pageWidth)

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

      const newPage = targetDoc.addPage([bounds.width, bounds.height])
      newPage.drawPage(embedded, { x: 0, y: 0 })
    }
  }
}
