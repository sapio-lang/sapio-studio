import { Box, TextareaAutosize, Typography } from '@mui/material';
import * as React from 'react';
import './Compiler.css';
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
const UNICODE_LINE = /\r\n|(?!\r\n)[\n-\r\x85\u2028\u2029]/;
function CompInput(props: { miniscript: Compiler }) {
    type ResultT = ['err', string, string] | ['ok', string, string];
    const [compiled, set_compiled] = React.useState<ResultT[]>([]);
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

    return (
        <Box className="MiniscriptCompiler">
            <h1>Input</h1>
            <TextareaAutosize
                onChange={updated}
                minRows={3}
                style={{ width: '50%' }}
            />

            <table>
                <thead>
                    <th>Success</th>
                    <th>Input</th>
                    <th>Output</th>
                </thead>
                <tbody>
                    {compiled.map((row, i) => (
                        <tr key={`${row[1]}#${i}`}>
                            <td>{row[0] === 'ok' ? 'Good:' : 'Error:'} </td>
                            <td>
                                <Typography
                                    className="CompilerOutput"
                                    component="code"
                                >
                                    {row[1]}
                                </Typography>
                            </td>
                            <td>
                                <Typography
                                    className="CompilerOutput"
                                    component="code"
                                >
                                    {row[2]}
                                </Typography>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Box>
    );
}
