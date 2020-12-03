import React from 'react';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
class BaseHex extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    copy() {
        const select = window.getSelection();
        select.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(this.code);
        select.addRange(range);
        const txt = select.toString().trim();
        navigator.clipboard.writeText(txt);
        this.setState({ tip: 'copied!' });
        setTimeout(() => {
            this.setState({ tip: undefined });
        }, 1000);
    }
    render() {
        return (
            <OverlayTrigger
                placement="top"
                overlay={
                    <Tooltip>
                        {this.state.tip || 'double click to copy.'}
                    </Tooltip>
                }
            >
                <code className={this.styling} ref={(r) => (this.code = r)}>
                    {this.props.value}{' '}
                </code>
            </OverlayTrigger>
        );
    }
    componentDidMount() {
        this.code.addEventListener('dblclick', this.copy.bind(this));
    }
}

export default class Hex extends BaseHex {
    constructor(props) {
        super(props);
        this.styling = 'truncate';
    }
}

export class ASM extends BaseHex {
    constructor(props) {
        super(props);
        this.styling = 'ASM';
    }
}
export function hash_to_hex(h) {
    const b = new Buffer(32);
    h.copy(b);
    b.reverse();
    return b.toString('hex');
}
