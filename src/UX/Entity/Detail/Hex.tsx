import React from 'react';
import { Tooltip, TextField } from '@material-ui/core';
import { useTheme } from '@material-ui/core';
function BaseHex(props: { value: string; styling: string; label?: string }) {
    const [tip_message, set_tip] = React.useState(null as null | string);
    const code = React.useRef<HTMLDivElement>(null);
    const theme = useTheme();
    const copy = () => {
        navigator.clipboard.writeText(props.value);
        set_tip('Copied!');
        setTimeout(() => {
            set_tip(null);
        }, 1000);
    };

    React.useEffect(() => {
        code.current?.addEventListener('dblclick', copy);
    });
    return (
        <Tooltip
            title={tip_message ?? 'double click to copy.'}
            arrow
            placement="top"
        >
            <div>
                <TextField
                    ref={code}
                    fullWidth
                    label={props.label}
                    defaultValue={props.value}
                    variant="outlined"
                    InputProps={{
                        readOnly: true,
                    }}
                />
            </div>
        </Tooltip>
    );
}
export default function Hex(props: {
    value: string;
    className?: string;
    label?: string;
}) {
    return BaseHex({ ...props, styling: 'truncate ' + props.className });
}

export function ASM(props: {
    value: string;
    className?: string;
    label?: string;
}) {
    return BaseHex({ ...props, styling: 'ASM ' + props.className });
}

export function ReadOnly(props: { value: React.ReactNode; label: string }) {
    return (
        <TextField
            fullWidth
            label={props.label}
            defaultValue={props.value}
            variant="outlined"
            InputProps={{
                readOnly: true,
            }}
        />
    );
}
