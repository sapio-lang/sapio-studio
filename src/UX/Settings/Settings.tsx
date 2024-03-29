import {
    Tabs,
    Tab,
    Box,
    Button,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogActions,
    Typography,
} from '@mui/material';
import React from 'react';
import { MuiForm5 as Form } from '@rjsf/material-ui';
import { ISubmitEvent } from '@rjsf/core';
import { custom_fields, PathOnly } from '../CustomForms/Widgets';
import SaveIcon from '@mui/icons-material/Save';
import { Cancel } from '@mui/icons-material';
import { poll_settings } from '../../Settings/SettingsSlice';
import { useDispatch } from 'react-redux';
import './Settings.css';
import { schemas } from '../../common/settings_gen';

function SettingPane(props: {
    name: keyof typeof schemas;
    idx: number;
    value: number;
    children?: React.ReactNode;
}) {
    const dispatch = useDispatch();
    const handlesubmit = async (
        data: ISubmitEvent<any>,
        nativeEvent: React.FormEvent<HTMLFormElement>
    ) => {
        if (
            await window.electron.save_settings(
                props.name,
                JSON.stringify(data.formData)
            )
        )
            poll_settings(dispatch);
    };

    const [data, set_data] = React.useState(null);
    async function get_args() {
        const args = await window.electron.load_settings_sync(props.name);
        if (data !== args) {
            set_data(args);
        }
    }
    React.useEffect(() => {
        get_args();
    }, []);
    return (
        <div hidden={props.idx !== props.value} className="SettingPane">
            {props.idx === props.value && (
                <Form
                    className="SettingForm"
                    schema={schemas[props.name]}
                    onSubmit={handlesubmit}
                    fields={custom_fields}
                    uiSchema={{
                        sapio_cli: {
                            'ui:widget': PathOnly,
                        },
                        auth: {
                            CookieFile: {
                                'ui:widget': PathOnly,
                            },
                        },
                        Enabled: {
                            file: {
                                'ui:widget': PathOnly,
                            },
                        },
                    }}
                    formData={data}
                >
                    <Box sx={{ paddingTop: '20px' }}>
                        <Button
                            variant="contained"
                            color="success"
                            type="submit"
                            size="large"
                            endIcon={<SaveIcon />}
                        >
                            Save Settings
                        </Button>
                        <Button
                            sx={{ marginLeft: '20px' }}
                            variant="contained"
                            color="warning"
                            size="large"
                            endIcon={<Cancel />}
                            onClick={get_args}
                        >
                            Reset{' '}
                        </Button>
                    </Box>
                    <Box sx={{ paddingTop: '20px' }}>{props.children}</Box>
                </Form>
            )}
        </div>
    );
}
export const Settings = React.memo(SettingsInner);
export function SettingsInner() {
    const [idx, set_idx] = React.useState<number>(0);
    const [dialog_node, set_dialog_node] = React.useState<
        [string | null, string[]]
    >([null, []]);
    const handleChange = (_: any, idx: number) => {
        set_idx(idx);
    };

    const test_bitcoind = async () => {
        window.electron
            .bitcoin_command([{ method: 'getbestblockhash', parameters: [] }])
            .then((h) =>
                set_dialog_node(['Connection Seems OK:', [`Best Hash ${h[0]}`]])
            )
            .catch((e) => {
                console.log('GOT', JSON.stringify(e));
                const r = e.message;
                if (typeof e.message === 'string') {
                    const err = JSON.parse(r);
                    if (
                        err instanceof Object &&
                        'code' in err &&
                        'name' in err &&
                        'message' in err
                    ) {
                        set_dialog_node([
                            '¡Connection Not Working!',
                            [
                                `Name: ${err.name}`,
                                `Message: ${err.message}`,
                                `Error Code: ${err.code}`,
                            ],
                        ]);
                        return;
                    } else if (typeof err === 'string') {
                        set_dialog_node([
                            '¡Connection Not Working!',
                            [`${err}`],
                        ]);
                        return;
                    }
                }
                set_dialog_node(['¡Unknown Error!', [`${r.toString()}`]]);
            });
    };

    const test_sapio = async () => {
        window.electron.sapio
            .show_config()
            .then((conf) => {
                if ('ok' in conf)
                    set_dialog_node([
                        'Sapio-CLI is Working!\nUsing Configuration:',
                        [`${conf.ok}`],
                    ]);
                else
                    set_dialog_node(['¡Configuration Error!', [`${conf.err}`]]);
            })
            .catch((e) =>
                set_dialog_node(['¡Configuration Error!', [`${e.toString()}`]])
            );
    };
    const check_emulator = async () => {
        window.electron.emulator.read_log().then((log) => {
            if (log.length) {
                const json = JSON.parse(log);
                set_dialog_node([
                    'Emulator Status:',
                    [
                        `interface: ${json.interface}`,
                        `pk: ${json.pk}`,
                        `sync: ${json.sync}`,
                    ],
                ]);
            } else {
                set_dialog_node(['Emulator Status:', ['Not Running']]);
            }
        });
    };

    return (
        <div className="Settings">
            <Box className="SettingsNav">
                <Tabs
                    orientation="vertical"
                    value={idx}
                    onChange={handleChange}
                    aria-label="basic tabs example"
                >
                    <Tab label="Guide"></Tab>
                    <Tab label="Sapio CLI"></Tab>
                    <Tab label="Bitcoin"></Tab>
                    <Tab label="Emulator"></Tab>
                    <Tab label="Display"></Tab>
                </Tabs>
            </Box>
            <Box className="SettingsPanes">
                <Dialog
                    open={
                        Boolean(dialog_node[0]) ||
                        Boolean(dialog_node[1].length)
                    }
                    onClose={() => set_dialog_node([null, []])}
                    aria-labelledby="alert-dialog-title"
                    aria-describedby="alert-dialog-description"
                >
                    <DialogTitle id="alert-dialog-title">
                        {dialog_node[0]}
                    </DialogTitle>
                    <DialogContent>
                        <div id="alert-dialog-description">
                            {dialog_node[1].map((txt) => (
                                <DialogContentText key={txt}>
                                    {txt}
                                </DialogContentText>
                            ))}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => set_dialog_node([null, []])}>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
                <Guide idx={idx} my_idx={0} />
                <SettingPane name={'sapio_cli'} value={idx} idx={1}>
                    <Button
                        onClick={test_sapio}
                        variant="contained"
                        color="info"
                        size="large"
                    >
                        Test Sapio-Cli
                    </Button>
                </SettingPane>
                <SettingPane name={'bitcoin'} value={idx} idx={2}>
                    <Button
                        onClick={test_bitcoind}
                        variant="contained"
                        color="info"
                        size="large"
                    >
                        Test Connection
                    </Button>
                </SettingPane>
                <SettingPane name={'local_oracle'} value={idx} idx={3}>
                    <Button
                        variant="contained"
                        color="success"
                        size="large"
                        onClick={window.electron.emulator.start}
                    >
                        Start
                    </Button>
                    <Button
                        sx={{ marginLeft: '20px' }}
                        variant="contained"
                        color="error"
                        size="large"
                        onClick={window.electron.emulator.kill}
                    >
                        Kill
                    </Button>
                    <Button
                        sx={{ marginLeft: '20px' }}
                        variant="contained"
                        color="info"
                        size="large"
                        onClick={check_emulator}
                    >
                        Check Status
                    </Button>
                </SettingPane>
                <SettingPane name={'display'} value={idx} idx={4} />
            </Box>
        </div>
    );
}

function Guide(props: { idx: number; my_idx: number }) {
    const { my_idx, idx } = props;
    return (
        <div hidden={idx !== my_idx} className="SettingPane">
            {idx === my_idx && (
                <Box>
                    <Typography variant="h2">
                        Welcome to Sapio Studio
                    </Typography>
                    <Typography variant="h4">Getting Started</Typography>
                    <Typography variant="body1">
                        To get started, you need to configure a few things.
                        <br />
                        On this page, you will find tabs for:
                        <br />
                        <ol>
                            <li>Sapio Cli: options for the sapio compiler</li>
                            <li>
                                Bitcoin: options for which bitcoin node to
                                connect to
                            </li>
                            <li>
                                Emulator: options for running an emulator daemon
                            </li>
                            <li>
                                Display: options for Sapio Studio&lsquo;s
                                rendering
                            </li>
                        </ol>
                        At the bottom of each of these tabs you will see a set
                        of buttons that will allow you to save and test the
                        configuration you have currently saved.
                    </Typography>
                    <Typography variant="h3">
                        You must save settings before they will be used.
                    </Typography>
                    <Typography variant="body1">
                        Please ensure your Sapio Studio is properly configured
                        before continuing on to the application.
                    </Typography>
                </Box>
            )}
        </div>
    );
}
