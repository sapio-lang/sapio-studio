import {
    DefaultLinkModel,
    DefaultLinkModelOptions,
} from '@projectstorm/react-diagrams';
export class SpendLinkModel extends DefaultLinkModel {
    is_reachable: boolean;
    reachable_callback: (_: boolean) => void;
    constructor(options?: DefaultLinkModelOptions) {
        super({
            type: 'spend',
            width: 15,
            color: 'white',
            ...options,
        });
        this.is_reachable = true;
        this.reachable_callback = (b) => null;
    }
    setReachable(b: boolean) {
        this.is_reachable = b;
        this.reachable_callback(b);
    }
    isReachable(): boolean {
        return this.is_reachable;
    }
    registerReachableCallback(c: (_: boolean) => void) {
        this.reachable_callback = c;
    }
}
