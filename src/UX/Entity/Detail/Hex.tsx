import React from 'react';
import { Tooltip } from '@material-ui/core';
import { useTheme } from '@material-ui/core';
function BaseHex(props: { value: string; styling: string }) {
    const [tip_message, set_tip] = React.useState(null as null | string);
    const code = React.useRef(null as null | HTMLElement);
    const theme = useTheme();
    const copy = () => {
        const select = window.getSelection();
        if (!select || !code.current) return;
        select.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(code.current);
        select.addRange(range);
        const txt = select.toString().trim();
        navigator.clipboard.writeText(txt);
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
            <code
                className={props.styling}
                ref={code}
                style={{ color: theme.palette.success.main }}
            >
                {props.value}{' '}
            </code>
        </Tooltip>
    );
}
export default function Hex(props: { value: string; className?: string }) {
    return BaseHex({ ...props, styling: 'truncate ' + props.className });
}

export function ASM(props: { value: string; className?: string }) {
    return BaseHex({ ...props, styling: 'ASM ' + props.className });
}
