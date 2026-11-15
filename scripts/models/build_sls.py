# SLS Block 1 (NASA 3D Resources .blend, 3.3 million polygons) -> light GLB split into stages.
import sys
import os
import bpy
sys.path.append(os.path.dirname(__file__))
from rocket_common import flat_material, lathe, join_two, world_box, mesh_descendants, join_objects, decimate, duplicate, cut, export

out = sys.argv[sys.argv.index('--') + 1]

# part name -> (root objects, smallest object to keep in metres, triangles after simplifying)
PARTS = {
    'core': (['Dummy_Core', 'Dummy_Engs', 'LVSA002'], 0.7, 52000),
    'boosterR': (['Dummy_SRB0'], 0.9, 15000),
    'boosterL': (['Dummy_SRB_'], 0.9, 15000),
    'upper': (['Dummy_ICPS', 'ICPS_2015_', 'Dummy_MPCV'], 0.5, 9000),
    'top': (['Dummy_ESM_', 'Dummy146', 'Dummy_NewS'], 0.5, 16000),
}

built = {}
for name, (roots, smallest, target) in PARTS.items():
    objects = []
    for root_name in roots:
        objects.extend(mesh_descendants(bpy.data.objects[root_name]))
    big = []
    for o in objects:
        size, middle = world_box(o)
        if size < smallest:
            continue
        if name.startswith('booster'):
            # A few stray helper objects sit far away from the booster: leave them out.
            side = 6.2 if name == 'boosterR' else -6.2
            if abs(middle.x - side) > 3.5 or abs(middle.y) > 3.5:
                continue
        big.append(o)
    print(name, 'objects', len(objects), 'kept', len(big))
    part = join_objects(big, name)
    decimate(part, target)
    built[name] = part

# The NASA file has every detail but not the big plain bodies: the orange tank and the booster casings.
# They are simple bodies of revolution, added here with the real sizes (tank 8.4 m wide, booster 3.7 m wide).
foam = flat_material('tank_foam', (0.78, 0.36, 0.1), 0.75)
white = flat_material('booster_white', (0.93, 0.93, 0.91), 0.45)
dark = flat_material('booster_dark', (0.07, 0.07, 0.08), 0.6)
tank = lathe('tank', [(4.2, 5.2), (4.2, 64.2)], foam)
built['core'] = join_two(built['core'], tank)
for name, side in (('boosterR', 6.2), ('boosterL', -6.2)):
    casing = lathe(name + '_casing', [(2.65, 2.2), (1.86, 5.6), (1.86, 46.2), (1.5, 49.6), (0.75, 52.2), (0.25, 53.0)], white, center=(side, 0))
    nozzle = lathe(name + '_nozzle', [(1.75, 0.6), (0.95, 2.6)], dark, center=(side, 0))
    bands = [lathe(name + '_band' + str(i), [(1.885, h), (1.885, h + 0.35)], dark, center=(side, 0)) for i, h in enumerate((14.0, 24.5, 35.0, 45.6))]
    part = built[name]
    for extra in [casing, nozzle] + bands:
        part = join_two(part, extra)
    built[name] = part

# The upper stage body (a plain tank) and the body of the escape tower are missing too.
upper_body = lathe('upper_body', [(0.5, 66.6), (1.7, 66.9), (2.35, 67.5), (2.55, 68.3), (2.55, 75.4)], white)
built['upper'] = join_two(built['upper'], upper_body)
tower = lathe('tower_body', [(0.95, 85.3), (0.46, 86.8), (0.46, 93.4), (0.12, 95.3)], white, segments=24)
built['top'] = join_two(built['top'], tower)

# The top (launch abort tower, shroud over the capsule, service module panels) splits in two halves,
# like the nose cone of a cargo rocket.
top = built.pop('top')
half_plus = duplicate(top, 'fairingR')
half_minus = duplicate(top, 'fairingL')
cut(half_plus, (0, 0, 0), (1, 0, 0), False)
cut(half_minus, (0, 0, 0), (-1, 0, 0), False)
bpy.data.objects.remove(top, do_unlink=True)

parts = list(built.values()) + [half_plus, half_minus]
export(parts, out)
