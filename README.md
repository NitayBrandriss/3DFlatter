# Project: 3D-to-2D Mesh Unfolder (PoC)

## 1. Overview
This project is a web-based utility designed to transform 3D polygonal meshes into 2D flat patterns. Inspired by Pepakura, the goal is to allow users to define "seams" on a 3D model and generate a corresponding 2D layout that can be printed and reassembled into the original 3D shape. 

In this Proof of Concept (PoC) stage, the material is treated as having zero thickness (similar to paper/origami).

## 2. Core Objectives
- **File Input:** Load 3D models (STL/OBJ/GLB).
- **Seam Definition:** Provide a manual and AI-assisted way to define where the mesh should be "cut".
- **Unfolding Engine:** Implement a geometric flattening algorithm to project 3D faces into a 2D plane.
- **Export:** Export the final layout as a 2D vector file (SVG/PDF).

## 3. Key Features

### Phase 1: Manual Seam Selection
- **Interactive 3D Viewport:** Using Three.js to render the model.
- **Edge Selection:** Users can click on specific edges of the mesh to mark them as "Seams".
- **Visual Feedback:** Selected seams are highlighted (e.g., bright red) to distinguish them from the rest of the mesh.

### Phase 2: AI-Assisted Seaming (Heuristic/AI)
- **Automatic Suggestions:** An algorithm or LLM-based logt  that identifies high-curvature areas or complex junctions.
- **Approval Workflow:** The system proposes a set of seams, and the user can approve/reject individual cuts or the entire set.
- **Optimization:** Suggest cuts that minimize "stretching" or maximize the size of continuous 2D islands.

### Phase 3: Flattening Logic (The "Unfold")
- **Island Generation:** Based on the seams, the mesh is partitioned into "islands" (connected groups of faces).
- **Incremental Flattening:** For each island, project the first face to 2D, then iteratively "hinge" adjacent faces onto the same plane until the island is flat.
- **Collision Detection:** Basic check to ensure 2D parts do not overlap during the unfolding process.

## 4. Technical Stack (Proposed)
- **Frontend:** Next.js / React.
- **3D Rendering:** Three.js with @react-three/fiber and @react-three/drei.
- **Geometry Processing:** Custom JavaScript logic utilizing Three.js `BufferGeometry`.
- **State Management:** Zustand or React Context for managing selected seams and mesh data.

## 5. Development Roadmap (PoC Steps)
1.  **Environment Setup:** Initialize Next.js + Three.js.
2.  **Model Loader:** Build a UI to upload and display 3D assets.
3.  **Seam Tool:** Implement Raycasting to select and store edge indices.
4.  **Flattening Algorithm:** Create a script to "unroll" a simple cube/pyramid based on selected seams.
5.  **2D Canvas:** Render the flattened result in a separate 2D view using SVG.

## 6. Future Considerations (Post-PoC)
- Accounting for material thickness (Foam Beveling).
- Adding "Flaps" or "Tabs" for gluing/joining.
- Real-time "Strain" heatmaps to show where the material might deform.

## Project decisions (ADRs)
- See `docs/decisions/0001-mesh-model-and-topology.md`
