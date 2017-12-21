'use strict'

require('./utils/reporter')

describe('Extended Node', () =>
{
	const config = require('./utils/config')
	const DB = require('../lib/DB')
	const Node = require('../lib/Node')

	class Foo extends Node
	{
		static async find()
		{
			return 'foo'
		}

		static async all(o = {})
		{
			return await Node.find.call(this, null, o)
		}
	}

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

	it('should overwrite existing methods', async() =>
	{
		const foo = await Foo.get()

		expect(foo).toBe('foo')
	})

	it('should be able to call super methods', async() =>
	{
		await DB.query(`
			CREATE (n1:Foo), (n2:Foo)
		`)

		const foos = await Foo.all()

		expect(foos.length).toBe(2)
	})

	it('should have inherited labels', () =>
	{
		class Extended extends Foo
		{

		}

		const foo = new Extended()

		expect(foo.$labels.length).toBe(2)
		expect(foo.$labels.includes('Foo')).toBe(true)
		expect(foo.$labels.includes('Extended')).toBe(true)
	})
})
