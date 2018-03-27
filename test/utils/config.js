/* eslint-disable no-process-env */
'use strict'

const NEO4J_TEST_PORT = process.env.NEO4J_TEST_PORT || '6498'
const NEO4J_TEST_USER = process.env.NEO4J_TEST_USER || 'neo4j'
const NEO4J_TEST_PASS = process.env.NEO4J_TEST_PASS || 'test'

module.exports = {
	db: {
		server: `bolt://localhost:${ NEO4J_TEST_PORT }`,
		user: NEO4J_TEST_USER,
		pass: NEO4J_TEST_PASS
	}
}
