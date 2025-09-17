import React, { useEffect, useState } from "react";

export default function DevFooter() {
  const [open, setOpen] = useState(false);
  const [ping, setPing] = useState("pending");

  useEffect(() => {
    let gone = false;
    fetch("/api/ping")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(() => !gone && setPing("ok"))
      .catch(() => !gone && setPing("fail"));
    return () => { gone = true; };
  }, []);

  return (
    <>
      <div className="devfooter">
        <button className="devbadge" onClick={() => setOpen((v) => !v)} title="Toggle dev panel">
          <strong>DEV</strong>
          <span style={{ fontSize: 12, opacity: 0.75 }}>api:{ping}</span>
        </button>
      </div>

      {open && (
        <div className="devpanel">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Developer Panel</div>
          <div><b>Build:</b> {new Date(document.lastModified).toLocaleString()}</div>
          <div><b>API /api/ping:</b> {ping}</div>
        </div>
      )}
    </>
  );
}
