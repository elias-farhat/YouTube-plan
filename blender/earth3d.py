"""3D clip with Blender (bpy): a lit Earth with continents, clouds, atmosphere glow and an orbiting Moon, stars behind.

    python blender/earth3d.py OUT_DIR [--seconds 6] [--fps 30] [--width 540] [--height 960] [--samples 12] [--frame N]

Renders PNG frames with Cycles (CPU, no GPU needed) into OUT_DIR; tools/render3d.mjs-style muxing is a one-liner:
    ffmpeg -framerate 30 -i OUT_DIR/f_%04d.png -vf scale=1080:1920:flags=lanczos -c:v libx264 -pix_fmt yuv420p out.mp4
Everything is procedural (noise textures), so no image assets are needed.
"""
import argparse
import math
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--seconds", type=float, default=6)
ap.add_argument("--fps", type=int, default=30)
ap.add_argument("--width", type=int, default=540)
ap.add_argument("--height", type=int, default=960)
ap.add_argument("--samples", type=int, default=12)
ap.add_argument("--frame", type=int, default=0, help="render just this frame (test)")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 3
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = a.width, a.height, 100
sc.render.fps = a.fps
N = int(a.seconds * a.fps)
sc.frame_start, sc.frame_end = 1, N
sc.render.image_settings.file_format = "PNG"
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"


def mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    return m, m.node_tree.nodes, m.node_tree.links


def sphere(name, r, segs=96):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=r)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.shade_smooth()
    return o


# ---------------------------------------------------------------- Earth ---
earth = sphere("Earth", 1.0)
m, n, l = mat("earth")
out = n.new("ShaderNodeOutputMaterial")
bsdf = n.new("ShaderNodeBsdfPrincipled")
tc = n.new("ShaderNodeTexCoord")
sep = n.new("ShaderNodeSeparateXYZ")
l.new(tc.outputs["Object"], sep.inputs[0])
cont = n.new("ShaderNodeTexNoise"); cont.inputs["Scale"].default_value = 2.1; cont.inputs["Detail"].default_value = 9; cont.inputs["Roughness"].default_value = 0.6
l.new(tc.outputs["Object"], cont.inputs["Vector"])
land = n.new("ShaderNodeMath"); land.operation = "SMOOTH_MIN" if False else "GREATER_THAN"
ramp_land = n.new("ShaderNodeValToRGB")
ramp_land.color_ramp.elements[0].position = 0.50; ramp_land.color_ramp.elements[1].position = 0.515
l.new(cont.outputs["Fac"], ramp_land.inputs["Fac"])
# land colour: greens / browns / deserts from a second noise
tint = n.new("ShaderNodeTexNoise"); tint.inputs["Scale"].default_value = 5.5; tint.inputs["Detail"].default_value = 6
l.new(tc.outputs["Object"], tint.inputs["Vector"])
lc = n.new("ShaderNodeValToRGB")
for e, col in zip(lc.color_ramp.elements, [(0.05, 0.28, 0.07, 1), (0.52, 0.42, 0.2, 1)]):
    e.color = col
l.new(tint.outputs["Fac"], lc.inputs["Fac"])
ocean = n.new("ShaderNodeRGB"); ocean.outputs[0].default_value = (0.01, 0.07, 0.30, 1)
mix_col = n.new("ShaderNodeMix"); mix_col.data_type = "RGBA"
l.new(ramp_land.outputs["Color"], mix_col.inputs["Factor"])
l.new(ocean.outputs[0], mix_col.inputs["A"]); l.new(lc.outputs["Color"], mix_col.inputs["B"])
# ice caps (|z| near the poles) mixed in with a noisy edge
absz = n.new("ShaderNodeMath"); absz.operation = "ABSOLUTE"; l.new(sep.outputs["Z"], absz.inputs[0])
ice_ramp = n.new("ShaderNodeValToRGB"); ice_ramp.color_ramp.elements[0].position = 0.84; ice_ramp.color_ramp.elements[1].position = 0.9
wob = n.new("ShaderNodeMath"); wob.operation = "SUBTRACT"; wob.inputs[1].default_value = 0.5; l.new(cont.outputs["Fac"], wob.inputs[0])
wob2 = n.new("ShaderNodeMath"); wob2.operation = "MULTIPLY"; wob2.inputs[1].default_value = 0.22; l.new(wob.outputs[0], wob2.inputs[0])
addn = n.new("ShaderNodeMath"); addn.operation = "ADD"; l.new(absz.outputs[0], addn.inputs[0]); l.new(wob2.outputs[0], addn.inputs[1])
l.new(addn.outputs[0], ice_ramp.inputs["Fac"])
mix_ice = n.new("ShaderNodeMix"); mix_ice.data_type = "RGBA"; mix_ice.inputs["B"].default_value = (0.95, 0.97, 1, 1)
l.new(ice_ramp.outputs["Color"], mix_ice.inputs["Factor"]); l.new(mix_col.outputs["Result"], mix_ice.inputs["A"])
l.new(mix_ice.outputs["Result"], bsdf.inputs["Base Color"])
rough = n.new("ShaderNodeMapRange"); rough.inputs["To Min"].default_value = 0.06; rough.inputs["To Max"].default_value = 0.8
l.new(ramp_land.outputs["Color"], rough.inputs["Value"]); l.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
bump = n.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; bump.inputs["Distance"].default_value = 0.05
hmul = n.new("ShaderNodeMath"); hmul.operation = "MULTIPLY"; l.new(cont.outputs["Fac"], hmul.inputs[0]); l.new(ramp_land.outputs["Color"], hmul.inputs[1])
l.new(hmul.outputs[0], bump.inputs["Height"]); l.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
l.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
earth.data.materials.append(m)

# ---------------------------------------------------------------- clouds ---
clouds = sphere("Clouds", 1.018)
m, n, l = mat("clouds")
out = n.new("ShaderNodeOutputMaterial"); tc = n.new("ShaderNodeTexCoord")
nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 3.4; nz.inputs["Detail"].default_value = 8; nz.inputs["Roughness"].default_value = 0.65
mp = n.new("ShaderNodeMapping"); l.new(tc.outputs["Object"], mp.inputs["Vector"]); l.new(mp.outputs["Vector"], nz.inputs["Vector"])
cr = n.new("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.56; cr.color_ramp.elements[1].position = 0.74
l.new(nz.outputs["Fac"], cr.inputs["Fac"])
tr = n.new("ShaderNodeBsdfTransparent"); df = n.new("ShaderNodeBsdfDiffuse"); df.inputs["Color"].default_value = (0.9, 0.92, 0.95, 1)
mx = n.new("ShaderNodeMixShader"); l.new(cr.outputs["Color"], mx.inputs["Fac"]); l.new(tr.outputs[0], mx.inputs[1]); l.new(df.outputs[0], mx.inputs[2])
l.new(mx.outputs[0], out.inputs["Surface"])
clouds.data.materials.append(m)

# ------------------------------------------------------------ atmosphere ---
atmo = sphere("Atmosphere", 1.07, 64)
m, n, l = mat("atmo")
out = n.new("ShaderNodeOutputMaterial"); lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.35
pw = n.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 4.0; l.new(lw.outputs["Fresnel"], pw.inputs[0])
em = n.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.25, 0.5, 1.0, 1); em.inputs["Strength"].default_value = 1.6
tr = n.new("ShaderNodeBsdfTransparent"); mx = n.new("ShaderNodeMixShader")
l.new(pw.outputs[0], mx.inputs["Fac"]); l.new(tr.outputs[0], mx.inputs[1]); l.new(em.outputs[0], mx.inputs[2]); l.new(mx.outputs[0], out.inputs["Surface"])
atmo.data.materials.append(m)
atmo.visible_shadow = False
# the glow shell is only for the camera; as a light source it would fill the whole planet and remove the night side
for attr in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter"):
    setattr(atmo, attr, False)

# ------------------------------------------------------------------ Moon ---
bpy.ops.object.empty_add(location=(0, 0, 0)); pivot = bpy.context.object; pivot.name = "MoonPivot"
moon = sphere("Moon", 0.26, 64); moon.location = (2.05, 0, 0.0); moon.parent = pivot
m, n, l = mat("moon")
out = n.new("ShaderNodeOutputMaterial"); bsdf = n.new("ShaderNodeBsdfPrincipled"); tc = n.new("ShaderNodeTexCoord")
nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 9; nz.inputs["Detail"].default_value = 10
vo = n.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 7
l.new(tc.outputs["Object"], nz.inputs["Vector"]); l.new(tc.outputs["Object"], vo.inputs["Vector"])
cm = n.new("ShaderNodeValToRGB"); cm.color_ramp.elements[0].color = (0.18, 0.18, 0.19, 1); cm.color_ramp.elements[1].color = (0.72, 0.71, 0.69, 1)
l.new(nz.outputs["Fac"], cm.inputs["Fac"]); l.new(cm.outputs["Color"], bsdf.inputs["Base Color"])
bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 1.2; l.new(vo.outputs["Distance"], bp.inputs["Height"]); l.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
bsdf.inputs["Roughness"].default_value = 0.95
l.new(bsdf.outputs["BSDF"], out.inputs["Surface"]); moon.data.materials.append(m)

# ----------------------------------------------------------------- stars ---
w = bpy.data.worlds.new("space"); sc.world = w; w.use_nodes = True
n, l = w.node_tree.nodes, w.node_tree.links
n.clear()
out = n.new("ShaderNodeOutputWorld"); bg = n.new("ShaderNodeBackground"); tc = n.new("ShaderNodeTexCoord")
st = n.new("ShaderNodeTexVoronoi"); st.feature = "F1"; st.inputs["Scale"].default_value = 160
sr = n.new("ShaderNodeValToRGB"); sr.color_ramp.elements[0].position = 0.0; sr.color_ramp.elements[0].color = (1, 1, 1, 1)
sr.color_ramp.elements[1].position = 0.05; sr.color_ramp.elements[1].color = (0, 0, 0, 1)
tw = n.new("ShaderNodeTexNoise"); tw.inputs["Scale"].default_value = 30; tw.inputs["Detail"].default_value = 0   # per-star brightness variation
tmul = n.new("ShaderNodeMix"); tmul.data_type = "RGBA"; tmul.blend_type = "MULTIPLY"; tmul.inputs["Factor"].default_value = 1
neb = n.new("ShaderNodeTexNoise"); neb.inputs["Scale"].default_value = 1.3; neb.inputs["Detail"].default_value = 4
nr = n.new("ShaderNodeValToRGB"); nr.color_ramp.elements[0].position = 0.38; nr.color_ramp.elements[1].position = 0.9
nr.color_ramp.elements[0].color = (0.004, 0.006, 0.02, 1); nr.color_ramp.elements[1].color = (0.02, 0.01, 0.06, 1)
add = n.new("ShaderNodeMix"); add.data_type = "RGBA"; add.blend_type = "ADD"; add.inputs["Factor"].default_value = 1
for node in (st, tw, neb):
    l.new(tc.outputs["Object"], node.inputs["Vector"])
l.new(st.outputs["Distance"], sr.inputs["Fac"]); l.new(tw.outputs["Fac"], tmul.inputs["B"]); l.new(sr.outputs["Color"], tmul.inputs["A"])
l.new(neb.outputs["Fac"], nr.inputs["Fac"])
l.new(tmul.outputs["Result"], add.inputs["A"]); l.new(nr.outputs["Color"], add.inputs["B"])
l.new(add.outputs["Result"], bg.inputs["Color"])
# the sky is visible to the camera but must NOT light the planet (otherwise there is no night side)
lp = n.new("ShaderNodeLightPath"); sm = n.new("ShaderNodeMath"); sm.operation = "MULTIPLY_ADD"; sm.inputs[1].default_value = 2.4; sm.inputs[2].default_value = 0.10
l.new(lp.outputs["Is Camera Ray"], sm.inputs[0]); l.new(sm.outputs[0], bg.inputs["Strength"]); l.new(bg.outputs[0], out.inputs[0])

# ----------------------------------------------------------------- light ---
bpy.ops.object.empty_add(location=(0, 0, 0)); center = bpy.context.object
bpy.ops.object.light_add(type="SUN", location=(7.5, 2.6, 1.8))
sun = bpy.context.object; sun.data.energy = 4.2; sun.data.angle = math.radians(0.6)
tt = sun.constraints.new("TRACK_TO"); tt.target = center; tt.track_axis = "TRACK_NEGATIVE_Z"; tt.up_axis = "UP_Y"

# ---------------------------------------------------------------- camera ---
bpy.ops.object.empty_add(location=(0, 0, 0)); target = bpy.context.object
bpy.ops.object.camera_add(location=(0, -9.6, 1.1)); cam = bpy.context.object
cam.data.lens = 42
tr = cam.constraints.new("TRACK_TO"); tr.target = target; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
sc.camera = cam

# ------------------------------------------------------------- animation ---
def key(obj, path, idx, f, v):
    obj.keyframe_insert(data_path=path, index=idx, frame=f)

earth.rotation_euler = (math.radians(8), 0, math.radians(-30))
clouds.rotation_euler = earth.rotation_euler
for o, extra in ((earth, 55), (clouds, 70)):
    o.rotation_euler[2] = math.radians(-30); o.keyframe_insert("rotation_euler", index=2, frame=1)
    o.rotation_euler[2] = math.radians(-30 + extra); o.keyframe_insert("rotation_euler", index=2, frame=N)
pivot.rotation_euler[2] = math.radians(200); pivot.keyframe_insert("rotation_euler", index=2, frame=1)
pivot.rotation_euler[2] = math.radians(200 + 95); pivot.keyframe_insert("rotation_euler", index=2, frame=N)
pivot.rotation_euler[0] = math.radians(24)
cam.location = (0, -9.6, 1.1); cam.keyframe_insert("location", frame=1)
cam.location = (0, -6.9, 0.6); cam.keyframe_insert("location", frame=N)
for ob in (earth, clouds, pivot, cam):
    if ob.animation_data and ob.animation_data.action:
        try:
            for fc in ob.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR" if ob is not cam else "BEZIER"
        except Exception:
            pass

os.makedirs(a.out, exist_ok=True)
sc.render.filepath = os.path.join(a.out, "f_")
if a.frame:
    sc.frame_set(a.frame)
    sc.render.filepath = os.path.join(a.out, f"test_{a.frame:04d}.png")
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("done")
