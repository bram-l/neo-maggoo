'use strict'

require('./utils/reporter')

describe('Node', () =>
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

	it('should create a new node if none matches the label', async() =>
	{
		const node = await Node.merge({}, { id: 'foo', name: 'bar' })

		expect(node.id).toBe('foo')
		expect(node.name).toBe('bar')

		const total = await Node.count()

		expect(total).toBe(1)
	})

	it('should create a new node if none matches the criteria', async() =>
	{
		const node = await Node.merge({ id: 'foo' }, { name: 'bar' })

		expect(node.id).toBe('foo')
		expect(node.name).toBe('bar')

		const total = await Node.count()

		expect(total).toBe(1)
	})

	it('should merge node properties if one matches the criteria', async() =>
	{
		await DB.query(`
			CREATE (:Node {id: 'foo', name: 'foo' })
		`)

		const node = await Node.merge({ id: 'foo' }, { name: 'bar' })

		expect(node.id).toBe('foo')
		expect(node.name).toBe('bar')

		const total = await Node.count()

		expect(total).toBe(1)
	})

	it('should add created timestamp on a new node if it is created', async() =>
	{
		const node = await Node.merge({ id: 'foo' }, { name: 'bar' }, {
			onCreate: 'SET n.created = timestamp()',
			onMatch: 'SET n.updated = timestamp()'
		})

		expect(node.id).toBe('foo')
		expect(node.name).toBe('bar')
		expect(node.created > 0).toBe(true)
		expect(node.updated > 0).toBe(false)

		const total = await Node.count()

		expect(total).toBe(1)
	})

	it('should merge node properties if one matches the criteria', async() =>
	{
		await DB.query(`
			CREATE (:Node {id: 'foo', name: 'foo', created: 1 })
		`)

		const node = await Node.merge({ id: 'foo' }, { name: 'bar' }, {
			onCreate: 'SET n.created = timestamp()',
			onMatch: 'SET n.updated = timestamp()'
		})

		expect(node.id).toBe('foo')
		expect(node.name).toBe('bar')
		expect(node.updated > 0).toBe(true)
		expect(node.created > 0).toBe(true)

		const total = await Node.count()

		expect(total).toBe(1)
	})
})
