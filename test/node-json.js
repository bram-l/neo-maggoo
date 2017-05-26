'use strict'

require('./util/reporter')

describe('JSON', () =>
{
	const config = require('./util/config')
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
/*
	it('should be created for single Node', async () =>
	{
		await DB.query(`
			CREATE (a:Node { id: 'foo' })
		`)

		const node = await Node.get('foo')

		const json = JSON.stringify(node)

		expect(json).toBe('{"id":"foo"}')
	})

	it('should be filtered using a array for single Node', async () =>
	{
		await DB.query(`
			CREATE (a:Node { id: 'foo', bar: 'bar' })
		`)

		const node = await Node.get('foo')

		const object = node.toObject(['bar'])

		const json = JSON.stringify(object)

		expect(json).toBe('{"bar":"bar"}')
	})

	it('should be created for a Node Collection', async () =>
	{
		await DB.query(`
			CREATE (:Node { id: 'foo' }), (:Node { id: 'bar' })
		`)

		const nodes = await Node.all()

		const json = JSON.stringify(nodes)

		const valid = [
			'[{"id":"foo"},{"id":"bar"}]',
			'[{"id":"bar"},{"id":"foo"}]'
		]

		expect(valid.includes(json)).toBe(true)
	})

	it('should be created for related Nodes', async () =>
	{
		await DB.query(`
			CREATE (a:Foo { id: 'foo' }), (b:Foo { id: 'bar' })
			CREATE (a)-[:is_related_to]->(b)
		`)

		class Foo extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'is_related_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		const foo = await Foo.get('foo', { with: 'related' })

		const json = JSON.stringify(foo.related)

		expect(json).toBe('[{"id":"bar"}]')
	})

	it('should be created for a Node Collection with nested Nodes', async () =>
	{
		await DB.query(`
			CREATE (a:Foo { id: 'foo' }), (b:Bar { id: 'bar' }), (c:Bar { id: 'baz' })
			CREATE (b)-[:is_related_to]->(a)
			CREATE (c)-[:is_related_to]->(a)
		`)

		class Foo extends Node {}

		class Bar extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'is_related_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		const bars = await Bar.all({ with: 'related' })

		const obj = bars.toObject(['id', { related: 'id' }])

		const json = JSON.stringify(obj)

		const valid = [
			'[{"id":"baz","related":[{"id":"foo"}]},{"id":"bar","related":[{"id":"foo"}]}]',
			'[{"id":"bar","related":[{"id":"foo"}]},{"id":"baz","related":[{"id":"foo"}]}]'
		]

		expect(valid.includes(json)).toBe(true)
	})


	it('should be created for a Node Collection with nested Nodes', async () =>
	{
		await DB.query(`
			CREATE (a:Foo { id: 'foo', name: 'foo' }),
				   (b:Foo { id: 'bar', name: 'bar' }),
				   (c:Foo { id: 'baz', name: 'baz' })
			CREATE (a)-[:is_related_to]->(b)-[:is_related_to]->(c)
		`)

		class Foo extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'is_related_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		const bars = await Foo.get('foo', { with: 'related.related' })

		const obj = bars.toObject([
			'*',
			{ related: [
				'name',
				{ related: ['name'] }
			] }
		])

		const json = JSON.stringify(obj)

		const valid = [
			'{"id":"foo","name":"foo","related":[{"name":"bar","related":[{"name":"baz"}]}]}',
			'{"name":"foo","id":"foo","related":[{"name":"bar","related":[{"name":"baz"}]}]}',
		]

		expect(valid.includes(json)).toBe(true)
	})


	it('should be created for a Node Collection with nested Nodes using a wildcard expression', async () =>
	{
		await DB.query(`
			CREATE (a:Foo { id: 'foo' }), (b:Bar { id: 'bar' }), (c:Bar { id: 'baz' })
			CREATE (b)-[:is_related_to]->(a)
			CREATE (c)-[:is_related_to]->(a)
		`)

		class Foo extends Node {}

		class Bar extends Node {
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'is_related_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		const bars = await Bar.all({ with: 'related' })

		const obj = bars.toObject(['*', { related: '*' }])

		const json = JSON.stringify(obj)

		const valid = [
			'[{"id":"baz","related":[{"id":"foo"}]},{"id":"bar","related":[{"id":"foo"}]}]',
			'[{"id":"bar","related":[{"id":"foo"}]},{"id":"baz","related":[{"id":"foo"}]}]'
		]

		expect(valid.includes(json)).toBe(true)
	})

	it('should be created for linked Nodes', async () =>
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

		const obj = nodes.toObject(['*', { other: '*' }])

		const json = JSON.stringify(obj)

		const valid = [
			'[{"name":"foo","id":"baz","other":{"name":"foo","id":"foo"}},{"name":"foo","id":"foo","other":{"name":"foo","id":"baz"}}]',
			'[{"name":"foo","id":"foo","other":{"name":"baz","id":"foo"}},{"name":"foo","id":"baz","other":{"name":"foo","id":"foo"}}]'
		]

		expect(valid.includes(json)).toBe(true)
	})
*/
	it('should include relationship data', async () =>
	{
		await DB.query(`
			CREATE (foo:Foo { id: 'foo' }), (bar:Bar { id: 'bar' })
			CREATE (bar)-[:is_related_to { baz: 1 }]->(foo)
		`)

		class Foo extends Node {}

		class Bar extends Node
		{
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'is_related_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		const bar = await Bar.get('bar', { with: 'related' })

		const obj = bar.toObject([
			'id',
			{ related: [
				'id',
				{ $rel: ['baz'] }
			] }
		])

		const json = JSON.stringify(obj)

		const valid = '{"id":"bar","related":[{"id":"foo","$rel":{"baz":1}}]}'

		expect(json).toEqual(valid)
	})

	it('should coerce relationship data through callback function', async () =>
	{
		await DB.query(`
			CREATE (foo:Foo { id: 'foo' }), (bar:Bar { id: 'bar' })
			CREATE (bar)-[:is_related_to { baz: 1 }]->(foo)
		`)

		class Foo extends Node {}

		class Bar extends Node
		{
			static get relationships()
			{
				return {
					related: {
						Model: Foo,
						type: 'is_related_to',
						direction: Relationship.OUT
					}
				}
			}
		}

		const bar = await Bar.get('bar', { with: 'related' })

		const obj = bar.toObject([
			'id',
			{ related: [
				'id',
				{ baz: (n) =>
				{
					return n.$rel.baz
				} }
			] }
		])

		const json = JSON.stringify(obj)

		const valid = '{"id":"bar","related":[{"id":"foo","baz":1}]}'

		expect(json).toEqual(valid)
	})
})
