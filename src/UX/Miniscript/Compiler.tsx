import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextareaAutosize,
    Typography,
} from '@mui/material';
import * as React from 'react';
import './Compiler.css';
import * as Bitcoin from 'bitcoinjs-lib';
type Compiler = typeof import('../../Miniscript/pkg/');
export function MiniscriptCompiler() {
    const [miniscript, load_miniscript] = React.useState<null | Compiler>(null);
    React.useEffect(() => {
        async function load() {
            import('../../Miniscript/pkg').then((native) => {
                load_miniscript(native);
            });
        }
        if (miniscript === null) load();
    }, [miniscript]);
    if (!miniscript) return <h1>Loading WASM...</h1>;
    else return <CompInput miniscript={miniscript}></CompInput>;
}
type taproot_t = {
    address: {
        main: string;
        regtest: string;
        signet: string;
        test: string;
    };
    internal_key: string;
    merkle_root: string;
    scripts: Array<[[string, number], string[][]]>;
    tweak: string;
};
const UNICODE_LINE = /\r\n|(?!\r\n)[\n-\r\x85\u2028\u2029]/;
function CompInput(props: { miniscript: Compiler }) {
    type ResultT = ['err', string, string] | ['ok', string, string];
    const [compiled, set_compiled] = React.useState<ResultT[]>([]);
    const [keytab_string, set_keytab_string] = React.useState<string>('');
    const updated = (
        event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
        // some unicode thing
        const ret: ResultT[] = event.target.value
            .split(UNICODE_LINE)
            .flatMap((v: string): ResultT[] => {
                if (v.match(UNICODE_LINE)) return [];
                try {
                    /// TODO: Cache based on V
                    const s = props.miniscript.compile(v);
                    return [['ok', v, s]];
                } catch (e) {
                    if (typeof e === 'string') return [['err', v, e]];
                    else throw e;
                }
            });
        set_compiled(ret);
    };
    const keytab_updated = (
        event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
    ) => {
        set_keytab_string(event.target.value);
    };
    const [taproot, set_taproot] = React.useState<taproot_t | null>(null);
    React.useEffect(() => {
        // some unicode thing
        const k = props.miniscript.KeyTab.new();
        const ret = keytab_string.split(UNICODE_LINE).forEach((v: string) => {
            if (v.match(UNICODE_LINE)) return [];
            if (v === '') return [];
            const nick_key = v.split(':', 2);
            if (nick_key.length !== 2) return []; //throw new Error(`Malformed Keytab Entry: ${v}`);
            k.add(nick_key[0]!.trim(), nick_key[1]!.trim());
        });
        const frags = props.miniscript.Fragments.new();
        for (const frag of compiled) {
            // eslint-disable-next-line no-constant-condition
            if (frag[0] === 'err') {
                set_taproot(null);
                console.log(frag);
                return;
            }
            frags.add(frag[2]);
        }
        try {
            const compiled = props.miniscript.taproot(frags, k);
            set_taproot(JSON.parse(compiled));
        } catch (e) {
            set_taproot(null);
            console.log(e);
        }
    }, [keytab_string, compiled]);

    return (
        <Box className="MiniscriptCompiler">
            <h1>Input</h1>
            <TextareaAutosize
                onChange={updated}
                minRows={3}
                style={{ width: '50%' }}
            />

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell variant="head">Input</TableCell>
                        <TableCell variant="head">{'=>'}</TableCell>
                        <TableCell variant="head">Output</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {compiled.map((row, i) => (
                        <TableRow key={`${row[1]}#${i}`}>
                            <TableCell
                                style={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            >
                                <Typography
                                    className="CompilerOutput"
                                    component="code"
                                >
                                    {row[1]}
                                </Typography>
                            </TableCell>
                            <TableCell> {'=>'} </TableCell>
                            <TableCell>
                                <Typography
                                    style={{
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}
                                    className="CompilerOutput"
                                    component="code"
                                >
                                    {row[2]}
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <h1>Translate Keys</h1>
            <TextareaAutosize
                onChange={keytab_updated}
                minRows={3}
                style={{ width: '50%' }}
            />
            <div>{taproot && <ShowTaproot {...taproot}></ShowTaproot>}</div>
        </Box>
    );
}

function ShowTaproot(props: taproot_t) {
    const paths = props.scripts.flatMap(([[script, depth], paths]) => {
        const parsed = Bitcoin.script.decompile(Buffer.from(script, 'hex'));
        let asm: string;
        if (parsed) asm = Bitcoin.script.toASM(parsed);
        else asm = `Unparsable: ${script}`;
        return paths.map((path) => {
            return (
                <TableRow key={`${path}`} className="PathRow">
                    <TableCell>{depth}</TableCell>
                    <TableCell>
                        <code>{asm}</code>
                    </TableCell>
                    <TableCell>{path}</TableCell>
                </TableRow>
            );
        });
    });

    return (
        <div>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell variant="head">type</TableCell>
                        <TableCell variant="head">address</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TableRow>
                        <TableCell>main</TableCell>
                        <TableCell>{props.address.main}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>signet</TableCell>
                        <TableCell>{props.address.main}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>regtest</TableCell>
                        <TableCell>{props.address.regtest}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>testnet</TableCell>
                        <TableCell>{props.address.test}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
            <Table className="TapPaths">
                <TableHead>
                    <TableRow>
                        <TableCell variant="head"> Script </TableCell>
                        <TableCell variant="head"> Depth </TableCell>
                        <TableCell variant="head"> Path</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>{paths}</TableBody>
            </Table>
        </div>
    );
}
