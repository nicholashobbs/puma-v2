import { useReducer, useMemo } from 'react';

const deepCopy = (x) => JSON.parse(JSON.stringify(x));
const genId = (p='id') => `${p}_${Math.random().toString(36).slice(2,8)}`;

// ---- initial data (must match server structure) ----
function initialResumeDoc() {
  return {
    resume: {
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
    }
  };
}

function makeConvFromResumeDoc(doc) {
  const snap = {
    stateId: "st_init",
    parentStateId: null,
    createdAt: new Date().toISOString(),
    snapshotJson: deepCopy(doc)
  };
  return {
    resume: deepCopy(doc),
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
  // If it's already a full conv state, keep it
  if (payload && Array.isArray(payload.states) && typeof payload.step === 'number') {
    return deepCopy(payload);
  }
  // If it's a bare resume doc (has resume, no states), wrap it
  if (payload && payload.resume && !payload.states) {
    return makeConvFromResumeDoc(payload);
  }
  // Last resort: treat as a resume doc-shaped thing
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
      const newState = {
        stateId: genId('st'),
        parentStateId: state.activeStateId,
        createdAt: new Date().toISOString(),
        snapshotJson: deepCopy(resumeAfter)
      };
      return {
        ...state,
        resume: resumeAfter,
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
              patchOps
            }
          }
        ],
        step: state.step + 1
      };
    }

    case 'UNDO': {
      if (state.states.length <= 1) return state;
      const states = state.states.slice(0, -1);
      const last = deepCopy(states[states.length - 1].snapshotJson);
      const userTurns = state.userTurns.slice(0, -1);
      const activeId = states[states.length - 1].stateId;
      return {
        ...state,
        resume: last,
        states,
        userTurns,
        step: Math.max(state.step - 1, 0),
        activeStateId: activeId,
        autosaveStateId: activeId
      };
    }

    case 'RESET_ALL': {
      // replace entire conversation with a normalized payload
      return deepCopy(action.payload);
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
    // current live objects
    resume: state.resume,
    states: state.states,
    activeStateId: state.activeStateId,
    autosaveStateId: state.autosaveStateId,
    userTurns: state.userTurns,
    step: state.step,

    // actions
    advanceNoop: () => dispatch({ type: 'ADVANCE_NOOP' }),

    // Now accepts resumeAfter + patchOps
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
