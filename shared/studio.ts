/** Public data only. File access and Sapio execution stay in the desktop process. */
export type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type JsonSchema = boolean | JsonObject;

export interface StudioSettings {
    cliPath: string;
    workspace: string;
    runtimeConfig: string;
}
export interface CliStatus {
    available: boolean;
    version?: string;
    error?: string;
}
export type DocumentKind = 'json' | 'psbt' | 'transaction' | 'text';
export interface StudioDocument {
    name: string;
    text: string;
}
export interface ModuleSummary {
    key: string;
    name: string;
}
export interface ModuleInfo extends ModuleSummary {
    description: string;
    api: { arguments: JsonSchema; returns: JsonSchema };
}
export type SpendPath = 'KeyPath' | 'Descriptor' | { ScriptPath: string };
export type SpendSelector = 'key' | 'descriptor' | `script:${string}`;
export interface TemplateOutput {
    index: number;
    name: string | null;
    amount_sats: number;
    script_pubkey: string;
    contract_location: string;
}
export interface TemplateExplanation {
    hash: string;
    kind: 'committed' | 'suggested';
    guards: JsonValue[];
    minimum_funding_sats: number;
    contract_input_sats: number;
    reserved_fee_sats: number;
    funding_constraints: JsonValue;
    version: number;
    lock_time: number;
    inputs: {
        index: number;
        name: string | null;
        minimum_sats: number | null;
        sequence: number;
    }[];
    outputs: TemplateOutput[];
}
export interface ObjectExplanation {
    location: string;
    source_path: JsonValue;
    address: JsonValue;
    descriptor: JsonValue;
    required_input_sats: number;
    covenants: JsonValue;
    program_policies: JsonValue[];
    actions: {
        path: JsonValue;
        kind: 'committed' | 'suggested' | null;
        schema: JsonSchema | null;
    }[];
    templates: TemplateExplanation[];
}
export interface BranchPlan {
    path: SpendPath;
    policy: string;
    status: JsonValue;
    requirements: JsonValue[];
    witness_template: { description: string; serialized_bytes: number }[];
    satisfaction_weight_upper_bound: number | null;
    witness_bytes_upper_bound: number | null;
    transaction_compatible: 'Met' | 'Unmet' | 'Unknown';
}
export interface Explanation {
    artifact: { native_ctv_in_graph: boolean; nodes: ObjectExplanation[] };
    spend?: {
        branches: BranchPlan[];
        missing_prevouts: number[];
        funding: 'Met' | 'Unmet' | 'Unknown';
        template_funding: JsonValue;
        observed_final_witness_bytes: number | null;
    };
}
export interface ExplainInput {
    artifact: string;
    psbt?: string;
    assets?: string;
    input?: number;
}
export interface PrepareInput extends ExplainInput {
    psbt: string;
    path: SpendSelector;
    evidence?: string;
}
export interface ResumeInput {
    artifact: string;
    intent: string;
    psbt?: string;
}
export interface SpendUpdate {
    psbt: string;
    status: BranchPlan;
}
export interface PreparedSpend extends SpendUpdate {
    intent: string;
}
export interface IndexedProgramRequest {
    index: number;
    requirement: JsonValue;
    request: JsonValue;
}
export type BindFunding =
    | { kind: 'mock' }
    | { kind: 'outpoint'; outpoint: string }
    | { kind: 'psbt'; psbt: string };

export interface StudioAPI {
    settings: {
        load(): Promise<StudioSettings>;
        save(settings: StudioSettings): Promise<StudioSettings>;
        selectPath(
            kind: 'cli' | 'workspace' | 'runtime-config',
        ): Promise<string | null>;
        status(): Promise<CliStatus>;
    };
    documents: {
        open(kind: DocumentKind): Promise<StudioDocument | null>;
        save(
            document: StudioDocument & { kind: DocumentKind },
        ): Promise<boolean>;
    };
    modules: {
        list(): Promise<ModuleSummary[]>;
        load(): Promise<ModuleInfo | null>;
        loadExamples(): Promise<ModuleInfo[]>;
        info(key: string): Promise<ModuleInfo>;
        call(input: { key: string; args: string }): Promise<string>;
        validate(input: {
            key: string;
            side: 'arguments' | 'returns';
            value: JsonValue;
        }): Promise<{ valid: boolean; errors: string[] }>;
    };
    explain(input: ExplainInput): Promise<Explanation>;
    bind(input: { artifact: string; funding: BindFunding }): Promise<string>;
    spend: {
        prepare(input: PrepareInput): Promise<PreparedSpend>;
        requests(input: ResumeInput): Promise<IndexedProgramRequest[]>;
        status(input: ResumeInput): Promise<BranchPlan>;
        apply(
            input: ResumeInput & {
                responses: { index: number; psbt: string }[];
            },
        ): Promise<SpendUpdate>;
        signNative(input: ResumeInput): Promise<SpendUpdate | null>;
        signProgram(input: { request: string }): Promise<string | null>;
        finalize(
            input: ResumeInput & { transaction: boolean },
        ): Promise<string>;
    };
}

export type BridgeReply<T> =
    { ok: true; value: T } | { ok: false; error: string };
