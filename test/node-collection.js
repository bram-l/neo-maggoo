'use strict'

require('./util/reporter')

describe('NodeCollection', () =>
{
	const config = require('./util/config')
	const NodeCollection = require('../lib/NodeCollection')
	const DB = require('../lib/DB')
	const Node = require('../lib/Node')
	const Relationship = require('../lib/Relationship')

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

	it('should call delete on all nodes', async () =>
	{
		await DB.query(`
			CREATE (n1:Node { id: 'foo' }), (n2:Node { id: 'bar' }), (n3:Node { id: 'baz' })
		`)

		const nodes = await Node.all()

		expect(nodes instanceof NodeCollection).toBe(true)

		await nodes.delete()

		const total = await Node.count()

		expect(total).toBe(0)
	})

	it('should call save on all nodes', async () =>
	{
		await DB.query(`
			CREATE (n1:Node { id: 'foo' }), (n2:Node { id: 'bar' }), (n3:Node { id: 'baz' })
		`)

		const nodes = await Node.all()

		nodes.setProperty('name', 'foo')

		await nodes.save()

		const foos = await Node.find({ name: 'foo' })

		expect(foos.length).toBe(3)
	})

	it('should call delete on related nodes', async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'relates_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		await DB.query(`
			CREATE (n1:Foo { id: 'foo' }), (n2:Foo { id: 'bar' }), (n3:Foo { id: 'baz' })
			MERGE (n1)-[:relates_to]->(n2)
			MERGE (n1)-[:relates_to]->(n3)
		`)

		const foo = await Foo.get({ id: 'foo' }, { with: 'related' })

		await foo.related.delete()

		const foos = await Foo.all()

		expect(foos.length).toBe(1)
	})

	it('should call delete deep on related nodes', async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'relates_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		await DB.query(`
			CREATE (n1:Foo { id: 'foo' }), (n2:Foo { id: 'bar' }), (n3:Foo { id: 'baz' }), (n4:Foo { id: 'qux' })
			MERGE (n1)-[:relates_to]->(n2)
			MERGE (n1)-[:relates_to]->(n3)
			MERGE (n2)-[:relates_to]->(n4)
		`)

		const before = await Foo.all()

		expect(before.length).toBe(4)

		const foo = await Foo.get({ id: 'foo' }, { with: 'related.related' })

		await foo.related.delete(true)

		const after = await Foo.all()

		expect(after.length).toBe(1)
	})

	it('should call save on related nodes', async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'relates_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		await DB.query(`
			CREATE (n1:Foo { id: 'foo' }), (n2:Foo { id: 'bar' }), (n3:Foo { id: 'baz' })
			MERGE (n1)-[:relates_to]->(n2)
			MERGE (n1)-[:relates_to]->(n3)
		`)

		const foo = await Foo.get({ id: 'foo' }, { with: 'related' })

		foo.related.setProperty('name', 'foo')

		await foo.related.save()

		const foos = await Foo.find({ name: 'foo' })

		expect(foos.length).toBe(2)
	})

	it('should set the related Model', async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						type: 'relates_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		class Bar extends Node {}

		const foo1 = new Foo()
		const foo2 = new Foo()

		const foos = new NodeCollection(Foo, [foo1, foo2])

		expect(foos.$Model).toBe(Foo)
		expect(foos[0].bars.$Model).toBe(Bar)
		expect(foos[1].bars.$Model).toBe(Bar)
	})
})
