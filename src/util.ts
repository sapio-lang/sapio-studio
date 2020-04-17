
interface Key {
    index: number,
    hash: Buffer
}
export type OpaqueKey = string;
export function keyFn(key: Key): OpaqueKey {
    return key.hash.toString('hex')+','+key.index;
}
