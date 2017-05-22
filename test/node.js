'use strict'

require('./util/reporter')

describe('Node', () =>
{
	const config = require('./util/config')
	const DB = require('../lib/DB')
	const Node = require('../lib/Node')

	beforeAll(async () =>
	{
		DB.init(config.db.server, config.db.user, config.db.pass)
	})

	beforeEach(async () =>
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

	it('should return $id null for a new Node', () =>
	{
		const node = new Node()

		expect(node.$id).toBe(null)
	})

	it('should return the total number of current Nodes', async () =>
	{
		const result = await Node.count()

		expect(result).toBe(0)
	})

	it('should return an empty array when no nodes found', async() =>
	{
		const nodes = await Node.all()

		expect(nodes.length).toBe(0)
	})

	it('should find all nodes by Label', async () =>
	{
		await DB.query(`
			CREATE (n1:Node), (n2:Node), (n3:Foo)
		`)

		const nodes = await Node.all()

		expect(nodes.length).toBe(2)
	})

	it('should return null when no nodes found by id', async() =>
	{
		const node = await Node.get('foo')

		expect(node).toBe(null)
	})

	it('should find a node by id (string)', async () =>
	{
		await DB.query(`
			CREATE (n:Node {id: 'foo'})
		`)

		const foo = await Node.get('foo')

		expect(foo.id).toBe('foo')
	})

	it('should find a node by a node identifier (number)', async () =>
	{
		await DB.query(`
			CREATE (n:Node {id: 'foo'})
		`)

		const foo = await Node.get('foo')

		const bar = await Node.get(foo.$id)

		expect(foo.id).toBe(bar.id)
	})

	it('should find a node by a filter', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', name: 'foo'}),
			(n2:Node {id: 'bar', name: 'foo'}),
			(n3:Node {id: 'baz', name: 'baz'})
		`)

		const nodes = await Node.find({ name: 'foo' })

		expect(nodes.length).toBe(2)
		expect(['foo', 'bar'].includes(nodes[0].id)).toBe(true)
		expect(['foo', 'bar'].includes(nodes[1].id)).toBe(true)
	})

	it('should return the total number of nodes by filter', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', name: 'foo'}),
			(n2:Node {id: 'bar', name: 'foo'}),
			(n3:Node {id: 'baz', name: 'baz'})
		`)

		const result = await Node.count({ name: 'foo' })

		expect(result).toBe(2)
	})

	it('should return the total number of nodes by query', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', name: 'foo'}),
			(n2:Node {id: 'bar', name: 'foo'}),
			(n3:Node {id: 'baz', name: 'baz'})
			MERGE (n2)-[:knows]->(n1)
			MERGE (n3)-[:knows]->(n1)
		`)

		const result = await Node.count('(n)-[:knows]->({ name: {name}})', { name: 'foo' })

		expect(result).toBe(2)
	})

	it('should find a node by a Regular expression', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', name: 'foo'}),
			(n2:Node {id: 'bar', name: 'bar'}),
			(n3:Node {id: 'baz', name: 'baz'})
		`)

		const nodes = await Node.find({ name: /foo|bar/ })

		expect(nodes.length).toBe(2)

		const expected = [
			'foobar',
			'barfoo'
		]
		const ids = nodes[0].id + nodes[1].id

		expect(expected.includes(ids)).toBe(true)
	})

	it('should find a node with a `where` clause', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', qux: 1}),
			(n2:Node {id: 'bar', qux: 2}),
			(n3:Node {id: 'baz', qux: 3})
		`)

		const nodes = await Node.where('n.qux > {qux}', { qux: 2 })

		expect(nodes.length).toBe(1)
		expect(nodes[0].id).toBe('baz')
	})

	it('should find a node with multiple `where` clauses', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', qux: 1}),
			(n2:Node {id: 'bar', qux: 2}),
			(n3:Node {id: 'baz', qux: 3})
		`)

		const nodes = await Node.where([
			'n.qux > {qux}',
			'n.id = {id}'
		], { qux: 2, id: 'baz' })

		expect(nodes.length).toBe(1)
		expect(nodes[0].id).toBe('baz')
	})

	it('should find a node by a query', async () =>
	{
		await DB.query(`
			CREATE (n1:Node {id: 'foo', qux: 1}),
			(n2:Node {id: 'bar', qux: 2}),
			(n3:Node {id: 'baz', qux: 3})
		`)

		const nodes = await Node.query(`
			MATCH (n:Node)
			WHERE n.qux > {qux}
		`, { qux: 2 })

		expect(nodes.length).toBe(1)
		expect(nodes[0].id).toBe('baz')
	})

	it('should save a new entry and set a valid id', async () =>
	{
		const node = new Node()
		const shortid = require('shortid')

		expect(node.$new).toBe(true)
		expect(node.$dirty).toBe(true)

		await node.save()

		expect(shortid.isValid(node.id)).toBe(true)
		expect(node.$new).toBe(false)
		expect(node.$dirty).toBe(false)

		const total = await Node.count()

		expect(total).toBe(1)
	})

	it('should update an existing node', async () =>
	{
		const node = new Node()

		node.foo = 'foo'

		await node.save()

		let results = await Node.find({ foo: 'foo' })

		expect(results.length).toBe(1)
		expect(results[0].id).toBe(node.id)
		expect(results[0].foo).toBe('foo')

		node.foo = 'bar'

		await node.save()

		results = await Node.find({ foo: 'foo' })

		expect(results.length).toBe(0)
	})

	it('should be deleted', async () =>
	{
		const node = new Node()

		await node.save()

		let total = await Node.count()

		expect(total).toBe(1)

		await node.delete()

		total = await Node.count()

		expect(total).toBe(0)
		expect(node.id).toBe(null)
		expect(node.$entity).toBe(null)
	})

	it('should throw an error when deleting an unsaved node', async () =>
	{
		const node = new Node()

		try
		{
			await node.delete()

			fail('An error should have been thrown')
		}
		catch (error)
		{
			expect(error.message).toBe('Can not delete a node without ID')
		}
	})

	it('should order nodes', async () =>
	{
		await DB.query(`
			CREATE (n1:Node { name: 'foo' }),
			(n2:Node { name: 'bar' }),
			(n3:Node { name: 'baz' })
		`)

		const nodes = await Node.all({
			orderBy: 'n.name'
		})

		expect(nodes.length).toBe(3)
		expect(nodes[0].name).toBe('bar')
		expect(nodes[1].name).toBe('baz')
		expect(nodes[2].name).toBe('foo')
	})

	it('should skip nodes', async () =>
	{
		await DB.query(`
			CREATE (n1:Node { name: 'foo' }),
			(n2:Node { name: 'bar' }),
			(n3:Node { name: 'baz' })
		`)

		const nodes = await Node.all({
			orderBy: 'n.name',
			skip: 1
		})

		expect(nodes.length).toBe(2)
		expect(nodes[0].name).toBe('baz')
		expect(nodes[1].name).toBe('foo')
	})

	it('should limit nodes', async () =>
	{
		await DB.query(`
			CREATE (n1:Node { name: 'foo' }),
			(n2:Node { name: 'bar' }),
			(n3:Node { name: 'baz' })
		`)

		const nodes = await Node.all({
			orderBy: 'n.name',
			limit: 2
		})

		expect(nodes.length).toBe(2)
		expect(nodes[0].name).toBe('bar')
		expect(nodes[1].name).toBe('baz')
	})

	it('should throw an error for an invalid filter object', async () =>
	{
		try
		{
			await Node.find(['foo'])

			fail('An error should have been thrown')
		}
		catch (e)
		{
			expect(e.message).toBe('Invalid filter object: foo')
		}
	})
})
