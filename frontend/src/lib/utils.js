export const deepClone = (x) => JSON.parse(JSON.stringify(x));
export const genId = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 8)}`;
