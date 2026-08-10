import { useState } from "react";
import { Browser } from "./components/Browser";
import { Planner } from "./components/Planner";
import "./App.css";

type View = "browse" | "planner";

function App() {
  const [view, setView] = useState<View>("browse");

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
        </nav>
      </header>

      {view === "browse" ? <Browser /> : <Planner />}
    </>
  );
}

export default App;
