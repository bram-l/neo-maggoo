'use strict'

require('./util/reporter')

describe('Fetch related', () =>
{
	const config = require('./util/config')
	const DB = require('../lib/DB')
	const Node = require('../lib/Node')
	const Relationship = require('../lib/Relationship')

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

	it('should fetch related items for the current node', async() =>
	{
		await DB.query(`
			CREATE (f:Foo { id: 'foo' }),
				   (b:Bar { id: 'bar' })
			MERGE (b)-[:has_foo]->(f)
		`)

		class Foo extends Node {}

		class Bar extends Node
		{
			static get relationships()
			{
				return {
					foo: {
						Model: Foo,
						type: 'has_foo',
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		const bar = await Bar.get('bar')

		expect(bar.foo).toBe(null)
		expect(bar.$graph.nodes.size).toBe(1)
		expect(bar.$graph.relationships.size).toBe(0)

		await bar.fetchRelated('foo')

		expect(bar.foo.id).toBe('foo')
		expect(bar.$graph.nodes.size).toBe(2)
		expect(bar.$graph.relationships.size).toBe(1)
	})

	it('should fetch nested related items for the current node', async() =>
	{
		await DB.query(`
			CREATE (n1:Foo:Node { id: 'foo' }),
				   (n2:Foo:Node { id: 'bar' }),
				   (n3:Foo:Node { id: 'baz' }),
				   (n1)-[:is_related_to]->(n2),
				   (n2)-[:is_related_to]->(n3)
		`)

		class Foo extends Node
		{
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		const foo = await Foo.get('foo')

		await foo.fetchRelated('related')

		expect(foo.related.id).toBe('bar')
		expect(foo.related.related).toBe(null)

		await foo.fetchRelated('related.related')

		expect(foo.related.id).toBe('bar')
		expect(foo.related.related.id).toBe('baz')

		expect(foo.$graph.nodes.size).toBe(3)
		expect(foo.$graph.relationships.size).toBe(2)
	})

	it('should clear relationship cache after fecthing related nodes', async() =>
	{
		await DB.query(`
			CREATE (n1:Foo:Node { id: 'foo' })
		`)

		class Foo extends Node
		{
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		const foo = await Foo.get('foo')

		await foo.fetchRelated('related')

		expect(foo.related).toBe(null)

		expect(foo.$graph.nodes.size).toBe(1)
		expect(foo.$graph.relationships.size).toBe(0)

		await DB.query(`
			MATCH (n1:Node { id: 'foo' })
			CREATE (n2:Foo:Node { id: 'bar' }),
				   (n1)-[:is_related_to]->(n2)
		`)

		await foo.fetchRelated('related')

		expect(foo.related).not.toBe(null)
		expect(foo.related.id).toBe('bar')

		expect(foo.$graph.nodes.size).toBe(2)
		expect(foo.$graph.relationships.size).toBe(1)
	})

	it('should not affect the graph when clearing the relationship cache', async() =>
	{
		await DB.query(`
			CREATE (n1:Foo:Node { id: 'foo' }),
				   (n2:Foo:Node { id: 'bar' }),
				   (n1)-[:is_related_to]->(n2)
		`)

		class Foo extends Node
		{
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		const foo = await Foo.get('foo')

		await foo.fetchRelated('related')

		expect(foo.related.id).toBe('bar')

		expect(foo.$graph.nodes.size).toBe(2)
		expect(foo.$graph.relationships.size).toBe(1)

		foo.clearCachedRelationships()

		expect(foo.$graph.nodes.size).toBe(2)
		expect(foo.$graph.relationships.size).toBe(1)

		expect(foo.related.id).toBe('bar')
	})
})
