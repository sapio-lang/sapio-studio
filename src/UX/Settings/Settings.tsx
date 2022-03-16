import { schemas } from './Schemas';
import { Tabs, Tab, Box, Button } from '@mui/material';
import React from 'react';
import { MuiForm5 as Form } from '@rjsf/material-ui';
import { ISubmitEvent } from '@rjsf/core';
import { custom_fields, PathOnly } from '../CustomForms/Widgets';
import SaveIcon from '@mui/icons-material/Save';
import { Cancel } from '@mui/icons-material';
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
    const handleChange = (_: any, idx: number) => {
        set_idx(idx);
    };

    const test_bitcoind = async () => {
        window.electron.bitcoin_command([{ method: "getbestblockhash", parameters: [] }])
            .then((h) =>
                alert(`Connection Seems OK:\n\nBest Hash ${h[0]}`)
            ).catch((e) => {
                console.log("GOT", JSON.stringify(e));
                let r = e.message;
                if (typeof e.message === "string") {
                    let err = JSON.parse(r);
                    if (err instanceof Object && "code" in err && "name" in err && "message" in err) {
                        alert(` ¡Connection Not Working!

                                Name: ${err.name}
                                Message: ${err.message}
                                Error Code: ${err.code}
                                `)
                        return;
                    } else if (typeof err === "string") {
                        alert(` ¡Connection Not Working!

                                ${err}
                                `)
                        return;

                    }
                }
                alert(r);

            });
    };

    const test_sapio = async () => {
        window.electron.sapio.show_config()
            .then((conf) => {
                if ("ok" in conf) alert(`Current Configuration:\n\n${conf.ok} `);
                else
                    alert(`¡Configuration Error!\n\n  ${conf.err}`);
            }
            ).catch((e) =>
                alert(`¡Configuration Error! \n\n ${e.toString()}`)
            )
    };
    return (
        <div style={{ height: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                    value={idx}
                    onChange={handleChange}
                    aria-label="basic tabs example"
                >
                    <Tab label="Sapio CLI"></Tab>
                    <Tab label="Bitcoin"></Tab>
                    <Tab label="Emulator"></Tab>
                    <Tab label="Display"></Tab>
                </Tabs>
            </Box>
            <Box sx={{ overflowY: 'scroll', height: '100%' }}>
                <div style={{ marginBottom: '200px' }}>
                    <SettingPane name={'sapio_cli'} value={idx} idx={0}>
                        <Button onClick={test_sapio}>
                            Test Sapio-Cli
                        </Button>
                    </SettingPane>
                    <SettingPane name={'bitcoin'} value={idx} idx={1} >
                        <Button onClick={test_bitcoind}>
                            Test Connection
                        </Button>
                    </SettingPane>
                    <SettingPane name={'local_oracle'} value={idx} idx={2} />
                    <SettingPane name={'display'} value={idx} idx={3} />
                </div>
            </Box >
        </div >
    );
}
