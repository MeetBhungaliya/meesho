import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse')

export interface ExtractedLabelMetadata {
  pageNumber: number
  sku: string
  orderId?: string
  subOrderId?: string
  awb?: string
  quantity: number
  size?: string
  color?: string
  rawDetailsLine?: string
}

export class MeeshoParser {
  /**
   * Extracts text from all pages in the PDF buffer.
   */
  static async extractPageTexts(pdfBuffer: Buffer): Promise<string[]> {
    const parser = new PDFParse({ data: pdfBuffer })
    const result = await parser.getText()
    return (result.pages || []).map((p: { text: string }) => p.text || '')
  }

  /**
   * Parses the shipping label metadata from a page's text without hardcoding fixed line indices.
   */
  static parsePageMetadata(pageText: string, pageNumber: number): ExtractedLabelMetadata {
    const lines = pageText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    // Locate "Product Details" header
    const productDetailsIdx = lines.findIndex((l) => l.toLowerCase().includes('product details'))

    if (productDetailsIdx === -1) {
      throw new Error(`Product Details section not found on page ${pageNumber}`)
    }

    // Look for details header or values in subsequent lines
    let detailsLineIdx = -1
    for (let i = productDetailsIdx + 1; i < Math.min(lines.length, productDetailsIdx + 5); i++) {
      const line = lines[i]
      if (line.toLowerCase().includes('tax invoice')) {
        break
      }
      if (line.toLowerCase().includes('sku') && line.toLowerCase().includes('qty')) {
        // This is the header "SKU Size Qty Color Order No."
        // Next line should be the actual values
        detailsLineIdx = i + 1
        break
      }
    }

    if (detailsLineIdx === -1 || detailsLineIdx >= lines.length) {
      throw new Error(
        `SKU header or details line not found after Product Details on page ${pageNumber}`
      )
    }

    const detailsLine = lines[detailsLineIdx]
    const parsedLine = this.parseDetailsLine(detailsLine)

    if (!parsedLine.sku) {
      throw new Error(
        `Failed to extract valid SKU from line: "${detailsLine}" on page ${pageNumber}`
      )
    }

    // Attempt to extract AWB/tracking barcode string
    // In Meesho labels, AWB appears above "Product Details" (e.g. VL0085419087216, SF4011630687FPL)
    const awb = this.extractAwb(lines, productDetailsIdx)

    return {
      pageNumber,
      sku: parsedLine.sku,
      orderId: parsedLine.orderNo,
      subOrderId: parsedLine.orderNo,
      awb,
      quantity: parsedLine.qty,
      size: parsedLine.size,
      color: parsedLine.color,
      rawDetailsLine: detailsLine,
    }
  }

  /**
   * Robust right-to-left structural matcher for:
   * "<SKU...> <Size> <Qty> <Color> <OrderNo>"
   * e.g. "VATI 115 Free Size 1 Gold 331048265058781248_1"
   * e.g. "A MS + A RING 124 Free Size 1 Gold 330919333152837312_1"
   */
  static parseDetailsLine(line: string): {
    sku: string
    size: string
    qty: number
    color: string
    orderNo: string
  } {
    // Regex pattern matching Order No at the end, Color before that, Qty (integer), Size, and SKU prefix
    const regex =
      /^(.*?)\s+(Free\s*Size|\d+(?:\s*[a-zA-Z]+)?|[X|S|M|L|XL|XXL|XXXL]+)\s+(\d+)\s+(\S+)\s+(\d+(?:_\d+)?)$/i
    const match = line.trim().match(regex)

    if (match) {
      return {
        sku: match[1].trim(),
        size: match[2].trim(),
        qty: Number.parseInt(match[3], 10),
        color: match[4].trim(),
        orderNo: match[5].trim(),
      }
    }

    // Fallback tokenization: order number is last token, color is 2nd last, qty is 3rd last
    const tokens = line.trim().split(/\s+/)
    if (tokens.length >= 5) {
      const orderNo = tokens[tokens.length - 1]
      const color = tokens[tokens.length - 2]
      const qty = Number.parseInt(tokens[tokens.length - 3], 10) || 1
      const sizeAndSku = tokens.slice(0, -3)

      let size = 'Free Size'
      let sku = sizeAndSku.join(' ')

      if (
        sizeAndSku.length >= 2 &&
        sizeAndSku[sizeAndSku.length - 2].toLowerCase() === 'free' &&
        sizeAndSku[sizeAndSku.length - 1].toLowerCase() === 'size'
      ) {
        size = 'Free Size'
        sku = sizeAndSku.slice(0, -2).join(' ')
      } else if (sizeAndSku.length >= 1) {
        const last = sizeAndSku[sizeAndSku.length - 1]
        if (/^(XS|S|M|L|XL|XXL|XXXL|\d+)$/i.test(last)) {
          size = last
          sku = sizeAndSku.slice(0, -1).join(' ')
        }
      }

      return {
        sku: sku.trim(),
        size: size.trim(),
        qty,
        color: color.trim(),
        orderNo: orderNo.trim(),
      }
    }

    throw new Error(`Unable to tokenize details line: "${line}"`)
  }

  /**
   * Extracts AWB/Courier tracking number located before "Product Details".
   */
  private static extractAwb(lines: string[], productDetailsIdx: number): string | undefined {
    // Check up to 3 lines preceding Product Details
    for (let i = productDetailsIdx - 1; i >= Math.max(0, productDetailsIdx - 3); i--) {
      const line = lines[i]
      // AWB is typically alphanumeric, e.g. VL0085419087216, SF4011630687FPL
      if (/^[A-Z0-9]{8,25}$/i.test(line) && !line.includes(' ')) {
        return line
      }
    }
    return undefined
  }
}
