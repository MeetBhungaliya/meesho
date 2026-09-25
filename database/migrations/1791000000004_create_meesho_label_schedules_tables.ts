import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('meesho_label_schedules', (table) => {
      table.increments('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('name', 255).notNullable()
      table.string('timezone', 64).notNullable().defaultTo('Asia/Kolkata')
      table.string('frequency', 32).notNullable().defaultTo('daily') // 'daily' | 'weekly' | 'custom_cron'
      table.string('run_time', 16).notNullable().defaultTo('09:30') // 'HH:mm'
      table.jsonb('days_of_week').nullable() // e.g. [1, 3, 5] for Mon, Wed, Fri
      table.string('cron_expression', 64).nullable()
      table.boolean('enabled').notNullable().defaultTo(true)
      table.jsonb('filter').nullable()

      table.timestamp('next_run_at', { useTz: true }).nullable()
      table.timestamp('last_run_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())

      table.index(['user_id'])
      table.index(['enabled', 'next_run_at'])
    })

    this.schema.createTable('meesho_label_schedule_accounts', (table) => {
      table.increments('id').primary()
      table
        .integer('schedule_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('meesho_label_schedules')
        .onDelete('CASCADE')

      table
        .integer('account_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('accounts')
        .onDelete('CASCADE')

      table.unique(['schedule_id', 'account_id'])
    })

    this.schema.createTable('meesho_label_schedule_runs', (table) => {
      table.increments('id').primary()
      table
        .integer('schedule_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('meesho_label_schedules')
        .onDelete('CASCADE')

      table.timestamp('scheduled_for', { useTz: true }).notNullable()
      table
        .uuid('job_id')
        .nullable()
        .references('id')
        .inTable('meesho_label_jobs')
        .onDelete('SET NULL')

      table.string('status', 32).notNullable().defaultTo('PENDING') // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()

      table.unique(['schedule_id', 'scheduled_for'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('meesho_label_schedule_runs')
    this.schema.dropTableIfExists('meesho_label_schedule_accounts')
    this.schema.dropTableIfExists('meesho_label_schedules')
  }
}
