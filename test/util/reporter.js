'use strict'

const SpecReporter = require('jasmine-spec-reporter').SpecReporter

jasmine.getEnv().clearReporters()
jasmine.getEnv().addReporter(new SpecReporter({
	spec: {
		displayPending: true
	}
}))

require('./async')
require('./dump-query-on-failure')

global.jasmine.getEnv().addReporter(require('jasmine-fail-fast').init())
