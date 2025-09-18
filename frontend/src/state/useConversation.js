import { useReducer, useMemo } from 'react';

const deepCopy = (x) => JSON.parse(JSON.stringify(x));
const genId = (p='id') => `${p}_${Math.random().toString(36).slice(2,8)}`;

// --------- strong defaults (invariant shape) ----------
const DEFAULT_RESUME = {
  contact: { firstName:"", lastName:"", email:"", phone:"", links:[] },
  summary: "",
  skills: [],
  sections: [
    {
      id: "sec_experience",
      name: "Experience",
      fields: ["title","company","location","dates"],
      items: [
        { id:"itm_exp_1", fields:{ title:"", company:"", location:"", dates:"" }, bullets: [] }
      ]
    },
    {
      id: "sec_education",
      name: "Education",
      fields: ["school","degree","location","date"],
      items: [
        { id:"itm_edu_1", fields:{ school:"", degree:"", location:"", date:"" }, bullets: [] }
      ]
    }
  ],
  meta: { format:"resume-v2", version:2, locale:"en-US" }
};

const DEFAULT_DOC = { resume: DEFAULT_RESUME };

const DEFAULT_CONV = {
  resume: DEFAULT_DOC,     // NOTE: In this app, "resume" in state is actually the *document* with top-level "resume"
  states: [],
  activeStateId: null,
  autosaveStateId: null,
  userTurns: [],
  step: 0
};

// Shallow-with-keyed-nesting merge for our shape.
// - preserves nested "resume.contact" and "resume.meta"
// - fully replaces "skills/sections/summary" if provided.
function mergeDoc(baseDoc, incomingDoc) {
  const base = baseDoc ?? DEFAULT_DOC;
  const inc  = incomingDoc ?? {};
  const incRes = inc.resume ?? {};

  return {
    ...base,
    ...inc,
    resume: {
      ...base.resume,
      ...incRes,
      contact: { ...(base.resume?.contact ?? DEFAULT_RESUME.contact), ...(incRes.contact ?? {}) },
      meta: { ...(base.resume?.meta ?? DEFAULT_RESUME.meta), ...(incRes.meta ?? {}) }
      // skills/sections/summary: if supplied in incRes, they replace; otherwise keep base
    }
  };
}

// ---- initial data (kept for clarity, but wired to strong defaults) ----
function initialResumeDoc() {
  // Produce a deep copy of DEFAULT_DOC to avoid accidental mutations.
  return deepCopy(DEFAULT_DOC);
}

function makeConvFromResumeDoc(doc) {
  const docSafe = mergeDoc(DEFAULT_DOC, doc);
  const snap = {
    stateId: "st_init",
    parentStateId: null,
    createdAt: new Date().toISOString(),
    snapshotJson: deepCopy(docSafe)
  };
  return {
    resume: deepCopy(docSafe),  // state.resume is the *document*
    states: [snap],
    activeStateId: snap.stateId,
    autosaveStateId: snap.stateId,
    userTurns: [],
    step: 0
  };
}

// Normalize anything coming from server into a full conversation state
function normalizeToConv(payload) {
  if (!payload) return makeConvFromResumeDoc(initialResumeDoc());

  // If it's already a full conv state, ensure doc invariants then return
  if (payload && Array.isArray(payload.states) && typeof payload.step === 'number') {
    const fixed = deepCopy(payload);
    fixed.resume = mergeDoc(DEFAULT_DOC, fixed.resume);
    return fixed;
  }

  // If it's a bare resume doc (has resume, no states), wrap it
  if (payload && payload.resume && !payload.states) {
    return makeConvFromResumeDoc(payload);
  }

  // Last resort: treat as a doc-shaped thing
  return makeConvFromResumeDoc(payload);
}

function initialConv() {
  return makeConvFromResumeDoc(initialResumeDoc());
}

// ---- reducer ----
function reducer(state, action) {
  switch (action.type) {
    case 'ADVANCE_NOOP':
      return { ...state, step: state.step + 1 };

    case 'SUBMIT': {
      const { resumeAfter, changes, patchOps, widgets, inputs } = action.payload;

      // Ensure we never drop the doc root; merge on top of strong defaults.
      const nextDoc = mergeDoc(DEFAULT_DOC, resumeAfter ?? state?.resume ?? DEFAULT_DOC);

      const newState = {
        stateId: genId('st'),
        parentStateId: state.activeStateId,
        createdAt: new Date().toISOString(),
        snapshotJson: deepCopy(nextDoc)
      };

      return {
        ...state,
        resume: nextDoc,
        states: [...state.states, newState],
        activeStateId: newState.stateId,
        autosaveStateId: newState.stateId,
        userTurns: [
          ...state.userTurns,
          {
            id: genId('t'),
            step: state.step,
            widgets: widgets.slice(),
            inputs: deepCopy(inputs),
            patchSet: {
              id: genId('ps'),
              author: 'user',
              source: 'ui',
              status: 'applied',
              createdAt: new Date().toISOString(),
              changes,
              patchOps: patchOps || []
            }
          }
        ],
        step: state.step + 1
      };
    }

    case 'UNDO': {
      if (state.states.length <= 1) return state;
      const states = state.states.slice(0, -1);
      // Resume to the previous snapshot, but keep invariants intact
      const lastSnapDoc = mergeDoc(DEFAULT_DOC, deepCopy(states[states.length - 1].snapshotJson));
      const userTurns = state.userTurns.slice(0, -1);
      const activeId = states[states.length - 1].stateId;
      return {
        ...state,
        resume: lastSnapDoc,
        states,
        userTurns,
        step: Math.max(state.step - 1, 0),
        activeStateId: activeId,
        autosaveStateId: activeId
      };
    }

    case 'RESET_ALL': {
      // replace entire conversation with a normalized payload
      const normalized = normalizeToConv(action.payload);
      // harden invariants on the doc
      normalized.resume = mergeDoc(DEFAULT_DOC, normalized.resume);
      return deepCopy(normalized);
    }

    default:
      return state;
  }
}

// ---- public hook ----
export function useConversation(initialPayload) {
  const [state, dispatch] = useReducer(
    reducer,
    initialPayload || null,
    (payload) => payload ? normalizeToConv(payload) : initialConv()
  );

  const api = useMemo(() => ({
    // current live objects (NOTE: state.resume is the *document*)
    resume: state.resume,
    states: state.states,
    activeStateId: state.activeStateId,
    autosaveStateId: state.autosaveStateId,
    userTurns: state.userTurns,
    step: state.step,

    // actions
    advanceNoop: () => dispatch({ type: 'ADVANCE_NOOP' }),

    // Accepts resumeAfter + patchOps (computed in ChatPanel via applyChanges)
    submitStep: (changes, widgets, inputs, resumeAfter, patchOps) => {
      dispatch({
        type: 'SUBMIT',
        payload: { changes, patchOps: patchOps || [], widgets, inputs, resumeAfter }
      });
    },

    undo: () => dispatch({ type: 'UNDO' }),

    // server integration helpers
    resetTo: (payload) => dispatch({ type: 'RESET_ALL', payload: normalizeToConv(payload) }),
    snapshot: () => deepCopy(state),

  }), [state]);

  return api;
}
