import { test } from '@japa/runner'
import User from '#models/user'
import Account from '#models/account'
import MeeshoLabelJob from '#models/meesho_label_job'
import MeeshoLabelSchedule from '#models/meesho_label_schedule'
import { randomUUID } from 'node:crypto'

test.group('MeeshoLabelsController Functional Tests', (group) => {
  let user: User
  let otherUser: User
  let account1: Account
  let account2: Account
  let otherUserAccount: Account

  group.setup(async () => {
    // Setup test users and accounts
    user = await User.create({
      email: `seller_${Date.now()}@example.com`,
      password: 'password123',
    })

    otherUser = await User.create({
      email: `other_${Date.now()}@example.com`,
      password: 'password123',
    })

    account1 = await Account.create({
      userId: user.id,
      email: `account1_${Date.now()}@meesho.com`,
      password: 'pwd',
      sessionStatus: 'active',
    })

    account2 = await Account.create({
      userId: user.id,
      email: `account2_${Date.now()}@meesho.com`,
      password: 'pwd',
      sessionStatus: 'active',
    })

    otherUserAccount = await Account.create({
      userId: otherUser.id,
      email: `other_acc_${Date.now()}@meesho.com`,
      password: 'pwd',
      sessionStatus: 'active',
    })
  })

  group.teardown(async () => {
    await MeeshoLabelJob.query().where('user_id', user.id).delete()
    await MeeshoLabelSchedule.query().where('user_id', user.id).delete()
    await Account.query().whereIn('id', [account1.id, account2.id, otherUserAccount.id]).delete()
    await User.query().whereIn('id', [user.id, otherUser.id]).delete()
  })

  test('POST /meesho/labels/download requires authentication', async ({ client }) => {
    const response = await client.post('/meesho/labels/download').json({
      accountIds: [account1.id],
    })

    response.assertStatus(401)
  })

  test('POST /meesho/labels/download validates accountIds array is non-empty', async ({
    client,
  }) => {
    const response = await client.post('/meesho/labels/download').loginAs(user).json({
      accountIds: [],
    })

    response.assertStatus(422)
  })

  test('POST /meesho/labels/download returns 403 if user tries to download for accounts they do not own', async ({
    client,
  }) => {
    const response = await client
      .post('/meesho/labels/download')
      .loginAs(user)
      .json({
        accountIds: [account1.id, otherUserAccount.id],
      })

    response.assertStatus(403)
  })

  test('POST /meesho/labels/download queues job successfully for owned accounts', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/meesho/labels/download')
      .loginAs(user)
      .json({
        accountIds: [account1.id, account2.id],
      })

    response.assertStatus(201)
    const body = response.body()
    assert.isDefined(body.jobId)
    assert.equal(body.status, 'QUEUED')
    assert.equal(body.totalAccounts, 2)

    const jobInDb = await MeeshoLabelJob.find(body.jobId)
    assert.isNotNull(jobInDb)
    assert.equal(jobInDb!.userId, user.id)
    assert.equal(jobInDb!.totalAccounts, 2)
  })

  test('GET /meesho/labels/jobs lists user jobs paginated', async ({ client, assert }) => {
    const response = await client.get('/meesho/labels/jobs').loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isArray(body.data)
    assert.isDefined(body.meta)
    assert.isAbove(body.data.length, 0)
  })

  test('GET /meesho/labels/jobs/:id returns 404 for non-existent job', async ({ client }) => {
    const response = await client.get(`/meesho/labels/jobs/${randomUUID()}`).loginAs(user)

    response.assertStatus(404)
  })

  test('GET /meesho/labels/jobs/:id/progress returns progress summary', async ({
    client,
    assert,
  }) => {
    // Create a dummy job
    const job = await MeeshoLabelJob.create({
      id: randomUUID(),
      userId: user.id,
      type: 'manual',
      status: 'PROCESSING',
      totalAccounts: 1,
      completedAccounts: 0,
      failedAccounts: 0,
    })

    const response = await client.get(`/meesho/labels/jobs/${job.id}/progress`).loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.jobId, job.id)
    assert.equal(body.status, 'PROCESSING')
    assert.isArray(body.accounts)
  })

  test('schedule CRUD: create, list, show, toggle, and delete schedule', async ({
    client,
    assert,
  }) => {
    // 1. Create Schedule
    const createRes = await client
      .post('/meesho/labels/schedules')
      .loginAs(user)
      .json({
        name: 'Morning Labels Run',
        timezone: 'Asia/Kolkata',
        frequency: 'daily',
        runTime: '09:30',
        accountIds: [account1.id],
      })

    createRes.assertStatus(201)
    const created = createRes.body().data
    assert.equal(created.name, 'Morning Labels Run')
    assert.isTrue(created.enabled)
    assert.isDefined(created.nextRunAt)

    const scheduleId = created.id

    // 2. List Schedules
    const listRes = await client.get('/meesho/labels/schedules').loginAs(user)
    listRes.assertStatus(200)
    assert.isTrue(listRes.body().data.some((s: any) => s.id === scheduleId))

    // 3. Show Schedule
    const showRes = await client.get(`/meesho/labels/schedules/${scheduleId}`).loginAs(user)
    showRes.assertStatus(200)
    assert.equal(showRes.body().data.id, scheduleId)

    // 4. Toggle Schedule
    const toggleRes = await client
      .patch(`/meesho/labels/schedules/${scheduleId}/toggle`)
      .loginAs(user)

    toggleRes.assertStatus(200)
    assert.isFalse(toggleRes.body().data.enabled)

    // 5. Delete Schedule
    const delRes = await client.delete(`/meesho/labels/schedules/${scheduleId}`).loginAs(user)

    delRes.assertStatus(200)

    const deletedInDb = await MeeshoLabelSchedule.find(scheduleId)
    assert.isNull(deletedInDb)
  })
})
