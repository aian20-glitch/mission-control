# A NASA rocket GLB (one piece) -> GLB in metres, standing on the origin, cut into stages.
# Usage: blender -b --python build_glb.py -- in.glb out.glb saturn|jupiter
import sys
import os
import bpy
sys.path.append(os.path.dirname(__file__))
from rocket_common import join_objects, duplicate, cut, export

args = sys.argv[sys.argv.index('--') + 1:]
kind = args[2]

# Heights are in the source model's own units, before scaling.
CONFIG = {
    # Saturn V: 110.6 m tall. First stage, second stage, third stage, then the Apollo stack as the "nose cone".
    'saturn': {
        'axis': (-0.01, -0.745),
        'bottom': -0.141,
        'scale': 110.6 / 12.987,
        'stages': [('stage1', -10, 4.85), ('core', 4.85, 8.1), ('upper', 8.1, 10.25)],
        'top': 10.25,
    },
    # Jupiter-C, drawn 1.9 times larger so the player's spacecraft fits under its nose.
    'jupiter': {
        'axis': (-0.129, -0.003),
        'bottom': 1.362,
        'scale': 1.9,
        'stages': [('core', -10, 10.4), ('upper', 10.4, 13.55)],
        'top': 13.55,
    },
}[kind]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args[0])
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
whole = join_objects(meshes, 'whole')

# Stand the rocket on the origin and scale it to metres.
scale = CONFIG['scale']
for vertex in whole.data.vertices:
    vertex.co.x = (vertex.co.x - CONFIG['axis'][0]) * scale
    vertex.co.y = (vertex.co.y - CONFIG['axis'][1]) * scale
    vertex.co.z = (vertex.co.z - CONFIG['bottom']) * scale


def height(z):
    return (z - CONFIG['bottom']) * scale


parts = []
for name, low, high in CONFIG['stages']:
    part = duplicate(whole, name)
    cut(part, (0, 0, height(low)), (0, 0, 1), True)
    cut(part, (0, 0, height(high)), (0, 0, -1), True)
    parts.append(part)

for name, side in (('fairingR', 1), ('fairingL', -1)):
    half = duplicate(whole, name)
    cut(half, (0, 0, height(CONFIG['top'])), (0, 0, 1), False)
    cut(half, (0, 0, 0), (side, 0, 0), False)
    parts.append(half)

bpy.data.objects.remove(whole, do_unlink=True)
export(parts, args[1])
