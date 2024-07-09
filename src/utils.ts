import { allowedOrigins } from './consts';

export function getAllowedOrigin(origin: string | null): string {
    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }
    return '';
}
