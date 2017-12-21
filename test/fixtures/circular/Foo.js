'use strict'

const Node = require('../../../lib/Node')

class Foo extends Node
{
	static get relationships()
	{
		return {
			bar: {
				Model: () => require('./Bar'),
				singular: true
			}
		}
	}
}

module.exports = Foo
