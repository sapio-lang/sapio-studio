import React from 'react';
import Button from 'react-bootstrap/Button';
export default class Hex extends React.Component {
    constructor(props) {
        super(props);
    }
    copy() {

        this.code.select();

    }
    render() {
        return (<>
            <code className="truncate" ref={(r) => this.code =r}>{this.props.value} </code>
        </>)
    }
}
export function hash_to_hex(h) {
    const b = new Buffer(32);
    h.copy(b);
    b.reverse();
    return b.toString('hex');
};
export class ASM extends React.Component {
    constructor(props) {
        super(props);
    }
    copy() {

        this.code.select();

    }
    render() {
        return (<>
            <code className="ASM" ref={(r) => this.code =r}>{this.props.value} </code>
        </>)
    }
}