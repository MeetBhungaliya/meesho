import type { PDFPage } from 'pdf-lib'

export interface MeeshoTemplateValidationResult {
  isValid: boolean
  pageWidth: number
  pageHeight: number
  reason?: string
}

export class MeeshoTemplateDetector {
  // Expected standard Meesho A4 dimensions in points (72 points/inch)
  static readonly EXPECTED_WIDTH = 595
  static readonly EXPECTED_HEIGHT = 842
  static readonly TOLERANCE = 10 // Allowance for minor point rounding differences

  /**
   * Detects and validates that the PDF page layout matches the Meesho A4 standard.
   */
  static validatePageDimensions(page: PDFPage): MeeshoTemplateValidationResult {
    const { width, height } = page.getSize()

    const widthMatch = Math.abs(width - this.EXPECTED_WIDTH) <= this.TOLERANCE
    const heightMatch = Math.abs(height - this.EXPECTED_HEIGHT) <= this.TOLERANCE

    if (!widthMatch || !heightMatch) {
      return {
        isValid: false,
        pageWidth: width,
        pageHeight: height,
        reason: `Unexpected page size: ${width.toFixed(1)}x${height.toFixed(1)} pt. Expected ~${this.EXPECTED_WIDTH}x${this.EXPECTED_HEIGHT} pt.`,
      }
    }

    return {
      isValid: true,
      pageWidth: width,
      pageHeight: height,
    }
  }

  /**
   * Validates that the text on the page contains expected Meesho shipping label structures.
   */
  static validatePageText(text: string): { isValid: boolean; reason?: string } {
    const normalized = text.toLowerCase()
    const hasAddress =
      normalized.includes('customer address') || normalized.includes('delivery address')
    const hasProductDetails = normalized.includes('product details') || normalized.includes('sku')

    if (!hasAddress && !hasProductDetails) {
      return {
        isValid: false,
        reason:
          'Page does not contain expected Meesho label headers (Customer Address / Product Details)',
      }
    }

    return { isValid: true }
  }
}
