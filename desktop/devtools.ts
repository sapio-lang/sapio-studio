import installExtension, {
    REDUX_DEVTOOLS,
    REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';
// Or if you can not use ES6 imports
/**
const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
*/
import { app } from 'electron';

export const register_devtools = () =>
    app.on('ready', () => {
        installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS])
            .then((name) => console.log(`Added Extension:  ${name}`))
            .catch((err) => console.log('An error occurred: ', err));
    });
