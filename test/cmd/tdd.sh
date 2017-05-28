#!/bin/bash
find $(dirname $0)/../tdd -name '*-test.js' | xargs ./node_modules/.bin/mocha -R spec;
true
