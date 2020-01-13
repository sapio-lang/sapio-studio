import React from 'react';
export default class Hex extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (<code className="txhex truncate" onClick={this.props.onClick}>{this.props.value} </code>)
    }
}
export function hash_to_hex(h) {
    const b = new Buffer(32);
    h.copy(b);
    b.reverse();
    return b.toString('hex');
};
