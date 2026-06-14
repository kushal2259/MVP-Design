# ============================================================================
#  Blender headless render script for ArchCopilot GLB exports.
#  Imports a .glb, frames it, lights it, orbits a camera around it and renders
#  a cinematic MP4 fly-around.
#
#  Usage:
#    blender -b -P render.py -- <input.glb> <output.mp4> [frames] [day|night]
#  Example:
#    blender -b -P render.py -- interior-model.glb out.mp4 240 day
# ============================================================================
import bpy, sys, math, os, subprocess, shutil, tempfile
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
INP = argv[0] if len(argv) > 0 else 'interior-model.glb'
OUT = argv[1] if len(argv) > 1 else 'out.mp4'
FRAMES = int(argv[2]) if len(argv) > 2 else 240
MOOD = argv[3] if len(argv) > 3 else 'day'

# ── Reset to an empty scene ──
bpy.ops.wm.read_factory_settings(use_empty=True)

# ── Import the GLB ──
bpy.ops.import_scene.gltf(filepath=INP)

# ── Bounding box of all imported meshes ──
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    print('No meshes imported — aborting'); sys.exit(1)
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for corner in o.bound_box:
        w = o.matrix_world @ Vector(corner)
        mn = Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
        mx = Vector((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
center = (mn + mx) / 2.0
size = max((mx - mn).length, 2.0)

# ── Pivot + camera (camera parented to a rotating empty) ──
pivot = bpy.data.objects.new('Pivot', None)
bpy.context.collection.objects.link(pivot)
pivot.location = center

cam_data = bpy.data.cameras.new('Cam')
cam_data.lens = 30
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.collection.objects.link(cam)
cam.location = center + Vector((size * 0.75, -size * 0.75, size * 0.45))
cam.parent = pivot
trk = cam.constraints.new('TRACK_TO')
trk.target = pivot
trk.track_axis = 'TRACK_NEGATIVE_Z'
trk.up_axis = 'UP_Y'
bpy.context.scene.camera = cam

# ── Orbit animation ──
pivot.rotation_euler = (0, 0, 0)
pivot.keyframe_insert('rotation_euler', frame=1)
pivot.rotation_euler = (0, 0, math.radians(360))
pivot.keyframe_insert('rotation_euler', frame=FRAMES)
if pivot.animation_data and pivot.animation_data.action:
    action = pivot.animation_data.action
    # Blender 4.x: action.fcurves  |  Blender 5.x: action.layers[].strips[].channelbags
    fcurves = []
    if hasattr(action, 'fcurves'):
        fcurves = list(action.fcurves)
    elif hasattr(action, 'layers'):
        for layer in action.layers:
            for strip in layer.strips:
                if hasattr(strip, 'channelbag'):
                    for cb in strip.channelbags:
                        fcurves.extend(cb.fcurves)
    for fc in fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

# ── Lighting + world ──
sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy = 2.5 if MOOD == 'day' else 0.4
sun = bpy.data.objects.new('Sun', sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(52), math.radians(20), math.radians(15))

world = bpy.data.worlds.new('World')
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
if bg:
    if MOOD == 'day':
        bg.inputs[0].default_value = (0.85, 0.89, 0.95, 1.0); bg.inputs[1].default_value = 1.0
    else:
        bg.inputs[0].default_value = (0.02, 0.03, 0.08, 1.0); bg.inputs[1].default_value = 0.15

# ── Render settings (EEVEE for speed; name varies by Blender version) ──
sc = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        continue
try:
    sc.eevee.use_bloom = True          # glow for lit windows/lights (older EEVEE)
except Exception:
    pass

sc.frame_start = 1
sc.frame_end = FRAMES
sc.render.resolution_x = 1280
sc.render.resolution_y = 720
sc.render.fps = 30
# Blender 5.x removed FFMPEG from image_settings.file_format.
# Strategy: render PNG frames, then use Blender's own VSE to encode them as MP4.
tmpdir = tempfile.mkdtemp(prefix='archrender_')
sc.render.image_settings.file_format = 'PNG'
frame_prefix = os.path.join(tmpdir, 'frame_')
sc.render.filepath = frame_prefix

print(f'Rendering {FRAMES} frames ({MOOD}) → {tmpdir}')
bpy.ops.render.render(animation=True)

# ── Stitch frames into MP4 with ffmpeg ───────────────────────────────────────
# Search Blender's own install tree first (it bundles ffmpeg), then system PATH.
import glob as _glob
blender_dir = os.path.dirname(bpy.app.binary_path)
ffmpeg_candidates = [
    *_glob.glob(os.path.join(blender_dir, '**', 'ffmpeg.exe'), recursive=True),
    *_glob.glob(os.path.join(blender_dir, '**', 'ffmpeg'),     recursive=True),
    shutil.which('ffmpeg') or '',
    r'C:\ffmpeg\bin\ffmpeg.exe',
    r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
]
ffmpeg = next((f for f in ffmpeg_candidates if f and os.path.isfile(f)), None)

frame_pattern = os.path.join(tmpdir, 'frame_%04d.png')
if ffmpeg:
    cmd = [ffmpeg, '-y', '-framerate', str(sc.render.fps), '-i', frame_pattern,
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', os.path.abspath(OUT)]
    print('Stitching with ffmpeg:', ffmpeg)
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmpdir)
    print('DONE:', OUT)
else:
    print(f'\n✅ All {FRAMES} frames rendered to: {tmpdir}')
    print('⚠  ffmpeg not found — install it to auto-stitch (winget install ffmpeg)')
    print('   Then run this command yourself:')
    print(f'   ffmpeg -framerate 30 -i "{frame_pattern}" -c:v libx264 -pix_fmt yuv420p -crf 18 "{os.path.abspath(OUT)}"')
