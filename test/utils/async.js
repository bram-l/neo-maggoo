'use strict'

const env = global.jasmine.getEnv()

const methods = {
	afterEach: 0,
	beforeEach: 0,
	beforeAll: 0,
	afterAll: 0,
	it: 1,
	fit: 1
}

for (const [method, pos] of Object.entries(methods))
{
	const orig = env[method]

	env[method] = function()
	{
		const args = Array.from(arguments)
		const cb = args.splice(pos, 1, wrap)[0]

		function wrap(done)
		{
			return run(...arguments)
				.then(() =>
				{
					done()
				})
				.catch(e =>
				{
					done.fail(e)
				})
		}

		async function run()
		{
			return await cb(...arguments)
		}

		orig(...args)
	}
}
