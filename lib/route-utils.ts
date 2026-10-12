export function cleaningDue(last: string | null, days = 14): boolean { if (!last) return true; return (Date.now() - new Date(last).getTime()) >= days * 86400000; }
export function wazeUrl(address: string): string { return `https://www.waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`; }
