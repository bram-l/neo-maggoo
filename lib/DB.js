'use strict'

const neo4j = require('neo4j-driver/lib/v1')

const DB = {
	init(host, user, pass, config)
	{
		if (this.driver)
		{
			this.driver.close()
		}

		this.server = null
		this.driver = neo4j.driver(host, neo4j.auth.basic(user, pass), config || {})

		this.driver.onCompleted = meta =>
		{
			this.server = meta.server
		}
	},

	session()
	{
		const session = this.driver.session()

		return session

		// Always return promises (disables streaming functionality)
		// return promisify(session)
	},

	beginTransaction(session = null)
	{
		session = session || this.session()

		const transaction = session.beginTransaction()

		transaction.session = session
		transaction.$nodes = []

		return transaction
		// return promisify(transaction)
	},

	query(query, parameters)
	{
		const session = this.driver.session()

		return session.run(query, parameters)
			.then(result =>
			{
				session.close()
				return result
			})
	},

	exit()
	{
		this.driver.close()

		// delete this.session
		delete this.driver
		delete this.server
	}
}

module.exports = DB
