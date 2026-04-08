import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 30000, // Mantém dados por 30s antes de considerar "velho" e re-baixar
		},
	},
});