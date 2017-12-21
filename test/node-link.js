'use strict'

require('./utils/reporter')

describe('Link', () =>
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

	it('should return null if node is not part of a graph', async() =>
	{
		const node = new Node()

		expect(node.getLinked('foo')).toBe(null)
	})

	it('should return null if no links are defined in the graph', async() =>
	{
		const node = new Node()

		await node.save()

		expect(node.getLinked('foo')).toBe(null)
	})

	it('should be created', async() =>
	{
		await DB.query(`
			CREATE (a:Node { id: 'foo', name: 'foo' }),
				   (b:Node { id: 'bar', name: 'bar' }),
				   (c:Node { id: 'baz', name: 'foo' })
		`)

		const nodes = await Node.query(`
			MATCH (n:Node), (other:Node)
			WHERE n.name = other.name
			AND NOT n = other
		`, {}, {
				return: 'n, other',
				links: {
					other: {
						singular: true
					}
				}
			})

		expect(nodes.length).toBe(2)
		expect(nodes[0].name).toBe('foo')
		expect(nodes[1].name).toBe('foo')

		expect(nodes[0].$graph.nodes.size).toBe(2)
		expect(nodes[0].$graph.relationships.size).toBe(0)

		expect(nodes[0].other.id).toEqual(nodes[1].id)
		expect(nodes[0].other.name).toEqual(nodes[1].name)
		expect(nodes[1].other.id).toEqual(nodes[0].id)
		expect(nodes[1].other.name).toEqual(nodes[0].name)
	})

	it('should be created using a custom model', async() =>
	{
		await DB.query(`
			CREATE (a:Foo { id: 'foo', name: 'foo' }),
				   (b:Foo { id: 'bar', name: 'bar' }),
				   (c:Foo { id: 'baz', name: 'foo' })
		`)

		class Foo extends Node {}

		const nodes = await Node.query(`
			MATCH (n:Foo), (other:Foo)
			WHERE n.name = other.name
			AND NOT n = other
		`, {}, {
				return: 'n, other',
				models: {
					other: Foo
				},
				links: {
					other: {
						start: 'n',
						end: 'other',
						singular: true
					}
				}
			})

		expect(nodes.length).toBe(2)
		expect(nodes[0].name).toBe('foo')
		expect(nodes[1].name).toBe('foo')

		expect(nodes[0].$graph.nodes.size).toBe(2)
		expect(nodes[0].$graph.relationships.size).toBe(0)

		expect(nodes[0].other.id).toEqual(nodes[1].id)
		expect(nodes[0].other.name).toEqual(nodes[1].name)
		expect(nodes[1].other.id).toEqual(nodes[0].id)
		expect(nodes[1].other.name).toEqual(nodes[0].name)
	})

	it('should be created using a custom model', async() =>
	{
		await DB.query(`
			CREATE (a:Foo { id: 'foo', name: 'foo' }),
				   (b:Foo { id: 'bar', name: 'foo' }),
				   (c:Foo { id: 'baz', name: 'foo' }),
				   (d:Foo { id: 'qux', name: 'qux' })
		`)

		class Foo extends Node {}

		const nodes = await Node.query(`
			MATCH (n:Foo), (other:Foo)
			WHERE n.name = other.name
			AND NOT n = other
		`, {}, {
				return: 'n, collect(other) as others',
				models: {
					others: Foo.Collection
				},
				links: {
					others: {
						start: 'n',
						end: 'others'
					}
				}
			})

		expect(nodes.length).toBe(3)
		expect(nodes[0].name).toBe('foo')
		expect(nodes[1].name).toBe('foo')
		expect(nodes[2].name).toBe('foo')

		expect(nodes[0].$graph.nodes.size).toBe(3)
		expect(nodes[0].$graph.relationships.size).toBe(0)

		expect(nodes[0].others.length).toEqual(2)
		expect(nodes[0].others[0].name).toEqual('foo')
		expect(nodes[0].others[0].id).not.toEqual(nodes[0].id)
		expect(nodes[0].others[1].id).not.toEqual(nodes[0].id)
		expect(nodes[0].others[0].id).not.toEqual(nodes[0].others[1].id)
	})
})
