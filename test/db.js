'use strict'

require('./util/reporter')

describe('DB', () =>
{
	it('should not have an active db connection', () =>
	{
		const DB = require('../lib/DB')

		expect(DB.driver).toBeUndefined()
	})

	describe('connection', () =>
	{
		const config = require('./util/config')
		const DB = require('../lib/DB')

		it('should throw an error before it is initialized', (done) =>
		{
			try
			{
				DB.session()
				done.fail('An error should have been thrown')
			}
			catch (error)
			{
				expect(error.message).toBe('Database not initialized')
				done()
			}
		})

		it('should set initialized after init', () =>
		{
			expect(DB.state.initialized).toBe(false)
			expect(DB.state.driver).toBe(null)

			DB.init(config.db.server, config.db.user, config.db.pass)

			expect(DB.state.initialized).toBe(true)
			expect(DB.state.driver).not.toBe(null)

			DB.exit()

			expect(DB.state.initialized).toBe(false)
			expect(DB.state.driver).toBe(null)
		})

		it('should not throw an error when exit is called multiple times', () =>
		{
			DB.init(config.db.server, config.db.user, config.db.pass)
			DB.init(config.db.server, config.db.user, config.db.pass)
		})

		it('should not throw an error when exit is called multiple times', () =>
		{
			DB.exit()
			DB.exit()
		})
	})

	describe('content', () =>
	{
		const config = require('./util/config')
		const DB = require('../lib/DB')

		beforeEach(async() =>
		{
			DB.init(config.db.server, config.db.user, config.db.pass)

			await DB.query(`
				MATCH (n)
				DETACH DELETE n
			`)
		})

		afterEach(() =>
		{
			DB.exit()
		})

		it('should be empty', async() =>
		{
			const result = await DB.query(`
				MATCH (n)
				RETURN count(n) as total
			`)

			expect(result.records.length).toBeGreaterThan(0)
			expect(result.records[0].get(0).toNumber()).toBe(0)
		})

		it('should thrown an error for an invalid query', async () =>
		{
			try
			{
				await DB.query('foo')
				fail('An error should have been thrown')
			}
			catch (e)
			{
				expect(e).not.toBe(null)
			}
		})

		it('should set an index', async () =>
		{
			await DB.addIndex('Foo', 'foo')

			const indexes1 = await DB.getIndexes()

			expect(indexes1.Foo.length).toBe(1)
			expect(indexes1.Foo.includes('foo')).toBe(true)

			await DB.dropIndex('Foo', 'foo')

			const indexes2 = await DB.getIndexes()

			expect('Foo' in indexes2).toBe(false)
		})

		it('should not duplicate indexes', async () =>
		{
			require('../lib/Node')

			const indexes1 = await DB.getIndexes()

			expect(indexes1.Node.length).toBe(1)
			expect(indexes1.Node.includes('id')).toBe(true)

			await DB.addIndex('Node', 'id')

			const indexes2 = await DB.getIndexes()

			expect(indexes2.Node.length).toBe(1)
			expect(indexes2.Node.includes('id')).toBe(true)

			// Try one more time after resetting constraints cache
			DB.state.constraints = {}

			await DB.addIndex('Node', 'id')

			const indexes3 = await DB.getIndexes()

			expect(indexes3.Node.length).toBe(1)
			expect(indexes3.Node.includes('id')).toBe(true)
		})

		it('should drop an index', async () =>
		{
			require('../lib/Node')

			const indexes1 = await DB.getIndexes()

			expect(indexes1.Node.length).toBe(1)
			expect(indexes1.Node.includes('id')).toBe(true)

			await DB.addIndex('Node', 'foo')

			const indexes2 = await DB.getIndexes()

			expect(indexes2.Node.length).toBe(2)
			expect(indexes2.Node.includes('id')).toBe(true)
			expect(indexes2.Node.includes('foo')).toBe(true)

			await DB.dropIndex('Node', 'foo')

			const indexes3 = await DB.getIndexes()

			expect(indexes3.Node.length).toBe(1)
			expect(indexes3.Node.includes('id')).toBe(true)
		})

		it('should set a unique constraint', async () =>
		{
			await DB.addUnique('Foo', 'foo')

			const constraints1 = await DB.getUnique()

			expect(constraints1.Foo.length).toBe(1)
			expect(constraints1.Foo.includes('foo')).toBe(true)

			await DB.dropUnique('Foo', 'foo')

			const constraints2 = await DB.getUnique()

			expect('Foo' in constraints2).toBe(false)
		})
	})
})
