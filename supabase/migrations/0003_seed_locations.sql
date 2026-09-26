-- Starting storage spots. Rename, add or remove them from the store app.
insert into locations (name, kind, catalog, sort_order) values
  ('Industrial Fridge 1', 'industrial_fridge', 'warehouse', 10),
  ('Industrial Fridge 2', 'industrial_fridge', 'warehouse', 11),
  ('Warehouse A',         'warehouse_area',    'warehouse', 20),
  ('Warehouse B',         'warehouse_area',    'warehouse', 21),
  ('Front Fridge 1',      'commercial_fridge', 'retail',    30),
  ('Front Fridge 2',      'commercial_fridge', 'retail',    31),
  ('Front Fridge 3',      'commercial_fridge', 'retail',    32),
  ('Front Fridge 4',      'commercial_fridge', 'retail',    33)
on conflict (name) do nothing;
