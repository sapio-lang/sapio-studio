
export function call(method, args) {
    return fetch(method, {method: "post", body:
        JSON.stringify(args),
        headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json'
        },
    })
        .then(res=>res.json());

};

export function keyFn(key) {
return key.hash.toString('hex') +','+ key.index;
};
