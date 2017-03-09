'use strict'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000 * 60 * 5

describe('Relationship', () =>
{
	const aa = require('./util/aa')
	const config = require('./util/config')
	const Node = require('../lib/Node')
	const DB = require('../lib/DB')
	const Relationship = require('../lib/Relationship')

	class Person extends Node {
		static get relationships()
		{
			return {
				relatives: {
					Model: Person,
					type: 'is_related_to',
					direction: Relationship.OUT
				},
				father: {
					Model: Person,
					type: 'is_father_of',
					direction: Relationship.IN,
					singular: true
				},
				mother: {
					Model: Person,
					type: 'is_mother_of',
					direction: Relationship.IN,
					singular: true
				}
			}
		}
	}

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

	it('should be set', () =>
	{
		expect(Person.relationships.relatives.type).toBe('is_related_to')
		expect(Person.Relationships.relatives.Model).toBe(Person)
		expect(Person.Relationships.relatives.direction).toBe(Relationship.OUT)
		expect(Person.Relationships.relatives.singular).toBe(false)
	})

	it('should be found', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (a)-[:is_related_to]->(b)
			MERGE (a)<-[:is_related_to]-(b)
		`)

		const foo = await Person.get('foo', { with: 'relatives' })

		expect(foo.relatives.length).toBe(1)
	}))

	it('should be found when nested', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (a)<-[:is_father_of]-(b)
			MERGE (b)<-[:is_father_of]-(c)
		`)

		const foo = await Person.get('foo', { with: 'father.father' })

		expect(foo.father.id).toBe('bar')
		expect(foo.father.father.id).toBe('baz')
		expect(foo.$graph.nodes.size).toBe(3)
	}))

	it('should be found when circular', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (a)-[:is_related_to]->(b)
			MERGE (a)<-[:is_related_to]-(b)
		`)

		const foo = await Person.get('foo', { with: 'relatives.relatives' })

		expect(foo.relatives.length).toBe(1)
		expect(foo.relatives[0].relatives.length).toBe(1)
		expect(foo.$graph.nodes.size).toBe(2)
	}))

	it('should be found when multiple', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (a)-[:is_related_to]->(b)
			MERGE (a)<-[:is_related_to]-(b)
			MERGE (a)-[:is_related_to]->(c)
			MERGE (a)<-[:is_related_to]-(c)
			MERGE (a)<-[:is_father_of]-(b)
			MERGE (a)<-[:is_mother_of]-(c)
		`)

		const foo = await Person.get('foo', { with: ['relatives', 'father', 'mother'] })

		expect(foo.relatives.length).toBe(2)
		expect(foo.father.id).toBe('bar')
		expect(foo.mother.id).toBe('baz')

		expect(foo.$graph.nodes.size).toBe(3)
	}))

	it('should be found with filter', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (a)-[:is_related_to]->(b)
			MERGE (a)<-[:is_related_to]-(b)
			MERGE (a)-[:is_related_to]->(c)
			MERGE (a)<-[:is_related_to]-(c)
		`)

		const foo = await Person.get('foo', { with: { relatives: { id: ['bar', 'baz'] } } })

		expect(foo.relatives.length).toBe(2)
		expect(foo.$graph.nodes.size).toBe(3)

		const expected = [
			'barbaz',
			'bazbar'
		]
		const ids = foo.relatives[0].id + foo.relatives[1].id

		expect(expected.includes(ids)).toBe(true)
	}))

	it('should not duplicate nodes with multiple relations', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (a)-[:is_related_to]->(b)
			MERGE (a)<-[:is_related_to]-(b)
			MERGE (b)-[:is_related_to]->(c)
			MERGE (b)<-[:is_related_to]-(c)
			MERGE (a)-[:is_related_to]->(c)
			MERGE (a)<-[:is_related_to]-(c)
		`)

		const foo = await Person.get('foo', { with: 'relatives.relatives' })

		expect(foo.relatives.length).toBe(2)
		expect(foo.$graph.nodes.size).toBe(3)

		const expected = [
			'barbaz',
			'bazbar'
		]
		const ids = foo.relatives[0].id + foo.relatives[1].id

		expect(expected.includes(ids)).toBe(true)

		expect(foo.relatives[0].relatives.length + foo.relatives[1].relatives.length).toBe(4)
	}))

	it('should be made', aa(async () =>
	{
		const foo = new Person({ name: 'foo' })
		const bar = new Person({ name: 'bar' })

		foo.relatives.push(bar)
		await foo.save(true)

		const node = await Person.get({ name: 'foo' }, { with: 'relatives' })

		expect(node.relatives[0].name).toBe('bar')
	}))

	it('should be made for singular relationships', aa(async () =>
	{
		const foo = new Person({ name: 'foo' })
		const bar = new Person({ name: 'bar' })

		foo.father = bar

		await foo.save(true)

		const node = await Person.get({ name: 'foo' }, { with: 'father' })

		expect(node.father.name).toBe('bar')
	}))

	it('should rollback the transaction if any errors are thrown', (done) =>
	{
		const foo = new Person({ name: 'foo' })
		const bar = new Person({ name: 'bar' })

		class ProblematicPerson extends Person {
			get $data()
			{
				throw new Error('Something bad happened')
			}
		}

		const baz = new ProblematicPerson({ name: 'baz' })

		foo.relatives.push(bar)
		foo.relatives.push(baz)

		const promise = foo.save(true)

		promise
			.then(() =>
			{
				// Should throw an error
				done.fail('An error should have been thrown')
			})
			.catch((e) =>
			{
				expect(e.message).toBe('Something bad happened')
			})
			.then(() => Person.count())
			.then(total => expect(total).toBe(0))
			.then(() => done())
	})

	it('should be made when circular', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
		`)

		const foo1 = await Person.get('foo')
		const bar1 = await Person.get('bar')

		foo1.relatives.push(bar1)
		bar1.relatives.push(foo1)

		await foo1.save(true)

		const foo2 = await Person.get('foo', { with: 'relatives.relatives' })

		expect(foo2.relatives.length).toBe(1)
		expect(foo2.relatives[0].relatives[0].id).toBe('foo')
	}))

	it('should delete a related nodes', aa(async () =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (a)-[:is_related_to]->(b)
		`)

		const node = await Person.get({ id: 'foo' }, { with: 'relatives' })

		expect(node.$entity).toBeDefined()
		expect(node.$graph.nodes.size).toBe(2)

		await node.delete(true)

		expect(node.id).toBe(null)
		expect(node.$entity).toBe(null)
		expect(node.$graph.nodes.size).toBe(0)

		const total = await Person.count()

		expect(total).toBe(0)
	}))
})
