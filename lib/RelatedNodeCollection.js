'use strict'

const NodeCollection = require('./NodeCollection')
const RelatedNode = require('./RelatedNode')

/**
 * A Node Collection related to a specified start Node
 */
class RelatedNodeCollection extends NodeCollection
{
	/**
	 * Creates an instance of RelatedNodeCollection.
	 *
	 * @param {Relationship} Relationship The Relationship class
	 * @param {Array} items The related Nodes
	 * @param {Node} start The start Node
	 */
	constructor(Relationship, items, start)
	{
		super(Relationship.Model, items)

		this.$Relationship = Relationship
		this.$start = start
	}

	/**
	 * Creates a new RelatedNode instance
	 *
	 * @param {Node} node The end Node
	 * @returns {RelatedNode} RelatedNode instance
	 */
	createRelatedNode(node)
	{
		return new RelatedNode(this.$Relationship, this.$start, node, {}, this.$start.$graph)
	}
}

/**
 * Make sure all related Nodes will be wrapped in the RelatedNode class
 */
const proxify = {

	construct()
	{
		const instance = Reflect.construct(...arguments)

		const proxied = new Proxy(instance, {

			get(target, key)
			{
				let value = Reflect.get(...arguments)

				// Wrap all nodes in a Related object
				if (value instanceof target.$Model && !('$rel' in value))
				{
					value = target[key] = target.createRelatedNode(value)
				}

				return value
			}

		})

		return proxied
	}

}

/**
 * All RelatedNodeCollection instances should be proxified
 */
module.exports = new Proxy(RelatedNodeCollection, proxify)
