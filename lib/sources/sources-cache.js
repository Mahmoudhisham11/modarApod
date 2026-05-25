import { fetchInstapayLinesByShop } from "@/lib/instapay/instapay-lines-service";
import { fetchNumbersByShop } from "@/lib/lines/numbers-service";
import { fetchMachinesByShop } from "@/lib/machines/machines-service";

const cacheMap = new Map();

export async function loadSources(shop) {
  const s = shop.trim();
  if (!s) return { telecom: [], instapay: [], machines: [] };
  const existing = cacheMap.get(s);
  if (existing) return existing;
  const promise = Promise.all([
    fetchNumbersByShop(s),
    fetchInstapayLinesByShop(s),
    fetchMachinesByShop(s),
  ]).then(([numbers, instapayLines, machines]) => {
    const data = {
      telecom: numbers,
      instapay: instapayLines,
      machines,
    };
    cacheMap.set(s, data);
    return data;
  }).catch((err) => {
    cacheMap.delete(s);
    throw err;
  });
  cacheMap.set(s, promise);
  return promise;
}

export function invalidateSourcesCache(shop) {
  cacheMap.delete(shop.trim());
}
