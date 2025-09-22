const DEFAULT_STATE = {
  accessToken: null,
  membershipId: null,
  membershipType: null,
  characters: [],
  selectedCharacterId: null,
  statView: 'base',
  filters: {},
};

/**
 * Create a simple observable state container for the beta experience. The
 * store keeps track of the Bungie OAuth token, selected membership, active
 * character, and display preferences (e.g. Base vs Current stats).
 */
export function createState(initialState = {}) {
  let state = { ...DEFAULT_STATE, ...initialState };
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[D2AA][state] listener error', err);
      }
    }
  }

  function setState(patch) {
    const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
    state = { ...state, ...next };
    notify();
    return state;
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
