'use strict'

const neo4j = require('neo4j-driver/lib/v1')

const _db = Symbol('db')
const _Node = Symbol('Node')
const _Relationship = Symbol('Relationship')
const _NodeCollection = Symbol('NodeCollection')

/**
 * Object-Graph Map
 *
 * @class Graph
 */
class Graph
{
	static get TYPE_NODE()
	{
		return 'node'
	}

	static get TYPE_RELATIONSHIP()
	{
		return 'relationship'
	}

	static get TYPE_INTEGER()
	{
		return 'integer'
	}

	static get TYPE_ARRAY()
	{
		return 'array'
	}

	/**
	 * Get a database instance.
	 *
	 * @readonly
	 * @static
	 */
	static get db()
	{
		/**
		 * @private
		 */
		this[_db] = this[_db] || require('./DB')

		return this[_db]
	}

	static get Node()
	{
		if (!this[_Node])
		{
			/**
			 * @private
			 */
			this[_Node] = require('./Node')
		}

		return this[_Node]
	}

	static get Relationship()
	{
		if (!this[_Relationship])
		{
			/**
			 * @private
			 */
			this[_Relationship] = require('./Relationship')
		}

		return this[_Relationship]
	}

	static get NodeCollection()
	{
		if (!this[_NodeCollection])
		{
			/**
			 * @private
			 */
			this[_NodeCollection] = require('./NodeCollection')
		}

		return this[_NodeCollection]
	}

	/**
	 * Build a graph from query results.
	 * Map variables returned from the query to Nodes
	 *
	 * @static
	 * @param {string} query The search query.
	 * @param {object} parameters The parameters used in the search query.
	 * @param {object} models variables and Node models as key-value pairs.
	 * @param {object} [links=null] virtual relationships between records
	 * @returns {Graph} The resulting graph.
	 */
	static build(query, parameters, models = {}, links = null)
	{
		return this.db.query(query, parameters)
			.then(result =>
			{
				return new this(result, models, links)
			})
	}

	/**
	 * Creates an instance of Graph.
	 *
	 * @param {neo4j.Result} result Result of a query.
	 * @param {object} models variables and Node models as key-value pairs.
	 * @param {object} [links=null] virtual relationships between records
	 */
	constructor(result, models = {}, links = null)
	{
		this.nodes         = new Map()
		this.relationships = new Map()
		this.index         = new Map()
		this.references    = {}
		this.models        = models
		this.links         = links

		if (result && result.records)
		{
			this.addRecords(result.records)
		}
	}

	/**
	 * Run a Cypher query and add the result to the current Graph instance
	 *
	 * @param {string} query A Cypher query
	 * @param {Object} parameters Parameters used in the query
	 * @param {Object} [models] Map variables to Models
	 * @param {Object} [links] Link results to a specific Model
	 * @returns {Promise} A promise
	 */
	run(query, parameters, models = {}, links = null)
	{
		Object.assign(this.models, models)

		if (links)
		{
			this.links = this.links || {}
			Object.assign(this.links, links)
		}

		return this.constructor.db.query(query, parameters)
			.then(result =>
			{
				this.addRecords(result.records)
			})
	}

	/**
	 * Add records to the graph
	 *
	 * @param {neo4j.Record[]} records Neo4j Records
	 */
	addRecords(records)
	{
		for (const record of records)
		{
			record.forEach(this.add.bind(this))

			if (this.links)
			{
				this.addLinks(record)
			}
		}
	}

	/**
	 * Link record items
	 *
	 * @param {neo4j.Record} record Neo4j Record
	 */
	addLinks(record)
	{
		const names = Object.keys(this.links)

		for (const name of names)
		{
			const link = this.links[name]

			link.items = link.items || []

			const startKey = link.start || Object.keys(this.models)[0]
			const endKey = link.end || name

			if (record.has(startKey) && record.has(endKey))
			{
				const start = record.get(startKey).identity.toNumber()

				const entity = record.get(endKey)
				const type = Graph.typeOf(entity)
				const value = entity.identity ? entity.identity.toNumber() : entity

				const item = {
					start,
					value,
					type
				}

				if (endKey in this.models)
				{
					link.model = this.models[endKey]
				}

				link.items.push(item)
			}
		}
	}

	/**
	 * Add one or more entities to the graph
	 *
	 * @param {neo4j.types.Node|neo4j.types.Node[]|neo4j.types.Relationship|neo4j.types.Relationship[]} entity One or more entities
	 * @param {string} key The key associated with this
	 */
	add(entity, key)
	{
		const type = Graph.typeOf(entity)

		if (type === Graph.TYPE_ARRAY)
		{
			for (const item of entity)
			{
				this.add(item, key)
			}
			return
		}

		const id = Graph.getId(entity)

		this.references[key] = this.references[key] || []
		this.references[key].push(id !== null ? id : entity)

		if (type !== Graph.TYPE_NODE && type !== Graph.TYPE_RELATIONSHIP)
		{
			return
		}

		entity.$key = key

		const map = this.getMap(entity)
		let current

		if (map.has(id))
		{
			current = map.get(id)
		}
		else
		{
			current = {
				entity
			}
		}

		if (key in this.models)
		{
			const $Model = this.models[key]

			current.models = current.models || {}
			current.models[$Model.name] = new $Model(entity, this)
		}

		map.set(id, current)

		if (type === Graph.TYPE_RELATIONSHIP)
		{
			this.setRelationshipsIndex(entity)
		}
	}

	setRelationshipsIndex(entity)
	{
		const id = Graph.getId(entity)
		const index = this.index

		index[entity.type] = index[entity.type] || {
			in: {},
			out: {},
		}

		const start = Graph.getId(entity.start)
		const end = Graph.getId(entity.end)

		const map = index[entity.type]

		map.out[start] = map.out[start] || {}
		map.out[start][end] = id

		map.in[end] = map.in[end] || {}
		map.in[end][start] = id
	}

	/**
	 * Remove one or more entities from the graph
	 *
	 * @param {neo4j.types.Node|neo4j.types.Node[]|neo4j.types.Relationship|neo4j.types.Relationship[]|Node|Node[]|Relationship|Relationship[]} obj One or more objects
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

		const entity = Graph.getEntity(obj)
		const id = Graph.getId(entity)

		this.getMap(entity).delete(id)

		const map = this.references[entity.$key]
		const i = map.indexOf(id)

		if (i >= 0)
		{
			map.splice(i, 1)
		}
	}

	/**
	 * Get the Neo4j node entity
	 *
	 * @param {Node|neo4j.types.Node|Object} subject Anything that could represent a node
	 * @returns {neo4j.types.Node} The Neo4j Node entity
	 */
	static getEntity(subject)
	{
		if (subject instanceof Graph.Node || subject instanceof Graph.Relationship)
		{
			return subject.$entity
		}

		if (subject instanceof neo4j.types.Node || subject instanceof neo4j.types.Relationship)
		{
			return subject
		}

		if (subject.entity)
		{
			return subject.entity
		}

		return null
	}

	/**
	 * Get the type of the entity
	 *
	 * @param {any} entity Entity object
	 * @returns {string} Graph.TYPE_NODE, Graph.TYPE_RELATIONSHIP, Graph.TYPE_INTEGER or native JS type
	 */
	static typeOf(entity)
	{
		if (entity instanceof neo4j.types.Node)
		{
			return Graph.TYPE_NODE
		}

		if (entity instanceof neo4j.types.Relationship)
		{
			return Graph.TYPE_RELATIONSHIP
		}

		if (neo4j.isInt(entity))
		{
			return Graph.TYPE_INTEGER
		}

		if (Array.isArray(entity))
		{
			return Graph.TYPE_ARRAY
		}

		return typeof entity
	}

	/**
	 * Get Neo4j Node id
	 *
	 * @param {Node|neo4j.types.Node|Object} subject Anything that could represent a node
	 * @returns {Number} The Neo4j Node ID as number
	 */
	static getId(subject)
	{
		if (!isNaN(subject))
		{
			return parseInt(subject)
		}

		if (subject instanceof Graph.Node || subject instanceof Graph.Relationship)
		{
			return subject.$id
		}

		if (subject instanceof neo4j.types.Node || subject instanceof neo4j.types.Relationship)
		{
			return subject.identity.toNumber()
		}

		return null
	}

	/**
	 * Get the map used for the entity
	 *
	 * @param {any} entity Entity object
	 * @returns {Map} The entity map
	 */
	getMap(entity)
	{
		const type = Graph.typeOf(entity)

		if (type === Graph.TYPE_NODE || entity instanceof Graph.Node)
		{
			return this.nodes
		}

		if (type === Graph.TYPE_RELATIONSHIP || (entity.prototype && entity.prototype instanceof Graph.Relationship))
		{
			return this.relationships
		}

		throw new Error(`No map defined for this entity: ${ entity }`)
	}

	/**
	 * Get Relationship from the graph
	 *
	 * @param {Node} start Start node
	 * @param {Node} end End node
	 * @param {Function} $Relationship Relationship class
	 * @returns {Relationship} Relationship or null if no match was found
	 */
	getRelationship(start, end, $Relationship)
	{
		start = Graph.getId(start)
		end = Graph.getId(end)

		let relationshipId = null

		const index = this.index[$Relationship.type]

		if (!index)
		{
			return null
		}

		if ($Relationship.direction === Graph.Relationship.OUT)
		{
			if (index.out[start] && index.out[start][end] >= 0)
			{
				relationshipId = index.out[start][end]
			}
			else
			{
				return null
			}
		}
		else if ($Relationship.direction === Graph.Relationship.IN)
		{
			if (index.in[start] && index.in[start][end] >= 0)
			{
				relationshipId = index.in[start][end]
			}
			else
			{
				return null
			}
		}
		// At this point the relationship could be in any direction so,
		// we simply check if a matching relationship is found in the index.
		else if (index.out[start] && index.out[start][end] >= 0)
		{
			relationshipId = index.out[start][end]
		}
		else if (index.in[start] && index.in[start][end] >= 0)
		{
			relationshipId = index.in[start][end]
		}
		else
		{
			return null
		}

		const relationship = this.relationships.get(relationshipId)

		if (!relationship.model)
		{
			relationship.model = new $Relationship(relationship.entity, this)
		}

		return relationship.model
	}

	/**
	 * Get related nodes
	 *
	 * @param {Node} node Start node
	 * @param {Function} $Relationship Relationship class
	 * @returns {Node[]} Related nodes
	 */
	getRelated(node, $Relationship)
	{
		const id = Graph.getId(node)

		const type = $Relationship.type
		const direction = $Relationship.direction

		const index = this.index[type]
		let others = []

		if (!index)
		{
			return others
		}

		if ([Graph.Relationship.OUT, Graph.Relationship.ANY].includes(direction))
		{
			if (id in index.out)
			{
				others = others.concat(Object.keys(index.out[id]))
			}
		}

		if ([Graph.Relationship.IN, Graph.Relationship.ANY, Graph.Relationship.BOTH].includes(direction))
		{
			if (id in index.in)
			{
				others = others.concat(Object.keys(index.in[id]))
			}
		}

		const unique = others.filter((other, position, array) => array.indexOf(other) === position)

		const results = unique.map(other =>
		{
			return this.getNodeModel(other, $Relationship.Model)
		})

		return $Relationship.singular ? results[0] : results
	}

	/**
	 * Wrap a Neo4j node in a specified Node model
	 *
	 * @param {Number|neo4j.integer} id The Neo4j Node ID
	 * @param {Function<Node>} $Node The Node Model Class
	 * @returns {Node} The Node model
	 */
	getNodeModel(id, $Node)
	{
		if (neo4j.isInt(id))
		{
			id = id.toNumber()
		}

		id = parseInt(id, 10)

		const node = this.nodes.get(id)

		if (!node)
		{
			throw new Error('Node not found')
		}

		if (!$Node)
		{
			$Node = Graph.Node
		}

		node.models = node.models || {}

		if (!node.models[$Node.name])
		{
			node.models[$Node.name] = new $Node(node.entity, this)
		}

		return node.models[$Node.name]
	}

	/**
	 * Get all Nodes for a reference used in the Cypher query
	 *
	 * @param {string} reference The reference
	 * @returns {array} An array of nodes
	 */
	getNodes(reference)
	{
		const ids = this.references[reference]
		const nodes = []
		const Model = this.models[reference]

		if (!ids)
		{
			return nodes
		}

		for (const id of ids)
		{
			nodes.push(this.getNodeModel(id, Model))
		}

		return nodes
	}

	/**
	 * Get linked results mapped to Models
	 *
	 * @param {Node} node The start node
	 * @param {string} name The name of the link
	 * @returns {any} The linked result
	 */
	getLinked(node, name)
	{
		if (!this.links || !this.links[name] || !this.links[name].items)
		{
			return null
		}

		const entity = Graph.getEntity(node)
		const id = Graph.getId(entity)
		const link = this.links[name]
		const results = []

		for (const item of link.items)
		{
			if (item.start !== id)
			{
				continue
			}

			let value = item.value

			if (item.type === Graph.TYPE_NODE)
			{
				value = this.getNodeModel(value, link.model)
			}

			if (item.type === Graph.TYPE_INTEGER)
			{
				value = value.toNumber()
			}

			if (item.type === Graph.TYPE_ARRAY && link.model && link.model.prototype instanceof Graph.NodeCollection)
			{
				const Collection = link.model

				value = new Collection(value)

				// Assume collections are 'singular' by default
				if (link.singular !== false)
				{
					return value
				}
			}

			if (link.singular)
			{
				return value
			}

			results.push(value)
		}

		return results
	}
}

module.exports = Graph
