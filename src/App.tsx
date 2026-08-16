import { useRef, useState } from "react";
import { Browser } from "./components/Browser";
import { Planner } from "./components/Planner";
import { Palbox } from "./components/Palbox";
import { Breeding } from "./components/Breeding";
import { UpgradePlanner } from "./components/UpgradePlanner";
import { BuildQueue } from "./components/BuildQueue";
import { downloadBackup, importData } from "./lib/backup";
import {
  readSaveFile,
  readXboxSaves,
  importXboxSave,
  type XboxSaveOption,
} from "./lib/saveImport";
import type { ImportSummary } from "./lib/saveImport";
import { XboxSavePicker } from "./components/XboxSavePicker";
import { useOwned } from "./hooks/useOwned";
import { useLoadouts } from "./hooks/useLoadouts";
import "./App.css";

type View = "browse" | "planner" | "palbox" | "breeding" | "upgrades" | "build";

function App() {
  const [view, setView] = useState<View>("browse");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLInputElement>(null);
  const xboxRef = useRef<HTMLInputElement>(null);
  const [xbox, setXbox] = useState<{ files: File[]; options: XboxSaveOption[] } | null>(null);
  const { importInstances } = useOwned();
  const { importLoadouts } = useLoadouts();

  /** Shared confirm + apply for any parsed save (Steam or Xbox). */
  function commitImport({ instances, matched, skipped }: ImportSummary): boolean {
    if (matched === 0) {
      window.alert("No pals in that save matched a known species.");
      return false;
    }
    const withSkills = instances.filter(
      (p) => p.abilities?.length || p.passives?.length,
    ).length;
    const ok = window.confirm(
      `Import ${matched} pals from your save? Active & passive skills come ` +
        `across too. This replaces your current obtained list and their ` +
        `loadouts (wishlist is kept).`,
    );
    if (!ok) return false;
    const created = importInstances(instances);
    importLoadouts(
      created.map((inst, i) => {
        const moves = instances[i]?.abilities ?? [];
        return {
          id: inst.id,
          learned: moves,
          equipped: moves,
          passives: instances[i]?.passives ?? [],
        };
      }),
    );
    const parts = [`Imported ${matched} pals`];
    if (withSkills) parts.push(`${withSkills} with skills pre-filled`);
    const note = skipped.length
      ? `\n${skipped.length} entries skipped (caught humans / unknown).`
      : "";
    window.alert(`${parts.join(", ")}.${note}`);
    return true;
  }

  async function handleXboxFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setImporting(true);
    try {
      const options = await readXboxSaves(files);
      // One world → import straight away; several → let them choose.
      if (options.length === 1) {
        commitImport(await importXboxSave(files, options[0]));
      } else {
        setXbox({ files, options });
      }
    } catch (err) {
      window.alert(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  async function chooseXboxSave(option: XboxSaveOption) {
    if (!xbox) return;
    const files = xbox.files;
    setXbox(null);
    setImporting(true);
    try {
      commitImport(await importXboxSave(files, option));
    } catch (err) {
      window.alert(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(String(reader.result));
        window.location.reload();
      } catch (err) {
        window.alert(`Import failed: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  async function handleSaveImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      commitImport(await readSaveFile(file));
    } catch (err) {
      window.alert(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <h1 className="topbar__title">
          Pal<span>world</span> Companion
        </h1>
        <nav className="tabs">
          <button
            className={`tab ${view === "browse" ? "is-active" : ""}`}
            onClick={() => setView("browse")}
          >
            Browse
          </button>
          <button
            className={`tab ${view === "planner" ? "is-active" : ""}`}
            onClick={() => setView("planner")}
          >
            Planner
          </button>
          <button
            className={`tab ${view === "palbox" ? "is-active" : ""}`}
            onClick={() => setView("palbox")}
          >
            Palbox
          </button>
          <button
            className={`tab ${view === "breeding" ? "is-active" : ""}`}
            onClick={() => setView("breeding")}
          >
            Breeding
          </button>
          <button
            className={`tab ${view === "upgrades" ? "is-active" : ""}`}
            onClick={() => setView("upgrades")}
          >
            Upgrades
          </button>
          <button
            className={`tab ${view === "build" ? "is-active" : ""}`}
            onClick={() => setView("build")}
          >
            Build
          </button>
        </nav>
        <div className="datactl">
          <button
            className="datactl__btn datactl__btn--accent"
            onClick={() => saveRef.current?.click()}
            disabled={importing}
            title="Steam: pick your Level.sav (parsed in your browser)"
          >
            {importing ? "Reading save…" : "Import Pals"}
          </button>
          <button
            className="datactl__btn"
            onClick={() => xboxRef.current?.click()}
            disabled={importing}
            title="Xbox / Game Pass: pick your 'wgs' save folder (parsed in your browser)"
          >
            Import Xbox
          </button>
          <button className="datactl__btn" onClick={downloadBackup} title="Download a companion backup">
            Export
          </button>
          <button
            className="datactl__btn"
            onClick={() => fileRef.current?.click()}
            title="Load a companion backup"
          >
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImport}
          />
          <input
            ref={saveRef}
            type="file"
            accept=".sav,application/json,.json"
            hidden
            onChange={handleSaveImport}
          />
          <input
            ref={xboxRef}
            type="file"
            hidden
            // Xbox saves are a folder of files; let the user pick the directory.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={handleXboxFolder}
          />
        </div>
      </header>

      {view === "browse" && <Browser />}
      {view === "planner" && <Planner />}
      {view === "palbox" && <Palbox />}
      {view === "breeding" && <Breeding />}
      {view === "upgrades" && <UpgradePlanner />}
      {view === "build" && <BuildQueue />}

      {xbox && (
        <XboxSavePicker
          options={xbox.options}
          onPick={chooseXboxSave}
          onClose={() => setXbox(null)}
        />
      )}
    </>
  );
}

export default App;
