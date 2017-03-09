'use strict'

describe('Related', () =>
{
	const aa = require('./util/aa')
	const config = require('./util/config')
	const DB = require('../lib/DB')
	const Node = require('../lib/Node')
	const Relationship = require('../lib/Relationship')

	beforeAll(aa(async () =>
	{
		DB.init(config.db.server, config.db.user, config.db.pass)
	}))

	beforeEach(aa(async () =>
	{
		await DB.query(`
			MATCH (n)
			DETACH DELETE n
		`)
	}))

	afterAll(() =>
	{
		DB.exit()
	})

	it('should save relationships with properties', aa(async () =>
	{
		class Foo extends Node {
			static get relationships()
			{
				return {
					bars: {
						model: Bar,
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

		await foos.save(true)

		expect(foos[0].bars.length).toBe(2)
		expect(foos[1].bars.length).toBe(2)

		expect('$rel' in foos[0].bars[0]).toBe(true)

		expect(foos[0].bars[0].$rel.$data).toEqual({ x: 1 })
		expect(foos[0].bars[0].$rel.x).toBe(1)
	}))
})
