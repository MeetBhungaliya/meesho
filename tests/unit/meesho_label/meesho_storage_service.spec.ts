import { test } from '@japa/runner'
import { MeeshoLabelStorageService } from '#services/meesho_label/meesho_label_storage_service'

test.group('MeeshoLabelStorageService', () => {
  test('generates expected S3 key structure for raw PDF', ({ assert }) => {
    const key = MeeshoLabelStorageService.getRawPdfKey(
      12,
      'job-uuid-1234',
      101,
      '4339024_fk14g_0e6e80e6-69de'
    )

    assert.equal(key, 'meesho-labels/12/job-uuid-1234/raw/101/4339024_fk14g_0e6e80e6-69de.pdf')
  })

  test('sanitizes special characters in raw PDF request_id', ({ assert }) => {
    const key = MeeshoLabelStorageService.getRawPdfKey(12, 'job-uuid-1234', 101, 'req:123/bad?id')

    assert.equal(key, 'meesho-labels/12/job-uuid-1234/raw/101/req_123_bad_id.pdf')
  })

  test('generates expected S3 key structure for processed PDF document', ({ assert }) => {
    const key = MeeshoLabelStorageService.getProcessedPdfKey(12, 'job-uuid-1234', 101, 555)

    assert.equal(key, 'meesho-labels/12/job-uuid-1234/processed/101/555.pdf')
  })

  test('generates expected S3 key structure for final merged PDF', ({ assert }) => {
    const key = MeeshoLabelStorageService.getFinalPdfKey(12, 'job-uuid-1234')

    assert.equal(key, 'meesho-labels/12/job-uuid-1234/final/meesho-labels-job-uuid-1234.pdf')
  })
})
