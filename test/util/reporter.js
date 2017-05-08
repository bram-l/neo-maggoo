'use strict'

require('./async')
require('./dump-query-on-failure')

global.jasmine.getEnv().addReporter(require('jasmine-fail-fast').init())
