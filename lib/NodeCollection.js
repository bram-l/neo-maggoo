'use strict'

const { Collection } = require('maggoo')
const DB = require('./DB')

class NodeCollection extends Collection {

	constructor(Model, items)
	{
		if (items && items instanceof Model)
		{
			items = [items]
		}

		super(Model, items)
	}

	async save(deep)
	{
		const tx = DB.beginTransaction()
		const session = tx.session

		const run = this.wrap('save')

		await run(deep, tx)

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}

	async delete(deep)
	{
		const tx = DB.beginTransaction()
		const session = tx.session

		const run = this.wrap('delete')

		await run(deep, tx)

		if (session)
		{
			await tx.commit().then(r => r)

			session.close()
		}
	}

}

module.exports = NodeCollection
