'use strict'

require('./util/reporter')

describe('Label', () =>
{
	const config = require('./util/config')
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

	it('should be added to a new node', async() =>
	{
		const node = new Node()

		node.$labels.push('Foo')

		await node.save()

		const result = await Node.get(node.id)

		expect(result.$labels.length).toBe(2)
		expect(result.$labels[0]).toBe('Node')
		expect(result.$labels[1]).toBe('Foo')
	})

	it('should be added to an existing node', async() =>
	{
		await DB.query(`
			CREATE (n:Node { id: 'foo' })
		`)

		const node = await Node.get('foo')

		await node.addLabel('Foo')

		const result = await Node.get('foo')

		expect(result.$labels.length).toBe(2)
		expect(result.$labels[0]).toBe('Node')
		expect(result.$labels[1]).toBe('Foo')
	})

	it('should add multiple to an existing node', async() =>
	{
		await DB.query(`
			CREATE (n:Node { id: 'foo' })
		`)

		const node = await Node.get('foo')

		expect(node.$labels.length).toBe(1)
		expect(node.$labels[0]).toBe('Node')

		await node.addLabels(['Foo', 'Bar'])

		const result = await Node.get('foo')

		expect(result.$labels.length).toBe(3)
		expect(result.$labels[0]).toBe('Node')
		expect(result.$labels[1]).toBe('Foo')
		expect(result.$labels[2]).toBe('Bar')
	})

	it('should be removed from a node', async() =>
	{
		await DB.query(`
			CREATE (n:Node:Foo { id: 'foo' })
		`)

		const node = await Node.get('foo')

		expect(node.$labels.length).toBe(2)
		expect(node.$labels[0]).toBe('Node')
		expect(node.$labels[1]).toBe('Foo')

		await node.removeLabel('Foo')

		const result = await Node.get('foo')

		expect(result.$labels.length).toBe(1)
		expect(result.$labels[0]).toBe('Node')
	})

	it('should remove multiple from a node', async() =>
	{
		await DB.query(`
			CREATE (n:Node:Foo:Bar { id: 'foo' })
		`)

		const node = await Node.get('foo')

		expect(node.$labels.length).toBe(3)
		expect(node.$labels[0]).toBe('Node')
		expect(node.$labels[1]).toBe('Foo')
		expect(node.$labels[2]).toBe('Bar')

		await node.removeLabels(['Foo', 'Bar'])

		const result = await Node.get('foo')

		expect(result.$labels.length).toBe(1)
		expect(result.$labels[0]).toBe('Node')
	})
})
