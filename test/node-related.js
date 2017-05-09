'use strict'

require('./util/reporter')

describe('Related', () =>
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

	it('should save relationships with properties', async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						direction: Relationship.OUT
					}
				}
			}
		}
		class Bar extends Node {}

		await DB.query(`
			CREATE (n1:Foo { id: 'foo-1' }), (n2:Foo { id: 'foo-2' })
		`)

		const foos = await Foo.find()

		expect(foos.length).toBe(2)

		const bar1 = new Bar()
		const bar2 = new Bar()

		for (const foo of foos)
		{
			foo.addRelated('bars', bar1, { x: 1 })
			foo.addRelated('bars', bar2, { x: 1 })
		}

		expect(foos[0].bars.length).toBe(2)
		expect(foos[1].bars.length).toBe(2)

		expect('$rel' in foos[0].bars[0]).toBe(true)
		expect(foos[0].bars[0].$rel.$id).toBe(null)

		expect(foos[0].bars[0].$rel.$data).toEqual({ x: 1 })
		expect(foos[0].bars[0].$rel.x).toBe(1)
		expect('id' in foos[0].bars[0]).toBe(true)
		expect('id' in foos[0].bars[1]).toBe(true)

		await foos.save(true)

		expect(foos[0].bars[0].$rel.$id).not.toBe(null)
	})

	it('should set multiple relationships', async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						direction: Relationship.OUT
					}
				}
			}
		}
		class Bar extends Node {}

		await DB.query(`
			CREATE (:Foo { id: 'foo-1' }), (:Foo { id: 'foo-2' }), (:Bar { id: 'bar-1' }), (:Bar { id: 'bar-2' })
		`)

		const foos = await Foo.find()

		expect(foos.length).toBe(2)

		const bars = await Bar.all()

		for (const foo of foos)
		{
			foo.setRelated('bars', bars)
		}

		await foos.save(true)

		expect(foos[0].bars.length).toBe(2)
		expect(foos[1].bars.length).toBe(2)

		const valid = ['bar-1', 'bar-2']

		expect(valid.includes(foos[0].bars[0].id)).toBe(true)
		expect(valid.includes(foos[0].bars[1].id)).toBe(true)
		expect(valid.includes(foos[1].bars[0].id)).toBe(true)
		expect(valid.includes(foos[1].bars[1].id)).toBe(true)
		expect(foos[0].bars[0].id !== foos[0].bars[1].id).toBe(true)
		expect(foos[1].bars[0].id !== foos[1].bars[1].id).toBe(true)
	})

	it('should set properties on existing relationships', async () =>
	{
		class Bar extends Node {}

		class Foo extends Node {
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						direction: Relationship.OUT,
						type: 'is_related_to'
					}
				}
			}
		}

		await DB.query(`
			CREATE (f:Foo { id: 'foo' }),
				   (b:Bar { id: 'bar' }),
				   (f)-[:is_related_to]->(b)
		`)

		const foo1 = await Foo.get('foo', { with: 'bars' })

		foo1.bars[0].$rel.foo = 'foo'

		expect(foo1.bars[0].$rel.$dirty).toBe(true)
		expect(foo1.bars[0].$rel.$id).not.toBe(null)

		await foo1.bars[0].$rel.save()

		expect(foo1.bars[0].$rel.$dirty).toBe(false)

		const foo2 = await Foo.get('foo', { with: 'bars' })

		expect(foo2.bars[0].$rel.foo).toBe('foo')
	})

	it('should be saved by name', async () =>
	{
		class Bar extends Node {}

		class Foo extends Node
		{
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						direction: Relationship.OUT,
						type: 'is_related_to'
					}
				}
			}
		}

		const foo = new Foo({ id: 'foo' })

		const bar1 = new Bar()
		const bar2 = new Bar()

		foo.bars = [bar1, bar2]

		await foo.save('bars')

		const result = await Foo.get('foo', { with: 'bars' })

		expect(result.bars.length).toBe(2)
	})
})
