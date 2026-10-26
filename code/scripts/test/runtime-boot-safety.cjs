'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

function assertSafeBuildDirectory(root, directory, command) {
  assert.equal(command('git', ['ls-files', '--', directory], { cwd: root }), '', 'Clean build cannot delete tracked files');
  command('git', ['check-ignore', path.resolve(directory) + path.sep], { cwd: root });
}
module.exports = { assertSafeBuildDirectory };
