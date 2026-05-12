import { ReactNode } from 'react';
export function DetailDrawer({title,children}:{title:string;children:ReactNode}){return <div className='border rounded-xl bg-white p-4'><h3 className='font-semibold mb-2'>{title}</h3>{children}</div>}
