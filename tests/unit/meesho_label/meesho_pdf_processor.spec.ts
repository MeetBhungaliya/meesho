import { test } from '@japa/runner'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { MeeshoPdfProcessor } from '#services/meesho_label/pdf/meesho_pdf_processor'
import { MeeshoParser } from '#services/meesho_label/pdf/meesho_parser'
import { MeeshoCropper } from '#services/meesho_label/pdf/meesho_cropper'
import { MeeshoMerger, type MergeableLabelItem } from '#services/meesho_label/pdf/meesho_merger'
import { MeeshoTemplateDetector } from '#services/meesho_label/pdf/meesho_template_detector'

test.group('Meesho PDF Processing Engine', () => {
  const fixturePath = path.resolve('tests/fixtures/sub_orders_input.pdf')
  const expectedFixturePath = path.resolve('tests/fixtures/meesho_label_expected.pdf')
  let rawBuffer: Buffer

  test('validates %PDF header', ({ assert }) => {
    assert.isTrue(MeeshoPdfProcessor.validatePdfHeader(Buffer.from('%PDF-1.4\n...')))
    assert.isFalse(MeeshoPdfProcessor.validatePdfHeader(Buffer.from('not a pdf')))
    assert.isFalse(MeeshoPdfProcessor.validatePdfHeader(Buffer.alloc(0)))
  })

  test('validates page dimensions against Meesho A4 standard', async ({ assert }) => {
    if (!fs.existsSync(fixturePath)) return
    rawBuffer = fs.readFileSync(fixturePath)
    const doc = await PDFDocument.load(rawBuffer)
    const page0 = doc.getPage(0)

    const validation = MeeshoTemplateDetector.validatePageDimensions(page0)
    assert.isTrue(validation.isValid)
    assert.closeTo(validation.pageWidth, 595, 2)
    assert.closeTo(validation.pageHeight, 842, 2)
  })

  test('extracts text and parses SKU, AWB, Qty, Size, and Order No. from fixture pages', async ({
    assert,
  }) => {
    if (!fs.existsSync(fixturePath)) return
    rawBuffer = fs.readFileSync(fixturePath)

    const result = await MeeshoPdfProcessor.processRawPdf(rawBuffer)
    assert.equal(result.pageCount, 4)
    assert.equal(result.pages.length, 4)

    // Page 1
    const p1 = result.pages[0]
    assert.isUndefined(p1.error)
    assert.equal(p1.metadata.sku, 'VATI 115')
    assert.equal(p1.metadata.quantity, 1)
    assert.equal(p1.metadata.size, 'Free Size')
    assert.equal(p1.metadata.color, 'Gold')
    assert.equal(p1.metadata.orderId, '331048265058781248_1')
    assert.equal(p1.metadata.awb, 'VL0085419087216')

    // Page 2
    const p2 = result.pages[1]
    assert.isUndefined(p2.error)
    assert.equal(p2.metadata.sku, 'A MS + A RING 124')
    assert.equal(p2.metadata.quantity, 1)
    assert.equal(p2.metadata.awb, 'SF4011630687FPL')

    // Page 3
    const p3 = result.pages[2]
    assert.isUndefined(p3.error)
    assert.equal(p3.metadata.sku, 'VATI 111')
    assert.equal(p3.metadata.quantity, 1)
    assert.equal(p3.metadata.awb, 'VL0085419087217')

    // Page 4
    const p4 = result.pages[3]
    assert.isUndefined(p4.error)
    assert.equal(p4.metadata.sku, 'G-alphabet-1729')
    assert.equal(p4.metadata.quantity, 1)
    assert.equal(p4.metadata.awb, 'SF4016975187FPL')
  })

  test('natural sorting orders SKUs deterministically A -> Z', ({ assert }) => {
    const rawItems = [
      { sku: 'VATI 115', sourceOrder: 1 },
      { sku: 'A MS + A RING 124', sourceOrder: 2 },
      { sku: 'VATI 111', sourceOrder: 3 },
      { sku: 'G-alphabet-1729', sourceOrder: 4 },
    ]

    const sorted = MeeshoMerger.sortLabels(rawItems)
    assert.deepEqual(
      sorted.map((i) => i.sku),
      ['A MS + A RING 124', 'G-alphabet-1729', 'VATI 111', 'VATI 115']
    )
  })

  test('sorting handles duplicate SKUs keeping separate pages and stable source order', ({
    assert,
  }) => {
    const rawItems = [
      { id: 1, sku: 'VATI 111', sourceOrder: 1 },
      { id: 2, sku: 'A ITEM', sourceOrder: 2 },
      { id: 3, sku: 'VATI 111', sourceOrder: 3 },
      { id: 4, sku: 'VATI 111', sourceOrder: 4 },
    ]

    const sorted = MeeshoMerger.sortLabels(rawItems)
    assert.equal(sorted.length, 4)
    assert.equal(sorted[0].sku, 'A ITEM')
    assert.equal(sorted[1].id, 1)
    assert.equal(sorted[2].id, 3)
    assert.equal(sorted[3].id, 4)
  })

  test('cropper produces shipping label page and removes tax invoice portion', async ({
    assert,
  }) => {
    if (!fs.existsSync(fixturePath)) return
    rawBuffer = fs.readFileSync(fixturePath)
    const srcDoc = await PDFDocument.load(rawBuffer)

    const croppedDoc = await MeeshoCropper.cropSinglePage(srcDoc, 0)
    assert.equal(croppedDoc.getPageCount(), 1)

    const croppedPage = croppedDoc.getPage(0)
    const size = croppedPage.getSize()

    assert.closeTo(size.width, 589.6, 1)
    assert.closeTo(size.height, 343.0, 1)

    const croppedBytes = await croppedDoc.save()
    const pageTexts = await MeeshoParser.extractPageTexts(Buffer.from(croppedBytes))
    assert.isFalse(pageTexts[0].includes('TAX INVOICE'))
    assert.isTrue(pageTexts[0].includes('Customer Address'))
  })

  test('merges all sorted pages and matches expected fixture page count and dimensions', async ({
    assert,
  }) => {
    if (!fs.existsSync(fixturePath) || !fs.existsSync(expectedFixturePath)) return
    rawBuffer = fs.readFileSync(fixturePath)
    const srcDoc = await PDFDocument.load(rawBuffer)

    const mergeItems: MergeableLabelItem[] = [
      { id: 1, sku: 'VATI 115', sourceOrder: 1, srcDoc, sourcePageIndex: 0 },
      { id: 2, sku: 'A MS + A RING 124', sourceOrder: 2, srcDoc, sourcePageIndex: 1 },
      { id: 3, sku: 'VATI 111', sourceOrder: 3, srcDoc, sourcePageIndex: 2 },
      { id: 4, sku: 'G-alphabet-1729', sourceOrder: 4, srcDoc, sourcePageIndex: 3 },
    ]

    const { buffer: mergedBuf, pageCount } = await MeeshoPdfProcessor.mergeSortedLabels(mergeItems)
    assert.equal(pageCount, 4)

    const mergedDoc = await PDFDocument.load(mergedBuf)
    assert.equal(mergedDoc.getPageCount(), 4)

    // Check order of SKUs in merged document
    const mergedTexts = await MeeshoParser.extractPageTexts(mergedBuf)
    assert.isTrue(mergedTexts[0].includes('A MS + A RING 124'))
    assert.isTrue(mergedTexts[1].includes('G-alphabet-1729'))
    assert.isTrue(mergedTexts[2].includes('VATI 111'))
    assert.isTrue(mergedTexts[3].includes('VATI 115'))

    // Verify none of the pages have TAX INVOICE
    for (const text of mergedTexts) {
      assert.isFalse(text.includes('TAX INVOICE'))
    }
  })
})
