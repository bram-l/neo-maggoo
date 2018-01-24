'use strict'

require('./utils/reporter')

describe('Fetch related', () =>
{
	const config = require('./utils/config')
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

		const foo = await bar.fetchRelated('foo')

		expect(bar.foo).toBe(foo)
		expect(foo.id).toBe('foo')

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

		const related1 = await foo.fetchRelated('related')

		expect(related1.id).toBe('bar')
		expect(related1.related).toBe(null)

		const related2 = await foo.fetchRelated('related.related')

		expect(related2.id).toBe('bar')
		expect(related2.related.id).toBe('baz')

		expect(foo.$graph.nodes.size).toBe(3)
		expect(foo.$graph.relationships.size).toBe(2)
	})

	it('should fetch an array of related items for the current node', async() =>
	{
		await DB.query(`
			CREATE (foo:Foo { id: 'foo' }),
				   (bar:Bar { id: 'bar' }),
				   (baz:Baz { id: 'baz' })
			MERGE (baz)-[:has_foo]->(foo)
			MERGE (baz)-[:has_bar]->(bar)
		`)

		class Foo extends Node { }
		class Bar extends Node { }

		class Baz extends Node
		{
			static get relationships()
			{
				return {
					foo: {
						Model: Foo,
						type: 'has_foo',
						direction: Relationship.OUT,
						singular: true
					},
					bar: {
						Model: Bar,
						type: 'has_bar',
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		const baz = await Baz.get('baz')

		expect(baz.foo).toBe(null)
		expect(baz.$graph.nodes.size).toBe(1)
		expect(baz.$graph.relationships.size).toBe(0)

		const { foo, bar } = await baz.fetchRelated(['foo', 'bar'])

		expect(baz.foo).toBe(foo)
		expect(foo.id).toBe('foo')

		expect(baz.bar).toBe(bar)
		expect(bar.id).toBe('bar')

		expect(baz.$graph.nodes.size).toBe(3)
		expect(baz.$graph.relationships.size).toBe(2)
	})

	it('should fetch filtered related items for the current node', async() =>
	{
		await DB.query(`
			CREATE (foo:Foo { id: 'foo' }),
				   (bar:Bar { id: 'bar' }),
				   (baz:Foo { id: 'baz' })
			MERGE (bar)-[:has_foo]->(foo)
			MERGE (bar)-[:has_foo]->(baz)
		`)

		class Foo extends Node { }
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

		const { foo } = await bar.fetchRelated({ foo: { id: 'foo' } })

		expect(bar.foo).toBe(foo)
		expect(foo.id).toBe('foo')

		expect(bar.$graph.nodes.size).toBe(2)
		expect(bar.$graph.relationships.size).toBe(1)
	})

	it('should fetch an object of related items for the current node', async() =>
	{
		await DB.query(`
			CREATE (foo:Foo { id: 'foo' }),
				   (bar:Bar { id: 'bar' }),
				   (baz:Baz { id: 'baz' }),
				   (qux:Qux { id: 'qux' })
			MERGE (qux)-[:has_baz]->(baz)
			MERGE (baz)-[:has_foo]->(foo)
			MERGE (baz)-[:has_bar]->(bar)
		`)

		class Foo extends Node { }
		class Bar extends Node { }

		class Baz extends Node
		{
			static get relationships()
			{
				return {
					foo: {
						Model: Foo,
						type: 'has_foo',
						direction: Relationship.OUT,
						singular: true
					},
					bar: {
						Model: Bar,
						type: 'has_bar',
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		class Qux extends Node
		{
			static get relationships()
			{
				return {
					baz: {
						Model: Baz,
						type: 'has_baz',
						direction: Relationship.OUT,
						singular: true
					}
				}
			}
		}

		const qux = await Qux.get('qux')

		expect(qux.baz).toBe(null)

		const { baz: { foo, bar } } = await qux.fetchRelated({ baz: { with: ['foo', 'bar'] } })

		expect(qux.baz.foo).toBe(foo)
		expect(foo.id).toBe('foo')

		expect(qux.baz.bar).toBe(bar)
		expect(bar.id).toBe('bar')

		expect(qux.$graph.nodes.size).toBe(4)
		expect(qux.$graph.relationships.size).toBe(3)
	})

	it('should clear relationship cache after fetching related nodes', async() =>
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

		const related = await foo.fetchRelated('related')

		expect(related).not.toBe(null)
		expect(related.id).toBe('bar')

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

		const related = await foo.fetchRelated('related')

		expect(related.id).toBe('bar')

		expect(foo.$graph.nodes.size).toBe(2)
		expect(foo.$graph.relationships.size).toBe(1)

		foo.clearCachedRelationships()

		expect(foo.$graph.nodes.size).toBe(2)
		expect(foo.$graph.relationships.size).toBe(1)

		expect(related.id).toBe('bar')
	})
})
