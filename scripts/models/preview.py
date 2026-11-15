# Render a quick picture of a GLB, to check shape and colours. Usage: blender -b --python preview.py -- in.glb out.png [explode]
import sys
import math
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args[0])
explode = len(args) > 2
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    if explode:
        o.location.x += o.location.x * 1.5 + (2 if 'fairingR' in o.name else -2 if 'fairingL' in o.name else 0)
        o.location.z *= 1.25
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    for vertex in o.data.vertices:
        w = o.matrix_world @ vertex.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
center = (lo + hi) / 2
size = max(hi - lo)
for o in bpy.data.objects:
    if o.type == 'MESH':
        print('OBJ', o.name, [round(x, 2) for x in o.matrix_world.translation], [round(x, 2) for x in o.dimensions])
print('BOUNDS', [round(x, 2) for x in lo], [round(x, 2) for x in hi])
camera_data = bpy.data.cameras.new('cam')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = size * 1.08
camera = bpy.data.objects.new('cam', camera_data)
bpy.context.scene.collection.objects.link(camera)
direction = Vector((0.75, -1, 0.12)).normalized()
camera.location = center + direction * size * 3
camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
camera_data.clip_end = size * 10
bpy.context.scene.camera = camera
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_cavity = True
scene.render.resolution_x = 700
scene.render.resolution_y = 1100
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('w')
scene.world.color = (0.02, 0.03, 0.05)
scene.render.filepath = args[1]
bpy.ops.render.render(write_still=True)
