import { useRef, useState } from "react";
import { Browser } from "./components/Browser";
import { Planner } from "./components/Planner";
import { UpgradePlanner } from "./components/UpgradePlanner";
import { downloadBackup, importData } from "./lib/backup";
import "./App.css";

type View = "browse" | "planner" | "upgrades";

function App() {
  const [view, setView] = useState<View>("browse");
  const fileRef = useRef<HTMLInputElement>(null);

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
        </nav>
        <div className="datactl">
          <button className="datactl__btn" onClick={downloadBackup} title="Download a save file">
            Export
          </button>
          <button
            className="datactl__btn"
            onClick={() => fileRef.current?.click()}
            title="Load a save file"
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
        </div>
      </header>

      {view === "browse" && <Browser />}
      {view === "planner" && <Planner />}
      {view === "upgrades" && <UpgradePlanner />}
    </>
  );
}

export default App;
