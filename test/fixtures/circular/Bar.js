'use strict'

const Node = require('../../../lib/Node')

class Bar extends Node
{
	static get relationships()
	{
		return {
			foo: {
				Model: () => require('./Foo'),
				singular: true
			}
		}
	}
}

module.exports = Bar
