import { PDFDocument } from 'pdf-lib'
import { MeeshoCropper } from '#services/meesho_label/pdf/meesho_cropper'
import { MeeshoTemplateDetector } from '#services/meesho_label/pdf/meesho_template_detector'

export interface MergeableLabelItem {
  id: number | string
  sku: string
  sourceOrder: number
  srcDoc: PDFDocument
  sourcePageIndex: number
}

export class MeeshoMerger {
  /**
   * Natural ascending sort comparator:
   * 1. SKU ascending (natural/alphanumeric, case-insensitive)
   * 2. Source order / processing sequence as stable tie-breaker
   */
  static sortLabels<T extends { sku: string; sourceOrder: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const skuComparison = (a.sku || '').localeCompare(b.sku || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      if (skuComparison !== 0) {
        return skuComparison
      }
      return a.sourceOrder - b.sourceOrder
    })
  }

  /**
   * Sorts and merges label items into a single final vector PDF.
   * Every physical label remains its own separate page.
   * Tax invoice portion is removed.
   */
  static async mergeSortedLabels(items: MergeableLabelItem[]): Promise<{
    buffer: Buffer
    pageCount: number
  }> {
    const sorted = this.sortLabels(items)
    const outDoc = await PDFDocument.create()

    for (const item of sorted) {
      const srcPage = item.srcDoc.getPage(item.sourcePageIndex)
      const validation = MeeshoTemplateDetector.validatePageDimensions(srcPage)
      const bounds = MeeshoCropper.getCropBounds(
        validation.pageHeight || 842,
        validation.pageWidth || 595
      )

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
    }

    const pdfBytes = await outDoc.save()
    return {
      buffer: Buffer.from(pdfBytes),
      pageCount: sorted.length,
    }
  }
}
