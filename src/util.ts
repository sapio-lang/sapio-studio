
export function call(method:string, args:any) {
    return fetch(method, {method: "post", body:
        JSON.stringify(args),
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
    })
        .then(res=>res.json());

};

interface Key {
    index: number,
    hash: Buffer
}
export type OpaqueKey = string;
export function keyFn(key: Key): OpaqueKey {
    return key.hash.toString('hex')+','+key.index;
}
