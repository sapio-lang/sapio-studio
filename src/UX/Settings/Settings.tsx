import { schemas } from './Schemas';
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
import { Cancel, HorizontalRule } from '@mui/icons-material';
import RpcError from 'bitcoin-core-ts/dist/src/errors/rpc-error';

function SettingPane(props: {
    name: keyof typeof schemas;
    idx: number;
    value: number;
    children?: React.ReactNode;
}) {
    const handlesubmit = async (
        data: ISubmitEvent<any>,
        nativeEvent: React.FormEvent<HTMLFormElement>
    ) => {
        window.electron.save_settings(
            props.name,
            JSON.stringify(data.formData)
        );
    };

    const [data, set_data] = React.useState(null);
    async function get_args() {
        let args = await window.electron.load_settings_sync(props.name);
        if (data !== args) {
            set_data(args);
        }
    }
    React.useEffect(() => {
        get_args();
    }, []);
    return (
        <div hidden={props.idx !== props.value}>
            {props.idx === props.value && (
                <Box>
                    {props.children}
                    <Form
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
                        <div>
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
                                variant="contained"
                                color="warning"
                                size="large"
                                endIcon={<Cancel />}
                                onClick={get_args}
                            >
                                Reset{' '}
                            </Button>
                        </div>
                    </Form>
                </Box>
            )}
        </div>
    );
}
export function Settings() {
    const [idx, set_idx] = React.useState<number>(0);
    const [dialog_node, set_dialog_node] = React.useState<
        [React.ReactNode, React.ReactNode[]]
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
                let r = e.message;
                if (typeof e.message === 'string') {
                    let err = JSON.parse(r);
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
                let json = JSON.parse(log);
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
        <div style={{ height: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
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
            <Box sx={{ overflowY: 'scroll', height: '100%' }}>
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
                                <DialogContentText>{txt}</DialogContentText>
                            ))}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => set_dialog_node([null, []])}>
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
                <div style={{ marginBottom: '200px' }}>
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
                            variant="contained"
                            color="warning"
                            size="large"
                            onClick={window.electron.emulator.kill}
                        >
                            Kill
                        </Button>
                        <Button
                            variant="contained"
                            color="info"
                            size="large"
                            onClick={check_emulator}
                        >
                            Check Status
                        </Button>
                    </SettingPane>
                    <SettingPane name={'display'} value={idx} idx={4} />
                </div>
            </Box>
        </div>
    );
}

function Guide(props: { idx: number; my_idx: number }) {
    const { my_idx, idx } = props;
    return (
        <div hidden={idx !== my_idx}>
            {idx === my_idx && (
                <Box>
                    <Typography variant="h2">
                        Welcome to Sapio Studio
                    </Typography>
                    <Typography variant="h4">Getting Started</Typography>
                    <Typography variant="body1">
                        To get started, you're going to want to configure a few
                        things.
                        <br />
                        On this page, you'll find tabs for:
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
                                Display: options for Sapio Studio's rendering
                            </li>
                        </ol>
                        At the top of each of these tabs you may see a set of
                        buttons that will allow you to test the configuration
                        you have currently saved.
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
