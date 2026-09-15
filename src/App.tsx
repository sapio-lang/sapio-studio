import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    Box,
    ChevronDown,
    FileDown,
    FileUp,
    FlaskConical,
    FolderOpen,
    GitBranch,
    Layers3,
    ListFilter,
    Plus,
    RefreshCw,
    Search,
    Settings2,
    ShieldCheck,
    SlidersHorizontal,
    Workflow,
    X,
} from 'lucide-react';
import type {
    CliStatus,
    Explanation,
    JsonValue,
    ModuleInfo,
    ModuleSummary,
    StudioSettings,
} from '../shared/studio';
import {
    ArtifactGraph,
    ArtifactInspector,
    type ArtifactSelection,
} from './ArtifactGraph';
import { ContextEditor, Dialog, isObject } from './Dialog';
import { ModuleAuthoring } from './ModuleAuthoring';
import { SettingsPanel } from './SettingsPanel';
import { SpendPanel } from './SpendPanel';
import { PatchCanvas } from './patching/PatchCanvas';
import { displayModuleName } from './patching/PatchNodeCard';
import {
    DocumentField,
    EmptyState,
    Spinner,
    errorMessage,
    formatSats,
} from './ui';

const api = window.studio;
type Tab = 'patch' | 'inspect' | 'spend';
type ModalName =
    'settings' | 'context' | 'module' | 'result' | 'binding' | null;

function App() {
    const [tab, setTab] = useState<Tab>(api ? 'patch' : 'inspect');
    const [modal, setModal] = useState<ModalName>(null);
    const [settings, setSettings] = useState<StudioSettings | null>(null);
    const [cli, setCli] = useState<CliStatus | null>(null);
    const [modules, setModules] = useState<ModuleSummary[]>([]);
    const [modulesLoading, setModulesLoading] = useState(false);
    const [moduleInfos, setModuleInfos] = useState<Record<string, ModuleInfo>>(
        {},
    );
    const [selectedModule, setSelectedModule] = useState<ModuleInfo | null>(
        null,
    );
    const [addModule, setAddModule] = useState<{
        key: string;
        sequence: number;
    } | null>(null);
    const [example, setExample] = useState<{
        clauseKey: string;
        trampolineKey: string;
        sequence: number;
    } | null>(null);
    const [search, setSearch] = useState('');
    const [context, setContext] = useState<JsonValue>({
        network: 'Regtest',
        amount: 20000,
        lowering: 'Native',
    });
    const [artifact, setArtifact] = useState<{
        text: string;
        name: string;
        explanation: Explanation;
        revision: number;
        demo: boolean;
    } | null>(null);
    const [selection, setSelection] = useState<ArtifactSelection | null>(null);
    const [outline, setOutline] = useState(false);
    const [result, setResult] = useState<{
        text: string;
        name: string;
        contract: boolean;
    } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const artifactRequest = useRef(0);
    const activityRequest = useRef(0);
    const moduleRequest = useRef(0);
    const invalidatePatchResult = useCallback(() => setResult(null), []);
    const loadPatchModules = useCallback(async (keys: string[]) => {
        if (!api)
            throw new Error('Open the desktop app to load a saved patch.');
        const loaded: ModuleInfo[] = [];
        for (const key of new Set(keys)) {
            try {
                loaded.push(await api.modules.info(key));
            } catch (error) {
                throw new Error(
                    `Cannot load patch module ${key}. Load its WASM file into this workspace, then reopen the patch.\n${errorMessage(error)}`,
                );
            }
        }
        setModuleInfos((current) => ({
            ...current,
            ...Object.fromEntries(loaded.map((module) => [module.key, module])),
        }));
    }, []);
    const [bindingMode, setBindingMode] = useState<
        'mock' | 'outpoint' | 'psbt'
    >('mock');
    const [outpoint, setOutpoint] = useState('');
    const [bindingPsbt, setBindingPsbt] = useState('');
    const contextObject = isObject(context) ? context : {};
    const canRun = Boolean(api && cli?.available);

    useEffect(() => {
        let active = true;
        if (api) {
            Promise.all([api.settings.load(), api.settings.status()])
                .then(async ([config, status]) => {
                    if (!active) return;
                    setSettings(config);
                    setCli(status);
                    if (status.available) await refresh();
                })
                .catch((error) => {
                    if (active) setError(errorMessage(error));
                });
        } else {
            const request = ++artifactRequest.current;
            Promise.all([
                fetch('./demo/starter-artifact.json'),
                fetch('./demo/starter-explanation.json'),
            ])
                .then(async ([raw, explained]) => {
                    if (!raw.ok || !explained.ok)
                        throw new Error(
                            'The reference artifact could not be loaded.',
                        );
                    const [text, explanation] = await Promise.all([
                        raw.text(),
                        explained.json() as Promise<Explanation>,
                    ]);
                    if (active && request === artifactRequest.current) {
                        setArtifact({
                            text,
                            name: 'Payment contract',
                            explanation,
                            revision: 1,
                            demo: true,
                        });
                        const root = explanation.artifact.nodes[0];
                        if (root)
                            setSelection({ kind: 'output', object: root });
                    }
                })
                .catch((error) => {
                    if (active && request === artifactRequest.current)
                        setError(errorMessage(error));
                });
        }
        return () => {
            active = false;
        };
    }, []);

    async function run(label: string, action: () => Promise<void>) {
        const activity = ++activityRequest.current;
        setBusy(label);
        setError('');
        try {
            await action();
        } catch (error) {
            if (activity === activityRequest.current)
                setError(errorMessage(error));
        } finally {
            if (activity === activityRequest.current) setBusy('');
        }
    }
    function closeModal() {
        if (modal === 'module' || modal === 'result')
            artifactRequest.current += 1;
        setModal(null);
    }
    async function refresh() {
        if (!api) return;
        const request = ++moduleRequest.current;
        setModulesLoading(true);
        try {
            const available = await api.modules.list();
            if (request !== moduleRequest.current) return;
            setModules(available);
            const keys = new Set(available.map((module) => module.key));
            setModuleInfos((current) =>
                Object.fromEntries(
                    Object.entries(current).filter(([key]) => keys.has(key)),
                ),
            );
            setSelectedModule((current) =>
                current && keys.has(current.key) ? current : null,
            );
        } finally {
            if (request === moduleRequest.current) setModulesLoading(false);
        }
    }
    async function info(summary: ModuleSummary): Promise<ModuleInfo> {
        const cached = moduleInfos[summary.key];
        if (cached) return cached;
        if (!api)
            throw new Error('Open the desktop app to inspect a local module.');
        const loaded = await api.modules.info(summary.key);
        setModuleInfos((current) => ({ ...current, [loaded.key]: loaded }));
        return loaded;
    }
    async function inspect(text: string, name: string) {
        if (!api)
            throw new Error(
                'Open the desktop app to validate an artifact with Sapio.',
            );
        const request = ++artifactRequest.current;
        const sourceModal = modal;
        let explanation: Explanation;
        try {
            explanation = await api.explain({ artifact: text });
        } catch (error) {
            if (request !== artifactRequest.current) return;
            throw error;
        }
        if (request !== artifactRequest.current) return;
        setArtifact((current) => ({
            text,
            name,
            explanation,
            revision: (current?.revision ?? 0) + 1,
            demo: false,
        }));
        const root = explanation.artifact.nodes[0];
        setSelection(root ? { kind: 'output', object: root } : null);
        setTab('inspect');
        setModal((current) => (current === sourceModal ? null : current));
    }
    async function loadArtifact() {
        if (!api) return;
        const doc = await api.documents.open('json');
        if (doc) await inspect(doc.text, doc.name.replace(/\.json$/i, ''));
    }
    async function loadDemo() {
        const request = ++artifactRequest.current;
        let text: string;
        let explanation: Explanation;
        try {
            const [raw, explained] = await Promise.all([
                fetch('./demo/starter-artifact.json'),
                fetch('./demo/starter-explanation.json'),
            ]);
            if (!raw.ok || !explained.ok)
                throw new Error('The reference artifact could not be loaded.');
            [text, explanation] = await Promise.all([
                raw.text(),
                explained.json() as Promise<Explanation>,
            ]);
        } catch (error) {
            if (request !== artifactRequest.current) return;
            throw error;
        }
        if (request !== artifactRequest.current) return;
        setArtifact((current) => ({
            text,
            name: 'Payment contract',
            explanation,
            revision: (current?.revision ?? 0) + 1,
            demo: true,
        }));
        const root = explanation.artifact.nodes[0];
        setSelection(root ? { kind: 'output', object: root } : null);
        setTab('inspect');
    }
    const visibleModules = modules.filter((module) =>
        `${moduleInfos[module.key] ? displayModuleName(moduleInfos[module.key]!) : module.name} ${module.key}`
            .toLowerCase()
            .includes(search.toLowerCase()),
    );
    const templates =
        artifact?.explanation.artifact.nodes.flatMap(
            (object) => object.templates,
        ) ?? [];
    const workspaceName = settings?.workspace
        .split(/[\\/]/)
        .filter(Boolean)
        .at(-1);

    return (
        <div className="studio-app">
            <aside className="library-panel">
                <div className="brand" aria-label="Sapio Studio">
                    <span className="brand-mark">
                        <Workflow size={23} />
                    </span>
                    <div>
                        sapio<span>STUDIO</span>
                    </div>
                    <span className="preview-label">PREVIEW</span>
                </div>
                <div className="library-heading">
                    <span>Module library</span>
                    <button
                        className="icon-button"
                        disabled={!canRun || Boolean(busy) || modulesLoading}
                        onClick={() => run('Refreshing modules', refresh)}
                        aria-label="Refresh modules"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
                <div className="library-search">
                    <Search size={14} />
                    <input
                        aria-label="Search modules"
                        placeholder="Search modules…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                <button
                    className="button library-load"
                    disabled={!canRun || Boolean(busy)}
                    onClick={() =>
                        run('Loading WASM module', async () => {
                            const loaded = await api?.modules.load();
                            if (loaded) {
                                setModuleInfos((current) => ({
                                    ...current,
                                    [loaded.key]: loaded,
                                }));
                                setSelectedModule(loaded);
                                await refresh();
                                setModal('module');
                            }
                        })
                    }
                >
                    <Plus size={15} />
                    Load WASM module
                </button>
                <div className="module-library-list">
                    {modulesLoading && (
                        <div className="library-loading" role="status">
                            <Spinner label="Loading module library" />
                            <span>Reading module interfaces…</span>
                        </div>
                    )}
                    {visibleModules.length
                        ? visibleModules.map((module) => (
                              <div className="library-module" key={module.key}>
                                  <button
                                      className="module-info-button"
                                      disabled={Boolean(busy)}
                                      onClick={() =>
                                          run(
                                              'Reading module schema',
                                              async () => {
                                                  setSelectedModule(
                                                      await info(module),
                                                  );
                                                  setModal('module');
                                              },
                                          )
                                      }
                                  >
                                      <span className="module-icon">
                                          <Box size={16} />
                                      </span>
                                      <span>
                                          <strong>
                                              {moduleInfos[module.key]
                                                  ? displayModuleName(
                                                        moduleInfos[
                                                            module.key
                                                        ]!,
                                                    )
                                                  : module.name}
                                          </strong>
                                          <code>{module.key.slice(0, 12)}</code>
                                      </span>
                                  </button>
                                  <button
                                      className="icon-button add-module"
                                      disabled={!canRun || Boolean(busy)}
                                      aria-label={`Add ${module.name} to patch`}
                                      onClick={() =>
                                          run('Adding module', async () => {
                                              await info(module);
                                              setAddModule((current) => ({
                                                  key: module.key,
                                                  sequence:
                                                      (current?.sequence ?? 0) +
                                                      1,
                                              }));
                                              setTab('patch');
                                          })
                                      }
                                  >
                                      <Plus size={14} />
                                  </button>
                              </div>
                          ))
                        : !modulesLoading && (
                              <div className="library-empty">
                                  <Layers3 size={25} />
                                  <strong>
                                      {search
                                          ? 'No matching modules'
                                          : 'Your building blocks'}
                                  </strong>
                                  <p>
                                      {search
                                          ? 'Try another name or module hash.'
                                          : api
                                            ? 'Load a WASM module to inspect its interface, edit inputs, and connect it to a patch.'
                                            : 'Load your WASM modules in the desktop app. Their schemas become inputs and outputs you can connect.'}
                                  </p>
                              </div>
                          )}
                </div>
                <div className="library-footer">
                    <button
                        className="library-footer-button"
                        disabled={!canRun || Boolean(busy)}
                        onClick={() =>
                            run('Opening example patch', async () => {
                                if (!api) return;
                                const examples =
                                    await api.modules.loadExamples();
                                const [clause, trampoline] = examples;
                                if (
                                    examples.length !== 2 ||
                                    !clause ||
                                    !trampoline ||
                                    clause.key === trampoline.key
                                )
                                    throw new Error(
                                        'The bundled example must provide two distinct module hashes.',
                                    );
                                setModuleInfos((current) => ({
                                    ...current,
                                    ...Object.fromEntries(
                                        examples.map((module) => [
                                            module.key,
                                            module,
                                        ]),
                                    ),
                                }));
                                await refresh();
                                setExample((current) => ({
                                    clauseKey: clause.key,
                                    trampolineKey: trampoline.key,
                                    sequence: (current?.sequence ?? 0) + 1,
                                }));
                                setTab('patch');
                            })
                        }
                    >
                        <Workflow size={16} />
                        <span>
                            Open example patch
                            <small>Real modules · connect and compile</small>
                        </span>
                    </button>
                    <button
                        className="library-footer-button"
                        onClick={() =>
                            run('Opening reference artifact', loadDemo)
                        }
                    >
                        <FlaskConical size={16} />
                        <span>
                            Explore a real contract
                            <small>Payment demo · compiled by Sapio</small>
                        </span>
                    </button>
                    <button
                        className="library-footer-button"
                        onClick={() => setModal('settings')}
                    >
                        <Settings2 size={16} />
                        <span>
                            Studio settings
                            <small>
                                {api
                                    ? (workspaceName ?? 'Configure your CLI')
                                    : 'Desktop setup'}
                            </small>
                        </span>
                    </button>
                </div>
            </aside>
            <div className="workbench">
                <header className="workspace-header">
                    <div className="workspace-identity">
                        <span className="workspace-icon">
                            <FolderOpen size={16} />
                        </span>
                        <div>
                            <span className="section-overline">
                                {api
                                    ? 'Local workspace'
                                    : 'Reference workspace'}
                            </span>
                            <strong>
                                {workspaceName ??
                                    (api
                                        ? 'Untitled workspace'
                                        : 'Sapio developer preview')}
                            </strong>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            className={`connection-status ${canRun ? 'connected' : ''}`}
                            onClick={() => setModal('settings')}
                        >
                            <i />
                            {api
                                ? cli === null
                                    ? 'Checking CLI'
                                    : cli.available
                                      ? (cli.version ?? 'Sapio connected')
                                      : 'Set up Sapio CLI'
                                : 'Read-only browser preview'}
                            <ChevronDown size={12} />
                        </button>
                        <button
                            className="button"
                            disabled={!canRun || Boolean(busy)}
                            onClick={() =>
                                run('Opening artifact', loadArtifact)
                            }
                        >
                            <FileUp size={15} />
                            Open artifact
                        </button>
                    </div>
                </header>
                <div className="transport-bar">
                    <div
                        className="tab-list"
                        role="tablist"
                        aria-label="Workbench"
                        onKeyDown={(event) => {
                            const tabs: Tab[] = ['patch', 'inspect', 'spend'];
                            const index = tabs.indexOf(tab);
                            const next =
                                event.key === 'ArrowRight'
                                    ? tabs[(index + 1) % tabs.length]
                                    : event.key === 'ArrowLeft'
                                      ? tabs[
                                            (index + tabs.length - 1) %
                                                tabs.length
                                        ]
                                      : event.key === 'Home'
                                        ? tabs[0]
                                        : event.key === 'End'
                                          ? tabs.at(-1)
                                          : undefined;
                            if (next) {
                                event.preventDefault();
                                setTab(next);
                                document.getElementById(`tab-${next}`)?.focus();
                            }
                        }}
                    >
                        <button
                            id="tab-patch"
                            role="tab"
                            aria-selected={tab === 'patch'}
                            aria-controls="panel-patch"
                            tabIndex={tab === 'patch' ? 0 : -1}
                            onClick={() => setTab('patch')}
                        >
                            <Workflow size={15} />
                            Patch
                        </button>
                        <button
                            id="tab-inspect"
                            role="tab"
                            aria-selected={tab === 'inspect'}
                            aria-controls="panel-inspect"
                            tabIndex={tab === 'inspect' ? 0 : -1}
                            onClick={() => setTab('inspect')}
                        >
                            <GitBranch size={15} />
                            Inspect
                            {artifact && (
                                <span className="tab-count">
                                    {artifact.explanation.artifact.nodes.length}
                                </span>
                            )}
                        </button>
                        <button
                            id="tab-spend"
                            role="tab"
                            aria-selected={tab === 'spend'}
                            aria-controls="panel-spend"
                            tabIndex={tab === 'spend' ? 0 : -1}
                            onClick={() => setTab('spend')}
                        >
                            <ShieldCheck size={15} />
                            Spend
                        </button>
                    </div>
                    <button
                        className="context-button"
                        onClick={() => setModal('context')}
                    >
                        <span className="network-dot" />
                        {String(contextObject.network ?? 'Custom context')}
                        <span className="context-separator" />
                        {formatSats(Number(contextObject.amount ?? 0))}
                        <SlidersHorizontal size={14} />
                    </button>
                </div>
                {(error || busy) && (
                    <div
                        className={`global-message ${error ? 'error' : ''}`}
                        role={error ? 'alert' : 'status'}
                    >
                        {error ? (
                            <>
                                <span>{error}</span>
                                <button
                                    className="icon-button"
                                    onClick={() => setError('')}
                                    aria-label="Dismiss error"
                                >
                                    <X size={15} />
                                </button>
                            </>
                        ) : (
                            <Spinner label={busy} />
                        )}
                    </div>
                )}
                <main className="main-workspace">
                    <div
                        id="panel-patch"
                        role="tabpanel"
                        aria-labelledby="tab-patch"
                        hidden={tab !== 'patch'}
                        className="patch-panel"
                    >
                        <PatchCanvas
                            modules={Object.values(moduleInfos)}
                            context={context}
                            onContextChange={setContext}
                            addModule={addModule}
                            example={example}
                            onLoadModules={loadPatchModules}
                            onDiscoverModules={async () => {
                                await loadPatchModules(
                                    modules
                                        .filter(
                                            (module) =>
                                                !moduleInfos[module.key],
                                        )
                                        .map((module) => module.key),
                                );
                            }}
                            onInvalidate={invalidatePatchResult}
                            invoke={async (key, args) => {
                                if (!api)
                                    throw new Error(
                                        'Module execution is available in the desktop app.',
                                    );
                                return JSON.parse(
                                    await api.modules.call({
                                        key,
                                        args: JSON.stringify(args),
                                    }),
                                ) as JsonValue;
                            }}
                            validate={async (key, side, value) => {
                                if (!api)
                                    throw new Error(
                                        'Module validation is available in the desktop app.',
                                    );
                                return api.modules.validate({
                                    key,
                                    side,
                                    value,
                                });
                            }}
                            validateValue={async (schema, value) => {
                                if (!api)
                                    throw new Error(
                                        'Value validation is available in the desktop app.',
                                    );
                                return api.modules.validateValue({
                                    schema,
                                    value,
                                });
                            }}
                            onResult={(value, name, contract) => {
                                setResult({
                                    text: JSON.stringify(value, null, 2),
                                    name,
                                    contract,
                                });
                            }}
                        />
                        {result && (
                            <div className="patch-result-bar">
                                <span>
                                    <span className="result-dot" />
                                    Latest result from{' '}
                                    <strong>{result.name}</strong>
                                </span>
                                {result.contract && (
                                    <button
                                        className="button primary small"
                                        disabled={!canRun || Boolean(busy)}
                                        onClick={() =>
                                            run('Inspecting contract', () =>
                                                inspect(
                                                    result.text,
                                                    result.name,
                                                ),
                                            )
                                        }
                                    >
                                        Inspect contract{' '}
                                        <ArrowRight size={14} />
                                    </button>
                                )}
                                <button
                                    className="button small"
                                    onClick={() => setModal('result')}
                                >
                                    Review output
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                    <div
                        id="panel-inspect"
                        role="tabpanel"
                        aria-labelledby="tab-inspect"
                        hidden={tab !== 'inspect'}
                        className="inspect-panel"
                    >
                        {artifact ? (
                            <>
                                <div className="artifact-toolbar">
                                    <div>
                                        <div className="section-overline">
                                            {artifact.demo
                                                ? 'Reference artifact'
                                                : 'Validated artifact'}
                                        </div>
                                        <h1>{artifact.name}</h1>
                                    </div>
                                    <div className="artifact-toolbar-actions">
                                        <span className="artifact-stat">
                                            <strong>{templates.length}</strong>{' '}
                                            transaction
                                            {templates.length === 1 ? '' : 's'}
                                        </span>
                                        <button
                                            className={`icon-button ${outline ? 'active' : ''}`}
                                            aria-label={
                                                outline
                                                    ? 'Show graph'
                                                    : 'Show output list'
                                            }
                                            onClick={() => setOutline(!outline)}
                                        >
                                            <ListFilter size={17} />
                                        </button>
                                        <button
                                            className="button small"
                                            disabled={!api || Boolean(busy)}
                                            onClick={() =>
                                                run(
                                                    'Exporting artifact',
                                                    async () => {
                                                        await api?.documents.save(
                                                            {
                                                                name: `${artifact.name}.json`,
                                                                text: artifact.text,
                                                                kind: 'json',
                                                            },
                                                        );
                                                    },
                                                )
                                            }
                                        >
                                            <FileDown size={14} />
                                            Export
                                        </button>
                                        <button
                                            className="button subtle small"
                                            disabled={!canRun || Boolean(busy)}
                                            onClick={() => setModal('binding')}
                                        >
                                            Bind preview
                                        </button>
                                    </div>
                                </div>
                                {artifact.explanation.artifact
                                    .native_ctv_in_graph && (
                                    <div className="assumption-bar">
                                        <ShieldCheck size={14} />
                                        This contract assumes native CTV
                                        enforcement. Chain activation is not
                                        established.
                                    </div>
                                )}
                                <div className="inspect-body">
                                    {outline ? (
                                        <div className="artifact-outline">
                                            <h2>Contract outputs</h2>
                                            {artifact.explanation.artifact.nodes.map(
                                                (object, index) => (
                                                    <button
                                                        key={object.location}
                                                        onClick={() =>
                                                            setSelection({
                                                                kind: 'output',
                                                                object,
                                                            })
                                                        }
                                                    >
                                                        <span className="outline-index">
                                                            {String(
                                                                index,
                                                            ).padStart(2, '0')}
                                                        </span>
                                                        <span>
                                                            <strong>
                                                                {object.location ===
                                                                ''
                                                                    ? 'Contract root'
                                                                    : `Output occurrence ${index}`}
                                                            </strong>
                                                            <small>
                                                                {
                                                                    object
                                                                        .templates
                                                                        .length
                                                                }{' '}
                                                                transaction
                                                                templates ·{' '}
                                                                {
                                                                    object
                                                                        .program_policies
                                                                        .length
                                                                }{' '}
                                                                Program policies
                                                            </small>
                                                        </span>
                                                        <span>
                                                            {formatSats(
                                                                object.required_input_sats,
                                                            )}
                                                        </span>
                                                    </button>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <ArtifactGraph
                                            explanation={artifact.explanation}
                                            onSelect={setSelection}
                                        />
                                    )}
                                    <aside className="artifact-inspector">
                                        <div className="inspector-heading">
                                            <span>Inspector</span>
                                            <span className="badge small">
                                                Artifact
                                            </span>
                                        </div>
                                        <ArtifactInspector
                                            selection={selection}
                                        />
                                    </aside>
                                </div>
                            </>
                        ) : (
                            <EmptyState
                                icon={<GitBranch size={34} />}
                                title="Make the contract visible"
                                action={
                                    <div className="button-row">
                                        <button
                                            className="button primary"
                                            disabled={!canRun || Boolean(busy)}
                                            onClick={() =>
                                                run(
                                                    'Opening artifact',
                                                    loadArtifact,
                                                )
                                            }
                                        >
                                            <FileUp size={16} />
                                            Open artifact
                                        </button>
                                        <button
                                            className="button"
                                            onClick={() =>
                                                run(
                                                    'Opening reference artifact',
                                                    loadDemo,
                                                )
                                            }
                                        >
                                            Explore payment demo
                                            <ArrowRight size={15} />
                                        </button>
                                    </div>
                                }
                            >
                                Inspect actual outputs, transaction choices, and
                                covenant assumptions from a validated Sapio
                                artifact.
                            </EmptyState>
                        )}
                    </div>
                    <div
                        id="panel-spend"
                        role="tabpanel"
                        aria-labelledby="tab-spend"
                        hidden={tab !== 'spend'}
                        className="spend-panel"
                    >
                        <SpendPanel
                            key={artifact?.revision ?? 0}
                            artifact={artifact?.text ?? null}
                            api={api}
                        />
                    </div>
                </main>
                <footer className="workspace-footer">
                    <span>
                        <i />
                        {tab === 'patch'
                            ? 'Visual module composition'
                            : tab === 'inspect'
                              ? 'Artifact inspection'
                              : 'Selected spend completion'}
                    </span>
                    <span>
                        {artifact
                            ? `${artifact.explanation.artifact.nodes.length} output occurrences`
                            : 'No artifact loaded'}
                        <span className="footer-divider">/</span>
                        {api ? 'Local execution' : 'Explore without a node'}
                    </span>
                </footer>
            </div>
            {modal === 'settings' && (
                <Dialog title="Studio settings" onClose={closeModal}>
                    <SettingsPanel
                        api={api}
                        onSaved={(config, status) => {
                            setSettings(config);
                            setCli(status);
                            if (status.available)
                                run('Refreshing modules', refresh);
                        }}
                    />
                </Dialog>
            )}
            {modal === 'context' && (
                <Dialog title="Compilation context" onClose={closeModal}>
                    <ContextEditor
                        value={context}
                        onSave={(value) => {
                            setContext(value);
                            setModal(null);
                        }}
                    />
                </Dialog>
            )}
            {modal === 'module' && selectedModule && (
                <Dialog title="Module authoring" wide onClose={closeModal}>
                    <ModuleAuthoring
                        key={selectedModule.key}
                        module={selectedModule}
                        context={context}
                        api={api}
                        onInspect={inspect}
                    />
                </Dialog>
            )}
            {modal === 'result' && result && (
                <Dialog title="Module result" wide onClose={closeModal}>
                    <h2>{result.name}</h2>
                    <pre className="result-json">{result.text}</pre>
                    <div className="button-row">
                        <button
                            className="button primary"
                            disabled={!canRun || Boolean(busy)}
                            onClick={() =>
                                run('Validating contract result', async () =>
                                    inspect(result.text, result.name),
                                )
                            }
                        >
                            Inspect as contract
                            <ArrowRight size={15} />
                        </button>
                        <button
                            className="button"
                            disabled={!api}
                            onClick={() =>
                                run('Exporting module result', async () => {
                                    await api?.documents.save({
                                        name: `${result.name}.json`,
                                        text: result.text,
                                        kind: 'json',
                                    });
                                })
                            }
                        >
                            <FileDown size={15} />
                            Export JSON
                        </button>
                    </div>
                    <p className="help-text">
                        Module results may be any JSON value. Contract
                        inspection validates the result as a compiled Sapio
                        artifact.
                    </p>
                    {error && <pre className="error-message">{error}</pre>}
                </Dialog>
            )}
            {modal === 'binding' && artifact && (
                <Dialog title="Bind artifact preview" onClose={closeModal}>
                    <h2>Bind a contract occurrence</h2>
                    <p className="muted">
                        Export the Studio program format with linked PSBT
                        previews. This does not sign or broadcast a transaction.
                    </p>
                    <label>
                        Funding source
                        <select
                            disabled={Boolean(busy)}
                            value={bindingMode}
                            onChange={(event) =>
                                setBindingMode(
                                    event.target.value as typeof bindingMode,
                                )
                            }
                        >
                            <option value="mock">
                                Synthetic preview funding
                            </option>
                            <option value="outpoint">Explicit outpoint</option>
                            <option value="psbt">Funding PSBT</option>
                        </select>
                    </label>
                    {bindingMode === 'mock' && (
                        <p className="notice">
                            Synthetic funding is for graph previews. It does not
                            provide spendable coins.
                        </p>
                    )}
                    {bindingMode === 'outpoint' && (
                        <label>
                            Funding outpoint
                            <input
                                disabled={Boolean(busy)}
                                value={outpoint}
                                onChange={(event) =>
                                    setOutpoint(event.target.value)
                                }
                                placeholder="transaction-id:output-index"
                            />
                        </label>
                    )}
                    {bindingMode === 'psbt' && (
                        <DocumentField
                            label="Funding PSBT"
                            kind="psbt"
                            value={bindingPsbt}
                            disabled={Boolean(busy)}
                            onChange={setBindingPsbt}
                            api={api}
                        />
                    )}
                    <button
                        className="button primary"
                        disabled={!canRun || Boolean(busy)}
                        onClick={() =>
                            run('Binding artifact', async () => {
                                if (!api) return;
                                const text = await api.bind({
                                    artifact: artifact.text,
                                    funding:
                                        bindingMode === 'mock'
                                            ? { kind: 'mock' }
                                            : bindingMode === 'outpoint'
                                              ? { kind: 'outpoint', outpoint }
                                              : {
                                                    kind: 'psbt',
                                                    psbt: bindingPsbt,
                                                },
                                });
                                await api.documents.save({
                                    name: 'bound-program.json',
                                    text,
                                    kind: 'json',
                                });
                                setModal(null);
                            })
                        }
                    >
                        Bind & export
                        <FileDown size={15} />
                    </button>
                    {error && (
                        <pre className="error-message" role="alert">
                            {error}
                        </pre>
                    )}
                </Dialog>
            )}
        </div>
    );
}

export default App;
