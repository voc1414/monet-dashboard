/**
 * Store master tRPC router
 * Provides store list from DB with hardcoded fallback
 */
import { publicProcedure, router } from "../_core/trpc";
import { getAllStores, getStoresGroupedByArea } from "../db";

// Hardcoded fallback (used when DB is empty or unavailable)
const FALLBACK_AREA_STORES = [
  { area: "大阪エリア", stores: ["堀江院", "堀江院2nd", "福島院", "高槻院"] },
  { area: "福岡エリア", stores: ["姪浜院"] },
  { area: "広島エリア", stores: ["楽々園院"] },
];

export const storesRouter = router({
  /** Get all active stores as a flat list with full mapping data */
  list: publicProcedure.query(async () => {
    const dbStores = await getAllStores();
    if (dbStores.length > 0) {
      return dbStores.map(s => ({
        id: s.id,
        name: s.name,
        area: s.area,
        displayOrder: s.displayOrder,
        salonBoardSheetName: s.salonBoardSheetName,
        npsAlias: s.npsAlias,
        reportAliases: s.reportAliases,
        fankuruAliases: s.fankuruAliases,
        knownSince: s.knownSince,
        isAutoDetected: s.isAutoDetected === 1,
        rawNameVariants: s.rawNameVariants,
      }));
    }
    // Fallback: return hardcoded stores
    let id = 1;
    return FALLBACK_AREA_STORES.flatMap(g =>
      g.stores.map((name, idx) => ({
        id: id++,
        name,
        area: g.area,
        displayOrder: idx + 1,
        salonBoardSheetName: null as string | null,
        npsAlias: name,
        reportAliases: name,
        fankuruAliases: name,
        knownSince: "2020-01-01",
        isAutoDetected: false,
        rawNameVariants: name,
      }))
    );
  }),

  /** Get stores grouped by area (for dashboard display) */
  grouped: publicProcedure.query(async () => {
    const dbGrouped = await getStoresGroupedByArea();
    if (dbGrouped.length > 0) {
      return dbGrouped.map(g => ({
        area: g.area,
        stores: g.stores.map(s => s.name),
      }));
    }
    // Fallback
    return FALLBACK_AREA_STORES;
  }),
});
