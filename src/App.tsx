import { useRef, useState } from "react";
import { Browser } from "./components/Browser";
import { Planner } from "./components/Planner";
import { UpgradePlanner } from "./components/UpgradePlanner";
import { BuildQueue } from "./components/BuildQueue";
import { downloadBackup, importData } from "./lib/backup";
import { parseSaveExport } from "./lib/saveImport";
import { useOwned } from "./hooks/useOwned";
import "./App.css";

type View = "browse" | "planner" | "upgrades" | "build";

function App() {
  const [view, setView] = useState<View>("browse");
  const fileRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLInputElement>(null);
  const { importInstances } = useOwned();

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

  function handleSaveImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { instances, matched, skipped } = parseSaveExport(String(reader.result));
        if (matched === 0) {
          window.alert("No pals in that export matched a known species.");
          return;
        }
        const ok = window.confirm(
          `Import ${matched} pals from your save? This replaces your current ` +
            `obtained list (wishlist is kept).`,
        );
        if (!ok) return;
        importInstances(instances);
        const note = skipped.length
          ? `\n${skipped.length} entries skipped (caught humans / unknown).`
          : "";
        window.alert(`Imported ${matched} pals.${note}`);
      } catch (err) {
        window.alert(`Import failed: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
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
            title="Populate obtained pals from a Palworld save export (scripts/extract-pals.py)"
          >
            Import Pals
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
            accept="application/json,.json"
            hidden
            onChange={handleSaveImport}
          />
        </div>
      </header>

      {view === "browse" && <Browser />}
      {view === "planner" && <Planner />}
      {view === "upgrades" && <UpgradePlanner />}
      {view === "build" && <BuildQueue />}
    </>
  );
}

export default App;
