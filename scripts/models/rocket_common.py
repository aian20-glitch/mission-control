# Shared helpers for turning a NASA rocket model into a light GLB split into stages.
import bpy
import bmesh
from mathutils import Matrix, Vector


def mesh_descendants(root):
    found = []
    stack = [root]
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type == 'MESH' and len(o.data.polygons) > 0:
            found.append(o)
    return found


# Size and middle of an object in the scene, in metres (parents' scale included).
def world_box(o):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    return max(hi - lo), (lo + hi) / 2


def join_objects(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.hide_set(False)
        o.hide_viewport = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    # The source file animates its objects; without this the exporter puts the old placement back.
    joined.animation_data_clear()
    # Move the object's placement into the mesh itself, so the object sits at the origin, unrotated.
    matrix = joined.matrix_world.copy()
    joined.data.transform(matrix)
    if matrix.determinant() < 0:
        joined.data.flip_normals()
    joined.matrix_world = Matrix.Identity(4)
    joined.data.update()
    return joined


def triangles(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def decimate(o, target):
    count = triangles(o)
    if count <= target:
        return
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    modifier = o.modifiers.new('decimate', 'DECIMATE')
    modifier.ratio = target / count
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def duplicate(o, name):
    copy = o.copy()
    copy.data = o.data.copy()
    copy.name = name
    bpy.context.scene.collection.objects.link(copy)
    return copy


# Keep only the side of the plane the normal points to. fill = close the cut with a cap.
def cut(o, point, normal, fill):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    geometry = bm.verts[:] + bm.edges[:] + bm.faces[:]
    result = bmesh.ops.bisect_plane(bm, geom=geometry, plane_co=Vector(point), plane_no=Vector(normal), clear_inner=True, clear_outer=False)
    if fill:
        edges = [e for e in result['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bm.to_mesh(o.data)
    bm.free()


def origin_to_center(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')


def bounds(o):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], w[i])
            hi[i] = max(hi[i], w[i])
    return [round(x, 2) for x in lo], [round(x, 2) for x in hi]


def export(parts, path, draco=True):
    keep = set(parts)
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in parts:
        origin_to_center(o)
        lo, hi = bounds(o)
        print('PART', o.name, 'tris', triangles(o), 'min', lo, 'max', hi, 'materials', len(o.data.materials))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        export_image_format='WEBP',
        export_image_quality=80,
        export_animations=False,
    )
    print('EXPORTED', path)


def flat_material(name, color, roughness, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    material.diffuse_color = (color[0], color[1], color[2], 1)
    return material


# A body of revolution around the vertical axis. profile = list of (radius, height) from bottom to top.
def lathe(name, profile, material, center=(0, 0), segments=48):
    import math
    bm = bmesh.new()
    rings = []
    for radius, height in profile:
        ring = []
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            ring.append(bm.verts.new((center[0] + math.cos(angle) * radius, center[1] + math.sin(angle) * radius, height)))
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    mesh.materials.append(material)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def join_two(a, b):
    bpy.ops.object.select_all(action='DESELECT')
    a.select_set(True)
    b.select_set(True)
    bpy.context.view_layer.objects.active = a
    bpy.ops.object.join()
    return a
