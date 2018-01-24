'use strict'

const { Collection } = require('maggoo')
const DB = require('./DB')
const neo4j = require('neo4j-driver/lib/v1')

/**
 * A Node collection that allows saving & deleting an array of nodes
 */
class NodeCollection extends Collection
{
	constructor(Node, items)
	{
		if (items && !Array.isArray(items))
		{
			items = [items]
		}

		items = items && items.map((item) =>
		{
			if (item instanceof neo4j.types.Node)
			{
				return new Node(item)
			}

			return item
		})

		super(Node, items)
	}

	/**
	 * Save all Nodes in this collection
	 *
	 * @param {boolean|Array} [deep] If true save all related node, or an array of specific relationships
	 */
	async save(deep = false)
	{
		const tx = DB.beginTransaction()
		const session = tx.session

		const run = this.wrap('save')

		await run(deep, tx)

		await tx.commit().then(r => r)

		session.close()
	}

	/**
	 * Deletes all Nodes in this collection
	 *
	 * @param {boolean|Array} [deep] If true delete all related nodes, or an array of specific relationships
	 */
	async delete(deep)
	{
		const tx = DB.beginTransaction()
		const session = tx.session

		const run = this.wrap('delete')

		await run(deep, tx)

		await tx.commit().then(r => r)

		session.close()
	}
}

module.exports = NodeCollection
