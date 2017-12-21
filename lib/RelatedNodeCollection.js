'use strict'

const NodeCollection = require('./NodeCollection')
const RelatedNode = require('./RelatedNode')

class RelatedNodeCollection extends NodeCollection
{
	constructor(Relationship, items, start)
	{
		super(Relationship.Model, items)

		this.$Relationship = Relationship
		this.$start = start
	}

	createRelatedNode(node)
	{
		return new RelatedNode(this.$Relationship, this.$start, node, {}, this.$start.$graph)
	}
}

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

module.exports = new Proxy(RelatedNodeCollection, proxify)
