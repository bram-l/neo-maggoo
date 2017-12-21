'use strict'

require('./utils/reporter')

describe('Graph', () =>
{
	const config = require('./utils/config')
	const DB = require('../lib/DB')
	const Graph = require('../lib/Graph')
	const Node = require('../lib/Node')

	beforeAll(() =>
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

	it('should add nodes from constructor results', async() =>
	{
		await DB.query(`
			CREATE (:Node)-[:is_related_to]->(:Node)
		`)

		const results = await DB.query('MATCH (n:Node)-[r:is_related_to]->(o:Node) RETURN n, r, o')

		const graph = new Graph(results)

		expect(graph.nodes.size).toBe(2)
		expect(graph.relationships.size).toBe(1)
	})

	it('should add nodes from build results', async() =>
	{
		await DB.query(`
			CREATE (:Node)-[:is_related_to]->(:Node)
		`)

		const graph = await Graph.build('MATCH (n:Node)-[r:is_related_to]->(o:Node) RETURN n, r, o')

		expect(graph.nodes.size).toBe(2)
		expect(graph.relationships.size).toBe(1)
	})

	it('should add more nodes', async() =>
	{
		await DB.query(`
			CREATE (foo:Node { id:'foo' }), (bar:Node { id:'bar' }), (baz:Node { id:'baz' }),
			(foo)-[:is_related_to]->(bar),
			(bar)-[:is_related_to]->(baz)
		`)

		const graph = await Graph.build(`
			MATCH (foo:Node)-[r:is_related_to]->(bar:Node)
			WHERE foo.id = {id}
			RETURN foo, bar, r
		`, { id: 'foo' }, { foo: Node })

		expect(graph.nodes.size).toBe(2)
		expect(graph.relationships.size).toBe(1)

		await graph.run(`
			MATCH (bar:Node)-[r:is_related_to]->(baz:Node)
			WHERE bar.id = 'bar'
			RETURN bar, baz, r
		`)

		expect(graph.nodes.size).toBe(3)
		expect(graph.relationships.size).toBe(2)
	})

	it('should remove nodes', async() =>
	{
		await DB.query(`
			CREATE (foo:Node { id:'foo' }), (bar:Node { id:'bar' }), (baz:Node { id:'baz' })
		`)

		const graph = await Graph.build(`
			MATCH (n:Node)
			RETURN n
		`, {}, { n: Node })

		expect(graph.nodes.size).toBe(3)

		const nodes = Array.from(graph.nodes.values())

		graph.remove(nodes)

		expect(graph.nodes.size).toBe(0)
	})

	it('should add linked value', async() =>
	{
		await DB.query(`
			CREATE (foo:Node { id:'foo' }), (bar:Node { id:'bar' }), (baz:Node { id:'baz' }),
			(foo)-[:is_related_to]->(bar),
			(foo)-[:is_related_to]->(baz)
		`)

		const graph = await Graph.build(`
			MATCH (n:Node)-[r:is_related_to]->(o:Node)
			RETURN n, COUNT(o) as others
		`, {}, {
				n: Node
			}, {
				others: { singular: true }
			})

		expect(graph.nodes.size).toBe(1)
		expect(graph.relationships.size).toBe(0)
		expect(graph.references.n.length).toBe(1)
		expect(graph.references.others.length).toBe(1)

		const n = graph.references.n[0]
		const node = graph.nodes.get(n)
		const others = graph.getLinked(node, 'others')

		expect(parseInt(others)).toBe(2)
	})

	it('should return for undefined links', async() =>
	{
		await DB.query(`
			CREATE (:Node)
		`)

		const graph = await Graph.build('MATCH (n:Node) RETURN n', {}, { n: Node })

		const linked = graph.getLinked()

		expect(linked).toBe(null)
	})

	it('should add linked nodes', async() =>
	{
		await DB.query(`
			CREATE (foo:Node { id:'foo' }), (bar:Node { id:'bar' }), (baz:Node { id:'baz' }),
			(foo)-[:is_related_to]->(bar),
			(foo)-[:is_related_to]->(baz)
		`)

		const graph = await Graph.build(`
			MATCH (n:Node)-[]->(o:Node)
			RETURN n, o
		`, {}, {
				n: Node
			}, {
				others: {
					end: 'o'
				}
			})

		expect(graph.nodes.size).toBe(3)
		expect(graph.relationships.size).toBe(0)
		expect(graph.references.n.length).toBe(2)
		expect(graph.references.o.length).toBe(2)

		const first = graph.references.n[0]
		const node = graph.nodes.get(first)
		const others = graph.getLinked(node, 'others')

		expect(others.length).toBe(2)

		const valid = ['bar', 'baz']

		expect(valid.includes(others[0].id)).toBe(true)
		expect(valid.includes(others[1].id)).toBe(true)
		expect(others[0].id).not.toEqual(others[1].id)
	})

	it('should add more linked nodes', async() =>
	{
		await DB.query(`
			CREATE (foo:Node { id:'foo' }), (bar:Node { id:'bar' }), (baz:Node { id:'baz' }),
			(foo)-[:is_related_to]->(bar),
			(foo)-[:is_related_to]->(baz)
		`)

		const graph = await Graph.build(`
			MATCH (n:Node)
			WHERE n.id = {id}
			RETURN n
		`, { id: 'foo' }, {
				n: Node
			})

		expect(graph.nodes.size).toBe(1)
		expect(graph.relationships.size).toBe(0)

		const first = graph.references.n[0]
		const node = graph.nodes.get(first)

		await graph.run(`
			MATCH (n:Node)-[]->(o:Node)
			RETURN n, o
		`, {}, {
				n: Node
			}, {
				others: {
					end: 'o'
				}
			})

		expect(graph.nodes.size).toBe(3)
		expect(graph.relationships.size).toBe(0)

		const others = graph.getLinked(node, 'others')

		const valid = ['bar', 'baz']

		expect(valid.includes(others[0].id)).toBe(true)
		expect(valid.includes(others[1].id)).toBe(true)
		expect(others[0].id).not.toEqual(others[1].id)
	})

	it('should throw an error when a node is not found', async(done) =>
	{
		await DB.query(`
			CREATE (foo:Node { id:'foo' }), (bar:Node { id:'bar' }), (baz:Node { id:'baz' }),
			(foo)-[:is_related_to]->(bar),
			(foo)-[:is_related_to]->(baz)
		`)

		const graph = await Graph.build(`
			MATCH (n:Node)
			RETURN n
		`)

		try
		{
			graph.getNodeModel('foo')
			done.fail('An error should be thrown')
		}
		catch (e)
		{
			expect(e.message).toBe('Node not found')
			done()
		}
	})

	it('should throw an error when no map is found', async() =>
	{
		const graph = new Graph()

		try
		{
			graph.getMap('foo')
			fail('An error should be thrown')
		}
		catch (e)
		{
			expect(e.message).toBe('No map defined for this entity: foo')
		}
	})

	it('should return null when no entity is found', async() =>
	{
		const entity = Graph.getEntity('foo')

		expect(entity).toBe(null)
	})

	it('should return null for an invalid id', async() =>
	{
		const foo = Graph.getId('foo')

		expect(foo).toBe(null)
	})

	it('should return an integer as id', async() =>
	{
		const id = Graph.getId(1)

		expect(id).toBe(1)
	})

	it('should return an id for an Node', async() =>
	{
		class Foo extends Node
		{
			get $id()
			{
				return 1
			}
		}

		const foo = new Foo()

		expect(Graph.getId(foo)).toBe(1)
	})
})
