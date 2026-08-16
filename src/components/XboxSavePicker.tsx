import { useEffect, useState } from "react";
import type { XboxSaveOption } from "../lib/saveImport";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const fmtSize = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * Chooser shown when an Xbox `wgs` folder holds more than one world. Live saves
 * are listed first (newest first); Slot backups are tucked behind a toggle.
 */
export function XboxSavePicker({
  options,
  onPick,
  onClose,
}: {
  options: XboxSaveOption[];
  onPick: (option: XboxSaveOption) => void;
  onClose: () => void;
}) {
  const [showBackups, setShowBackups] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const live = options.filter((o) => !o.isBackup);
  const backups = options.filter((o) => o.isBackup);
  const rows = showBackups ? options : live;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="detail__sub">Which save do you want to import?</h3>
        <p className="coverage__note">
          This Xbox folder has more than one world. The most recent is picked first.
        </p>
        <ul className="picker__list">
          {rows.map((o, i) => (
            <li key={`${o.folder}-${i}`}>
              <button className="xbsave" onClick={() => onPick(o)}>
                <span className="xbsave__main">
                  <strong>
                    {o.isBackup ? `Backup slot ${o.slot}` : "World"}
                    {!o.isBackup && i === 0 && <span className="xbsave__tag">most recent</span>}
                  </strong>
                  <span className="xbsave__meta">
                    Saved {fmtDate(o.modified)} · {fmtSize(o.size)}
                  </span>
                </span>
                <span className="xbsave__go">Import →</span>
              </button>
            </li>
          ))}
        </ul>
        {backups.length > 0 && (
          <button className="bx-linkbtn" onClick={() => setShowBackups((v) => !v)}>
            {showBackups ? "hide backup slots" : `show ${backups.length} backup slots`}
          </button>
        )}
      </div>
    </div>
  );
}
