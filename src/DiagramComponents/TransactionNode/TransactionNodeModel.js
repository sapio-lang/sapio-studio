import { NodeModel } from '@projectstorm/react-diagrams';
import { PortModelAlignment } from '@projectstorm/react-diagrams-core';
import { OutputPortModel } from '../OutputLink';
import { SpendPortModel } from '../SpendLink/SpendLink';

/**
 * Example of a custom model using pure javascript
 */
export class TransactionNodeModel extends NodeModel {
    constructor(name, purpose, color, options={}) {
        super({
            name,
            color,
            type: 'transaction-node',
            ...options
        });
        this.color = color || 'red';
        this.purpose = purpose;
        this.portsOut = [];
        this.portsIn = [];
        this.name= name;
        this.confirmed=false;
        this.is_reachable = true;

    }
    setConfirmed(opt) {
        this.confirmed =opt;
        this.setSelected(true);
    }
    isConfirmed() {
        return this.confirmed;
    }
    setReachable(b){
        this.is_reachable = b;
        this.reachable_cb(b);
    }
    registerReachable(f) {
        this.reachable_cb = f;
    }
    isReachable(){
        return this.is_reachable;
    }

    doClone(lookupTable, clone) {
        clone.portsIn = [];
        clone.portsOut = [];
        super.doClone(lookupTable, clone);
    }

    removePort(port) {
        super.removePort(port);
        if (port.getOptions().in) {
            this.portsIn.splice(this.portsIn.indexOf(port));
        } else {
            this.portsOut.splice(this.portsOut.indexOf(port));
        }
    }


    addPort(port) {
        super.addPort(port);
        if (port.getOptions().in) {
            if (this.portsIn.indexOf(port) === -1) {
                this.portsIn.push(port);
            }
        } else {
            if (this.portsOut.indexOf(port) === -1) {
                this.portsOut.push(port);
            }
        }
        return port;
    }
    addInPort(label, after) {
        after = after || true;
        const p = new SpendPortModel({
            in: true,
            name: label,
            label: label,
            alignment: PortModelAlignment.TOP
        });
        if (!after) {
            this.portsIn.splice(0, 0, p);
        }
        return this.addPort(p);
    }

    addOutPort(label, after){
        after = after || true;
        const p = new OutputPortModel({
            in: false,
            name: label,
            label: label,
            alignment: PortModelAlignment.BOTTOM
        });
        if (!after) {
            this.portsOut.splice(0, 0, p);
        }
        return this.addPort(p);
    }

    serialize() {
        return {
            ...super.serialize(),
            color: this.options.color
        };
    }

    deserialize(ob, engine) {
        super.deserialize(ob, engine);
        this.color = ob.color;
    }
    getInPorts() {
        return this.portsIn;
    }
    getOutPorts() {
        return this.portsOut;
    }
}
