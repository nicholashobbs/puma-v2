import React, { useMemo } from "react";

export default function ResumePanel({ resume }) {
  const pretty = useMemo(() => JSON.stringify(resume, null, 2), [resume]);
  return (
    <>
      <div className="rtitle">Live Resume JSON</div>
      <pre className="json">{pretty}</pre>
    </>
  );
}
