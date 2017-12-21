'use strict'

require('./utils/reporter')

describe('Constraints', () =>
{
	const config = require('./utils/config')
	const DB = require('../lib/DB')
	const Node = require('../lib/Node')

	beforeAll(async() =>
	{
		DB.init(config.db.server, config.db.user, config.db.pass)
	})

	beforeEach(async() =>
	{
		await DB.query(`
			MATCH (n)
			DETACH DELETE n
		`)
	})

	afterAll(() =>
	{
		DB.exit()
	})

	it('should not throw an exception for unique names', async() =>
	{
		await DB.query(`
			CREATE (:Foo { name: 'foo' }),
				   (:Foo { name: 'bar' })
		`)

		class Foo extends Node {}

		Foo.addUnique('name')

		const node = new Foo({ name: 'baz' })

		await node.save()

		await Foo.dropUnique('name')
	})

	it('should throw an exception for duplicate names', async(done) =>
	{
		await DB.query(`
			CREATE (:Foo { name: 'foo' }),
				   (:Foo { name: 'bar' })
		`)

		class Foo extends Node {}

		Foo.addUnique('name')

		const node = new Foo({ name: 'baz' })

		await node.save()

		node.name = 'foo'

		try
		{
			await node.save()

			done.fail('An error should have been thrown')
		}
		catch (e)
		{
			expect(e.code).toBe('Neo.ClientError.Schema.ConstraintValidationFailed')
		}

		await Foo.dropUnique('name')

		done()
	})

	it('should not throw an exception for unique names after constraint is dropped', async() =>
	{
		await DB.query(`
			CREATE (:Foo { name: 'foo' }),
				   (:Foo { name: 'bar' })
		`)

		class Foo extends Node {}

		Foo.addUnique('name')

		const baz1 = new Foo({ name: 'baz' })

		await baz1.save()

		await Foo.dropUnique('name')

		const baz2 = new Foo({ name: 'baz' })

		await baz2.save()
	})

	it('should create and drop indexes', async() =>
	{
		class Foo extends Node {}

		await Foo.addIndex('name', true)

		const indexes1 = await DB.getIndexes()

		expect(indexes1.Foo.length).toBe(1)
		expect(indexes1.Foo.includes('name')).toBe(true)

		await Foo.dropIndex('name')

		const indexes2 = await DB.getIndexes()

		expect('Foo' in indexes2).toBe(false)
	})

	it('should get a node using a specific index', async() =>
	{
		await DB.query(`
			CREATE (n:Foo { name: 'foo' })
		`)

		class Foo extends Node {}

		await Foo.addIndex('name', true)

		Foo.find({ name: 'foo' }, { index: 'name' })

		await Foo.dropIndex('name')
	})

	it('should get a node using a specific index and label', async() =>
	{
		await DB.query(`
			CREATE (n:Foo { name: 'foo' })
		`)

		class Foo extends Node {}

		await Foo.addIndex('name', true)

		Foo.find({ name: 'foo' }, { index: 'Foo(name)' })

		await Foo.dropIndex('name')
	})
})
