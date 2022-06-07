declare module 'await-spawn' {
    import { ChildProcess, spawn } from 'child_process';
    type SpawnParams = Parameters<spawn>;
    declare async function spawn(
        ...spawn_params: SpawnParams
    ): Promise<BufferList> & { child: ChildProcess };
    export = spawn;
}

declare module 'another-json' {
    declare function stringify(js: any): string;
}
