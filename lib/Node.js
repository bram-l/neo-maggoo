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
 * @property {String} with - The name of relationship to include, use the dot-notation to include multiple levels
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

const REGEX_LEVEL_SPLIT = /\.(.*)/
const REGEX_INDEX = /([^(]*)\(?([^)]*)\)?/i

// Private
const _related = Symbol('related')
const _linked = Symbol('linked')
const _labels = Symbol('labels')

/**
 * Class representing a single node
 */
class Node extends Model
{
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
		 * @private
		 */
		this[_linked] = {}

		/**
		 * @type {Graph}
		 */
		this.$graph = graph
	}

	/**
	 * ID generator, uses ShortId by default
	 * @returns {string} ID
	 */
	static uuid()
	{
		return shortid.generate()
	}

	static addIndex(property, now = false)
	{
		return DB.addIndex(this.prototype.$type, property, now)
	}

	static addUnique(property, now = false)
	{
		return DB.addUnique(this.prototype.$type, property, now)
	}

	static async dropIndex(property)
	{
		await DB.dropIndex(this.prototype.$type, property)
	}

	static async dropUnique(property)
	{
		await DB.dropUnique(this.prototype.$type, property)
	}

	static get Collection()
	{
		const self = this

		return class extends NodeCollection
		{
			constructor(items)
			{
				super(self, items)
			}
		}
	}

	/**
	 * The node ID.
	 * This will be automatically generated when the node is saved
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
	 * Set property value
	 *
	 * @param {string} key Property name
	 * @param {any} value Property value
	 */
	setProperty(key, value)
	{
		if (value && value.toNumber)
		{
			value = value.toNumber()
		}

		super.setProperty(key, value)
	}

	/**
	 * Get a Node property or related node(s).
	 *
	 * @param {string} key The name of the property or relationship
	 * @returns {any|RelatedNodeCollection} The value or related node(s)
	 */
	get(key)
	{
		if (key in this.constructor.relationships)
		{
			return this.getRelated(key)
		}

		const value = super.get(key)

		if (typeof value === 'undefined')
		{
			return this.getLinked(key)
		}

		return value
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

	has(key)
	{
		// TODO: check related / linked

		return super.has(key)
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
	 * Get a Relationship class by name.
	 *
	 * @param {string} name The name of the relationship
	 * @returns {Relationship} The Relationship class
	 */
	static getRelationship(name)
	{
		const definition = this.relationships[name]

		if (definition.prototype instanceof Relationship)
		{
			return definition
		}

		class $Relationship extends Relationship {}

		Object.assign($Relationship, definition)

		return $Relationship
	}

	/**
	 * Get a Relationship class by name.
	 *
	 * @param {string} name The name of the relationship
	 * @returns {Relationship} The Relationship class
	 */
	getRelationship(name)
	{
		return this.constructor.getRelationship(name)
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
	 * Get linked results.
	 *
	 * @param {string} name The name of the link
	 * @returns {*} The related node(s) / value(s) or null if none is found
	 */
	getLinked(name)
	{
		if (!this.$graph)
		{
			return null
		}

		if (!this.$graph.links || !(name in this.$graph.links))
		{
			return null
		}

		if (!this[_linked][name])
		{
			const linked = this.$graph ? this.$graph.getLinked(this, name) : []

			this[_linked][name] = linked
		}

		return this[_linked][name]
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
	 * @param {string} name The name of the relationship
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

	clearCachedRelationships(relationships = null)
	{
		if (relationships === null)
		{
			relationships = Object.keys(this.constructor.relationships)
		}

		relationships = this.constructor.normalizeRelationshipLevels(relationships)

		for (const relationship of Object.keys(relationships))
		{
			const filters = relationships[relationship]

			if (this[_related][relationship] && filters.with)
			{
				this[_related][relationship].clearCachedRelationships(filters.with)
			}

			delete this[_related][relationship]
		}
	}

	static get labels()
	{
		const labels = [this.name]

		if (this === Node)
		{
			return labels
		}

		let parent = Object.getPrototypeOf(this)

		while (parent !== Node && Reflect.has(parent, 'labels'))
		{
			const $labels = Reflect.get(parent, 'labels', parent)

			labels.push(...$labels)
			parent = Object.getPrototypeOf(parent)
		}

		return labels
	}

	static get baseLabel()
	{
		return this.labels[0]
	}

	get $base()
	{
		return this.constructor.baseLabel
	}

	/**
	 * Node labels. Will be added the node in the graph database.
	 * By default it uses the constructor name.
	 *
	 * @type {Array}
	 */
	get $labels()
	{
		if (this[_labels])
		{
			return this[_labels]
		}

		const labels = this.constructor.labels

		this[_labels] = labels

		return labels
	}

	/**
	 * Node labels. Will be added the node in the graph database.
	 * By default it uses the constructor name.
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

	/* * * * * * * * * * * * * * * *
	 *        WRITE METHODS        *
	 * * * * * * * * * * * * * * * */


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

		this.id = this.id || this.constructor.uuid()

		tx.$nodes.push(this.id)

		if (this.$dirty)
		{
			const properties = Object.assign({}, this.$data)
			const parameters = { properties }

			let query = ''

			parameters.id = this.id

			query += `MERGE (n:${ this.$base } {id: {id}})`
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
			const relationships = typeof deep === 'boolean' ? null : deep

			await this.saveRelated(relationships, tx)
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
	 * @param {Array} [keys] The relationships to be saved (all by default)
	 * @param {Transaction} [tx] The current database transaction
	 */
	async saveRelated(keys = null, tx = null)
	{
		let relationships = keys || Object.keys(this.constructor.relationships)

		if (typeof relationships === 'string')
		{
			relationships = [relationships]
		}

		for (const key of relationships)
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
				const deep = keys === null

				await node.save(deep, tx)

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
	 * @param {Transaction} [tx=null] The current database transaction
	 */
	async delete(deep = false, tx = null)
	{
		if (!this.id)
		{
			throw new Error('Can not delete a node without ID')
		}

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
			tx.$nodes = []
		}

		tx.$nodes.push(this.id)

		const query = `
			MATCH (n:${ this.$base })
			WHERE n.id = {id}
			DETACH DELETE n
		`

		const parameters = { id: this.id }

		await tx.run(query, parameters).then(r => r)

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
	 * @param {Transaction} [tx] The current database transaction
	 */
	async deleteRelated(tx = null)
	{
		for (const key of Object.keys(this.constructor.relationships))
		{
			const $Relationship = this.getRelationship(key)
			let nodes = this.getRelated(key)

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

	async addLabel(label, tx = null)
	{
		await this.addLabels(label, tx)
	}

	async addLabels(labels, tx = null)
	{
		let query = `
			MATCH (n:${ this.$base })
			WHERE n.id = {id}
		`

		if (!Array.isArray(labels))
		{
			labels = [labels]
		}

		for (const label of labels)
		{
			query += `
				SET n:${ label }
			`
		}

		const parameters = { id: this.id }

		let session = null

		if (!tx)
		{
			tx = DB.beginTransaction()
			session = tx.session
		}

		await tx.run(query, parameters).then(r => r)

		const added = labels.filter(label => !this.$labels.includes(label))

		this.$labels.push(...added)

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}

	async removeLabel(label, tx = null)
	{
		await this.removeLabels(label, tx)
	}

	async removeLabels(labels, tx = null)
	{
		let query = `
			MATCH (n:${ this.$base })
			WHERE n.id = {id}
		`

		if (!Array.isArray(labels))
		{
			labels = [labels]
		}

		for (const label of labels)
		{
			query += `
				REMOVE n:${ label }
			`
		}

		const parameters = { id: this.id }

		let session = null

		if (!tx)
		{
			tx = DB.beginTransaction()
			session = tx.session
		}

		await tx.run(query, parameters).then(r => r)

		this.$labels = this.$labels.filter(label => !labels.includes(label))

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}


	/* * * * * * * * * * * * * * * *
	 *        READ METHODS         *
	 * * * * * * * * * * * * * * * */


	/**
	 * Default values for query options
	 */
	static get queryDefaults()
	{
		return {
			parameters: {},
			variable: 'n',
			variables: [],
			links: null
		}
	}

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
		return this.find(null, o)
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
		o = merge(merge({}, this.queryDefaults), o)

		if (!o.variables.includes(o.variable))
		{
			o.variables.push(o.variable)
		}

		if (o.models)
		{
			Object.keys(o.models).map(variable =>
			{
				if (!o.variables.includes(variable))
				{
					o.variables.push(variable)
				}
			})
		}

		if (o.links)
		{
			Object.keys(o.links).map(variable =>
			{
				if (!o.variables.includes(variable))
				{
					o.variables.push(variable)
				}
			})
		}

		if (filters)
		{
			o = merge(o, this.parseQueryFilters(filters, o.variable))
		}

		if (o.with)
		{
			o = merge(o, this.getRelationshipQueryOptions(o.with, o.variables, o.variable))
		}

		const query = this.buildQuery(o)

		const models = o.models || {}

		if (!models[o.variable])
		{
			models[o.variable] = this
		}

		const graph = await Graph.build(query, o.parameters, models, o.links)

		const nodes = graph.getNodes(o.variable)

		if (o.singular)
		{
			return nodes && nodes.length ? nodes[0] : null
		}

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
		o = merge(this.queryDefaults, o)

		if (o.index && typeof o.index == 'string')
		{
			let [, label, property] = o.index.match(REGEX_INDEX)

			if (!property)
			{
				property = label
				label = this.baseLabel
			}

			o.index = { label, property }
		}

		// Build Query
		let query = o.query || `MATCH (${ o.variable }:${ o.index ? o.index.label : this.labels.join(':') })\n`

		if (o.index)
		{
			query += `USING INDEX ${ o.variable }:${ o.index.label }(${ o.index.property })\n`
		}

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

		if (o.set)
		{
			const lines = Array.isArray(o.set) ? o.set : [o.set]

			for (const line of lines)
			{
				query += `SET ${ line }\n`
			}
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
		else if (o.singular)
		{
			query += 'LIMIT 1\n'
		}

		return query
	}

	/**
	 * Parse search filters
	 *
	 * @param {object|string|number} filters Search filters, Node ID (string), or neo4j node identifier (number)
	 * @param {string} variable Variable for the current node
	 * @returns {QueryOptions} Filters options object
	 */
	static parseQueryFilters(filters, variable)
	{
		if (typeof filters == 'number')
		{
			filters = { $id: filters }
		}
		else if (typeof filters == 'string')
		{
			filters = { id: filters }
		}
		else if (!filters || filters.constructor !== Object)
		{
			throw new Error(`Invalid filter object: ${ filters }`)
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
		o = merge(this.queryDefaults, o)
		o = merge(o, { parameters })

		if (typeof filters == 'string')
		{
			o.where = filters
		}
		else if (!!filters && filters.constructor === Object)
		{
			o = merge(o, this.parseQueryFilters(filters, o.variable))
		}

		o.return = `count(distinct(${ o.variable })) as total`

		const query = this.buildQuery(o)

		const total = await DB.getScalar(query, o.parameters)

		return total.toInt()
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
	static getRelationshipQueryOptions(levels, variables, reference = 'n')
	{
		let o = {
			matches: [],
			variables
		}

		levels = this.normalizeRelationshipLevels(levels)

		for (const name of Object.keys(levels))
		{
			let next = null
			const filters = levels[name]

			if (filters.with)
			{
				next = filters.with
				delete filters.with
			}
			else
			{
				next = null
			}

			const $Relationship = this.getRelationship(name)
			const nodeVar = `${ reference }_${ name }`
			const relationshipVar = `${ reference }_r_${ name }`
			const collectionVar = '_col'

			let query = `OPTIONAL MATCH (${ reference })`

			if ($Relationship.direction === Relationship.IN || $Relationship.direction === Relationship.BOTH)
			{
				query += '<'
			}

			query += `-[${ reference }_r_${ name }:${ $Relationship.type }]-`

			if ($Relationship.direction === Relationship.OUT || $Relationship.direction === Relationship.BOTH)
			{
				query += '>'
			}

			query += `(${ nodeVar }:${ $Relationship.Model.baseLabel })`

			if (!next)
			{
				o = merge(o, this.parseQueryFilters(filters, nodeVar))

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
				const nextO = $Relationship.Model.getRelationshipQueryOptions(next, o.variables, nodeVar)

				o = merge(o, nextO)
			}
		}

		return o
	}

	static normalizeRelationshipLevels(levels)
	{
		if (typeof levels === 'string')
		{
			const [current, rest] = levels.split(REGEX_LEVEL_SPLIT)

			levels = { [current]: {} }

			if (rest)
			{
				levels[current].with = this.normalizeRelationshipLevels(rest)
			}
		}
		else if (Array.isArray(levels))
		{
			levels = levels.reduce((obj, current) =>
			{
				Object.assign(obj, this.normalizeRelationshipLevels(current))
				return obj
			}, {})
		}

		return levels
	}

	/**
	 * Get a node or a create a new one based on the given properties
	 *
	 * @param {object} criteria Specific properties to match
	 * @param {object} properties Properties to be set on the existing or created node
	 * @param {QueryOptions} [o={}] Query options
	 * @returns {Node} Resulting Node
	 */
	static async merge(criteria, properties, o = {})
	{
		o = merge(merge({}, this.queryDefaults), o)

		o.singular = true

		let query = `MERGE (${ o.variable }:${ this.labels.join(':') }`
		const keys = Object.keys(criteria)

		if (keys.length)
		{
			const parameters = []

			for (const key of keys)
			{
				parameters.push(`${ key }: {criteria}.${ key }`)
			}

			query += ` {${ parameters.join(', ') }}`
		}

		query += ')\n'

		query += `ON CREATE SET ${ o.variable }.id={id}\n`

		if (o.onCreate)
		{
			query += `ON CREATE ${ o.onCreate }\n`
		}

		if (o.onMatch)
		{
			query += `ON MATCH ${ o.onMatch }\n`
		}

		o.set = [`${ o.variable } += {criteria}`]

		if (properties)
		{
			o.set.push(`${ o.variable } += {properties}`)
		}

		return await this.query(query, {
			criteria,
			properties,
			id: this.uuid()
		}, o)
	}

	/**
	 * Fetch related Nodes connected to the current node.
	 *
	 * @param {object|array|string} relationships Similar to 'with' option in #Node.find
	 * @returns {NodeCollection|Object.<string, NodeCollection>} The related nodes
	 */
	async fetchRelated(relationships)
	{
		const $static = this.constructor

		let o = merge({}, $static.queryDefaults)

		o = merge(o, $static.parseQueryFilters({ id: this.id }, o.variable))
		o = merge(o, $static.getRelationshipQueryOptions(relationships, [o.variable]))

		const query = $static.buildQuery(o)

		await this.$graph.run(query, o.parameters)

		this.clearCachedRelationships(relationships)

		const normalized = $static.normalizeRelationshipLevels(relationships)
		const keys = Object.keys(normalized)
		const results = {}

		for (const key of keys)
		{
			results[key] = this.getRelated(key)
		}

		if (typeof relationships === 'string')
		{
			return results[keys[0]]
		}

		return results
	}
}

Node.addIndex('id')

module.exports = Node
