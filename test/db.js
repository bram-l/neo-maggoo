'use strict'

describe('DB', () =>
{
	it('should not have an active db connection', () =>
	{
		const DB = require('../lib/DB')

		expect(DB.driver).toBeUndefined()
	})

	describe('Database Connection', () =>
	{
		const config = require('./util/config')
		const DB = require('../lib/DB')

		it('should not have an active db session after connection', () =>
		{
			expect(DB.driver).toBeUndefined()

			DB.init(config.db.server, config.db.user, config.db.pass)

			expect(DB.driver).toBeDefined()

			DB.exit()

			expect(DB.driver).toBeUndefined()
		})
	})

	describe('Database Content', () =>
	{
		const config = require('./util/config')
		const DB = require('../lib/DB')

		beforeEach((done) =>
		{
			DB.init(config.db.server, config.db.user, config.db.pass)

			DB.query(`
					MATCH (n)
					DETACH DELETE n
				`)
				.then(() => done())
				.catch((err) => done.fail(err))
		})

		afterEach(() =>
		{
			DB.exit()
		})

		it('should be empty', (done) =>
		{
			DB
				.query(`
					MATCH (n)
					RETURN count(n) as total
				`)
				.then(result =>
				{
					expect(result.records.length).toBeGreaterThan(0)
					expect(result.records[0].get(0).toNumber()).toBe(0)

					done()
				})
				.catch((err) =>
				{
					console.error(err)
					done.fail(err.fields ? err.fields.message : err)
				})
		})
	})
})
