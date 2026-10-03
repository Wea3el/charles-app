(function () {
  const locations = [
    { id: "ff1", name: "Front Fridge 1", kind: "commercial_fridge", catalog: "retail" },
    { id: "ff2", name: "Front Fridge 2", kind: "commercial_fridge", catalog: "retail" },
    { id: "ff3", name: "Front Fridge 3", kind: "commercial_fridge", catalog: "retail" },
    { id: "ff4", name: "Front Fridge 4", kind: "commercial_fridge", catalog: "retail" },
    { id: "if1", name: "Industrial Fridge 1", kind: "industrial_fridge", catalog: "warehouse" },
    { id: "if2", name: "Industrial Fridge 2", kind: "industrial_fridge", catalog: "warehouse" },
    { id: "wa", name: "Warehouse A", kind: "warehouse_area", catalog: "warehouse" },
    { id: "wb", name: "Warehouse B", kind: "warehouse_area", catalog: "warehouse" },
  ];
  const KIND_LABEL = { commercial_fridge: "Front fridges", industrial_fridge: "Industrial fridges", warehouse_area: "Warehouse" };
  const p = (id, name, brand, category, case_size, cost, wholesale, party, packs) => ({ id, name, brand, category, case_size, cost, wholesale, party, packs });
  const products = [
    p("corona", "Corona Extra 12oz", "Corona", "Beer", 24, 28.5, 32.0, 34.0, [["Single", 2.25, 2.35], ["6 pack", 11.99, 12.49], ["12 pack", 19.99, 20.79]]),
    p("modelo", "Modelo Especial 12oz", "Modelo", "Beer", 24, 29.0, 33.0, 35.0, [["Single", 2.25, 2.35], ["6 pack", 11.99, 12.49]]),
    p("budlight", "Bud Light 12oz", "Bud Light", "Beer", 24, 22.0, 25.5, 27.0, [["Single", 1.75, 1.85], ["12 pack", 15.99, 16.59], ["24 pack", 27.99, 29.09]]),
    p("ultra", "Michelob Ultra 12oz", "Michelob", "Beer", 24, 25.0, 28.5, 30.0, [["Single", 1.99, 2.09], ["6 pack", 10.49, 10.89]]),
    p("heineken", "Heineken 12oz", "Heineken", "Beer", 24, 30.0, 34.0, 36.0, [["Single", 2.35, 2.45], ["6 pack", 12.49, 12.99]]),
    p("claw", "White Claw Black Cherry", "White Claw", "Seltzer", 24, 31.0, 35.0, 37.0, [["Single", 2.49, 2.59], ["4 pack", 8.99, 9.39]]),
    p("topo", "Topo Chico 12oz", "Topo Chico", "Water", 24, 18.0, 21.0, 22.0, [["Single", 1.79, 1.89]]),
    p("redbull", "Red Bull 8.4oz", "Red Bull", "Energy", 24, 36.0, 41.0, 43.0, [["Single", 2.99, 3.09], ["4 pack", 10.99, 11.49]]),
    p("coke", "Coca-Cola 20oz", "Coca-Cola", "Soda", 24, 21.0, 24.0, 25.0, [["Single", 2.29, 2.39]]),
    p("ice", "Ice 10 lb bag", "House", "Ice", 1, 1.1, 2.5, 2.5, [["Single", 3.49, 3.59]]),
  ];
  const stock = [
    ["ff1", "corona", 38], ["ff1", "modelo", 22], ["ff1", "heineken", 14],
    ["ff2", "budlight", 41], ["ff2", "ultra", 9], ["ff2", "corona", 6],
    ["ff3", "claw", 17], ["ff3", "topo", 30], ["ff3", "redbull", 4],
    ["ff4", "coke", 26], ["ff4", "ice", 12],
    ["if1", "corona", 6], ["if1", "modelo", 4], ["if1", "claw", 3],
    ["if2", "budlight", 8], ["if2", "ultra", 5],
    ["wa", "corona", 14], ["wa", "heineken", 6], ["wa", "topo", 1],
    ["wb", "redbull", 0], ["wb", "coke", 9], ["wb", "budlight", 11],
  ].map(([l, pr, q]) => ({ location_id: l, product_id: pr, quantity: q }));

  const lowFront = [
    { product_id: "redbull", on_hand: 4, min: 24, where: "Front Fridge 3", bring: 1, singles: 24, wh: 0 },
    { product_id: "ultra", on_hand: 9, min: 24, where: "Front Fridge 2", bring: 1, singles: 24, wh: 5 },
    { product_id: "heineken", on_hand: 14, min: 24, where: "Front Fridge 1", bring: 1, singles: 24, wh: 6 },
  ];
  const lowWarehouse = [
    { product_id: "redbull", on_hand: 0, min: 4, where: "none in the warehouse", order: 6 },
    { product_id: "topo", on_hand: 1, min: 4, where: "Warehouse A", order: 5 },
    { product_id: "claw", on_hand: 3, min: 6, where: "Industrial Fridge 1", order: 4 },
  ];
  const history = [
    { when: "Today 2:14 PM", who: "Maria", what: "Restocked", item: "Corona Extra 12oz", detail: "2 cases · Warehouse A → Front Fridge 1" },
    { when: "Today 11:02 AM", who: "Charles", what: "Received", item: "Bud Light 12oz", detail: "10 cases into Warehouse B · Inv #4471" },
    { when: "Today 9:30 AM", who: "Maria", what: "Counted", item: "Topo Chico 12oz", detail: "Front Fridge 3 · 32 → 30" },
    { when: "Yesterday 6:48 PM", who: "Luis", what: "Moved", item: "Modelo Especial 12oz", detail: "3 cases · Warehouse A → Industrial Fridge 1" },
  ];

  const byId = new Map(products.map((x) => [x.id, x]));
  const locById = new Map(locations.map((x) => [x.id, x]));
  const unit = (catalog, n) => (catalog === "retail" ? (n === 1 ? "single" : "singles") : n === 1 ? "case" : "cases");
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const matches = (pr, q) => {
    const words = norm(q).split(" ").filter(Boolean);
    if (!words.length) return false;
    const hay = norm(pr.name + " " + (pr.brand || ""));
    return words.every((w) => hay.includes(w));
  };
  const money = (v) => (v == null ? "—" : "$" + Number(v).toFixed(2));

  function spotsFor(pid) {
    return stock
      .filter((s) => s.product_id === pid && s.quantity > 0)
      .map((s) => {
        const l = locById.get(s.location_id);
        return { id: l.id, name: l.name, qty: s.quantity, unit: unit(l.catalog, s.quantity), catalog: l.catalog, label: s.quantity + " " + unit(l.catalog, s.quantity) };
      });
  }
  function totals(pid) {
    const sp = spotsFor(pid);
    const front = sp.filter((s) => s.catalog === "retail").reduce((a, s) => a + s.qty, 0);
    const back = sp.filter((s) => s.catalog === "warehouse").reduce((a, s) => a + s.qty, 0);
    return { front, back, frontLabel: front + " " + unit("retail", front), backLabel: back + " " + unit("warehouse", back) };
  }
  function search(q) {
    if (!q || !q.trim()) return [];
    return products.filter((x) => matches(x, q)).slice(0, 8).map((x) => {
      const spots = spotsFor(x.id);
      return Object.assign({}, x, totals(x.id), { spots, none: spots.length === 0, spotText: spots.map((s) => s.name + " (" + s.label + ")").join(", ") || "none in stock" });
    });
  }
  function locationGroups(q) {
    const hitIds = q && q.trim() ? new Set(products.filter((x) => matches(x, q)).map((x) => x.id)) : null;
    return ["commercial_fridge", "industrial_fridge", "warehouse_area"].map((kind) => {
      const locs = locations.filter((l) => l.kind === kind).map((l) => {
        const rows = stock.filter((s) => s.location_id === l.id && s.quantity > 0);
        const total = rows.reduce((a, s) => a + s.quantity, 0);
        const hits = hitIds ? rows.filter((s) => hitIds.has(s.product_id)) : [];
        const hit = hits.length > 0;
        return {
          id: l.id, name: l.name, catalog: l.catalog,
          summary: rows.length ? rows.length + " item" + (rows.length === 1 ? "" : "s") + " · " + total + " " + unit(l.catalog, total) : "Empty",
          hit, dim: !!hitIds && !hit,
          hitText: hits.map((s) => byId.get(s.product_id).name + ": " + s.quantity).join(" · "),
        };
      });
      const retail = locs[0].catalog === "retail";
      return { kind, label: KIND_LABEL[kind], unitNote: "counted in " + (retail ? "singles" : "cases"), locs };
    });
  }
  function itemsAt(locId) {
    const l = locById.get(locId);
    if (!l) return null;
    const items = stock.filter((s) => s.location_id === locId && s.quantity > 0)
      .map((s) => ({ id: s.product_id, name: byId.get(s.product_id).name, qty: s.quantity }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { id: l.id, name: l.name, unitHead: l.catalog === "retail" ? "Singles" : "Cases", items, empty: items.length === 0 };
  }
  function productRows(q) {
    return products.filter((x) => !q || !q.trim() || matches(x, q)).map((x) => Object.assign({}, x, totals(x.id), {
      sub: [x.brand, x.category].filter(Boolean).join(" · "),
      costT: money(x.cost), wholesaleT: money(x.wholesale), partyT: money(x.party),
      packList: x.packs.map((k) => ({ label: k[0], cash: money(k[1]), card: money(k[2]) })),
      packText: x.packs.map((k) => k[0] + " " + money(k[1]) + " / " + money(k[2])).join(" · "),
    }));
  }
  const withName = (r) => Object.assign({}, r, { name: byId.get(r.product_id).name });
  const low = {
    front: lowFront.map((r) => Object.assign(withName(r), { short: r.wh < r.bring, detail: "Front: " + r.on_hand + " (low at " + r.min + ") · " + r.where })),
    warehouse: lowWarehouse.map((r) => Object.assign(withName(r), { detail: r.on_hand + " cases (low at " + r.min + ") · " + r.where })),
  };
  low.count = low.front.length + low.warehouse.length;

  const TASKS = {
    receive: { id: "receive", label: "Receive", verb: "Receive delivery", help: "A supplier delivery arrived. Add it where you put it.", unit: "cases" },
    restock: { id: "restock", label: "Restock front", verb: "Restock front", help: "Bring cases from the warehouse into a front fridge. Cases turn into singles.", unit: "cases" },
    move: { id: "move", label: "Move", verb: "Move stock", help: "Move stock between two warehouse spots, or between two front fridges.", unit: "units" },
    count: { id: "count", label: "Count", verb: "Count a spot", help: "Counted a spot by hand? Enter the real number and the system will match it.", unit: "units" },
  };
  function spotOptions(filter) {
    return locations.filter((l) => !filter || l.catalog === filter).map((l) => ({ id: l.id, name: l.name, catalog: l.catalog }));
  }

  window.STORE = { locations, products, stock, history, low, TASKS, byId, locById, unit, money, search, locationGroups, itemsAt, productRows, spotsFor, totals, spotOptions, staff: { name: "Maria Lopez", role: "manager" } };
})();
