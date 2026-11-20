// 開発用：画面・音の かわりの からっぽの 部品（どんな メソッドを よんでも 何も しない）
const handler = { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : (k in t ? t[k] : nothing)), apply: () => nothing };
export const nothing = new Proxy(function () {}, handler);
