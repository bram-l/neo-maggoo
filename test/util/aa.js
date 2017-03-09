'use strict'

/**
 * Await an async function to finish.
 *
 * @param {Function} cb Callback function.
 * @returns Promise
 */
function aa(cb)
{
	return function(done)
	{
		return cb()
			.then(() => done())
			.catch((err) =>
			{
				done.fail(err.fields && err.fields.length ? err.fields[0].message : err)
			})
	}
}

module.exports = aa
