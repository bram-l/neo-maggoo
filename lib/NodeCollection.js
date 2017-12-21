'use strict'

const { Collection } = require('maggoo')
const DB = require('./DB')
const neo4j = require('neo4j-driver/lib/v1')

class NodeCollection extends Collection
{
	constructor(Model, items)
	{
		if (items && !Array.isArray(items))
		{
			items = [items]
		}

		items = items && items.map((item) =>
		{
			if (item instanceof neo4j.types.Node)
			{
				return new Model(item)
			}

			return item
		})

		super(Model, items)
	}

	async save(deep)
	{
		const tx = DB.beginTransaction()
		const session = tx.session

		const run = this.wrap('save')

		await run(deep, tx)

		await tx.commit().then(r => r)

		session.close()
	}

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
