import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
    BranchPlan,
    ExplainInput,
    Explanation,
    IndexedProgramRequest,
    ModuleInfo,
    PrepareInput,
    ResumeInput,
    SpendUpdate,
    StudioAPI,
    StudioSettings,
} from '../shared/studio';
import { documentText, index, object, parseDocument, runCli } from './cli';
import { validateValue } from './schema';

export interface DesktopSelection {
    module(): Promise<string | null>;
    key(): Promise<string | null>;
    evaluator(): Promise<string | null>;
}
export interface BridgeDependencies {
    settings(): Promise<StudioSettings>;
    selection: DesktopSelection;
    temporaryDirectory: string;
    schemaWorker: string;
    exampleModules?: readonly string[];
    run?: typeof runCli;
}

function moduleKey(value: unknown): string {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value))
        throw new Error('Module key must be a 32-byte hexadecimal hash.');
    return value;
}

function outputJson<T>(output: string, label: string): T {
    return parseDocument(output, `Sapio ${label} output`) as T;
}

/** Temporary paths never come from renderer input. Documents retain their exact bytes. */
async function withFiles<T>(
    root: string,
    documents: Record<string, string | undefined>,
    use: (directory: string) => Promise<T>,
): Promise<T> {
    let bytes = 0;
    for (const [name, text] of Object.entries(documents)) {
        if (text !== undefined)
            bytes += Buffer.byteLength(documentText(text, name));
        if (bytes > 128 * 1024 * 1024)
            throw new Error('Combined operation documents exceed 128 MiB.');
    }
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(path.join(root, 'sapio-studio-'));
    try {
        for (const [name, text] of Object.entries(documents)) {
            if (text !== undefined)
                await writeFile(path.join(directory, name), text, {
                    mode: 0o600,
                    flag: 'wx',
                });
        }
        return await use(directory);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

export function createSapioBridge(dependencies: BridgeDependencies): Pick<
    StudioAPI,
    'modules' | 'explain' | 'bind' | 'spend'
> & {
    status: StudioAPI['settings']['status'];
} {
    const run = dependencies.run ?? runCli;
    const command = async (args: string[], input?: string, runtime = false) => {
        const settings = await dependencies.settings();
        if (runtime && !settings.runtimeConfig)
            throw new Error('Choose a runtime configuration before binding.');
        return run(
            settings.cliPath,
            runtime ? ['--config', settings.runtimeConfig, ...args] : args,
            { ...(input === undefined ? {} : { input }) },
        );
    };
    const moduleCommand = async (
        operation: string,
        key?: string,
        input?: string,
        file?: string,
    ) => {
        const settings = await dependencies.settings();
        await mkdir(settings.workspace, { recursive: true });
        const args = ['contract', operation, '--workspace', settings.workspace];
        if (key !== undefined) args.push('--key', moduleKey(key));
        if (file !== undefined) args.push('--file', file);
        return run(settings.cliPath, args, {
            ...(input === undefined ? {} : { input }),
        });
    };
    const info = async (key: string): Promise<ModuleInfo> => {
        const description = outputJson<{ name: string; description: string }>(
            await moduleCommand('info', key),
            'module info',
        );
        const api = outputJson<ModuleInfo['api']>(
            await moduleCommand('api', key),
            'module API',
        );
        return { key, ...description, api };
    };
    const load = async (file: string): Promise<ModuleInfo> => {
        const result = outputJson<{ key: string }>(
            await moduleCommand('load', undefined, undefined, file),
            'module load',
        );
        return info(result.key);
    };
    const resumeFiles = (input: ResumeInput) => {
        object(input, 'Spend input');
        parseDocument(input.artifact, 'Artifact');
        parseDocument(input.intent, 'Spend intent');
        return {
            'artifact.json': input.artifact,
            'intent.json': input.intent,
            'current.psbt': input.psbt,
        };
    };
    const resumeArgs = (directory: string, input: ResumeInput) => [
        '--artifact',
        path.join(directory, 'artifact.json'),
        '--intent',
        path.join(directory, 'intent.json'),
        ...(input.psbt === undefined
            ? []
            : ['--psbt', path.join(directory, 'current.psbt')]),
    ];
    const resume = (
        operation: string,
        input: ResumeInput,
        extra: string[] = [],
    ) =>
        withFiles(
            dependencies.temporaryDirectory,
            resumeFiles(input),
            (directory) =>
                command([
                    'contract',
                    'spend',
                    operation,
                    ...resumeArgs(directory, input),
                    ...extra,
                ]),
        );
    const status = async (input: ResumeInput) =>
        outputJson<BranchPlan>(await resume('status', input), 'spend status');
    const update = async (
        input: ResumeInput,
        psbt: string,
    ): Promise<SpendUpdate> => ({
        psbt,
        status: await status({ ...input, psbt }),
    });
    return {
        async status() {
            const settings = await dependencies.settings();
            try {
                const version = await run(settings.cliPath, ['--version'], {
                    timeoutMs: 10_000,
                });
                await run(
                    settings.cliPath,
                    ['contract', 'spend', 'finalize', '--help'],
                    { timeoutMs: 10_000 },
                );
                await run(settings.cliPath, ['signer', 'program', '--help'], {
                    timeoutMs: 10_000,
                });
                return { available: true, version };
            } catch (error) {
                return {
                    available: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Sapio is unavailable.',
                };
            }
        },
        modules: {
            async list() {
                const modules = outputJson<Record<string, string>>(
                    await moduleCommand('list'),
                    'module list',
                );
                return Object.entries(modules).map(([key, name]) => ({
                    key,
                    name,
                }));
            },
            async load() {
                const file = await dependencies.selection.module();
                if (file === null) return null;
                return load(file);
            },
            async loadExamples() {
                if (!dependencies.exampleModules?.length)
                    throw new Error(
                        'This Studio build does not include example modules.',
                    );
                const modules: ModuleInfo[] = [];
                for (const file of dependencies.exampleModules)
                    modules.push(await load(file));
                return modules;
            },
            info,
            async call(input) {
                object(input, 'Module input');
                const args = object(
                    parseDocument(input.args, 'Module arguments'),
                    'Module arguments',
                );
                object(args.context, 'Compilation context');
                // Sapio consumes the original JSON. In particular, public lowering and
                // network inputs never come from desktop runtime settings.
                return moduleCommand(
                    'create',
                    moduleKey(input.key),
                    input.args,
                );
            },
            async validate(input) {
                object(input, 'Schema validation');
                if (input.side !== 'arguments' && input.side !== 'returns')
                    throw new Error('Choose the arguments or returns schema.');
                const module = await info(moduleKey(input.key));
                return validateValue(
                    module.api[input.side],
                    input.value,
                    dependencies.schemaWorker,
                );
            },
            async validateValue(input) {
                object(input, 'Value validation');
                if (typeof input.schema !== 'boolean')
                    object(input.schema, 'Value schema');
                if (!Object.hasOwn(input, 'value'))
                    throw new Error('Supply a value to validate.');
                return validateValue(
                    input.schema,
                    input.value,
                    dependencies.schemaWorker,
                );
            },
        },
        async explain(input: ExplainInput) {
            object(input, 'Explanation input');
            parseDocument(input.artifact, 'Artifact');
            if (input.assets !== undefined)
                parseDocument(input.assets, 'Capabilities');
            if (input.input !== undefined && input.psbt === undefined)
                throw new Error('An input index requires a PSBT.');
            return withFiles(
                dependencies.temporaryDirectory,
                { 'funded.psbt': input.psbt, 'assets.json': input.assets },
                async (directory) => {
                    const args = ['contract', 'explain', '--json'];
                    if (input.psbt !== undefined)
                        args.push(
                            '--psbt',
                            path.join(directory, 'funded.psbt'),
                        );
                    if (input.assets !== undefined)
                        args.push(
                            '--assets',
                            path.join(directory, 'assets.json'),
                        );
                    if (input.input !== undefined)
                        args.push('--input', String(index(input.input)));
                    return outputJson<Explanation>(
                        await command(args, input.artifact),
                        'explanation',
                    );
                },
            );
        },
        async bind(input) {
            object(input, 'Bind input');
            parseDocument(input.artifact, 'Artifact');
            object(input.funding, 'Funding');
            let flags: string[];
            if (input.funding.kind === 'mock') flags = ['--mock'];
            else if (input.funding.kind === 'outpoint') {
                if (!/^[a-f0-9]{64}:\d+$/i.test(input.funding.outpoint))
                    throw new Error('Outpoint must be TXID:VOUT.');
                flags = ['--outpoint', input.funding.outpoint];
            } else if (input.funding.kind === 'psbt') {
                return withFiles(
                    dependencies.temporaryDirectory,
                    { 'funding.psbt': input.funding.psbt },
                    (directory) =>
                        command(
                            [
                                'contract',
                                'bind',
                                '--funding-psbt',
                                path.join(directory, 'funding.psbt'),
                            ],
                            input.artifact,
                            true,
                        ),
                );
            } else
                throw new Error(
                    'Choose mock funding, an outpoint, or a funding PSBT.',
                );
            return command(
                ['contract', 'bind', ...flags],
                input.artifact,
                true,
            );
        },
        spend: {
            async prepare(input: PrepareInput) {
                object(input, 'Preparation input');
                parseDocument(input.artifact, 'Artifact');
                if (input.assets !== undefined)
                    parseDocument(input.assets, 'Capabilities');
                if (input.evidence !== undefined)
                    parseDocument(input.evidence, 'Evidence');
                if (!/^(key|descriptor|script:[a-f0-9]{64})$/i.test(input.path))
                    throw new Error(
                        'Choose key, descriptor, or script:<leaf hash>.',
                    );
                return withFiles(
                    dependencies.temporaryDirectory,
                    {
                        'artifact.json': input.artifact,
                        'funded.psbt': input.psbt,
                        'assets.json': input.assets,
                        'evidence.json': input.evidence,
                    },
                    async (directory) => {
                        const args = [
                            'contract',
                            'spend',
                            'prepare',
                            '--artifact',
                            path.join(directory, 'artifact.json'),
                            '--psbt',
                            path.join(directory, 'funded.psbt'),
                            '--path',
                            input.path,
                            '--psbt-output',
                            path.join(directory, 'baseline.psbt'),
                        ];
                        if (input.input !== undefined)
                            args.push('--input', String(index(input.input)));
                        if (input.assets !== undefined)
                            args.push(
                                '--assets',
                                path.join(directory, 'assets.json'),
                            );
                        if (input.evidence !== undefined)
                            args.push(
                                '--evidence',
                                path.join(directory, 'evidence.json'),
                            );
                        const intent = await command(args);
                        parseDocument(intent, 'Prepared spend');
                        const psbt = (
                            await readFile(
                                path.join(directory, 'baseline.psbt'),
                                'utf8',
                            )
                        ).trimEnd();
                        return {
                            intent,
                            ...(await update(
                                { artifact: input.artifact, intent },
                                psbt,
                            )),
                        };
                    },
                );
            },
            async requests(input) {
                return outputJson<IndexedProgramRequest[]>(
                    await resume('requests', input),
                    'program requests',
                );
            },
            status,
            async apply(input) {
                const documents: Record<string, string | undefined> =
                    resumeFiles(input);
                if (
                    !Array.isArray(input.responses) ||
                    !input.responses.length ||
                    input.responses.length > 1024
                )
                    throw new Error(
                        'Supply between 1 and 1024 indexed responses.',
                    );
                const indexes = new Set<number>();
                for (const response of input.responses) {
                    const requestIndex = index(response.index, 'Request index');
                    if (indexes.has(requestIndex))
                        throw new Error(
                            'Each request index may occur only once.',
                        );
                    indexes.add(requestIndex);
                    documents[`response-${requestIndex}.psbt`] = response.psbt;
                }
                const psbt = await withFiles(
                    dependencies.temporaryDirectory,
                    documents,
                    (directory) =>
                        command([
                            'contract',
                            'spend',
                            'apply',
                            ...resumeArgs(directory, input),
                            ...input.responses.flatMap((response) => [
                                '--response',
                                `${response.index}=${path.join(directory, `response-${response.index}.psbt`)}`,
                            ]),
                        ]),
                );
                return update(input, psbt);
            },
            async signNative(input) {
                resumeFiles(input);
                const key = await dependencies.selection.key();
                if (key === null) return null;
                return update(
                    input,
                    await resume('sign-native', input, ['--key', key]),
                );
            },
            async signProgram(input) {
                object(input, 'Program signing input');
                const request = object(
                    parseDocument(input.request, 'Program request'),
                    'Program request',
                );
                const instance = object(request.instance, 'Program instance');
                const evaluator = instance.evaluator;
                if (
                    typeof evaluator !== 'string' ||
                    !/^[a-f0-9]{64}$/i.test(evaluator)
                )
                    throw new Error(
                        'Program request must contain its exact evaluator ID.',
                    );
                const key = await dependencies.selection.key();
                if (key === null) return null;
                const args = [
                    'signer',
                    'program',
                    '--request',
                    '-',
                    '--key',
                    key,
                ];
                if (
                    evaluator !== '0'.repeat(64) &&
                    evaluator !== `${'0'.repeat(62)}02`
                ) {
                    const file = await dependencies.selection.evaluator();
                    if (file === null) return null;
                    args.push('--evaluator', file);
                }
                return command(args, input.request);
            },
            async finalize(input) {
                if (typeof input.transaction !== 'boolean')
                    throw new Error('Choose PSBT or transaction output.');
                return resume(
                    'finalize',
                    input,
                    input.transaction ? ['--transaction'] : [],
                );
            },
        },
    };
}
