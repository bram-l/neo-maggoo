'use strict'

require('./utils/reporter')
jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000 * 60 * 5

describe('Relationship', () =>
{
	const config = require('./utils/config')
	const Node = require('../lib/Node')
	const DB = require('../lib/DB')
	const Relationship = require('../lib/Relationship')

	class Relatives extends Relationship
	{
		static get Model()
		{
			return Person
		}

		static get type()
		{
			return 'is_related_to'
		}

		static get direction()
		{
			return Relationship.ANY
		}
	}

	class Person extends Node
	{
		static get relationships()
		{
			return {
				relatives: Relatives,
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
				},
				children: {
					Model: Person,
					type: 'has_child',
					direction: Relationship.OUT
				},
			}
		}
	}

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

	it('should use the default values for unspecified relationships', () =>
	{
		class Foo extends Node
		{
			static get relationships()
			{
				return {
					bar: {}
				}
			}
		}

		const $Relationship = Foo.getRelationship('bar')

		expect($Relationship.Model).toBe(Node)
		expect($Relationship.direction).toBe(Relationship.OUT)
		expect($Relationship.singular).toBe(false)
	})

	it('should use the model alias for specifying relationships', () =>
	{
		class Bar extends Node {}

		class Foo extends Node
		{
			static get relationships()
			{
				return {
					bar: {
						model: Bar
					}
				}
			}
		}

		const $Relationship = Foo.getRelationship('bar')

		expect($Relationship.Model).toBe(Bar)
		expect($Relationship.model).toBe(Bar)
	})

	it('should be set using extended Class', () =>
	{
		expect(Person.relationships.relatives.type).toBe('is_related_to')

		const $Relationship = Person.getRelationship('relatives')

		expect($Relationship.Model).toBe(Person)
		expect($Relationship.direction).toBe(Relationship.ANY)
		expect($Relationship.singular).toBe(false)
	})

	it('should be set by definition', () =>
	{
		expect(Person.relationships.father.type).toBe('is_father_of')

		const $Relationship = Person.getRelationship('father')

		expect($Relationship.Model).toBe(Person)
		expect($Relationship.direction).toBe(Relationship.IN)
		expect($Relationship.singular).toBe(true)
	})

	it('should be found in outward direction for relationships that can be in "any" direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (a)-[:is_related_to { id: 'foo-bar' }]->(b)
		`)

		const foo = await Person.get('foo', { with: 'relatives' })

		expect(foo.relatives.length).toBe(1)
		expect(foo.relatives[0].$rel.id).toBe('foo-bar')
	})

	it('should be found in inward direction for relationships that can be in "any" direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (b)-[:is_related_to { id: 'bar-foo' }]->(a)
		`)

		const foo = await Person.get('foo', { with: 'relatives' })

		expect(foo.relatives.length).toBe(1)
		expect(foo.relatives[0].$rel.id).toBe('bar-foo')
	})

	it('should be found for relationships that are in the outward direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (a)-[:has_child { id: 'foo-bar' }]->(b)
		`)

		const foo = await Person.get('foo', { with: 'children' })

		expect(foo.children.length).toBe(1)
		expect(foo.children[0].$rel.id).toBe('foo-bar')
	})

	it('should be found for relationships that are in the inward direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
			MERGE (b)-[:is_father_of { id: 'foo-bar' }]->(a)
		`)

		const foo = await Person.get('foo', { with: 'father' })

		expect(foo.father).not.toBeNull()
		expect(foo.father.$rel.id).toBe('foo-bar')
	})

	it('should return null for missing relationships that can be in "any" direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (a)-[:is_related_to { id: 'foo-bar' }]->(b)
		`)

		const people = await Person.all({ with: 'relatives' })

		const foo = people.find((person) => person.id === 'foo')
		const bar = people.find((person) => person.id === 'bar')
		const baz = people.find((person) => person.id === 'baz')

		const graph = foo.$graph
		const RelationshipModel = foo.getRelationship('relatives')

		const fooBarRelationship = graph.getRelationship(foo.$id, bar.$id, RelationshipModel)
		const fooBazRelationship = graph.getRelationship(foo.$id, baz.$id, RelationshipModel)

		expect(fooBarRelationship.id).toBe('foo-bar')
		expect(fooBazRelationship).toBeNull()
	})

	it('should return null for missing relationships in the "out" direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (a)-[:has_child { id: 'foo-bar' }]->(b)
		`)

		const people = await Person.all({ with: 'children' })

		const foo = people.find((person) => person.id === 'foo')
		const bar = people.find((person) => person.id === 'bar')
		const baz = people.find((person) => person.id === 'baz')

		const graph = foo.$graph
		const RelationshipModel = foo.getRelationship('children')

		const fooBarRelationship = graph.getRelationship(foo.$id, bar.$id, RelationshipModel)
		const barFooRelationship = graph.getRelationship(bar.$id, foo.$id, RelationshipModel)
		const fooBazRelationship = graph.getRelationship(foo.$id, baz.$id, RelationshipModel)

		expect(fooBarRelationship.id).toBe('foo-bar')
		expect(barFooRelationship).toBeNull()
		expect(fooBazRelationship).toBeNull()
	})

	it('should return null for missing relationships in the "in" direction', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (b)-[:is_father_of { id: 'foo-bar' }]->(a)
		`)

		const people = await Person.all({ with: 'father' })

		const foo = people.find((person) => person.id === 'foo')
		const bar = people.find((person) => person.id === 'bar')
		const baz = people.find((person) => person.id === 'baz')

		const graph = foo.$graph
		const RelationshipModel = foo.getRelationship('father')

		const fooBarRelationship = graph.getRelationship(foo.$id, bar.$id, RelationshipModel)
		const barFooRelationship = graph.getRelationship(bar.$id, foo.$id, RelationshipModel)
		const fooBazRelationship = graph.getRelationship(foo.$id, baz.$id, RelationshipModel)

		expect(fooBarRelationship.id).toBe('foo-bar')
		expect(barFooRelationship).toBeNull()
		expect(fooBazRelationship).toBeNull()
	})

	it('should be found when nested', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' }), (c:Person { id: 'baz' })
			MERGE (b)-[:is_father_of { id: 'bar-foo' }]->(a)
			MERGE (c)-[:is_father_of { id: 'baz-bar' }]->(b)
		`)

		const foo = await Person.get('foo', { with: 'father.father' })

		expect(foo.father.id).toBe('bar')
		expect(foo.father.$rel.id).toBe('bar-foo')
		expect(foo.father.father.id).toBe('baz')
		expect(foo.father.father.$rel.id).toBe('baz-bar')
		expect(foo.$graph.nodes.size).toBe(3)
	})

	it('should be found when circular', async() =>
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
	})

	it('should be found when multiple', async() =>
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
	})

	it('should be found with filter', async() =>
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
	})

	it('should not duplicate nodes with multiple relations', async() =>
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

		expect(foo.relatives[0].relatives.length).toBe(2)
		expect(foo.relatives[1].relatives.length).toBe(2)
	})

	it('should be made', async() =>
	{
		const foo = new Person({ name: 'foo' })
		const bar = new Person({ name: 'bar' })

		foo.relatives.push(bar)

		await foo.save(true)

		const node = await Person.get({ name: 'foo' }, { with: 'relatives' })

		expect(node.relatives[0].name).toBe('bar')
	})

	it('should be made for singular relationships', async() =>
	{
		const foo = new Person({ name: 'foo' })
		const bar = new Person({ name: 'bar' })

		foo.father = bar

		await foo.save(true)

		const node = await Person.get({ name: 'foo' }, { with: 'father' })

		expect(node.father.name).toBe('bar')
	})

	it('should be made by saving directly the relationship', async() =>
	{
		await DB.query(`
			CREATE (a:Person { id: 'foo' }), (b:Person { id: 'bar' })
		`)

		const foo = await Person.get('foo')
		const bar = await Person.get('bar')

		foo.father = bar

		await foo.father.$rel.save()

		const node = await Person.get('foo', { with: 'father' })

		expect(node.father.id).toBe('bar')
	})

	it('should rollback the transaction if any errors are thrown', (done) =>
	{
		const foo = new Person({ name: 'foo' })
		const bar = new Person({ name: 'bar' })

		class ProblematicPerson extends Person
		{
			get $data()
			{
				throw new Error('Something bad happened')
			}
		}

		const baz = new ProblematicPerson({ name: 'baz' })

		foo.relatives.push(bar)
		foo.relatives.push(baz)

		const promise = foo.save(true)

		return promise
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

	it('should be made when circular', async() =>
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
	})

	it('should be made when Model dependencies are circular', async() =>
	{
		await DB.query(`
			CREATE
				(foo:Foo { id: 'foo' }),
				(bar:Bar { id: 'bar' }),
				(foo)-[:is_related_to]->(bar),
				(bar)-[:is_related_to]->(foo)
		`)

		const Foo = require('./fixtures/circular/Foo')
		const Bar = require('./fixtures/circular/Bar')

		const foo = await Foo.get('foo', { with: 'bar' })
		const bar = await Bar.get('bar', { with: 'foo' })

		expect(foo.bar.id).toBe(bar.id)
		expect(bar.foo.id).toBe(foo.id)
	})

	it('should delete related nodes', async() =>
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
	})

	it('should delete related nodes when circular', async() =>
	{
		await DB.query(`
			CREATE
				(foo:Node:Foo { id: 'foo' }),
				(bar:Node:Bar { id: 'bar' }),
				(foo)-[:is_related_to]->(bar),
				(bar)-[:is_related_to]->(foo)
		`)

		const total1 = await Node.count()

		expect(total1).toBe(2)

		const Foo = require('./fixtures/circular/Foo')

		const foo = await Foo.get('foo', { with: 'bar.foo' })

		expect(foo.id).toBe('foo')
		expect(foo.bar.id).toBe('bar')
		expect(foo.bar.foo.id).toBe('foo')

		await foo.delete(true)

		const total = await Node.count()

		expect(total).toBe(0)
	})

	it('should be saved and found for "any" direction', async() =>
	{
		class Foo extends Node
		{
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						direction: Relationship.ANY
					}
				}
			}
		}

		class Bar extends Node
		{
			static get relationships()
			{
				return {
					foos: {
						Model: () =>
						{
							return Foo
						},
						direction: Relationship.ANY
					}
				}
			}
		}

		const foo = new Foo()
		const bar = new Bar()

		foo.bars = [bar]

		await foo.save(true)

		const foos = await Foo.all({ with: 'bars' })

		expect(foos.length).toBe(1)
		expect(foos[0].bars.length).toBe(1)

		const bars = await Bar.all({ with: 'foos' })

		expect(bars.length).toBe(1)
		expect(bars[0].foos.length).toBe(1)
	})

	it('should be saved and found for "both" direction', async() =>
	{
		class Foo extends Node
		{
			static get relationships()
			{
				return {
					bars: {
						Model: Bar,
						direction: Relationship.BOTH
					}
				}
			}
		}

		class Bar extends Node
		{
			static get relationships()
			{
				return {
					foos: {
						Model: () =>
						{
							return Foo
						},
						direction: Relationship.BOTH
					}
				}
			}
		}

		const foo = new Foo()
		const bar = new Bar()

		foo.bars = [bar]

		await foo.save(true)

		const foos = await Foo.all({ with: 'bars' })

		expect(foos.length).toBe(1)
		expect(foos[0].bars.length).toBe(1)

		const bars = await Bar.all({ with: 'foos' })

		expect(bars.length).toBe(1)
		expect(bars[0].foos.length).toBe(1)
	})
})
