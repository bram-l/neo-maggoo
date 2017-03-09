'use strict'

const neo4j = require('neo4j-driver/lib/v1')
const { Model } = require('maggoo')
const NodeCollection = require('./NodeCollection')
const RelatedNode = require('./RelatedNode')
const RelatedNodeCollection = require('./RelatedNodeCollection')
const Relationship = require('./Relationship')
const Graph = require('./Graph')
const DB = require('./DB')
const shortid = require('shortid')
const merge = require('deepmerge')


/**
 * Query options object
 * @typedef {Object} QueryOptions
 * @property {Object.<String, *>} parameters - Parameters used in the query.
 * @property {String} variable - The variable used to identify the Node in the query, 'n' by default.
 * @property {Array} variables - All variables used in the query that should be added to the results.
 * @property {String|Array} where - The where clause, arrays are joined by the 'AND' operator.
 * @property {Number} limit - The maximum number of results to be returned
 * @property {String} with - The name of relationship to include, use the dot-notation to include mutliple levels
 * @property {Array} with - An array of names of relationships to include
 * @property {Object.<String, Boolean|Object>} with - Relationships to include (true) or exclude (false) or filter(object)
 */

/**
 * Relationship definition object
 * @typedef {object} RelationshipDefinition
 * @property {Node|function} Model - {@link Relationship.Model}
 * @property {string} type - {@link Relationship.type}
 * @property {string} direction - {@link Relationship.direction}
 * @property {boolean} singular - {@link Relationship.singular}
 */

// Private
const _related = Symbol()
const _labels = Symbol()

/**
 * @class Node
 * @extends {Model}
 */
class Node extends Model {

	/**
	 * Creates an instance of Node.
	 *
	 * @param {Node|neo4j.types.Node} node Node data object or neo4j Node
	 * @param {Graph} [graph] The current graph
	 */
	constructor(node, graph)
	{
		if (node instanceof neo4j.types.Node)
		{
			super(node.properties)

			this.$labels = node.labels

			/**
			 * @type {neo4.Node} The original node data from the graph
			 */
			this.$entity = node
		}
		else
		{
			super(node)
		}

		/**
		 * @private
		 */
		this[_related] = {}

		/**
		 * @type {Graph} The graph this node is part of
		 */
		this.$graph = graph
	}

	/**
	 * The node ID.
	 * This will be automatically genreated when the node is saved
	 *
	 * @type {string}
	 */
	get id()
	{
		return this.$data.id
	}

	set id(value)
	{
		this.$data.id = value
	}

	/**
	 * ID generator, uses ShortId by default
	 * @returns {string} ID
	 */
	static uuid()
	{
		return shortid.generate()
	}

	/**
	 * The neo4j entity ID.
	 * Note that this could change over time, use id instead.
	 *
	 * @readonly
	 * @type {number}
	 */
	get $id()
	{
		return this.$entity ? this.$entity.identity.toNumber() : null
	}

	/**
	 * Whether or not the node is already stored in the graph database.
	 *
	 * @type {boolean}
	 */
	get $new()
	{
		return !this.$entity
	}

	/**
	 * Whether or not the Node has changed properties.
	 *
	 * @type {boolean}
	 */
	get $dirty()
	{
		return this.$new || super.$dirty
	}

	/**
	 * Get a relationship by name.
	 *
	 * @param {string} name The name of the relationship
	 * @returns {Relationship} The relastionship
	 */
	getRelationship(name)
	{
		if (!(name in this.constructor.Relationships))
		{
			return null
		}

		return this.constructor.Relationships[name]
	}

	/**
	 * Get a Node property or related node(s).
	 *
	 * @param {string} key The name of the property or relationship
	 * @returns {any|RelatedNodeCollection} The value or related node(s)
	 */
	get(key)
	{
		if (key in this.constructor.Relationships)
		{
			return this.getRelated(key)
		}

		return super.get(key)
	}

	/**
	 * Set a Node property or related node(s).
	 *
	 * @param {string} key The name of the property or relationship
	 * @param {any} value The value or related node(s)
	 * @returns {boolean} Whether or not the property was successfully set
	 */
	set(key, value)
	{
		if (key in this.constructor.relationships)
		{
			return this.setRelated(key, value)
		}

		return super.set(key, value)
	}

	/**
	 * Get related node(s).
	 *
	 * @param {string} name The name of the relationship
	 * @returns {RelatedNodeCollection} The related node(s)
	 */
	getRelated(name)
	{
		const $Relationship = this.getRelationship(name)

		if (!this[_related][name])
		{
			const nodes = this.$graph ? this.$graph.getRelated(this, $Relationship) : []
			const related = new RelatedNodeCollection($Relationship, nodes, this)

			this[_related][name] = related
		}

		const result = this[_related][name]

		if (!result.length && $Relationship.singular)
		{
			return null
		}

		return $Relationship.singular ? result[0] : result
	}

	/**
	 * Add related node(s).
	 * Existing nodes will not be overwritten unless the relationship is singular.
	 *
	 * @param {string} name The name of the relationship
	 * @param {Node|NodeCollection|Node[]} node Node(s)
	 * @param {Object} [properties={}] Properties to set on the relationship(s)
	 */
	addRelated(name, node, properties = {})
	{
		this.setRelated(name, node, properties, false)
	}

	/**
	 * Set related node(s).
	 *
	 * @param {string} name The name of the relastionship
	 * @param {Node|NodeCollection|Node[]} node Node(s)
	 * @param {any} [properties={}] Properties to set on the relationship(s)
	 * @param {boolean} [overwrite=true] If set to false existing nodes will not be overwritten unless the relationship is singular
	 */
	setRelated(name, node, properties = {}, overwrite = true)
	{
		const $Relationship = this.getRelationship(name)

		let result = null

		if ($Relationship.singular)
		{
			result = new RelatedNodeCollection($Relationship, [node], this)
			result[0].$rel.setProperties(properties)
		}
		else
		{
			const nodes = node instanceof Array ? node : [node]
			const items = []

			for (node of nodes)
			{
				const item = new RelatedNode($Relationship, this, node, properties, this.$graph)

				items.push(item)
			}

			if (overwrite)
			{
				result = new RelatedNodeCollection($Relationship, items, this)
			}
			else
			{
				result = this.getRelated(name)
				result.push(...items)
			}
		}

		this.setChanged(name, result)

		this[_related][name] = result
	}

	/**
	 * Node labels. Will be added the node in the graph database.
	 * By default it uses the label as defined by $type.
	 *
	 * @type {Array}
	 */
	get $labels()
	{
		return this[_labels] ? this[_labels] : [this.$type]
	}

	/**
	 * Node labels. Will be added the node in the graph database.
	 * By default it uses the label as defined by $type.
	 *
	 * @type {Array}
	 * @param {Array} labels Labels
	 */
	set $labels(labels)
	{
		// Mark as private to exclude from esdoc
		/**
		 * @private
		 */
		this[_labels] = labels
	}

	/**
	 * Save the Node to the graph database.
	 *
	 * @param {boolean} [deep=false] If true save all related nodes
	 * @param {any} [tx=null] The current database transaction
	 */
	async save(deep = false, tx = null)
	{
		// Prevent infinite loops in circular graphs
		if (tx && tx.$nodes.includes(this.id))
		{
			return
		}

		let session = null

		if (!tx)
		{
			tx = DB.beginTransaction()
			session = tx.session
		}

		this.id = this.id || Node.uuid()

		tx.$nodes.push(this.id)

		if (this.$dirty)
		{
			const properties = Object.assign({}, this.$data)
			const parameters = { properties }

			let query = ''

			parameters.id = this.id

			query += 'MERGE (n {id: {id}})'
			query += '\n'

			// TODO: remove properties that were explicitly deleted

			query += `
				SET n:${ this.$labels.join(':') }
				SET n += {properties}
				RETURN n
			`

			const result = await tx.run(query, parameters).then(r => r)

			this.$entity = result.records[0].get('n')
			this.reset()
		}

		if (deep)
		{
			await this.saveRelated(tx)
		}

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}

	/**
	 * Save related nodes and their relationships
	 *
	 * @param {Transaction} [tx] The current databse transaction
	 */
	async saveRelated(tx = null)
	{
		for (const key of Object.keys(this.constructor.Relationships))
		{
			let nodes = this.getRelated(key)

			if (nodes && !(nodes instanceof Array))
			{
				nodes = [nodes]
			}

			if (!nodes || !nodes.length)
			{
				continue
			}

			for (const node of nodes)
			{
				await node.save(true, tx)

				if (node.$rel.$dirty)
				{
					await node.$rel.save(tx)
				}
			}
		}
	}

	/**
	 * Delete node from the graph database
	 *
	 * @param {boolean} [deep=false] Delete related nodes
	 * @param {Transaction} [tx=null] The current databse transaction
	 */
	async delete(deep = false, tx = null)
	{
		if (!this.id)
		{
			throw 'Can not delete a node without ID'
		}

		// Prevent infinite loops in circular graphs
		if (tx && tx.$nodes.includes(this.id))
		{
			return
		}

		let session = null

		if (!tx)
		{
			session = DB.driver.session()
			tx = session.beginTransaction()
			tx.$nodes = []
		}

		tx.$nodes.push(this.id)

		const query = `
			MATCH (n)
			WHERE n.id = {id}
			DETACH DELETE n
		`

		const parameters = { id: this.id }

		await DB.query(query, parameters)

		if (this.$graph)
		{
			this.$graph.remove(this.$entity)
		}

		if (deep)
		{
			await this.deleteRelated(tx)
		}

		this.$entity = null
		this.$data.id = null

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}

	/**
	 * Delete related nodes and their relationships
	 *
	 * @param {Transaction} [tx] The current databse transaction
	 */
	async deleteRelated(tx = null)
	{
		for (const [name] of Object.entries(this.constructor.Relationships))
		{
			const $Relationship = this.getRelationship(name)
			let nodes = this.getRelated(name)

			if ($Relationship.singular)
			{
				nodes = nodes ? [nodes] : []
			}

			for (const node of nodes)
			{
				await node.delete(true, tx)
			}
		}
	}

	// *** STATIC METHODS ***

	/**
	 * Fetch a single Node
	 *
	 * @param {string|object} filters Filter object or Node id
	 * @param {QueryOptions} [o={}] Query options
	 * @returns {Node} Result
	 *
	 * @example
	 * const node = await Node.get('foo')
	 *
	 * @example
	 * const node = await Node.get({ id: 'foo' })
	 */
	static async get(filters, o = {})
	{
		o.singular = true

		return this.find(filters, o)
	}

	// @param {QueryOptions} [o={}] Query options


	/**
	 * Fetch Nodes
	 *
	 * @param {QueryOptions} o Query options
	 * @return {NodeCollection} Results
	 *
	 * @example
	 * const nodes = await Node.all({ limit: 10 })
	 */
	static async all(o)
	{
		const results = await this.find(null, o)

		return results
	}

	/**
	 * Use a query statement to search for Nodes
	 * By default returns results for 'n' as Node collection
	 *
	 * @param {string} query A search query
	 * @param {object} [parameters={}] Parameters used in query
	 * @param {QueryOptions} [o={}] Query options
	 * @returns {NodeCollection} Results
	 *
	 * @example
	 * const nodes = await Node.query(`
	 *     MATCH (n:Node)
	 *     WHERE n.foo > {foo}
	 * `, { foo: 1 })
	 */
	static async query(query, parameters = {}, o = {})
	{
		o = merge(o, { query, parameters })

		return this.find(null, o)
	}

	/**
	 * Use a query statement to search for Nodes
	 * By default returns results for 'n' as Node collection
	 *
	 * @param {string} where A where clause
	 * @param {object} [parameters={}] Parameters used in query
	 * @param {QueryOptions} [o={}] Query options
	 * @returns {NodeCollection} Results
	 *
	 * @example
	 * const nodes = await Node.where('n.foo > {foo}', { foo: 1 })
	 */
	static async where(where, parameters = {}, o = {})
	{
		o = merge(o, { where, parameters })

		return this.find(null, o)
	}

	/**
	 * Default values for query options
	 *
	 */
	static get defaults()
	{
		return {
			parameters: {},
			variable: 'n',
			variables: []
		}
	}

	/**
	 * Find Nodes based on filter or Node ID
	 *
	 * @param {object|string|number} filters Search filters, Node ID (string), or neo4j node identifier (number)
	 * @param {QueryOptions} [o={}] Query options
	 * @returns {NodeCollection} Results
	 *
	 * @example
	 * // Find by ID
	 * const nodes = Node.find('foo')
	 *
	 * @example
	 * // Find by filter
	 * const nodes = Node.find({ foo: 1 })
	 *
	 * @example
	 * // Find by filter, with related Nodes
	 * const nodes = Node.find({ foo: 1 }, { with: 'relatives' })
	 * nodes[0].relatives
	 */
	static async find(filters, o = {})
	{
		o = merge(merge({}, this.defaults), o)

		if (!o.variables.includes(o.variable))
		{
			o.variables.push(o.variable)
		}

		if (filters)
		{
			o = merge(o, this.parseFilters(filters, o.variable))
		}

		if (o.with)
		{
			o = merge(o, this.getRelationshipsQuery(o.with, o.variables, o.variable))
		}

		const query = this.buildQuery(o)

		// console.log('query', query, o.parameters)
		// console.time('query time')

		const graph = await Graph.build(query, o.parameters, { [o.variable]: this })

		// console.timeEnd('query time')

		if (o.singular)
		{
			return graph.map[o.variable] ? graph.map[o.variable][0] : null
		}

		const nodes = graph.map[o.variable] || []

		return new NodeCollection(this, nodes)
	}

	/**
	 * Build a search query
	 *
	 * @param {object} o Query options
	 * @returns {string} Query string
	 */
	static buildQuery(o)
	{
		o = merge(this.defaults, o)

		// Build Query
		let query = o.query || `MATCH (${ o.variable }:${ this.name })\n`

		// Define filters
		if (Array.isArray(o.where) && o.where.length)
		{
			query += 'WHERE '
			query += o.where.join('\nAND ')
			query += '\n'
		}
		else if (typeof o.where == 'string')
		{
			query += 'WHERE '
			query += o.where
			query += '\n'
		}

		if (o.matches)
		{
			query += o.matches.join('\n')
			query += '\n'
		}

		query += 'RETURN '

		// Define return values
		if (o.return)
		{
			query += o.return
		}
		else
		{
			query += o.variables.join(', ')
		}

		query += '\n'

		if (o.orderBy)
		{
			query += `ORDER BY ${ o.orderBy }\n`
		}

		if (o.skip)
		{
			query += `SKIP ${ parseInt(o.skip, 10) }\n`
		}

		if (o.limit)
		{
			query += `LIMIT ${ parseInt(o.limit, 10) }\n`
		}

		return query
	}

	/**
	 * Parse search filters
	 *
	 * @param {object|string|number} filters Search filters, Node ID (string), or neo4j node identifier (number)
	 * @param {string} [variable] Variable for the current node
	 * @returns {QueryOptions} Filters options object
	 */
	static parseFilters(filters, variable = 'n')
	{
		if (typeof filters == 'number')
		{
			filters = { $id: filters }
		}
		else if (typeof filters == 'string')
		{
			filters = { id: filters }
		}
		else if (!filters || filters !== Object(filters))
		{
			return {}
		}

		const o = {
			parameters: {},
			where: []
		}

		for (const [key, value] of Object.entries(filters))
		{
			const valueVariable = `${ variable }_${ key }`
			let condition = ''

			if (key === '$id')
			{
				condition += `id(${ variable }) `
			}
			else
			{
				condition += `${ variable }.${ key } `
			}

			if (value instanceof RegExp)
			{
				condition += `=~ {${ valueVariable }}`

				const flags = `(?${ value.flags.replace('g', '') })`

				o.parameters[valueVariable] = flags + value.source
			}
			else if (Array.isArray(value))
			{
				const names = []

				value.forEach((v, i) =>
				{
					const name = valueVariable + i

					o.parameters[name] = v
					names.push(`{${ name }}`)
				})

				condition += `IN [${ names.join(', ') }]`
			}
			else
			{
				condition += `= {${ valueVariable }}`
				o.parameters[valueVariable] = value
			}

			o.where.push(condition)
		}

		return o
	}

	/**
	 * Count nodes in graph database
	 *
	 * @param {object|string} filters Search filters (object) or where clause (string)
	 * @param {any} [parameters={}] Parameters used in where clause
	 * @param {QueryOptions} [o={}] Query options
	 * @returns {number} Number of nodes
	 */
	static async count(filters, parameters = {}, o = {})
	{
		o = merge(this.defaults, o)
		o = merge(o, { parameters })

		if (typeof filters == 'string')
		{
			o.where = filters
		}
		else if (!!filters && filters.constructor === Object)
		{
			o = merge(o, this.parseFilters(filters, o.variable))
		}

		o.return = `count(distinct(${ o.variable })) as total`

		const query = this.buildQuery(o)

		const results = await DB.query(query, o.parameters)

		return results.records[0].get('total').toInt()
	}

	/**
	 * Definitions of the relationships for this Node
	 *
	 * @member
	 * @readonly
	 * @type {object.<string, RelationshipDefinition>}
	 */
	static get relationships()
	{
		return {}
	}

	/**
	 * Auto-genreated {@link Relationship} sub-classes based on definitions
	 *
	 * @type {object.<string, Function>}
	 */
	static get Relationships()
	{
		const Relationships = {}

		const names = Object.keys(this.relationships)

		for (const name of names)
		{
			// TODO: cache classes

			class NewRelationship extends Relationship {}

			Relationships[name] = Object.assign(NewRelationship, this.relationships[name])
		}

		return Relationships
	}

	/**
	 * Build query options for related nodes
	 * Mostly intended for internal usage.
	 *
	 * @param {string} levels Filter for related nodes in dot-format (eg. father.children will fetch the related 'father' and its 'children')
	 * @param {object} variables The variables currently used for building the query
	 * @param {string} [reference='n'] Reference variable for the current node
	 * @returns {options} Query options object
	 * @property {array} matches Optional matches for each relationship
	 * @property {object} variables The variables currently used for building the query
	 */
	static getRelationshipsQuery(levels, variables, reference = 'n')
	{
		let o = {
			matches: [],
			variables
		}

		const relationships = this.Relationships
		const names = Object.keys(relationships)

		if (typeof levels === 'string')
		{
			levels = { [levels]: true }
		}
		else if (Array.isArray(levels))
		{
			levels = levels.reduce((obj, key) =>
			{
				obj[key] = {}
				return obj
			}, {})
		}

		for (const name of names)
		{
			let next = null
			let current = null
			let filters = null

			for (let level of Object.keys(levels))
			{
				filters = levels[level]

				if (level.includes('.'))
				{
					next = level.substr(level.indexOf('.') + 1)
					next = { [next]: filters }

					level = level.substr(0, level.indexOf('.'))
				}
				else
				{
					next = null
				}

				if (name === level)
				{
					current = level
					break
				}
			}

			if (!current)
			{
				continue
			}

			const relationship = relationships[name]
			const nodeVar = `${ reference }_${ name }`
			const relationshipVar = `${ reference }_r_${ name }`
			const collectionVar = '_col'

			let query = `OPTIONAL MATCH (${ reference })`

			if (relationship.direction === Relationship.IN || relationship.direction === Relationship.BOTH)
			{
				query += '<'
			}

			query += `-[${ reference }_r_${ name }:${ relationship.type }]-`

			if (relationship.direction === Relationship.OUT || relationship.direction === Relationship.BOTH)
			{
				query += '>'
			}

			query += `(${ nodeVar }:${ relationship.Model.name })`

			if (!next)
			{
				o = merge(o, this.parseFilters(filters, nodeVar))

				if (o.where && o.where.length)
				{
					query += '\n'
					query += 'WHERE '
					query += o.where.join('\nAND ')

					delete o.where
				}
			}

			query += '\n'
			query += `WITH ${ o.variables.join(', ') }, `
			query += `COLLECT(${ nodeVar }) as ${ nodeVar + collectionVar }, `
			query += `COLLECT(${ relationshipVar }) as ${ relationshipVar + collectionVar }`

			o.matches.push(query)

			o.variables.push(nodeVar + collectionVar)
			o.variables.push(relationshipVar + collectionVar)

			if (next)
			{
				const nextO = relationship.Model.getRelationshipsQuery(next, o.variables, nodeVar)

				o = merge(o, nextO)
			}
		}

		return o
	}
}

module.exports = Node
