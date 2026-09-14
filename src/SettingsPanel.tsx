import { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, Save } from 'lucide-react';
import type { CliStatus, StudioAPI, StudioSettings } from '../shared/studio';
import { Spinner, errorMessage } from './ui';

export function SettingsPanel({
    api,
    onSaved,
}: {
    api?: StudioAPI;
    onSaved: (settings: StudioSettings, status: CliStatus) => void;
}) {
    const [settings, setSettings] = useState<StudioSettings>({
        cliPath: 'sapio-cli',
        workspace: '',
        runtimeConfig: '',
    });
    const [status, setStatus] = useState<CliStatus | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (api)
            api.settings
                .load()
                .then(setSettings)
                .catch((error) => setError(errorMessage(error)));
    }, [api]);
    async function save() {
        if (!api) return;
        setBusy(true);
        setError('');
        try {
            const saved = await api.settings.save(settings);
            const current = await api.settings.status();
            setSettings(saved);
            setStatus(current);
            onSaved(saved, current);
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }
    async function select(
        kind: 'cli' | 'workspace' | 'runtime-config',
        field: keyof StudioSettings,
    ) {
        try {
            const path = await api?.settings.selectPath(kind);
            if (path) setSettings({ ...settings, [field]: path });
        } catch (error) {
            setError(errorMessage(error));
        }
    }
    return (
        <div className="settings-panel">
            <div className="section-overline">Studio setup</div>
            <h2>Connect your tools</h2>
            <p className="muted">
                Point Studio at a current Sapio CLI and a workspace for cached
                modules. Contract authoring and inspection work without a
                Bitcoin node.
            </p>
            <label>
                Sapio CLI
                <div className="path-input">
                    <input
                        disabled={busy}
                        value={settings.cliPath}
                        onChange={(event) =>
                            setSettings({
                                ...settings,
                                cliPath: event.target.value,
                            })
                        }
                        placeholder="sapio-cli"
                    />
                    <button
                        className="button"
                        onClick={() => select('cli', 'cliPath')}
                        disabled={!api || busy}
                        aria-label="Choose Sapio CLI"
                    >
                        <FolderOpen size={16} />
                    </button>
                </div>
                <small>
                    Executable path, or sapio-cli when available on PATH.
                </small>
            </label>
            <label>
                Workspace
                <div className="path-input">
                    <input
                        disabled={busy}
                        value={settings.workspace}
                        onChange={(event) =>
                            setSettings({
                                ...settings,
                                workspace: event.target.value,
                            })
                        }
                        placeholder="Choose a workspace"
                    />
                    <button
                        className="button"
                        onClick={() => select('workspace', 'workspace')}
                        disabled={!api || busy}
                        aria-label="Choose workspace"
                    >
                        <FolderOpen size={16} />
                    </button>
                </div>
                <small>Loaded WASM modules are cached here.</small>
            </label>
            <details>
                <summary>Binding configuration</summary>
                <label>
                    Optional runtime config
                    <div className="path-input">
                        <input
                            disabled={busy}
                            value={settings.runtimeConfig}
                            onChange={(event) =>
                                setSettings({
                                    ...settings,
                                    runtimeConfig: event.target.value,
                                })
                            }
                            placeholder="Optional JSON configuration"
                        />
                        <button
                            className="button"
                            onClick={() =>
                                select('runtime-config', 'runtimeConfig')
                            }
                            disabled={!api || busy}
                            aria-label="Choose runtime configuration"
                        >
                            <FolderOpen size={16} />
                        </button>
                    </div>
                    <small>
                        Used for explicit binding operations. Local module and
                        spend commands do not read this file.
                    </small>
                </label>
            </details>
            <div className="button-row">
                <button
                    className="button primary"
                    disabled={!api || busy}
                    onClick={save}
                >
                    <Save size={15} />
                    Save & check CLI
                </button>
                {busy && <Spinner label="Checking CLI" />}
                {api && (
                    <button
                        className="button subtle"
                        disabled={busy}
                        onClick={() => {
                            api.settings
                                .status()
                                .then(setStatus)
                                .catch((error) =>
                                    setError(errorMessage(error)),
                                );
                        }}
                    >
                        <RefreshCw size={14} />
                        Check
                    </button>
                )}
            </div>
            {!api && (
                <p className="notice">
                    This browser preview is read-only. Open the desktop app to
                    configure Sapio and run modules.
                </p>
            )}
            {status && (
                <div
                    className={
                        status.available ? 'success-message' : 'error-message'
                    }
                    role="status"
                >
                    {status.available
                        ? status.version
                        : status.error || 'The Sapio CLI is not available.'}
                </div>
            )}
            {error && (
                <p className="error-message" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
