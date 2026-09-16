import { PDFDocument } from 'pdf-lib'
import { MeeshoParser } from '#services/meesho_label/pdf/meesho_parser'
import type { ExtractedLabelMetadata } from '#services/meesho_label/pdf/meesho_parser'
import { MeeshoCropper } from '#services/meesho_label/pdf/meesho_cropper'
import { MeeshoMerger } from '#services/meesho_label/pdf/meesho_merger'
import type { MergeableLabelItem } from '#services/meesho_label/pdf/meesho_merger'
import { MeeshoTemplateDetector } from '#services/meesho_label/pdf/meesho_template_detector'

export interface ProcessedPageResult {
  pageNumber: number
  metadata: ExtractedLabelMetadata
  croppedPdfBuffer?: Buffer
  error?: string
}

export class MeeshoPdfProcessor {
  /**
   * Validates raw PDF magic header (%PDF).
   */
  static validatePdfHeader(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 5) return false
    return buffer.subarray(0, 4).toString('ascii') === '%PDF'
  }

  /**
   * Processes a raw Meesho multi-page PDF:
   * 1. Validates PDF header and page count
   * 2. Extracts metadata (SKU, orderId, AWB, etc.) from each page
   * 3. Validates layout template
   * Returns metadata per page.
   */
  static async processRawPdf(rawPdfBuffer: Buffer): Promise<{
    doc: PDFDocument
    pageCount: number
    pages: ProcessedPageResult[]
  }> {
    if (!this.validatePdfHeader(rawPdfBuffer)) {
      throw new Error('Invalid PDF: Missing %PDF signature header')
    }

    const doc = await PDFDocument.load(rawPdfBuffer)
    const pageCount = doc.getPageCount()

    if (pageCount === 0) {
      throw new Error('PDF has 0 pages')
    }

    const pageTexts = await MeeshoParser.extractPageTexts(rawPdfBuffer)
    const results: ProcessedPageResult[] = []

    for (let i = 0; i < pageCount; i++) {
      const pageNumber = i + 1
      const pageText = pageTexts[i] || ''

      try {
        const textValidation = MeeshoTemplateDetector.validatePageText(pageText)
        if (!textValidation.isValid) {
          throw new Error(textValidation.reason || 'Template layout mismatch')
        }

        const metadata = MeeshoParser.parsePageMetadata(pageText, pageNumber)
        results.push({
          pageNumber,
          metadata,
        })
      } catch (err: any) {
        results.push({
          pageNumber,
          metadata: {
            pageNumber,
            sku: '',
            quantity: 1,
          },
          error: err.message || 'Failed to process page',
        })
      }
    }

    return {
      doc,
      pageCount,
      pages: results,
    }
  }

  /**
   * Generates a single cropped shipping label PDF buffer for an individual page.
   */
  static async cropPageToBuffer(srcDoc: PDFDocument, pageIndex: number): Promise<Buffer> {
    const croppedDoc = await MeeshoCropper.cropSinglePage(srcDoc, pageIndex)
    const bytes = await croppedDoc.save()
    return Buffer.from(bytes)
  }

  /**
   * Merges all valid label documents into a single final PDF sorted by SKU.
   */
  static async mergeSortedLabels(items: MergeableLabelItem[]): Promise<{
    buffer: Buffer
    pageCount: number
  }> {
    return MeeshoMerger.mergeSortedLabels(items)
  }
}
