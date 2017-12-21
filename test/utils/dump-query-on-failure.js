'use strict'

const env = global.jasmine.getEnv()
const DB = require('../../lib/DB')

const COLOR_CLEAR = '\x1b[0m'
const COLOR_RED = '\x1b[31m'

env.addReporter({
	specDone(result)
	{
		if (result.status === 'failed' && DB.state.lastQuery)
		{
			const last = Object.assign({}, DB.state.lastQuery)

			console.log('')
			console.log('------------------------------------------------------------------------------------------------')

			console.log(COLOR_CLEAR)
			console.log('> LAST QUERY:')
			console.log(last.query)

			console.log('> PARAMETERS:')
			console.log(last.parameters)

			if (last.error)
			{
				const message = last.error && last.error.message ? last.error.message : last.error

				console.log('')
				console.log('> ERROR:', COLOR_RED)
				console.log(message)
				console.log(COLOR_CLEAR)

				if (last.error.code)
				{
					console.log('CODE:', last.error.code)
				}
			}

			console.log('')
			console.log('------------------------------------------------------------------------------------------------')
			console.log('')
		}

		DB.state.lastQuery = null
	}
})
