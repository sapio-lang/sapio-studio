const { app } = require('electron');
const path = require('node:path');

// Isolate the desktop's normal settings and module cache from the developer's.
if (!process.env.STUDIO_TEST_USER_DATA)
    throw new Error('Missing isolated test directory.');
app.setPath('userData', process.env.STUDIO_TEST_USER_DATA);
require(path.resolve(__dirname, '../../dist/desktop/main.cjs'));
