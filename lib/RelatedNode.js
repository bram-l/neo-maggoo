'use strict'

class RelatedNode {}

/**
 * Adds relationship data to a special $rel property of the end Node
 */
const proxy = new Proxy(RelatedNode, {
	construct(obj, [$Relationship, start, end, properties = {}, graph = null])
	{
		let rel = null

		if (graph)
		{
			rel = graph.getRelationship(start, end, $Relationship)
		}

		if (!rel)
		{
			rel = new $Relationship(properties, graph)
		}

		rel.start = start
		rel.end = end

		return new Proxy(end, {
			getPrototypeOf: () =>
			{
				return $Relationship.Model.prototype
			},
			has(target, name)
			{
				if (name === '$rel')
				{
					return true
				}

				return Reflect.has(...arguments)
			},
			get(target, name)
			{
				if (name === '$rel')
				{
					return rel
				}

				return target[name]
			}
		})
	}
})

module.exports = proxy
