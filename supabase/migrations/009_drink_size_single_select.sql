-- Enforce single selection for Drink Size modifier group
UPDATE modifier_groups SET max_selection = 1 WHERE name = 'Drink Size';
