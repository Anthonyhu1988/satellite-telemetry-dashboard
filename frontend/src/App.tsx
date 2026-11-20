import { useCallback, useState } from 'react';
import type { Telemetry } from '@telemetry/shared';
import { telemetryApi, type TelemetryApi } from './api/telemetryClient';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ErrorBanner } from './components/ErrorBanner';
import { FilterBar } from './components/FilterBar';
import { Pagination } from './components/Pagination';
import { Spinner } from './components/Spinner';
import { SummaryCards } from './components/SummaryCards';
import { TelemetryForm } from './components/TelemetryForm';
import { TelemetryTable } from './components/TelemetryTable';
import { Toast, type ToastMessage } from './components/Toast';
import { useTelemetry } from './hooks/useTelemetry';
import rocketLabLogo from './assets/rocket-lab-logo.svg';

export default function App({ api = telemetryApi }: { api?: TelemetryApi }) {
  const { state, setFilters, toggleSort, setPage, reload, createEntry, removeEntry } =
    useTelemetry(api);
  const [pendingDelete, setPendingDelete] = useState<Telemetry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (text: string, tone: ToastMessage['tone'] = 'success') =>
    setToast({ id: Date.now(), text, tone });
  const dismissToast = useCallback(() => setToast(null), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeEntry(pendingDelete.id);
      notify(`Deleted ${pendingDelete.satelliteId} reading`);
    } catch (err) {
      notify(`Couldn't delete: ${(err as Error).message}`, 'error');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const satellites = state.summary?.satellites ?? [];
  const firstLoad = state.loading && state.items.length === 0 && !state.error;
  // keep showing stale rows if a refresh fails, but don't show "no results" when we never got any
  const showTable = !firstLoad && !(state.error && state.items.length === 0);

  const online = !state.error;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#overview">
          <img className="brand__logo" src={rocketLabLogo} alt="Rocket Lab" />
          <span className="brand__divider" aria-hidden="true" />
          <span className="brand__text">
            Ground<span className="brand__light">Station</span>
          </span>
        </a>
        <nav className="topnav" aria-label="Sections">
          <a href="#overview">Overview</a>
          <a href="#log">Telemetry log</a>
          <a href="#add-telemetry">Add entry</a>
        </nav>
        <div className="topbar__status">
          {state.loading && !firstLoad && <Spinner label="Refreshing" />}
          <span className={`link-status link-status--${online ? 'up' : 'down'}`}>
            {online ? 'API online' : 'API offline'}
          </span>
        </div>
      </header>

      <section className="hero" id="overview">
        <svg className="hero__orbits" viewBox="0 0 1000 1000" aria-hidden="true">
          <circle cx="500" cy="500" r="220" />
          <circle cx="500" cy="500" r="340" />
          <circle cx="500" cy="500" r="470" />
        </svg>
        <div className="hero__inner">
          <div className="hero__heading">
            <p className="eyebrow">Ground segment · Live telemetry</p>
            <h1 className="hero__title">Satellite Telemetry</h1>
            <p className="hero__tagline">Monitor · Filter · Manage</p>
          </div>
          <SummaryCards summary={state.summary} />
        </div>
      </section>

      <div className="app">
        <div className="layout">
          <main className="panel" id="log">
            <h2 className="panel__title">Telemetry log</h2>
            <FilterBar value={state.filters} satellites={satellites} onChange={setFilters} />

            {state.error && <ErrorBanner message={state.error} onRetry={reload} />}

            {firstLoad && <Spinner />}

            {showTable && (
              <>
                <TelemetryTable
                  items={state.items}
                  sort={state.sort}
                  onSort={toggleSort}
                  onDelete={setPendingDelete}
                />
                {state.pagination && (
                  <Pagination pagination={state.pagination} onPageChange={setPage} />
                )}
              </>
            )}
          </main>

          <aside className="panel panel--form" id="add-telemetry">
            <TelemetryForm
              satellites={satellites}
              onSubmit={createEntry}
              onSuccess={(input) => notify(`Added reading for ${input.satelliteId}`)}
            />
          </aside>
        </div>

        {pendingDelete && (
          <ConfirmDialog
            title="Delete this reading?"
            message={`${pendingDelete.satelliteId} at ${new Date(pendingDelete.timestamp).toLocaleString()} will be removed. This can't be undone.`}
            busy={deleting}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}

        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    </>
  );
}
