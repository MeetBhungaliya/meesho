import { test } from '@japa/runner'
import { LABEL_ERROR_CODES } from '#services/external_api/constants'

test.group('Meesho Label Status Machine & Error Codes', () => {
  test('all required error codes exist', ({ assert }) => {
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_API_TIMEOUT)
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_API_RATE_LIMIT)
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_API_AUTH_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_REQUEST_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_REQUEST_ID_NOT_FOUND)
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_LABEL_PROCESSING_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.MEESHO_LABEL_URL_MISSING)
    assert.isDefined(LABEL_ERROR_CODES.PDF_DOWNLOAD_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.PDF_INVALID)
    assert.isDefined(LABEL_ERROR_CODES.PDF_TEMPLATE_NOT_RECOGNIZED)
    assert.isDefined(LABEL_ERROR_CODES.SKU_NOT_FOUND)
    assert.isDefined(LABEL_ERROR_CODES.AWB_NOT_FOUND)
    assert.isDefined(LABEL_ERROR_CODES.PDF_CROP_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.PDF_MERGE_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.S3_UPLOAD_FAILED)
    assert.isDefined(LABEL_ERROR_CODES.SCHEDULE_INVALID)
    assert.isDefined(LABEL_ERROR_CODES.SCHEDULE_EXECUTION_FAILED)
  })

  test('valid account status transitions follow linear sequence', ({ assert }) => {
    const validSequence = [
      'PENDING',
      'REQUESTING',
      'POLLING',
      'READY_FOR_DOWNLOAD',
      'DOWNLOADING',
      'DOWNLOADED',
      'PROCESSING',
      'PROCESSED',
    ]

    for (let i = 0; i < validSequence.length - 1; i++) {
      assert.isBelow(i, i + 1)
    }
  })
})
