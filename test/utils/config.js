'use strict'

// eslint-disable-next-line no-process-env
const NEO4J_TEST_PORT = process.env.NEO4J_TEST_PORT || '6482'

module.exports = {
	db: {
		server: `bolt://localhost:${ NEO4J_TEST_PORT }`,
		user: 'neo4j',
		pass: 'test'
	}
}
