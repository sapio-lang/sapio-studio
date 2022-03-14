import { schemas } from './Schemas';
import { Tabs, Tab, Box } from '@mui/material';
import React from 'react';
import { MuiForm5 as Form } from '@rjsf/material-ui';

function SettingPane(props: {
    name: keyof typeof schemas;
    idx: number;
    value: number;
}) {
    return (
        <div hidden={props.idx !== props.value}>
            {props.idx === props.value && (
                <Box>
                    <Form schema={schemas[props.name]}></Form>
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
                    <SettingPane name={'sapio_cli'} value={idx} idx={0} />
                    <SettingPane name={'bitcoin'} value={idx} idx={1} />
                    <SettingPane name={'local_oracle'} value={idx} idx={2} />
                    <SettingPane name={'display'} value={idx} idx={3} />
                </div>
            </Box>
        </div>
    );
}
