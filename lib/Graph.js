'use strict'

const Relationship = require('./Relationship')
const neo4j = require('neo4j-driver/lib/v1')

const _db = Symbol()

/**
 * Object-Graph Map
 *
 * @class Graph
 */
class Graph {

	/**
	 * Get a database instance.
	 *
	 * @readonly
	 * @static
	 *
	 * @memberOf Graph
	 */
	static get db()
	{
		this[_db] = this[_db] || require('./DB')

		return this[_db]
	}

	/**
	 * Build a graph from query results.
	 * Map variables returned from the query to Nodes
	 *
	 * @static
	 * @param {string} query The search query.
	 * @param {object} parameters The parameters used in the search query.
	 * @param {object} models variables and Node models as key-value pairs.
	 * @returns {Graph} The resulting graph.
	 *
	 * @memberOf Graph
	 */
	static build(query, parameters, models)
	{
		return this.db.query(query, parameters)
			.then(result =>
			{
				return new this(result, models)
			})
	}

	/**
	 * Creates an instance of Graph.
	 *
	 * @param {neo4j.Result} result Result of a query.
	 * @param {object} models variables and Node models as key-value pairs.
	 *
	 * @memberOf Graph
	 */
	constructor(result, models)
	{
		this.nodes         = new Map()
		this.relationships = new Map()
		this.map           = new Map()
		this.models        = models

		for (const record of result.records)
		{
			record.forEach(this.add.bind(this))
		}
	}

	/**
	 * Add one or more entities to the graph
	 *
	 * @param {neo4j.types.Node|neo4j.types.Node[]|neo4j.types.Relationship|neo4j.types.Relationship[]} entity One or more entities
	 * @param {string} key The key associated with this
	 *
	 * @memberOf Graph
	 */
	add(entity, key)
	{
		if (Array.isArray(entity))
		{
			for (const item of entity)
			{
				this.add(item, key)
			}
			return
		}

		const type = this.getEntityType(entity)
		const id = entity.identity.toNumber()

		entity.$key = key

		if (key in this.models)
		{
			entity = new this.models[key](entity, this)
		}

		if (this[type].has(id) && key in this.models)
		{
			const current = this[type].get(id)

			// Upgrade entity to Model
			if (current.$key)
			{
				const arr = this.map[current.$key]

				if (arr.includes(current))
				{
					arr.splice(arr.indexOf(current), 1)
				}
			}

			this[type].set(id, entity)
		}
		else if (!this[type].has(id))
		{
			this[type].set(id, entity)
		}

		if (key)
		{
			this.map[key] = this.map[key] || []
			this.map[key].push(entity)
		}
	}

	/**
	 * Remove one or more entities from the graph
	 *
	 * @param {neo4j.types.Node|neo4j.types.Node[]|neo4j.types.Relationship|neo4j.types.Relationship[]|Node|Node[]|Relationship|Relationship[]} obj One or more objects
	 *
	 * @memberOf Graph
	 */
	remove(obj)
	{
		if (Array.isArray(obj))
		{
			for (const item of obj)
			{
				this.remove(item)
			}
			return
		}

		const entity = obj.$entity || obj
		const id = entity.identity.toNumber()
		const type = this.getEntityType(entity)

		this[type].delete(id)

		if (entity.$key)
		{
			const map = this.map[entity.$key]
			const i = map.indexOf(entity)

			if (i >= 0)
			{
				map.splice(i, 1)
			}
		}
	}

	/**
	 * Get the type of the entity
	 *
	 * @param {any} entity Entity object
	 * @returns {string} 'nodes' or 'relationships'
	 *
	 * @memberOf Graph
	 */
	getEntityType(entity)
	{
		if (entity instanceof neo4j.types.Node)
		{
			return 'nodes'
		}

		if (entity instanceof neo4j.types.Relationship)
		{
			return 'relationships'
		}

		throw 'Type not implemented.'
	}

	/**
	 * Get Relationship from the graph
	 *
	 * @param {Node} start Start node
	 * @param {Node} end End node
	 * @param {Function} $Relationship Relationship class
	 * @returns {Relationship} Relationship or null if no match was found
	 *
	 * @memberOf Graph
	 */
	getRelationship(start, end, $Relationship)
	{
		let relationship = null

		for (const [, item] of this.relationships)
		{
			const entity = item.$entity || item

			if (entity.type !== $Relationship.type)
			{
				continue
			}

			if (entity.start.equals(start.$id) && !entity.end.equals(end.$id) && $Relationship.direction === Relationship.OUT)
			{
				relationship = item
				break
			}

			if (entity.start.equals(end.$id) && !entity.end.equals(start.$id) && $Relationship.direction === Relationship.IN)
			{
				relationship = item
				break
			}
		}

		if (!relationship)
		{
			return null
		}

		if (!(relationship instanceof $Relationship))
		{
			relationship = new $Relationship(relationship, this)
			this.relationships.set(relationship.$id, relationship)
		}

		return relationship
	}

	/**
	 * Get related nodes
	 *
	 * @param {Node} node Start node
	 * @param {Function} $Relationship Relationship class
	 * @returns {Node[]} Related nodes
	 *
	 * @memberOf Graph
	 */
	getRelated(node, $Relationship)
	{
		const entity = node.$entity
		const results = []

		for (const rel of this.relationships.values())
		{
			let other = null

			if (rel.type !== $Relationship.type)
			{
				continue
			}

			if ($Relationship.direction === Relationship.OUT && rel.start.equals(entity.identity))
			{
				other = this.nodes.get(rel.end.toNumber())
			}
			else if ($Relationship.direction === Relationship.IN && rel.end.equals(entity.identity))
			{
				other = this.nodes.get(rel.start.toNumber())
			}
			else
			{
				continue
			}

			if (!(other instanceof $Relationship.Model))
			{
				other = new $Relationship.Model(other, this)
				this.nodes.set(other.$id, other)
			}

			if ($Relationship.singular)
			{
				return other
			}

			results.push(other)
		}

		return results
	}
}

module.exports = Graph
