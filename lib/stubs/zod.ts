export const z = { string: () => ({ min: () => ({ default: () => ({}) }) }), enum: <T extends readonly string[]>(v:T)=>({}), object: <T>(_:T)=>({ parse:(input:any)=>input }) } as any;
