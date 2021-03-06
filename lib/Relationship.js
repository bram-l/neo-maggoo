'use strict'

const neo4j = require('neo4j-driver/lib/v1')
const DB = require('./DB')
const { Model } = require('maggoo')

const _model = Symbol()
const _type = Symbol()
const _singular = Symbol()
const _start = Symbol()
const _end = Symbol()
const _direction = Symbol()

/**
 * Class representing a relationship between two Nodes
 */
class Relationship extends Model
{
	// *** CONSTANTS

	/**
	 * @constant
	 * @member {string}
	 */
	static get OUT()
	{
		return 'relationship.direction.out'
	}

	/**
	 * @constant
	 * @member {string}
	 */
	static get IN()
	{
		return 'relationship.direction.in'
	}

	/**
	 * @constant
	 * @type {string}
	 */
	static get BOTH()
	{
		return 'relationship.direction.both'
	}

	/**
	 * @constant
	 * @type {string}
	 */
	static get ANY()
	{
		return 'relationship.direction.any'
	}

	/**
	 * @constant
	 * @type {string}
	 */
	static get DEFAULT_TYPE()
	{
		return 'is_related_to'
	}


	// *** PUBLIC METHODS

	/**
	 * Creates an instance of Relationship
	 *
	 * @param {object|neo4j.types.Relationship} relation Relationship data object or neo4j Relationship
	 * @param {Graph} graph Current graph
	 */
	constructor(relation, graph)
	{
		if (relation instanceof neo4j.types.Relationship)
		{
			super(relation.properties)

			this.$entity = relation
		}
		else
		{
			super(relation)
		}

		this.$graph = graph
	}

	get $direction()
	{
		return this.constructor.direction
	}

	get $type()
	{
		return this.constructor.type
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
	 * @readonly
	 * @type {boolean}
	 */
	get $new()
	{
		return !this.$entity
	}

	/**
	 * Whether or not the Node has changed properties.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	get $dirty()
	{
		return this.$new || super.$dirty
	}

	get start()
	{
		return this[_start]
	}

	set start(start)
	{
		/**
		 * @private
		*/
		this[_start] = start
	}

	get end()
	{
		return this[_end]
	}

	set end(end)
	{
		/**
		 * @private
		*/
		this[_end] = end
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
	 * Save the relationship
	 *
	 * @param {any} [tx] Transaction
	 */
	async save(tx = null)
	{
		let session = null

		if (!tx)
		{
			tx = DB.beginTransaction()
			session = tx.session
		}

		const left = [Relationship.IN].includes(this.$direction) ? '<' : ''
		const right = [Relationship.OUT, Relationship.ANY, Relationship.BOTH].includes(this.$direction) ? '>' : ''

		let create = `MERGE (start)${ left }-[r:${ this.$type }]-${ right }(end)`
		let set = 'SET r += {properties}'

		if (this.$direction === Relationship.BOTH)
		{
			create += `
			MERGE (end)-[r_2:${ this.$type }]->(start)`

			set += `
			SET r_2 += {properties}`
		}

		const query = `
			MATCH (start:${ this.start.$base } { id: {start} }), (end:${ this.end.$base } { id: {end} })
			${ create }
			${ set }
			RETURN r
		`

		const parameters = {
			start: this.start.id,
			end: this.end.id,
			properties: this.$data
		}

		// console.log('save relationship', query, parameters)
		// console.time('save relationship')

		const result = await tx.run(query, parameters).then(r => r)

		this.$entity = result.records[0].get('r')
		this.reset()

		// console.timeEnd('save relationship')

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}

	// *** STATIC METHODS

	/**
	 * The type of the relationship, will be used as the name of the relationship created in the graph
	 *
	 * @static
	 * @member {string}
	 */
	static get type()
	{
		return this[_type] || this.DEFAULT_TYPE
	}

	static set type(value)
	{
		/**
		 * @private
		 */
		this[_type] = value
	}

	/**
	 * If true a relationship will always have only a single related Node
	 *
	 * @static
	 * @member {boolean}
	 */
	static get singular()
	{
		return this[_singular] === true
	}

	static set singular(value)
	{
		/**
		 * @private
		 */
		this[_singular] = !!value
	}

	/**
	 * The direction of the relationship, can be {@link Relationship.IN} or {@link Relationship.OUT}
	 *
	 * @static
	 * @member {string}
	 */
	static get direction()
	{
		return this[_direction] || this.OUT
	}

	static set direction(value)
	{
		/**
		 * @private
		*/
		this[_direction] = value
	}

	/**
	 * The related Node class or a function that returns a Node class
	 *
	 * @static
	 * @member {Node|function}
	 */
	static get Model()
	{
		if (typeof this[_model] === 'function' && !(this[_model].prototype instanceof Model))
		{
			return this[_model]()
		}

		return this[_model] || require('./Node')
	}

	static set Model(Class)
	{
		/**
		 * @private
		*/
		this[_model] = Class
	}

	/**
	 * Alias for Model
	 *
	 * @static
	 * @member {Node|function}
	 */
	static get model()
	{
		return this.Model
	}

	static set model(Class)
	{
		this.Model = Class
	}
}

module.exports = Relationship
