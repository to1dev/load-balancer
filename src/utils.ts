export function strim(str: string): string {
    return str.replace(/[^\w.]/g, '');
}
