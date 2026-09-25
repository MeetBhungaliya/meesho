import { test } from '@japa/runner'
import {
  MeeshoLabelApiService,
  type MeeshoLabelHistoryResponse,
} from '#services/meesho_label/meesho_label_api_service'
import type { SupplierCacheData } from '#services/external_api/types'
import { MEESHO_ENDPOINTS } from '#services/external_api/constants'

test.group('MeeshoLabelApiService', () => {
  const dummySupplier: SupplierCacheData = {
    id: 1,
    email: 'seller@example.com',
    phone: '9999999999',
    supplierId: 4339024,
    name: 'Sambhaji Sales',
    identifier: 'fk14g',
  }

  test('buildDownloadLabelPayload generates exact required Meesho payload', ({ assert }) => {
    const payload = MeeshoLabelApiService.buildDownloadLabelPayload(dummySupplier)

    assert.equal(payload.supplier_details.id, 4339024)
    assert.equal(payload.supplier_details.identifier, 'fk14g')
    assert.equal(payload.supplier_details.name, 'Sambhaji Sales')
    assert.equal(payload.identifier, 'fk14g')
    assert.isTrue(payload.enable_hold)
    assert.isTrue(payload.include_all)
    assert.equal(payload.current_status, 1)
    assert.equal(payload.requested_status, 101)
    assert.equal(payload.max_transitions, 1996)
    assert.deepEqual(payload.filter, { label_downloaded: { status: false } })
    assert.isNull(payload.child_supplier_identifier)
    assert.isNull(payload.child_supplier_id)
  })

  test('buildDownloadLabelPayload preserves custom filter and transitions if supplied', ({
    assert,
  }) => {
    const payload = MeeshoLabelApiService.buildDownloadLabelPayload(dummySupplier, {
      filter: { date_range: { from: '2026-09-01' } },
      maxTransitions: 500,
    })

    assert.equal(payload.max_transitions, 500)
    assert.deepEqual(payload.filter, { date_range: { from: '2026-09-01' } })
  })

  test('findRequestInHistory strictly matches request_id and does not naively pick index 0', ({
    assert,
  }) => {
    const history: MeeshoLabelHistoryResponse = {
      data: [
        {
          request_id: '4339024_other_req_11111',
          status: 'PROCESSED',
          progress_percent: 100,
          label_url: 'https://storage.googleapis.com/labels/first.pdf',
        },
        {
          request_id: '4339024_fk14g_target_99999',
          status: 'VALIDATED_AND_DATA_FETCHED',
          progress_percent: 45,
          total_suborder_count: 10,
          success_suborder_count: 4,
          error_message: 'No penalty will be charged. Please try again later.',
        },
      ],
      is_polling: true,
      polling_time_ms: 10000,
    }

    const match = MeeshoLabelApiService.findRequestInHistory(history, '4339024_fk14g_target_99999')

    assert.isDefined(match)
    assert.equal(match!.request_id, '4339024_fk14g_target_99999')
    assert.equal(match!.progress_percent, 45)
    assert.equal(match!.success_suborder_count, 4)
    assert.equal(match!.error_message, 'No penalty will be charged. Please try again later.')
  })

  test('findRequestInHistory returns undefined if target request_id is not in list', ({
    assert,
  }) => {
    const history: MeeshoLabelHistoryResponse = {
      data: [
        {
          request_id: '4339024_other_req_11111',
          status: 'PROCESSED',
        },
      ],
    }

    const match = MeeshoLabelApiService.findRequestInHistory(history, 'non_existent_request')
    assert.isUndefined(match)
  })

  test('updateGroupDownloadBackendFlag endpoint is correctly configured', ({ assert }) => {
    assert.equal(
      MEESHO_ENDPOINTS.updateGroupDownloadBackendFlag,
      'https://supplier.meesho.com/api/fulfillment/orders/updateGroupDownloadBackendFlag'
    )
  })

  test('updateLabelDownloadStatus endpoint is correctly configured', ({ assert }) => {
    assert.equal(
      MEESHO_ENDPOINTS.updateLabelDownloadStatus,
      'https://supplier.meesho.com/api/fulfillment/orders/updateLabelDownloadStatus'
    )
  })
})
