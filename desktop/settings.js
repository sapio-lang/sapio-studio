const electron = require('electron');
const app = electron.app;
const path = require('path');
const os = require('os');
const ElectronPreferences = require('electron-preferences');
const { Menu } = require('electron');

module.exports = {
    settings:
        new ElectronPreferences({
            /**
             * Where should preferences be saved?
             */
            'dataStore': path.resolve(app.getPath('userData'), 'preferences.json'),
            /**
             * Default values.
             */
            'defaults': {
                'sapio': {
                    'binary': path.resolve(os.homedir(), 'sapio/target/debug/sapio-cli')
                },

            },
            /**
             * The preferences window is divided into sections. Each section has a label, an icon, and one or
             * more fields associated with it. Each section should also be given a unique ID.
             */
            'sections': [
                {
                    id: 'sapio',
                    label: 'Sapio Settings',
                    icon: 'settings-gear-63',
                    form: {
                        groups: [
                            {
                                label: 'sapio-cli',
                                fields: [
                                    {
                                        label: 'sapio-cli binary',
                                        key: 'binary',
                                        type: 'file',
                                        help: 'the sapio-cli binary to use',
                                        dontAddToRecent: true
                                    },
                                    {
                                        label: 'Override Configuration File?',
                                        key: 'configfile',
                                        type: 'file',
                                        help: 'if specified, to use the default file or not',
                                        dontAddToRecent: true
                                    }
                                ]


                            }
                        ]
                    }
                },
            ],
            /**
             * These parameters on the preference window settings can be overwrinten
             */
            browserWindowOpts: {
                'title': 'My custom preferences title',
                'width': 900,
                'maxWidth': 1000,
                'height': 700,
                'maxHeight': 1000,
                'resizable': true,
                'maximizable': false,
                //...
            },
            /**
             * These parameters create an optional menu bar
             */
            menu: Menu.buildFromTemplate(
                [
                    {
                        label: 'Window',
                        role: 'window',
                        submenu: [
                            {
                                label: 'Close',
                                accelerator: 'CmdOrCtrl+W',
                                role: 'close'
                            }
                        ]
                    }
                ]
            ),
            /**
            * If you want to apply your own CSS. The path should be relative to your appPath.
            */
            css: 'custom-style.css'
        })
};