'use strict'

const CONSTRAINT_INDEX = Symbol('index')
const CONSTRAINT_UNIQUE = Symbol('unique')
const REGEX_INDEX = /:(.+)\((.+)\)/
const REGEX_UNIQUE = /:([^\s)]+)[\s)]*ASSERT[^.]+\.([^\s]+)\sIS UNIQUE/i

const state = {
	initialized: false,
	driver: null,
	server: null,
	constraints: {},
	lastQuery: null
}

function init(host, user, pass, config)
{
	if (state.driver)
	{
		state.driver.close()
	}

	const neo4j = require('neo4j-driver/lib/v1')

	state.driver = neo4j.driver(host, neo4j.auth.basic(user, pass), config || {})

	state.driver.onCompleted = (meta) =>
	{
		if (meta)
		{
			state.server = meta
		}
	}

	state.initialized = true
}

function getSession(mode)
{
	if (!state.initialized)
	{
		throw new Error('Database not initialized')
	}

	return state.driver.session(mode)
}

function beginTransaction(session = null)
{
	session = session || getSession()

	const transaction = session.beginTransaction()

	transaction.session = session
	transaction.$nodes = []

	const run = transaction.run

	transaction.run = async function(query, parameters)
	{
		await _ensureRestrictions()

		let error = null
		let result = null

		try
		{
			result = await run.apply(transaction, arguments).then(r => r)
		}
		catch (e)
		{
			error = e
		}

		state.lastQuery = { query, parameters, error }

		if (error)
		{
			const e = new Error(error.message || error)

			e.code = error.code

			throw e
		}

		return result
	}

	return transaction
}

/**
 * Run a query against the DB
 *
 * @param {String} query The Cypher query string
 * @param {Object} parameters The parameters used in the query
 * @param {neo4j.Session} [session=null] An active DB session
 *
 * @returns {neo4j.Result} The result
 */
async function runQuery(query, parameters, session = null)
{
	await _ensureRestrictions()

	session = session || getSession()

	let error = null
	let result = null

	try
	{
		result = await session.run(query, parameters)
	}
	catch (e)
	{
		error = e
	}

	state.lastQuery = { query, parameters, error }

	session.close()

	if (error)
	{
		const e = new Error(error.message || error)

		e.code = error.code

		throw e
	}

	return result
}

async function getScalar(query, parameters, session = null)
{
	const result = await runQuery(query, parameters, session)

	return result.records[0].get(0)
}

function addIndex(label, property, now = true)
{
	_addRestriction(CONSTRAINT_INDEX, label, property)

	if (now)
	{
		return _ensureRestrictions(CONSTRAINT_INDEX)
	}

	return null
}

function addUnique(label, property, now = true)
{
	_addRestriction(CONSTRAINT_UNIQUE, label, property)

	if (now)
	{
		return _ensureRestrictions(CONSTRAINT_UNIQUE)
	}

	return null
}

async function dropIndex(label, property)
{
	const session = getSession()

	await session.run(`DROP INDEX ON :\`${ label }\`(\`${ property }\`)`)

	session.close()

	_removeRestriction(CONSTRAINT_INDEX, label, property)
}

async function dropUnique(label, property)
{
	const session = getSession()

	await session.run(`DROP CONSTRAINT ON (n:\`${ label }\`) ASSERT n.\`${ property }\` IS UNIQUE`)

	session.close()

	_removeRestriction(CONSTRAINT_UNIQUE, label, property)
}

function _addRestriction(key, label, property)
{
	state.constraints[key] = state.constraints[key] || {}

	const name = _getRestrictionName(label, property)

	if (!state.constraints[key][name])
	{
		state.constraints[key][name] = {
			label,
			property,
			added: false
		}
	}
}

function _removeRestriction(key, label, property)
{
	const name = _getRestrictionName(label, property)

	if (name in state.constraints[key])
	{
		delete state.constraints[key]
	}
}

function _getRestrictionName(label, property)
{
	return  `${ label }:${ property }`
}

async function _ensureRestrictions(types = null)
{
	const queries = []
	const adding = []
	let indexes = null

	if (types === null)
	{
		types = [CONSTRAINT_INDEX, CONSTRAINT_UNIQUE]
	}

	if (!Array.isArray(types))
	{
		types = [types]
	}

	for (const key of types)
	{
		if (!state.constraints[key])
		{
			continue
		}

		for (const item of Object.values(state.constraints[key]))
		{
			const { added, label, property } = item

			if (added)
			{
				continue
			}

			if (key === CONSTRAINT_INDEX)
			{
				if (!indexes)
				{
					indexes = await getIndexes()
				}

				if (label in indexes && indexes[label].includes(property))
				{
					continue
				}

				queries.push(`
					CREATE INDEX ON :\`${ label }\`(\`${ property }\`)
				`)

				adding.push(item)
			}
			else if (key === CONSTRAINT_UNIQUE)
			{
				queries.push(`
					CREATE CONSTRAINT ON (n:\`${ label }\`)
					ASSERT n.\`${ property }\` IS UNIQUE
				`)

				adding.push(item)
			}
		}
	}

	if (!queries.length)
	{
		return null
	}

	const session = getSession()

	const result = await session.run(queries.join('\n'))

	session.close()

	for (const item of adding)
	{
		item.added = true
	}

	return result
}

async function getIndexes()
{
	const session = getSession()

	const result = await session.run('CALL db.indexes()')

	session.close()

	const indexes = {}

	for (const record of result.records)
	{
		const description = record.get('description')
		const [, label, name] = description.match(REGEX_INDEX)

		indexes[label] = indexes[label] || []
		indexes[label].push(name)
	}

	return indexes
}

async function getUnique()
{
	const session = getSession()

	const result = await session.run('CALL db.constraints()')

	session.close()

	const constraints = {}

	for (const record of result.records)
	{
		const description = record.get('description')
		const [, label, name] = description.match(REGEX_UNIQUE)

		constraints[label] = constraints[label] || []
		constraints[label].push(name)
	}

	return constraints
}

function exit()
{
	if (state.driver)
	{
		state.driver.close()
	}

	state.driver = null
	state.server = null
	state.initialized = false
}

module.exports = {
	init,
	state,
	session: getSession,
	beginTransaction,
	query: runQuery,
	getScalar,
	addIndex,
	addUnique,
	dropIndex,
	dropUnique,
	getIndexes,
	getUnique,
	exit
}
