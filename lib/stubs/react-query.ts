export class QueryClient {}
export function QueryClientProvider(props:any){return props.children;}
export function useQuery(){return {data:null,isLoading:false};}
