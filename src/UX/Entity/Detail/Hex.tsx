import React from 'react';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
function BaseHex(props: { value: string; styling: string }) {
    const [tip_message, set_tip] = React.useState(null as null | string);
    const code = React.useRef(null as null | HTMLElement);
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
        <OverlayTrigger
            placement="top"
            overlay={
                <Tooltip id={'hex-copyable-' + Math.random().toString()}>
                    {tip_message ?? 'double click to copy.'}
                </Tooltip>
            }
        >
            <code className={props.styling} ref={code}>
                {props.value}{' '}
            </code>
        </OverlayTrigger>
    );
}
export default function Hex(props: { value: string; className?: string }) {
    return BaseHex({ ...props, styling: 'truncate ' + props.className });
}

export function ASM(props: { value: string; className?: string }) {
    return BaseHex({ ...props, styling: 'ASM ' + props.className });
}
