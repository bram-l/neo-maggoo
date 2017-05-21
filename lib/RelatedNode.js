'use strict'

class RelatedNode {}

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

		end.$rel = rel

		return end
	}
})

module.exports = proxy
